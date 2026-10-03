import type { MatchStatus, Stage } from '@/types';
import type { Tone } from '@/components/hud/Hud';

/** One row from GET /api/dashboard. */
export interface MatchedJob {
  id: string;
  score: number;
  reasoning: string;
  matching_skills: string[];
  missing_skills: string[];
  section: string;
  status: MatchStatus;
  auto_saved: boolean;
  status_changed_at: string | null;
  first_seen_at: string | null;
  stage: Stage | null;
  stage_changed_at: string | null;
  applied_at: string | null;
  notes: string | null;
  /** The tailored resume that went out with this application (migration 006). */
  resume_version_id: string | null;
  /** Newest thing RADAR learned about this application, e.g. a recruiter reply read from Gmail (migration 006). */
  last_event: OpsEvent | null;
  job: {
    id: string;
    title: string;
    location: string;
    work_type: string | null;
    skills: string[];
    apply_url: string;
    /** Where the application form itself is (Greenhouse embed, Lever /apply…): what one-click apply opens. */
    form_url: string;
    department: string | null;
    posted_at: string | null;
    is_active: boolean;
    experience_required: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    /** provider: where RADAR read the job (an ATS like greenhouse, a job board like remotive). */
    company: { name: string; source: string | null; category: string; provider?: string | null };
  };
}

export interface OpsEvent {
  source: 'gmail' | 'radar' | 'user';
  kind: string;
  summary: string;
  occurred_at: string;
}

/** One row of GET /api/overclock: a tailored resume, scores only. */
export interface TailoredSummary {
  id: string;
  job_id: string;
  base_score: number | null;
  projected_score: number | null;
  created_at: string;
}

/** Near-miss band OVERCLOCK works on: good enough to be worth it, not yet a strong match. */
export const OVERCLOCK_MIN = 50;
export const OVERCLOCK_MAX = 79;

export type MatchAction = 'SAVE' | 'REMOVE_SAVE' | 'REMOVE_APPLY' | 'DISMISS';

/** Removing from the Vault dismisses the job so auto-vault never brings it back. */
export const ACTION_STATUS: Record<MatchAction, MatchStatus> = {
  SAVE: 'saved',
  REMOVE_SAVE: 'dismissed',
  REMOVE_APPLY: 'saved',
  DISMISS: 'dismissed',
};

export function formatSalary(job: MatchedJob['job']): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  // Indian pay reads in lakhs per annum: 1800000–2600000 → "18–26 LPA".
  if (job.salary_currency === 'INR' && Math.max(job.salary_min || 0, job.salary_max || 0) >= 100_000) {
    const lpa = [job.salary_min, job.salary_max]
      .filter((n): n is number => !!n)
      .map((n) => String(Math.round((n / 100_000) * 10) / 10));
    return lpa.join('–') + ' LPA';
  }
  const fmt = (n: number) => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));
  const parts = [job.salary_min, job.salary_max].filter((n): n is number => !!n).map(fmt);
  return (job.salary_currency ? job.salary_currency + ' ' : '') + parts.join(' – ');
}

const BOARDS = new Set([
  'hackernews',
  'remotive',
  'remoteok',
  'arbeitnow',
  'himalayas',
  'jobicy',
  'themuse',
  'adzuna',
  'jooble',
  'weworkremotely',
  'workingnomads',
]);
/** Where a job came from, said plainly: "GREENHOUSE · ATS API", "REMOTIVE · JOB BOARD", "WORKDAY · CAREERS SITE". */
export function sourceLabel(job: MatchedJob['job']): string | null {
  const p = job.company.provider;
  if (!p) return job.company.source ? job.company.source.toUpperCase() : null;
  const kind = BOARDS.has(p)
    ? 'JOB BOARD'
    : ['workday', 'amazon', 'eightfold'].includes(p)
      ? 'CAREERS SITE'
      : 'ATS API';
  return `${p.toUpperCase()} · ${kind}`;
}

