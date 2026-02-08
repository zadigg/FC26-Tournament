import { supabase } from './supabase'
import type { Player, Match, RoundElimination } from '../types'

const ACTIVE_TOURNAMENT_ID_KEY = 'fc26-active-tournament-id'

/**
 * Get or create active tournament ID
 * Uses the most recent tournament with matches, or the most recent tournament if no matches exist
 * This ensures everyone sees the same active tournament
 */
async function getActiveTournamentId(): Promise<string | null> {
  // Strategy: Find the tournament with the most recent match activity
  // This ensures everyone sees the same active tournament
  
  // Find the tournament ID with the most recent match update
  const { data: recentMatch } = await supabase
    .from('matches')
    .select('tournament_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  
  if (recentMatch && recentMatch.tournament_id) {
    const activeId = recentMatch.tournament_id
    // Verify tournament still exists
    const { data } = await supabase.from('tournaments').select('id').eq('id', activeId).single()
    if (data) {
      localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, activeId)
      return activeId
    }
  }
  
  // If no matches exist, find the most recent tournament
  // Check if there are any players - if yes, use the most recent tournament
  const { data: playersData } = await supabase.from('players').select('id').limit(1)
  if (playersData && playersData.length > 0) {
    // There are players, so find the most recent tournament
    const { data: recentTournament } = await supabase
      .from('tournaments')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (recentTournament && recentTournament.id) {
      localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, recentTournament.id)
      return recentTournament.id
    }
  }
  
  // Check localStorage as fallback (for the person who started)
  const storedId = localStorage.getItem(ACTIVE_TOURNAMENT_ID_KEY)
  if (storedId) {
    // Verify it still exists
    const { data } = await supabase.from('tournaments').select('id').eq('id', storedId).single()
    if (data) return storedId
  }

  // Only create new tournament if truly no tournaments exist
  const { data: newTournament, error } = await supabase
    .from('tournaments')
    .insert({
      knockout_player_count: null,
      knockout_seeds: null,
      round_eliminations: [],
    })
    .select('id')
    .single()

  if (error || !newTournament) {
    console.error('Failed to create tournament:', error)
    return null
  }

  localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, newTournament.id)
  return newTournament.id
}

/**
 * Load all tournament data from Supabase
 */
export async function loadTournamentState(): Promise<{
  players: Player[]
  matches: Match[]
  knockoutPlayerCount: number | null
  knockoutSeeds: string[] | null
  roundEliminations: RoundElimination[]
}> {
  try {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) {
      return {
        players: [],
        matches: [],
        knockoutPlayerCount: null,
        knockoutSeeds: null,
        roundEliminations: [],
      }
    }

    // Load tournament config
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    // Load players
    const { data: playersData } = await supabase.from('players').select('*').order('created_at')

    // Load matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_index')

    const players: Player[] = (playersData || []).map((p) => ({
      id: p.id,
      name: p.name,
    }))

    const matches: Match[] = (matchesData || []).map((m) => ({
      id: m.id,
      playerAId: m.player_a_id,
      playerBId: m.player_b_id,
      roundIndex: m.round_index,
      scoreA: m.score_a,
      scoreB: m.score_b,
      status: m.status as 'pending' | 'played' | 'golden_goal',
      isGoldenGoal: m.is_golden_goal,
      stage: m.stage as 'play_in' | 'semi' | 'final' | 'third_place' | undefined,
    }))

    return {
      players,
      matches,
      knockoutPlayerCount: tournament?.knockout_player_count || null,
      knockoutSeeds: tournament?.knockout_seeds || null,
      roundEliminations: (tournament?.round_eliminations || []) as RoundElimination[],
    }
  } catch (error) {
    console.error('Failed to load tournament state:', error)
    return {
      players: [],
      matches: [],
      knockoutPlayerCount: null,
      knockoutSeeds: null,
      roundEliminations: [],
    }
  }
}

/**
 * Save players to Supabase
 */
export async function savePlayers(players: Player[]): Promise<void> {
  try {
    // Get existing players
    const { data: existingPlayers } = await supabase.from('players').select('id')

    const existingIds = new Set((existingPlayers || []).map((p) => p.id))

    // Insert new players
    const newPlayers = players.filter((p) => !existingIds.has(p.id))
    if (newPlayers.length > 0) {
      await supabase.from('players').insert(
        newPlayers.map((p) => ({
          id: p.id,
          name: p.name,
        }))
      )
    }

    // Update existing players (in case names changed)
    for (const player of players.filter((p) => existingIds.has(p.id))) {
      await supabase
        .from('players')
        .update({ name: player.name })
        .eq('id', player.id)
    }

    // Delete players that are no longer in the list
    const currentIds = new Set(players.map((p) => p.id))
    const toDelete = (existingPlayers || []).filter((p) => !currentIds.has(p.id))
    if (toDelete.length > 0) {
      await supabase.from('players').delete().in('id', toDelete.map((p) => p.id))
    }
  } catch (error) {
    console.error('Failed to save players:', error)
  }
}

