-- ============================
-- RADAR — AUTOPILOT: a daily queue of applications the extension fills, checks and (when you allow it) submits
-- ============================
-- Run after 009 in the Supabase SQL editor. Safe to re-run. Until it runs, the app works as before and /autopilot
-- says it needs this migration.

-- 1. Your autopilot settings (cities, daily target, pace, dry run, the consents you pre-approve). '{}' = defaults.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS autopilot JSONB NOT NULL DEFAULT '{}';

-- 2. One row per job per day: what the runner does with it, and why it stopped if it did.
CREATE TABLE IF NOT EXISTS apply_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES match_scores(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  rank INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'prepared', 'filling', 'ready', 'submitting', 'submitted', 'needs_you', 'skipped', 'failed'
  )),
  reason TEXT,
  -- The answers for the form (a FillPacket without the PDF, which stays in your browser).
  packet JSONB,
  tailored_id UUID REFERENCES tailored_resumes(id) ON DELETE SET NULL,
  form_url TEXT,
  ats_provider TEXT,
  attempts INT NOT NULL DEFAULT 0,
  prepared_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  -- How the employer confirmed it: { url, text, at }.
  confirmation JSONB,
  UNIQUE (user_id, match_id, run_date)
);
CREATE INDEX IF NOT EXISTS idx_apply_queue_day ON apply_queue(user_id, run_date, rank);
-- Server-side access only (service role), like every other user table.
ALTER TABLE apply_queue ENABLE ROW LEVEL SECURITY;
