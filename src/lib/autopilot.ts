// ============================
// RADAR — ZERO-DAY: today's queue of applications
// ============================
// Built on demand, once a day (the /autopilot page asks for it when it opens): your best open matches in your exact
// cities that a form can be filled for without an account, ranked. Each job's answers are drafted when its turn comes
// (POST /api/apply/prepare, the same path as ↯ HACK), so nothing waits on a nightly job the 300 s limit could not finish.
// The extension fills each form, runs the pre-flight checks and, unless DRY RUN is on, presses the form's own Submit.

import type { SupabaseClient } from '@supabase/supabase-js';
import { inStrictCity, placeFit } from '@/lib/geo/city-companies';
import { tooSeniorFor } from '@/lib/ai/matcher';
import { applicationFormUrl } from '@/lib/apply/form';
import { jobKey } from '@/lib/scraper/utils';
import { splitList } from '@/lib/profile';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { PER_COMPANY } from '@/types';

/** Consents you can pre-approve, one class at a time. Arbitration and anything else always stay yours. */
export const CONSENTS = ['privacy', 'accurate', 'talent_pool'] as const;
export type Consent = (typeof CONSENTS)[number];

export interface AutopilotSettings {
  /** The extension's daily alarm opens /autopilot and starts the run. */
  enabled: boolean;
  /** Empty = the cities in your profile. */
  cities: string[];
  remote: boolean;
  /** Postings that name only the country ("India"). */
  countryOnly: boolean;
  /** Applications a day. */
  target: number;
  /** Form tabs at once. */
  concurrency: number;
  /** 'HH:MM', your local time. */
  schedule: string;
  /** Fill and check everything, never press Submit. */
  dryRun: boolean;
  /** Applications to one company per day. */
  perCompany: number;
  consents: Consent[];
}

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  cities: [],
  remote: false,
  countryOnly: false,
  target: 50,
  concurrency: 2,
  schedule: '10:00',
  dryRun: false,
  perCompany: 2,
  consents: [],
};

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

/** Settings from storage or a request: every field checked, anything unknown dropped. Pure. */
export function cleanAutopilot(raw: unknown): AutopilotSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AUTOPILOT;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    enabled: bool(r.enabled, d.enabled),
    cities: Array.isArray(r.cities)
      ? [...new Set(r.cities.filter((c): c is string => typeof c === 'string').map((c) => c.trim().slice(0, 60)))]
          .filter(Boolean)
          .slice(0, 10)
      : d.cities,
    remote: bool(r.remote, d.remote),
    countryOnly: bool(r.countryOnly, d.countryOnly),
    target: clamp(r.target, 1, 50, d.target),
    concurrency: clamp(r.concurrency, 1, 3, d.concurrency),
    schedule: typeof r.schedule === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule) ? r.schedule : d.schedule,
    dryRun: bool(r.dryRun, d.dryRun),
    perCompany: clamp(r.perCompany, 1, 5, d.perCompany),
    consents: Array.isArray(r.consents) ? CONSENTS.filter((c) => (r.consents as unknown[]).includes(c)) : d.consents,
  };
}

/** Sites where applying needs an account and a password: never automated (they are left to you). */
export const ACCOUNT_WALL = new Set(['workday', 'amazon']);

export interface QueueCandidate {
  matchId: string;
  jobId: string;
  score: number;
  status: string;
  title: string;
  company: string;
  location: string | null;
  workType: string | null;
  experience: string | null;
  provider: string | null;
  postedAt: string | null;
  isActive: boolean;
  /** A tailored resume OVERCLOCK already made for this job. */
  tailored: boolean;
}

export interface PickOptions {
  settings: AutopilotSettings;
  /** The cities to use (settings.cities, else the profile's). */
  cities: string[];
  bar: number;
  years: number;
  /** Company + title of everything applied to in the last 60 days. */
  applied: { company: string; title: string }[];
  /** Applications per company (lowercase name), all time: at PER_COMPANY a company is done. */
  appliedPerCompany: Map<string, number>;
  limit: number;
}

const companyOf = (c: { company: string }) => c.company.trim().toLowerCase();

