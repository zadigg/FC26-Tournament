import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Match, Player, KnockoutResults } from '../types'
import { generateRoundRobinSchedule } from '../lib/roundRobin'
import { computeStandings } from '../lib/standings'
import { getTiedPairs } from '../lib/tieBreak'

const STORAGE_KEY = 'fc26-tournament'

interface TournamentState {
  players: Player[]
  matches: Match[]
  /** Number of players to advance to knockout (configurable) */
  knockoutPlayerCount: number | null
  /** Qualified player ids (shuffled) when knockout stage has started */
  knockoutSeeds: string[] | null
}

function loadState(): TournamentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { players: [], matches: [], knockoutPlayerCount: null, knockoutSeeds: null }
    const data = JSON.parse(raw) as TournamentState
    return {
      players: Array.isArray(data.players) ? data.players : [],
      matches: Array.isArray(data.matches) ? data.matches : [],
      knockoutPlayerCount: typeof data.knockoutPlayerCount === 'number' && data.knockoutPlayerCount >= 2 ? data.knockoutPlayerCount : null,
      knockoutSeeds: Array.isArray(data.knockoutSeeds) && data.knockoutSeeds.length > 0 ? data.knockoutSeeds : null,
    }
  } catch {
    return { players: [], matches: [], knockoutPlayerCount: null, knockoutSeeds: null }
  }
}

function saveState(state: TournamentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (_) {}
}

const SAMPLE_PLAYER_NAMES = ['abel', 'sime', 'teda', 'gedi', 'alazar', 'beki', 'haftish', 'minalu']

