import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Match, Player, KnockoutResults, RoundElimination } from '../types'
import { generateRoundRobinSchedule } from '../lib/roundRobin'
import { computeStandings } from '../lib/standings'
import { getTiedPairs } from '../lib/tieBreak'
import { determineElimination } from '../lib/elimination'
import {
  loadTournamentState,
  loadAllHistoricalMatches,
  getHistoricalPlayers,
  getPlayersFromDatabase,
  addPlayerToDatabase,
  findSimilarPlayers,
  type AddPlayerResult,
  savePlayers,
  saveMatches,
  saveTournamentConfig,
  getActiveTournamentId,
  resetTournament as resetTournamentInDB,
  endTournament as endTournamentInDB,
  migrateFromLocalStorage,
} from '../lib/supabaseService'
import { calculateHeadToHeadByName, getWinPrediction, type WinPrediction } from '../lib/headToHead'

interface TournamentState {
  players: Player[]
  matches: Match[]
  /** Number of players to advance to knockout (configurable) */
  knockoutPlayerCount: number | null
  /** Qualified player ids (shuffled) when knockout stage has started */
  knockoutSeeds: string[] | null
  /** Track eliminations per round for odd number of players */
  roundEliminations: RoundElimination[]
  /** Track if we've attempted migration */
  migrationAttempted: boolean
}

