-- ============================
-- RADAR — Portfolio: your links and the sites or projects you built
-- ============================
-- Run after 007 in the Supabase SQL editor. Safe to re-run.
-- Shape: { portfolio, github, linkedin, website: url text, projects: [{ name, url, note }] }.
-- HACK hands these to you ready to paste; OVERCLOCK may cite them in a tailored resume.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS portfolio JSONB NOT NULL DEFAULT '{}';
