// ============================
// RADAR — Scrape pipeline
// ============================
// Pulls every scrapeable company/source, upserts jobs, embeds only new or changed jobs,
// and deactivates jobs that disappeared from their source. Runs within a time budget and
// starts with the least recently scraped companies, so a cut-short run resumes next time.

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scrapeCompany, type ScrapedJob } from '@/lib/scraper/adapters';
import { mapLimit } from '@/lib/scraper/utils';
import { ensureCompaniesSeeded } from '@/lib/scraper/seed';
import { deleteJobVectors, upsertJobVectors } from '@/lib/ai/embeddings';

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
}

const CONCURRENCY = Number(process.env.RADAR_SCRAPE_CONCURRENCY || 4);

function hashJob(j: ScrapedJob): string {
  return createHash('sha1').update([j.title, j.location, j.apply_url, j.description].join('\u0001')).digest('hex');
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

async function scrapeOne(
  supabase: SupabaseClient,
  company: CompanyRow,
  embedBudget: { left: number },
): Promise<CompanyScrapeResult> {
  const start = Date.now();
  const runStartedAt = new Date(start).toISOString();
  const base = { company: company.name, provider: company.ats_provider };

  try {
    const scraped = await scrapeCompany(company.ats_provider, company.ats_identifier);
    const unique = [...new Map(scraped.map((j) => [j.external_id, j])).values()];

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
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((r) => r.row);
        const { data, error } = await supabase
          .from('jobs')
          .upsert(chunk, { onConflict: 'company_id,external_id' })
          .select('id, external_id');
        if (error) throw new Error('Job upsert failed: ' + error.message);
        for (const d of data || []) idByExternal.set(d.external_id, d.id);
      }

      const needsEmbedding = rows
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
        for (let i = 0; i < needsEmbedding.length; i += 200) {
          const chunk = needsEmbedding.slice(i, i + 200).map((r) => ({ ...r.row, content_hash: r.hash }));
          const { error } = await supabase.from('jobs').upsert(chunk, { onConflict: 'company_id,external_id' });
          if (error) console.error('[SCRAPE]', company.name, 'hash update failed:', error.message);
        }
      }

      // Anything from this company we did not see in this run has been taken down.
      const { data: gone, error: staleErr } = await supabase
        .from('jobs')
        .update({ is_active: false })
        .eq('company_id', company.id)
        .eq('is_active', true)
        .lt('scraped_at', runStartedAt)
        .select('id');
      if (staleErr) console.error('[SCRAPE]', company.name, 'stale cleanup failed:', staleErr.message);
      deactivated = gone?.length || 0;
      if (deactivated) {
        await deleteJobVectors(gone!.map((g) => g.id)).catch((e) =>
          console.error('[SCRAPE]', company.name, 'vector cleanup failed:', e instanceof Error ? e.message : e),
        );
      }
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

export async function runScrape(
  supabase: SupabaseClient,
  opts: { budgetMs?: number; companyIds?: string[] } = {},
): Promise<ScrapeSummary> {
  const deadline = Date.now() + (opts.budgetMs ?? 200_000);
  await ensureCompaniesSeeded(supabase);

  let query = supabase
    .from('companies')
    .select('id, name, ats_provider, ats_identifier')
    .eq('is_active', true)
    .not('ats_provider', 'is', null)
    .neq('ats_provider', 'custom')
    .order('last_scraped_at', { ascending: true, nullsFirst: true });
  if (opts.companyIds?.length) query = query.in('id', opts.companyIds);

  const { data: companies, error } = await query;
  if (error || !companies) throw new Error('Failed to load companies: ' + (error?.message || 'no data'));

  const embedBudget = { left: Number(process.env.RADAR_MAX_EMBEDS_PER_RUN || 2000) };
  const results = await mapLimit(companies as CompanyRow[], CONCURRENCY, async (company) => {
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
    return scrapeOne(supabase, company, embedBudget);
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
