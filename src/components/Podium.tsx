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
        <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-center text-xl font-semibold text-slate-200">Final standings</h2>
          <div className="flex items-end justify-center gap-4">
            <div className="flex flex-col items-center">
              <div className="flex w-24 items-end justify-center rounded-t h-20 bg-amber-600">
                <span className="mb-1 text-lg font-bold text-white">2nd</span>
              </div>
              <div className="mt-2 text-center font-medium text-slate-100">{second.name}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex w-24 items-end justify-center rounded-t h-28 bg-slate-500">
                <span className="mb-1 text-lg font-bold text-white">1st</span>
              </div>
              <div className="mt-2 text-center font-medium text-slate-100">{first.name}</div>
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
    const heights = ['h-20', 'h-28', 'h-16']

    return (
      <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-6">
        <h2 className="mb-4 text-center text-xl font-semibold text-slate-200">Final standings</h2>
        <div className="flex items-end justify-center gap-4">
          {order.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center">
              <div
                className={`flex w-24 items-end justify-center rounded-t ${heights[i]} ${
                  i === 0 ? 'bg-amber-600' : i === 1 ? 'bg-slate-500' : 'bg-amber-800'
                }`}
              >
                <span className="mb-1 text-lg font-bold text-white">{labels[i]}</span>
              </div>
              <div className="mt-2 text-center font-medium text-slate-100">{p.name}</div>
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
  const heights = ['h-20', 'h-28', 'h-16']

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-6">
      <h2 className="mb-4 text-center text-xl font-semibold text-slate-200">Group stage top 3</h2>
      <div className="flex items-end justify-center gap-4">
        {order.map((idx, i) => {
          const row = top3[idx]
          if (!row) return null
          return (
            <div key={row.playerId} className="flex flex-col items-center">
              <div
                className={`flex w-24 items-end justify-center rounded-t ${heights[i]} ${
                  i === 0 ? 'bg-amber-600' : i === 1 ? 'bg-slate-500' : 'bg-amber-800'
                }`}
              >
                <span className="mb-1 text-lg font-bold text-white">{labels[i]}</span>
              </div>
              <div className="mt-2 text-center font-medium text-slate-100">{row.playerName}</div>
              <div className="text-sm text-slate-400">{row.points} pts · {row.goalsFor} GF</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
