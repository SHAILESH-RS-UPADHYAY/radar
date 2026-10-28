// ============================
// RADAR — Scrape pipeline
// ============================
// Pulls every scrapeable company/source, upserts jobs, embeds only new or changed jobs, and closes jobs that left
// their source (see closurePolicy). Runs within a time budget and starts with the least recently scraped companies,
// so a cut-short run resumes next time; search APIs with quotas run only as often as their quota allows.

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scrapeCompany, type ScrapedJob } from '@/lib/scraper/adapters';
import { jobKey, mapLimit } from '@/lib/scraper/utils';
import { BOARD_PROVIDERS } from '@/types';
import { ensureCompaniesSeeded } from '@/lib/scraper/seed';
import { upsertJobVectors } from '@/lib/ai/embeddings';

export interface CompanyScrapeResult {
  company: string;
  provider: string;
  jobs: number;
  embedded: number;
  deactivated: number;
  durationMs: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  error?: string;
}

export interface ScrapeSummary {
  totalCompanies: number;
  scraped: number;
  failed: number;
  skippedForTime: number;
  totalJobs: number;
  embedded: number;
  results: CompanyScrapeResult[];
}

interface CompanyRow {
  id: string;
  name: string;
  ats_provider: string;
  ats_identifier: string | null;
  last_scraped_at: string | null;
}

const CONCURRENCY = Number(process.env.RADAR_SCRAPE_CONCURRENCY || 4);
const UPSERT_CHUNK = 50;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

// Read as a search window capped at RADAR_MAX_JOBS_PER_COMPANY, not as the full list.
const WINDOWED_ATS = new Set(['workday', 'amazon', 'smartrecruiters']);
const ALERTS = new Set(['indeed_email', 'linkedin_email', 'wttj_email']);

/**
 * When a job missing from this run's results counts as closed.
 *   · Company ATS feeds list every open job: closed after two misses (10 h at the 6-hour cadence), so one short or
 *     failed feed never hides live jobs.
 *   · Windowed ATS reads (Workday, Amazon, SmartRecruiters): after a week unseen.
 *   · Job boards and search APIs show only their newest results: after 5 days unseen, unless a link check
 *     confirmed the posting open in the last 2 days.
 *   · Job-alert emails carry new jobs only: after 21 days unseen, with the same link-check exception.
 * The link checks in verify.ts close board jobs sooner when their page says so.
 */
// ponytail: fixed grace periods per source kind; per-source tuning if one board's postings live much shorter.
export function closurePolicy(provider: string): { graceMs: number; liveProofMs: number | null } {
  if (WINDOWED_ATS.has(provider)) return { graceMs: 7 * DAY, liveProofMs: null };
  if (ALERTS.has(provider)) return { graceMs: 21 * DAY, liveProofMs: 2 * DAY };
  if ((BOARD_PROVIDERS as readonly string[]).includes(provider)) return { graceMs: 5 * DAY, liveProofMs: 2 * DAY };
  return { graceMs: 10 * HOUR, liveProofMs: null };
}

/** Search APIs with daily or monthly quotas (Adzuna: 250 a day, 2,500 a month) run at most this often. */
const QUOTA_INTERVAL: Record<string, number> = {
  adzuna: 23 * HOUR,
  jsearch: 23 * HOUR,
  googlejobs: 23 * HOUR,
  jooble: 11 * HOUR,
};

/** Whether a company's feed is due this run: always, except quota-limited APIs inside their interval. Pure. */
export function dueForScrape(company: Pick<CompanyRow, 'ats_provider' | 'last_scraped_at'>, now = Date.now()) {
  const every = QUOTA_INTERVAL[company.ats_provider];
  return !every || !company.last_scraped_at || now - Date.parse(company.last_scraped_at) >= every;
}
/** One slow company (a hung API, a huge board) must never hold the whole run. */
const COMPANY_TIMEOUT_MS = Number(process.env.RADAR_COMPANY_TIMEOUT_MS || 60_000);
/** Search APIs run many queries (each country, each of your cities, paced to their rate limits): they get longer. */
const BOARD_TIMEOUT_MS = 170_000;

