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
}
