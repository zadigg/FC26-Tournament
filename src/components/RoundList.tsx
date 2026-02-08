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
          <div key={r}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Round {r + 1}</h3>
              {roundElimination && eliminatedPlayer && (
                <div className="flex items-center gap-2 rounded-full bg-red-950/30 px-3 py-1 text-xs">
                  <span className="text-red-400">❌ Eliminated:</span>
                  <span className="font-medium text-red-300">{eliminatedPlayer.name}</span>
                  <span className="text-slate-500">
                    ({roundElimination.reason === 'bye' ? 'had bye' : 'worst performance'})
                  </span>
                </div>
              )}
              {!roundElimination && byePlayer && players.length % 2 === 1 && (
                <div className="flex items-center gap-2 rounded-full bg-amber-950/30 px-3 py-1 text-xs">
                  <span className="text-amber-400">⏸️ Bye:</span>
                  <span className="font-medium text-amber-300">{byePlayer.name}</span>
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