/**
 * Save matches to Supabase
 */
export async function saveMatches(matches: Match[]): Promise<void> {
  try {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return

    // Get existing matches
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)

    const existingIds = new Set((existingMatches || []).map((m) => m.id))

    // Insert new matches
    const newMatches = matches.filter((m) => !existingIds.has(m.id))
    if (newMatches.length > 0) {
      await supabase.from('matches').insert(
        newMatches.map((m) => ({
          id: m.id,
          tournament_id: tournamentId,
          player_a_id: m.playerAId,
          player_b_id: m.playerBId,
          round_index: m.roundIndex,
          score_a: m.scoreA,
          score_b: m.scoreB,
          status: m.status,
          is_golden_goal: m.isGoldenGoal || false,
          stage: m.stage || null,
        }))
      )
    }

    // Update existing matches
    for (const match of matches.filter((m) => existingIds.has(m.id))) {
      await supabase
        .from('matches')
        .update({
          player_a_id: match.playerAId,
          player_b_id: match.playerBId,
          round_index: match.roundIndex,
          score_a: match.scoreA,
          score_b: match.scoreB,
          status: match.status,
          is_golden_goal: match.isGoldenGoal || false,
          stage: match.stage || null,
        })
        .eq('id', match.id)
    }

    // Delete matches that are no longer in the list
    const currentIds = new Set(matches.map((m) => m.id))
    const toDelete = (existingMatches || []).filter((m) => !currentIds.has(m.id))
    if (toDelete.length > 0) {
      await supabase.from('matches').delete().in('id', toDelete.map((m) => m.id))
    }
  } catch (error) {
    console.error('Failed to save matches:', error)
  }
}

/**
 * Save tournament config to Supabase
 */
export async function saveTournamentConfig(
  knockoutPlayerCount: number | null,
  knockoutSeeds: string[] | null,
  roundEliminations: RoundElimination[]
): Promise<void> {
  try {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return

    await supabase
      .from('tournaments')
      .update({
        knockout_player_count: knockoutPlayerCount,
        knockout_seeds: knockoutSeeds,
        round_eliminations: roundEliminations,
      })
      .eq('id', tournamentId)
  } catch (error) {
    console.error('Failed to save tournament config:', error)
  }
}

/**
 * Reset tournament (delete all matches, players, and reset config)
 * @param cityName - Optional city name to record where the reset was performed (required in production, optional for local dev)
 */
export async function resetTournament(cityName?: string): Promise<void> {
  try {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return

    // Record reset history before deleting (always record, even without city name)
    await supabase.from('reset_history').insert({
      tournament_id: tournamentId,
      city_name: cityName ?? null,
      // reset_at will be automatically set by DEFAULT NOW() in the database
    })

    // Delete all matches for this tournament
    await supabase.from('matches').delete().eq('tournament_id', tournamentId)

    // Delete all players
    await supabase.from('players').delete().neq('id', '') // Delete all players

    // Reset tournament config
    await supabase
      .from('tournaments')
      .update({
        knockout_player_count: null,
        knockout_seeds: null,
        round_eliminations: [],
      })
      .eq('id', tournamentId)
    
    // Clear the active tournament ID from localStorage so a new one can be created
    localStorage.removeItem(ACTIVE_TOURNAMENT_ID_KEY)
  } catch (error) {
    console.error('Failed to reset tournament:', error)
  }
}

/**
 * Get reset history - shows all resets across all tournaments
 * (Not filtered by active tournament since resets clear the active tournament)
 */
export async function getResetHistory() {
  try {
    const { data, error } = await supabase
      .from('reset_history')
      .select('*')
      .order('reset_at', { ascending: false })

    if (error) {
      console.error('Failed to load reset history:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to load reset history:', error)
    return []
  }
}

/**
 * Migrate data from localStorage to Supabase
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const stored = localStorage.getItem('fc26-tournament')
    if (!stored) return false

    const data = JSON.parse(stored)
    if (!data || (!data.players && !data.matches)) return false

    console.log('Migrating data from localStorage to Supabase...')

    // Migrate players
    if (data.players && Array.isArray(data.players) && data.players.length > 0) {
      await savePlayers(data.players)
    }

    // Migrate matches (will be saved when tournament config is saved)
    // Migrate tournament config
    if (data.knockoutPlayerCount || data.knockoutSeeds || data.roundEliminations) {
      await saveTournamentConfig(
        data.knockoutPlayerCount || null,
        data.knockoutSeeds || null,
        data.roundEliminations || []
      )
    }

    // If there are matches, save them
    if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
      await saveMatches(data.matches)
    }

    console.log('Migration complete!')
    return true
  } catch (error) {
    console.error('Migration failed:', error)
    return false
  }
}
