'use client';

import { useState } from 'react';
import Image from 'next/image';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ScaleLoader } from 'react-spinners';
import type { RankedTeam, RankingsResponse } from '@/types/nfl';

const SEASONS = [2023, 2024, 2025, 2026];
const DEFAULT_SEASON = 2025;

export default function PowerRankings() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);
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

      setRankedTeams(payload.rankedTeams);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate power rankings.'
      );
      setRankedTeams([]);
    } finally {
      setLoading(false);
    }
  };

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

      {!loading && rankedTeams.length > 0 && (
        <table>
          <thead className="flex flex-row gap-10 ">
            <tr className="flex flex-row gap-10 items-center w-full rounded-t-lg border border-gray-700 bg-gray-800 py-3 px-2">
              <th>Rank</th>
              <th>Team</th>
              <th className="ml-auto">Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedTeams.map((team, index) => (
              <tr
                key={team.teamId}
                className={` ${
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                } ${
                  index === rankedTeams.length - 1 ? 'rounded-b-lg' : ''
                } flex flex-row gap-10 items-center  p-2.5 border border-gray-700`}
              >
                <td className="text-right">{index + 1}</td>
                <td className="flex flex-row items-center gap-5">
                  {team.logoUrl ? (
                    <Image
                      src={team.logoUrl}
                      height={40}
                      width={40}
                      alt={team.teamName}
                    />
                  ) : null}
                  {team.teamName}
                </td>
                <td className="ml-auto">{team.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