// Whitespace is normalised, so a formatting-only change (e.g. keeping paragraph breaks) does not re-embed a job.
const squash = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim();

function hashJob(j: ScrapedJob): string {
  return createHash('sha1')
    .update([j.title, j.location, j.apply_url, squash(j.description)].join('\u0001'))
    .digest('hex');
}

/**
 * RADAR keeps only jobs whose JD asks for at most 3 years: '3-5' (4-5 years) and '5+' are never stored. The title
 * ("Senior", "Lead") does not decide it, and a job that states no years is kept (most startup postings say nothing).
 */
export const TOO_SENIOR: readonly string[] = ['3-5', '5+'];
export const withinExperience = (j: { experience_required: string | null }) =>
  !TOO_SENIOR.includes(j.experience_required ?? '');

/**
 * Delete stored jobs that ask for more than 3 years, with their vectors. Jobs you applied to stay, so C2 · OPS keeps
 * its history. Returns how many went.
 */
export async function purgeSenior(supabase: SupabaseClient): Promise<number> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id')
      .in('experience_required', [...TOO_SENIOR])
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error('Reading senior jobs failed: ' + error.message);
    ids.push(...(data || []).map((d) => d.id as string));
    if ((data || []).length < 1000) break;
  }
  if (!ids.length) return 0;
  const kept = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('match_scores')
      .select('job_id')
      .eq('status', 'applied')
      .in('job_id', ids.slice(i, i + 200));
    if (error) throw new Error('Reading applications failed: ' + error.message);
    for (const d of data || []) kept.add(d.job_id as string);
  }
  const gone = ids.filter((id) => !kept.has(id));
  for (let i = 0; i < gone.length; i += 200) {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .in('id', gone.slice(i, i + 200));
    if (error) throw new Error('Deleting senior jobs failed: ' + error.message);
  }
  return gone.length;
}

async function existingHashes(supabase: SupabaseClient, companyId: string): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select('external_id, content_hash')
      .eq('company_id', companyId)
      .range(from, from + 999);
    if (error) throw new Error('Reading existing jobs failed: ' + error.message);
    for (const row of data || []) map.set(row.external_id, row.content_hash);
    if (!data || data.length < 1000) break;
  }
  return map;
}

/**
 * Keys of the jobs open right now on companies' own ATS feeds. A job board listing the same employer + title is a
 * copy: RADAR keeps the company's own posting and drops the board's (no second vector, no second card).
 */
async function atsJobKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select('title, companies!inner(name, ats_provider)')
      .eq('is_active', true)
      .is('employer', null)
      .range(from, from + 999);
    if (error) {
      console.warn('[SCRAPE] dedupe keys skipped:', error.message);
      return keys;
    }
    for (const row of (data || []) as unknown as {
      title: string;
      companies: { name: string } | { name: string }[];
    }[]) {
      const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      if (c) keys.add(jobKey(c.name, row.title));
    }
    if (!data || data.length < 1000) break;
  }
  return keys;
}

