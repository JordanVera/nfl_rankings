'use client';

import { useState } from 'react';
import Image from 'next/image';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { League, RankedTeam, RankingsResponse } from '@/types/nfl';
import TrainingOverlay from '@/components/TrainingOverlay';

const SEASONS = [2023, 2024, 2025, 2026];
const DEFAULT_SEASON = 2025;
const DEFAULT_LEAGUE: League = 'nfl';

const rankDelta = (modelRank: number, espnRank: number | undefined) => {
  if (!espnRank) return { label: 'NR', className: 'text-gray-500' };
  const delta = espnRank - modelRank;
  if (delta === 0) return { label: '=', className: 'text-gray-400' };
  if (delta > 0) {
    return { label: `+${delta}`, className: 'text-emerald-400' };
  }
  return { label: `${delta}`, className: 'text-red-400' };
};

function RankingsList({
  title,
  subtitle,
  teams,
  scoreLabel,
  espnRankById,
  showDelta,
}: {
  title: string;
  subtitle?: string;
  teams: RankedTeam[];
  scoreLabel: string;
  espnRankById?: Map<string, number>;
  showDelta?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex gap-3 justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wider shrink-0 pb-0.5">
          {showDelta ? `vs ESPN · ${scoreLabel}` : scoreLabel}
        </p>
      </div>
      <ol className="flex flex-col">
        {teams.map((team, index) => {
          const modelRank = index + 1;
          const espnRank = espnRankById?.get(team.teamId);
          const delta = showDelta ? rankDelta(modelRank, espnRank) : null;

          return (
            <li
              key={team.teamId}
              className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-b-0"
            >
              <span className="w-7 text-sm tabular-nums text-right text-gray-400 shrink-0">
                {modelRank}
              </span>
              {team.logoUrl ? (
                <Image
                  src={team.logoUrl}
                  height={32}
                  width={32}
                  alt=""
                  sizes="32px"
                  className="shrink-0"
                />
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              <span className="flex-1 min-w-0 truncate">
                {team.teamName}
                {team.record ? (
                  <span className="ml-2 text-sm text-gray-500">
                    {team.record}
                  </span>
                ) : null}
              </span>
              {showDelta ? (
                <span
                  className={`w-10 shrink-0 text-right text-sm tabular-nums ${delta?.className ?? ''}`}
                >
                  {delta?.label ?? '—'}
                </span>
              ) : null}
              <span className="text-sm tabular-nums text-gray-400 shrink-0">
                {team.score.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function PowerRankings() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [league, setLeague] = useState<League>(DEFAULT_LEAGUE);
  const [result, setResult] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetStandings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/rankings?season=${season}&league=${league}`,
      );
      const payload = (await response.json()) as
        | RankingsResponse
        | { error?: string };

      if (!response.ok || !('rankedTeams' in payload)) {
        throw new Error(
          ('error' in payload && payload.error) ||
            'Failed to generate power rankings.',
        );
      }

      setResult(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate power rankings.',
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const espnRankById = new Map(
    (result?.espnRankings?.rankedTeams ?? []).map((team, index) => [
      team.teamId,
      index + 1,
    ]),
  );

  const espnScoreLabel =
    result?.espnRankings?.source === 'ESPN FPI' ? 'FPI' : 'Pts';

  return (
    <div className="flex flex-col gap-5 w-full">
      <TrainingOverlay open={loading} league={league} season={season} />

      <div
        className="flex flex-col gap-5 w-full"
        inert={loading ? true : undefined}
        aria-hidden={loading}
      >
        <div className="flex flex-wrap gap-3 justify-center items-center">
        <label className="text-sm text-white" htmlFor="league">
          League
        </label>
        <select
          id="league"
          value={league}
          onChange={(event) => {
            setLeague(event.target.value as League);
            setResult(null);
          }}
          disabled={loading}
          className="px-3 py-2 text-white bg-gray-800 rounded-md border border-gray-700 focus:border-primary focus:outline-none"
        >
          <option value="nfl">NFL</option>
          <option value="cfb">College Football</option>
        </select>
        <label className="text-sm text-white" htmlFor="season">
          Season
        </label>
        <select
          id="season"
          value={season}
          onChange={(event) => setSeason(Number(event.target.value))}
          disabled={loading}
          className="px-3 py-2 text-white bg-gray-800 rounded-md border border-gray-700 focus:border-primary focus:outline-none"
        >
          {SEASONS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          onClick={handleGetStandings}
          disabled={loading}
          className="flex gap-2.5 items-center text-white bg-primary hover:bg-primary-400 hover:scale-105 duration-300 ease-in-out px-4 py-2 rounded-md disabled:opacity-60 disabled:hover:scale-100"
        >
          <AutoAwesomeIcon />
          Train Power Rankings Model
        </button>
      </div>

      {error && (
        <p className="text-center text-red-400" role="alert">
          {error}
        </p>
      )}

      {!loading && result && result.rankedTeams.length > 0 && (
        <div className="grid grid-cols-1 gap-6 w-full lg:grid-cols-2">
          <RankingsList
            title="Our model"
            subtitle={`${result.season} ${
              result.league === 'cfb' ? 'FBS' : 'NFL'
            } box-score model`}
            teams={result.rankedTeams}
            scoreLabel="Score"
            espnRankById={espnRankById}
            showDelta={Boolean(result.espnRankings)}
          />
          {result.espnRankings ? (
            <RankingsList
              title={result.espnRankings.source}
              subtitle={`${result.season}${
                result.espnRankings.lastUpdated
                  ? ` · updated ${new Date(
                      result.espnRankings.lastUpdated,
                    ).toLocaleDateString()}`
                  : ''
              }`}
              teams={result.espnRankings.rankedTeams}
              scoreLabel={espnScoreLabel}
            />
          ) : (
            <p className="text-sm text-gray-400">
              ESPN rankings were not available for this season.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
