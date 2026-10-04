-- ============================
-- RADAR — Hasjob Indian tech feed source
-- ============================
-- Run after 010 in the Supabase SQL editor. Safe to re-run.

-- 1. Add 'hasjob' to the allowed company ats_provider values.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy', 'teamtailor',
  'workday', 'amazon', 'eightfold',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'themuse', 'adzuna', 'jooble',
  'weworkremotely', 'workingnomads', 'hasjob',
  'custom'
));
