import { computeSeasonRankings } from '../lib/powerRankings';

const season = Number(process.argv[2] ?? 2025);

const main = async () => {
  const { rankedTeams, espnRankings } = await computeSeasonRankings(
    season,
    'cfb',
  );

  console.log('model rankedTeams length:', rankedTeams.length);
  rankedTeams.forEach((t, i) => {
    console.log(`${i + 1}. ${t.teamName} ${t.score}`);
  });

  const apIds = new Set(espnRankings?.rankedTeams.map((t) => t.teamId) ?? []);
  const overlap = rankedTeams.filter((t) => apIds.has(t.teamId));
  console.log('overlap with AP top 25:', overlap.length);
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
