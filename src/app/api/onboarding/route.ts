// ============================
// RADAR � Onboarding API
// ============================
// POST /api/onboarding � Saves user profile + generates resume embedding

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { embedText } from '@/lib/ai/embeddings';
const pdfParse = require('pdf-parse');

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const resumeFile = formData.get('resume') as File | null;
    const skills = JSON.parse(formData.get('skills') as string || '[]');
    const location = formData.get('location') as string || '';
    const isFresher = formData.get('is_fresher') === 'true';
    const experienceYears = parseInt(formData.get('experience_years') as string || '0');

    const supabase = createServerClient();
    let resumeText: string | null = null;
    let resumeEmbedding: number[] | null = null;

    // Extract text from PDF
    if (resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const parsed = await pdfParse(buffer);
      resumeText = parsed.text?.substring(0, 15000) || null;

      if (resumeText) {
        // Generate embedding
        const embeddingInput = [
          'Skills: ' + skills.join(', '),
          'Experience: ' + (isFresher ? 'Fresher' : experienceYears + ' years'),
          'Location: ' + location,
          resumeText,
        ].join(' | ');

        resumeEmbedding = await embedText(embeddingInput);
      }
    }

    // Upsert user profile
    const { error: upsertErr } = await supabase.from('user_profiles').upsert({
      id: userId,
      skills,
      location,
      is_fresher: isFresher,
      experience_years: experienceYears,
      resume_text: resumeText,
      resume_embedding: resumeEmbedding ? '[' + resumeEmbedding.join(',') + ']' : null,
    }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[ONBOARDING] Error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasResume: !!resumeText,
      hasEmbedding: !!resumeEmbedding,
      skillCount: skills.length,
    });
  } catch (err: any) {
    console.error('[ONBOARDING] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

