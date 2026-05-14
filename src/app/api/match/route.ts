// ============================
// RADAR — Match API Route
// ============================
// POST /api/match — Computes AI match scores for authenticated user
// Reads resume embedding, queries Pinecone, upserts match_scores

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { searchSimilarJobs } from '@/lib/ai/embeddings';
import { computeMatchScore } from '@/lib/ai/matcher';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // 1. Get user profile with resume embedding
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found. Complete onboarding first.' }, { status: 404 });
  }

  if (!profile.resume_embedding) {
    return NextResponse.json({ error: 'No resume uploaded. Upload your resume first.' }, { status: 400 });
  }

  // 2. Get user's dream companies
  const { data: dreamCompanies } = await supabase
    .from('user_dream_companies')
    .select('company_id')
    .eq('user_id', userId);

  const dreamCompanyIds = new Set((dreamCompanies || []).map((d: any) => d.company_id));

  // 3. Search Pinecone for similar jobs
  const embedding = profile.resume_embedding as number[];
  const matches = await searchSimilarJobs(embedding, 100);

  if (matches.length === 0) {
    return NextResponse.json({ message: 'No jobs found. Run a scrape first.', matches: [] });
  }

  // 4. Get job details from Supabase
  const jobIds = matches.map(m => m.id);
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, companies!inner(id, name, category)')
    .in('id', jobIds)
    .eq('is_active', true);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ message: 'No active jobs found', matches: [] });
  }

  // 5. Compute match scores
  const matchRows = [];
  for (const job of jobs) {
    const pineconeMatch = matches.find(m => m.id === job.id);
    const vectorSim = pineconeMatch?.score || 0;
    const company = (job as any).companies;
    const isDream = dreamCompanyIds.has(company.id);

    const result = computeMatchScore(
      profile.skills || [],
      job.skills || [],
      vectorSim,
      isDream,
      company.category,
    );

    matchRows.push({
      user_id: userId,
      job_id: job.id,
      score: result.score,
      reasoning: result.reasoning,
      matching_skills: result.matchingSkills,
      missing_skills: result.missingSkills,
      section: result.section,
      computed_at: new Date().toISOString(),
    });
  }

  // 6. Upsert match scores
  const { error: upsertErr } = await supabase
    .from('match_scores')
    .upsert(matchRows, { onConflict: 'user_id,job_id' });

  if (upsertErr) {
    console.error('[MATCH] Upsert error:', upsertErr);
    return NextResponse.json({ error: 'Failed to save matches' }, { status: 500 });
  }

  // 7. Return sorted results
  const dream = matchRows.filter(m => m.section === 'dream').sort((a, b) => b.score - a.score);
  const recommended = matchRows.filter(m => m.section === 'recommended').sort((a, b) => b.score - a.score);
  const startup = matchRows.filter(m => m.section === 'startup').sort((a, b) => b.score - a.score);

  return NextResponse.json({
    message: 'Computed ' + matchRows.length + ' matches',
    sections: {
      dream: dream.length,
      recommended: recommended.length,
      startup: startup.length,
    },
    total: matchRows.length,
  });
}

