// ============================
// RADAR — Match pipeline
// ============================
// Scores active jobs against a user's profile and puts strong matches straight into the
// Vault (match_scores.status = 'saved', auto_saved = true). A job the user dismissed or
// removed from the Vault is never re-added: only rows still in status 'new' are promoted.
// A company holds at most PER_COMPANY of your roles, applications included.

import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText, parseEmbedding, searchSimilarJobs, similarityTo, toVectorLiteral } from '@/lib/ai/embeddings';
import { computeMatchScore, type MatchInput } from '@/lib/ai/matcher';
import { extractSkills, jobKey } from '@/lib/scraper/utils';
import { splitList } from '@/lib/profile';
import { cityAliases } from '@/lib/geo/city-companies';
import { gateForVault } from './verify';
import type { ScanEvent } from '@/lib/scan-events';
import { PER_COMPANY } from '@/types';

/** How many of the closest jobs the SCAN://LIVE console plots. */
const SCOPE_SAMPLE = 160;

export interface UserMatchSummary {
  userId: string;
  total: number;
  vaulted: number;
  sections: { dream: number; recommended: number; startup: number };
  message?: string;
}

const TOP_K = Number(process.env.RADAR_MATCH_TOP_K || 400);

/**
 * Which strong matches RADAR may auto-save: best first, while the company holds fewer than `cap` of your roles,
 * counting what `held` already has there (Vault roles plus applications). Pure.
 */
export function pickForVault(
  candidates: { id: string; company: string; score: number }[],
  held: Map<string, number>,
  cap = PER_COMPANY,
): string[] {
  const used = new Map(held);
  const out: string[] = [];
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    const n = used.get(c.company) || 0;
    if (n >= cap) continue;
    used.set(c.company, n + 1);
    out.push(c.id);
  }
  return out;
}

/** Roles per company in some rows. */
const countBy = (rows: { company: string }[], into = new Map<string, number>()) =>
  rows.reduce((m, r) => m.set(r.company, (m.get(r.company) || 0) + 1), into);

const companyKey = (employer: string | null | undefined, name: string | null | undefined) =>
  (employer || name || '').trim().toLowerCase();

/** The profile fields scoring reads. */
export interface ScoringProfile {
  skills: string[] | null;
  resume_text: string | null;
  current_role: string | null;
  location: string | null;
  is_fresher: boolean | null;
  experience_years: number | null;
}

/** The job fields scoring reads. */
export interface ScoringJob {
  title: string;
  skills: string[] | null;
  experience_required: string | null;
  location: string | null;
  work_type: string | null;
  posted_at?: string | null;
}

/** Skills the user confirmed win; until they add some, fall back to what the resume mentions. */
export const profileSkills = (p: ScoringProfile): string[] =>
  p.skills?.length ? p.skills : extractSkills(p.resume_text || '');

/**
 * Everything computeMatchScore needs for one user and job at a given similarity.
 * Shared by scans and OVERCLOCK projections, so a projection is scored exactly like a scan.
 */
export function matchInput(
  profile: ScoringProfile,
  job: ScoringJob,
  similarity: number,
  opts: { isDreamCompany: boolean; companyCategory: string; userSkills?: string[] },
): MatchInput {
  return {
    userSkills: opts.userSkills ?? profileSkills(profile),
    jobSkills: job.skills || [],
    vectorSimilarity: similarity,
    isDreamCompany: opts.isDreamCompany,
    companyCategory: opts.companyCategory,
    userIsFresher: profile.is_fresher ?? true,
    userExperienceYears: profile.experience_years ?? 0,
    jobExperience: job.experience_required,
    userCities: splitList(profile.location),
    jobLocation: job.location,
    jobWorkType: job.work_type,
    targetRoles: splitList(profile.current_role),
    jobTitle: job.title,
    postedAt: job.posted_at,
  };
}

