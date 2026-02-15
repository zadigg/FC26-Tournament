import { useState, useEffect } from 'react'
import { useTournament } from '../context/TournamentContext'
import { calculateHeadToHeadByName, getMatchTypeStats, getUniquePlayerNames, getPlayedPairsCountByName, type HeadToHeadStats } from '../lib/headToHead'
import { loadAllHistoricalMatches, getHistoricalPlayers } from '../lib/supabaseService'
import type { Match, Player } from '../types'

interface HeadToHeadProps {
  isOpen: boolean
  onClose: () => void
}

export function HeadToHead({ isOpen, onClose }: HeadToHeadProps) {
  const { matches: currentMatches, players: currentPlayers } = useTournament()
  const [historicalMatches, setHistoricalMatches] = useState<Match[]>([])
  const [historicalPlayers, setHistoricalPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlayerA, setSelectedPlayerA] = useState<string>('')
  const [selectedPlayerB, setSelectedPlayerB] = useState<string>('')
  const [stats, setStats] = useState<HeadToHeadStats | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [hasInitialExpand, setHasInitialExpand] = useState(false)

  // Load historical data when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setStats(null) // Reset stats when reopening
      Promise.all([loadAllHistoricalMatches(), getHistoricalPlayers()])
        .then(([matches, players]) => {
          setHistoricalMatches(matches)
          setHistoricalPlayers(players)
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('Failed to load historical data:', error)
          setIsLoading(false)
        })
    }
  }, [isOpen])

  // Combine current and historical data (always, for consistent hook order)
  // Use Set to deduplicate matches by ID
  const allMatchesMap = new Map<string, Match>()
  const allPlayersMap = new Map<string, Player>()

  // Add current matches and players
  currentMatches.forEach((m) => allMatchesMap.set(m.id, m))
  currentPlayers.forEach((p) => allPlayersMap.set(p.id, p))

  // Add historical matches and players (will override if duplicate IDs)
  historicalMatches.forEach((m) => allMatchesMap.set(m.id, m))
  historicalPlayers.forEach((p) => allPlayersMap.set(p.id, p))

  const allMatches = Array.from(allMatchesMap.values())
  const allPlayers = Array.from(allPlayersMap.values())
  const uniqueNames = getUniquePlayerNames(allPlayers)
  const playedMatches = allMatches.filter((m) => m.scoreA !== null && m.scoreB !== null)
  const playedPairsCount = getPlayedPairsCountByName(playedMatches, allPlayers)

  const handleCompare = () => {
    if (!selectedPlayerA || !selectedPlayerB || selectedPlayerA === selectedPlayerB) {
      return
    }
    setHasInitialExpand(false)
    const result = calculateHeadToHeadByName(selectedPlayerA, selectedPlayerB, playedMatches, allPlayers)
    setStats(result)
  }

  const matchTypeStats = stats ? getMatchTypeStats(stats) : null

  // Group head-to-head matches by date for accordion
  const getDateKey = (match: Match) => {
    const ts = match.updated_at || match.created_at
    return ts ? ts.split('T')[0] : new Date().toISOString().split('T')[0]
  }
  const formatMatchTime = (isoString: string | undefined) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  const formatDateLabel = (dateKey: string) => {
    const d = new Date(dateKey + 'T12:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateKey === today.toISOString().split('T')[0]) return 'Today'
    if (dateKey === yesterday.toISOString().split('T')[0]) return 'Yesterday'
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const matchesByDate = new Map<string, NonNullable<typeof stats>['matches']>()
  if (stats?.matches) {
    for (const md of stats.matches) {
      const key = getDateKey(md.match)
      if (!matchesByDate.has(key)) matchesByDate.set(key, [])
      matchesByDate.get(key)!.push(md)
    }
  }
  const dateKeys = Array.from(matchesByDate.keys()).sort((a, b) => b.localeCompare(a))

  useEffect(() => {
    if (stats && dateKeys.length > 0 && !hasInitialExpand) {
      setExpandedDates(new Set([dateKeys[0]]))
      setHasInitialExpand(true)
    }
  }, [stats?.totalMatches, dateKeys.join(','), hasInitialExpand])

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const stageLabels: Record<string, string> = {
    play_in: 'Play-in',
    semi: 'Semi-finals',
    final: 'Final',
    third_place: '3rd Place',
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-card bg-white dark:bg-gray-800 shadow-xl flex flex-col border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Head-to-Head History</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Player Selection */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Player 1
                </label>
                <select
                  value={selectedPlayerA}
                  onChange={(e) => setSelectedPlayerA(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:border-neobank-lime focus:outline-none transition-colors disabled:opacity-50"
                >
                  <option value="">Select Player 1</option>
                  {uniqueNames.map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Player 2
                </label>
                <select
                  value={selectedPlayerB}
                  onChange={(e) => setSelectedPlayerB(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:border-neobank-lime focus:outline-none transition-colors disabled:opacity-50"
                >
                  <option value="">Select Player 2</option>
                  {uniqueNames.map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCompare}
              disabled={isLoading || !selectedPlayerA || !selectedPlayerB || selectedPlayerA === selectedPlayerB}
              className="w-full rounded-button bg-neobank-lime px-6 py-3 font-semibold text-white hover:bg-neobank-lime-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? 'Loading...' : 'Compare Players'}
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-neobank-lime"></div>
            </div>
          )}

          {/* Stats Display */}
          {stats && stats.totalMatches > 0 ? (
            <div className="space-y-6">
              {/* Overall Stats */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-card p-6 border border-gray-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {stats.playerAName} vs {stats.playerBName}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.playerAWins}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stats.playerAName} Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.draws}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Draws</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.playerBWins}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stats.playerBName} Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalMatches}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Matches</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-center">
                  <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Goals: {stats.playerAName} {stats.playerAGoals} - {stats.playerBGoals} {stats.playerBName}
                  </div>
                </div>
              </div>

              {/* Match Type Breakdown */}
              {matchTypeStats && (
                <div className="space-y-4">
                  {/* Group Stage */}
                  {matchTypeStats.group.matches > 0 && (
                    <div className="bg-white dark:bg-gray-700/50 rounded-card p-4 border border-gray-200 dark:border-gray-600">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Group Stage</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Matches:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{matchTypeStats.group.matches}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Wins:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {stats.playerAName} {matchTypeStats.group.playerAWins} - {matchTypeStats.group.playerBWins} {stats.playerBName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Goals:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {matchTypeStats.group.playerAGoals} - {matchTypeStats.group.playerBGoals}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Knockout Stage */}
                  {matchTypeStats.knockout.matches > 0 && (
                    <div className="bg-white dark:bg-gray-700/50 rounded-card p-4 border border-gray-200 dark:border-gray-600">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Knockout Stage</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Matches:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{matchTypeStats.knockout.matches}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Wins:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {stats.playerAName} {matchTypeStats.knockout.playerAWins} - {matchTypeStats.knockout.playerBWins} {stats.playerBName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Goals:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {matchTypeStats.knockout.playerAGoals} - {matchTypeStats.knockout.playerBGoals}
                          </span>
                        </div>
                      </div>
                      {Object.keys(matchTypeStats.knockout.stages).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Stages: </span>
                          {Object.entries(matchTypeStats.knockout.stages).map(([stage, count]) => (
                            <span key={stage} className="text-xs font-medium text-gray-700 dark:text-gray-300 mr-2">
                              {stageLabels[stage] || stage}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Golden Goal */}
                  {matchTypeStats.golden_goal.matches > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-card p-4 border border-amber-200 dark:border-amber-800">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Golden Goal Playoffs</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Matches:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{matchTypeStats.golden_goal.matches}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Wins:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {stats.playerAName} {matchTypeStats.golden_goal.playerAWins} - {matchTypeStats.golden_goal.playerBWins} {stats.playerBName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Goals:</span>{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {matchTypeStats.golden_goal.playerAGoals} - {matchTypeStats.golden_goal.playerBGoals}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Match History - grouped by date in accordions */}
              <div className="bg-white dark:bg-gray-700/50 rounded-card p-4 border border-gray-200 dark:border-gray-600">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Match History</h4>
                <div className="space-y-2">
                  {dateKeys.map((dateKey) => {
                    const matches = matchesByDate.get(dateKey) ?? []
                    const isExpanded = expandedDates.has(dateKey)
                    return (
                      <div
                        key={dateKey}
                        className="rounded-card border border-gray-200 dark:border-gray-600 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleDate(dateKey)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left"
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
                          <div className="border-t border-gray-200 dark:border-gray-600 divide-y divide-gray-200 dark:divide-gray-600">
                            {matches.map((matchDetail) => {
                              const { match, matchType, stage, roundIndex } = matchDetail
                              const isPlayerAFirst = match.playerAId === stats.playerAId
                              const scoreA = isPlayerAFirst ? match.scoreA! : match.scoreB!
                              const scoreB = isPlayerAFirst ? match.scoreB! : match.scoreA!
                              const playerAName = isPlayerAFirst ? matchDetail.playerA.name : matchDetail.playerB.name
                              const playerBName = isPlayerAFirst ? matchDetail.playerB.name : matchDetail.playerA.name

                              return (
                                <div
                                  key={match.id}
                                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                                >
                                  <div className="flex-1 min-w-[200px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900 dark:text-gray-100">{playerAName}</span>
                                      <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                        {scoreA} - {scoreB}
                                      </span>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100">{playerBName}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0">
                                      <span>
                                        {matchType === 'group' && `Round ${roundIndex + 1}`}
                                        {matchType === 'knockout' && stage && `${stageLabels[stage]} (Round ${roundIndex + 1})`}
                                        {matchType === 'golden_goal' && 'Golden Goal Playoff'}
                                      </span>
                                      {(match.updated_at || match.created_at) && (
                                        <span>{formatMatchTime(match.updated_at || match.created_at)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {matchType === 'group' && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                        Group
                                      </span>
                                    )}
                                    {matchType === 'knockout' && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-neobank-lime/20 dark:bg-neobank-lime/30 text-neobank-lime">
                                        Knockout
                                      </span>
                                    )}
                                    {matchType === 'golden_goal' && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                        Golden Goal
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : stats && stats.totalMatches === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No matches found between {stats.playerAName} and {stats.playerBName}
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Select two players to compare their head-to-head record
              </p>
              {allPlayers.length === 0 && !isLoading && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                  No players found. Make sure you have completed at least one match.
                </p>
              )}
              {allPlayers.length > 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {uniqueNames.length} player{uniqueNames.length !== 1 ? 's' : ''} available
                  {playedPairsCount > 0 && ` • ${playedPairsCount} pair${playedPairsCount !== 1 ? 's' : ''} have played matches`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
