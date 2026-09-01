import { unstable_cache } from 'next/cache';
import { computeSeasonRankings } from '@/lib/powerRankings';
import { isLeague, type League } from '@/types/nfl';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MIN_SEASON = 2000;
const MAX_SEASON = 2026;
const DEFAULT_SEASON = 2025;
const DEFAULT_LEAGUE: League = 'nfl';

const getCachedSeasonRankings = unstable_cache(
  async (season: number, league: League) =>
    computeSeasonRankings(season, league),
  ['power-rankings-v6'],
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

const parseLeague = (value: string | null): League => {
  if (!value) return DEFAULT_LEAGUE;
  if (!isLeague(value)) {
    throw new Error('League must be nfl or cfb.');
  }
  return value;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseSeason(searchParams.get('season'));
    const league = parseLeague(searchParams.get('league'));
    const rankings = await getCachedSeasonRankings(season, league);
    return Response.json(rankings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate rankings.';
    const status =
      message.startsWith('Season must') || message.startsWith('League must')
        ? 400
        : 500;
    return Response.json({ error: message }, { status });
  }
}
