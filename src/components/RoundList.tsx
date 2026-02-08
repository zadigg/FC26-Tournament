import { useTournament } from '../context/TournamentContext'
import { MatchCard } from './MatchCard'
import { getPlayerWithBye } from '../lib/elimination'

export function RoundList() {
  const { matches, players, roundEliminations } = useTournament()
  const playerMap = new Map(players.map((p) => [p.id, p]))

  const roundRobinMatches = matches.filter((m) => !m.isGoldenGoal && m.roundIndex >= 0)
  const rounds = new Map<number, typeof roundRobinMatches>()
  for (const m of roundRobinMatches) {
    if (!rounds.has(m.roundIndex)) rounds.set(m.roundIndex, [])
    rounds.get(m.roundIndex)!.push(m)
  }
  const roundIndices = Array.from(rounds.keys()).sort((a, b) => a - b)

  if (roundIndices.length === 0) return null

  return (
    <div className="space-y-6">
      {roundIndices.map((r) => {
        const roundMatches = rounds.get(r)!
        const roundElimination = roundEliminations.find((e) => e.roundIndex === r)
        const eliminatedPlayer = roundElimination ? playerMap.get(roundElimination.eliminatedPlayerId) : null
        
        // Get player with bye for this round (if odd number)
        const activePlayersAtRoundStart = players.filter((p) => {
          // Check if player was eliminated before this round
          const eliminatedBeforeRound = roundEliminations.some(
            (e) => e.eliminatedPlayerId === p.id && e.roundIndex < r
          )
          return !eliminatedBeforeRound
        })
        const byePlayer = activePlayersAtRoundStart.length % 2 === 1
          ? getPlayerWithBye(players, r, new Set(roundEliminations.filter((e) => e.roundIndex < r).map((e) => e.eliminatedPlayerId)))
          : null

        return (
          <div key={r} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Round {r + 1}</h3>
              {roundElimination && eliminatedPlayer && (
                <div className="flex items-center gap-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs">
                  <span className="text-red-600 dark:text-red-400 font-semibold">❌ Eliminated:</span>
                  <span className="font-semibold text-red-700 dark:text-red-300">{eliminatedPlayer.name}</span>
                  <span className="text-red-500 dark:text-red-400">
                    ({roundElimination.reason === 'bye' ? 'had bye' : 'worst performance'})
                  </span>
                </div>
              )}
              {!roundElimination && byePlayer && players.length % 2 === 1 && (
                <div className="flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">⏸️ Bye:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{byePlayer.name}</span>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {roundMatches.map((m) => {
                const pa = playerMap.get(m.playerAId)
                const pb = playerMap.get(m.playerBId)
                if (!pa || !pb) return null
                return <MatchCard key={m.id} match={m} playerA={pa} playerB={pb} />
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
