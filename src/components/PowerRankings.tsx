'use client';

import { useState } from 'react';
import Image from 'next/image';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ScaleLoader } from 'react-spinners';
import type { RankedTeam, RankingsResponse } from '@/types/nfl';

const SEASONS = [2023, 2024, 2025, 2026];
const DEFAULT_SEASON = 2025;

const rankDelta = (modelRank: number, espnRank: number | undefined) => {
  if (!espnRank) return null;
  const delta = espnRank - modelRank;
  if (delta === 0) return { label: '=', className: 'text-gray-400' };
  if (delta > 0) {
    return { label: `+${delta}`, className: 'text-emerald-400' };
  }
  return { label: `${delta}`, className: 'text-red-400' };
};

function RankingsTable({
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
    <div className="flex flex-col gap-2 min-w-0">
      <div>
        <h2 className="text-white text-xl font-semibold">{title}</h2>
        {subtitle ? (
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        ) : null}
      </div>
      <table className="w-full">
        <thead>
          <tr className="flex flex-row gap-4 items-center w-full rounded-t-lg border border-gray-700 bg-gray-800 py-3 px-2 text-left">
            <th className="w-10">Rank</th>
            <th>Team</th>
            {showDelta ? <th className="w-14 text-right">vs ESPN</th> : null}
            <th className="ml-auto">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => {
            const modelRank = index + 1;
            const espnRank = espnRankById?.get(team.teamId);
            const delta = showDelta ? rankDelta(modelRank, espnRank) : null;

            return (
              <tr
                key={team.teamId}
                className={`${
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                } ${
                  index === teams.length - 1 ? 'rounded-b-lg' : ''
                } flex flex-row gap-4 items-center p-2.5 border border-gray-700`}
              >
                <td className="w-10 text-right">{modelRank}</td>
                <td className="flex flex-row items-center gap-3 min-w-0">
                  {team.logoUrl ? (
                    <Image
                      src={team.logoUrl}
                      height={40}
                      width={40}
                      alt={team.teamName}
                    />
                  ) : null}
                  <span className="truncate">
                    {team.teamName}
                    {team.record ? (
                      <span className="text-gray-400 text-sm ml-2">
                        {team.record}
                      </span>
                    ) : null}
                  </span>
                </td>
                {showDelta ? (
                  <td className={`w-14 text-right ${delta?.className ?? ''}`}>
                    {delta?.label ?? '—'}
                  </td>
                ) : null}
                <td className="ml-auto tabular-nums">{team.score.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PowerRankings() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [result, setResult] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetStandings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rankings?season=${season}`);
      const payload = (await response.json()) as
        | RankingsResponse
        | { error?: string };

      if (!response.ok || !('rankedTeams' in payload)) {
        throw new Error(
          ('error' in payload && payload.error) ||
            'Failed to generate power rankings.'
        );
      }

      setResult(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate power rankings.'
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
    ])
  );

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex justify-center items-center gap-3 flex-wrap">
        <label className="text-white text-sm" htmlFor="season">
          Season
        </label>
        <select
          id="season"
          value={season}
          onChange={(event) => setSeason(Number(event.target.value))}
          disabled={loading}
          className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
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
          className="flex gap-2.5 items-center bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-105 duration-300 ease-in-out px-4 py-2 rounded-md disabled:opacity-60 disabled:hover:scale-100"
        >
          <AutoAwesomeIcon />
          Train Power Rankings Model
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-2">
          <ScaleLoader color="#36d7b7" />
          <p className="text-gray-400 text-sm">
            Fetching ESPN box scores and training the model. First run can take a
            minute.
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-center" role="alert">
          {error}
        </p>
      )}

      {!loading && result && result.rankedTeams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <RankingsTable
            title="Our model"
            subtitle={`${result.season} season box-score model`}
            teams={result.rankedTeams}
            scoreLabel="Score"
            espnRankById={espnRankById}
            showDelta={Boolean(result.espnRankings)}
          />
          {result.espnRankings ? (
            <RankingsTable
              title="ESPN FPI"
              subtitle={`Football Power Index for ${result.season}${
                result.espnRankings.lastUpdated
                  ? ` · updated ${new Date(
                      result.espnRankings.lastUpdated
                    ).toLocaleDateString()}`
                  : ''
              }`}
              teams={result.espnRankings.rankedTeams}
              scoreLabel="FPI"
            />
          ) : (
            <p className="text-gray-400 text-sm">
              ESPN FPI rankings were not available for this season. NFL does not
              publish AP-style polls; FPI is ESPN&apos;s published power ranking.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
