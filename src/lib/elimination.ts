import type { Player, Match } from '../types'

/**
 * Determine which player sits out (has bye) in a given round for odd number of players
 */
export function getPlayerWithBye(
  players: Player[],
  roundIndex: number,
  eliminatedPlayerIds: Set<string>
): Player | null {
  const activePlayers = players.filter((p) => !eliminatedPlayerIds.has(p.id))
  if (activePlayers.length % 2 === 0) return null // Even number, no bye needed
  
  const ids = activePlayers.map((p) => p.id)
  const rotating = [...ids, '__BYE__']
  const count = rotating.length
  
  // Rotate to the correct round position
  for (let r = 0; r < roundIndex; r++) {
    const fixed = rotating[0]
    const rest = rotating.slice(1)
    rest.unshift(rest.pop()!)
    rotating.length = 0
    rotating.push(fixed, ...rest)
  }
  
  // Find the player paired with BYE
  for (let i = 0; i < count / 2; i++) {
    const a = rotating[i]
    const b = rotating[count - 1 - i]
    if (a === '__BYE__' && b !== '__BYE__') {
      return activePlayers.find((p) => p.id === b) || null
    }
    if (b === '__BYE__' && a !== '__BYE__') {
      return activePlayers.find((p) => p.id === a) || null
    }
  }
  
  return null
}

/**
 * Determine who should be eliminated after a round completes
 * For odd numbers: eliminate the player with bye OR worst performer
 */
export function determineElimination(
  players: Player[],
  matches: Match[],
  roundIndex: number,
  eliminatedPlayerIds: Set<string>
): { playerId: string; reason: 'bye' | 'worst_performance' } | null {
  const activePlayers = players.filter((p) => !eliminatedPlayerIds.has(p.id))
  
  // If we started with odd number, eliminate 1 per round until only 1 remains
  // If we started with even number, don't eliminate (standard round-robin)
  const startedWithOdd = players.length % 2 === 1
  
  // Only eliminate if we started with odd AND have more than 1 active player
  if (!startedWithOdd || activePlayers.length <= 1) return null
  
  // Get player with bye for this round
  const byePlayer = getPlayerWithBye(players, roundIndex, eliminatedPlayerIds)
  
  if (byePlayer) {
    // Check if this player has already been eliminated
    if (!eliminatedPlayerIds.has(byePlayer.id)) {
      return { playerId: byePlayer.id, reason: 'bye' }
    }
  }
  
  // If bye player already eliminated or no bye, eliminate worst performer
  const roundMatches = matches.filter(
    (m) => m.roundIndex === roundIndex && !m.stage && !m.isGoldenGoal
  )
  
  // Calculate standings for this round only
  const roundStandings: Array<{ playerId: string; points: number; goalsFor: number; goalDifference: number }> = []
  
  for (const player of activePlayers) {
    let points = 0
    let goalsFor = 0
    let goalsAgainst = 0
    
    for (const m of roundMatches) {
      if (m.scoreA === null || m.scoreB === null) continue
      if (m.playerAId === player.id) {
        goalsFor += m.scoreA
        goalsAgainst += m.scoreB
        if (m.scoreA > m.scoreB) points += 3
        else if (m.scoreA === m.scoreB) points += 1
      } else if (m.playerBId === player.id) {
        goalsFor += m.scoreB
        goalsAgainst += m.scoreA
        if (m.scoreB > m.scoreA) points += 3
        else if (m.scoreA === m.scoreB) points += 1
      }
    }
    
    roundStandings.push({
      playerId: player.id,
      points,
      goalsFor,
      goalDifference: goalsFor - goalsAgainst,
    })
  }
  
  // Sort by points (ascending), then goal difference (ascending), then goals for (ascending)
  roundStandings.sort((a, b) => {
    if (a.points !== b.points) return a.points - b.points
    if (a.goalDifference !== b.goalDifference) return a.goalDifference - b.goalDifference
    return a.goalsFor - b.goalsFor
  })
  
  // Eliminate the worst performer (lowest points, then worst goal difference)
  const worstPlayer = roundStandings[0]
  if (worstPlayer && !eliminatedPlayerIds.has(worstPlayer.playerId)) {
    return { playerId: worstPlayer.playerId, reason: 'worst_performance' }
  }
  
  return null
}
