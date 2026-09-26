// ============================
// RADAR — Is this posting still open?
// ============================
// Company ATS feeds are the source of truth: a job that leaves the feed is closed by the next scrape.
// Job boards are not — they keep listing roles the employer already filled. So before a board job enters
// your Vault, and every day while it sits there, RADAR opens its apply link and reads the answer.
// Only clear signals mark a job closed; a page RADAR cannot read (blocked, timeout) stays "unknown".

import type { SupabaseClient } from '@supabase/supabase-js';
import { BOARD_PROVIDERS } from '@/types';
import { deleteJobVectors } from '@/lib/ai/embeddings';
import { mapLimit } from '@/lib/scraper/utils';
import { politeFetcher, SiteBlockedError, type PoliteFetcher } from '@/lib/discovery/polite';

export type PostingState = 'live' | 'closed' | 'unknown';

const VERIFY_TTL_MS = 24 * 3600_000;

// What employers and boards show on a filled or removed job.
const CLOSED_TEXT =
  /\b(no longer (accepting (applications|candidates)|available|active|open)|not available anymore|(job|position|posting|role|vacancy|opening)( post(ing)?)? (has|have) (been )?(filled|closed|expired|removed)|(job|position|posting|role|vacancy|opening)( post(ing)?)? is (closed|expired)|(job|posting|position) (was )?not found|applications (are|have) (now )?closed|job you('re| are) looking for (is|was|has|does|could))\b/i;
const CLOSED_TITLE = /\b(404|not found|expired|no longer|closed)\b/i;

/** Visible text: scripts, styles and tags removed (an app bundle can contain any string). */
const visibleText = (html: string) =>
  html
    .slice(0, 400_000)
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

/** What an apply link's answer means. Pure, for tests. */
export function classifyPosting(status: number, html: string, requestedUrl?: string, finalUrl?: string): PostingState {
  if (status === 404 || status === 410) return 'closed';
  if (status < 200 || status >= 300) return 'unknown';
  if (finalUrl && requestedUrl) {
    const from = new URL(requestedUrl);
    const to = new URL(finalUrl);
    // Sent back to the board's front page (or Greenhouse's "?error=true"): the job is gone.
    if (to.searchParams.get('error') === 'true') return 'closed';
    if (from.pathname.split('/').filter(Boolean).length >= 2 && to.pathname === '/' && from.host === to.host)
      return 'closed';
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  if (CLOSED_TITLE.test(title)) return 'closed';
  return CLOSED_TEXT.test(visibleText(html)) ? 'closed' : 'live';
}

export async function checkPosting(http: PoliteFetcher, url: string): Promise<PostingState> {
  try {
    const res = await http.get(url);
    if (res.status === 0) return 'unknown'; // robots.txt says no: we do not look
    return classifyPosting(res.status, res.text, url, res.url);
  } catch (err) {
    if (!(err instanceof SiteBlockedError)) console.warn('[VERIFY]', url, (err as Error).message);
    return 'unknown';
  }
}

// Hacker News posts are comments (always "live"); every other board can list a filled role.
const CHECKABLE = new Set<string>(BOARD_PROVIDERS.filter((p) => p !== 'hackernews'));
export const needsLinkCheck = (provider: string | null | undefined) => !!provider && CHECKABLE.has(provider);

type JobRef = { id: string; apply_url: string; companies: { ats_provider: string } | { ats_provider: string }[] };
const providerOf = (j: JobRef) => (Array.isArray(j.companies) ? j.companies[0] : j.companies)?.ats_provider;

/** Record checks. `verified_at` arrives with migration 007; before it, closing jobs still works. */
export async function recordChecks(supabase: SupabaseClient, live: string[], closed: string[]) {
  if (live.length) {
    const { error } = await supabase.from('jobs').update({ verified_at: new Date().toISOString() }).in('id', live);
    if (error) console.warn('[VERIFY] verified_at not saved:', error.message);
  }
  if (closed.length) {
    await supabase.from('jobs').update({ is_active: false }).in('id', closed);
    await deleteJobVectors(closed).catch((e) => console.error('[VERIFY] vector cleanup failed:', (e as Error).message));
  }
}

/** Board jobs among `ids` that nobody confirmed live in the last 24h. */
async function unverified(supabase: SupabaseClient, jobs: JobRef[]): Promise<JobRef[]> {
  const board = jobs.filter((j) => needsLinkCheck(providerOf(j)));
  if (!board.length) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .in(
      'id',
      board.map((j) => j.id),
    )
    .gt('verified_at', new Date(Date.now() - VERIFY_TTL_MS).toISOString());
  const fresh = new Set(error ? [] : (data || []).map((r) => r.id));
  return board.filter((j) => !fresh.has(j.id));
}

async function checkAll(supabase: SupabaseClient, jobs: JobRef[], stopAt: number) {
  const http = politeFetcher({ minIntervalMs: 500, timeoutMs: 8_000 });
  const live: string[] = [];
  const closed: string[] = [];
  await mapLimit(jobs, 6, async (j) => {
    if (Date.now() > stopAt) return;
    const state = await checkPosting(http, j.apply_url);
    if (state === 'live') live.push(j.id);
    if (state === 'closed') closed.push(j.id);
  });
  await recordChecks(supabase, live, closed);
  return { live, closed };
}

/**
 * Auto-vault gate: of the jobs about to enter a Vault, those whose posting is not known to be closed.
 * Board jobs are checked first (bounded, so a scan stays fast); closed ones are deactivated everywhere.
 */
export async function gateForVault(
  supabase: SupabaseClient,
  jobIds: string[],
  { max = 15, budgetMs = 12_000 } = {},
): Promise<Set<string>> {
  if (!jobIds.length) return new Set();
  const { data } = await supabase.from('jobs').select('id, apply_url, companies!inner(ats_provider)').in('id', jobIds);
  const toCheck = (await unverified(supabase, (data || []) as JobRef[])).slice(0, max);
  const { closed } = await checkAll(supabase, toCheck, Date.now() + budgetMs);
  const gone = new Set(closed);
  return new Set(jobIds.filter((id) => !gone.has(id)));
}

/** Daily: re-check every board job sitting in a Vault. Closed ones show POSTING CLOSED there. */
export async function reverifyVault(supabase: SupabaseClient, deadline: number) {
  const { data } = await supabase
    .from('match_scores')
    .select('jobs!inner(id, apply_url, is_active, companies!inner(ats_provider))')
    .eq('status', 'saved')
    .eq('jobs.is_active', true)
    .limit(1000);
  const jobs = new Map<string, JobRef>();
  for (const row of (data || []) as unknown as { jobs: JobRef | JobRef[] }[]) {
    const j = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (j) jobs.set(j.id, j);
  }
  const toCheck = (await unverified(supabase, [...jobs.values()])).slice(0, 200);
  const { live, closed } = await checkAll(supabase, toCheck, deadline);
  return { checked: live.length + closed.length, closed: closed.length };
}
