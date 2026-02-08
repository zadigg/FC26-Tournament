import type { Player, Match, StandingsRow } from '../types'

const POINTS_WIN = 3
const POINTS_DRAW = 1
const POINTS_LOSS = 0

export function computeStandings(players: Player[], matches: Match[]): StandingsRow[] {
  const byPlayer = new Map<string, { wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }>()

  for (const p of players) {
    byPlayer.set(p.id, { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 })
  }

  for (const m of matches) {
    if (m.stage) continue // only group stage for standings; knockout is separate
    if (m.scoreA === null || m.scoreB === null) continue
    const a = byPlayer.get(m.playerAId)
    const b = byPlayer.get(m.playerBId)
    if (!a || !b) continue

    a.goalsFor += m.scoreA
    a.goalsAgainst += m.scoreB
    b.goalsFor += m.scoreB
    b.goalsAgainst += m.scoreA

    if (m.isGoldenGoal) {
      if (m.scoreA > m.scoreB) {
        a.wins += 1
        b.losses += 1
      } else {
        b.wins += 1
        a.losses += 1
      }
    } else {
      if (m.scoreA > m.scoreB) {
        a.wins += 1
        b.losses += 1
      } else if (m.scoreA < m.scoreB) {
        b.wins += 1
        a.losses += 1
      } else {
        a.draws += 1
        b.draws += 1
      }
    }
  }

  const rows: StandingsRow[] = players.map((p) => {
    const s = byPlayer.get(p.id)!
    const points = s.wins * POINTS_WIN + s.draws * POINTS_DRAW + s.losses * POINTS_LOSS
    const played = s.wins + s.draws + s.losses
    return {
      playerId: p.id,
      playerName: p.name,
      rank: 0,
      played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalsFor - s.goalsAgainst,
      points,
    }
  })

  rows.sort((a, b) => {
    // Primary: Points (descending)
    if (b.points !== a.points) return b.points - a.points
    // Secondary: Goal Difference (descending)
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    // Tertiary: Goals For (descending)
    return b.goalsFor - a.goalsFor
  })

  let rank = 1
  for (let i = 0; i < rows.length; i++) {
    rows[i].rank = rank
    const next = rows[i + 1]
    // Players are tied if they have same points, goal difference, and goals for
    if (next && 
        next.points === rows[i].points && 
        next.goalDifference === rows[i].goalDifference && 
        next.goalsFor === rows[i].goalsFor) {
      rows[i].isTied = true
      next.isTied = true
    } else {
      rank = i + 2
    }
  }

  return rows
}
