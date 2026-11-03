-- 015: COACH answers (interview prep, follow-up drafts, the upskill plan), one per user, job and kind.
-- job_id is NULL for the upskill plan, which covers every match. Mock interview turns are never stored.

CREATE TABLE IF NOT EXISTS coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('prep', 'followup', 'upskill')),
  content JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_one ON coach_notes(user_id, kind, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'));
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;
