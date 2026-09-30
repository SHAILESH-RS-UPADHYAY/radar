// OVERCLOCK: tailor the resume for one near-miss job, project its new score, and move it to the Vault when
// the projection clears the bar. One tailored resume per user and job (table tailored_resumes, migration 005).
// Used by the OVERCLOCK button (POST /api/overclock) and by auto-OVERCLOCK in the daily autopilot.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { toPortfolio } from '@/lib/profile';
import { projectScore, resumeToText, tailorResume, TailorError, type TailorOutput } from '@/lib/ai/tailor';
import { OVERCLOCK_MAX, OVERCLOCK_MIN } from '@/components/dashboard/types';

export const TAILORED_COLUMNS = 'id, job_id, content, base_score, projected_score, model, created_at';

interface TailoredRow {
  id: string;
  job_id: string;
  content: string;
  base_score: number | null;
  projected_score: number | null;
  model: string | null;
  created_at: string;
}

/** What the browser gets for a tailored resume. */
export interface TailoredView extends TailorOutput {
  id: string;
  jobId: string;
  baseScore: number | null;
  projectedScore: number | null;
  model: string | null;
  createdAt: string;
}

export function toView(row: TailoredRow): TailoredView {
  const out = JSON.parse(row.content) as TailorOutput;
  return {
    ...out,
    id: row.id,
    jobId: row.job_id,
    baseScore: row.base_score,
    projectedScore: row.projected_score,
    model: row.model,
    createdAt: row.created_at,
  };
}

