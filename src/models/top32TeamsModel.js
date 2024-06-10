import 'dotenv/config';
import colors from 'colors';
import * as tf from '@tensorflow/tfjs-node';
import {
  fetchAllTeamsAndReturnTeamIds,
  fetchSeasonGameData,
} from '../utils/sportsDataApiUtils.js';

// Preprocess the data
const preprocessData = (data) => {
  // Extract relevant features and normalize
  const features = data.map((teamGames) =>
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

  // console.log('_________________Featuresssss_________________');
  // console.log(features);

  // Flatten the array and normalize features
  const flattenedFeatures = features.flat();
  const normalizedFeatures = normalizeFeatures(flattenedFeatures);

  // Convert to tensors
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

// Normalize features
const normalizeFeatures = (features) => {
  const means = {};
  const stds = {};

  const featureNames = Object.keys(features[0]);
  featureNames.forEach((name) => {
    means[name] = mean(features.map((f) => f[name]));
    stds[name] = std(features.map((f) => f[name]));
  });

  return features.map((f) => {
    const normalized = {};
    featureNames.forEach((name) => {
      normalized[name] = (f[name] - means[name]) / stds[name];
    });
    return normalized;
  });
};

// Helper functions for mean and standard deviation
const mean = (data) => data.reduce((a, b) => a + b, 0) / data.length;

const std = (data) => {
  const dataMean = mean(data);
  return Math.sqrt(
    data.reduce((a, b) => a + (b - dataMean) ** 2, 0) / data.length
  );
};

// Convert time of possession from "mm:ss" format to seconds
const parseTimeOfPossession = (timeStr) => {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
};

// Define the model
const createModel = () => {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({ inputShape: [27], units: 64, activation: 'relu' })
  );
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 })); // Output layer for ranking score

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

    // console.log('Input Tensors');
    // console.log(inputTensor.print());
    // console.log(inputTensor.shape);
    // console.log('Output Tensors');
    // console.log(outputTensor.print());
    // console.log(outputTensor.shape);

    async function trainModel(model, inputTensor, outputTensor) {
      await model.fit(inputTensor, outputTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
      });
      console.log('Model trained!'.green.bold);
    }

    await trainModel(model, inputTensor, outputTensor);

    // Predict scores for each game
    const predictions = model.predict(inputTensor);
    const predictionValues = await predictions.array();

    console.log('Prediction Values'.green.bold);
    console.log(predictionValues);

    // Aggregate predictions by team
    const teamScores = {};
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

    // Fetch team names for better readability
    const response = await fetch(
      `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.SPORTSDATAIO_API_KEY}`,
      {
        method: 'GET',
      }
    );

    const teams = await response.json();
    const teamNames = teams.reduce((acc, team) => {
      acc[team.TeamID] = team.Name;
      return acc;
    }, {});

    console.log('teamScores'.green.bold);
    console.log(teamScores);

    // Rank teams based on scores
    const rankedTeams = Object.entries(teamScores)
      .map(([teamId, score]) => ({
        teamId,
        teamName: teamNames[teamId],
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

// main();

try {
  const teamIds = await fetchAllTeamsAndReturnTeamIds();
  const gameData = await fetchSeasonGameData(2023, teamIds);

  console.log(gameData);
} catch (error) {
  console.log(error);
}
