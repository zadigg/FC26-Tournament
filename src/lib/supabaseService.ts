import { supabase } from './supabase'
import type { Player, Match, RoundElimination } from '../types'

const ACTIVE_TOURNAMENT_ID_KEY = 'fc26-active-tournament-id'

/**
 * Get or create active tournament ID
 * Prefers localStorage (e.g. after end/reset we set a new tournament) so we don't reuse old tournaments.
 * Falls back to most recent match/tournament for sync across browsers.
 */
export async function getActiveTournamentId(): Promise<string | null> {
  // Check localStorage FIRST - after end/reset we create a new tournament and set it here
  // This ensures we use the new tournament instead of reusing the old one
  const storedId = localStorage.getItem(ACTIVE_TOURNAMENT_ID_KEY)
  if (storedId) {
    const { data } = await supabase.from('tournaments').select('id').eq('id', storedId).single()
    if (data) return storedId
  }

  // Find the tournament ID with the most recent match activity (for sync across browsers)
  const { data: recentMatch } = await supabase
    .from('matches')
    .select('tournament_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  
  if (recentMatch && recentMatch.tournament_id) {
    const activeId = recentMatch.tournament_id
    const { data } = await supabase.from('tournaments').select('id').eq('id', activeId).single()
    if (data) {
      localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, activeId)
      return activeId
    }
  }
  
  const { data: playersData } = await supabase.from('players').select('id').limit(1)
  if (playersData && playersData.length > 0) {
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
 * Load all historical matches from all tournaments
 */
export async function loadAllHistoricalMatches(): Promise<Match[]> {
  try {
    const { data: matchesData, error } = await supabase
      .from('matches')
      .select('*')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error loading historical matches:', error)
      return []
    }

    if (!matchesData) {
      console.log('No historical matches found in database')
      return []
    }

    console.log(`Loaded ${matchesData.length} historical matches from database`)

    return matchesData.map((m) => ({
      id: m.id,
      playerAId: m.player_a_id,
      playerBId: m.player_b_id,
      roundIndex: m.round_index,
      scoreA: m.score_a,
      scoreB: m.score_b,
      status: m.status as 'pending' | 'played' | 'golden_goal',
      isGoldenGoal: m.is_golden_goal,
      stage: m.stage as 'play_in' | 'semi' | 'final' | 'third_place' | undefined,
      created_at: m.created_at as string | undefined,
      updated_at: m.updated_at as string | undefined,
      comment: (m as { comment?: string }).comment ?? undefined,
    }))
  } catch (error) {
    console.error('Failed to load historical matches:', error)
    return []
  }
}

const SAMPLE_PLAYER_NAMES = ['abel', 'sime', 'teda', 'gedi', 'alazar', 'beki', 'haftish', 'minalu']

function makeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Seed sample players into the database if it's empty.
 * Runs on app init so new users have players to select from.
 */
export async function seedSamplePlayersIfEmpty(): Promise<void> {
  try {
    const { data: existing } = await supabase.from('players').select('id').limit(1)
    if (existing && existing.length > 0) return

    const toInsert = SAMPLE_PLAYER_NAMES.map((name) => ({
      id: makeId(),
      name,
    }))
    await supabase.from('players').insert(toInsert)
    console.log('Seeded sample players to database')
  } catch (error) {
    console.error('Failed to seed sample players:', error)
  }
}

export type AddPlayerResult = { player: Player; isNew: boolean } | null

/**
 * Add a new player to the database.
 * Returns { player, isNew } if successful, null if failed.
 * isNew is false when the player already existed.
 */
export async function addPlayerToDatabase(name: string): Promise<AddPlayerResult> {
  try {
    const trimmed = name.trim()
    if (!trimmed) return null
    const existing = await findPlayerByName(trimmed)
    if (existing) return { player: existing, isNew: false }

    const player: Player = { id: makeId(), name: trimmed }
    await supabase.from('players').insert({ id: player.id, name: player.name })
    return { player, isNew: true }
  } catch (error) {
    console.error('Failed to add player to database:', error)
    return null
  }
}

/**
 * Find players with similar names (one contains the other, case-insensitive).
 * Excludes exact matches. Used to warn about potential duplicates.
 */
export async function findSimilarPlayers(name: string): Promise<Player[]> {
  try {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return []
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .order('name')

    if (error || !data) return []
    return data
      .filter((p) => {
        const existing = p.name.toLowerCase()
        if (existing === trimmed) return false // exact match excluded
        return existing.includes(trimmed) || trimmed.includes(existing)
      })
      .map((p) => ({ id: p.id, name: p.name }))
  } catch {
    return []
  }
}

/**
 * Find an existing player by name (case-insensitive).
 * Returns the first match to reuse instead of creating duplicates.
 */
export async function findPlayerByName(name: string): Promise<Player | null> {
  try {
    const trimmed = name.trim()
    if (!trimmed) return null
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .ilike('name', trimmed)
      .limit(1)

    if (error || !data || data.length === 0) return null
    return { id: data[0].id, name: data[0].name }
  } catch {
    return null
  }
}

/**
 * Get all players from the players table only.
 * Does not add or infer any players - use for "Load all players" to avoid inserting placeholders.
 */
export async function getPlayersFromDatabase(): Promise<Player[]> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name')
      .order('created_at')

    if (error) {
      console.error('Error loading players from database:', error)
      return []
    }
    return (data || []).map((p) => ({ id: p.id, name: p.name }))
  } catch (error) {
    console.error('Failed to load players from database:', error)
    return []
  }
}

