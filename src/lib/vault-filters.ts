// ============================
// RADAR — Signal filters for the Vault and Discovery (pure: the dashboard, its tests and the server share it)
// ============================
// Lanes split the Vault by who is hiring (startup, scale-up, MNC, your dream picks, or a job board that did not say).
// Filters narrow any list by when a job reached you, where RADAR read it (your alert emails, company careers, job
// boards, your own finds), the years a posting really asks for, and pay. Every option and count is derived from the
// jobs you have, so the menus update themselves after each cycle.

import type { MatchedJob } from '@/components/dashboard/types';
import { SOURCE_NAMES } from '@/lib/scraper/catalog';
import { BOARD_PROVIDERS, PER_COMPANY } from '@/types';

export type VaultLane = 'all' | 'dream' | 'startup' | 'growth' | 'mnc' | 'board';
export type PayFilter = 'any' | 'disclosed' | 'lpa5' | 'lpa10' | 'lpa20';
export type VaultSort = 'score' | 'pay' | 'newest';
/** Minimum years a posting asks for: 0 (fresher) … 5 (5 or more), or 'none' when it never says. */
export type ExpBucket = '0' | '1' | '2' | '3' | '4' | '5' | 'none';
/** Where a job reached RADAR. */
export type Origin = 'alert' | 'ats' | 'board' | 'yours';
/** Days since a job reached you, by your calendar: 0 today … 6, and 7 for a week or more ago. */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SignalFilters {
  lane: VaultLane;
  /** Arrival days to keep; empty = any day. */
  days: Day[];
  /** Source keys (providers) to keep; empty = every source. */
  sources: string[];
  exp: ExpBucket[];
  pay: PayFilter;
  sort: VaultSort;
}

export const DEFAULT_FILTERS: SignalFilters = {
  lane: 'all',
  days: [],
  sources: [],
  exp: [],
  pay: 'any',
  sort: 'score',
};

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
  { key: 'any', label: 'Any pay', lpa: null },
  { key: 'disclosed', label: 'Pay disclosed', lpa: null },
  { key: 'lpa5', label: '₹5L+', lpa: 5 },
  { key: 'lpa10', label: '₹10L+', lpa: 10 },
  { key: 'lpa20', label: '₹20L+', lpa: 20 },
];

export const EXP_BUCKETS: { key: ExpBucket; label: string; short: string }[] = [
  { key: '0', label: 'Fresher', short: '0' },
  { key: '1', label: '1 year', short: '1' },
  { key: '2', label: '2 years', short: '2' },
  { key: '3', label: '3 years', short: '3' },
  { key: '4', label: '4 years', short: '4' },
  { key: '5', label: '5+ years', short: '5+' },
  { key: 'none', label: 'Not stated', short: '?' },
];

export const DAYS: Day[] = [7, 6, 5, 4, 3, 2, 1, 0];

// ---- Sources ----

export const ORIGINS: { key: Origin; label: string; hint: string }[] = [
  { key: 'alert', label: 'Your alerts', hint: 'Indeed, LinkedIn and Welcome to the Jungle emails in your Gmail' },
  { key: 'ats', label: 'Company careers', hint: 'read from each employer’s own hiring system' },
  { key: 'board', label: 'Job boards', hint: 'search APIs and public feeds' },
  { key: 'yours', label: 'Your finds', hint: 'pages you opened with the extension, and mail RADAR filed' },
];

const ALERT_SOURCES = new Set(['indeed_email', 'linkedin_email', 'wttj_email']);
export const ALERT_SOURCE_KEYS = [...ALERT_SOURCES];

/** The source a match was read from: its provider, or 'custom' for your own finds. */
export const sourceOf = (m: MatchedJob) => m.job.company.provider || 'custom';

export function originOf(source: string): Origin {
  if (source === 'custom') return 'yours';
  if (ALERT_SOURCES.has(source)) return 'alert';
  return (BOARD_PROVIDERS as readonly string[]).includes(source) ? 'board' : 'ats';
}

const SHORT_NAMES: Record<string, string> = {
  indeed_email: 'Indeed',
  linkedin_email: 'LinkedIn',
  wttj_email: 'Welcome to the Jungle',
  custom: 'Your finds',
};

/** A source's display name: "LinkedIn" for its alert emails, "Greenhouse", "Adzuna". */
export const sourceTitle = (source: string) =>
  SHORT_NAMES[source] ?? SOURCE_NAMES[source as keyof typeof SOURCE_NAMES] ?? source;

// ---- Presets ----

