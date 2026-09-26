/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';

export const dynamic = 'force-dynamic';

const JOB = `
  jobs!inner (
    id, title, description, location, work_type, skills, apply_url, department, employer, posted_at, is_active,
    experience_required, salary_min, salary_max, salary_currency,
    companies!inner ( name, category, ats_provider )
  )`;
const BASE =
  'id, score, reasoning, matching_skills, missing_skills, section, status, auto_saved, status_changed_at, first_seen_at,';
const OPS = ' stage, stage_changed_at, applied_at, notes,';

/** Vault + applied: everything, even if the posting has since closed. Discovery: the best open jobs not yet acted on. */
function load(supabase: SupabaseClient, userId: string, withOps: boolean) {
  const select = BASE + (withOps ? OPS : '') + JOB;
  return Promise.all([
    supabase
      .from('match_scores')
      .select(select)
      .eq('user_id', userId)
      .in('status', ['saved', 'applied'])
      .order('score', { ascending: false })
      .limit(1000),
    supabase
      .from('match_scores')
      .select(select)
      .eq('user_id', userId)
      .eq('status', 'new')
      .eq('jobs.is_active', true)
      .order('score', { ascending: false })
      .limit(200),
  ]);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  // Query builders are lazy; .then() starts this one now so it runs alongside the match queries.
  const profile = supabase
    .from('user_profiles')
    .select('vault_min_score, auto_vault, last_matched_at')
    .eq('id', userId)
    .maybeSingle()
    .then((r) => r);

  // C2 · OPS columns arrive with migration 005; until then serve everything else and say so.
  let opsReady = true;
  let [tracked, discovery] = await load(supabase, userId, true);
  if (isSchemaMissing(tracked.error) || isSchemaMissing(discovery.error)) {
    opsReady = false;
    [tracked, discovery] = await load(supabase, userId, false);
  }

  const error = tracked.error || discovery.error;
  if (error) {
    console.error('[DASHBOARD] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatted = [...(tracked.data || []), ...(discovery.data || [])].map((m: any) => ({
    id: m.id,
    score: m.score,
    reasoning: m.reasoning,
    matching_skills: m.matching_skills || [],
    missing_skills: m.missing_skills || [],
    section: m.section,
    status: m.status,
    auto_saved: m.auto_saved,
    status_changed_at: m.status_changed_at,
    first_seen_at: m.first_seen_at,
    stage: m.stage ?? (m.status === 'applied' ? 'applied' : null),
    stage_changed_at: m.stage_changed_at ?? null,
    applied_at: m.applied_at ?? (m.status === 'applied' ? m.status_changed_at : null),
    notes: m.notes ?? null,
    job: {
      id: m.jobs.id,
      title: m.jobs.title,
      description: m.jobs.description,
      location: m.jobs.location,
      work_type: m.jobs.work_type,
      skills: m.jobs.skills || [],
      apply_url: m.jobs.apply_url,
      department: m.jobs.department,
      posted_at: m.jobs.posted_at,
      is_active: m.jobs.is_active,
      experience_required: m.jobs.experience_required,
      salary_min: m.jobs.salary_min,
      salary_max: m.jobs.salary_max,
      salary_currency: m.jobs.salary_currency,
      company: {
        name: m.jobs.employer || m.jobs.companies.name,
        source: m.jobs.employer ? m.jobs.companies.name : null,
        category: m.jobs.companies.category,
      },
    },
  }));

  const { data: settings } = await profile;
  return NextResponse.json({
    matches: formatted,
    total: formatted.length,
    opsReady,
    settings: settings || { vault_min_score: 70, auto_vault: true, last_matched_at: null },
  });
}
