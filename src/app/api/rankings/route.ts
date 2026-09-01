import { unstable_cache } from 'next/cache';
import { computeSeasonRankings } from '@/lib/powerRankings';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MIN_SEASON = 2023;
const MAX_SEASON = 2026;
const DEFAULT_SEASON = 2025;

const getCachedSeasonRankings = unstable_cache(
  async (season: number) => computeSeasonRankings(season),
  ['nfl-power-rankings-v2'],
  { revalidate: 60 * 60 * 24 },
);

const parseSeason = (value: string | null): number => {
  const season = Number(value ?? DEFAULT_SEASON);
  if (!Number.isInteger(season) || season < MIN_SEASON || season > MAX_SEASON) {
    throw new Error(
      `Season must be an integer between ${MIN_SEASON} and ${MAX_SEASON}.`,
    );
  }
  return season;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseSeason(searchParams.get('season'));
    const rankings = await getCachedSeasonRankings(season);
    return Response.json(rankings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate rankings.';
    const status = message.startsWith('Season must') ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
