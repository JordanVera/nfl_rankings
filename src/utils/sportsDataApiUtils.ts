import type { GameStats, Team } from '@/types/nfl';

export const fetchAllTeamsAndReturnTeamIds = async (): Promise<number[]> => {
  const response = await fetch(
    `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`,
    { method: 'GET' }
  );

  const json: Team[] = await response.json();
  const teamIds = json.map((team) => team.TeamID);

  console.log(teamIds);

  return teamIds;
};

export const fetchSeasonGameData = async (
  season: number,
  teamIds: number[]
): Promise<GameStats[][]> => {
  const resultsForEachTeamBySeason = await Promise.all(
    teamIds.map(async (teamId) => {
      const response = await fetch(
        `https://api.sportsdata.io/v3/nfl/scores/json/TeamGameStatsBySeason/${season}/${teamId}/all?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`,
        { method: 'GET' }
      );

      return response.json() as Promise<GameStats[]>;
    })
  );

  console.log({ resultsForEachTeamBySeason });
  console.log(
    'length of resultsForEachTeamBySeason: ',
    resultsForEachTeamBySeason.length
  );

  return resultsForEachTeamBySeason;
};
