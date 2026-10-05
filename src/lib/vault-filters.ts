// ============================
// RADAR — Vault lanes and filters (pure, shared by the dashboard and its tests)
// ============================
// Lanes split the Vault by who is hiring (startup, scale-up, MNC, your dream picks, or a job board that did not
// say). Filters narrow by the years a posting really asks for, where RADAR read it, and pay. Every option and
// count is derived from the jobs you have, so the menus update themselves after each scan.

import type { MatchedJob } from '@/components/dashboard/types';

export type VaultLane = 'all' | 'dream' | 'startup' | 'growth' | 'mnc' | 'board';
export type PayFilter = 'any' | 'disclosed' | 'lpa5' | 'lpa10' | 'lpa20';
export type VaultSort = 'score' | 'pay' | 'newest';
/** Minimum years a posting asks for: 0 (fresher) … 5 (5 or more), or 'none' when it never says. */
export type ExpBucket = '0' | '1' | '2' | '3' | '4' | '5' | 'none';

export interface VaultFilters {
  lane: VaultLane;
  exp: ExpBucket[];
  source: string | null;
  pay: PayFilter;
  sort: VaultSort;
}

export const DEFAULT_FILTERS: VaultFilters = { lane: 'all', exp: [], source: null, pay: 'any', sort: 'score' };

/** What the JD says about experience, read on the server: "3–5 yrs" and its lower bound. */
export interface StatedExperience {
  text: string | null;
  min: number | null;
}

export const LANES: { key: VaultLane; label: string; hint: string }[] = [
  { key: 'all', label: 'ALL', hint: 'everything in the Vault' },
  { key: 'startup', label: 'STARTUPS', hint: 'early-stage teams' },
  { key: 'growth', label: 'GROWTH', hint: 'funded scale-ups' },
  { key: 'mnc', label: 'MNC', hint: 'big companies' },
  { key: 'dream', label: 'DREAM', hint: 'your picked companies' },
  { key: 'board', label: 'JOB BOARDS', hint: 'company size not given' },
];

export const PAY_OPTIONS: { key: PayFilter; label: string; lpa: number | null }[] = [
  { key: 'any', label: 'ANY', lpa: null },
  { key: 'disclosed', label: 'DISCLOSED', lpa: null },
  { key: 'lpa5', label: '₹5L+', lpa: 5 },
  { key: 'lpa10', label: '₹10L+', lpa: 10 },
  { key: 'lpa20', label: '₹20L+', lpa: 20 },
];

export const EXP_BUCKETS: { key: ExpBucket; label: string }[] = [
  { key: '0', label: 'FRESHER' },
  { key: '1', label: '1 YR' },
  { key: '2', label: '2 YRS' },
  { key: '3', label: '3 YRS' },
  { key: '4', label: '4 YRS' },
  { key: '5', label: '5+ YRS' },
  { key: 'none', label: 'NOT STATED' },
];

/** Which lanes a job belongs to besides ALL. A dream company also stays in its size lane. */
export function lanesOf(m: MatchedJob): VaultLane[] {
  const lanes: VaultLane[] = [];
  if (m.section === 'dream') lanes.push('dream');
  const c = m.job.company.category;
  if (c === 'Startup') lanes.push('startup');
  else if (c === 'Growth') lanes.push('growth');
  else if (c === 'MNC') lanes.push('mnc');
  else lanes.push('board');
  return lanes;
}

const YEARS_RE = /\b(\d{1,2})\s*\+?\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b/i;

/**
 * The years a JD states, exactly as written but tidied ("3 to 5 years" → "3–5 yrs", "2+ years" → "2+ yrs").
 * Falls back to the title (intern, fresher, junior) and then to the bucket stored at scrape time.
 * Numbers above 20 are ignored: "25 years of history" is about the company, not you.
 */
export function statedExperience(title: string, description: string, bucket: string | null): StatedExperience {
  const text = description.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  for (const m of text.matchAll(new RegExp(YEARS_RE, 'gi'))) {
    const min = parseInt(m[1], 10);
    const max = m[2] ? parseInt(m[2], 10) : null;
    if (min > 20 || (max !== null && (max > 20 || max < min))) continue;
    const plus = /\+/.test(m[0]) && max === null;
    return {
      text: max !== null ? `${min}–${max} yrs` : `${min}${plus ? '+' : ''} ${min === 1 && !plus ? 'yr' : 'yrs'}`,
      min,
    };
  }
  if (/\b(intern|internship|trainee|apprentice|new grad|graduate|fresher|entry[- ]level)\b/i.test(title)) {
    return { text: 'Fresher', min: 0 };
  }
  if (bucket === 'fresher') return { text: 'Fresher', min: 0 };
  if (bucket === '0-1') return { text: '0–1 yrs', min: 0 };
  return { text: null, min: null };
}

/** Lower bound in years, from the JD when RADAR read it, else from the stored bucket. */
export function minYears(m: MatchedJob, stated?: StatedExperience): number | null {
  if (stated) return stated.min;
  const b = m.job.experience_required;
  if (b === 'fresher' || b === '0-1') return 0;
  if (b === '1-3') return 1;
  if (b === '3-5') return 3;
  if (b === '5+') return 5;
  return null;
}

export function expBucket(m: MatchedJob, stated?: StatedExperience): ExpBucket {
  const y = minYears(m, stated);
  if (y === null) return 'none';
  return String(Math.min(5, Math.max(0, y))) as ExpBucket;
}

