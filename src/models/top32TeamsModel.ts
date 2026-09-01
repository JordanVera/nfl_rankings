import 'dotenv/config';
import colors from 'colors';
import * as tf from '@tensorflow/tfjs-node';
import {
  fetchAllTeamsAndReturnTeamIds,
  fetchSeasonGameData,
} from '../utils/sportsDataApiUtils';
import type { GameStats, ProcessedFeature, Team } from '../types/nfl';

const parseTimeOfPossession = (timeStr: string): number => {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
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
    stds[name] = std(features.map((f) => f[name]));
  });

  return features.map((f) => {
    const normalized = { ...f };
    featureNames.forEach((name) => {
      normalized[name] = (f[name] - means[name]) / stds[name];
    });
    return normalized;
  });
};

const preprocessData = (data: GameStats[][]) => {
  const features: ProcessedFeature[][] = data.map((teamGames) =>
    teamGames.map((game) => ({
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
    }))
  );

  const flattenedFeatures = features.flat();
  const normalizedFeatures = normalizeFeatures(flattenedFeatures);

  const inputs = normalizedFeatures.map((f) => [
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
  ]);
  const outputs = normalizedFeatures.map((f) => [f.score - f.opponentScore]);

  const inputTensor = tf.tensor2d(inputs);
  const outputTensor = tf.tensor2d(outputs);

  return { inputTensor, outputTensor, features };
};

const createModel = () => {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({ inputShape: [27], units: 64, activation: 'relu' })
  );
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
};

const main = async () => {
  try {
    const teamIds = await fetchAllTeamsAndReturnTeamIds();
    const gameData = await fetchSeasonGameData(2023, teamIds);
    const { inputTensor, outputTensor, features } = preprocessData(gameData);

    const model = createModel();

    async function trainModel(
      model: tf.Sequential,
      inputTensor: tf.Tensor,
      outputTensor: tf.Tensor
    ) {
      await model.fit(inputTensor, outputTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
      });
      console.log('Model trained!'.green.bold);
    }

    await trainModel(model, inputTensor, outputTensor);

    const predictions = model.predict(inputTensor);
    const predictionTensor = Array.isArray(predictions)
      ? predictions[0]
      : predictions;
    const predictionValues = (await predictionTensor.array()) as number[][];

    console.log('Prediction Values'.green.bold);
    console.log(predictionValues);

    const teamScores: Record<number, number> = {};
    teamIds.forEach((teamId, index) => {
      const teamGames = features[index];
      const teamPredictionScores = predictionValues.slice(
        index * teamGames.length,
        (index + 1) * teamGames.length
      );
      teamScores[teamId] =
        teamPredictionScores.reduce((acc, val) => acc + val[0], 0) /
        teamGames.length;
    });

    const response = await fetch(
      `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.SPORTSDATAIO_API_KEY}`,
      { method: 'GET' }
    );

    const teams: Team[] = await response.json();
    const teamNames = teams.reduce<Record<number, string>>((acc, team) => {
      acc[team.TeamID] = team.Name;
      return acc;
    }, {});

    console.log('teamScores'.green.bold);
    console.log(teamScores);

    const rankedTeams = Object.entries(teamScores)
      .map(([teamId, score]) => ({
        teamId,
        teamName: teamNames[Number(teamId)],
        score,
      }))
      .sort((a, b) => b.score - a.score);

    console.log('Ranked Teams'.green.bold);
    rankedTeams.forEach((team, index) => {
      console.log(
        `${index + 1}. ${team.teamName} - Score: ${team.score.toFixed(2)}`
      );
    });
  } catch (error) {
    console.log(error);
  }
};

// Uncomment to run full training pipeline:
// main();

try {
  const teamIds = await fetchAllTeamsAndReturnTeamIds();
  const gameData = await fetchSeasonGameData(2023, teamIds);

  console.log(gameData);
} catch (error) {
  console.log(error);
}
