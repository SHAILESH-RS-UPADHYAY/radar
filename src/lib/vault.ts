// ============================
// RADAR — moving matches between Discovery, the Vault, C2 · OPS and dismissed
// ============================
// Shared by PATCH /api/vault (the dashboard) and AUTOPILOT (an application the employer confirmed).

import type { SupabaseClient } from '@supabase/supabase-js';
import { isSchemaMissing } from '@/lib/supabase/errors';
import type { MatchStatus } from '@/types';

/**
 * Set the status of some of a user's matches. Applying opens an application at stage 'applied' and records the
 * tailored resume that went out; leaving 'applied' closes it. Works at every schema step (005 stages, 006 versions).
 */
export async function setMatchStatus(
  supabase: SupabaseClient,
  userId: string,
  ids: string[],
  status: MatchStatus,
  resumeVersionId?: string | null,
): Promise<{ updated: number; error: string | null }> {
  const now = new Date().toISOString();
  const base: Record<string, unknown> = { status, status_changed_at: now };
  if (status !== 'saved') base.auto_saved = false;
  const ops =
    status === 'applied'
      ? { stage: 'applied', stage_changed_at: now, applied_at: now }
      : { stage: null, stage_changed_at: null, applied_at: null };
  const version =
    status === 'applied'
      ? resumeVersionId
        ? { resume_version_id: resumeVersionId }
        : {}
      : { resume_version_id: null };

  const run = (update: Record<string, unknown>) => {
    let q = supabase.from('match_scores').update(update).eq('user_id', userId).in('id', ids);
    // Re-applying must not reset an application that has already moved on (e.g. to 'interview').
    if (status === 'applied') q = q.neq('status', 'applied');
    return q.select('id');
  };
  // Newest schema first (006 resume versions, then 005 stages); the status change works at every step.
  const attempts = [{ ...base, ...ops, ...version }, { ...base, ...ops }, base];
  let { data, error } = await run(attempts[0]);
  for (let i = 1; i < attempts.length && isSchemaMissing(error); i++) ({ data, error } = await run(attempts[i]));
  return { updated: data?.length || 0, error: error ? error.message : null };
}