/** Why a match is not for autopilot today, or null when it is. Pure. */
export function notEligible(c: QueueCandidate, o: Omit<PickOptions, 'limit'>): string | null {
  if (!c.isActive) return 'posting closed';
  if (c.status === 'applied' || c.status === 'dismissed') return 'already handled';
  if (!inStrictCity(o.cities, c.location, c.workType, o.settings)) return 'outside your cities';
  if (c.provider && ACCOUNT_WALL.has(c.provider)) return 'needs an account';
  if (tooSeniorFor(c.experience, o.years)) return 'too senior';
  // Below your Vault bar only with a resume OVERCLOCK already tailored for it (50–79).
  if (c.score < o.bar && !(c.tailored && c.score >= 50)) return 'below your bar';
  const key = jobKey(c.company, c.title);
  if (o.applied.some((a) => jobKey(a.company, a.title) === key)) return 'applied in the last 60 days';
  if ((o.appliedPerCompany.get(companyOf(c)) || 0) >= PER_COMPANY) return `${PER_COMPANY} applications there already`;
  return null;
}

/**
 * Today's queue: eligible matches, best first, one per company + title, at most `perCompany` per company today, and
 * never past PER_COMPANY applications at a company in all. Pure.
 */
export function pickQueue(candidates: QueueCandidate[], o: PickOptions): QueueCandidate[] {
  const ranked = candidates
    .filter((c) => !notEligible(c, o))
    .sort((a, b) => b.score - a.score || Date.parse(b.postedAt || '0') - Date.parse(a.postedAt || '0'));
  const seen = new Set<string>();
  const perCompany = new Map<string, number>();
  const picks: QueueCandidate[] = [];
  for (const c of ranked) {
    const key = jobKey(c.company, c.title);
    const company = companyOf(c);
    const today = perCompany.get(company) || 0;
    if (seen.has(key) || today >= o.settings.perCompany) continue;
    if ((o.appliedPerCompany.get(company) || 0) + today >= PER_COMPANY) continue;
    seen.add(key);
    perCompany.set(company, (perCompany.get(company) || 0) + 1);
    picks.push(c);
    if (picks.length >= o.limit) break;
  }
  return picks;
}

/** Supply per city for the HUD: eligible now, and of those posted in the last day / week. Pure. */
export function supplyByCity(candidates: QueueCandidate[], o: Omit<PickOptions, 'limit'>, now = Date.now()) {
  const out: Record<string, { open: number; today: number; week: number }> = {};
  for (const c of candidates) {
    if (notEligible(c, o)) continue;
    const fit = placeFit(o.cities, c.location, c.workType);
    const city = fit.kind === 'city' ? fit.city : fit.kind === 'remote' ? 'Remote' : 'Country-wide';
    const age = c.postedAt ? (now - Date.parse(c.postedAt)) / 86_400_000 : Infinity;
    const row = (out[city] ||= { open: 0, today: 0, week: 0 });
    row.open++;
    if (age <= 1) row.today++;
    if (age <= 7) row.week++;
  }
  return out;
}

/** Today's date in India (the queue's day), YYYY-MM-DD. */
export const runDate = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export const MIGRATION_HINT = 'ZERO-DAY needs migration 010. Run supabase/migrations/010_autopilot.sql.';