/** Days since a date, or null without one. */
export function ageDays(iso: string | null, now = Date.now()): number | null {
  return iso ? (now - Date.parse(iso)) / 86_400_000 : null;
}

export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(mins)) return null;
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return days + ' days ago';
  return Math.floor(days / 30) + ' mo ago';
}

const postedDays = (m: MatchedJob, now: number) =>
  m.job.posted_at ? (now - Date.parse(m.job.posted_at)) / 86_400_000 : Number.NaN;

/**
 * Today's 10: the Vault jobs to apply to first. Postings from the last 4 days lead (early applicants get read),
 * then the last two weeks, then the rest; score decides within each group. Unknown dates count as old.
 */
export function todaysTen(
  saved: MatchedJob[],
  now = Date.now(),
  /** 1 sinks a match below every 0 (e.g. a company you already applied to). */
  sunk: (m: MatchedJob) => number = () => 0,
): MatchedJob[] {
  const group = (m: MatchedJob) => {
    const days = postedDays(m, now);
    return days <= 4 ? 0 : days <= 14 ? 1 : 2;
  };
  return [...saved].sort((a, b) => sunk(a) - sunk(b) || group(a) - group(b) || b.score - a.score).slice(0, 10);
}

/** "NEW" for the first 4 days, then "6D", "3W"; empty when the posting date is unknown. */
export function postedTag(m: MatchedJob, now = Date.now()): string {
  const days = Math.floor(postedDays(m, now));
  if (Number.isNaN(days)) return '';
  return days <= 4 ? 'NEW' : days < 21 ? days + 'D' : Math.floor(days / 7) + 'W';
}

/** HUD palette: phosphor for strong, amber for maybe, dim below. Matches the default 70% vault bar. */
export function scoreColor(score: number): string {
  return score >= 70 ? '#00FF41' : score >= 40 ? '#FACC15' : '#7B9481';
}

// ---- C2 · OPS ----

export const STAGE_META: Record<Stage, { label: string; tone: Tone }> = {
  applied: { label: 'APPLIED', tone: 'info' },
  screening: { label: 'SCREENING', tone: 'warn' },
  interview: { label: 'INTERVIEW', tone: 'ok' },
  offer: { label: 'OFFER', tone: 'ok' },
  rejected: { label: 'REJECTED', tone: 'alert' },
  withdrawn: { label: 'WITHDRAWN', tone: 'idle' },
};
export const ACTIVE_STAGES: Stage[] = ['applied', 'screening', 'interview', 'offer'];
export const CLOSED_STAGES: Stage[] = ['rejected', 'withdrawn'];

const FOLLOW_UP_DAYS = 7;
const GHOST_DAYS = 14;

export interface OpsSignal {
  tone: Tone;
  label: string;
  hint: string;
}

/**
 * What RADAR can tell about an application without access to the employer's system: whether the posting
 * is still up (checked every scan) and how long it has been waiting on the employer.
 */
export function opsSignals(m: MatchedJob, now = Date.now()): OpsSignal[] {
  const signals: OpsSignal[] = [];
  if (!m.job.is_active) {
    signals.push({
      tone: 'alert',
      label: 'POSTING CLOSED',
      hint: 'The employer took the listing down, so it is likely filled or paused.',
    });
  }
  const waiting = m.stage === 'applied' || m.stage === 'screening';
  const since = Date.parse(m.stage_changed_at || m.applied_at || '');
  if (waiting && !Number.isNaN(since)) {
    const days = Math.floor((now - since) / 86_400_000);
    if (days >= GHOST_DAYS) {
      signals.push({
        tone: 'warn',
        label: 'GHOSTED · ' + days + 'D',
        hint: 'No movement in ' + days + ' days. Follow up once, then move on.',
      });
    } else if (days >= FOLLOW_UP_DAYS) {
      signals.push({ tone: 'info', label: 'FOLLOW UP', hint: days + ' days without news: a short check-in helps.' });
    }
  }
  return signals;
}
