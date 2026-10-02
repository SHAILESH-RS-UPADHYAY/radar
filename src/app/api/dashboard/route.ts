/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import type { OpsEvent } from '@/components/dashboard/types';
import { applicationFormUrl } from '@/lib/apply/form';

export const dynamic = 'force-dynamic';

const JOB = `
  jobs!inner (
    id, external_id, title, location, work_type, skills, apply_url, department, employer, posted_at, is_active,
    experience_required, salary_min, salary_max, salary_currency,
    companies!inner ( name, category, ats_provider, ats_identifier )
  )`;
const BASE =
  'id, score, reasoning, matching_skills, missing_skills, section, status, auto_saved, status_changed_at, first_seen_at,';
const OPS = ' stage, stage_changed_at, applied_at, notes,';
const VERSION = ' resume_version_id,';
// Newest schema first: migration 006 (resume versions) builds on 005 (C2 · OPS). Each tier drops what a
// database without that migration does not have yet, so the dashboard works at every step.
const TIERS = [BASE + OPS + VERSION, BASE + OPS, BASE];

/** Vault + applied: everything, even if the posting has since closed. Discovery: the best open jobs not yet acted on. */
function load(supabase: SupabaseClient, userId: string, columns: string) {
  const select = columns + JOB;
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
    .select('vault_min_score, auto_vault, last_matched_at, location')
    .eq('id', userId)
    .maybeSingle()
    .then((r) => r);

  let tier = 0;
  let [tracked, discovery] = await load(supabase, userId, TIERS[tier]);
  while ((isSchemaMissing(tracked.error) || isSchemaMissing(discovery.error)) && tier < TIERS.length - 1) {
    tier += 1;
    [tracked, discovery] = await load(supabase, userId, TIERS[tier]);
  }
  const opsReady = tier <= 1;
  const versionsReady = tier === 0;

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
    resume_version_id: m.resume_version_id ?? null,
    last_event: null as OpsEvent | null,
    job: {
      id: m.jobs.id,
      title: m.jobs.title,
      location: m.jobs.location,
      work_type: m.jobs.work_type,
      skills: m.jobs.skills || [],
      apply_url: m.jobs.apply_url,
      form_url: applicationFormUrl({
        provider: m.jobs.companies.ats_provider,
        identifier: m.jobs.companies.ats_identifier,
        externalId: m.jobs.external_id,
        applyUrl: m.jobs.apply_url,
      }),
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

  // Latest recruiter reply / RADAR event per application. The table arrives with migration 006.
  const applied = formatted.filter((m) => m.status === 'applied');
  if (versionsReady && applied.length) {
    const { data: events } = await supabase
      .from('ops_events')
      .select('match_id, source, kind, summary, occurred_at')
      .eq('user_id', userId)
      .in(
        'match_id',
        applied.map((m) => m.id),
      )
      .order('occurred_at', { ascending: false })
      .limit(500);
    const latest = new Map<string, OpsEvent>();
    for (const { match_id, ...e } of events || []) if (!latest.has(match_id)) latest.set(match_id, e);
    for (const m of applied) m.last_event = latest.get(m.id) ?? null;
  }

  // Last finished run of the automatic loop, so the dashboard can say when jobs were last refreshed.
  const { data: lastRun } = await supabase
    .from('pipeline_runs')
    .select('finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: settings } = await profile;
  return NextResponse.json({
    // No profile row = onboarding never finished: the page sends you there instead of scanning.
    hasProfile: !!settings,
    pipelineRunAt: lastRun?.finished_at ?? null,
    matches: formatted,
    total: formatted.length,
    opsReady,
    versionsReady,
    settings: settings || { vault_min_score: 80, auto_vault: true, last_matched_at: null, location: null },
  });
}
