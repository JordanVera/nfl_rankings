export interface Team {
  TeamID: number;
  Name: string;
}

export interface GameStats {
  OffensiveYards: number;
  PassingYards: number;
  RushingYards: number;
  CompletionPercentage: number;
  FirstDowns: number;
  ThirdDownConversions: number;
  FourthDownConversions: number;
  RedZoneConversions: number;
  OpponentOffensiveYards: number;
  OpponentPassingYards: number;
  OpponentRushingYards: number;
  OpponentCompletionPercentage: number;
  OpponentFirstDowns: number;
  OpponentThirdDownConversions: number;
  OpponentFourthDownConversions: number;
  OpponentRedZoneConversions: number;
  KickReturnYards: number;
  PuntReturnYards: number;
  FieldGoalsMade: number;
  Punts: number;
  Giveaways: number;
  Takeaways: number;
  Penalties: number;
  PenaltyYards: number;
  TimeOfPossession: string;
  Score: number;
  OpponentScore: number;
}

export interface ProcessedFeature {
  offensiveYards: number;
  passingYards: number;
  rushingYards: number;
  completionPercentage: number;
  firstDowns: number;
  thirdDownConversions: number;
  fourthDownConversions: number;
  redZoneConversions: number;
  opponentOffensiveYards: number;
  opponentPassingYards: number;
  opponentRushingYards: number;
  opponentCompletionPercentage: number;
  opponentFirstDowns: number;
  opponentThirdDownConversions: number;
  opponentFourthDownConversions: number;
  opponentRedZoneConversions: number;
  kickReturnYards: number;
  puntReturnYards: number;
  fieldGoalsMade: number;
  punts: number;
  turnovers: number;
  takeaways: number;
  penalties: number;
  penaltyYards: number;
  timeOfPossession: number;
  score: number;
  opponentScore: number;
}

export interface RankedTeam {
  teamId: string;
  teamName: string;
  score: number;
  logoUrl: string;
  record?: string;
}

export interface EspnPowerRankings {
  source: string;
  lastUpdated: string | null;
  rankedTeams: RankedTeam[];
}

export interface EspnTeam {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logoUrl: string;
}

export interface EspnStat {
  name?: string;
  displayValue?: string;
  value?: number | string;
}

export interface EspnBoxscoreTeam {
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    name?: string;
  };
  statistics?: EspnStat[];
}

export interface EspnPlayerGroup {
  name?: string;
  keys?: string[];
  athletes?: Array<{
    stats?: string[];
  }>;
}

export interface EspnBoxscorePlayers {
  team?: { id?: string; abbreviation?: string };
  statistics?: EspnPlayerGroup[];
}

export interface EspnCompetitor {
  id?: string;
  homeAway?: string;
  score?: string | number;
  winner?: boolean;
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };
}

export interface EspnGameSummary {
  boxscore?: {
    teams?: EspnBoxscoreTeam[];
    players?: EspnBoxscorePlayers[];
  };
  header?: {
    season?: { year?: number; type?: number };
    competitions?: Array<{
      status?: { type?: { name?: string } };
      competitors?: EspnCompetitor[];
    }>;
  };
}

export interface EspnScoreboardEvent {
  id?: string;
  name?: string;
  season?: { year?: number; type?: number };
  week?: { number?: number };
  status?: { type?: { name?: string; completed?: boolean } };
}

export interface SeasonGameData {
  teams: EspnTeam[];
  gamesByTeam: GameStats[][];
}

export interface RankingsResponse {
  season: number;
  rankedTeams: RankedTeam[];
  espnRankings: EspnPowerRankings | null;
}
