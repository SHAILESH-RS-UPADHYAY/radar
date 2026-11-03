-- 016: COACH caches two more kinds: the referral kit (per job) and the LinkedIn rewrite (job_id NULL).
-- Pay negotiation and mock interview turns depend on what the user types, so they are never stored.

ALTER TABLE coach_notes DROP CONSTRAINT IF EXISTS coach_notes_kind_check;
ALTER TABLE coach_notes ADD CONSTRAINT coach_notes_kind_check
  CHECK (kind IN ('prep', 'followup', 'upskill', 'referral', 'linkedin'));
