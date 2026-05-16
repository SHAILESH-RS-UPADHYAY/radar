/* eslint-disable @typescript-eslint/no-explicit-any */
 
 
 
 
 
 

// ============================
// RADAR - Onboarding API
// ============================
// POST /api/onboarding - Saves user profile + generates resume embedding

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as pdfParseModule from 'pdf-parse';
import { createServerClient } from '@/lib/supabase/client';
import { embedText } from '@/lib/ai/embeddings';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const resumeFile = formData.get('resume') as File | null;
    let location = '';
    try {
      const locs = JSON.parse(formData.get('location') as string || '[]');
      location = locs.join(', ');
    } catch {
      location = formData.get('location') as string || '';
    }
    const careerStage = formData.get('career_stage') as string || 'Experienced';
    const isFresher = careerStage === 'Fresher' || careerStage === 'Intern';
    const workModel = formData.get('work_model') as string || '';
    const experienceYears = parseInt(formData.get('experience_years') as string || '0');
    
    // Core fields
    const currentRole = formData.get('current_role') as string || '';
    const educationLevel = formData.get('education_level') as string || '';
    const passingYear = formData.get('passing_year') as string || '';
    const fieldOfStudy = formData.get('field_of_study') as string || '';
    
    // Arrays
    let dreamCompanies: string[] = [];
    let orgCulture: string[] = [];
    try { dreamCompanies = JSON.parse(formData.get('dream_companies') as string || '[]'); } catch {}
    try { orgCulture = JSON.parse(formData.get('org_culture') as string || '[]'); } catch {}

    // Manual Form Details
    const manualSkills = formData.get('manual_skills') as string || '';
    const manualProjects = formData.get('manual_projects') as string || '';
    const manualBio = formData.get('manual_bio') as string || '';

    const supabase = createServerClient();
    let resumeText = '';
    let resumeEmbedding: number[] | null = null;

    // 1. Extract text from PDF if exists
    if (resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const PDFParse = (pdfParseModule as any).PDFParse || pdfParseModule;
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const parsed = await parser.getText();
      resumeText = parsed.text?.substring(0, 15000) || '';
    }

    // 2. Append Manual Details
    if (manualSkills || manualProjects || manualBio) {
      resumeText += '\n\n--- USER PROVIDED DETAILS ---\n';
      if (manualSkills) resumeText += `SKILLS: ${manualSkills}\n`;
      if (manualProjects) resumeText += `PROJECTS: ${manualProjects}\n`;
      if (manualBio) resumeText += `ADDITIONAL BIO: ${manualBio}\n`;
    }

    // 3. Generate Embedding if ANY context exists
    if (resumeText.trim() || careerStage) {
      const embeddingInput = [
        'Career Stage: ' + (isFresher ? careerStage : `Experienced (${experienceYears} years)`),
        currentRole ? `Target/Current Role: ${currentRole}` : '',
        `Education: ${educationLevel} in ${fieldOfStudy} (Class of ${passingYear})`,
        'Org Culture Prefs: ' + orgCulture.join(', '),
        'Dream Companies: ' + dreamCompanies.join(', '),
        workModel ? `Work Model: ${workModel}` : '',
        'Location: ' + location,
        resumeText,
      ].filter(Boolean).join(' | ');

      resumeEmbedding = await embedText(embeddingInput);
    }

    // Upsert user profile
    const { error: upsertErr } = await supabase.from('user_profiles').upsert({
      id: userId,
      location,
      is_fresher: isFresher,
      experience_years: experienceYears,
      resume_text: resumeText || null,
      // Suppress saving embedding to DB due to 384 vs 1024 dimension mismatch
      // resume_embedding: resumeEmbedding ? '[' + resumeEmbedding.join(',') + ']' : null,
    }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[ONBOARDING] DB Error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasResume: !!resumeText,
      hasEmbedding: !!resumeEmbedding,
      skillCount: 0,
    });
  } catch (error: unknown) {
   
  const err = error as any;
    console.error('[ONBOARDING] General Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
