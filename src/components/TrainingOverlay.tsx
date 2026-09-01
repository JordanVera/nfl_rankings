'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { League } from '@/types/nfl';

const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const NFL_STAGES = [
  'UPLINKING ESPN SCOREBOARD',
  'INGESTING BOX SCORES',
  'EXTRACTING TEAM VECTORS',
  'NORMALIZING FEATURE SPACE',
  'FITTING DENSE NETWORK',
  'SCORING TEAM STRENGTH',
  'COMPILING POWER RANKINGS',
] as const;

const CFB_STAGES = [
  'UPLINKING FBS SCOREBOARD',
  'INGESTING BOX SCORES',
  'EXTRACTING TEAM VECTORS',
  'NORMALIZING FEATURE SPACE',
  'FITTING DENSE NETWORK',
  'SCORING TEAM STRENGTH',
  'COMPILING POWER RANKINGS',
] as const;

const NFL_LOGS = [
  { at: 0, text: 'runtime.init          tensorflow.js backend ready' },
  { at: 3, text: 'net.uplink            espn scoreboard handshake ok' },
  { at: 8, text: 'ingest.boxscores      parsing weekly game packets' },
  { at: 16, text: 'features.extract      offensive / defensive tensors' },
  { at: 24, text: 'features.special      kicking / return / possession' },
  { at: 34, text: 'tensor.normalize      z-score fit across season' },
  { at: 46, text: 'dense.compile         adam · mse · 3 hidden layers' },
  { at: 58, text: 'dense.fit             backprop through team vectors' },
  { at: 70, text: 'model.evaluate        residual check on holdout' },
  { at: 82, text: 'rank.compile          sorting 32-team latent scores' },
] as const;

const CFB_LOGS = [
  { at: 0, text: 'runtime.init          tensorflow.js backend ready' },
  { at: 3, text: 'net.uplink            fbs scoreboard handshake ok' },
  { at: 8, text: 'ingest.boxscores      parsing fbs game packets' },
  { at: 16, text: 'features.extract      offensive / defensive tensors' },
  { at: 24, text: 'features.special      kicking / return / possession' },
  { at: 34, text: 'tensor.normalize      z-score fit across season' },
  { at: 46, text: 'dense.compile         adam · mse · 3 hidden layers' },
  { at: 58, text: 'dense.fit             backprop through team vectors' },
  { at: 70, text: 'model.evaluate        residual check on holdout' },
  { at: 82, text: 'rank.compile          sorting fbs latent scores' },
] as const;

const EQ_BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function formatElapsed(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `T+${mm}:${ss}`;
}

function HudCorners() {
  return (
    <>
      <span className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary-300/80" />
      <span className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary-300/80" />
      <span className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary-300/80" />
      <span className="absolute right-0 bottom-0 w-8 h-8 border-r border-b border-primary-300/80" />
    </>
  );
}

function TrainingCore({
  progress,
  reducedMotion,
}: {
  progress: number;
  reducedMotion: boolean;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div className="relative w-52 h-52 sm:h-72 sm:w-72">
      <div className="absolute inset-3 rounded-full blur-3xl bg-primary-400/20 train-core-glow" />

      <div
        className={`absolute inset-0 rounded-full border border-primary-400/20 ${
          reducedMotion ? '' : 'train-spin-slow'
        }`}
      >
        <span className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary-300 shadow-[0_0_12px_#FF5F1F]" />
      </div>
      <div
        className={`absolute border border-dashed rounded-full inset-5 border-primary-400/30 ${
          reducedMotion ? '' : 'train-spin-reverse'
        }`}
      />
      <div className="absolute inset-10 rounded-full border border-primary-300/15" />

      <div className="absolute inset-0 -rotate-90">
        <svg className="w-full h-full" viewBox="0 0 220 220" aria-hidden>
          <circle
            cx="110"
            cy="110"
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,95,31,0.12)"
            strokeWidth="3"
          />
          <circle
            cx="110"
            cy="110"
            r={RING_RADIUS}
            fill="none"
            stroke="url(#train-ring)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="drop-shadow-[0_0_8px_rgba(255,95,31,0.8)]"
            style={{
              transition: reducedMotion
                ? 'none'
                : 'stroke-dashoffset 140ms linear',
            }}
          />
          <defs>
            <linearGradient id="train-ring" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffae75" />
              <stop offset="50%" stopColor="#FF5F1F" />
              <stop offset="100%" stopColor="#cc4c19" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex absolute inset-0 flex-col gap-1 justify-center items-center">
        <span className="text-[10px] tracking-[0.35em] text-primary-300/70">
          COMPLETE
        </span>
        <span className="font-mono text-4xl font-light tabular-nums text-white sm:text-6xl">
          {Math.round(progress)}
          <span className="text-2xl text-primary-300/80 sm:text-3xl">%</span>
        </span>
      </div>
    </div>
  );
}

