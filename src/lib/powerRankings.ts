import * as tf from '@tensorflow/tfjs';
import { fetchSeasonGameData } from '../utils/espnApi';
import type {
  EspnTeam,
  GameStats,
  ProcessedFeature,
  RankedTeam,
  RankingsResponse,
} from '../types/nfl';

const parseTimeOfPossession = (timeStr: string): number => {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
};

const mean = (data: number[]): number =>
  data.reduce((a, b) => a + b, 0) / data.length;

const std = (data: number[]): number => {
  const dataMean = mean(data);
  return Math.sqrt(
    data.reduce((a, b) => a + (b - dataMean) ** 2, 0) / data.length
  );
};

const normalizeFeatures = (features: ProcessedFeature[]): ProcessedFeature[] => {
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};

  const featureNames = Object.keys(features[0]) as (keyof ProcessedFeature)[];
  featureNames.forEach((name) => {
    means[name] = mean(features.map((f) => f[name]));
    const featureStd = std(features.map((f) => f[name]));
    stds[name] = featureStd === 0 ? 1 : featureStd;
  });

  return features.map((f) => {
    const normalized = { ...f };
    featureNames.forEach((name) => {
      normalized[name] = (f[name] - means[name]) / stds[name];
    });
    return normalized;
  });
};

const toProcessedFeature = (game: GameStats): ProcessedFeature => ({
  offensiveYards: game.OffensiveYards,
  passingYards: game.PassingYards,
  rushingYards: game.RushingYards,
  completionPercentage: game.CompletionPercentage,
  firstDowns: game.FirstDowns,
  thirdDownConversions: game.ThirdDownConversions,
  fourthDownConversions: game.FourthDownConversions,
  redZoneConversions: game.RedZoneConversions,
  opponentOffensiveYards: game.OpponentOffensiveYards,
  opponentPassingYards: game.OpponentPassingYards,
  opponentRushingYards: game.OpponentRushingYards,
  opponentCompletionPercentage: game.OpponentCompletionPercentage,
  opponentFirstDowns: game.OpponentFirstDowns,
  opponentThirdDownConversions: game.OpponentThirdDownConversions,
  opponentFourthDownConversions: game.OpponentFourthDownConversions,
  opponentRedZoneConversions: game.OpponentRedZoneConversions,
  kickReturnYards: game.KickReturnYards,
  puntReturnYards: game.PuntReturnYards,
  fieldGoalsMade: game.FieldGoalsMade,
  punts: game.Punts,
  turnovers: game.Giveaways,
  takeaways: game.Takeaways,
  penalties: game.Penalties,
  penaltyYards: game.PenaltyYards,
  timeOfPossession: parseTimeOfPossession(game.TimeOfPossession),
  score: game.Score,
  opponentScore: game.OpponentScore,
});

const featureVector = (f: ProcessedFeature): number[] => [
  f.offensiveYards,
  f.passingYards,
  f.rushingYards,
  f.completionPercentage,
  f.firstDowns,
  f.thirdDownConversions,
  f.fourthDownConversions,
  f.redZoneConversions,
  f.opponentOffensiveYards,
  f.opponentPassingYards,
  f.opponentRushingYards,
  f.opponentCompletionPercentage,
  f.opponentFirstDowns,
  f.opponentThirdDownConversions,
  f.opponentFourthDownConversions,
  f.opponentRedZoneConversions,
  f.kickReturnYards,
  f.puntReturnYards,
  f.fieldGoalsMade,
  f.punts,
  f.turnovers,
  f.takeaways,
  f.penalties,
  f.penaltyYards,
  f.timeOfPossession,
  f.score,
  f.opponentScore,
];

const preprocessData = (data: GameStats[][]) => {
  const features: ProcessedFeature[][] = data.map((teamGames) =>
    teamGames.map(toProcessedFeature)
  );

  const flattenedFeatures = features.flat();
  const normalizedFeatures = normalizeFeatures(flattenedFeatures);

  const inputs = normalizedFeatures.map(featureVector);
  const outputs = normalizedFeatures.map((f) => [f.score - f.opponentScore]);

  const inputTensor = tf.tensor2d(inputs);
  const outputTensor = tf.tensor2d(outputs);

  return { inputTensor, outputTensor, features };
};

const createModel = () => {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({ inputShape: [27], units: 128, activation: 'relu' })
  );
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
};

const rankFromPredictions = (
  teams: EspnTeam[],
  features: ProcessedFeature[][],
  predictionValues: number[][]
): RankedTeam[] => {
  const teamScores: Record<string, number> = {};
  let offset = 0;

  teams.forEach((team, index) => {
    const teamGames = features[index];
    const teamPredictionScores = predictionValues.slice(
      offset,
      offset + teamGames.length
    );
    offset += teamGames.length;

    if (teamGames.length === 0) {
      teamScores[team.id] = 0;
      return;
    }

    teamScores[team.id] =
      teamPredictionScores.reduce((acc, val) => acc + val[0], 0) /
      teamGames.length;
  });

  return Object.entries(teamScores)
    .map(([teamId, score]) => {
      const team = teams.find((entry) => entry.id === teamId);
      return {
        teamId,
        teamName: team?.name ?? teamId,
        logoUrl: team?.logoUrl ?? '',
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
};

export const trainAndRankTeams = async (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][]
): Promise<RankedTeam[]> => {
  const teamsWithGames = teams.filter((_, index) => gamesByTeam[index].length > 0);
  const games = gamesByTeam.filter((teamGames) => teamGames.length > 0);

  if (teamsWithGames.length === 0 || games.flat().length === 0) {
    throw new Error('No team game stats available to train the ranking model.');
  }

  await tf.ready();
  tf.engine().startScope();

  const { inputTensor, outputTensor, features } = preprocessData(games);
  const model = createModel();

  try {
    await model.fit(inputTensor, outputTensor, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
    });

    const predictions = model.predict(inputTensor);
    const predictionTensor = Array.isArray(predictions)
      ? predictions[0]
      : predictions;
    const predictionValues = (await predictionTensor.array()) as number[][];

    return rankFromPredictions(teamsWithGames, features, predictionValues);
  } finally {
    inputTensor.dispose();
    outputTensor.dispose();
    model.dispose();
    tf.engine().endScope();
  }
};

export const computeSeasonRankings = async (
  season: number
): Promise<RankingsResponse> => {
  const { teams, gamesByTeam } = await fetchSeasonGameData(season);
  const rankedTeams = await trainAndRankTeams(teams, gamesByTeam);

  return { season, rankedTeams };
};
