import { useState } from 'react'
import { useTournament } from '../context/TournamentContext'

export function PlayerSetup() {
  const { players, addPlayer, removePlayer, shufflePlayers, loadSamplePlayers, startTournament } = useTournament()
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addPlayer(name)
    setName('')
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadSamplePlayers}
          className="rounded-button bg-gray-100 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Load sample players
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          className="flex-1 min-w-[200px] rounded-button border-2 border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-neobank-lime focus:outline-none transition-colors"
        />
        <button
          type="submit"
          className="rounded-button bg-neobank-lime px-6 py-2.5 font-semibold text-white hover:bg-neobank-lime-dark transition-colors shadow-sm"
        >
          Add player
        </button>
      </form>

      {players.length > 0 && (
        <>
          <div>
            <h2 className="mb-3 text-lg font-bold text-gray-900">Players ({players.length})</h2>
            <ul className="flex flex-wrap gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium border border-gray-200"
                >
                  <span className="text-gray-900">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePlayer(p.id)}
                    className="ml-1 w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                    aria-label={`Remove ${p.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={shufflePlayers}
              className="rounded-button bg-gray-100 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Shuffle players
            </button>
            <button
              type="button"
              onClick={startTournament}
              disabled={players.length < 2}
              className="flex-1 rounded-button bg-black px-6 py-2.5 font-semibold text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Start tournament
            </button>
          </div>
        </>
      )}

      {players.length < 2 && players.length > 0 && (
        <div className="rounded-card bg-amber-50 border border-amber-200 p-4">
          <p className="text-amber-700 font-medium">Add at least 2 players to start the tournament.</p>
        </div>
      )}
    </div>
  )
}
