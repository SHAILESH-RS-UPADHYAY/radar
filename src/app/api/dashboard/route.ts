/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import type { OpsEvent } from '@/components/dashboard/types';
import { applicationFormUrl, atsFromUrl } from '@/lib/apply/form';
import { ALERT_SOURCE_KEYS, capPerCompany, companyKey } from '@/lib/vault-filters';
import { jobKey } from '@/lib/scraper/utils';
import { PER_COMPANY, isOpenApplication } from '@/types';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const NO_ATS = { provider: null, identifier: null, externalId: '' };

const job = (extra: string) => `
  jobs!inner (
    id, external_id, title, location, work_type, skills, apply_url, department, employer, posted_at, is_active,
    experience_required, salary_min, salary_max, salary_currency,${extra}
    companies!inner ( name, category, ats_provider, ats_identifier )
  )`;
const BASE =
  'id, score, reasoning, matching_skills, missing_skills, section, status, auto_saved, status_changed_at, first_seen_at,';
const OPS = ' stage, stage_changed_at, applied_at, notes,';
const VERSION = ' resume_version_id,';
// Newest schema first: 012 (where board links lead), 006 (resume versions), 005 (C2 · OPS). Each tier drops what a
// database without that migration does not have yet, so the dashboard works at every step.
const TIERS = [
  BASE + OPS + VERSION + job(' resolved_url,'),
  BASE + OPS + VERSION + job(''),
  BASE + OPS + job(''),
  BASE + job(''),
];
/** Discovery shows the best this many, after each company is held to its share (capPerCompany). */
const DISCOVERY_SHOWN = 300;
const DISCOVERY_READ = 1000;
const ALERTS_READ = 300;

/** Vault + applied: everything, even if the posting has since closed. Discovery: the best open jobs not yet acted on. */
function load(supabase: SupabaseClient, userId: string, select: string) {
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
      .limit(DISCOVERY_READ),
    // Jobs from your own alert emails are listed whatever their score: their short cards score lower than full JDs.
    supabase
      .from('match_scores')
      .select(select)
      .eq('user_id', userId)
      .eq('status', 'new')
      .eq('jobs.is_active', true)
      .in('jobs.companies.ats_provider', ALERT_SOURCE_KEYS)
      .order('score', { ascending: false })
      .limit(ALERTS_READ),
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
  let [tracked, discovery, alerts] = await load(supabase, userId, TIERS[tier]);
  while ((isSchemaMissing(tracked.error) || isSchemaMissing(discovery.error)) && tier < TIERS.length - 1) {
    tier += 1;
    [tracked, discovery, alerts] = await load(supabase, userId, TIERS[tier]);
  }
  const versionsReady = tier <= 1;
  const opsReady = tier <= 2;

  const error = tracked.error || discovery.error || alerts.error;
  if (error) {
    console.error('[DASHBOARD] Error:', error);
    return serverError('API /dashboard', error);
  }

  // One employer never floods Discovery: each company keeps its best roles up to its share, fewer once you have
  // applied there, none after two open applications (a rejection frees its slot). What each company had beyond that
  // is counted for the cards.
  const nameOf = (m: any) => companyKey(m.jobs.employer || m.jobs.companies.name);
  const appliedRows = ((tracked.data || []) as any[]).filter((m) => m.status === 'applied');
  const applications = new Map<string, number>();
  for (const m of appliedRows.filter((a) => isOpenApplication(a.stage)))
    applications.set(nameOf(m), (applications.get(nameOf(m)) || 0) + 1);
  // A role you applied to that another source lists again (the company's feed and an alert) is not a new signal.
  const appliedRoles = new Set(appliedRows.map((m) => jobKey(nameOf(m), m.jobs.title)));
  const fresh = (m: any) => m.status === 'applied' || !appliedRoles.has(jobKey(nameOf(m), m.jobs.title));
  const candidates = new Map<string, any>();
  for (const m of [...((discovery.data || []) as any[]), ...((alerts.data || []) as any[])]) candidates.set(m.id, m);
  const { kept, hidden } = capPerCompany(
    [...candidates.values()].filter(fresh).map((m) => ({ ...m, company: nameOf(m) })),
    applications,
  );
  const fromAlerts = (m: any) => ALERT_SOURCE_KEYS.includes(m.jobs.companies.ats_provider);
  const shown = [...kept.filter((m) => !fromAlerts(m)).slice(0, DISCOVERY_SHOWN), ...kept.filter(fromAlerts)];

  // RADAR's own saves leave the Vault once the company has its two open applications; your own saves stay.
  const capped = (m: any) => m.status === 'saved' && m.auto_saved && (applications.get(nameOf(m)) || 0) >= PER_COMPANY;
  const tracking = ((tracked.data || []) as any[]).filter((m) => fresh(m) && !capped(m));
  const formatted = [...tracking, ...shown].map((m: any) => ({
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
      // A board job whose employer page RADAR learned opens there directly (and as that ATS's form when it is one).
      form_url: m.jobs.resolved_url
        ? applicationFormUrl(atsFromUrl(m.jobs.resolved_url) ?? { ...NO_ATS, applyUrl: m.jobs.resolved_url })
        : applicationFormUrl({
            provider: m.jobs.companies.ats_provider,
            identifier: m.jobs.companies.ats_identifier,
            externalId: m.jobs.external_id,
            applyUrl: m.jobs.apply_url,
          }),
      resolved_url: m.jobs.resolved_url ?? null,
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
        provider: m.jobs.companies.ats_provider,
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

  const { data: settings, error: profileError } = await profile;
  return NextResponse.json({
    // No profile row = onboarding never finished: the page sends you there instead of scanning. A lookup that
    // failed says nothing (null): sending you to onboarding then would make you redo a profile you have.
    hasProfile: profileError ? null : !!settings,
    pipelineRunAt: lastRun?.finished_at ?? null,
    matches: formatted,
    total: formatted.length,
    /** Discovery roles held back per company (lowercase name): past its share, or two applications there. */
    heldBack: Object.fromEntries(hidden),
    opsReady,
    versionsReady,
    settings: settings || { vault_min_score: 80, auto_vault: true, last_matched_at: null, location: null },
  });
}
