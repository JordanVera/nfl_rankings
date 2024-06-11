import { useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import Image from 'next/image';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ScaleLoader } from 'react-spinners';
// import * as tfvis from '@tensorflow/tfjs-vis';

// Fetch team IDs
const fetchAllTeamsAndReturnTeamIds = async () => {
  const response = await fetch(
    `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`
  );
  const json = await response.json();
  const teamIds = json.map((team) => team.TeamID);
  return teamIds;
};

// Fetch season game data for each team
const fetchSeasonGameData = async (season, teamIds) => {
  const resultsForEachTeamBySeason = await Promise.all(
    teamIds.map(async (teamId) => {
      const response = await fetch(
        `https://api.sportsdata.io/v3/nfl/scores/json/TeamGameStatsBySeason/${season}/${teamId}/all?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`
      );
      return response.json();
    })
  );

  return resultsForEachTeamBySeason;
};

// Preprocess the data
const preprocessData = (data) => {
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
    tf.layers.dense({ inputShape: [27], units: 128, activation: 'relu' })
  );
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 })); // Output layer for ranking score

  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
};

const PowerRankings = () => {
  const [rankedTeams, setRankedTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleGetStandings = async () => {
    setLoading(true);
    try {
      const teamIds = await fetchAllTeamsAndReturnTeamIds();
      const gameData = await fetchSeasonGameData(2023, teamIds);
      const { inputTensor, outputTensor, features } = preprocessData(gameData);

      const model = createModel();

      const surface = { name: 'Model Training', tab: 'Training' };
      const history = await model.fit(inputTensor, outputTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        // callbacks: tfvis.show.fitCallbacks(surface, ['loss', 'mae'], {
        //   height: 200,
        //   callbacks: ['onEpochEnd'],
        // }),
      });

      // Predict scores for each game
      const predictions = model.predict(inputTensor);
      const predictionValues = await predictions.array();

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
        `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`
      );
      const teams = await response.json();
      const teamNames = teams.reduce((acc, team) => {
        acc[team.TeamID] = team.Name;
        return acc;
      }, {});

      // Rank teams based on scores
      const rankedTeams = Object.entries(teamScores)
        .map(([teamId, score]) => ({
          teamId,
          teamName: teamNames[teamId],
          score,
        }))
        .sort((a, b) => b.score - a.score);

      setRankedTeams(rankedTeams);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button
          onClick={handleGetStandings}
          disabled={loading}
          className="flex gap-2.5 items-center bg-gradient-to-r from-green-500 via-blue-500 to-purple-600 hover:bg-gradient-to-l px-4 py-2 rounded-md"
        >
          <AutoAwesomeIcon />
          {'Train Power Rankings Model'}
        </button>
      </div>

      <div id="tfjs-vis-container" />

      {loading && <ScaleLoader color="#36d7b7" />}

      {rankedTeams.length > 0 && (
        <table className="w-[800px]">
          <thead className="flex flex-row gap-10 ">
            <tr className="flex flex-row gap-10 items-center w-full rounded-t-lg border border-gray-700 bg-gray-800 py-3">
              <th>Rank</th>
              <th>Team</th>
              <th className="ml-auto">Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedTeams.map((team, index) => (
              <tr
                key={team.teamId}
                className={` ${
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                } ${
                  index === rankedTeams.length - 1 ? 'rounded-b-lg' : ''
                } flex flex-row gap-10 items-center  p-2.5 border border-gray-700`}
              >
                <td className="text-right">{index + 1}</td>
                <td className="flex flex-row items-center gap-5">
                  <Image
                    src={`/media/teamLogos/${team.teamName.toLowerCase()}.png`}
                    height={40}
                    width={40}
                  />
                  {team.teamName}
                </td>
                <td className="ml-auto">{team.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
export default PowerRankings;
