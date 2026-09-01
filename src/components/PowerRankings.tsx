'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { League, RankedTeam, RankingsResponse } from '@/types/nfl';
import TrainingOverlay from '@/components/TrainingOverlay';
import RankingConsole, {
  DEFAULT_LEAGUE,
  DEFAULT_SEASON,
} from '@/components/RankingConsole';

const rankDelta = (modelRank: number, espnRank: number | undefined) => {
  if (!espnRank) return { label: 'NR', className: 'text-white/40' };
  const delta = espnRank - modelRank;
  if (delta === 0) return { label: '=', className: 'text-white/40' };
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
    <div className="flex flex-col min-w-0 rounded-md border border-white/10 bg-black/30">
      <div className="flex gap-3 justify-between items-end px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-white/50">{subtitle}</p>
          ) : null}
        </div>
        <p className="text-[10px] tracking-[0.2em] uppercase shrink-0 pb-0.5 text-white/40">
          {showDelta ? `vs ESPN · ${scoreLabel}` : scoreLabel}
        </p>
      </div>
      <ol className="flex flex-col px-4 [content-visibility:auto]">
        {teams.map((team, index) => {
          const modelRank = index + 1;
          const espnRank = espnRankById?.get(team.teamId);
          const delta = showDelta ? rankDelta(modelRank, espnRank) : null;
          const isTopThree = modelRank <= 3;

          return (
            <li
              key={team.teamId}
              className="flex items-center gap-3 py-2.5 border-b border-white/10 last:border-b-0"
            >
              <span
                className={`w-7 text-sm tabular-nums text-right shrink-0 ${
                  isTopThree
                    ? 'font-semibold text-primary-300'
                    : 'text-white/40'
                }`}
              >
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
                  <span className="ml-2 text-sm text-white/40">
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
              <span className="text-sm tabular-nums text-white/50 shrink-0">
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
    <div className="flex flex-col gap-6 w-full">
      <TrainingOverlay open={loading} league={league} season={season} />

      <div
        className="flex flex-col gap-6 w-full"
        inert={loading ? true : undefined}
        aria-hidden={loading ? true : undefined}
      >
        <RankingConsole
          league={league}
          season={season}
          loading={loading}
          hasResults={Boolean(result)}
          onLeagueChange={(next) => {
            setLeague(next);
            setResult(null);
            setError(null);
          }}
          onSeasonChange={(next) => {
            setSeason(next);
            setResult(null);
            setError(null);
          }}
          onTrain={handleGetStandings}
        />

        {error ? (
          <p
            className="px-4 py-3 text-sm rounded-md border text-red-300 border-red-400/30 bg-red-500/10"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!loading && !result && !error ? (
          <div className="px-4 py-10 text-center rounded-md border border-dashed border-white/15">
            <p className="text-[11px] font-medium tracking-[0.28em] uppercase text-white/40">
              Awaiting run
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
              Rankings land here after training — our model on the left, ESPN
              on the right.
            </p>
          </div>
        ) : null}

        {!loading && result && result.rankedTeams.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 w-full lg:grid-cols-2">
            <RankingsList
              title="Our model"
              subtitle={`${result.season} ${
                result.league === 'cfb' ? 'FBS' : 'NFL'
              } box-score model${
                result.priorSeason
                  ? ` · season in progress, shrunk toward ${result.priorSeason}`
                  : ''
              }`}
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
              <p className="self-start px-4 py-10 text-sm text-center rounded-md border border-dashed text-white/55 border-white/15">
                ESPN rankings were not available for this season.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