async function scrapeOne(
  supabase: SupabaseClient,
  company: CompanyRow,
  embedBudget: { left: number; until: number },
  atsKeys: () => Promise<Set<string>>,
): Promise<CompanyScrapeResult> {
  const start = Date.now();
  const runStartedAt = new Date(start).toISOString();
  const base = { company: company.name, provider: company.ats_provider };

  try {
    const scraped = await scrapeCompany(company.ats_provider, company.ats_identifier);
    let unique = [...new Map(scraped.filter(withinExperience).map((j) => [j.external_id, j])).values()];
    if ((BOARD_PROVIDERS as readonly string[]).includes(company.ats_provider)) {
      const own = await atsKeys();
      unique = unique.filter((j) => !own.has(jobKey(j.employer || '', j.title)));
    }

    let embedded = 0;
    let deactivated = 0;

    if (unique.length > 0) {
      const known = await existingHashes(supabase, company.id);
      const rows = unique.map((j) => {
        const hash = hashJob(j);
        const unchanged = known.get(j.external_id) === hash;
        return {
          job: j,
          hash,
          unchanged,
          row: {
            company_id: company.id,
            external_id: j.external_id,
            title: j.title.slice(0, 300),
            description: j.description || null,
            location: j.location,
            work_type: j.work_type,
            salary_min: j.salary_min,
            salary_max: j.salary_max,
            salary_currency: j.salary_currency,
            experience_required: j.experience_required,
            skills: j.skills,
            apply_url: j.apply_url,
            department: j.department,
            employer: j.employer,
            posted_at: j.posted_at,
            is_active: true,
            scraped_at: runStartedAt,
            // Only unchanged jobs keep their hash now; changed/new ones get it after embedding succeeds.
            content_hash: unchanged ? hash : null,
          },
        };
      });

      const idByExternal = new Map<string, string>();
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => r.row);
        const { data, error } = await supabase
          .from('jobs')
          .upsert(chunk, { onConflict: 'company_id,external_id' })
          .select('id, external_id');
        if (error) throw new Error('Job upsert failed: ' + error.message);
        for (const d of data || []) idByExternal.set(d.external_id, d.id);
      }

      // Past the scrape budget, jobs are saved but not embedded: they keep an empty hash and embed next run,
      // so a big backlog can never push the run past the function limit and starve matching.
      const needsEmbedding =
        Date.now() > embedBudget.until
          ? []
          : rows
              .filter((r) => !r.unchanged && idByExternal.has(r.job.external_id))
              .slice(0, Math.max(0, embedBudget.left));
      embedBudget.left -= needsEmbedding.length;

      if (needsEmbedding.length) {
        await upsertJobVectors(
          needsEmbedding.map((r) => ({
            id: idByExternal.get(r.job.external_id)!,
            title: r.job.title,
            description: r.job.description,
            company_name: r.job.employer || company.name,
            skills: r.job.skills,
            location: r.job.location,
          })),
        );
        embedded = needsEmbedding.length;
        for (let i = 0; i < needsEmbedding.length; i += UPSERT_CHUNK) {
          const chunk = needsEmbedding.slice(i, i + UPSERT_CHUNK).map((r) => ({ ...r.row, content_hash: r.hash }));
          const { error } = await supabase.from('jobs').upsert(chunk, { onConflict: 'company_id,external_id' });
          if (error) console.error('[SCRAPE]', company.name, 'hash update failed:', error.message);
        }
      }

      // What this source stopped listing long enough ago is closed (closurePolicy).
      const { graceMs, liveProofMs } = closurePolicy(company.ats_provider);
      let stale = supabase
        .from('jobs')
        .update({ is_active: false })
        .eq('company_id', company.id)
        .eq('is_active', true)
        .lt('scraped_at', new Date(start - graceMs).toISOString());
      if (liveProofMs)
        stale = stale.or(`verified_at.is.null,verified_at.lt.${new Date(start - liveProofMs).toISOString()}`);
      const { data: gone, error: staleErr } = await stale.select('id');
      if (staleErr) console.error('[SCRAPE]', company.name, 'stale cleanup failed:', staleErr.message);
      deactivated = gone?.length || 0;
    }

    const durationMs = Date.now() - start;
    const status = unique.length > 0 ? 'success' : 'partial';
    await supabase
      .from('scrape_logs')
      .insert({ company_id: company.id, status, jobs_found: unique.length, duration_ms: durationMs });
    await supabase.from('companies').update({ last_scraped_at: new Date().toISOString() }).eq('id', company.id);

    console.log('[SCRAPE]', company.name, '→', unique.length, 'jobs,', embedded, 'embedded,', deactivated, 'closed');
    return { ...base, jobs: unique.length, embedded, deactivated, durationMs, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    await supabase.from('scrape_logs').insert({
      company_id: company.id,
      status: 'failed',
      jobs_found: 0,
      error_message: message.slice(0, 1000),
      duration_ms: durationMs,
    });
    // Still bump last_scraped_at so a permanently broken source doesn't block the queue.
    await supabase.from('companies').update({ last_scraped_at: new Date().toISOString() }).eq('id', company.id);
    console.error('[SCRAPE]', company.name, 'FAILED:', message);
    return { ...base, jobs: 0, embedded: 0, deactivated: 0, durationMs, status: 'failed', error: message };
  }
}

