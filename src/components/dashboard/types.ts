import type { MatchStatus } from '@/types';

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
  job: {
    id: string;
    title: string;
    description: string | null;
    location: string;
    work_type: string | null;
    skills: string[];
    apply_url: string;
    department: string | null;
    posted_at: string | null;
    is_active: boolean;
    experience_required: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    company: { name: string; source: string | null; category: string };
  };
}

export type MatchAction = 'SAVE' | 'APPLY' | 'REMOVE_SAVE' | 'REMOVE_APPLY' | 'DISMISS';

/** Removing from the Vault dismisses the job so auto-vault never brings it back. */
export const ACTION_STATUS: Record<MatchAction, MatchStatus> = {
  SAVE: 'saved',
  APPLY: 'applied',
  REMOVE_SAVE: 'dismissed',
  REMOVE_APPLY: 'saved',
  DISMISS: 'dismissed',
};

export function formatSalary(job: MatchedJob['job']): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n: number) => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));
  const parts = [job.salary_min, job.salary_max].filter((n): n is number => !!n).map(fmt);
  return (job.salary_currency ? job.salary_currency + ' ' : '') + parts.join(' – ');
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

/** HUD palette: phosphor for strong, amber for maybe, dim below. Matches the default 70% vault bar. */
export function scoreColor(score: number): string {
  return score >= 70 ? '#00FF41' : score >= 40 ? '#FACC15' : '#7B9481';
}
