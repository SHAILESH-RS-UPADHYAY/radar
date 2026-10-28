import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { embedText, toVectorLiteral } from '@/lib/ai/embeddings';
import { extractSkills } from '@/lib/scraper/utils';
import { resolveDreamCompanyIds } from '@/lib/dream-companies';
import { runScrape } from '@/lib/pipeline/scrape';
import { extractPdfText } from '@/lib/resume';
import { resumeProblem } from '@/lib/validate';
import { onboardingResume } from '@/lib/profile';
import { serverError } from '@/lib/api';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function parseJsonArray(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return value ? [value] : [];
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const resumeFile = formData.get('resume') as File | null;
    const locations = parseJsonArray(formData.get('location'));
    const location = locations.join(', ');
    const country = (formData.get('country') as string) || 'India';
    const careerStage = (formData.get('career_stage') as string) || 'Experienced';
    const isFresher = careerStage === 'Fresher' || careerStage === 'Intern';
    const workModel = (formData.get('work_model') as string) || '';
    const experienceYears = parseInt((formData.get('experience_years') as string) || '0', 10) || 0;
    const currentRole = (formData.get('current_role') as string) || '';
    const educationLevel = (formData.get('education_level') as string) || '';
    const passingYear = (formData.get('passing_year') as string) || '';
    const fieldOfStudy = (formData.get('field_of_study') as string) || '';
    const dreamCompanies = parseJsonArray(formData.get('dream_companies'));
    const orgCulture = parseJsonArray(formData.get('org_culture'));
    const manualSkillsRaw = (formData.get('manual_skills') as string) || '';
    const manualProjects = (formData.get('manual_projects') as string) || '';
    const manualBio = (formData.get('manual_bio') as string) || '';

    const supabase = createServerClient();
    let resumeText = '';

    if (resumeFile && resumeFile.size > 0) {
      const problem = resumeProblem(resumeFile);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      try {
        resumeText = await extractPdfText(resumeFile);
      } catch (err) {
        console.error('[ONBOARDING] PDF read failed:', err instanceof Error ? err.message : err);
        return NextResponse.json(
          { error: 'This PDF could not be read. Save it again as a PDF (File → Save as PDF) and retry.' },
          { status: 422 },
        );
      }
    }

    const manual = [
      manualSkillsRaw && `SKILLS: ${manualSkillsRaw}`,
      manualProjects && `PROJECTS: ${manualProjects}`,
      manualBio && `ADDITIONAL BIO: ${manualBio}`,
    ]
      .filter(Boolean)
      .map((line) => line + '\n')
      .join('');
    const parsedManualSkills = manualSkillsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Onboarding again never erases: an existing resume stays unless a new PDF came, and skills only grow.
    const { data: existing, error: existingErr } = await supabase
      .from('user_profiles')
      .select('resume_text, skills')
      .eq('id', userId)
      .maybeSingle();
    if (existingErr) return serverError('API /onboarding', existingErr);
    const kept = onboardingResume(existing, { text: resumeText, manual, skills: parsedManualSkills });
    resumeText = kept.resumeText;
    const skills = [...new Set([...kept.skills, ...extractSkills(resumeText)])];

    const embeddingInput = [
      'Career Stage: ' + (isFresher ? careerStage : `Experienced (${experienceYears} years)`),
      currentRole ? `Target/Current Role: ${currentRole}` : '',
      `Education: ${educationLevel} in ${fieldOfStudy} (Class of ${passingYear})`,
      orgCulture.length ? 'Org Culture Prefs: ' + orgCulture.join(', ') : '',
      dreamCompanies.length ? 'Dream Companies: ' + dreamCompanies.join(', ') : '',
      workModel ? `Work Model: ${workModel}` : '',
      location ? 'Location: ' + location : '',
      resumeText,
    ]
      .filter(Boolean)
      .join(' | ');

    let resumeEmbedding: number[] | null = null;
    if (embeddingInput.trim()) {
      try {
        resumeEmbedding = await embedText(embeddingInput);
      } catch (embedErr) {
        // Profile still saves; the match step builds the embedding once Pinecone is configured.
        console.warn('[ONBOARDING] Embedding skipped:', embedErr instanceof Error ? embedErr.message : embedErr);
      }
    }

    const { error: upsertErr } = await supabase.from('user_profiles').upsert(
      {
        id: userId,
        location,
        country,
        is_fresher: isFresher,
        experience_years: experienceYears,
        current_role: currentRole || null,
        skills,
        resume_text: resumeText || null,
        // A failed embedding keeps the vector you had; the next match rebuilds it from resume_text.
        ...(resumeEmbedding ? { resume_embedding: toVectorLiteral(resumeEmbedding) } : {}),
        resume_embedding_v2: null, // rebuilt from this resume by the next match
      },
      { onConflict: 'id' },
    );

    if (upsertErr) {
      console.error('[ONBOARDING] DB Error:', upsertErr);
      return serverError('API /onboarding', upsertErr);
    }

    // Your dream companies are replaced only by a new choice, never cleared by a run that brought none.
    const dreamIds = await resolveDreamCompanyIds(supabase, dreamCompanies);
    if (dreamIds.length > 0) {
      await supabase.from('user_dream_companies').delete().eq('user_id', userId);
      const { error: dreamErr } = await supabase
        .from('user_dream_companies')
        .insert(dreamIds.map((company_id) => ({ user_id: userId, company_id })));
      if (dreamErr) console.error('[ONBOARDING] Dream companies error:', dreamErr.message);
    }

    // Refresh the user's dream companies after the response is sent, so a slow ATS can't
    // time out onboarding. Runs within the same maxDuration; the cron picks up anything cut off.
    if (dreamIds.length > 0) {
      after(async () => {
        try {
          const summary = await runScrape(supabase, { budgetMs: 45_000, companyIds: dreamIds });
          console.log('[ONBOARDING] Dream-company scrape:', summary.scraped, 'companies,', summary.totalJobs, 'jobs');
        } catch (scrapeErr) {
          console.warn(
            '[ONBOARDING] Dream-company scrape failed:',
            scrapeErr instanceof Error ? scrapeErr.message : scrapeErr,
          );
        }
      });
    }

    return NextResponse.json({
      success: true,
      hasResume: !!resumeText,
      hasEmbedding: !!resumeEmbedding,
      skillCount: skills.length,
      dreamCompanyCount: dreamIds.length,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[ONBOARDING] General Error:', err);
    return serverError('API /onboarding', err);
  }
}