/** Your settings, cities, bar and every candidate match. Null when the migration has not run. */
export async function loadAutopilot(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('autopilot, location, experience_years, is_fresher, vault_min_score')
    .eq('id', userId)
    .maybeSingle();
  if (isSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);
  if (!profile) throw new Error('Complete onboarding first.');
  const settings = cleanAutopilot(profile.autopilot);
  const cities = settings.cities.length ? settings.cities : splitList(profile.location);

  type Row = {
    id: string;
    job_id: string;
    score: number;
    status: string;
    applied_at: string | null;
    jobs: {
      title: string;
      employer: string | null;
      location: string | null;
      work_type: string | null;
      experience_required: string | null;
      posted_at: string | null;
      is_active: boolean;
      companies: { name: string; ats_provider: string | null };
    };
  };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase
      .from('match_scores')
      .select(
        'id, job_id, score, status, applied_at, jobs!inner(title, employer, location, work_type, experience_required, posted_at, is_active, companies!inner(name, ats_provider))',
      )
      .eq('user_id', userId)
      .range(from, from + 999);
    if (e) throw new Error(e.message);
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const { data: tailored } = await supabase.from('tailored_resumes').select('id, job_id').eq('user_id', userId);
  const tailoredByJob = new Map((tailored || []).map((t) => [t.job_id as string, t.id as string]));

  const since = Date.now() - 60 * 86_400_000;
  const company = (r: Row) => r.jobs.employer || r.jobs.companies.name;
  const candidates: QueueCandidate[] = rows.map((r) => ({
    matchId: r.id,
    jobId: r.job_id,
    score: r.score,
    status: r.status,
    title: r.jobs.title,
    company: company(r),
    location: r.jobs.location,
    workType: r.jobs.work_type,
    experience: r.jobs.experience_required,
    provider: r.jobs.companies.ats_provider,
    postedAt: r.jobs.posted_at,
    isActive: r.jobs.is_active,
    tailored: tailoredByJob.has(r.job_id),
  }));
  const options: Omit<PickOptions, 'limit'> = {
    settings,
    cities,
    bar: profile.vault_min_score ?? 80,
    years: profile.is_fresher ? 0 : (profile.experience_years ?? 0),
    applied: rows
      .filter((r) => r.status === 'applied' && (!r.applied_at || Date.parse(r.applied_at) >= since))
      .map((r) => ({ company: company(r), title: r.jobs.title })),
    appliedPerCompany: new Map<string, number>(),
  };
  for (const c of candidates)
    if (c.status === 'applied')
      options.appliedPerCompany.set(companyOf(c), (options.appliedPerCompany.get(companyOf(c)) || 0) + 1);
  return { settings, cities, candidates, options, tailoredByJob };
}

const QUEUE_COLUMNS =
  'id, match_id, rank, status, reason, form_url, ats_provider, tailored_id, attempts, started_at, finished_at, confirmation, match_scores!inner(score, jobs!inner(title, employer, location, apply_url, companies!inner(name, ats_identifier)))';

/** Today's jobs ZERO-DAY left to you (the dashboard's NEEDS YOU panel). Null when migration 010 has not run. */
export async function parkedToday(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('apply_queue')
    .select(QUEUE_COLUMNS)
    .eq('user_id', userId)
    .eq('run_date', runDate())
    .in('status', ['needs_you', 'failed'])
    .order('rank');
  if (isSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Today's queue, building it the first time it is asked for (idempotent: one per day). */
export async function todaysQueue(supabase: SupabaseClient, userId: string, build: boolean) {
  const loaded = await loadAutopilot(supabase, userId);
  if (!loaded) return null;
  const day = runDate();
  const read = () =>
    supabase.from('apply_queue').select(QUEUE_COLUMNS).eq('user_id', userId).eq('run_date', day).order('rank');
  let { data: queue, error } = await read();
  if (isSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);

  if (build && !queue?.length) {
    const picks = pickQueue(loaded.candidates, { ...loaded.options, limit: Math.ceil(loaded.settings.target * 1.2) });
    if (picks.length) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, external_id, apply_url, companies!inner(ats_provider, ats_identifier)')
        .in(
          'id',
          picks.map((p) => p.jobId),
        );
      const byId = new Map((jobs || []).map((j) => [j.id as string, j]));
      const insert = picks.map((p, i) => {
        const job = byId.get(p.jobId) as
          | {
              external_id: string;
              apply_url: string;
              companies: { ats_provider: string | null; ats_identifier: string | null };
            }
          | undefined;
        return {
          user_id: userId,
          match_id: p.matchId,
          job_id: p.jobId,
          run_date: day,
          rank: i + 1,
          ats_provider: p.provider,
          tailored_id: loaded.tailoredByJob.get(p.jobId) ?? null,
          form_url: job
            ? applicationFormUrl({
                provider: job.companies.ats_provider,
                identifier: job.companies.ats_identifier,
                externalId: job.external_id,
                applyUrl: job.apply_url,
              })
            : null,
        };
      });
      const { error: e } = await supabase
        .from('apply_queue')
        .upsert(insert, { onConflict: 'user_id,match_id,run_date' });
      if (e) throw new Error(e.message);
      ({ data: queue, error } = await read());
      if (error) throw new Error(error.message);
    }
  }
  return {
    settings: loaded.settings,
    cities: loaded.cities,
    day,
    queue: queue || [],
    supply: supplyByCity(loaded.candidates, loaded.options),
  };
}
