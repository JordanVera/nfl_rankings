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
  League,
  RankedTeam,
  SeasonGameData,
} from '../types/nfl';

const REVALIDATE_SECONDS = 60 * 60 * 24;
const REGULAR_SEASON_TYPE = 2;
const SUMMARY_CONCURRENCY = 10;

const LEAGUE_CONFIG = {
  nfl: {
    siteBase: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
    fpi: 'https://site.web.api.espn.com/apis/fitt/v3/sports/football/nfl/powerindex',
    teamsLimit: 32,
    defaultWeeks: 18,
    groups: undefined as number | undefined,
    displayFullName: false,
  },
  cfb: {
    siteBase:
      'https://site.web.api.espn.com/apis/site/v2/sports/football/college-football',
    fpi: 'https://site.web.api.espn.com/apis/fitt/v3/sports/football/college-football/powerindex',
    teamsLimit: 200,
    defaultWeeks: 16,
    groups: 80,
    displayFullName: true,
  },
} as const;

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
          setTimeout(resolve, 400 * (attempt + 1))
        );
      }
    }
  }
  throw lastError;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
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
    }
  );

  await Promise.all(workers);
  return results;
}

const statLookup = (
  statistics: EspnStat[] | undefined
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
  displayValue: string | undefined
): number => {
  if (!displayValue || displayValue === '-') return 0;
  const [completed, attempts] = displayValue.split(/[-/]/).map(Number);
  if (!attempts) return 0;
  return (completed / attempts) * 100;
};

