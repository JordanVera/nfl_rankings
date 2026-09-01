import { computeSeasonRankings } from '../lib/powerRankings';
import { fetchSeasonEvents } from '../utils/espnApi';
import type { League } from '../types/nfl';

const run = async (league: League, season: number) => {
  const events = await fetchSeasonEvents(league, season);
  const started = Date.now();
  const { rankedTeams, espnRankings, priorSeason } =
    await computeSeasonRankings(season, league);
  const apIds = new Set(espnRankings?.rankedTeams.map((t) => t.teamId) ?? []);
  const top25 = rankedTeams.slice(0, 25);

  console.log(
    [
      `${league} ${season}`.padEnd(10),
      `completed=${String(events.completedIds.length).padEnd(4)}`,
      `remaining=${String(events.remainingGames).padEnd(4)}`,
      `prior=${String(priorSeason).padEnd(5)}`,
      `ranked=${String(rankedTeams.length).padEnd(4)}`,
      `overlap=${top25.filter((t) => apIds.has(t.teamId)).length}/${top25.length}`,
      `(${espnRankings?.source})`,
      `${((Date.now() - started) / 1000).toFixed(0)}s`,
    ].join(' '),
  );
  console.log(
    '   top 5:',
    top25
      .slice(0, 5)
      .map((t) => t.teamName)
      .join(', '),
  );
};

const main = async () => {
  for (const [league, season] of [
    ['cfb', 2023],
    ['cfb', 2024],
    ['cfb', 2025],
    ['cfb', 2026],
    ['nfl', 2025],
    ['nfl', 2026],
  ] as Array<[League, number]>) {
    await run(league, season).catch((e) =>
      console.error(`${league} ${season} FAILED:`, e),
    );
  }
};

main();