export const PRESETS: { key: string; label: string; hint: string; filters: Partial<SignalFilters> }[] = [
  {
    key: 'alerts-today',
    label: 'Today’s alerts',
    hint: 'jobs from your Gmail alerts that reached you today',
    filters: { days: [0], sources: ALERT_SOURCE_KEYS },
  },
  {
    key: 'fresh',
    label: 'Last 48 hours',
    hint: 'everything that reached you today or yesterday',
    filters: { days: [0, 1] },
  },
  {
    key: 'early',
    label: 'Up to 1 year',
    hint: 'roles asking for at most a year of experience',
    filters: { exp: ['0', '1'] },
  },
  {
    key: 'paid',
    label: '₹10L+ first',
    hint: 'disclosed INR pay of ₹10L a year or more',
    filters: { pay: 'lpa10', sort: 'pay' },
  },
];

const sameSet = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The filters a preset stands for: the preset on top of the defaults, keeping your lane. */
export const presetFilters = (preset: (typeof PRESETS)[number], lane: VaultLane): SignalFilters => ({
  ...DEFAULT_FILTERS,
  ...preset.filters,
  lane,
});

export function isPreset(f: SignalFilters, preset: (typeof PRESETS)[number]): boolean {
  const p = presetFilters(preset, f.lane);
  return (
    sameSet(f.days, p.days) &&
    sameSet(f.sources, p.sources) &&
    sameSet(f.exp, p.exp) &&
    f.pay === p.pay &&
    f.sort === p.sort
  );
}

// ---- Facts about one match ----

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

const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);

