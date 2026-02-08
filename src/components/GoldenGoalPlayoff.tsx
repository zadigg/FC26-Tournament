import { useEffect } from 'react'
import { useTournament } from '../context/TournamentContext'
import { MatchCard } from './MatchCard'

export function GoldenGoalPlayoff() {
  const { matches, standings, players, addGoldenGoalMatchesForTies } = useTournament()
  const goldenMatches = matches.filter((m) => m.isGoldenGoal)
  const playerMap = new Map(players.map((p) => [p.id, p]))

  const roundRobinMatches = matches.filter((m) => !m.isGoldenGoal && m.roundIndex >= 0)
  const allRoundRobinPlayed = roundRobinMatches.length > 0 && roundRobinMatches.every((m) => m.scoreA !== null && m.scoreB !== null)

  useEffect(() => {
    const hasTies = standings.some((s) => s.isTied)
    if (hasTies && allRoundRobinPlayed) addGoldenGoalMatchesForTies()
  }, [standings, allRoundRobinPlayed, addGoldenGoalMatchesForTies])

  if (goldenMatches.length === 0 && !standings.some((s) => s.isTied)) return null

  return (
    <div className="bg-white rounded-card shadow-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Golden Goal Playoffs</h2>
        <p className="text-sm text-gray-600">
          Tied on points and goals. First to score wins.
        </p>
      </div>
      {goldenMatches.length === 0 && standings.some((s) => s.isTied) && (
        <div className="rounded-card bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-700 font-medium">Golden goal matches will appear here once round-robin is complete.</p>
        </div>
      )}
      {goldenMatches.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {goldenMatches.map((m) => {
            const pa = playerMap.get(m.playerAId)
            const pb = playerMap.get(m.playerBId)
            if (!pa || !pb) return null
            return <MatchCard key={m.id} match={m} playerA={pa} playerB={pb} />
          })}
        </div>
      )}
    </div>
  )
}
