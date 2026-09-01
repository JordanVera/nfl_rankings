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
    data.reduce((a, b) => a + (b - dataMean) ** 2, 0) / data.length,
  );
};

const normalizeFeatures = (
  features: ProcessedFeature[],
): ProcessedFeature[] => {
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
];

const FEATURE_COUNT = 25;

const preprocessData = (data: GameStats[][]) => {
  const features: ProcessedFeature[][] = data.map((teamGames) =>
    teamGames.map(toProcessedFeature),
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

// Games a team must play before its current-season rating outweighs the
// prior-season carryover. Weight on the current season is n / (n + this).
const PRIOR_SHRINKAGE_GAMES = 4;
// ESPN box scores get unreliable further back than this.
const EARLIEST_PRIOR_SEASON = 2022;

const createModel = () => {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [FEATURE_COUNT],
      units: 128,
      activation: 'relu',
    }),
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
    Math.max(0, Math.floor(p * (sorted.length - 1))),
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
  predictionValues: number[][],
): Record<string, number> => {
  const teamScores: Record<string, number> = {};
  let offset = 0;

  teams.forEach((team, index) => {
    const teamGames = gamesByTeam[index];
    const teamPredictionScores = predictionValues.slice(
      offset,
      offset + teamGames.length,
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
  predictionValues: number[][],
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
      teamGames.map((game) => game.opponentTeamId),
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
  teamScores: Record<string, number>,
  gamesPlayed: Record<string, number> = {},
): RankedTeam[] =>
  Object.entries(teamScores)
    .map(([teamId, score]) => {
      const team = teams.find((entry) => entry.id === teamId);
      return {
        teamId,
        teamName: team?.name ?? teamId,
        logoUrl: team?.logoUrl ?? '',
        score,
        gamesPlayed: gamesPlayed[teamId] ?? 0,
      };
    })
    .sort((a, b) => b.score - a.score);

// Ratings from two seasons come from independently trained models, so they are
// only comparable once each season is put on a zero-mean, unit-variance scale.
const standardize = (
  ratings: Record<string, number>,
): Record<string, number> => {
  const values = Object.values(ratings);
  if (values.length === 0) return {};

  const center = mean(values);
  const spread = std(values) || 1;

  return Object.fromEntries(
    Object.entries(ratings).map(([teamId, value]) => [
      teamId,
      (value - center) / spread,
    ]),
  );
};

const blendWithPrior = (
  teams: EspnTeam[],
  current: Record<string, number>,
  gamesPlayed: Record<string, number>,
  prior: Record<string, number>,
): Record<string, number> => {
  const blended: Record<string, number> = {};

  for (const team of teams) {
    // Programs with no prior-season rating (new to the division) start at the
    // league average rather than being excluded outright.
    const priorRating = prior[team.id] ?? 0;
    const currentRating = current[team.id];
    const played = gamesPlayed[team.id] ?? 0;

    if (currentRating === undefined || played === 0) {
      blended[team.id] = priorRating;
      continue;
    }

    const weight = played / (played + PRIOR_SHRINKAGE_GAMES);
    blended[team.id] = weight * currentRating + (1 - weight) * priorRating;
  }

  return blended;
};

const trainAndRateTeams = async (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][],
  options: { strengthOfSchedule?: boolean } = {},
): Promise<Record<string, number>> => {
  const teamsWithGames = teams.filter(
    (_, index) => gamesByTeam[index].length > 0,
  );
  const games = gamesByTeam.filter((teamGames) => teamGames.length > 0);

  if (teamsWithGames.length === 0 || games.flat().length === 0) {
    return {};
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

    return options.strengthOfSchedule
      ? applySimpleRatingSystem(teamsWithGames, games, predictionValues)
      : meanPredictedMargins(teamsWithGames, games, predictionValues);
  } finally {
    inputTensor.dispose();
    outputTensor.dispose();
    model.dispose();
    tf.engine().endScope();
  }
};

export const trainAndRankTeams = async (
  teams: EspnTeam[],
  gamesByTeam: GameStats[][],
  options: { strengthOfSchedule?: boolean } = {},
): Promise<RankedTeam[]> => {
  const teamScores = await trainAndRateTeams(teams, gamesByTeam, options);

  if (Object.keys(teamScores).length === 0) {
    throw new Error('No team game stats available to train the ranking model.');
  }

  return rankedTeamsFromScores(teams, teamScores);
};

interface SeasonRatings {
  /** Standardized ratings keyed by team id, covering teams that have played. */
  ratings: Record<string, number>;
  gamesPlayed: Record<string, number>;
  remainingGames: number;
}

const rateSeason = async (
  league: League,
  season: number,
  knownTeams?: EspnTeam[],
): Promise<SeasonRatings> => {
  const teams = knownTeams ?? (await fetchLeagueTeams(league, season));
  const { gamesByTeam, remainingGames } = await fetchSeasonGameData(
    league,
    season,
    teams,
  );
  const ratings = await trainAndRateTeams(teams, gamesByTeam, {
    strengthOfSchedule: league === 'cfb',
  });

  return {
    ratings: standardize(ratings),
    gamesPlayed: Object.fromEntries(
      teams.map((team, index) => [team.id, gamesByTeam[index].length]),
    ),
    remainingGames,
  };
};

export const computeSeasonRankings = async (
  season: number,
  league: League = 'nfl',
): Promise<RankingsResponse> => {
  const teams = await fetchLeagueTeams(league, season);
  const espnRankingsPromise = fetchOfficialEspnRankings(
    league,
    season,
    teams,
  ).catch((error: unknown) => {
    console.error('Failed to load ESPN rankings', error);
    return null;
  });

  const current = await rateSeason(league, season, teams);

  // Mid-season every team is short on evidence, and teams that have not kicked
  // off yet have none at all. Carry the previous season in as a prior and let
  // it decay as real results accumulate.
  let teamScores = current.ratings;
  let priorSeason: number | null = null;

  if (current.remainingGames > 0 && season - 1 >= EARLIEST_PRIOR_SEASON) {
    const prior = await rateSeason(league, season - 1).catch(
      (error: unknown) => {
        console.error(`Failed to load ${season - 1} prior ratings`, error);
        return null;
      },
    );

    if (prior && Object.keys(prior.ratings).length > 0) {
      teamScores = blendWithPrior(
        teams,
        current.ratings,
        current.gamesPlayed,
        prior.ratings,
      );
      priorSeason = season - 1;
    }
  }

  if (Object.keys(teamScores).length === 0) {
    throw new Error(
      `No completed regular-season games found for ${league} ${season}.`,
    );
  }

  const espnRankings = await espnRankingsPromise;
  const rankedTeams = rankedTeamsFromScores(
    teams,
    teamScores,
    current.gamesPlayed,
  );

  return {
    season,
    league,
    rankedTeams:
      league === 'cfb' ? rankedTeams.slice(0, CFB_TOP_COUNT) : rankedTeams,
    espnRankings,
    priorSeason,
  };
};
