/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse, type NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { loadSettingsProfile, splitList } from '@/lib/profile';
import { applicationFormUrl, readApplicationForm, type ApplicationForm } from '@/lib/apply/form';
import { answerForm, type Candidate } from '@/lib/apply/answers';
import { resumeToText, type TailorOutput } from '@/lib/ai/tailor';

// Drafting plus HUMANIZE's validate → fix rounds on a slow model can take a few minutes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Questions the extension read on the open form (a third-party page): plain data, size-capped.
const PageField = z.object({
  name: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(600),
  type: z.enum(['text', 'email', 'tel', 'url', 'textarea', 'select', 'multiselect']),
  required: z.boolean(),
  options: z.array(z.string().max(300)).max(200).optional(),
});
const Body = z.object({
  matchId: z.string().refine(isUuid),
  /** false = profile facts only, no AI: the instant first fill. */
  draft: z.boolean().optional(),
  fields: z.array(PageField).min(1).max(80).optional(),
});

// POST { matchId, draft?, fields? } — FORM://INTERCEPT for one of your matches: read the posting's application form
// (or take the questions the extension read on the open form), fill what your profile and Application Kit say, draft
// the rest with the AI in your voice, then HUMANIZE it (validate → fix until nothing reads AI-written). Nothing is
// sent to the employer: INFILTRATE shows the answers and the extension (or the RADAR FILL bookmark) fills the form in your
// own browser; you press submit.
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Expected { matchId, draft?, fields? }' }, { status: 400 });
  const body = parsed.data;

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

  const form: ApplicationForm = body.fields
    ? { source: 'page', fields: body.fields }
    : await readApplicationForm({
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
    learned: kit?.learned || {},
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
    // Leaves a margin under maxDuration; the form tab waits for the answers meanwhile.
    deadline: startedAt + 240_000,
    draft: body.draft,
  });

  return NextResponse.json({
    source: form.source,
    applyUrl: job.apply_url,
    formUrl: applicationFormUrl({
      provider: company.ats_provider,
      identifier: company.ats_identifier,
      externalId: job.external_id,
      applyUrl: job.apply_url,
    }),
    tailoredId: tailored?.id ?? null,
    kitReady: !!kit,
    ...result,
  });
}
