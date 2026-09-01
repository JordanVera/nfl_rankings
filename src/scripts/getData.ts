import { fetchSeasonGameData } from '../utils/espnApi';

const season = Number(process.argv[2] ?? 2025);

try {
  const { teams, gamesByTeam } = await fetchSeasonGameData(season);

  console.log(
    `Fetched ${teams.length} teams and ${gamesByTeam.flat().length} team-games for ${season}`
  );

  teams.forEach((team, index) => {
    console.log(`${team.displayName}: ${gamesByTeam[index].length} games`);
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
