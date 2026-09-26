-- ============================
-- RADAR — Target roles
-- ============================
-- Run after 003. Safe to re-run; a no-op where the column already exists.
-- current_role holds the roles the user is aiming for, comma-separated (e.g. "AI Engineer, Software Engineer").
-- The matcher adds +10 when a job title contains one of them.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_role TEXT;
