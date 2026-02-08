DROP TABLE IF EXISTS reset_history CASCADE;

CREATE TABLE reset_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tournament_id TEXT NOT NULL,
  city_name TEXT,
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reset_history_tournament_id ON reset_history(tournament_id);
CREATE INDEX idx_reset_history_reset_at ON reset_history(reset_at DESC);

ALTER TABLE reset_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on reset_history" ON reset_history FOR ALL USING (true) WITH CHECK (true);