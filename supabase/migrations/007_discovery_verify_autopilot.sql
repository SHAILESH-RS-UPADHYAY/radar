-- ============================
-- RADAR — Startup discovery, posting verification, autopilot
-- ============================
-- Run after 006 in the Supabase SQL editor. Safe to re-run.

-- 1. Teamtailor career sites (public /jobs.json feed) join the scrapeable providers.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy', 'teamtailor',
  'workday', 'amazon',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'themuse', 'adzuna', 'jooble',
  'custom'
));

-- 2. Where a company came from. NULL source = RADAR's curated list or a dream company you added.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source TEXT;          -- 'startupmap' | 'import'
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_stage TEXT;   -- e.g. 'Seed', 'Series A'

-- 3. Discovery queue: startups found in a directory or imported by you, waiting for RADAR to find their
--    careers feed. Only companies with a working feed are copied into `companies` (status 'linked').
CREATE TABLE IF NOT EXISTS discovered_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                 -- 'startupmap' | 'import'
  source_ref TEXT NOT NULL,             -- directory slug, or the website domain for imports
  name TEXT,
  website TEXT,
  city TEXT,
  country TEXT,
  sector TEXT,
  funding_stage TEXT,
  priority INT NOT NULL DEFAULT 0,      -- 2 = hiring engineers in your cities, 1 = hiring engineers, 0 = unknown
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'no_feed', 'failed')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  attempts INT NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ,
  note TEXT,                            -- why it has no feed yet, e.g. "no open roles listed"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_discovered_queue ON discovered_companies (status, priority DESC, created_at);
ALTER TABLE discovered_companies ENABLE ROW LEVEL SECURITY;

-- 4. Per-source crawl state (last full sync, resume cursor, pause after a "slow down" answer), so the
--    48h cadence holds however often the cron fires.
CREATE TABLE IF NOT EXISTS source_state (
  source TEXT PRIMARY KEY,
  synced_at TIMESTAMPTZ,
  notes JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE source_state ENABLE ROW LEVEL SECURITY;

-- 5. Posting verification: when RADAR last confirmed the apply link still shows an open job.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 6. Autopilot. 80%+ goes to the Vault by default; profiles still on the old default (70) move to 80.
--    Any other value you picked is kept. The Settings slider changes it any time.
ALTER TABLE user_profiles ALTER COLUMN vault_min_score SET DEFAULT 80;
UPDATE user_profiles SET vault_min_score = 80 WHERE vault_min_score = 70;
-- Auto-OVERCLOCK: tailor the best 50–79 matches each day (paid Claude calls, so off until you turn it on).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auto_overclock BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS overclock_daily_cap INT NOT NULL DEFAULT 5
  CHECK (overclock_daily_cap BETWEEN 0 AND 20);
