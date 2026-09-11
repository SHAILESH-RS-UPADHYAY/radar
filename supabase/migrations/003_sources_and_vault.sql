-- ============================
-- RADAR — More sources + server-side Vault
-- ============================
-- Run this in Supabase SQL Editor after 001 and 002. Safe to re-run.

-- 1. Companies: allow every adapter and the job-board sources
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy',
  'workday', 'amazon',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas',
  'custom'
));

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_category_check;
ALTER TABLE companies ADD CONSTRAINT companies_category_check CHECK (category IN ('MNC', 'Growth', 'Startup', 'Board'));

-- 2. Jobs: richer details
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer TEXT;       -- real employer for job-board sources
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_hash TEXT;   -- skip re-embedding unchanged jobs
ALTER TABLE jobs ALTER COLUMN salary_currency DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC);

-- 3. Match scores become the Vault / tracker (replaces browser localStorage)
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE match_scores DROP CONSTRAINT IF EXISTS match_scores_status_check;
ALTER TABLE match_scores ADD CONSTRAINT match_scores_status_check
  CHECK (status IN ('new', 'saved', 'applied', 'dismissed'));
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS auto_saved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_match_user_status ON match_scores(user_id, status);

-- 4. Per-user automation settings
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vault_min_score INT NOT NULL DEFAULT 70
  CHECK (vault_min_score BETWEEN 0 AND 100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auto_vault BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_matched_at TIMESTAMPTZ;

-- 5. Pipeline run log
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  trigger TEXT,
  companies_scraped INT DEFAULT 0,
  companies_failed INT DEFAULT 0,
  jobs_found INT DEFAULT 0,
  jobs_embedded INT DEFAULT 0,
  users_matched INT DEFAULT 0,
  vaulted INT DEFAULT 0,
  notes JSONB
);
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
