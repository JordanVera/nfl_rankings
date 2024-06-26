import 'dotenv/config';
import * as tf from '@tensorflow/tfjs-node';

export const fetchAllTeamsAndReturnTeamIds = async () => {
  const response = await fetch(
    `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.SPORTSDATAIO_API_KEY}`,
    {
      method: 'GET',
    }
  );

  const json = await response.json();

  // console.log({ json });

  const teamIds = json.map((team) => team.TeamID);

  console.log(teamIds);

  return teamIds;
};

export const fetchSeasonGameData = async (season, teamIds) => {
  const resultsForEachTeamBySeason = await Promise.all(
    teamIds.map(async (teamId) => {
      const response = await fetch(
        `https://api.sportsdata.io/v3/nfl/scores/json/TeamGameStatsBySeason/${season}/${teamId}/all?key=${process.env.SPORTSDATAIO_API_KEY}`,
        {
          method: 'GET',
        }
      );

      return response.json();
    })
  );

  // console.log({ resultsForEachTeamBySeason });
  // console.log(
  //   'length of resultsForEachTeamBySeason: ',
  //   resultsForEachTeamBySeason.length
  // );

  return resultsForEachTeamBySeason;
};

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

  return { inputTensor, outputTensor };
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

try {
  const teamIds = await fetchAllTeamsAndReturnTeamIds();
  const gameData = await fetchSeasonGameData(2023, teamIds);
  const { inputTensor, outputTensor } = preprocessData(gameData);

  const model = createModel();

  console.log('Input Tensors');
  console.log(inputTensor.print());
  console.log(inputTensor.shape);
  console.log('Output Tensors');
  console.log(outputTensor.print());
  console.log(outputTensor.shape);

  async function trainModel(model, inputTensor, outputTensor) {
    await model.fit(inputTensor, outputTensor, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
    });
    console.log('Model trained!');
  }

  trainModel(model, inputTensor, outputTensor);
} catch (error) {
  console.log(error);
}
