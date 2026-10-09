-- ============================
-- RADAR — Email alerts from LinkedIn and Welcome to the Jungle, where board links really apply,
-- and closed-posting retirements RADAR can undo
-- ============================
-- Run after 011 in the Supabase SQL editor. Safe to re-run.

-- 1. LinkedIn and Welcome to the Jungle job-alert emails are sources, like Indeed's.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy', 'teamtailor',
  'workday', 'amazon', 'eightfold',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'themuse', 'adzuna', 'jooble',
  'weworkremotely', 'workingnomads', 'hasjob',
  'indeed_email', 'jsearch', 'googlejobs', 'linkedin_email', 'wttj_email',
  'custom'
));

-- 2. Where a job board's link really leads (Adzuna → the employer's Greenhouse form), learned in your own browser
--    the first time you open it. RADAR then opens, reads ahead and checks that page instead of the board's.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resolved_url TEXT;

-- 3. A match RADAR hid because its posting closed carries when and from where. When the posting comes back
--    (seen again in its feed, or a link check finds it open), RADAR puts the match back where it was.
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS retired_from TEXT;
CREATE INDEX IF NOT EXISTS idx_match_retired ON match_scores(retired_at) WHERE retired_at IS NOT NULL;

-- 4. One-time repair: before this migration RADAR hid matches of closed postings without marking them, and some of
--    those postings are open again. Your own dismissals always set status_changed_at and clear auto_saved, so a
--    dismissed match without status_changed_at, or still auto_saved, was hidden by RADAR: bring it back to Discovery.
UPDATE match_scores m
SET status = 'new', auto_saved = false
FROM jobs j
WHERE m.job_id = j.id
  AND m.status = 'dismissed'
  AND j.is_active
  AND (m.status_changed_at IS NULL OR m.auto_saved);
