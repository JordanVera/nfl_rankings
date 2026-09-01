import colors from 'colors';
import { computeSeasonRankings } from '../lib/powerRankings';
import { isLeague, type League } from '../types/nfl';

const season = Number(process.argv[2] ?? 2025);
const league: League = isLeague(process.argv[3] ?? 'nfl')
  ? (process.argv[3] as League)
  : 'nfl';

const main = async () => {
  try {
    const { rankedTeams, espnRankings } = await computeSeasonRankings(
      season,
      league
    );

    console.log(`Our model (${league} ${season})`.green.bold);
    rankedTeams.forEach((team, index) => {
      console.log(
        `${index + 1}. ${team.teamName} - Score: ${team.score.toFixed(2)}`
      );
    });

    if (espnRankings) {
      console.log(`\n${espnRankings.source}`.green.bold);
      espnRankings.rankedTeams.forEach((team, index) => {
        console.log(
          `${index + 1}. ${team.teamName} - ${team.score.toFixed(2)}`
        );
      });
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
};

main();
