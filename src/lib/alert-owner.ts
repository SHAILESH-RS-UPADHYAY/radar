import type { SupabaseClient } from '@supabase/supabase-js';

// Whose job alerts are whose. Alert emails are read from every linked Gmail into the shared jobs table, so each inbox's
// job ids are kept here, and only that account sees those jobs as "your alerts". An account with no Gmail linked has
// none. Kept in source_state (one row per account) so it needs no migration.
// ponytail: a JSON list per account, capped; its own table (user_id, job_id) once many inboxes are linked.

const KEY = 'alert-owner:';
const MAX_IDS = 6000; // about a year of alerts at today's volume

/** Add the jobs read from one account's inbox in this run to what it already owns. */
export async function recordAlertOwner(supabase: SupabaseClient, userId: string, externalIds: string[]) {
  if (!externalIds.length) return;
  const { data } = await supabase
    .from('source_state')
    .select('notes')
    .eq('source', KEY + userId)
    .maybeSingle();
  const before: string[] = (data?.notes as { ids?: string[] } | null)?.ids || [];
  const ids = [...new Set([...externalIds, ...before])].slice(0, MAX_IDS);
  const { error } = await supabase
    .from('source_state')
    .upsert({ source: KEY + userId, synced_at: new Date().toISOString(), notes: { ids } });
  if (error) console.warn('[ALERTS] owner record failed:', error.message);
}

/**
 * Is this alert job (by its external id) the account's own? Pure.
 * Jobs read before owners were recorded are in nobody's list: they came from the first inbox ever linked, so they go
 * to the account with the oldest link.
 */
export function ownsAlert(
  userId: string,
  linkedOldestFirst: string[],
  owners: Map<string, Set<string>>,
): (externalId: string) => boolean {
  if (!linkedOldestFirst.includes(userId)) return () => false;
  const mine = owners.get(userId) || new Set<string>();
  if (linkedOldestFirst[0] !== userId) return (id) => mine.has(id);
  const others = [...owners].filter(([owner]) => owner !== userId).map(([, ids]) => ids);
  return (id) => mine.has(id) || !others.some((ids) => ids.has(id));
}

/** ownsAlert for one account, loaded from the database. */
export async function alertOwnership(supabase: SupabaseClient, userId: string) {
  const [{ data: links }, { data: rows }] = await Promise.all([
    supabase.from('gmail_links').select('user_id').order('connected_at', { ascending: true }),
    supabase
      .from('source_state')
      .select('source, notes')
      .like('source', KEY + '%'),
  ]);
  const owners = new Map<string, Set<string>>();
  for (const row of rows || [])
    owners.set(String(row.source).slice(KEY.length), new Set((row.notes as { ids?: string[] } | null)?.ids || []));
  return ownsAlert(
    userId,
    (links || []).map((l) => l.user_id as string),
    owners,
  );
}
