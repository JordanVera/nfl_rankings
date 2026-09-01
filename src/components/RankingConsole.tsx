'use client';

import Link from 'next/link';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { League } from '@/types/nfl';

export const SEASONS = [
  2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012,
  2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
  2026,
] as const;
export const DEFAULT_SEASON = 2025;
export const DEFAULT_LEAGUE: League = 'nfl';

const CURRENT_SEASON = SEASONS[SEASONS.length - 1];

const LEAGUE_OPTIONS = [
  {
    id: 'nfl' as const,
    kicker: 'Pro',
    name: 'NFL',
    universe: '32 clubs',
    compare: 'ESPN FPI',
    eta: '~1 min',
    blurb:
      'Mean-pooled game scores, shrunk to last season while this one is unfinished.',
  },
  {
    id: 'cfb' as const,
    kicker: 'FBS',
    name: 'College Football',
    universe: 'FBS · group 80',
    compare: 'AP Top 25',
    eta: '~2 min',
    blurb:
      'SRS-adjusted latent scores. First run hydrates on the order of a thousand games.',
  },
] as const;

const PIPELINE = [
  'Uplink',
  'Ingest',
  'Extract',
  'Normalize',
  'Fit',
  'Score',
  'Rank',
] as const;

function HudCorners() {
  return (
    <>
      <span className="absolute top-0 left-0 w-7 h-7 border-t border-l border-primary-300/70" />
      <span className="absolute top-0 right-0 w-7 h-7 border-t border-r border-primary-300/70" />
      <span className="absolute bottom-0 left-0 w-7 h-7 border-b border-l border-primary-300/70" />
      <span className="absolute right-0 bottom-0 w-7 h-7 border-r border-b border-primary-300/70" />
    </>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function RankingConsole({
  league,
  season,
  loading,
  hasResults,
  onLeagueChange,
  onSeasonChange,
  onTrain,
}: {
  league: League;
  season: number;
  loading: boolean;
  hasResults: boolean;
  onLeagueChange: (league: League) => void;
  onSeasonChange: (season: number) => void;
  onTrain: () => void;
}) {
  const selected =
    LEAGUE_OPTIONS.find((option) => option.id === league) ?? LEAGUE_OPTIONS[0];
  const leagueLabel = selected.id === 'cfb' ? 'FBS' : 'NFL';

  return (
    <section className="overflow-hidden relative rounded-md border border-white/10 bg-black/40">
      <HudCorners />
      <div
        className="absolute inset-0 opacity-40 pointer-events-none train-grid"
        aria-hidden
      />
      <div
        className="absolute -top-24 left-1/3 h-48 w-48 rounded-full pointer-events-none bg-primary-500/20 blur-[90px]"
        aria-hidden
      />

      <div className="flex relative z-10 flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 justify-between items-start">
          <div>
            <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-primary">
              SYS // Ranking engine
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Configure a run
            </h2>
          </div>
          <div className="flex gap-2 items-center text-[11px] tracking-[0.28em] uppercase text-white/45">
            <span className="flex relative w-2 h-2">
              <span className="inline-flex absolute w-full h-full rounded-full opacity-60 animate-ping bg-primary-400 motion-reduce:animate-none" />
              <span className="inline-flex relative w-2 h-2 rounded-full bg-primary-300" />
            </span>
            Ready
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
          <fieldset className="p-0 m-0 min-w-0 border-0" role="radiogroup">
            <legend className="mb-2 text-[11px] font-medium tracking-[0.28em] uppercase text-white/45">
              League
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEAGUE_OPTIONS.map((option) => {
                const isSelected = option.id === league;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={loading}
                    onClick={() => onLeagueChange(option.id)}
                    className={cn(
                      'flex flex-col gap-2 rounded-md border px-3.5 py-3.5 text-left transition duration-200 ease-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      isSelected
                        ? 'border-primary-400/70 bg-primary-500/10 shadow-[0_0_24px_rgba(255,95,31,0.12)]'
                        : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex gap-2 justify-between items-center">
                      <span className="text-[10px] tracking-[0.28em] uppercase text-primary-300">
                        {option.kicker}
                      </span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          isSelected
                            ? 'bg-primary-300 shadow-[0_0_8px_#FF5F1F]'
                            : 'bg-white/20',
                        )}
                        aria-hidden
                      />
                    </div>
                    <span className="text-base font-semibold text-white">
                      {option.name}
                    </span>
                    <span className="text-xs leading-relaxed text-white/60">
                      {option.blurb}
                    </span>
                    <span className="font-mono text-[11px] tracking-wide text-white/45">
                      {option.universe}
                      <span className="text-white/25"> · </span>
                      {option.compare}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-5 min-w-0">
            <div>
              <div className="flex gap-3 justify-between items-center mb-2">
                <label
                  htmlFor="season-select"
                  className="text-[11px] font-medium tracking-[0.28em] uppercase text-white/45"
                >
                  Season
                </label>
                {season === CURRENT_SEASON ? (
                  <span className="text-[9px] tracking-[0.18em] uppercase text-primary-300">
                    Live
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <select
                  id="season-select"
                  name="season"
                  value={season}
                  disabled={loading}
                  onChange={(event) =>
                    onSeasonChange(Number(event.target.value))
                  }
                  className={cn(
                    'w-full cursor-pointer appearance-none rounded-md border bg-black/30 py-3 pl-3.5 pr-12',
                    'font-mono text-xl tabular-nums text-white scheme-dark',
                    'transition duration-200 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    'border-white/10 hover:border-white/25 hover:bg-white/[0.04]',
                  )}
                >
                  {[...SEASONS].reverse().map((year) => (
                    <option key={year} value={year}>
                      {year === CURRENT_SEASON ? `${year} · Live` : year}
                    </option>
                  ))}
                </select>
                <span
                  className="flex absolute inset-y-0 right-0 items-center pr-3 pointer-events-none text-primary-300"
                  aria-hidden
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3.5 py-3 font-mono text-[11px] rounded-md border border-white/10 bg-black/50 sm:text-xs">
              <div className="flex flex-col gap-0.5">
                <dt className="tracking-[0.18em] uppercase text-white/35">
                  Target
                </dt>
                <dd className="text-primary-100">
                  {season} {leagueLabel}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="tracking-[0.18em] uppercase text-white/35">
                  Runtime
                </dt>
                <dd className="text-primary-100">{selected.eta} first run</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="tracking-[0.18em] uppercase text-white/35">
                  Universe
                </dt>
                <dd className="text-white/80">{selected.universe}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="tracking-[0.18em] uppercase text-white/35">
                  Benchmark
                </dt>
                <dd className="text-white/80">{selected.compare}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ol className="hidden gap-1 items-center text-[10px] tracking-[0.16em] uppercase text-white/35 sm:flex">
          {PIPELINE.map((stage, index) => (
            <li key={stage} className="flex gap-1 items-center">
              {index > 0 ? (
                <span className="text-primary-500/50" aria-hidden>
                  /
                </span>
              ) : null}
              <span>
                <span className="text-primary-400/80">
                  {String(index + 1).padStart(2, '0')}
                </span>{' '}
                {stage}
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onTrain}
          disabled={loading}
          className={cn(
            'group relative overflow-hidden rounded-md border border-primary-400/50 bg-gradient-to-r from-primary-700 via-primary to-primary-500 px-4 py-4 text-left text-white shadow-[0_0_28px_rgba(255,95,31,0.18)]',
            'transition duration-300 ease-out hover:border-primary-300 hover:shadow-[0_0_40px_rgba(255,95,31,0.32)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-[0_0_28px_rgba(255,95,31,0.18)]',
          )}
        >
          <span
            className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out -translate-x-full group-hover:translate-x-[350%] motion-reduce:transition-none"
            aria-hidden
          />
          <span className="flex relative gap-3 justify-between items-center">
            <span className="flex gap-3 items-center min-w-0">
              <span className="flex justify-center items-center w-10 h-10 rounded-md border shrink-0 border-white/20 bg-black/25">
                <AutoAwesomeIcon fontSize="small" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-wide sm:text-base">
                  {hasResults ? 'Retrain' : 'Train'} {season} {leagueLabel}{' '}
                  model
                </span>
                <span className="block mt-0.5 text-xs text-white/80">
                  Pull box scores, fit the dense net, rank the league
                  <span className="text-white/45"> · </span>
                  {selected.eta} uncached
                </span>
              </span>
            </span>
            <span className="hidden font-mono text-[11px] tracking-[0.28em] uppercase shrink-0 text-white/80 sm:block">
              Run →
            </span>
          </span>
        </button>

        <p className="text-xs text-white/45">
          First run is slow because it hydrates ESPN summaries, not because the
          network is large.{' '}
          <Link
            href="/about"
            className="text-primary-300 underline-offset-2 hover:text-primary-200 hover:underline"
          >
            How the model works
          </Link>
        </p>
      </div>
    </section>
  );
}
