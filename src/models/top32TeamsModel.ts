import colors from 'colors';
import { computeSeasonRankings } from '../lib/powerRankings';

const season = Number(process.argv[2] ?? 2025);

const main = async () => {
  try {
    const { rankedTeams, espnRankings } = await computeSeasonRankings(season);

    console.log('Our model'.green.bold);
    rankedTeams.forEach((team, index) => {
      console.log(
        `${index + 1}. ${team.teamName} - Score: ${team.score.toFixed(2)}`,
      );
    });

    if (espnRankings) {
      console.log(`\n${espnRankings.source}`.green.bold);
      espnRankings.rankedTeams.forEach((team, index) => {
        console.log(
          `${index + 1}. ${team.teamName} - FPI: ${team.score.toFixed(2)}`,
        );
      });
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
};

main();
