import { useTournament } from '../context/TournamentContext'

export function Podium() {
  const { standings, matches, knockoutResults, players } = useTournament()
  const playerMap = new Map(players.map((p) => [p.id, p]))

  // Prefer knockout results (rank 1–3 from final + 3rd place, or 1–2 for 2-player knockout)
  if (knockoutResults) {
    const first = playerMap.get(knockoutResults.firstId)
    const second = playerMap.get(knockoutResults.secondId)
    if (!first || !second) return null
    
    // Handle 2-player knockout (no 3rd place)
    if (knockoutResults.thirdId === null) {
      return (
        <div className="bg-white rounded-card shadow-card p-6">
          <h2 className="mb-6 text-center text-xl font-bold text-gray-900">Final Standings</h2>
          <div className="flex items-end justify-center gap-4">
            <div className="flex flex-col items-center">
              <div className="flex w-24 items-end justify-center rounded-t h-20 bg-gray-300 shadow-sm">
                <span className="mb-2 text-lg font-bold text-white">2nd</span>
              </div>
              <div className="mt-3 text-center font-semibold text-gray-900">{second.name}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex w-28 items-end justify-center rounded-t h-32 bg-neobank-lime shadow-sm">
                <span className="mb-2 text-xl font-bold text-white">1st</span>
              </div>
              <div className="mt-3 text-center font-semibold text-gray-900">{first.name}</div>
            </div>
          </div>
        </div>
      )
    }
    
    // Handle 3+ player knockout (with 3rd place)
    const third = playerMap.get(knockoutResults.thirdId)
    if (!third) return null
    const order = [second, first, third]
    const labels = ['2nd', '1st', '3rd']
    const heights = ['h-20', 'h-32', 'h-16']
    const widths = ['w-24', 'w-28', 'w-24']
    const colors = ['bg-gray-300', 'bg-neobank-lime', 'bg-gray-400']

    return (
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="mb-6 text-center text-xl font-bold text-gray-900">Final Standings</h2>
        <div className="flex items-end justify-center gap-4">
          {order.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center">
              <div
                className={`flex ${widths[i]} items-end justify-center rounded-t ${heights[i]} ${colors[i]} shadow-sm`}
              >
                <span className={`mb-2 ${i === 1 ? 'text-xl' : 'text-lg'} font-bold text-white`}>{labels[i]}</span>
              </div>
              <div className="mt-3 text-center font-semibold text-gray-900">{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Fallback: group stage top 3 when group complete (no knockout yet or no knockout results)
  const top3 = standings.slice(0, 3)
  const roundRobinMatches = matches.filter((m) => !m.stage && !m.isGoldenGoal && m.roundIndex >= 0)
  const allPlayed = roundRobinMatches.length > 0 && roundRobinMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
  const goldenMatches = matches.filter((m) => m.isGoldenGoal)
  const allGoldenPlayed = goldenMatches.length === 0 || goldenMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
  const groupComplete = allPlayed && allGoldenPlayed && !standings.some((s) => s.isTied)

  if (top3.length === 0 || !groupComplete) return null

  const order = [2, 0, 1]
  const labels = ['2nd', '1st', '3rd']
  const heights = ['h-20', 'h-32', 'h-16']
  const widths = ['w-24', 'w-28', 'w-24']
  const colors = ['bg-gray-300', 'bg-neobank-lime', 'bg-gray-400']

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <h2 className="mb-6 text-center text-xl font-bold text-gray-900">Group Stage Top 3</h2>
      <div className="flex items-end justify-center gap-4">
        {order.map((idx, i) => {
          const row = top3[idx]
          if (!row) return null
          return (
            <div key={row.playerId} className="flex flex-col items-center">
              <div
                className={`flex ${widths[i]} items-end justify-center rounded-t ${heights[i]} ${colors[i]} shadow-sm`}
              >
                <span className={`mb-2 ${i === 1 ? 'text-xl' : 'text-lg'} font-bold text-white`}>{labels[i]}</span>
              </div>
              <div className="mt-3 text-center font-semibold text-gray-900">{row.playerName}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">{row.points} pts · {row.goalsFor} GF</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
