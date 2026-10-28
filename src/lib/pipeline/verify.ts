// ============================
// RADAR — Is this posting still open?
// ============================
// Company ATS feeds are the source of truth: a job that leaves the feed is closed by the scrape (scrape.ts).
// Job boards are not — they keep listing roles the employer already filled. So before a board job enters a Vault,
// and every 6 hours while it sits in Discovery or a Vault, RADAR opens its page and reads the answer.
// Only clear signals mark a job closed; a page RADAR cannot read (blocked, timeout) stays "unknown".
//
// Some sources are never opened: search APIs whose terms and rate limits are for the API, not their site (Adzuna,
// Jooble, JSearch, Google Jobs), and LinkedIn and Indeed, which forbid automated access. Their jobs are judged by
// their feed or alert (scrape.ts), or by the employer page they lead to once you opened one (`resolved_url`).
// A match hidden because its posting closed is marked (retired_at), and comes back if the posting reopens.

import type { SupabaseClient } from '@supabase/supabase-js';
import { BOARD_PROVIDERS } from '@/types';
import { mapLimit } from '@/lib/scraper/utils';
import { politeFetcher, SiteBlockedError, type PoliteFetcher } from '@/lib/discovery/polite';
import { isSchemaMissing } from '@/lib/supabase/errors';

export type PostingState = 'live' | 'closed' | 'unknown';

/** A board job confirmed open this recently is not checked again. */
export const VERIFY_TTL_MS = 6 * 3600_000;

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

// Boards whose job pages RADAR may open. Hacker News posts are comments (always "live"); the rest are never opened.
const NEVER_OPENED = new Set([
  'hackernews',
  'adzuna',
  'jooble',
  'jsearch',
  'googlejobs',
  'indeed_email',
  'linkedin_email',
]);
const LINK_CHECKED = new Set<string>(BOARD_PROVIDERS.filter((p) => !NEVER_OPENED.has(p)));

// Pages RADAR never opens, wherever a link led: sites that forbid automated access, and job boards' own pages.
const NEVER_OPENED_HOSTS =
  /(^|\.)(linkedin\.com|indeed\.[a-z.]+|adzuna\.[a-z.]+|jooble\.org|glassdoor\.[a-z.]+|naukri\.com|app\.otta\.com|foundit\.in|monsterindia\.com|shine\.com|timesjobs\.com)$/i;

/** Whether RADAR may open this page to check a posting. Pure. */
export function mayOpen(url: string): boolean {
  try {
    return !NEVER_OPENED_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface CheckableJob {
  apply_url: string;
  resolved_url?: string | null;
}

/**
 * The page that tells whether a job is open: the employer page a board link led to once you opened it, else the
 * board's own page where RADAR may open it, else none (the feed decides). Pure.
 */
export function checkUrl(job: CheckableJob, provider: string | null | undefined): string | null {
  if (job.resolved_url && mayOpen(job.resolved_url)) return job.resolved_url;
  return provider && LINK_CHECKED.has(provider) ? job.apply_url : null;
}

/** Whether a job is judged by opening a page (true) rather than by its feed. */
export const needsLinkCheck = (job: CheckableJob, provider: string | null | undefined) => !!checkUrl(job, provider);

type JobRef = CheckableJob & {
  id: string;
  verified_at?: string | null;
  companies: { ats_provider: string } | { ats_provider: string }[];
};
const providerOf = (j: JobRef) => (Array.isArray(j.companies) ? j.companies[0] : j.companies)?.ats_provider;

/** Record checks: confirmed-open jobs get verified_at; closed ones leave every list and the job search. */
export async function recordChecks(supabase: SupabaseClient, live: string[], closed: string[]) {
  if (live.length) {
    const { error } = await supabase.from('jobs').update({ verified_at: new Date().toISOString() }).in('id', live);
    if (error) console.warn('[VERIFY] verified_at not saved:', error.message);
  }
  if (closed.length) {
    await supabase.from('jobs').update({ is_active: false }).in('id', closed);
  }
}

const CHUNK = 100;

/**
 * Matches still in Discovery or a Vault whose posting has closed leave both lists, marked as RADAR's doing
 * (retired_at, retired_from) so they come back if the posting reopens. Applied ones stay in C2 · OPS.
 * Runs on every cycle and scan.
 */
export async function retireClosedMatches(supabase: SupabaseClient, userId?: string): Promise<number> {
  let query = supabase
    .from('match_scores')
    .select('id, status, jobs!inner(is_active)')
    .in('status', ['new', 'saved'])
    .eq('jobs.is_active', false);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.limit(2000);
  if (error) {
    console.warn('[VERIFY] closed-match cleanup skipped:', error.message);
    return 0;
  }
  const now = new Date().toISOString();
  for (const status of ['new', 'saved'] as const) {
    const ids = (data || []).filter((r) => r.status === status).map((r) => r.id as string);
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error: e } = await supabase
        .from('match_scores')
        .update({ status: 'dismissed', retired_at: now, retired_from: status })
        .in('id', slice);
      // Before migration 012 there is nowhere to mark it: hide it all the same.
      if (isSchemaMissing(e)) await supabase.from('match_scores').update({ status: 'dismissed' }).in('id', slice);
    }
  }
  return (data || []).length;
}