type TournamentContextValue = {
  players: Player[]
  matches: Match[]
  availablePlayers: Player[]
  isLoading: boolean
  selectPlayer: (playerId: string) => void
  addPlayerToDatabase: (name: string) => Promise<AddPlayerResult>
  findSimilarPlayers: (name: string) => Promise<Player[]>
  refreshAvailablePlayers: () => Promise<void>
  removePlayer: (id: string) => void
  shufflePlayers: () => void
  loadSamplePlayers: () => void
  startTournament: () => void | Promise<void>
  setMatchScore: (matchId: string, scoreA: number, scoreB: number) => void | Promise<void>
  setMatchComment: (matchId: string, comment: string) => void
  resetTournament: (cityName: string) => Promise<void>
  endTournament: () => Promise<void>
  rematch: () => Promise<void>
  setKnockoutPlayerCount: (count: number) => void
  startKnockoutStage: () => void | Promise<void>
  advanceToFinalStage: () => void | Promise<void>
  fillFirstRoundWithSampleScores: () => void
  fillAllRoundsTillSeven: () => void
  fillKnockoutRound: (stage: 'play_in' | 'semi' | 'final' | 'third_place') => void
  standings: ReturnType<typeof computeStandings>
  knockoutResults: KnockoutResults | null
  addGoldenGoalMatchesForTies: () => void | Promise<void>
  knockoutPlayerCount: number | null
  knockoutSeeds: string[] | null
  roundEliminations: RoundElimination[]
  getMatchPrediction: (playerAName: string, playerBName: string) => WinPrediction | null
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

function makeId(): string {
  // Generate a UUID-like ID for Supabase compatibility
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState>({
    players: [],
    matches: [],
    knockoutPlayerCount: null,
    knockoutSeeds: null,
    roundEliminations: [],
    migrationAttempted: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [historicalMatches, setHistoricalMatches] = useState<Match[]>([])
  const [historicalPlayers, setHistoricalPlayers] = useState<Player[]>([])

  // Load initial state from Supabase
  useEffect(() => {
    let mounted = true
    async function initialize() {
      try {
        // Try to migrate from localStorage first (only once)
        const migrationKey = 'fc26-migration-complete'
        const hasMigrated = localStorage.getItem(migrationKey)
        if (!hasMigrated) {
          await migrateFromLocalStorage()
          localStorage.setItem(migrationKey, 'true')
        }

        // Load tournament state, historical matches, and historical players in parallel
        const [loadedState, historical, histPlayers] = await Promise.all([
          loadTournamentState(),
          loadAllHistoricalMatches(),
          getHistoricalPlayers(),
        ])
        const finalPlayers = histPlayers
        if (mounted) {
          setState({
            ...loadedState,
            migrationAttempted: true,
          })
          setHistoricalMatches(historical)
          setHistoricalPlayers(finalPlayers)
        }
      } catch (error) {
        console.error('Failed to initialize tournament state:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initialize()
    return () => {
      mounted = false
    }
  }, []) // Only run once on mount

  // Save to Supabase whenever state changes (debounced)
  useEffect(() => {
    if (isLoading) return

    // IMPORTANT: Don't save if arrays are empty - this prevents deletion of historical data
    // When tournament ends, endTournament() explicitly saves with preserveExisting=true
    // After that, we don't want the auto-save to delete everything
    const isEmpty = state.players.length === 0 && state.matches.length === 0
    if (isEmpty) {
      console.log('Skipping auto-save: state is empty (tournament ended or not started)')
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        await Promise.all([
          savePlayers(state.players),
          saveMatches(state.matches),
          saveTournamentConfig(
            state.knockoutPlayerCount,
            state.knockoutSeeds,
            state.roundEliminations
          ),
        ])
      } catch (error) {
        console.error('Failed to save tournament state:', error)
      }
    }, 500) // Debounce by 500ms

    return () => clearTimeout(timeoutId)
  }, [state.players, state.matches, state.knockoutPlayerCount, state.knockoutSeeds, state.roundEliminations, isLoading])

  const selectPlayer = useCallback((playerId: string) => {
    const player = historicalPlayers.find((p) => p.id === playerId)
    if (!player) return
    setState((s) => {
      if (s.players.some((p) => p.id === playerId)) return s
      return { ...s, players: [...s.players, player] }
    })
  }, [historicalPlayers])

  const addPlayerToDatabaseCb = useCallback(async (name: string): Promise<AddPlayerResult> => {
    const result = await addPlayerToDatabase(name)
    if (result) {
      const { player } = result
      setHistoricalPlayers((prev) => {
        if (prev.some((p) => p.id === player.id || p.name.toLowerCase() === player.name.toLowerCase())) return prev
        return [...prev, player]
      })
    }
    return result
  }, [])

  const refreshAvailablePlayers = useCallback(async () => {
    const players = await getHistoricalPlayers()
    setHistoricalPlayers(players)
  }, [])

  const removePlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      matches: [],
      knockoutSeeds: null,
      knockoutPlayerCount: null,
      roundEliminations: [],
    }))
  }, [])

  const shufflePlayers = useCallback(() => {
    setState((s) => {
      const list = [...s.players]
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
      return { ...s, players: list }
    })
  }, [])

  const loadSamplePlayers = useCallback(async () => {
    const allPlayers = await getPlayersFromDatabase()
    setState((s) => ({ ...s, players: allPlayers, matches: [] }))
  }, [])

  const startTournament = useCallback(async () => {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return
    const idPrefix = `${tournamentId}-${Date.now()}-`
    setState((s) => {
      if (s.players.length < 2) return s
      const schedule = generateRoundRobinSchedule(s.players)
      const matches: Match[] = schedule.map((m) => ({
        id: `${idPrefix}m-${makeId()}`,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
        roundIndex: m.roundIndex,
        scoreA: null,
        scoreB: null,
        status: 'pending',
      }))
      return { ...s, matches, knockoutSeeds: null, roundEliminations: [] }
    })
  }, [])

  const setMatchScore = useCallback(async (matchId: string, scoreA: number, scoreB: number) => {
    const tournamentId = await getActiveTournamentId()
    const idPrefix = tournamentId ? `${tournamentId}-${Date.now()}-` : ''
    setState((s) => {
      const match = s.matches.find((m) => m.id === matchId)
      if (!match) return s
      
      // Check if this is a group stage match (not knockout)
      const isGroupStageMatch = !match.stage && match.roundIndex >= 0
      if (match.isGoldenGoal) {
        if (scoreA + scoreB !== 1 || (scoreA !== 0 && scoreA !== 1)) return s
        const sa = scoreA >= 1 ? 1 : 0
        const sb = scoreB >= 1 ? 1 : 0
        return {
          ...s,
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, scoreA: sa, scoreB: sb, status: 'golden_goal' as const } : m
          ),
        }
      }
      let next = {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId ? { ...m, scoreA, scoreB, status: 'played' as const } : m
        ),
      }
      
      // Group stage elimination logic (for odd number of players)
      // Check if we started with odd number of players - if so, eliminate 1 per round
      if (isGroupStageMatch && s.players.length % 2 === 1) {
        const roundIndex = match.roundIndex
        const roundMatches = next.matches.filter(
          (m) => m.roundIndex === roundIndex && !m.stage && !m.isGoldenGoal
        )
        const roundComplete = roundMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
        
        if (roundComplete) {
          // Get players eliminated before this round
          const eliminatedBeforeRound = new Set(
            s.roundEliminations.filter((e) => e.roundIndex < roundIndex).map((e) => e.eliminatedPlayerId)
          )
          // Active players at the start of this round
          const activePlayersAtRoundStart = s.players.filter((p) => !eliminatedBeforeRound.has(p.id))
          
          // Only eliminate if we started with odd number AND haven't eliminated this round yet
          const alreadyEliminatedThisRound = s.roundEliminations.some((e) => e.roundIndex === roundIndex)
          
          if (!alreadyEliminatedThisRound && activePlayersAtRoundStart.length > 1) {
            const elimination = determineElimination(s.players, next.matches, roundIndex, eliminatedBeforeRound)
            if (elimination) {
              next = {
                ...next,
                roundEliminations: [
                  ...s.roundEliminations,
                  {
                    roundIndex,
                    eliminatedPlayerId: elimination.playerId,
                    reason: elimination.reason === 'bye' ? 'bye' : 'worst_performance',
                  },
                ],
              }
            }
          }
        }
      }
      
      // Knockout: create next round matches when current round is completed
      if (match.stage === 'play_in' && s.knockoutSeeds && s.knockoutPlayerCount) {
        const playInMatches = next.matches.filter((m) => m.stage === 'play_in')
        const allPlayInPlayed = playInMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
        const hasSemi = next.matches.some((m) => m.stage === 'semi')
        const hasFinal = next.matches.some((m) => m.stage === 'final')
        
        if (allPlayInPlayed) {
          // Get play-in winners
          const playInWinners = playInMatches.map((m) => 
            m.scoreA! > m.scoreB! ? m.playerAId : m.playerBId
          )
          
          if (s.knockoutPlayerCount === 3 && !hasFinal) {
            // 3 players: Play-in winner (2nd vs 3rd) plays 1st seed in final
            const [s0] = s.knockoutSeeds
            next = {
              ...next,
              matches: [
                ...next.matches,
                { id: `${idPrefix}ko-final-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
              ],
            }
          } else if (s.knockoutPlayerCount === 5 && !hasSemi) {
            // 5 players: 1 play-in winner joins top 3 for semi-finals
            const [s0, s1, s2] = s.knockoutSeeds
            if (playInWinners.length === 1) {
              next = {
                ...next,
                matches: [
                  ...next.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          } else if (s.knockoutPlayerCount === 6) {
            // 6 players: Special structure
            // Round 1: 5th vs 6th → Winner plays 4th in Round 2
            // After Round 2: Winner joins top 3 for semi-finals
            const playedPlayerIds = new Set(
              playInMatches.flatMap((m) => [m.playerAId, m.playerBId])
            )
            const allBottomPlayers = s.knockoutSeeds.slice(3) // 4th, 5th, 6th
            const remainingPlayers = allBottomPlayers.filter((id) => !playedPlayerIds.has(id))
            
            if (playInWinners.length === 1 && remainingPlayers.length === 1) {
              // Round 1 complete (5th vs 6th), now winner plays 4th
              const [, , , s3] = s.knockoutSeeds // s3 is 4th place
              next = {
                ...next,
                matches: [
                  ...next.matches,
                  { id: `${idPrefix}ko-playin-${makeId()}`, playerAId: s3, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'play_in' as const },
                ],
              }
            } else if (playInWinners.length === 1 && remainingPlayers.length === 0) {
              // Round 2 complete (winner vs 4th), now create semi-finals
              const [s0, s1, s2] = s.knockoutSeeds
              next = {
                ...next,
                matches: [
                  ...next.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          } else if (s.knockoutPlayerCount >= 7) {
            // 7+ players: Need multiple play-in rounds
            // If we have more winners than expected, create next round of play-in
            const bottomCount = s.knockoutPlayerCount - 3
            if (bottomCount > 2 && playInWinners.length > 1) {
              // Check if there are players who didn't play yet (odd number case)
              const playedPlayerIds = new Set(
                playInMatches.flatMap((m) => [m.playerAId, m.playerBId])
              )
              const allBottomPlayers = s.knockoutSeeds.slice(3)
              const remainingPlayers = allBottomPlayers.filter((id) => !playedPlayerIds.has(id))
              
              // Create next round: winners + remaining players
              const nextRoundPlayers = [...playInWinners, ...remainingPlayers]
              
              if (nextRoundPlayers.length > 1) {
                // Pair them up for next play-in round
                const nextRoundMatches: Match[] = []
                for (let i = 0; i < nextRoundPlayers.length - 1; i += 2) {
                  const idx1 = i
                  const idx2 = i + 1
                  if (idx2 < nextRoundPlayers.length) {
                    nextRoundMatches.push({
                      id: `${idPrefix}ko-playin-${makeId()}`,
                      playerAId: nextRoundPlayers[idx1],
                      playerBId: nextRoundPlayers[idx2],
                      roundIndex: -10,
                      scoreA: null,
                      scoreB: null,
                      status: 'pending',
                      stage: 'play_in',
                    })
                  }
                }
                
                if (nextRoundMatches.length > 0) {
                  next = {
                    ...next,
                    matches: [...next.matches, ...nextRoundMatches],
                  }
                } else if (nextRoundPlayers.length === 1) {
                  // We have our final play-in winner, create semi-finals
                  const [s0, s1, s2] = s.knockoutSeeds
                  next = {
                    ...next,
                    matches: [
                      ...next.matches,
                      { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: nextRoundPlayers[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                      { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                    ],
                  }
                }
              } else if (nextRoundPlayers.length === 1) {
                // Single winner, create semi-finals
                const [s0, s1, s2] = s.knockoutSeeds
                next = {
                  ...next,
                  matches: [
                    ...next.matches,
                    { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: nextRoundPlayers[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                    { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  ],
                }
              }
            } else if (playInWinners.length === 1 && bottomCount === 2) {
              // 5 players case (shouldn't reach here but handle it)
              const [s0, s1, s2] = s.knockoutSeeds
              next = {
                ...next,
                matches: [
                  ...next.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          }
        }
      }
      if (match.stage === 'semi' && s.knockoutSeeds) {
        const semis = next.matches.filter((m) => m.stage === 'semi')
        const bothPlayed = semis.every((m) => m.scoreA !== null && m.scoreB !== null)
        const hasFinal = next.matches.some((m) => m.stage === 'final')
        if (bothPlayed && !hasFinal && semis.length >= 2) {
          const winner1 = (semis[0]!.scoreA! > semis[0]!.scoreB!) ? semis[0]!.playerAId : semis[0]!.playerBId
          const loser1 = (semis[0]!.scoreA! > semis[0]!.scoreB!) ? semis[0]!.playerBId : semis[0]!.playerAId
          const winner2 = (semis[1]!.scoreA! > semis[1]!.scoreB!) ? semis[1]!.playerAId : semis[1]!.playerBId
          const loser2 = (semis[1]!.scoreA! > semis[1]!.scoreB!) ? semis[1]!.playerBId : semis[1]!.playerAId
          next = {
            ...next,
            matches: [
              ...next.matches,
              { id: `${idPrefix}ko-final-${makeId()}`, playerAId: winner1, playerBId: winner2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
              { id: `${idPrefix}ko-third-${makeId()}`, playerAId: loser1, playerBId: loser2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'third_place' as const },
            ],
          }
        }
      }
      return next
    })
  }, [])

  const setMatchComment = useCallback((matchId: string, comment: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId ? { ...m, comment: comment.trim() || undefined } : m
      ),
    }))
  }, [])

  const resetTournament = useCallback(async (cityName: string) => {
    await resetTournamentInDB(cityName)
    setState((s) => ({ 
      ...s, 
      players: [],
      matches: [], 
      knockoutSeeds: null, 
      knockoutPlayerCount: null, 
      roundEliminations: [] 
    }))
  }, [])

  const endTournament = useCallback(async () => {
    // IMPORTANT: Save current state to database before ending tournament
    // This ensures all matches and players are persisted for head-to-head history
    // We save the CURRENT state (before clearing) to preserve everything
    const currentPlayers = [...state.players]
    const currentMatches = [...state.matches]
    
    try {
      console.log('Saving tournament state before ending:', {
        players: currentPlayers.length,
        matches: currentMatches.length,
        completedMatches: currentMatches.filter(m => m.scoreA !== null && m.scoreB !== null).length
      })
      
      await Promise.all([
        savePlayers(currentPlayers, true), // preserveExisting = true to keep all players
        saveMatches(currentMatches, true), // preserveExisting = true to keep all matches
        saveTournamentConfig(
          state.knockoutPlayerCount,
          state.knockoutSeeds,
          state.roundEliminations
        ),
      ])
      console.log('Tournament state saved successfully before ending')
      
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      console.error('Failed to save tournament state before ending:', error)
    }
    
    await endTournamentInDB()
    setState((s) => ({ 
      ...s, 
      players: [],
      matches: [], 
      knockoutSeeds: null, 
      knockoutPlayerCount: null, 
      roundEliminations: [] 
    }))
  }, [state.players, state.matches, state.knockoutPlayerCount, state.knockoutSeeds, state.roundEliminations])

  const rematch = useCallback(async () => {
    const currentPlayers = [...state.players]
    const currentMatches = [...state.matches]
    try {
      await Promise.all([
        savePlayers(currentPlayers, true),
        saveMatches(currentMatches, true),
        saveTournamentConfig(
          state.knockoutPlayerCount,
          state.knockoutSeeds,
          state.roundEliminations
        ),
      ])
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {
      console.error('Failed to save before rematch:', error)
    }
    await endTournamentInDB()
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return
    const idPrefix = `${tournamentId}-${Date.now()}-`
    setState((s) => {
      if (s.players.length < 2) return s
      const schedule = generateRoundRobinSchedule(s.players)
      const matches: Match[] = schedule.map((m) => ({
        id: `${idPrefix}m-${makeId()}`,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
        roundIndex: m.roundIndex,
        scoreA: null,
        scoreB: null,
        status: 'pending',
      }))
      return {
        ...s,
        matches,
        knockoutSeeds: null,
        knockoutPlayerCount: null,
        roundEliminations: [],
      }
    })
  }, [state.players, state.matches, state.knockoutPlayerCount, state.knockoutSeeds, state.roundEliminations])

  const setKnockoutPlayerCount = useCallback((count: number) => {
    setState((s) => {
      if (count < 2 || count > s.players.length) return s
      return { ...s, knockoutPlayerCount: count, knockoutSeeds: null }
    })
  }, [])

  const startKnockoutStage = useCallback(async () => {
    const tournamentId = await getActiveTournamentId()
    const idPrefix = tournamentId ? `${tournamentId}-${Date.now()}-` : ''
    setState((s) => {
      if (!s.knockoutPlayerCount || s.knockoutPlayerCount < 2) return s
      const groupStandings = computeStandings(s.players, s.matches.filter((m) => !m.stage))
      const qualified = groupStandings.slice(0, s.knockoutPlayerCount).map((r) => r.playerId)
      if (qualified.length < s.knockoutPlayerCount) return s
      
      const matchesToAdd: Match[] = []
      let seeds: string[] = []
      
      // Determine knockout structure based on number of players
      if (s.knockoutPlayerCount === 2) {
        // Direct final - shuffle both players
        seeds = [...qualified]
        for (let i = seeds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[seeds[i], seeds[j]] = [seeds[j], seeds[i]]
        }
        matchesToAdd.push({
          id: `${idPrefix}ko-final-${makeId()}`,
          playerAId: seeds[0],
          playerBId: seeds[1],
          roundIndex: -11,
          scoreA: null,
          scoreB: null,
          status: 'pending',
          stage: 'final',
        })
      } else if (s.knockoutPlayerCount === 3) {
        // Play-in: 2nd vs 3rd, winner plays 1st in final
        // Keep 1st safe, shuffle 2nd and 3rd
        seeds = [qualified[0], qualified[1], qualified[2]]
        // Shuffle positions 1 and 2 (2nd and 3rd)
        if (Math.random() > 0.5) {
          ;[seeds[1], seeds[2]] = [seeds[2], seeds[1]]
        }
        matchesToAdd.push({
          id: `${idPrefix}ko-playin-${makeId()}`,
          playerAId: seeds[1],
          playerBId: seeds[2],
          roundIndex: -10,
          scoreA: null,
          scoreB: null,
          status: 'pending',
          stage: 'play_in',
        })
      } else if (s.knockoutPlayerCount === 4) {
        // Semi-finals: Random pairings (2 games)
        seeds = [...qualified]
        const indices = [0, 1, 2, 3]
        // Shuffle indices
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }
        // Apply shuffle to seeds
        const shuffledSeeds = indices.map((idx) => seeds[idx])
        seeds = shuffledSeeds
        
        // Pair up: first two vs last two
        matchesToAdd.push(
          {
            id: `${idPrefix}ko-semi-${makeId()}`,
            playerAId: seeds[0],
            playerBId: seeds[1],
            roundIndex: -10,
            scoreA: null,
            scoreB: null,
            status: 'pending',
            stage: 'semi',
          },
          {
            id: `${idPrefix}ko-semi-${makeId()}`,
            playerAId: seeds[2],
            playerBId: seeds[3],
            roundIndex: -10,
            scoreA: null,
            scoreB: null,
            status: 'pending',
            stage: 'semi',
          }
        )
      } else {
        // 5+ players: Top 3 are safe, only bottom players play play-in
        // For 5: Top 3 safe, Play-in (4th vs 5th), then semis (1st vs play-in winner, 2nd vs 3rd)
        // For 6: Top 3 safe, Play-in Round 1 (4th vs 5th), Play-in Round 2 (winner vs 6th), then semis
        // For 7+: Multiple play-in rounds to reduce to 4 players total
        
        // Keep top 3 in their ranked order (safe)
        const top3 = qualified.slice(0, 3)
        const bottomPlayers = qualified.slice(3)
        
        // Only shuffle bottom players (if any)
        const shuffledBottom = [...bottomPlayers]
        for (let i = shuffledBottom.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffledBottom[i], shuffledBottom[j]] = [shuffledBottom[j], shuffledBottom[i]]
        }
        
        // Combine: top 3 (safe) + shuffled bottom players
        seeds = [...top3, ...shuffledBottom]
        
        // Create play-in matches for bottom players
        // We need to reduce bottom players to 1 (to have 4 total for semi-finals)
        const bottomCount = bottomPlayers.length
        
        if (bottomCount === 1) {
          // Only 4 players total - no play-in needed, go straight to semis
          // This shouldn't happen as we're in the else block, but handle it
        } else if (bottomCount === 2) {
          // 5 players: 4th vs 5th
          matchesToAdd.push({
            id: `${idPrefix}ko-playin-${makeId()}`,
            playerAId: seeds[3],
            playerBId: seeds[4],
            roundIndex: -10,
            scoreA: null,
            scoreB: null,
            status: 'pending',
            stage: 'play_in',
          })
        } else if (bottomCount === 3) {
          // 6 players: Special structure
          // Round 1: 5th vs 6th (bottom 2 play first)
          // Round 2: Winner vs 4th (winner plays middle player)
          // Only 1 player advances from bottom 3 to join top 3
          matchesToAdd.push({
            id: `${idPrefix}ko-playin-${makeId()}`,
            playerAId: seeds[4], // 5th place
            playerBId: seeds[5], // 6th place
            roundIndex: -10,
            scoreA: null,
            scoreB: null,
            status: 'pending',
            stage: 'play_in',
          })
        } else {
          // 7+ players: Create initial play-in matches
          // Pair up bottom players: 4th vs 5th, 6th vs 7th, etc.
          const startIdx = 3
          let matchIndex = 0
          for (let i = 0; i < bottomCount - 1; i += 2) {
            const idx1 = startIdx + i
            const idx2 = startIdx + i + 1
            if (idx2 < seeds.length) {
              matchesToAdd.push({
                id: `${idPrefix}ko-playin-${makeId()}`,
                playerAId: seeds[idx1],
                playerBId: seeds[idx2],
                roundIndex: -10,
                scoreA: null,
                scoreB: null,
                status: 'pending',
                stage: 'play_in',
              })
              matchIndex++
            } else if (idx1 < seeds.length) {
              // Odd number of bottom players - last one gets bye to next round
              // This will be handled in the play-in completion logic
            }
          }
        }
      }
      
      return {
        ...s,
        knockoutSeeds: seeds,
        matches: [...s.matches, ...matchesToAdd],
      }
    })
  }, [])

  // Sample scores for testing. Cycle through for many matches.
  const SAMPLE_SCORES: [number, number][] = [
    [2, 1], [0, 0], [3, 1], [1, 2], [2, 2], [1, 0], [3, 0], [0, 1], [2, 0], [1, 3], [0, 2], [1, 1], [3, 2], [2, 3],
  ]

  const fillFirstRoundWithSampleScores = useCallback(() => {
    setState((s) => {
      const firstRoundMatches = s.matches
        .filter((m) => !m.isGoldenGoal && m.roundIndex === 0)
        .sort((a, b) => a.id.localeCompare(b.id))
      if (firstRoundMatches.length === 0) return s
      return {
        ...s,
        matches: s.matches.map((m) => {
          if (m.isGoldenGoal || m.roundIndex !== 0) return m
          const idx = firstRoundMatches.findIndex((r) => r.id === m.id)
          const [scoreA, scoreB] = SAMPLE_SCORES[idx % SAMPLE_SCORES.length] ?? [0, 0]
          return { ...m, scoreA, scoreB, status: 'played' as const }
        }),
      }
    })
  }, [])

  const fillAllRoundsTillSeven = useCallback(() => {
    setState((s) => {
      const roundRobin = s.matches
        .filter((m) => !m.isGoldenGoal && m.roundIndex >= 0 && m.roundIndex <= 6)
        .sort((a, b) => a.roundIndex - b.roundIndex || a.id.localeCompare(b.id))
      if (roundRobin.length === 0) return s
      return {
        ...s,
        matches: s.matches.map((m) => {
          if (m.isGoldenGoal || m.roundIndex < 0 || m.roundIndex > 6) return m
          const idx = roundRobin.findIndex((r) => r.id === m.id)
          const [scoreA, scoreB] = SAMPLE_SCORES[idx % SAMPLE_SCORES.length] ?? [0, 0]
          return { ...m, scoreA, scoreB, status: 'played' as const }
        }),
      }
    })
  }, [])

  const advanceToFinalStage = useCallback(async () => {
    const tournamentId = await getActiveTournamentId()
    const idPrefix = tournamentId ? `${tournamentId}-${Date.now()}-` : ''
    setState((s) => {
      if (!s.knockoutSeeds || !s.knockoutPlayerCount) return s
      
      // Check if play-in is complete and needs to advance
      const playInMatches = s.matches.filter((m) => m.stage === 'play_in')
      const allPlayInPlayed = playInMatches.length > 0 && playInMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
      const hasSemi = s.matches.some((m) => m.stage === 'semi')
      const hasFinalMatch = s.matches.some((m) => m.stage === 'final')
      
      // Handle 3-player knockout: play-in winner vs 1st in final
      if (allPlayInPlayed && !hasFinalMatch && s.knockoutPlayerCount === 3) {
        const playInWinners = playInMatches.map((m) => 
          m.scoreA! > m.scoreB! ? m.playerAId : m.playerBId
        )
        if (playInWinners.length === 1) {
          const [s0] = s.knockoutSeeds
          return {
            ...s,
            matches: [
              ...s.matches,
              { id: `${idPrefix}ko-final-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
            ],
          }
        }
      }
      
      // Handle 5+ player knockout: advance to semi-finals
      if (allPlayInPlayed && !hasSemi && s.knockoutPlayerCount >= 5) {
          // Get play-in winners from current round
          const playInWinners = playInMatches.map((m) => 
            m.scoreA! > m.scoreB! ? m.playerAId : m.playerBId
          )
          
          if (s.knockoutPlayerCount === 5) {
            // 5 players: 1 play-in winner joins top 3
            const [s0, s1, s2] = s.knockoutSeeds
            if (playInWinners.length === 1) {
              return {
                ...s,
                matches: [
                  ...s.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          } else if (s.knockoutPlayerCount === 6) {
            // 6 players: Special structure
            // Round 1: 5th vs 6th → Winner plays 4th in Round 2
            const playedPlayerIds = new Set(
              playInMatches.flatMap((m) => [m.playerAId, m.playerBId])
            )
            const allBottomPlayers = s.knockoutSeeds.slice(3) // 4th, 5th, 6th
            const remainingPlayers = allBottomPlayers.filter((id) => !playedPlayerIds.has(id))
            
            if (playInMatches.length === 1 && playInWinners.length === 1 && remainingPlayers.length === 1) {
              // Round 1 complete (5th vs 6th), now winner plays 4th
              const [, , , s3] = s.knockoutSeeds // s3 is 4th place
              return {
                ...s,
                matches: [
                  ...s.matches,
                  { id: `${idPrefix}ko-playin-${makeId()}`, playerAId: s3, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'play_in' as const },
                ],
              }
            } else if (playInMatches.length === 2 && remainingPlayers.length === 0) {
              // Round 2 complete (winner vs 4th), now create semi-finals
              // The round 2 match is the one that includes 4th seed (s3)
              const [, , , s3] = s.knockoutSeeds
              const finalPlayInMatch = playInMatches.find(
                (m) => m.playerAId === s3 || m.playerBId === s3
              ) ?? playInMatches[playInMatches.length - 1]
              const finalWinner = finalPlayInMatch.scoreA! > finalPlayInMatch.scoreB! 
                ? finalPlayInMatch.playerAId 
                : finalPlayInMatch.playerBId
              
              const [s0, s1, s2] = s.knockoutSeeds
              return {
                ...s,
                matches: [
                  ...s.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: finalWinner, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          } else if (s.knockoutPlayerCount >= 7) {
            // 7+ players: Multiple play-in rounds until 1 winner remains
            const playedPlayerIds = new Set(
              playInMatches.flatMap((m) => [m.playerAId, m.playerBId])
            )
            const allBottomPlayers = s.knockoutSeeds.slice(3)
            const remainingPlayers = allBottomPlayers.filter((id) => !playedPlayerIds.has(id))
            const nextRoundPlayers = [...playInWinners, ...remainingPlayers]
            
            if (nextRoundPlayers.length > 1) {
              // Need another play-in round
              const nextRoundMatches: Match[] = []
              for (let i = 0; i < nextRoundPlayers.length - 1; i += 2) {
                const idx1 = i
                const idx2 = i + 1
                if (idx2 < nextRoundPlayers.length) {
                  nextRoundMatches.push({
                    id: `${idPrefix}ko-playin-${makeId()}`,
                    playerAId: nextRoundPlayers[idx1],
                    playerBId: nextRoundPlayers[idx2],
                    roundIndex: -10,
                    scoreA: null,
                    scoreB: null,
                    status: 'pending',
                    stage: 'play_in',
                  })
                }
              }
              
              if (nextRoundMatches.length > 0) {
                return {
                  ...s,
                  matches: [...s.matches, ...nextRoundMatches],
                }
              } else if (nextRoundPlayers.length === 1) {
                // Final winner, create semi-finals
                const [s0, s1, s2] = s.knockoutSeeds
                return {
                  ...s,
                  matches: [
                    ...s.matches,
                    { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: nextRoundPlayers[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                    { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  ],
                }
              }
            } else if (nextRoundPlayers.length === 1) {
              // Single winner, create semi-finals
              const [s0, s1, s2] = s.knockoutSeeds
              return {
                ...s,
                matches: [
                  ...s.matches,
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s0, playerBId: nextRoundPlayers[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: `${idPrefix}ko-semi-${makeId()}`, playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                ],
              }
            }
          }
        }
      
      // Check if semi-finals are complete and need to advance to final (for 4+ players)
      const semis = s.matches.filter((m) => m.stage === 'semi')
      const bothPlayed = semis.length >= 2 && semis.every((m) => m.scoreA !== null && m.scoreB !== null)
      const hasFinal = s.matches.some((m) => m.stage === 'final')
      
      if (bothPlayed && !hasFinal) {
        // Identify winners and losers from semi-finals
        const winner1 = (semis[0]!.scoreA! > semis[0]!.scoreB!) ? semis[0]!.playerAId : semis[0]!.playerBId
        const loser1 = (semis[0]!.scoreA! > semis[0]!.scoreB!) ? semis[0]!.playerBId : semis[0]!.playerAId
        const winner2 = (semis[1]!.scoreA! > semis[1]!.scoreB!) ? semis[1]!.playerAId : semis[1]!.playerBId
        const loser2 = (semis[1]!.scoreA! > semis[1]!.scoreB!) ? semis[1]!.playerBId : semis[1]!.playerAId
        
        return {
          ...s,
          matches: [
            ...s.matches,
            { id: `${idPrefix}ko-final-${makeId()}`, playerAId: winner1, playerBId: winner2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
            { id: `${idPrefix}ko-third-${makeId()}`, playerAId: loser1, playerBId: loser2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'third_place' as const },
          ],
        }
      }
      
      return s
    })
  }, [])

  const fillKnockoutRound = useCallback((stage: 'play_in' | 'semi' | 'final' | 'third_place') => {
    setState((s) => {
      const roundMatches = s.matches
        .filter((m) => m.stage === stage && (m.scoreA === null || m.scoreB === null))
        .sort((a, b) => a.id.localeCompare(b.id))
      if (roundMatches.length === 0) return s
      
      return {
        ...s,
        matches: s.matches.map((m) => {
          if (m.stage !== stage || (m.scoreA !== null && m.scoreB !== null)) return m
          const idx = roundMatches.findIndex((r) => r.id === m.id)
          // For knockout, use varied scores but ensure there's a winner (no draws)
          const scores: [number, number][] = [
            [2, 1], [1, 0], [3, 1], [2, 0], [1, 2], [0, 1], [3, 2], [2, 3],
          ]
          const [scoreA, scoreB] = scores[idx % scores.length] ?? [1, 0]
          return { ...m, scoreA, scoreB, status: 'played' as const }
        }),
      }
    })
  }, [])

  const standings = useMemo(
    () => computeStandings(state.players, state.matches),
    [state.players, state.matches]
  )

  const getMatchPrediction = useCallback(
    (playerAName: string, playerBName: string): WinPrediction | null => {
      const played = state.matches.filter((m) => m.scoreA !== null && m.scoreB !== null)
      const byId = new Map<string, Match>()
      historicalMatches.forEach((m) => byId.set(m.id, m))
      played.forEach((m) => byId.set(m.id, m))
      const allMatches = Array.from(byId.values())
      const allPlayers = [...state.players]
      const playerIds = new Set(state.players.map((p) => p.id))
      historicalPlayers.forEach((p) => {
        if (!playerIds.has(p.id)) {
          allPlayers.push(p)
          playerIds.add(p.id)
        }
      })
      const stats = calculateHeadToHeadByName(playerAName, playerBName, allMatches, allPlayers)
      return getWinPrediction(stats)
    },
    [historicalMatches, historicalPlayers, state.matches, state.players]
  )

  const knockoutResults = useMemo((): KnockoutResults | null => {
    const finalMatch = state.matches.find((m) => m.stage === 'final')
    if (!finalMatch || finalMatch.scoreA === null || finalMatch.scoreB === null) return null
    
    const firstId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.playerAId : finalMatch.playerBId
    const secondId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.playerBId : finalMatch.playerAId
    
    // Check if there's a 3rd place match (only for 4+ player knockouts)
    const thirdMatch = state.matches.find((m) => m.stage === 'third_place')
    if (thirdMatch && thirdMatch.scoreA !== null && thirdMatch.scoreB !== null) {
      const thirdId = thirdMatch.scoreA > thirdMatch.scoreB ? thirdMatch.playerAId : thirdMatch.playerBId
      return { firstId, secondId, thirdId }
    }
    
    // For 2-player knockout, there's no 3rd place match
    return { firstId, secondId, thirdId: null }
  }, [state.matches])

  const addGoldenGoalMatchesForTies = useCallback(async () => {
    const tournamentId = await getActiveTournamentId()
    const idPrefix = tournamentId ? `${tournamentId}-${Date.now()}-` : ''
    const tiedPairs = getTiedPairs(standings)
    if (tiedPairs.length === 0) return
    const existingPairs = new Set(
      state.matches
        .filter((m) => m.isGoldenGoal)
        .map((m) => [m.playerAId, m.playerBId].sort().join('-'))
    )
    const toAdd: Match[] = []
    for (const [playerAId, playerBId] of tiedPairs) {
      const key = [playerAId, playerBId].sort().join('-')
      if (existingPairs.has(key)) continue
      existingPairs.add(key)
      toAdd.push({
        id: `${idPrefix}golden-${makeId()}`,
        playerAId,
        playerBId,
        roundIndex: -1,
        scoreA: null,
        scoreB: null,
        status: 'golden_goal',
        isGoldenGoal: true,
      })
    }
    if (toAdd.length > 0) {
      setState((s) => ({ ...s, matches: [...s.matches, ...toAdd] }))
    }
  }, [standings, state.matches])

  const value = useMemo<TournamentContextValue>(
    () => ({
      players: state.players,
      matches: state.matches,
      availablePlayers: historicalPlayers,
      isLoading,
      selectPlayer,
      addPlayerToDatabase: addPlayerToDatabaseCb,
      findSimilarPlayers,
      refreshAvailablePlayers,
      removePlayer,
      shufflePlayers,
      loadSamplePlayers,
      startTournament,
      setMatchScore,
      setMatchComment,
      resetTournament,
      endTournament,
      rematch,
      setKnockoutPlayerCount,
      startKnockoutStage,
      advanceToFinalStage,
      fillFirstRoundWithSampleScores,
      fillAllRoundsTillSeven,
      fillKnockoutRound,
      standings,
      knockoutResults,
      addGoldenGoalMatchesForTies,
      knockoutPlayerCount: state.knockoutPlayerCount,
      knockoutSeeds: state.knockoutSeeds,
      roundEliminations: state.roundEliminations,
      getMatchPrediction,
    }),
    [
      state.players,
      state.matches,
      state.knockoutPlayerCount,
      state.knockoutSeeds,
      historicalPlayers,
      isLoading,
      getMatchPrediction,
      selectPlayer,
      addPlayerToDatabaseCb,
      findSimilarPlayers,
      refreshAvailablePlayers,
      removePlayer,
      shufflePlayers,
      loadSamplePlayers,
      startTournament,
      setMatchScore,
      setMatchComment,
      resetTournament,
      endTournament,
      rematch,
      setKnockoutPlayerCount,
      startKnockoutStage,
      advanceToFinalStage,
      fillFirstRoundWithSampleScores,
      fillAllRoundsTillSeven,
      fillKnockoutRound,
      standings,
      knockoutResults,
      addGoldenGoalMatchesForTies,
    ]
  )

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider')
  return ctx
}