/** scrapeOne with a time limit: past it the company is logged as failed, moved to the back of the queue, and the run moves on. */
async function scrapeWithin(
  supabase: SupabaseClient,
  company: CompanyRow,
  embedBudget: { left: number; until: number },
  atsKeys: () => Promise<Set<string>>,
): Promise<CompanyScrapeResult> {
  const limit = (BOARD_PROVIDERS as readonly string[]).includes(company.ats_provider)
    ? BOARD_TIMEOUT_MS
    : COMPANY_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<CompanyScrapeResult>((resolve) => {
    timer = setTimeout(async () => {
      const error = 'timed out after ' + limit / 1000 + 's';
      console.error('[SCRAPE]', company.name, error);
      await supabase.from('scrape_logs').insert({
        company_id: company.id,
        status: 'failed',
        jobs_found: 0,
        error_message: error,
        duration_ms: limit,
      });
      await supabase.from('companies').update({ last_scraped_at: new Date().toISOString() }).eq('id', company.id);
      resolve({
        company: company.name,
        provider: company.ats_provider,
        jobs: 0,
        embedded: 0,
        deactivated: 0,
        durationMs: limit,
        status: 'failed',
        error,
      });
    }, limit);
  });
  try {
    return await Promise.race([scrapeOne(supabase, company, embedBudget, atsKeys), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runScrape(
  supabase: SupabaseClient,
  opts: { budgetMs?: number; companyIds?: string[] } = {},
): Promise<ScrapeSummary> {
  const deadline = Date.now() + (opts.budgetMs ?? 200_000);
  await ensureCompaniesSeeded(supabase);
  // Housekeeping belongs to the full loop; a targeted run (a few sources, on request) skips it.
  if (!opts.companyIds?.length) {
    const purged = await purgeSenior(supabase).catch((e) => (console.error('[SCRAPE] senior purge failed:', e), 0));
    if (purged) console.log('[SCRAPE] removed', purged, 'jobs asking for more than 3 years');
  }

  let query = supabase
    .from('companies')
    .select('id, name, ats_provider, ats_identifier, last_scraped_at')
    .eq('is_active', true)
    .not('ats_provider', 'is', null)
    .neq('ats_provider', 'custom')
    .order('last_scraped_at', { ascending: true, nullsFirst: true });
  if (opts.companyIds?.length) query = query.in('id', opts.companyIds);

  const { data: all, error } = await query;
  if (error || !all) throw new Error('Failed to load companies: ' + (error?.message || 'no data'));
  const companies = (all as CompanyRow[]).filter((c) => opts.companyIds?.length || dueForScrape(c));

  const embedBudget = { left: Number(process.env.RADAR_MAX_EMBEDS_PER_RUN || 2000), until: deadline - 25_000 };
  // Read once per run, and only when a job board is scraped in it.
  let keys: Promise<Set<string>> | null = null;
  const atsKeys = () => (keys ??= atsJobKeys(supabase));
  const results = await mapLimit(companies, CONCURRENCY, async (company) => {
    // Leave ~25s for the in-flight companies to finish before the function limit.
    if (Date.now() > deadline - 25_000) {
      return {
        company: company.name,
        provider: company.ats_provider,
        jobs: 0,
        embedded: 0,
        deactivated: 0,
        durationMs: 0,
        status: 'skipped' as const,
      };
    }
    return scrapeWithin(supabase, company, embedBudget, atsKeys);
  });

  return {
    totalCompanies: companies.length,
    scraped: results.filter((r) => r.status === 'success' || r.status === 'partial').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skippedForTime: results.filter((r) => r.status === 'skipped').length,
    totalJobs: results.reduce((s, r) => s + r.jobs, 0),
    embedded: results.reduce((s, r) => s + r.embedded, 0),
    results,
  };
}
