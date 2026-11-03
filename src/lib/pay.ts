// ============================
// RADAR — PAY INTEL: what similar roles pay, read from RADAR's own jobs
// ============================
// Postings that publish pay (ATS feeds, pay written in the JD) are market data RADAR already holds. For one
// job, RADAR takes the open roles with the same core title words and the same level, keeps those that state pay in
// one currency, and reads the spread. No third-party salary data, nothing to license; the sample size is always shown.
// Title words, not vectors: the band is read every time a JD opens, and a vector neighbour search took ~2 s on
// 2.7k vectors (2026-10-30) where this query takes ~150 ms.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PayBand {
  currency: string;
  p25: number;
  p50: number;
  p75: number;
  /** Similar postings the band is read from. */
  n: number;
}

/** Fewer similar roles than this with pay, and the spread is noise. */
export const MIN_SAMPLE = 5;

// Pay below the floor is hourly or monthly, not a year's salary.
// ponytail: annual floors only; monthly INR or JPY above the floor slips through. Store a pay period if bands skew.
const ANNUAL_FLOOR: Record<string, number> = { INR: 100_000, JPY: 1_000_000 };

type PayRow = { salary_min: number | null; salary_max: number | null; salary_currency: string | null };

const at = (sorted: number[], p: number) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return Math.round(sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo));
};

/** Postings' pay → the 25th, 50th and 75th percentile of their midpoints in one currency, or null when too few. Pure. */
export function payBand(rows: PayRow[], currency: string): PayBand | null {
  const floor = ANNUAL_FLOOR[currency] ?? 10_000;
  const mids = rows
    .filter((r) => r.salary_currency === currency)
    .map((r) => (r.salary_min && r.salary_max ? (r.salary_min + r.salary_max) / 2 : r.salary_min || r.salary_max || 0))
    .filter((m) => m >= floor)
    .sort((a, b) => a - b);
  if (mids.length < MIN_SAMPLE) return null;
  return { currency, p25: at(mids, 0.25), p50: at(mids, 0.5), p75: at(mids, 0.75), n: mids.length };
}

// First match wins: "Senior Engineering Manager" is a manager, "Senior Staff Engineer" a lead.
const LEVELS: [string, RegExp][] = [
  ['intern', /\b(intern|internship|trainee|apprentice)\b/i],
  ['junior', /\b(junior|jr|entry[- ]level|graduate|new grad)\b/i],
  ['manager', /\b(manager|head|director|vp|chief)\b/i],
  ['lead', /\b(staff|principal|lead|architect)\b/i],
  ['senior', /\b(senior|sr)\b/i],
];
/** The level a title signals; plain titles are 'mid'. */
export const titleLevel = (title: string) => LEVELS.find(([, re]) => re.test(title))?.[0] ?? 'mid';

const NOISE = new Set(
  'senior sr junior jr lead staff principal intern internship trainee apprentice entry level graduate new grad associate ii iii iv the and of for in at with to an remote hybrid onsite contract'.split(
    ' ',
  ),
);
/** The core of a title as search words: "Senior Backend Engineer - Payments" → ["backend", "engineer"]. Pure. */
export function roleWords(title: string): string[] {
  const core = title.split(/[,(|:/–—]| - /)[0].toLowerCase();
  return [...new Set(core.match(/[a-z][a-z+#.]*/g) || [])].filter((w) => w.length > 1 && !NOISE.has(w)).slice(0, 3);
}

/**
 * The pay band of open roles like this job, in `currency` (the job's own when it states pay, else the user's).
 * Null without a currency, or when too few similar roles state pay.
 * ponytail: title words, not meaning ("Product Manager" levels as a manager); vector neighbours, precomputed by the
 * cron, if bands look off.
 */
export async function marketBand(
  supabase: SupabaseClient,
  job: { id: string; title: string },
  currency: string | null,
): Promise<PayBand | null> {
  const words = roleWords(job.title);
  if (!currency || !words.length) return null;
  let query = supabase
    .from('jobs')
    .select('id, title, salary_min, salary_max, salary_currency')
    .eq('is_active', true)
    .eq('salary_currency', currency);
  for (const w of words) query = query.ilike('title', `%${w}%`);
  const { data, error } = await query.limit(1000);
  if (error) throw new Error('Reading pay failed: ' + error.message);
  const level = titleLevel(job.title);
  return payBand(
    (data || []).filter((r) => r.id !== job.id && titleLevel(r.title) === level),
    currency,
  );
}
