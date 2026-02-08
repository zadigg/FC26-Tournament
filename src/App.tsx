import { useState } from 'react'
import { TournamentProvider, useTournament } from './context/TournamentContext'
import { PlayerSetup } from './components/PlayerSetup'
import { RoundList } from './components/RoundList'
import { StandingsTable } from './components/StandingsTable'
import { GoldenGoalPlayoff } from './components/GoldenGoalPlayoff'
import { KnockoutBracket } from './components/KnockoutBracket'
import { Podium } from './components/Podium'
import { ResetConfirmationDialog } from './components/ResetConfirmationDialog'
import { ResetHistory } from './components/ResetHistory'

function AppContent() {
  const { matches, isLoading, resetTournament } = useTournament()
  const [showKey, setShowKey] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showResetHistory, setShowResetHistory] = useState(false)
  // Show tournament view only if matches exist (tournament has started)
  // If no matches exist, show setup page (even if players exist - they can be added before starting)
  const inTournament = matches.length > 0

  const handleResetConfirm = async (cityName: string) => {
    await resetTournament(cityName)
    setShowResetDialog(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">Round Robin Tournament</h1>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded bg-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500"
              aria-expanded={showKey}
            >
              Key
            </button>
            <button
              type="button"
              onClick={() => setTestMode((v) => !v)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                testMode
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
              }`}
            >
              Test {testMode ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setShowResetHistory(true)}
              className="rounded bg-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500"
            >
              Reset History
            </button>
            {inTournament && (
              <button
                type="button"
                onClick={() => setShowResetDialog(true)}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-red-500"
              >
                Reset tournament
              </button>
            )}
          </div>
          {showKey && (
            <p className="mt-2 text-xs text-slate-400">
              <span className="text-slate-300">#</span> Rank · <span className="text-slate-300">P</span> Played · <span className="text-slate-300">W</span> Wins · <span className="text-slate-300">D</span> Draws · <span className="text-slate-300">L</span> Losses · <span className="text-slate-300">GF</span> Goals For · <span className="text-slate-300">GA</span> Goals Against · <span className="text-slate-300">GD</span> Goal Difference · <span className="text-slate-300">Pts</span> Points
            </p>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-violet-600"></div>
              <p className="text-slate-400">Loading tournament...</p>
            </div>
          </div>
        ) : inTournament ? (
          <TournamentView testMode={testMode} />
        ) : (
          <SetupView />
        )}
      </main>
      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetDialog(false)}
      />
      <ResetHistory
        isOpen={showResetHistory}
        onClose={() => setShowResetHistory(false)}
      />
    </div>
  )
}

function SetupView() {
  return (
    <section className="space-y-6">
      <p className="text-slate-300">Add players, shuffle if you like, then start the tournament.</p>
      <PlayerSetup />
    </section>
  )
}

function TournamentView({ testMode }: { testMode: boolean }) {
  const {
    fillFirstRoundWithSampleScores,
    fillAllRoundsTillSeven,
    startKnockoutStage,
    standings,
    matches,
    knockoutSeeds,
    knockoutPlayerCount,
    setKnockoutPlayerCount,
    players,
  } = useTournament()

  const groupMatches = matches.filter((m) => !m.stage && !m.isGoldenGoal && m.roundIndex >= 0)
  const allGroupPlayed = groupMatches.length > 0 && groupMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
  const goldenMatches = matches.filter((m) => m.isGoldenGoal)
  const allGoldenPlayed = goldenMatches.length === 0 || goldenMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
  // Allow knockout even with ties - users can resolve ties later or proceed
  const groupComplete = allGroupPlayed && allGoldenPlayed
  const canSetKnockoutCount = groupComplete && !knockoutSeeds && standings.length >= 2
  const canStartKnockout = groupComplete && !knockoutSeeds && knockoutPlayerCount !== null && standings.length >= knockoutPlayerCount && knockoutPlayerCount >= 2
  
  // Get qualified players (top N based on knockoutPlayerCount)
  const qualifiedPlayers = knockoutPlayerCount 
    ? standings.slice(0, knockoutPlayerCount).map((s) => {
        const player = players.find((p) => p.id === s.playerId)
        return { ...s, player }
      })
    : []

  return (
    <section className="space-y-8">
      <Podium />
      <div>
        <h2 className="mb-3 text-xl font-semibold text-slate-200">Group stage standings</h2>
        <StandingsTable />
      </div>
      
      {/* Golden Goal Playoffs - Show right after standings, before group rounds */}
      <GoldenGoalPlayoff />
      
      {/* Knockout Player Count Selection */}
      {canSetKnockoutCount && !knockoutPlayerCount && (
        <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4">
          <h2 className="mb-3 text-xl font-semibold text-slate-200">Knockout Stage Setup</h2>
          <p className="mb-4 text-sm text-slate-400">
            Select how many players will advance to the knockout stage (minimum 2, maximum {standings.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: standings.length - 1 }, (_, i) => i + 2).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setKnockoutPlayerCount(count)}
                className="rounded bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Show Qualified Players */}
      {knockoutPlayerCount && !knockoutSeeds && qualifiedPlayers.length > 0 && (
        <div className="rounded-lg border border-emerald-600/50 bg-emerald-950/20 p-4">
          <h2 className="mb-3 text-xl font-semibold text-emerald-400">
            Qualified for Knockout ({knockoutPlayerCount} players)
          </h2>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {qualifiedPlayers.map((q, idx) => (
              <div
                key={q.playerId}
                className="flex items-center justify-between rounded bg-slate-700/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-400">#{idx + 1}</span>
                  <span className="font-medium text-slate-100">{q.playerName}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {q.points} pts · {q.goalsFor} GF
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={startKnockoutStage}
            className="rounded bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
          >
            Start Knockout Stage (Random Draw)
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Players will be randomly shuffled for knockout bracket
          </p>
        </div>
      )}

      {/* Old button (kept for backward compatibility but should not show) */}
      {canStartKnockout && !knockoutPlayerCount && (
        <div>
          <button
            type="button"
            onClick={startKnockoutStage}
            className="rounded bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
          >
            Start knockout stage (top 5, random draw)
          </button>
          <p className="mt-1 text-sm text-slate-400">Semi-finals, final and 3rd place match. Rank 1–3 from knockout.</p>
        </div>
      )}
      
      {/* Knockout Bracket - Show prominently when knockout stage has started */}
      {knockoutSeeds && <KnockoutBracket testMode={testMode} />}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-200">Group rounds</h2>
        {testMode && (
          <>
            <button
              type="button"
              onClick={fillFirstRoundWithSampleScores}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
            >
              Fill first round (test)
            </button>
            <button
              type="button"
              onClick={fillAllRoundsTillSeven}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
            >
              Fill rounds 1–7 (test)
            </button>
          </>
        )}
      </div>
      <RoundList />
    </section>
  )
}

export default function App() {
  return (
    <TournamentProvider>
      <AppContent />
    </TournamentProvider>
  )
}
