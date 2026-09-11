// ============================
// RADAR — Match pipeline
// ============================
// Scores active jobs against a user's profile and puts strong matches straight into the
// Vault (match_scores.status = 'saved', auto_saved = true). A job the user dismissed or
// removed from the Vault is never re-added: only rows still in status 'new' are promoted.

import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText, parseEmbedding, searchSimilarJobs, toVectorLiteral } from '@/lib/ai/embeddings';
import { computeMatchScore } from '@/lib/ai/matcher';

export interface UserMatchSummary {
  userId: string;
  total: number;
  vaulted: number;
  sections: { dream: number; recommended: number; startup: number };
  message?: string;
}

const TOP_K = Number(process.env.RADAR_MATCH_TOP_K || 400);

export class MatchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function matchUser(supabase: SupabaseClient, userId: string): Promise<UserMatchSummary> {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (profileErr || !profile) throw new MatchError('Profile not found. Complete onboarding first.', 404);

  let embedding = parseEmbedding(profile.resume_embedding);
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

  const { data: dreamRows } = await supabase.from('user_dream_companies').select('company_id').eq('user_id', userId);
  const dreamIds = new Set((dreamRows || []).map((d: { company_id: string }) => d.company_id));

  const empty = { userId, total: 0, vaulted: 0, sections: { dream: 0, recommended: 0, startup: 0 } };
  const vectorMatches = await searchSimilarJobs(embedding, TOP_K);
  if (vectorMatches.length === 0) return { ...empty, message: 'No jobs indexed yet. Run a scrape first.' };

  const simById = new Map(vectorMatches.map((m) => [m.id, m.score || 0]));
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

  type JobRow = {
    id: string;
    skills: string[] | null;
    experience_required: string | null;
    location: string | null;
    work_type: string | null;
    company_id: string;
    companies: { category: string } | { category: string }[];
  };
  const jobs: JobRow[] = [];
  const allIds = [...ids, ...dreamJobIds];
  for (let i = 0; i < allIds.length; i += 100) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, skills, experience_required, location, work_type, company_id, companies!inner(category)')
      .in('id', allIds.slice(i, i + 100))
      .eq('is_active', true);
    if (error) throw new MatchError('Loading jobs failed: ' + error.message, 500);
    jobs.push(...((data || []) as JobRow[]));
  }
  if (jobs.length === 0) return { ...empty, message: 'No active jobs found.' };

  // Jobs outside the vector top-K get the lowest similarity we saw as a conservative stand-in.
  const floorSim = Math.min(...vectorMatches.map((m) => m.score || 0));
  const now = new Date().toISOString();
  const rows = jobs.map((job) => {
    const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
    const result = computeMatchScore({
      userSkills: profile.skills || [],
      jobSkills: job.skills || [],
      vectorSimilarity: simById.get(job.id) ?? floorSim,
      isDreamCompany: dreamIds.has(job.company_id),
      companyCategory: company?.category || '',
      userIsFresher: profile.is_fresher ?? true,
      userExperienceYears: profile.experience_years ?? 0,
      jobExperience: job.experience_required,
      userCities: String(profile.location || '').split(','),
      jobLocation: job.location,
      jobWorkType: job.work_type,
    });
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

  // status / auto_saved / first_seen_at are not in the payload, so existing Vault state survives.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('match_scores')
      .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,job_id' });
    if (error) throw new MatchError('Failed to save matches: ' + error.message, 500);
  }

  let vaulted = 0;
  if (profile.auto_vault !== false) {
    const minScore = profile.vault_min_score ?? 70;
    const qualifying = rows.filter((r) => r.score >= minScore).map((r) => r.job_id);
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