/** Pay in lakhs per year for INR postings (the upper end when given); null for other currencies or none. */
export function payLpa(m: MatchedJob): number | null {
  const { salary_min, salary_max, salary_currency } = m.job;
  if (salary_currency !== 'INR') return null;
  const top = Math.max(salary_min || 0, salary_max || 0);
  return top >= 100_000 ? top / 100_000 : null;
}

export const hasPay = (m: MatchedJob) => !!(m.job.salary_min || m.job.salary_max);

export function passesPay(m: MatchedJob, pay: PayFilter): boolean {
  if (pay === 'any') return true;
  if (pay === 'disclosed') return hasPay(m);
  const floor = PAY_OPTIONS.find((p) => p.key === pay)?.lpa ?? 0;
  const lpa = payLpa(m);
  return lpa !== null && lpa >= floor;
}

type Stated = Record<string, StatedExperience>;
type Except = 'lane' | 'exp' | 'source' | 'pay';

/** Every filter but `except`: so each menu counts what you would get by changing only that menu. */
function passes(m: MatchedJob, f: VaultFilters, stated: Stated, except?: Except): boolean {
  if (except !== 'lane' && f.lane !== 'all' && !lanesOf(m).includes(f.lane)) return false;
  if (except !== 'exp' && f.exp.length && !f.exp.includes(expBucket(m, stated[m.job.id]))) return false;
  if (except !== 'source' && f.source && (m.job.company.provider || 'unknown') !== f.source) return false;
  if (except !== 'pay' && !passesPay(m, f.pay)) return false;
  return true;
}

const posted = (m: MatchedJob) => (m.job.posted_at ? Date.parse(m.job.posted_at) : 0);

/**
 * The Vault after lanes and filters. `base` keeps the page's own order (already-applied companies sink, then
 * score); PAY puts the best-paid INR postings first, then other disclosed pay; NEWEST goes by posting date.
 */
export function applyVaultFilters(list: MatchedJob[], f: VaultFilters, stated: Stated = {}): MatchedJob[] {
  const out = list.filter((m) => passes(m, f, stated));
  if (f.sort === 'pay') {
    const rank = (m: MatchedJob) => payLpa(m) ?? (hasPay(m) ? -1 : -2);
    return out.sort((a, b) => rank(b) - rank(a));
  }
  if (f.sort === 'newest') return out.sort((a, b) => posted(b) - posted(a));
  return out;
}

export interface VaultFacets {
  lanes: Record<VaultLane, number>;
  exp: Record<ExpBucket, number>;
  sources: { key: string; count: number }[];
  pay: Record<PayFilter, number>;
}

/** Counts for every menu, each one ignoring its own selection, so an option never shows a misleading 0. */
export function vaultFacets(list: MatchedJob[], f: VaultFilters, stated: Stated = {}): VaultFacets {
  const lanes = Object.fromEntries(LANES.map((l) => [l.key, 0])) as Record<VaultLane, number>;
  const exp = Object.fromEntries(EXP_BUCKETS.map((e) => [e.key, 0])) as Record<ExpBucket, number>;
  const pay = Object.fromEntries(PAY_OPTIONS.map((p) => [p.key, 0])) as Record<PayFilter, number>;
  const sources = new Map<string, number>();
  for (const m of list) {
    lanes.all++;
    for (const l of lanesOf(m)) lanes[l]++;
    if (passes(m, f, stated, 'exp')) exp[expBucket(m, stated[m.job.id])]++;
    if (passes(m, f, stated, 'source')) {
      const key = m.job.company.provider || 'unknown';
      sources.set(key, (sources.get(key) || 0) + 1);
    }
    if (passes(m, f, stated, 'pay')) for (const p of PAY_OPTIONS) if (passesPay(m, p.key)) pay[p.key]++;
  }
  return {
    lanes,
    exp,
    pay,
    sources: [...sources].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
  };
}

/** The filters as a shell command, for the console line: `vault --lane startup --exp 1,2 --pay 10L+`. */
export function filterCommand(f: VaultFilters): string {
  const parts = ['vault'];
  if (f.lane !== 'all') parts.push('--lane ' + f.lane);
  if (f.exp.length)
    parts.push('--exp ' + f.exp.map((e) => (e === 'none' ? 'unstated' : e === '5' ? '5+' : e)).join(','));
  if (f.source) parts.push('--src ' + f.source);
  if (f.pay !== 'any')
    parts.push('--pay ' + (f.pay === 'disclosed' ? 'disclosed' : PAY_OPTIONS.find((p) => p.key === f.pay)?.lpa + 'L+'));
  if (f.sort !== 'score') parts.push('--sort ' + f.sort);
  return parts.join(' ');
}

export const isDefault = (f: VaultFilters) =>
  f.lane === 'all' && !f.exp.length && !f.source && f.pay === 'any' && f.sort === 'score';

/** Restores saved filters, dropping anything an older or hand-edited value could not mean. */
export function parseFilters(raw: string | null): VaultFilters {
  try {
    const v = JSON.parse(raw || '{}') as Partial<VaultFilters>;
    const ok = <T extends string>(x: unknown, allowed: readonly T[], d: T): T =>
      allowed.includes(x as T) ? (x as T) : d;
    return {
      lane: ok(
        v.lane,
        LANES.map((l) => l.key),
        'all',
      ),
      exp: Array.isArray(v.exp) ? v.exp.filter((e): e is ExpBucket => EXP_BUCKETS.some((b) => b.key === e)) : [],
      source: typeof v.source === 'string' && v.source ? v.source : null,
      pay: ok(
        v.pay,
        PAY_OPTIONS.map((p) => p.key),
        'any',
      ),
      sort: ok(v.sort, ['score', 'pay', 'newest'] as const, 'score'),
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}