/** Matches RADAR hid whose posting is open again go back where they were (Discovery or the Vault). */
export async function reviveReopenedMatches(supabase: SupabaseClient, userId?: string): Promise<number> {
  let query = supabase
    .from('match_scores')
    .select('id, retired_from, jobs!inner(is_active)')
    .eq('status', 'dismissed')
    .not('retired_at', 'is', null)
    .eq('jobs.is_active', true);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.limit(2000);
  if (error) {
    if (!isSchemaMissing(error)) console.warn('[VERIFY] reopened-match restore skipped:', error.message);
    return 0;
  }
  for (const status of ['new', 'saved'] as const) {
    const ids = (data || []).filter((r) => (r.retired_from || 'new') === status).map((r) => r.id as string);
    for (let i = 0; i < ids.length; i += CHUNK)
      await supabase
        .from('match_scores')
        .update({ status, retired_at: null, retired_from: null })
        .in('id', ids.slice(i, i + CHUNK));
  }
  return (data || []).length;
}

const isStale = (j: JobRef, now: number) => !j.verified_at || now - Date.parse(j.verified_at) > VERIFY_TTL_MS;

async function checkAll(supabase: SupabaseClient, jobs: JobRef[], stopAt: number) {
  const http = politeFetcher({ minIntervalMs: 500, timeoutMs: 8_000 });
  const live: string[] = [];
  const closed: string[] = [];
  await mapLimit(jobs, 6, async (j) => {
    if (Date.now() > stopAt) return;
    const state = await checkPosting(http, checkUrl(j, providerOf(j))!);
    if (state === 'live') live.push(j.id);
    if (state === 'closed') closed.push(j.id);
  });
  await recordChecks(supabase, live, closed);
  return { live, closed };
}

const JOB_REF = 'id, apply_url, resolved_url, verified_at, companies!inner(ats_provider)';

/**
 * Auto-vault gate: of the jobs about to enter a Vault, those whose posting is not known to be closed.
 * Link-checked jobs not confirmed open in the last 6 hours are checked first (bounded, so a scan stays fast).
 */
export async function gateForVault(
  supabase: SupabaseClient,
  jobIds: string[],
  { max = 15, budgetMs = 12_000 } = {},
): Promise<Set<string>> {
  if (!jobIds.length) return new Set();
  const { data } = await supabase.from('jobs').select(JOB_REF).in('id', jobIds);
  const now = Date.now();
  const toCheck = ((data || []) as JobRef[])
    .filter((j) => needsLinkCheck(j, providerOf(j)) && isStale(j, now))
    .slice(0, max);
  const { closed } = await checkAll(supabase, toCheck, now + budgetMs);
  const gone = new Set(closed);
  return new Set(jobIds.filter((id) => !gone.has(id)));
}

/**
 * Every cycle: re-check the open postings people can see, Vault first, then Discovery by score, until the
 * deadline. Each is checked at most once per VERIFY_TTL_MS; closed ones leave the lists via retireClosedMatches.
 */
export async function reverifyOpenMatches(supabase: SupabaseClient, deadline: number) {
  const rows = async (status: 'saved' | 'new', limit: number) => {
    const { data, error } = await supabase
      .from('match_scores')
      .select(`score, jobs!inner(${JOB_REF}, is_active)`)
      .eq('status', status)
      .eq('jobs.is_active', true)
      .order('score', { ascending: false })
      .limit(limit);
    if (error) throw new Error('Reading open matches failed: ' + error.message);
    return (data || []).map((r) => (Array.isArray(r.jobs) ? r.jobs[0] : r.jobs) as unknown as JobRef);
  };
  const now = Date.now();
  const seen = new Set<string>();
  const queue = [...(await rows('saved', 1000)), ...(await rows('new', 2000))].filter(
    (j) => !seen.has(j.id) && seen.add(j.id) && needsLinkCheck(j, providerOf(j)) && isStale(j, now),
  );
  const { live, closed } = await checkAll(supabase, queue.slice(0, 600), deadline);
  return { due: queue.length, checked: live.length + closed.length, closed: closed.length };
}
