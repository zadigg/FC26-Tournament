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
          ? 'border-amber-300 bg-amber-50'
          : isKnockout
            ? 'border-neobank-lime/30 bg-neobank-lime/5'
            : 'border-gray-200 bg-white'
      } shadow-card hover:shadow-card-hover`}
    >
      {match.isGoldenGoal && (
        <div className="mb-3 px-2 py-1 rounded-full bg-amber-100 inline-block">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Golden goal playoff
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="font-semibold text-gray-900">{playerA.name}</span>
        <span className="text-gray-400 font-medium">vs</span>
        <span className="font-semibold text-gray-900">{playerB.name}</span>
      </div>
      {played && !editing ? (
        <div className="flex items-center justify-between">
          <span className="text-3xl font-bold text-gray-900">
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
