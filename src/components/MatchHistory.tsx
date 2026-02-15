import { useState, useEffect } from 'react'
import { useTournament } from '../context/TournamentContext'
import { loadAllHistoricalMatches, getHistoricalPlayers } from '../lib/supabaseService'
import type { Match, Player } from '../types'

interface MatchHistoryProps {
  isOpen: boolean
  onClose: () => void
}

const stageLabels: Record<string, string> = {
  play_in: 'Play-in',
  semi: 'Semi-finals',
  final: 'Final',
  third_place: '3rd Place',
}

function getMatchTypeLabel(match: Match): string {
  if (match.isGoldenGoal) return 'Golden Goal Playoff'
  if (match.stage) return stageLabels[match.stage] || match.stage
  return `Round ${match.roundIndex + 1}`
}

function getMatchTypeBadge(match: Match) {
  if (match.isGoldenGoal) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
        Golden Goal
      </span>
    )
  }
  if (match.stage) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-neobank-lime/20 dark:bg-neobank-lime/30 text-neobank-lime">
        Knockout
      </span>
    )
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      Group
    </span>
  )
}

/** Get date key (YYYY-MM-DD) for grouping; current matches use today */
function getDateKey(match: Match): string {
  if (match.created_at) {
    return match.created_at.split('T')[0]
  }
  return new Date().toISOString().split('T')[0]
}

/** Format date for display */
function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === today.toISOString().split('T')[0]) return 'Today'
  if (dateKey === yesterday.toISOString().split('T')[0]) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function MatchHistory({ isOpen, onClose }: MatchHistoryProps) {
  const { matches: currentMatches, players: currentPlayers } = useTournament()
  const [historicalMatches, setHistoricalMatches] = useState<Match[]>([])
  const [historicalPlayers, setHistoricalPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [hasInitialExpand, setHasInitialExpand] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setHasInitialExpand(false)
      Promise.all([loadAllHistoricalMatches(), getHistoricalPlayers()])
        .then(([matches, players]) => {
          setHistoricalMatches(matches)
          setHistoricalPlayers(players)
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('Failed to load match history:', error)
          setIsLoading(false)
        })
    }
  }, [isOpen])

  // Compute derived data (always, so hooks below can use it)
  const allMatchesMap = new Map<string, Match>()
  const allPlayersMap = new Map<string, Player>()
  currentMatches.forEach((m) => allMatchesMap.set(m.id, m))
  currentPlayers.forEach((p) => allPlayersMap.set(p.id, p))
  historicalMatches.forEach((m) => allMatchesMap.set(m.id, m))
  historicalPlayers.forEach((p) => allPlayersMap.set(p.id, p))
  const allMatches = Array.from(allMatchesMap.values())
  const allPlayers = Array.from(allPlayersMap.values())

  const recencyMap = new Map<string, number>()
  historicalMatches.forEach((m, idx) => recencyMap.set(m.id, idx))
  const currentMatchIds = new Set(currentMatches.map((m) => m.id))

  const playedMatches = allMatches
    .filter((m) => m.scoreA !== null && m.scoreB !== null)
    .sort((a, b) => {
      const aCurrent = currentMatchIds.has(a.id)
      const bCurrent = currentMatchIds.has(b.id)
      if (aCurrent && !bCurrent) return -1
      if (!aCurrent && bCurrent) return 1
      const aIdx = recencyMap.get(a.id) ?? 999999
      const bIdx = recencyMap.get(b.id) ?? 999999
      return aIdx - bIdx
    })

  const byDate = new Map<string, Match[]>()
  for (const m of playedMatches) {
    const key = getDateKey(m)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(m)
  }
  const dateKeys = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))

  // Expand first (most recent) day by default when data loads (once per open)
  useEffect(() => {
    if (!isLoading && dateKeys.length > 0 && !hasInitialExpand) {
      setExpandedDates(new Set([dateKeys[0]]))
      setHasInitialExpand(true)
    }
  }, [isLoading, dateKeys.join(','), hasInitialExpand])

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const getPlayerName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? `Player ${id.slice(0, 8)}`

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-card bg-white dark:bg-gray-800 shadow-xl flex flex-col border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Games History</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-neobank-lime"></div>
            </div>
          )}

          {!isLoading && playedMatches.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 font-medium">No completed matches yet.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Play some matches and they will appear here.
              </p>
            </div>
          )}

          {!isLoading && playedMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {playedMatches.length} match{playedMatches.length !== 1 ? 'es' : ''} played (most recent first)
              </p>
              {dateKeys.map((dateKey) => {
                const matches = byDate.get(dateKey) ?? []
                const isExpanded = expandedDates.has(dateKey)
                return (
                  <div
                    key={dateKey}
                    className="rounded-card border border-gray-200 dark:border-gray-600 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDate(dateKey)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatDateLabel(dateKey)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {matches.length} match{matches.length !== 1 ? 'es' : ''}
                      </span>
                      <span
                        className={`inline-block text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      >
                        ▼
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                          {matches.map((match) => (
                            <div
                              key={match.id}
                              className="flex flex-wrap items-center justify-between gap-2 p-3"
                            >
                              <div className="flex-1 min-w-[200px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {getPlayerName(match.playerAId)}
                                  </span>
                                  <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                    {match.scoreA} - {match.scoreB}
                                  </span>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {getPlayerName(match.playerBId)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {getMatchTypeLabel(match)}
                                </div>
                              </div>
                              <div className="flex gap-2">{getMatchTypeBadge(match)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
