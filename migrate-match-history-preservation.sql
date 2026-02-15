-- Migration: Preserve match history even if players are deleted
-- This ensures head-to-head data is never lost
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the existing foreign key constraints that cascade delete matches
ALTER TABLE matches 
  DROP CONSTRAINT IF EXISTS matches_player_a_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_player_b_id_fkey;

-- Step 2: Recreate the foreign key constraints with RESTRICT
-- This prevents deleting players if they have matches, ensuring match history is preserved
ALTER TABLE matches
  ADD CONSTRAINT matches_player_a_id_fkey 
    FOREIGN KEY (player_a_id) REFERENCES players(id) ON DELETE RESTRICT,
  ADD CONSTRAINT matches_player_b_id_fkey 
    FOREIGN KEY (player_b_id) REFERENCES players(id) ON DELETE RESTRICT;

-- Note: ON DELETE RESTRICT prevents player deletion if they have matches
-- This ensures match history is never accidentally lost
-- Since we're preserving players anyway (not deleting them on reset), this adds an extra safety layer