/**
 * Get unique player IDs and names from historical matches
 * Fetches all players that have ever played matches
 */
export async function getHistoricalPlayers(): Promise<Player[]> {
  try {
    // First, get all players from the players table (they should be preserved)
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at')

    if (playersError) {
      console.error('Error loading players:', playersError)
    }

    const playersMap = new Map<string, Player>()
    
    // Add players from players table
    if (playersData && playersData.length > 0) {
      console.log(`Loaded ${playersData.length} players from players table`)
      playersData.forEach((p) => {
        playersMap.set(p.id, {
          id: p.id,
          name: p.name,
        })
      })
    } else {
      console.log('No players found in players table')
    }

    // Also get unique player IDs from historical matches
    // This ensures we include players even if they were somehow deleted from players table
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('player_a_id, player_b_id')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)

    if (matchesError) {
      console.error('Error loading matches for player extraction:', matchesError)
    }

    if (matchesData && matchesData.length > 0) {
      console.log(`Found ${matchesData.length} matches for player extraction`)
      const playerIds = new Set<string>()
      for (const match of matchesData) {
        if (match.player_a_id) playerIds.add(match.player_a_id)
        if (match.player_b_id) playerIds.add(match.player_b_id)
      }

      console.log(`Extracted ${playerIds.size} unique player IDs from matches`)

      // For any player IDs from matches that don't have names, create placeholder entries
      for (const playerId of playerIds) {
        if (!playersMap.has(playerId)) {
          playersMap.set(playerId, {
            id: playerId,
            name: `Player ${playerId.slice(0, 8)}`, // Use ID as placeholder name
          })
        }
      }
    } else {
      console.log('No matches found for player extraction')
    }

    const result = Array.from(playersMap.values())
    console.log(`Returning ${result.length} total players (${playersData?.length || 0} from table + ${result.length - (playersData?.length || 0)} from matches)`)
    return result
  } catch (error) {
    console.error('Failed to load historical players:', error)
    return []
  }
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
      comment: (m as { comment?: string }).comment ?? undefined,
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
 * @param players - Array of players to save
 * @param preserveExisting - If true, don't delete players not in the list (for tournament end)
 */
