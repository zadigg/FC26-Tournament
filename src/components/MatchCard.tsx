import { useState } from 'react'
import type { Match, Player } from '../types'
import { useTournament } from '../context/TournamentContext'
import { ScoreInput } from './ScoreInput'

interface MatchCardProps {
  match: Match
  playerA: Player
  playerB: Player
}

export function MatchCard({ match, playerA, playerB }: MatchCardProps) {
  const { setMatchScore } = useTournament()
  const [editing, setEditing] = useState(false)
  const played = match.scoreA !== null && match.scoreB !== null

  const handleSave = (scoreA: number, scoreB: number) => {
    setMatchScore(match.id, scoreA, scoreB)
    setEditing(false)
  }

  const isKnockout = !!match.stage
  return (
    <div
      className={`rounded-card border p-4 transition-all ${
        match.isGoldenGoal
          ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
          : isKnockout
            ? 'border-neobank-lime/30 dark:border-neobank-lime/50 bg-neobank-lime/5 dark:bg-neobank-lime/10'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      } shadow-card dark:shadow-none dark:border hover:shadow-card-hover`}
    >
      {match.isGoldenGoal && (
        <div className="mb-3 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 inline-block">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Golden goal playoff
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{playerA.name}</span>
        <span className="text-gray-400 dark:text-gray-500 font-medium">vs</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{playerB.name}</span>
      </div>
      {played && !editing ? (
        <div className="flex items-center justify-between">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {match.scoreA} – {match.scoreB}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-neobank-lime hover:text-neobank-lime-dark transition-colors"
          >
            Edit
          </button>
        </div>
      ) : (
        <ScoreInput
          onSave={handleSave}
          onCancel={editing ? () => setEditing(false) : undefined}
          isGoldenGoal={match.isGoldenGoal}
          initialA={match.scoreA}
          initialB={match.scoreB}
        />
      )}
    </div>
  )
}
