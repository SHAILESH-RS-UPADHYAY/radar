-- 018: 4dayweek.io, a free public job API.

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ats_provider_check;
ALTER TABLE companies ADD CONSTRAINT companies_ats_provider_check CHECK (ats_provider IN (
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'breezy', 'teamtailor',
  'workday', 'amazon', 'eightfold', 'rippling', 'bamboohr',
  'hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas', 'jobicy', 'fourdayweek', 'themuse', 'adzuna', 'jooble',
  'weworkremotely', 'workingnomads', 'hasjob',
  'indeed_email', 'jsearch', 'googlejobs', 'linkedin_email', 'wttj_email',
  'custom'
));