type TournamentContextValue = {
  players: Player[]
  matches: Match[]
  addPlayer: (name: string) => void
  removePlayer: (id: string) => void
  shufflePlayers: () => void
  loadSamplePlayers: () => void
  startTournament: () => void
  setMatchScore: (matchId: string, scoreA: number, scoreB: number) => void
  resetTournament: () => void
  setKnockoutPlayerCount: (count: number) => void
  startKnockoutStage: () => void
  advanceToFinalStage: () => void
  fillFirstRoundWithSampleScores: () => void
  fillAllRoundsTillSeven: () => void
  fillKnockoutRound: (stage: 'play_in' | 'semi' | 'final' | 'third_place') => void
  standings: ReturnType<typeof computeStandings>
  knockoutResults: KnockoutResults | null
  addGoldenGoalMatchesForTies: () => void
  knockoutPlayerCount: number | null
  knockoutSeeds: string[] | null
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

function makeId() {
  return Math.random().toString(36).slice(2, 11)
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const addPlayer = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((s) => ({
      ...s,
      players: [...s.players, { id: makeId(), name: trimmed }],
    }))
  }, [])

  const removePlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      matches: [],
      knockoutSeeds: null,
      knockoutPlayerCount: null,
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

  const loadSamplePlayers = useCallback(() => {
    setState((s) => ({
      ...s,
      players: SAMPLE_PLAYER_NAMES.map((name) => ({ id: makeId(), name })),
      matches: [],
    }))
  }, [])

  const startTournament = useCallback(() => {
    setState((s) => {
      if (s.players.length < 2) return s
      const schedule = generateRoundRobinSchedule(s.players)
      const matches: Match[] = schedule.map((m, i) => ({
        id: `m-${i}-${m.playerAId}-${m.playerBId}`,
        playerAId: m.playerAId,
        playerBId: m.playerBId,
        roundIndex: m.roundIndex,
        scoreA: null,
        scoreB: null,
        status: 'pending',
      }))
      return { ...s, matches, knockoutSeeds: null }
    })
  }, [])

  const setMatchScore = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    setState((s) => {
      const match = s.matches.find((m) => m.id === matchId)
      if (!match) return s
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
      // Knockout: create next round matches when current round is completed
      if (match.stage === 'play_in' && s.knockoutSeeds && s.knockoutPlayerCount) {
        const playInMatches = next.matches.filter((m) => m.stage === 'play_in')
        const allPlayInPlayed = playInMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
        const hasSemi = next.matches.some((m) => m.stage === 'semi')
        
        if (allPlayInPlayed && !hasSemi) {
          // Get play-in winners
          const playInWinners = playInMatches.map((m) => 
            m.scoreA! > m.scoreB! ? m.playerAId : m.playerBId
          )
          
          if (s.knockoutPlayerCount === 3) {
            // Play-in winner plays 1st seed in final
            const [s0] = s.knockoutSeeds
            next = {
              ...next,
              matches: [
                ...next.matches,
                { id: 'ko-final', playerAId: s0, playerBId: playInWinners[0], roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
              ],
            }
          } else if (s.knockoutPlayerCount >= 4) {
            // Create semi-finals
            const [s0, s1, s2] = s.knockoutSeeds
            if (playInWinners.length === 1) {
              // Standard 5-player format: 1st vs play-in winner, 2nd vs 3rd
              next = {
                ...next,
                matches: [
                  ...next.matches,
                  { id: 'ko-semi1', playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
                  { id: 'ko-semi2', playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
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
              { id: 'ko-final', playerAId: winner1, playerBId: winner2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
              { id: 'ko-third', playerAId: loser1, playerBId: loser2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'third_place' as const },
            ],
          }
        }
      }
      return next
    })
  }, [])

  const resetTournament = useCallback(() => {
    setState((s) => ({ ...s, matches: [], knockoutSeeds: null, knockoutPlayerCount: null }))
  }, [])

  const setKnockoutPlayerCount = useCallback((count: number) => {
    setState((s) => {
      if (count < 2 || count > s.players.length) return s
      return { ...s, knockoutPlayerCount: count, knockoutSeeds: null }
    })
  }, [])

  const startKnockoutStage = useCallback(() => {
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
          id: 'ko-final',
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
          id: 'ko-playin',
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
            id: 'ko-semi1',
            playerAId: seeds[0],
            playerBId: seeds[1],
            roundIndex: -10,
            scoreA: null,
            scoreB: null,
            status: 'pending',
            stage: 'semi',
          },
          {
            id: 'ko-semi2',
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
        // For 6+: Similar logic with more play-in matches
        
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
        
        // Create play-in matches for bottom players only
        const playInCount = s.knockoutPlayerCount - 4
        if (playInCount > 0) {
          // For 5 players: match seeds[3] vs seeds[4] (4th vs 5th)
          // For 6 players: match seeds[3] vs seeds[4] (4th vs 5th), seeds[5] gets bye
          // For 7+ players: multiple play-in matches
          const startIdx = 3 // Start from 4th seed (after top 3)
          for (let i = 0; i < playInCount; i++) {
            const idx1 = startIdx + i * 2
            const idx2 = startIdx + i * 2 + 1
            if (idx2 < seeds.length) {
              matchesToAdd.push({
                id: `ko-playin-${i}`,
                playerAId: seeds[idx1],
                playerBId: seeds[idx2],
                roundIndex: -10,
                scoreA: null,
                scoreB: null,
                status: 'pending',
                stage: 'play_in',
              })
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

  const advanceToFinalStage = useCallback(() => {
    setState((s) => {
      if (!s.knockoutSeeds || !s.knockoutPlayerCount) return s
      
      // Check if play-in is complete and needs to advance to semi-finals (for 5+ players)
      const playInMatches = s.matches.filter((m) => m.stage === 'play_in')
      const allPlayInPlayed = playInMatches.length > 0 && playInMatches.every((m) => m.scoreA !== null && m.scoreB !== null)
      const hasSemi = s.matches.some((m) => m.stage === 'semi')
      
      if (allPlayInPlayed && !hasSemi && s.knockoutPlayerCount >= 5) {
        // Get play-in winners
        const playInWinners = playInMatches.map((m) => 
          m.scoreA! > m.scoreB! ? m.playerAId : m.playerBId
        )
        
        if (playInWinners.length === 1) {
          // Standard 5-player format: 1st vs play-in winner, 2nd vs 3rd
          const [s0, s1, s2] = s.knockoutSeeds
          return {
            ...s,
            matches: [
              ...s.matches,
              { id: 'ko-semi1', playerAId: s0, playerBId: playInWinners[0], roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
              { id: 'ko-semi2', playerAId: s1, playerBId: s2, roundIndex: -10, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'semi' as const },
            ],
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
            { id: 'ko-final', playerAId: winner1, playerBId: winner2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'final' as const },
            { id: 'ko-third', playerAId: loser1, playerBId: loser2, roundIndex: -11, scoreA: null, scoreB: null, status: 'pending' as const, stage: 'third_place' as const },
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

  const knockoutResults = useMemo((): KnockoutResults | null => {
    const finalMatch = state.matches.find((m) => m.stage === 'final')
    const thirdMatch = state.matches.find((m) => m.stage === 'third_place')
    if (!finalMatch || !thirdMatch || finalMatch.scoreA === null || finalMatch.scoreB === null || thirdMatch.scoreA === null || thirdMatch.scoreB === null) return null
    const firstId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.playerAId : finalMatch.playerBId
    const secondId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.playerBId : finalMatch.playerAId
    const thirdId = thirdMatch.scoreA > thirdMatch.scoreB ? thirdMatch.playerAId : thirdMatch.playerBId
    return { firstId, secondId, thirdId }
  }, [state.matches])

  const addGoldenGoalMatchesForTies = useCallback(() => {
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
        id: `golden-${key}`,
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
      addPlayer,
      removePlayer,
      shufflePlayers,
      loadSamplePlayers,
      startTournament,
      setMatchScore,
      resetTournament,
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
    }),
    [
      state.players,
      state.matches,
      state.knockoutPlayerCount,
      state.knockoutSeeds,
      addPlayer,
      removePlayer,
      shufflePlayers,
      loadSamplePlayers,
      startTournament,
      setMatchScore,
      resetTournament,
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
