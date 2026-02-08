import { useTournament } from '../context/TournamentContext'

export function StandingsTable() {
  const { standings } = useTournament()

  if (standings.length === 0) return null

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">#</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Player</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">P</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">W</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">D</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">L</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">GF</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">GA</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">GD</th>
            <th className="px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {standings.map((row) => (
            <tr
              key={row.playerId}
              className={`${
                row.isTied ? 'bg-neobank-lime/5' : ''
              } hover:bg-gray-50 transition-colors`}
            >
              <td className="px-4 py-3 font-bold text-gray-900">{row.rank}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{row.playerName}</span>
                  {row.isTied && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neobank-lime/20 text-neobank-lime">Tied</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.played}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.wins}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.draws}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.losses}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.goalsFor}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{row.goalsAgainst}</td>
              <td className="px-4 py-3 font-semibold text-gray-700">
                {row.goalDifference >= 0 ? '+' : ''}{row.goalDifference}
              </td>
              <td className="px-4 py-3 font-bold text-gray-900 text-base">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
