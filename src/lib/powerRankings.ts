import * as tf from '@tensorflow/tfjs';
import {
  fetchLeagueTeams,
  fetchOfficialEspnRankings,
  fetchSeasonGameData,
} from '../utils/espnApi';
import type {
  EspnTeam,
  GameStats,
  League,
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

const SRS_ITERATIONS = 20;
const CUPCAKE_PERCENTILE = 0.1;
const CFB_TOP_COUNT = 25;

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

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[index];
};

const meanCenter = (ratings: Record<string, number>) => {
  const values = Object.values(ratings);
  if (values.length === 0) return;
  const shift = mean(values);
  for (const id of Object.keys(ratings)) {
    ratings[id] -= shift;
  }
};

const meanPredictedMargins = (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][],
  predictionValues: number[][]
): Record<string, number> => {
  const teamScores: Record<string, number> = {};
  let offset = 0;

  teams.forEach((team, index) => {
    const teamGames = gamesByTeam[index];
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

  return teamScores;
};

const applySimpleRatingSystem = (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][],
  predictionValues: number[][]
): Record<string, number> => {
  const roster = new Set(teams.map((team) => team.id));
  const marginsByTeam = new Map<string, number[]>();
  const opponentsByTeam = new Map<string, string[]>();
  let offset = 0;

  teams.forEach((team, index) => {
    const teamGames = gamesByTeam[index];
    const margins = predictionValues
      .slice(offset, offset + teamGames.length)
      .map((value) => value[0]);
    offset += teamGames.length;
    marginsByTeam.set(team.id, margins);
    opponentsByTeam.set(
      team.id,
      teamGames.map((game) => game.opponentTeamId)
    );
  });

  const ratings = meanPredictedMargins(teams, gamesByTeam, predictionValues);
  meanCenter(ratings);

  for (let iteration = 0; iteration < SRS_ITERATIONS; iteration += 1) {
    const cupcakeFloor = percentile(Object.values(ratings), CUPCAKE_PERCENTILE);
    const next: Record<string, number> = {};

    for (const team of teams) {
      const margins = marginsByTeam.get(team.id) ?? [];
      const opponents = opponentsByTeam.get(team.id) ?? [];
      if (margins.length === 0) {
        next[team.id] = 0;
        continue;
      }

      let sum = 0;
      for (let gameIndex = 0; gameIndex < margins.length; gameIndex += 1) {
        const opponentId = opponents[gameIndex];
        const opponentRating = roster.has(opponentId)
          ? (ratings[opponentId] ?? cupcakeFloor)
          : cupcakeFloor;
        sum += margins[gameIndex] + opponentRating;
      }
      next[team.id] = sum / margins.length;
    }

    Object.assign(ratings, next);
    meanCenter(ratings);
  }

  return ratings;
};

const rankedTeamsFromScores = (
  teams: EspnTeam[],
  teamScores: Record<string, number>
): RankedTeam[] =>
  Object.entries(teamScores)
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

export const trainAndRankTeams = async (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][],
  options: { strengthOfSchedule?: boolean } = {}
): Promise<RankedTeam[]> => {
  const teamsWithGames = teams.filter((_, index) => gamesByTeam[index].length > 0);
  const games = gamesByTeam.filter((teamGames) => teamGames.length > 0);

  if (teamsWithGames.length === 0 || games.flat().length === 0) {
    throw new Error('No team game stats available to train the ranking model.');
  }

  await tf.ready();
  tf.engine().startScope();

  const { inputTensor, outputTensor } = preprocessData(games);
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

    const teamScores = options.strengthOfSchedule
      ? applySimpleRatingSystem(teamsWithGames, games, predictionValues)
      : meanPredictedMargins(teamsWithGames, games, predictionValues);

    return rankedTeamsFromScores(teamsWithGames, teamScores);
  } finally {
    inputTensor.dispose();
    outputTensor.dispose();
    model.dispose();
    tf.engine().endScope();
  }
};

export const computeSeasonRankings = async (
  season: number,
  league: League = 'nfl'
): Promise<RankingsResponse> => {
  const teams = await fetchLeagueTeams(league, season);
  const seasonGamesPromise = fetchSeasonGameData(league, season, teams);
  const espnRankingsPromise = fetchOfficialEspnRankings(
    league,
    season,
    teams
  ).catch((error: unknown) => {
    console.error('Failed to load ESPN rankings', error);
    return null;
  });

  const [{ gamesByTeam }, espnRankings] = await Promise.all([
    seasonGamesPromise,
    espnRankingsPromise,
  ]);
  const rankedTeams = await trainAndRankTeams(teams, gamesByTeam, {
    strengthOfSchedule: league === 'cfb',
  });

  return {
    season,
    league,
    rankedTeams:
      league === 'cfb' ? rankedTeams.slice(0, CFB_TOP_COUNT) : rankedTeams,
    espnRankings,
  };
};
