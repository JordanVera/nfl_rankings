import 'dotenv/config';

export const fetchAllTeamsAndReturnTeamIds = async () => {
  const response = await fetch(
    `https://api.sportsdata.io/v3/nfl/scores/json/Teams?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`,
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
        `https://api.sportsdata.io/v3/nfl/scores/json/TeamGameStatsBySeason/${season}/${teamId}/all?key=${process.env.NEXT_PUBLIC_SPORTSDATAIO_API_KEY}`,
        {
          method: 'GET',
        }
      );

      return response.json();
    })
  );

  console.log({ resultsForEachTeamBySeason });
  console.log(
    'length of resultsForEachTeamBySeason: ',
    resultsForEachTeamBySeason.length
  );

  return resultsForEachTeamBySeason;
};
