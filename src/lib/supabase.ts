import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface DatabasePlayer {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface DatabaseTournament {
  id: string
  knockout_player_count: number | null
  knockout_seeds: string[] | null
  round_eliminations: Array<{
    roundIndex: number
    eliminatedPlayerId: string
    reason: 'lowest_points' | 'bye' | 'worst_performance'
  }>
  created_at?: string
  updated_at?: string
}

export interface DatabaseMatch {
  id: string
  tournament_id: string
  player_a_id: string
  player_b_id: string
  round_index: number
  score_a: number | null
  score_b: number | null
  status: 'pending' | 'played' | 'golden_goal'
  is_golden_goal: boolean
  stage: 'play_in' | 'semi' | 'final' | 'third_place' | null
  created_at?: string
  updated_at?: string
}

export interface DatabaseResetHistory {
  id: string
  tournament_id: string
  latitude: number | null
  longitude: number | null
  location_accuracy: number | null
  reset_at: string
}