export class MatchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function matchUser(
  supabase: SupabaseClient,
  userId: string,
  /** Progress for the SCAN://LIVE console; the cron runs without it. */
  report: (e: ScanEvent) => void = () => {},
): Promise<UserMatchSummary> {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (profileErr || !profile) throw new MatchError('Profile not found. Complete onboarding first.', 404);
  report({
    stage: 'profile',
    skills: profileSkills(profile).length,
    roles: splitList(profile.current_role).length,
    cities: splitList(profile.location).length,
  });

  let embedding = parseEmbedding(profile.resume_embedding);
  const cached = !!embedding;
  if (!embedding) {
    const source =
      (profile.resume_text as string) || [profile.skills, profile.location].flat().filter(Boolean).join(' ');
    if (!source.trim()) throw new MatchError('No resume uploaded. Upload your resume first.', 400);
    embedding = await embedText(source);
    await supabase
      .from('user_profiles')
      .update({ resume_embedding: toVectorLiteral(embedding) })
      .eq('id', userId);
  }
  report({ stage: 'vector', cached, dims: embedding.length });

  const { data: dreamRows } = await supabase.from('user_dream_companies').select('company_id').eq('user_id', userId);
  const dreamIds = new Set((dreamRows || []).map((d: { company_id: string }) => d.company_id));

  const empty = { userId, total: 0, vaulted: 0, sections: { dream: 0, recommended: 0, startup: 0 } };
  const vectorMatches = await searchSimilarJobs(embedding, TOP_K);
  if (vectorMatches.length === 0) return { ...empty, message: 'No jobs indexed yet. Run a scrape first.' };

  const simById = new Map(vectorMatches.map((m) => [m.id, m.score || 0]));
  const sample = vectorMatches.slice(0, SCOPE_SAMPLE);
  report({
    stage: 'search',
    candidates: vectorMatches.length,
    min: Math.min(...simById.values()),
    max: Math.max(...simById.values()),
    sims: sample.map((m) => Math.round((m.score || 0) * 1000) / 1000),
  });
  const ids = [...simById.keys()];

  // Dream-company jobs always get scored, even if they fell outside the vector top-K.
  const dreamJobIds: string[] = [];
  if (dreamIds.size) {
    const { data } = await supabase
      .from('jobs')
      .select('id')
      .in('company_id', [...dreamIds])
      .eq('is_active', true)
      .limit(1000);
    for (const j of data || []) if (!simById.has(j.id)) dreamJobIds.push(j.id);
  }

  // Jobs in your cities always get scored too, with their real similarity: local listings (short Adzuna snippets)
  // rarely reach the vector top-K, which is why Mohali showed nothing.
  const aliases = [...new Set(splitList(profile.location).flatMap((c) => cityAliases(c)))].filter(
    (a) => a.length > 2 && !/[,()%]/.test(a),
  );
  if (aliases.length) {
    const { data } = await supabase
      .from('jobs')
      .select('id')
      .eq('is_active', true)
      .or(aliases.map((a) => `location.ilike.%${a}%`).join(','))
      .limit(2000);
    const local = (data || []).map((j) => j.id as string).filter((id) => !simById.has(id));
    const sims = await similarityTo(embedding, local).catch((e) => {
      console.error('[MATCH] city jobs not scored:', e instanceof Error ? e.message : e);
      return new Map<string, number>();
    });
    for (const [id, sim] of sims) simById.set(id, sim);
  }

  type JobRow = {
    id: string;
    title: string;
    skills: string[] | null;
    experience_required: string | null;
    location: string | null;
    work_type: string | null;
    posted_at: string | null;
    employer: string | null;
    company_id: string;
    companies: { category: string; name: string } | { category: string; name: string }[];
  };
  const jobs: JobRow[] = [];
  const allIds = [...new Set([...ids, ...simById.keys(), ...dreamJobIds])];
  for (let i = 0; i < allIds.length; i += 100) {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, skills, experience_required, location, work_type, posted_at, employer, company_id, companies!inner(category, name)',
      )
      .in('id', allIds.slice(i, i + 100))
      .eq('is_active', true);
    if (error) throw new MatchError('Loading jobs failed: ' + error.message, 500);
    jobs.push(...((data || []) as JobRow[]));
  }
  if (jobs.length === 0) return { ...empty, message: 'No active jobs found.' };
  report({ stage: 'load', jobs: jobs.length, dream: dreamJobIds.length });

  // Jobs outside the vector top-K get the lowest similarity we saw as a conservative stand-in.
  const floorSim = Math.min(...vectorMatches.map((m) => m.score || 0));
  const userSkills = profileSkills(profile);
  const now = new Date().toISOString();
  const tooSenior = new Set<string>();
  const rows = jobs.map((job) => {
    const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
    const result = computeMatchScore(
      matchInput(profile, job, simById.get(job.id) ?? floorSim, {
        isDreamCompany: dreamIds.has(job.company_id),
        companyCategory: company?.category || '',
        userSkills,
      }),
    );
    if (result.tooSenior) tooSenior.add(job.id);
    return {
      user_id: userId,
      job_id: job.id,
      score: result.score,
      reasoning: result.reasoning,
      matching_skills: result.matchingSkills,
      missing_skills: result.missingSkills,
      section: result.section,
      computed_at: now,
    };
  });

  const bar = profile.vault_min_score ?? 80;
  const scoreOf = new Map(rows.map((r) => [r.job_id, r.score]));
  const nameOf = new Map(
    jobs.map((j) => [j.id, (Array.isArray(j.companies) ? j.companies[0] : j.companies)?.name || '']),
  );
  const titleOf = new Map(jobs.map((j) => [j.id, j.title]));
  report({
    stage: 'score',
    scored: rows.length,
    bar,
    bands: [
      rows.filter((r) => r.score >= bar).length,
      rows.filter((r) => r.score >= 50 && r.score < bar).length,
      rows.filter((r) => r.score < 50).length,
    ],
    scores: sample.map((m) => scoreOf.get(m.id) ?? 0),
    top: [...rows]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ company: nameOf.get(r.job_id) || '', title: titleOf.get(r.job_id) || '', score: r.score })),
  });

  // status / auto_saved / first_seen_at are not in the payload, so existing Vault state survives.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('match_scores')
      .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,job_id' });
    if (error) throw new MatchError('Failed to save matches: ' + error.message, 500);
  }

  let vaulted = 0;
  if (profile.auto_vault !== false) {
    const minScore = profile.vault_min_score ?? 80;
    // The other direction: a match RADAR put in the Vault whose score has since fallen under your bar (a rescan,
    // a raised bar) goes back to Discovery. What you saved yourself stays where you put it.
    const { error: demoteErr } = await supabase
      .from('match_scores')
      .update({ status: 'new', auto_saved: false, status_changed_at: now })
      .eq('user_id', userId)
      .eq('status', 'saved')
      .eq('auto_saved', true)
      .lt('score', minScore);
    if (demoteErr) throw new MatchError('Failed to tidy the Vault: ' + demoteErr.message, 500);

    // What is in the Vault and C2 · OPS now, by company: the per-company cap and "already applied there".
    const companyOfJob = new Map(
      jobs.map((j) => [
        j.id,
        companyKey(j.employer, (Array.isArray(j.companies) ? j.companies[0] : j.companies)?.name),
      ]),
    );
    const held: {
      id: string;
      job_id: string;
      status: string;
      auto_saved: boolean;
      score: number;
      company: string;
      title: string;
    }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('match_scores')
        .select('id, job_id, status, auto_saved, score, jobs!inner(title, employer, companies!inner(name))')
        .eq('user_id', userId)
        .in('status', ['saved', 'applied'])
        .range(from, from + 999);
      if (error) throw new MatchError('Reading the Vault failed: ' + error.message, 500);
      for (const r of (data || []) as unknown as {
        id: string;
        job_id: string;
        status: string;
        auto_saved: boolean;
        score: number;
        jobs: { title: string; employer: string | null; companies: { name: string } };
      }[])
        held.push({ ...r, company: companyKey(r.jobs.employer, r.jobs.companies.name), title: r.jobs.title });
      if ((data || []).length < 1000) break;
    }
    // Auto-saved jobs that no longer belong: too senior for you, or past the company's cap once your applications
    // and your own saves are counted (the best ones stay). What you saved yourself is never moved.
    const fixed = countBy(held.filter((h) => h.status === 'applied' || (h.status === 'saved' && !h.auto_saved)));
    const keep = new Set(
      pickForVault(
        held.filter((h) => h.status === 'saved' && h.auto_saved && !tooSenior.has(h.job_id)),
        fixed,
      ),
    );
    const extra = held.filter((h) => h.status === 'saved' && h.auto_saved && !keep.has(h.id)).map((h) => h.id);
    for (let i = 0; i < extra.length; i += 200) {
      const { error } = await supabase
        .from('match_scores')
        .update({ status: 'new', auto_saved: false, status_changed_at: now })
        .in('id', extra.slice(i, i + 200));
      if (error) throw new MatchError('Failed to tidy the Vault: ' + error.message, 500);
    }
    const taken = countBy(
      held.filter((h) => h.status === 'applied' || (h.status === 'saved' && (!h.auto_saved || keep.has(h.id)))),
    );
    // A role that asks for clearly more years than you have stays in Discovery, however well it reads.
    const strong = rows.filter((r) => r.score >= minScore && !tooSenior.has(r.job_id)).map((r) => r.job_id);
    // Only jobs still waiting in Discovery, and only postings that are not known to be closed:
    // board jobs have their apply link opened first, and a closed one never reaches the Vault.
    const waiting: string[] = [];
    for (let i = 0; i < strong.length; i += 200) {
      const { data } = await supabase
        .from('match_scores')
        .select('job_id')
        .eq('user_id', userId)
        .eq('status', 'new')
        .in('job_id', strong.slice(i, i + 200));
      waiting.push(...(data || []).map((r) => r.job_id as string));
    }
    // A role you already applied to, listed again by another source (the company's feed and an alert), stays out.
    const appliedRoles = new Set(held.filter((h) => h.status === 'applied').map((h) => jobKey(h.company, h.title)));
    const open = await gateForVault(supabase, waiting);
    const qualifying = pickForVault(
      waiting
        .filter((id) => open.has(id) && !appliedRoles.has(jobKey(companyOfJob.get(id) || '', titleOf.get(id) || '')))
        .map((id) => ({ id, company: companyOfJob.get(id) || '', score: scoreOf.get(id) || 0 })),
      taken,
    );
    report({
      stage: 'gate',
      strong: strong.length,
      waiting: waiting.length,
      closed: waiting.length - qualifying.length,
    });
    for (let i = 0; i < qualifying.length; i += 200) {
      const { data, error } = await supabase
        .from('match_scores')
        .update({ status: 'saved', auto_saved: true, status_changed_at: now })
        .eq('user_id', userId)
        .eq('status', 'new')
        .in('job_id', qualifying.slice(i, i + 200))
        .select('id');
      if (error) console.error('[MATCH] auto-vault failed:', error.message);
      vaulted += data?.length || 0;
    }
  }

  report({ stage: 'vault', vaulted });
  await supabase.from('user_profiles').update({ last_matched_at: now }).eq('id', userId);

  const sims = vectorMatches.map((m) => m.score || 0);
  console.log(
    '[MATCH]',
    userId,
    rows.length,
    'scored,',
    vaulted,
    'new in vault; similarity range',
    Math.min(...sims).toFixed(3),
    '-',
    Math.max(...sims).toFixed(3),
  );

  return {
    userId,
    total: rows.length,
    vaulted,
    sections: {
      dream: rows.filter((r) => r.section === 'dream').length,
      recommended: rows.filter((r) => r.section === 'recommended').length,
      startup: rows.filter((r) => r.section === 'startup').length,
    },
  };
}

export async function matchAllUsers(supabase: SupabaseClient, deadline: number): Promise<UserMatchSummary[]> {
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id')
    .or('resume_text.not.is.null,resume_embedding.not.is.null')
    .order('last_matched_at', { ascending: true, nullsFirst: true });
  if (error) throw new Error('Loading users failed: ' + error.message);

  const out: UserMatchSummary[] = [];
  for (const u of users || []) {
    if (Date.now() > deadline - 15_000) break;
    try {
      out.push(await matchUser(supabase, u.id));
    } catch (err) {
      console.error('[MATCH]', u.id, 'failed:', err instanceof Error ? err.message : err);
    }
  }
  return out;
}