export default function TrainingOverlay({
  open,
  league,
  season,
}: {
  open: boolean;
  league: League;
  season: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reducedMotion = useReducedMotion() ?? false;

  const durationSec = league === 'cfb' ? 140 : 70;
  const progress = Math.min(
    92,
    92 * (1 - Math.exp(-3.2 * (elapsed / durationSec))),
  );
  const stages = league === 'cfb' ? CFB_STAGES : NFL_STAGES;
  const logs = league === 'cfb' ? CFB_LOGS : NFL_LOGS;
  const stageIndex = Math.min(
    stages.length - 1,
    Math.floor((progress / 92) * stages.length),
  );
  const visibleLogs = logs.filter((log) => progress >= log.at);
  const leagueLabel = league === 'cfb' ? 'FBS' : 'NFL';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    setElapsed(0);
    const started = performance.now();
    const id = window.setInterval(() => {
      setElapsed((performance.now() - started) / 1000);
    }, 120);

    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    const previousHtml = html.style.overflow;
    html.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtml;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="training-overlay"
          role="status"
          aria-live="polite"
          aria-label="Training power rankings model"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.35 }}
          className="flex overflow-y-auto fixed top-0 left-0 z-40 justify-center items-start w-screen min-h-dvh ml-[calc(50%-50vw)] bg-black sm:items-center"
        >
          <div
            className="absolute inset-0 pointer-events-none train-grid"
            aria-hidden
          />
          <div className="absolute inset-0 train-scanlines" aria-hidden />
          <div
            className="absolute -top-24 left-1/4 h-80 w-80 rounded-full pointer-events-none bg-primary-500/20 blur-[120px]"
            aria-hidden
          />
          <div
            className="absolute right-1/4 -bottom-24 h-96 w-96 rounded-full pointer-events-none bg-primary-600/20 blur-[140px]"
            aria-hidden
          />
          <div className="pointer-events-none train-floor" aria-hidden />
          {reducedMotion ? null : (
            <div className="train-scan-beam" aria-hidden />
          )}

          <div className="flex relative z-10 flex-col gap-5 justify-center items-center px-4 py-24 w-full max-w-xl min-h-full sm:gap-8 sm:py-12 sm:min-h-0">
            <div className="flex gap-3 items-center text-[11px] tracking-[0.35em] text-primary-200/80">
              <span className="flex relative w-2 h-2">
                {reducedMotion ? null : (
                  <span className="inline-flex absolute w-full h-full rounded-full opacity-75 animate-ping bg-primary-400" />
                )}
                <span className="inline-flex relative w-2 h-2 rounded-full bg-primary-300" />
              </span>
              SYS // TRAIN
              <span className="text-white/40">·</span>
              <span className="tabular-nums text-primary-100/90">
                {formatElapsed(elapsed)}
              </span>
            </div>

            <div className="relative px-8 py-10 w-full rounded-sm border backdrop-blur-sm border-primary-300/20 bg-black/40">
              <HudCorners />

              <div className="flex flex-col gap-6 items-center">
                <div className="text-center">
                  <p className="text-[10px] tracking-[0.4em] text-white/40">
                    NEURAL RANKING ENGINE
                  </p>
                  <p className="mt-1 font-mono text-sm tracking-widest text-primary-100">
                    {season} {leagueLabel}
                    <span className="text-white/30"> · </span>
                    DENSE-NET
                  </p>
                </div>

                <TrainingCore
                  progress={progress}
                  reducedMotion={reducedMotion}
                />

                <div className="w-full text-center">
                  <p className="font-mono text-xs tracking-[0.22em] text-primary-200 sm:text-sm">
                    {stages[stageIndex]}
                  </p>
                  <div className="overflow-hidden mt-3 w-full h-1 bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-primary-400 via-primary to-primary-600 shadow-[0_0_12px_rgba(255,95,31,0.7)]"
                      style={{
                        width: `${progress}%`,
                        transition: reducedMotion
                          ? 'none'
                          : 'width 140ms linear',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex gap-1 justify-center items-end h-10"
                  aria-hidden
                >
                  {EQ_BARS.map((bar) => (
                    <span
                      key={bar}
                      className={`w-[5px] rounded-sm bg-gradient-to-t from-primary-700 to-primary-300 ${
                        reducedMotion ? 'h-3' : 'train-eq-bar'
                      }`}
                      style={
                        reducedMotion
                          ? undefined
                          : {
                              animationDelay: `${bar * 0.09}s`,
                              height: `${10 + ((bar * 17) % 28)}px`,
                            }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-hidden w-full max-w-lg font-mono text-[11px] leading-6 text-primary-100/80 sm:text-xs">
              <p className="mb-1 tracking-[0.25em] text-white/35">
                PROCESS LOG
              </p>
              <div className="flex overflow-hidden flex-col justify-end px-4 py-3 h-28 rounded-sm border border-white/10 bg-black/50 sm:h-40">
                {visibleLogs.map((log) => (
                  <p key={log.text} className="truncate">
                    <span className="text-primary-400/70">›</span> {log.text}
                  </p>
                ))}
                <p className="text-primary-300">
                  <span className="text-primary-400/70">›</span>{' '}
                  {stages[stageIndex].toLowerCase()}
                  <span className="train-cursor">█</span>
                </p>
              </div>
              <p className="mt-3 text-center text-[11px] tracking-wide text-white/45">
                {league === 'cfb'
                  ? 'Fetching FBS box scores and training the model. First run can take a couple of minutes.'
                  : 'Fetching ESPN box scores and training the model. First run can take a minute.'}
              </p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
