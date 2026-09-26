-- ============================
-- RADAR — Resume versions on applications, Gmail updates, application timeline
-- ============================
-- Run after 005 in the Supabase SQL editor. Safe to re-run.

-- 1. The tailored resume that went out with each application (RUN records it when you mark a job applied).
ALTER TABLE match_scores
  ADD COLUMN IF NOT EXISTS resume_version_id UUID REFERENCES tailored_resumes(id) ON DELETE SET NULL;

-- 2. Read-only Gmail link used to spot recruiter replies. The refresh token is encrypted by the app
--    (GMAIL_TOKEN_KEY) before it is stored here.
CREATE TABLE IF NOT EXISTS gmail_links (
  user_id TEXT PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT
);
ALTER TABLE gmail_links ENABLE ROW LEVEL SECURITY;

-- 3. Application timeline: what RADAR learned about each application, and from where.
CREATE TABLE IF NOT EXISTS ops_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES match_scores(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('gmail', 'radar', 'user')),
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  -- Gmail message id, so each message is processed once.
  external_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_ops_events_user ON ops_events(user_id, occurred_at DESC);
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;
