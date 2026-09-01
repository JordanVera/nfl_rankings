import type {
  EspnBoxscorePlayers,
  EspnBoxscoreTeam,
  EspnCompetitor,
  EspnGameSummary,
  EspnPowerRankings,
  EspnScoreboardEvent,
  EspnStat,
  EspnTeam,
  GameStats,
  RankedTeam,
  SeasonGameData,
} from '../types/nfl';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_FPI =
  'https://site.web.api.espn.com/apis/fitt/v3/sports/football/nfl/powerindex';
const REGULAR_SEASON_TYPE = 2;
const REGULAR_SEASON_WEEKS = 18;
const SUMMARY_CONCURRENCY = 8;
const REVALIDATE_SECONDS = 60 * 60 * 24;

const espnFetchInit = {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'nfl-rankings/0.1 (educational)',
  },
  next: { revalidate: REVALIDATE_SECONDS },
};

async function espnFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, espnFetchInit);
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status}) for ${url}`);
  }
  return response.json() as Promise<T>;
}

async function espnFetchWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await espnFetch<T>(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * (attempt + 1)),
        );
      }
    }
  }
  throw lastError;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await fn(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

const statLookup = (
  statistics: EspnStat[] | undefined,
): Record<string, EspnStat> => {
  const lookup: Record<string, EspnStat> = {};
  for (const stat of statistics ?? []) {
    if (stat.name) {
      lookup[stat.name] = stat;
    }
  }
  return lookup;
};

const parseNumeric = (stat: EspnStat | undefined): number => {
  if (!stat) return 0;
  if (typeof stat.value === 'number' && Number.isFinite(stat.value)) {
    return stat.value;
  }
  const fromDisplay = Number.parseFloat(stat.displayValue ?? '');
  return Number.isFinite(fromDisplay) ? fromDisplay : 0;
};

const parseMade = (displayValue: string | undefined): number => {
  if (!displayValue || displayValue === '-') return 0;
  const made = Number.parseFloat(displayValue.split(/[-/]/)[0]);
  return Number.isFinite(made) ? made : 0;
};

const parseCompletionPercentage = (
  displayValue: string | undefined,
): number => {
  if (!displayValue || displayValue === '-') return 0;
  const [completed, attempts] = displayValue.split(/[-/]/).map(Number);
  if (!attempts) return 0;
  return (completed / attempts) * 100;
};

const parsePenalties = (
  displayValue: string | undefined,
): { count: number; yards: number } => {
  if (!displayValue || displayValue === '-') {
    return { count: 0, yards: 0 };
  }
  const [count, yards] = displayValue.split(/[-/]/).map(Number);
  return {
    count: Number.isFinite(count) ? count : 0,
    yards: Number.isFinite(yards) ? yards : 0,
  };
};

const possessionDisplay = (stat: EspnStat | undefined): string => {
  if (stat?.displayValue && stat.displayValue.includes(':')) {
    return stat.displayValue;
  }
  if (typeof stat?.value === 'number') {
    const minutes = Math.floor(stat.value / 60);
    const seconds = Math.round(stat.value % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  return '0:00';
};

const competitorScore = (competitor: EspnCompetitor | undefined): number => {
  const score = Number(competitor?.score ?? 0);
  return Number.isFinite(score) ? score : 0;
};

const sumPlayerStat = (
  players: EspnBoxscorePlayers[] | undefined,
  teamId: string,
  groupName: string,
  key: string,
): number => {
  const teamPlayers = players?.find((entry) => entry.team?.id === teamId);
  const group = teamPlayers?.statistics?.find(
    (group) => group.name === groupName,
  );
  if (!group?.keys || !group.athletes) return 0;

  const index = group.keys.indexOf(key);
  if (index < 0) return 0;

  return group.athletes.reduce((sum, athlete) => {
    const raw = athlete.stats?.[index] ?? '0';
    if (raw.includes('/')) {
      return sum + (Number.parseFloat(raw.split('/')[0]) || 0);
    }
    const value = Number.parseFloat(raw);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
};

const specialTeamsFor = (
  players: EspnBoxscorePlayers[] | undefined,
  teamId: string,
  lookup: Record<string, EspnStat>,
) => ({
  kickReturnYards:
    parseNumeric(lookup.kickReturnYards) ||
    sumPlayerStat(players, teamId, 'kickReturns', 'kickReturnYards'),
  puntReturnYards:
    parseNumeric(lookup.puntReturnYards) ||
    sumPlayerStat(players, teamId, 'puntReturns', 'puntReturnYards'),
  fieldGoalsMade:
    parseMade(lookup.fieldGoalsMade?.displayValue) ||
    sumPlayerStat(
      players,
      teamId,
      'kicking',
      'fieldGoalsMade/fieldGoalAttempts',
    ),
  punts:
    parseNumeric(lookup.punts) ||
    sumPlayerStat(players, teamId, 'punting', 'punts'),
});

const boxscoreSide = (
  own: EspnBoxscoreTeam,
  opponent: EspnBoxscoreTeam,
  ownScore: number,
  opponentScore: number,
  players: EspnBoxscorePlayers[] | undefined,
): GameStats => {
  const ownId = own.team?.id ?? '';
  const ownStats = statLookup(own.statistics);
  const oppStats = statLookup(opponent.statistics);
  const ownSpecial = specialTeamsFor(players, ownId, ownStats);
  const ownPenalties = parsePenalties(
    ownStats.totalPenaltiesYards?.displayValue,
  );

  return {
    OffensiveYards: parseNumeric(ownStats.totalYards),
    PassingYards: parseNumeric(ownStats.netPassingYards),
    RushingYards: parseNumeric(ownStats.rushingYards),
    CompletionPercentage: parseCompletionPercentage(
      ownStats.completionAttempts?.displayValue,
    ),
    FirstDowns: parseNumeric(ownStats.firstDowns),
    ThirdDownConversions: parseMade(ownStats.thirdDownEff?.displayValue),
    FourthDownConversions: parseMade(ownStats.fourthDownEff?.displayValue),
    RedZoneConversions: parseMade(ownStats.redZoneAttempts?.displayValue),
    OpponentOffensiveYards: parseNumeric(oppStats.totalYards),
    OpponentPassingYards: parseNumeric(oppStats.netPassingYards),
    OpponentRushingYards: parseNumeric(oppStats.rushingYards),
    OpponentCompletionPercentage: parseCompletionPercentage(
      oppStats.completionAttempts?.displayValue,
    ),
    OpponentFirstDowns: parseNumeric(oppStats.firstDowns),
    OpponentThirdDownConversions: parseMade(
      oppStats.thirdDownEff?.displayValue,
    ),
    OpponentFourthDownConversions: parseMade(
      oppStats.fourthDownEff?.displayValue,
    ),
    OpponentRedZoneConversions: parseMade(
      oppStats.redZoneAttempts?.displayValue,
    ),
    KickReturnYards: ownSpecial.kickReturnYards,
    PuntReturnYards: ownSpecial.puntReturnYards,
    FieldGoalsMade: ownSpecial.fieldGoalsMade,
    Punts: ownSpecial.punts,
    Giveaways: parseNumeric(ownStats.turnovers),
    Takeaways: parseNumeric(oppStats.turnovers),
    Penalties: ownPenalties.count,
    PenaltyYards: ownPenalties.yards,
    TimeOfPossession: possessionDisplay(ownStats.possessionTime),
    Score: ownScore,
    OpponentScore: opponentScore,
  };
};

const mapSummaryToTeamGames = (
  summary: EspnGameSummary,
): Array<{ teamId: string; stats: GameStats }> => {
  const competition = summary.header?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const boxTeams = summary.boxscore?.teams ?? [];

  if (boxTeams.length < 2 || competitors.length < 2) {
    return [];
  }

  const scoreByTeamId = new Map(
    competitors.map((competitor) => [
      competitor.id ?? competitor.team?.id ?? '',
      competitorScore(competitor),
    ]),
  );

  const [teamA, teamB] = boxTeams;
  const teamAId = teamA.team?.id ?? '';
  const teamBId = teamB.team?.id ?? '';
  const scoreA = scoreByTeamId.get(teamAId) ?? 0;
  const scoreB = scoreByTeamId.get(teamBId) ?? 0;
  const players = summary.boxscore?.players;

  return [
    {
      teamId: teamAId,
      stats: boxscoreSide(teamA, teamB, scoreA, scoreB, players),
    },
    {
      teamId: teamBId,
      stats: boxscoreSide(teamB, teamA, scoreB, scoreA, players),
    },
  ];
};

export const fetchAllNflTeams = async (): Promise<EspnTeam[]> => {
  const data = await espnFetch<{
    sports?: Array<{
      leagues?: Array<{
        teams?: Array<{
          team?: {
            id?: string;
            name?: string;
            displayName?: string;
            abbreviation?: string;
            logos?: Array<{ href?: string }>;
          };
        }>;
      }>;
    }>;
  }>(`${ESPN_SITE}/teams?limit=32`);

  const teams =
    data.sports?.[0]?.leagues?.[0]?.teams
      ?.map((entry) => {
        const team = entry.team;
        if (!team?.id) return null;
        return {
          id: team.id,
          name: team.name ?? team.displayName ?? 'Unknown',
          displayName: team.displayName ?? team.name ?? 'Unknown',
          abbreviation: team.abbreviation ?? '',
          logoUrl: team.logos?.[0]?.href ?? '',
        } satisfies EspnTeam;
      })
      .filter((team): team is EspnTeam => team !== null) ?? [];

  return teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
};

const isCompletedRegularSeasonGame = (
  event: EspnScoreboardEvent,
  season: number,
): event is EspnScoreboardEvent & { id: string } =>
  Boolean(event.id) &&
  event.season?.year === season &&
  event.season?.type === REGULAR_SEASON_TYPE &&
  (event.status?.type?.completed === true ||
    event.status?.type?.name === 'STATUS_FINAL');

export const fetchSeasonEventIds = async (
  season: number,
): Promise<string[]> => {
  const weekResults = await Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, index) =>
      espnFetchWithRetry<{ events?: EspnScoreboardEvent[] }>(
        `${ESPN_SITE}/scoreboard?dates=${season}&seasontype=${REGULAR_SEASON_TYPE}&week=${index + 1}`,
      ),
    ),
  );

  const ids = new Set<string>();
  for (const week of weekResults) {
    for (const event of week.events ?? []) {
      if (isCompletedRegularSeasonGame(event, season)) {
        ids.add(event.id);
      }
    }
  }

  return [...ids];
};

export const fetchSeasonGameData = async (
  season: number,
): Promise<SeasonGameData> => {
  const [teams, eventIds] = await Promise.all([
    fetchAllNflTeams(),
    fetchSeasonEventIds(season),
  ]);

  if (eventIds.length === 0) {
    throw new Error(`No completed regular-season games found for ${season}.`);
  }

  const gamesByTeamId = new Map<string, GameStats[]>(
    teams.map((team) => [team.id, []]),
  );

  const summaries = await mapPool(eventIds, SUMMARY_CONCURRENCY, (eventId) =>
    espnFetchWithRetry<EspnGameSummary>(
      `${ESPN_SITE}/summary?event=${eventId}`,
    ),
  );

  for (const summary of summaries) {
    for (const { teamId, stats } of mapSummaryToTeamGames(summary)) {
      const games = gamesByTeamId.get(teamId);
      if (games) {
        games.push(stats);
      }
    }
  }

  return {
    teams,
    gamesByTeam: teams.map((team) => gamesByTeamId.get(team.id) ?? []),
  };
};

interface EspnFpiCategory {
  name?: string;
  names?: string[];
  totals?: Array<string | null>;
  values?: Array<number | null>;
}

interface EspnFpiTeam {
  team?: {
    id?: string;
    name?: string;
    displayName?: string;
    logos?: Array<{ href?: string }>;
  };
  categories?: EspnFpiCategory[];
}

interface EspnFpiResponse {
  lastUpdated?: string;
  categories?: EspnFpiCategory[];
  teams?: EspnFpiTeam[];
}

const fpiIndex = (categories: EspnFpiCategory[] | undefined, name: string) =>
  categories?.[0]?.names?.indexOf(name) ?? -1;

const fpiValue = (
  teamCategory: EspnFpiCategory | undefined,
  index: number,
): number => {
  if (index < 0) return 0;
  const value = teamCategory?.values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const fetchEspnFpiRankings = async (
  season: number,
): Promise<EspnPowerRankings> => {
  const data = await espnFetchWithRetry<EspnFpiResponse>(
    `${ESPN_FPI}?season=${season}&limit=32`,
  );

  const rankIndex = fpiIndex(data.categories, 'fpirank');
  const fpiScoreIndex = fpiIndex(data.categories, 'fpi');
  const winsIndex = fpiIndex(data.categories, 'numwins');
  const lossesIndex = fpiIndex(data.categories, 'numlosses');
  const tiesIndex = fpiIndex(data.categories, 'numties');

  const mapped = (data.teams ?? []).flatMap((entry) => {
    const team = entry.team;
    const fpiCategory = entry.categories?.find((cat) => cat.name === 'fpi');
    if (!team?.id) return [];

    const wins = fpiValue(fpiCategory, winsIndex);
    const losses = fpiValue(fpiCategory, lossesIndex);
    const ties = fpiValue(fpiCategory, tiesIndex);

    return [
      {
        teamId: team.id,
        teamName: team.name ?? team.displayName ?? 'Unknown',
        logoUrl: team.logos?.[0]?.href ?? '',
        score: fpiValue(fpiCategory, fpiScoreIndex),
        record: ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
        rank: fpiValue(fpiCategory, rankIndex) || Number.POSITIVE_INFINITY,
      },
    ];
  });

  const rankedTeams: RankedTeam[] = mapped
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map(({ rank: _rank, ...team }) => team);

  if (rankedTeams.length === 0) {
    throw new Error(`No ESPN FPI rankings found for ${season}.`);
  }

  return {
    source: 'ESPN FPI',
    lastUpdated: data.lastUpdated ?? null,
    rankedTeams,
  };
};