/** Days since the job reached you (its match was first scored; else its posting date), capped at 7. */
export function arrivalDay(m: MatchedJob, now = Date.now()): Day {
  const at = Date.parse(m.first_seen_at || m.job.posted_at || '');
  if (Number.isNaN(at)) return 7;
  return Math.min(7, Math.max(0, Math.round((midnight(now) - midnight(at)) / 86_400_000))) as Day;
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

// ---- Filtering ----

type Stated = Record<string, StatedExperience>;
type Facet = 'lane' | 'days' | 'sources' | 'exp' | 'pay';

/** Every filter but `except`: so each menu counts what you would get by changing only that menu. */
function passes(m: MatchedJob, f: SignalFilters, stated: Stated, now: number, except?: Facet): boolean {
  if (except !== 'lane' && f.lane !== 'all' && !lanesOf(m).includes(f.lane)) return false;
  if (except !== 'days' && f.days.length && !f.days.includes(arrivalDay(m, now))) return false;
  if (except !== 'sources' && f.sources.length && !f.sources.includes(sourceOf(m))) return false;
  if (except !== 'exp' && f.exp.length && !f.exp.includes(expBucket(m, stated[m.job.id]))) return false;
  if (except !== 'pay' && !passesPay(m, f.pay)) return false;
  return true;
}

const posted = (m: MatchedJob) => Date.parse(m.job.posted_at || m.first_seen_at || '') || 0;

/**
 * A list after its filters. MATCH keeps the list's own order (the page sinks companies you applied to, then sorts by
 * score); PAY puts the best-paid INR postings first, then other disclosed pay; NEWEST goes by posting date.
 */
export function applyFilters(
  list: MatchedJob[],
  f: SignalFilters,
  stated: Stated = {},
  now = Date.now(),
): MatchedJob[] {
  const out = list.filter((m) => passes(m, f, stated, now));
  if (f.sort === 'pay') {
    const rank = (m: MatchedJob) => payLpa(m) ?? (hasPay(m) ? -1 : -2);
    return out.sort((a, b) => rank(b) - rank(a));
  }
  if (f.sort === 'newest') return out.sort((a, b) => posted(b) - posted(a));
  return out;
}

export interface SignalFacets {
  lanes: Record<VaultLane, number>;
  /** Jobs per arrival day, indexed by Day (0 = today). */
  days: number[];
  /** Every source in the list, busiest first. */
  sources: { key: string; origin: Origin; count: number }[];
  origins: Record<Origin, number>;
  exp: Record<ExpBucket, number>;
  pay: Record<PayFilter, number>;
}

/** Counts for every menu, each one ignoring its own selection, so an option never shows a misleading 0. */
export function signalFacets(
  list: MatchedJob[],
  f: SignalFilters,
  stated: Stated = {},
  now = Date.now(),
): SignalFacets {
  const lanes = Object.fromEntries(LANES.map((l) => [l.key, 0])) as Record<VaultLane, number>;
  const exp = Object.fromEntries(EXP_BUCKETS.map((e) => [e.key, 0])) as Record<ExpBucket, number>;
  const pay = Object.fromEntries(PAY_OPTIONS.map((p) => [p.key, 0])) as Record<PayFilter, number>;
  const origins = Object.fromEntries(ORIGINS.map((o) => [o.key, 0])) as Record<Origin, number>;
  const days = new Array<number>(8).fill(0);
  const sources = new Map<string, number>();
  for (const m of list) {
    lanes.all++;
    for (const l of lanesOf(m)) lanes[l]++;
    if (passes(m, f, stated, now, 'days')) days[arrivalDay(m, now)]++;
    if (passes(m, f, stated, now, 'sources')) {
      const key = sourceOf(m);
      sources.set(key, (sources.get(key) || 0) + 1);
      origins[originOf(key)]++;
    }
    if (passes(m, f, stated, now, 'exp')) exp[expBucket(m, stated[m.job.id])]++;
    if (passes(m, f, stated, now, 'pay')) for (const p of PAY_OPTIONS) if (passesPay(m, p.key)) pay[p.key]++;
  }
  return {
    lanes,
    days,
    exp,
    pay,
    origins,
    sources: [...sources]
      .map(([key, count]) => ({ key, origin: originOf(key), count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---- The filters as a command line ----

/** "today", "3d" for a run of recent days, else the day list. */
function sinceText(days: Day[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 1 && sorted[0] === 0) return '--since today';
  if (sorted[0] === 0 && sorted.every((d, i) => d === i) && !sorted.includes(7)) return `--since ${sorted.length}d`;
  return '--day ' + sorted.map((d) => (d === 7 ? '7+' : String(d))).join(',');
}

/** The filters as a shell command, for the console line: `vault --since today --src linkedin.mail --pay 10L+`. */
export function filterCommand(f: SignalFilters, scope = 'vault'): string {
  const parts = [scope];
  if (f.lane !== 'all') parts.push('--lane ' + f.lane);
  if (f.days.length) parts.push(sinceText(f.days));
  if (f.sources.length) parts.push('--src ' + f.sources.map((s) => s.replace(/_email$/, '.mail')).join(','));
  if (f.exp.length)
    parts.push('--exp ' + f.exp.map((e) => (e === 'none' ? 'unstated' : e === '5' ? '5+' : e)).join(','));
  if (f.pay !== 'any')
    parts.push('--pay ' + (f.pay === 'disclosed' ? 'disclosed' : PAY_OPTIONS.find((p) => p.key === f.pay)?.lpa + 'L+'));
  if (f.sort !== 'score') parts.push('--sort ' + f.sort);
  return parts.join(' ');
}

export const activeCount = (f: SignalFilters) =>
  (f.lane !== 'all' ? 1 : 0) +
  (f.days.length ? 1 : 0) +
  (f.sources.length ? 1 : 0) +
  (f.exp.length ? 1 : 0) +
  (f.pay !== 'any' ? 1 : 0);

export const isDefault = (f: SignalFilters) => activeCount(f) === 0 && f.sort === 'score';

/** Restores saved filters, dropping anything an older or hand-edited value could not mean. */
export function parseFilters(raw: string | null): SignalFilters {
  try {
    const v = JSON.parse(raw || '{}') as Partial<SignalFilters> & { source?: unknown };
    const ok = <T extends string>(x: unknown, allowed: readonly T[], d: T): T =>
      allowed.includes(x as T) ? (x as T) : d;
    const strings = (x: unknown) =>
      Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && !!s) : [];
    return {
      lane: ok(
        v.lane,
        LANES.map((l) => l.key),
        'all',
      ),
      days: Array.isArray(v.days)
        ? v.days.filter((d): d is Day => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 7)
        : [],
      // Older versions kept one source as `source`.
      sources: [...new Set([...strings(v.sources), ...(typeof v.source === 'string' && v.source ? [v.source] : [])])],
      exp: Array.isArray(v.exp) ? v.exp.filter((e): e is ExpBucket => EXP_BUCKETS.some((b) => b.key === e)) : [],
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

// ---- One employer never floods a list ----

/** The key a company is counted under: its name, lowercased and trimmed. */
export const companyKey = (name: string | null | undefined) => (name || '').trim().toLowerCase();

/**
 * Best first, each company keeps at most `cap` minus your applications there: one employer never floods a list,
 * and a company you applied to twice drops out. Returns what was kept and, per company, what was held back. Pure.
 */
export function capPerCompany<T extends { score: number; company: string }>(
  list: T[],
  applications: Map<string, number>,
  cap = PER_COMPANY,
): { kept: T[]; hidden: Map<string, number> } {
  const used = new Map<string, number>();
  const hidden = new Map<string, number>();
  const kept: T[] = [];
  for (const m of [...list].sort((a, b) => b.score - a.score)) {
    const n = used.get(m.company) || 0;
    if (n + (applications.get(m.company) || 0) >= cap) {
      hidden.set(m.company, (hidden.get(m.company) || 0) + 1);
      continue;
    }
    used.set(m.company, n + 1);
    kept.push(m);
  }
  return { kept, hidden };
}
