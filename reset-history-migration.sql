-- Migration script for reset_history table
-- This handles both cases: tournaments.id as UUID or TEXT

-- First, check if reset_history table already exists and drop it if needed
DROP TABLE IF EXISTS reset_history CASCADE;

-- Create reset_history table without foreign key constraint
-- We'll store tournament_id as TEXT to match our app's ID format
CREATE TABLE reset_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tournament_id TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(10, 2),
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_reset_history_tournament_id ON reset_history(tournament_id);
CREATE INDEX idx_reset_history_reset_at ON reset_history(reset_at DESC);

-- Enable RLS for reset_history
ALTER TABLE reset_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (public access)
CREATE POLICY "Allow all operations on reset_history" ON reset_history FOR ALL USING (true) WITH CHECK (true);
