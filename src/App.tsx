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
import { useDarkMode } from './hooks/useDarkMode'

function AppContent() {
  const { matches, isLoading, resetTournament } = useTournament()
  const { isDark, toggle: toggleDarkMode } = useDarkMode()
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-40 transition-colors">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tournament</h1>
              {inTournament && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-neobank-lime/10 dark:bg-neobank-lime/20 text-neobank-lime">
                  Active
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="rounded-button bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="rounded-button bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-expanded={showKey}
              >
                Key
              </button>
              <button
                type="button"
                onClick={() => setTestMode((v) => !v)}
                className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                  testMode
                    ? 'bg-neobank-lime text-white hover:bg-neobank-lime-dark'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Test {testMode ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => setShowResetHistory(true)}
                className="rounded-button bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                History
              </button>
              {inTournament && (
                <button
                  type="button"
                  onClick={() => setShowResetDialog(true)}
                  className="rounded-button bg-red-500 dark:bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          {showKey && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-700 dark:text-gray-300">#</span> Rank · <span className="font-medium text-gray-700 dark:text-gray-300">P</span> Played · <span className="font-medium text-gray-700 dark:text-gray-300">W</span> Wins · <span className="font-medium text-gray-700 dark:text-gray-300">D</span> Draws · <span className="font-medium text-gray-700 dark:text-gray-300">L</span> Losses · <span className="font-medium text-gray-700 dark:text-gray-300">GF</span> Goals For · <span className="font-medium text-gray-700 dark:text-gray-300">GA</span> Goals Against · <span className="font-medium text-gray-700 dark:text-gray-300">GD</span> Goal Difference · <span className="font-medium text-gray-700 dark:text-gray-300">Pts</span> Points
              </p>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-neobank-lime"></div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Loading tournament...</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border dark:border-gray-700 p-6 transition-colors">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome to Tournament</h2>
        <p className="text-gray-600 dark:text-gray-400">Add players, shuffle if you like, then start the tournament.</p>
      </div>
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
    <section className="space-y-6">
      <Podium />
      
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border dark:border-gray-700 p-6 transition-colors">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Group stage standings</h2>
        <StandingsTable />
      </div>
      
      {/* Golden Goal Playoffs - Show right after standings, before group rounds */}
      <GoldenGoalPlayoff />
      
      {/* Knockout Player Count Selection */}
      {canSetKnockoutCount && !knockoutPlayerCount && (
        <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border dark:border-gray-700 p-6 transition-colors">
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Knockout Stage Setup</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Select how many players will advance to the knockout stage (minimum 2, maximum {standings.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: standings.length - 1 }, (_, i) => i + 2).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setKnockoutPlayerCount(count)}
                className="rounded-button bg-neobank-lime px-4 py-2.5 font-semibold text-white hover:bg-neobank-lime-dark transition-colors shadow-sm"
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Show Qualified Players */}
      {knockoutPlayerCount && !knockoutSeeds && qualifiedPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border-2 dark:border-neobank-lime/30 p-6 border-2 border-neobank-lime/20 transition-colors">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            Qualified for Knockout ({knockoutPlayerCount} players)
          </h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {qualifiedPlayers.map((q, idx) => (
              <div
                key={q.playerId}
                className="flex items-center justify-between rounded-card bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-neobank-lime text-white font-bold text-sm">#{idx + 1}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{q.playerName}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {q.points} pts
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={startKnockoutStage}
            className="w-full rounded-button bg-black dark:bg-gray-700 px-6 py-3.5 font-semibold text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Start Knockout Stage (Random Draw)
          </button>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
            Players will be randomly shuffled for knockout bracket
          </p>
        </div>
      )}

      {/* Old button (kept for backward compatibility but should not show) */}
      {canStartKnockout && !knockoutPlayerCount && (
        <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border dark:border-gray-700 p-6 transition-colors">
          <button
            type="button"
            onClick={startKnockoutStage}
            className="w-full rounded-button bg-black dark:bg-gray-700 px-6 py-3.5 font-semibold text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          >
            Start knockout stage (top 5, random draw)
          </button>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">Semi-finals, final and 3rd place match. Rank 1–3 from knockout.</p>
        </div>
      )}
      
      {/* Knockout Bracket - Show prominently when knockout stage has started */}
      {knockoutSeeds && <KnockoutBracket testMode={testMode} />}
      
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card dark:shadow-none dark:border dark:border-gray-700 p-6 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Group rounds</h2>
          {testMode && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fillFirstRoundWithSampleScores}
                className="rounded-button bg-amber-500 dark:bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors"
              >
                Fill first round (test)
              </button>
              <button
                type="button"
                onClick={fillAllRoundsTillSeven}
                className="rounded-button bg-amber-500 dark:bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors"
              >
                Fill rounds 1–7 (test)
              </button>
            </div>
          )}
        </div>
        <RoundList />
      </div>
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
