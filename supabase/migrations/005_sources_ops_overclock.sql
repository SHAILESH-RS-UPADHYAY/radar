-- ============================
-- RADAR — More sources, C2 · OPS application tracking, OVERCLOCK tailored resumes
-- ============================
-- Run after 004 in the Supabase SQL editor. Safe to re-run.

-- 1. New job-board sources: Jobicy, The Muse, Adzuna, Jooble
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy',
  'workday', 'amazon',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'themuse', 'adzuna', 'jooble',
  'custom'
));

-- 2. C2 · OPS: where each application stands. Only rows with status = 'applied' use these.
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE match_scores DROP CONSTRAINT IF EXISTS match_scores_stage_check;
ALTER TABLE match_scores ADD CONSTRAINT match_scores_stage_check
  CHECK (stage IS NULL OR stage IN ('applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'));
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS notes TEXT;
-- Applications made before this migration start at stage 'applied'.
UPDATE match_scores
SET stage = 'applied',
    applied_at = COALESCE(applied_at, status_changed_at, now()),
    stage_changed_at = COALESCE(stage_changed_at, status_changed_at, now())
WHERE status = 'applied' AND stage IS NULL;
CREATE INDEX IF NOT EXISTS idx_match_user_stage ON match_scores(user_id, stage);

-- 3. OVERCLOCK: one tailored resume per user and job, so a job is never paid for twice.
CREATE TABLE IF NOT EXISTS tailored_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  gaps JSONB NOT NULL DEFAULT '[]',
  base_score INT,
  projected_score INT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
ALTER TABLE tailored_resumes ENABLE ROW LEVEL SECURITY;