const parsePenalties = (
  displayValue: string | undefined
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
  key: string
): number => {
  const teamPlayers = players?.find((entry) => entry.team?.id === teamId);
  const group = teamPlayers?.statistics?.find(
    (group) => group.name === groupName
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
  lookup: Record<string, EspnStat>
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
      'fieldGoalsMade/fieldGoalAttempts'
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
  players: EspnBoxscorePlayers[] | undefined
): GameStats => {
  const ownId = own.team?.id ?? '';
  const ownStats = statLookup(own.statistics);
  const oppStats = statLookup(opponent.statistics);
  const ownSpecial = specialTeamsFor(players, ownId, ownStats);
  const ownPenalties = parsePenalties(
    ownStats.totalPenaltiesYards?.displayValue
  );

  return {
    OffensiveYards: parseNumeric(ownStats.totalYards),
    PassingYards: parseNumeric(ownStats.netPassingYards),
    RushingYards: parseNumeric(ownStats.rushingYards),
    CompletionPercentage: parseCompletionPercentage(
      ownStats.completionAttempts?.displayValue
    ),
    FirstDowns: parseNumeric(ownStats.firstDowns),
    ThirdDownConversions: parseMade(ownStats.thirdDownEff?.displayValue),
    FourthDownConversions: parseMade(ownStats.fourthDownEff?.displayValue),
    RedZoneConversions: parseMade(ownStats.redZoneAttempts?.displayValue),
    OpponentOffensiveYards: parseNumeric(oppStats.totalYards),
    OpponentPassingYards: parseNumeric(oppStats.netPassingYards),
    OpponentRushingYards: parseNumeric(oppStats.rushingYards),
    OpponentCompletionPercentage: parseCompletionPercentage(
      oppStats.completionAttempts?.displayValue
    ),
    OpponentFirstDowns: parseNumeric(oppStats.firstDowns),
    OpponentThirdDownConversions: parseMade(oppStats.thirdDownEff?.displayValue),
    OpponentFourthDownConversions: parseMade(
      oppStats.fourthDownEff?.displayValue
    ),
    OpponentRedZoneConversions: parseMade(oppStats.redZoneAttempts?.displayValue),
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
  summary: EspnGameSummary
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
    ])
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

const teamDisplayName = (
  league: League,
  team: {
    name?: string;
    displayName?: string;
  }
): string => {
  if (LEAGUE_CONFIG[league].displayFullName) {
    return team.displayName ?? team.name ?? 'Unknown';
  }
  return team.name ?? team.displayName ?? 'Unknown';
};

interface EspnFpiCategory {
  name?: string;
  names?: string[];
  values?: Array<number | null>;
}

interface EspnFpiTeam {
  team?: {
    id?: string;
    name?: string;
    displayName?: string;
    abbreviation?: string;
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
  index: number
): number => {
  if (index < 0) return 0;
  const value = teamCategory?.values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const mapFpiTeam = (league: League, entry: EspnFpiTeam): EspnTeam | null => {
  const team = entry.team;
  if (!team?.id) return null;
  return {
    id: team.id,
    name: teamDisplayName(league, team),
    displayName: team.displayName ?? team.name ?? 'Unknown',
    abbreviation: team.abbreviation ?? '',
    logoUrl: team.logos?.[0]?.href ?? '',
  };
};

export const fetchEspnFpiRankings = async (
  league: League,
  season: number
): Promise<EspnPowerRankings> => {
  const data = await espnFetchWithRetry<EspnFpiResponse>(
    `${LEAGUE_CONFIG[league].fpi}?season=${season}&limit=200`
  );

  const rankIndex = fpiIndex(data.categories, 'fpirank');
  const fpiScoreIndex = fpiIndex(data.categories, 'fpi');
  const winsIndex = fpiIndex(data.categories, 'numwins');
  const lossesIndex = fpiIndex(data.categories, 'numlosses');
  const tiesIndex = fpiIndex(data.categories, 'numties');

  const mapped = (data.teams ?? []).flatMap((entry) => {
    const team = mapFpiTeam(league, entry);
    if (!team) return [];
    const fpiCategory = entry.categories?.find((cat) => cat.name === 'fpi');
    const wins = fpiValue(fpiCategory, winsIndex);
    const losses = fpiValue(fpiCategory, lossesIndex);
    const ties = fpiValue(fpiCategory, tiesIndex);

    return [
      {
        teamId: team.id,
        teamName: team.name,
        logoUrl: team.logoUrl,
        score: fpiValue(fpiCategory, fpiScoreIndex),
        record: ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
        rank:
          fpiValue(fpiCategory, rankIndex) ||
          Number.POSITIVE_INFINITY,
      },
    ];
  });

  const rankedTeams: RankedTeam[] = mapped
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map(({ rank: _rank, ...team }) => team);

  if (rankedTeams.length === 0) {
    throw new Error(`No ESPN FPI rankings found for ${league} ${season}.`);
  }

  return {
    source: 'ESPN FPI',
    lastUpdated: data.lastUpdated ?? null,
    rankedTeams,
  };
};

export const fetchLeagueTeams = async (
  league: League,
  season: number
): Promise<EspnTeam[]> => {
  if (league === 'cfb') {
    const data = await espnFetchWithRetry<EspnFpiResponse>(
      `${LEAGUE_CONFIG.cfb.fpi}?season=${season}&limit=200`
    );
    const teams =
      data.teams
        ?.map((entry) => mapFpiTeam(league, entry))
        .filter((team): team is EspnTeam => team !== null) ?? [];
    return teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

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
  }>(`${LEAGUE_CONFIG.nfl.siteBase}/teams?limit=32`);

  const teams =
    data.sports?.[0]?.leagues?.[0]?.teams
      ?.map((entry) => {
        const team = entry.team;
        if (!team?.id) return null;
        return {
          id: team.id,
          name: teamDisplayName(league, team),
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
  season: number
): event is EspnScoreboardEvent & { id: string } =>
  Boolean(event.id) &&
  (event.season?.year === season || event.season?.year === undefined) &&
  (event.season?.type === REGULAR_SEASON_TYPE ||
    event.season?.type === undefined) &&
  (event.status?.type?.completed === true ||
    event.status?.type?.name === 'STATUS_FINAL');

const scoreboardUrl = (league: League, season: number, week: number) => {
  const config = LEAGUE_CONFIG[league];
  const params = new URLSearchParams({
    dates: String(season),
    seasontype: String(REGULAR_SEASON_TYPE),
    week: String(week),
  });
  if (config.groups) {
    params.set('groups', String(config.groups));
  }
  return `${config.siteBase}/scoreboard?${params.toString()}`;
};

const fetchRegularSeasonWeekNumbers = async (
  league: League,
  season: number
): Promise<number[]> => {
  const data = await espnFetchWithRetry<{
    leagues?: Array<{
      calendar?: Array<{
        value?: string;
        entries?: Array<{ value?: string }>;
      }>;
    }>;
  }>(scoreboardUrl(league, season, 1));

  const regularSeason = data.leagues?.[0]?.calendar?.find(
    (entry) => entry.value === String(REGULAR_SEASON_TYPE)
  );
  const weeks = (regularSeason?.entries ?? [])
    .map((entry) => Number(entry.value))
    .filter((week) => Number.isInteger(week) && week > 0);

  if (weeks.length > 0) {
    return [...new Set(weeks)].sort((a, b) => a - b);
  }

  return Array.from(
    { length: LEAGUE_CONFIG[league].defaultWeeks },
    (_, index) => index + 1
  );
};

export const fetchSeasonEventIds = async (
  league: League,
  season: number
): Promise<string[]> => {
  const weeks = await fetchRegularSeasonWeekNumbers(league, season);
  const weekResults = await Promise.all(
    weeks.map((week) =>
      espnFetchWithRetry<{
        events?: EspnScoreboardEvent[];
        season?: { year?: number; type?: number };
      }>(scoreboardUrl(league, season, week))
    )
  );

  const ids = new Set<string>();
  for (const week of weekResults) {
    const seasonYear = week.season?.year;
    for (const event of week.events ?? []) {
      const year = event.season?.year ?? seasonYear;
      if (year !== season) continue;
      if (isCompletedRegularSeasonGame(event, season)) {
        ids.add(event.id);
      }
    }
  }

  return [...ids];
};

export const fetchSeasonGameData = async (
  league: League,
  season: number,
  teams?: EspnTeam[]
): Promise<SeasonGameData> => {
  const [resolvedTeams, eventIds] = await Promise.all([
    teams ? Promise.resolve(teams) : fetchLeagueTeams(league, season),
    fetchSeasonEventIds(league, season),
  ]);

  if (eventIds.length === 0) {
    throw new Error(
      `No completed regular-season games found for ${league} ${season}.`
    );
  }

  const teamIds = new Set(resolvedTeams.map((team) => team.id));
  const gamesByTeamId = new Map<string, GameStats[]>(
    resolvedTeams.map((team) => [team.id, []])
  );

  const summaries = await mapPool(eventIds, SUMMARY_CONCURRENCY, (eventId) =>
    espnFetchWithRetry<EspnGameSummary>(
      `${LEAGUE_CONFIG[league].siteBase}/summary?event=${eventId}`
    )
  );

  for (const summary of summaries) {
    for (const { teamId, stats } of mapSummaryToTeamGames(summary)) {
      if (!teamIds.has(teamId)) continue;
      gamesByTeamId.get(teamId)?.push(stats);
    }
  }

  return {
    teams: resolvedTeams,
    gamesByTeam: resolvedTeams.map((team) => gamesByTeamId.get(team.id) ?? []),
  };
};

const teamIdFromRef = (ref: string | undefined): string | null => {
  if (!ref) return null;
  const match = ref.match(/\/teams\/(\d+)/);
  return match?.[1] ?? null;
};

interface EspnCoreRanking {
  name?: string;
  lastUpdated?: string;
  ranks?: Array<{
    current?: number;
    points?: number;
    record?: { summary?: string };
    team?: { $ref?: string; id?: string };
  }>;
}

const ncaaLogo = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;

export const fetchEspnApRankings = async (
  season: number,
  teams: EspnTeam[]
): Promise<EspnPowerRankings> => {
  const weeks = await fetchRegularSeasonWeekNumbers('cfb', season);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  let lastError: unknown;

  for (const week of [...weeks].reverse()) {
    try {
      const data = await espnFetchWithRetry<EspnCoreRanking>(
        `https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/${season}/types/${REGULAR_SEASON_TYPE}/weeks/${week}/rankings/1`
      );
      const rankedTeams: RankedTeam[] = (data.ranks ?? []).flatMap((rank) => {
        const teamId = rank.team?.id ?? teamIdFromRef(rank.team?.$ref) ?? '';
        if (!teamId) return [];
        const team = teamById.get(teamId);
        return [
          {
            teamId,
            teamName: team?.name ?? team?.displayName ?? `Team ${teamId}`,
            logoUrl: team?.logoUrl || ncaaLogo(teamId),
            score: typeof rank.points === 'number' ? rank.points : 0,
            record: rank.record?.summary,
          },
        ];
      });

      if (rankedTeams.length > 0) {
        return {
          source: data.name ?? 'AP Top 25',
          lastUpdated: data.lastUpdated ?? null,
          rankedTeams,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No AP Top 25 rankings found for ${season}.`);
};

export const fetchOfficialEspnRankings = async (
  league: League,
  season: number,
  teams: EspnTeam[]
): Promise<EspnPowerRankings> => {
  if (league === 'cfb') {
    return fetchEspnApRankings(season, teams);
  }
  return fetchEspnFpiRankings(league, season);
};