/** A user's tailored resume by id, or null when it does not exist or belongs to someone else. */
export async function loadTailored(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('tailored_resumes').select(TAILORED_COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle();
}

export const MIGRATION_HINT = 'OVERCLOCK needs migration 005. Run supabase/migrations/005_sources_ops_overclock.sql.';

/** A request OVERCLOCK cannot serve, with the HTTP status that says why. */
export class OverclockError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Tailor the resume for one of the user's matches. Returns the cached version unless `force`.
 * Throws OverclockError / TailorError (both carry an HTTP status).
 */
export async function overclockMatch(
  supabase: SupabaseClient,
  userId: string,
  matchId: string,
  { force = false } = {},
): Promise<{ view: TailoredView; movedToVault: boolean }> {
  const { data: match, error: matchErr } = await supabase
    .from('match_scores')
    .select(
      'id, score, job_id, jobs!inner(id, title, description, location, work_type, skills, experience_required, employer, company_id, companies!inner(name, category))',
    )
    .eq('user_id', userId)
    .eq('id', matchId)
    .maybeSingle();
  if (matchErr) throw new OverclockError(matchErr.message, 500);
  if (!match) throw new OverclockError('Match not found', 404);

  if (!force) {
    const { data: cached, error } = await supabase
      .from('tailored_resumes')
      .select(TAILORED_COLUMNS)
      .eq('user_id', userId)
      .eq('job_id', match.job_id)
      .maybeSingle();
    if (isSchemaMissing(error)) throw new OverclockError(MIGRATION_HINT, 503);
    if (error) throw new OverclockError(error.message, 500);
    if (cached) return { view: toView(cached), movedToVault: false };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('skills, resume_text, current_role, location, is_fresher, experience_years, vault_min_score, auto_vault')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) throw new OverclockError(profileErr.message, 500);
  if (!profile?.resume_text) throw new OverclockError('Upload your resume in Preferences first.', 400);

  const job = (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) as any;
  const company = (Array.isArray(job.companies) ? job.companies[0] : job.companies) as {
    name: string;
    category: string;
  };
  const { data: dream } = await supabase
    .from('user_dream_companies')
    .select('company_id')
    .eq('user_id', userId)
    .eq('company_id', job.company_id)
    .maybeSingle();

  // Portfolio arrives with migration 008; before it the read fails quietly and tailoring goes on without it.
  const { data: extra } = await supabase.from('user_profiles').select('portfolio').eq('id', userId).maybeSingle();
  const { output, model } = await tailorResume(
    profile.resume_text,
    profile,
    { ...job, company: job.employer || company.name },
    extra?.portfolio ? toPortfolio(extra.portfolio) : null,
  );
  // A failed projection must not throw away a tailoring that has already been paid for.
  const projected = await projectScore({
    currentScore: match.score,
    originalText: profile.resume_text,
    tailoredText: resumeToText(output.resume),
    profile,
    job,
    jobId: job.id,
    isDreamCompany: !!dream,
    companyCategory: company.category,
  }).catch((err) => {
    console.warn('[OVERCLOCK] projection failed:', err instanceof Error ? err.message : err);
    return null;
  });

  const { data: saved, error } = await supabase
    .from('tailored_resumes')
    .upsert(
      {
        user_id: userId,
        job_id: job.id,
        content: JSON.stringify(output),
        gaps: output.gaps,
        base_score: match.score,
        projected_score: projected,
        model,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,job_id' },
    )
    .select(TAILORED_COLUMNS)
    .single();
  if (isSchemaMissing(error)) throw new OverclockError(MIGRATION_HINT, 503);
  if (error) throw new OverclockError(error.message, 500);

  // A tailored version that clears the Vault bar moves a still-new match into the Vault.
  let movedToVault = false;
  if (projected !== null && profile.auto_vault !== false && projected >= (profile.vault_min_score ?? 80)) {
    const { data: moved } = await supabase
      .from('match_scores')
      .update({ status: 'saved', auto_saved: true, status_changed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', match.id)
      .eq('status', 'new')
      .select('id');
    movedToVault = !!moved?.length;
  }
  return { view: toView(saved), movedToVault };
}

// One tailoring (AI call + projection) can take well over a minute; never start one that cannot finish.
const TAILOR_BUDGET_MS = 110_000;

/**
 * Auto-OVERCLOCK for everyone who switched it on (migration 007): the best untailored 50–79 matches, up to each
 * user's daily cap. The cap counts every tailoring in the last 24h, manual ones included — it is a spend limit.
 */
export async function autoOverclockAll(supabase: SupabaseClient, deadline: number) {
  const summary = { users: 0, tailored: 0, movedToVault: 0, stopped: null as string | null };
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, overclock_daily_cap')
    .eq('auto_overclock', true);
  if (error) return summary; // before migration 007 nobody can have it on
  summary.users = users?.length ?? 0;

  for (const user of users || []) {
    const { count } = await supabase
      .from('tailored_resumes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
    let left = (user.overclock_daily_cap ?? 5) - (count ?? 0);
    if (left <= 0) continue;

    const { data: near } = await supabase
      .from('match_scores')
      .select('id, job_id, jobs!inner(is_active)')
      .eq('user_id', user.id)
      .in('status', ['new', 'saved'])
      .gte('score', OVERCLOCK_MIN)
      .lte('score', OVERCLOCK_MAX)
      .eq('jobs.is_active', true)
      .order('score', { ascending: false })
      .limit(50);
    const { data: done } = await supabase
      .from('tailored_resumes')
      .select('job_id')
      .eq('user_id', user.id)
      .in(
        'job_id',
        (near || []).map((m) => m.job_id),
      );
    const tailoredJobs = new Set((done || []).map((d) => d.job_id));

    for (const m of near || []) {
      if (left <= 0) break;
      if (Date.now() > deadline - TAILOR_BUDGET_MS) return summary;
      if (tailoredJobs.has(m.job_id)) continue;
      try {
        const { movedToVault } = await overclockMatch(supabase, user.id, m.id);
        summary.tailored += 1;
        if (movedToVault) summary.movedToVault += 1;
        left -= 1;
      } catch (err) {
        const status = err instanceof TailorError || err instanceof OverclockError ? err.status : 500;
        console.warn('[AUTO-OVERCLOCK]', user.id, m.id, status, err instanceof Error ? err.message : err);
        // Not configured or rate limited: no point trying more jobs this run.
        if (status === 503 || status === 429) {
          summary.stopped = err instanceof Error ? err.message : String(err);
          return summary;
        }
        if (status === 400) break; // this user has no resume
      }
    }
  }
  return summary;
}

/** "Asha Rao - Stripe.pdf", reduced to characters every browser and OS accepts in a download name. */
export function pdfFileName(name: string, company: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return (clean(name) || 'Resume') + (company ? ' - ' + clean(company) : '') + '.pdf';
}
