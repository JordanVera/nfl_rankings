import { fetchSeasonGameData } from '../utils/espnApi';
import { isLeague, type League } from '../types/nfl';

const season = Number(process.argv[2] ?? 2025);
const league: League = isLeague(process.argv[3] ?? 'nfl')
  ? (process.argv[3] as League)
  : 'nfl';

try {
  const { teams, gamesByTeam } = await fetchSeasonGameData(league, season);

  console.log(
    `Fetched ${teams.length} teams and ${gamesByTeam.flat().length} team-games for ${league} ${season}`
  );

  teams.forEach((team, index) => {
    console.log(`${team.displayName}: ${gamesByTeam[index].length} games`);
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
