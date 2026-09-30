-- ============================
-- RADAR — More sources, and the Application Kit
-- ============================
-- Run after 008 in the Supabase SQL editor. Safe to re-run.

-- 1. New sources: Eightfold career sites (Netflix), We Work Remotely (RSS) and Working Nomads.
--    The list repeats every provider RADAR reads, since a CHECK constraint is replaced as a whole.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy', 'teamtailor',
  'workday', 'amazon', 'eightfold',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'themuse', 'adzuna', 'jooble',
  'weworkremotely', 'workingnomads',
  'custom'
));

-- 2. Application Kit: what application forms ask (phone, notice period, pay, work authorization, …), saved once.
--    HACK fills the form answers from it; nothing is sent to an employer by RADAR.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS application_kit JSONB NOT NULL DEFAULT '{}';
