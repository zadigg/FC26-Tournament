-- Supabase Database Schema for Tournament App
-- Run this SQL in your Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, -- Use TEXT to support custom IDs from the app
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments table (stores tournament state)
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, -- Use TEXT with UUID generation
  knockout_player_count INTEGER,
  knockout_seeds TEXT[], -- Array of player IDs
  round_eliminations JSONB DEFAULT '[]'::jsonb, -- Array of RoundElimination objects
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  player_a_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  player_b_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  score_a INTEGER,
  score_b INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'played', 'golden_goal')),
  is_golden_goal BOOLEAN DEFAULT FALSE,
  stage TEXT CHECK (stage IN ('play_in', 'semi', 'final', 'third_place')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_a_id ON matches(player_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_b_id ON matches(player_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_round_index ON matches(round_index);
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);

-- Enable Row Level Security (RLS) - Allow all operations for now
-- You can restrict this later if you add authentication
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (public access)
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tournaments" ON tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reset history table (tracks who reset the tournament)
-- Note: tournament_id is TEXT to match our app's tournament IDs (which are stored as TEXT)
-- We don't use a foreign key constraint to avoid type mismatch issues
-- (tournaments.id might be UUID or TEXT depending on how it was created)
CREATE TABLE IF NOT EXISTS reset_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tournament_id TEXT NOT NULL, -- Store as TEXT to match our app's ID format
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(10, 2),
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for reset history queries
CREATE INDEX IF NOT EXISTS idx_reset_history_tournament_id ON reset_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_reset_history_reset_at ON reset_history(reset_at DESC);

-- Enable RLS for reset_history
ALTER TABLE reset_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (public access)
CREATE POLICY "Allow all operations on reset_history" ON reset_history FOR ALL USING (true) WITH CHECK (true);
