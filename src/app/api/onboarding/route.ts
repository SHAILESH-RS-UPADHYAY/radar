import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as pdfParseModule from 'pdf-parse';
import { createServerClient } from '@/lib/supabase/client';
import { embedText, toVectorLiteral } from '@/lib/ai/embeddings';
import { extractSkills } from '@/lib/scraper/utils';
import { resolveDreamCompanyIds } from '@/lib/dream-companies';

export const maxDuration = 30;

function parseJsonArray(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return value ? [value] : [];
  }
}

async function extractPdfText(resumeFile: File): Promise<string> {
  const buffer = Buffer.from(await resumeFile.arrayBuffer());
  const PDFParse = (pdfParseModule as unknown as { PDFParse?: unknown }).PDFParse || pdfParseModule;
  if (typeof PDFParse === 'function') {
    try {
      const parser = new (
        PDFParse as new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text?: string }> }
      )({
        data: new Uint8Array(buffer),
      });
      const parsed = await parser.getText();
      return parsed.text?.substring(0, 15000) || '';
    } catch {
      const parsed = await (PDFParse as (buf: Buffer) => Promise<{ text?: string }>)(buffer);
      return parsed.text?.substring(0, 15000) || '';
    }
  }
  return '';
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
      resumeText = await extractPdfText(resumeFile);
    }

    if (manualSkillsRaw || manualProjects || manualBio) {
      resumeText += '\n\n--- USER PROVIDED DETAILS ---\n';
      if (manualSkillsRaw) resumeText += `SKILLS: ${manualSkillsRaw}\n`;
      if (manualProjects) resumeText += `PROJECTS: ${manualProjects}\n`;
      if (manualBio) resumeText += `ADDITIONAL BIO: ${manualBio}\n`;
    }

    const parsedManualSkills = manualSkillsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const extracted = extractSkills(resumeText);
    const skills = [...new Set([...parsedManualSkills, ...extracted])];

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
        skills,
        resume_text: resumeText || null,
        resume_embedding: resumeEmbedding ? toVectorLiteral(resumeEmbedding) : null,
      },
      { onConflict: 'id' },
    );

    if (upsertErr) {
      console.error('[ONBOARDING] DB Error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const dreamIds = await resolveDreamCompanyIds(supabase, dreamCompanies);
    await supabase.from('user_dream_companies').delete().eq('user_id', userId);
    if (dreamIds.length > 0) {
      const { error: dreamErr } = await supabase
        .from('user_dream_companies')
        .insert(dreamIds.map((company_id) => ({ user_id: userId, company_id })));
      if (dreamErr) console.error('[ONBOARDING] Dream companies error:', dreamErr.message);
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
    return NextResponse.json({ error: err.message || 'Onboarding failed' }, { status: 500 });
  }
}
