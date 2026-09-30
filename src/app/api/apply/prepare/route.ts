/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse, type NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { loadSettingsProfile, splitList } from '@/lib/profile';
import { readApplicationForm } from '@/lib/apply/form';
import { answerForm, type Candidate } from '@/lib/apply/answers';
import { resumeToText, type TailorOutput } from '@/lib/ai/tailor';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST { matchId } — FORM://INTERCEPT for one of your matches: read the posting's application form, fill what your
// profile and Application Kit say, and draft the rest with the AI in your voice. Nothing is sent to the employer:
// HACK shows the answers and the autofill bridge fills the form in your own browser; you press submit.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { matchId?: unknown } | null;
  if (!isUuid(body?.matchId)) return NextResponse.json({ error: 'Expected { matchId }' }, { status: 400 });

  const supabase = createServerClient();
  const [{ data: match, error }, profile, { data: resume }, user] = await Promise.all([
    supabase
      .from('match_scores')
      .select(
        'id, job_id, jobs!inner(id, external_id, title, description, location, apply_url, employer, companies!inner(name, ats_provider, ats_identifier))',
      )
      .eq('user_id', userId)
      .eq('id', body.matchId)
      .maybeSingle(),
    loadSettingsProfile(supabase, userId),
    supabase.from('user_profiles').select('resume_text').eq('id', userId).maybeSingle(),
    currentUser(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!match || !profile) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const job = (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) as any;
  const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;

  // The tailored resume for this job, if OVERCLOCK made one (table from migration 005).
  const { data: tailored } = await supabase
    .from('tailored_resumes')
    .select('id, content')
    .eq('user_id', userId)
    .eq('job_id', job.id)
    .maybeSingle();
  let tailoredText: string | null = null;
  try {
    tailoredText = tailored ? resumeToText((JSON.parse(tailored.content) as TailorOutput).resume) : null;
  } catch {
    tailoredText = null;
  }

  const form = await readApplicationForm({
    provider: company.ats_provider,
    identifier: company.ats_identifier,
    externalId: job.external_id,
    applyUrl: job.apply_url,
  });

  const kit = profile.application_kit;
  const links = profile.portfolio;
  const candidate: Candidate = {
    fullName: profile.full_name || user?.fullName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    phone: kit?.phone || '',
    city: splitList(profile.location).find((c) => c.toLowerCase() !== 'remote') || '',
    linkedin: links?.linkedin || '',
    github: links?.github || '',
    portfolio: links?.portfolio || '',
    website: links?.website || '',
    currentCompany: kit?.current_company || '',
    currentTitle: kit?.current_title || '',
    noticePeriod: kit?.notice_period || '',
    currentCtc: kit?.current_ctc || '',
    expectedCtc: kit?.expected_ctc || '',
    currency: kit?.currency || '',
    workAuthorization: kit?.work_authorization || '',
    needsSponsorship: kit?.needs_sponsorship || '',
    willingToRelocate: kit?.willing_to_relocate || '',
    gender: kit?.gender || '',
    pronouns: kit?.pronouns || '',
    veteranStatus: kit?.veteran_status || '',
    disabilityStatus: kit?.disability_status || '',
    voiceNotes: kit?.voice_notes || '',
    experienceYears: profile.is_fresher ? 0 : profile.experience_years,
    skills: profile.skills.length ? profile.skills : profile.resume_skills,
    targetRoles: profile.target_roles,
    projects: links?.projects || [],
  };

  const result = await answerForm(form.fields, candidate, {
    job: {
      title: job.title,
      company: job.employer || company.name,
      location: job.location,
      description: job.description || '',
    },
    resumeText: resume?.resume_text || '',
    tailoredText,
  });

  return NextResponse.json({
    source: form.source,
    applyUrl: job.apply_url,
    tailoredId: tailored?.id ?? null,
    kitReady: !!kit,
    ...result,
  });
}