export async function savePlayers(players: Player[], preserveExisting: boolean = false): Promise<void> {
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

    // Delete players that are no longer in the list (unless preserving for tournament end)
    // NEVER delete players who have played matches - preserve for match history
    if (!preserveExisting) {
      const currentIds = new Set(players.map((p) => p.id))
      const candidatesToDelete = (existingPlayers || []).filter((p) => !currentIds.has(p.id))
      if (candidatesToDelete.length > 0) {
        const { data: matchesWithPlayers } = await supabase
          .from('matches')
          .select('player_a_id, player_b_id')
        const playerIdsWithMatches = new Set<string>()
        ;(matchesWithPlayers || []).forEach((m) => {
          if (m.player_a_id) playerIdsWithMatches.add(m.player_a_id)
          if (m.player_b_id) playerIdsWithMatches.add(m.player_b_id)
        })
        const toDelete = candidatesToDelete.filter((p) => !playerIdsWithMatches.has(p.id))
        if (toDelete.length > 0) {
          await supabase.from('players').delete().in('id', toDelete.map((p) => p.id))
        }
      }
    }
  } catch (error) {
    console.error('Failed to save players:', error)
  }
}

/**
 * Save matches to Supabase
 * @param matches - Array of matches to save
 * @param preserveExisting - If true, don't delete matches not in the list (default true to preserve history)
 */
export async function saveMatches(matches: Match[], preserveExisting: boolean = true): Promise<void> {
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
      const { error: insertError } = await supabase.from('matches').insert(
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
          comment: m.comment || null,
        }))
      )
      if (insertError) {
        console.error('Failed to insert matches (possible duplicate IDs):', insertError)
      }
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
          comment: match.comment || null,
        })
        .eq('id', match.id)
    }

    // Never delete matches - always preserve for match history and head-to-head
    // (preserveExisting defaults to true; deletion would remove historical data)
    if (!preserveExisting) {
      const currentIds = new Set(matches.map((m) => m.id))
      const toDelete = (existingMatches || []).filter((m) => !currentIds.has(m.id))
      if (toDelete.length > 0) {
        await supabase.from('matches').delete().in('id', toDelete.map((m) => m.id))
      }
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
 * @param cityName - City name to record where the reset was performed (required)
 */
export async function resetTournament(cityName: string): Promise<void> {
  try {
    const tournamentId = await getActiveTournamentId()
    if (!tournamentId) return

    // Record reset history before resetting
    await supabase.from('reset_history').insert({
      tournament_id: tournamentId,
      city_name: cityName,
      // reset_at will be automatically set by DEFAULT NOW() in the database
    })

    // IMPORTANT: We preserve matches and players for historical head-to-head data
    // Instead of deleting matches and players, we just clear the tournament config
    // Matches remain in the database associated with their tournament_id
    // When a new tournament starts, it gets a new tournament_id, so old matches won't interfere
    // This allows head-to-head to work even after reset
    //
    // Previously deleted matches and players, but we preserve them now:
    // await supabase.from('matches').delete().eq('tournament_id', tournamentId)
    // await supabase.from('players').delete().neq('id', '')

    // Reset tournament config (but keep the tournament record and all its matches)
    await supabase
      .from('tournaments')
      .update({
        knockout_player_count: null,
        knockout_seeds: null,
        round_eliminations: [],
      })
      .eq('id', tournamentId)
    
    // Create a NEW tournament and set it as active - old tournament stays untouched
    // This preserves all matches and players for match history / head-to-head
    const { data: newTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        knockout_player_count: null,
        knockout_seeds: null,
        round_eliminations: [],
      })
      .select('id')
      .single()

    if (createError || !newTournament) {
      console.error('Failed to create new tournament after reset:', createError)
      localStorage.removeItem(ACTIVE_TOURNAMENT_ID_KEY)
      return
    }

    localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, newTournament.id)
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

/**
 * End tournament - archives current tournament and prepares for a new one
 * Creates a new empty tournament so old data is preserved for match history
 */
export async function endTournament(): Promise<void> {
  try {
    // Create a NEW tournament and set it as active - old tournament stays untouched
    // This preserves all matches and players for match history / head-to-head
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
      console.error('Failed to create new tournament after end:', error)
      localStorage.removeItem(ACTIVE_TOURNAMENT_ID_KEY)
      return
    }

    localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, newTournament.id)
  } catch (error) {
    console.error('Failed to end tournament:', error)
  }
}
