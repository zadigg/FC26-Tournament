export interface Player {
  id: string
  name: string
}

export type MatchStatus = 'pending' | 'played' | 'golden_goal'

export type KnockoutStage = 'play_in' | 'semi' | 'final' | 'third_place'

export interface Match {
  id: string
  playerAId: string
  playerBId: string
  roundIndex: number
  scoreA: number | null
  scoreB: number | null
  status: MatchStatus
  isGoldenGoal?: boolean
  /** Set for knockout phase only; group stage matches have no stage */
  stage?: KnockoutStage
}

export interface KnockoutResults {
  firstId: string
  secondId: string
  thirdId: string | null // null for 2-player knockout (no 3rd place match)
}

export interface StandingsRow {
  playerId: string
  playerName: string
  rank: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  isTied?: boolean
}

export interface RoundElimination {
  roundIndex: number
  eliminatedPlayerId: string
  reason: 'lowest_points' | 'bye' | 'worst_performance'
}
