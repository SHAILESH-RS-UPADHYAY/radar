import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { embedText, toVectorLiteral } from '@/lib/ai/embeddings';
import { extractSkills, normalizeSkill } from '@/lib/scraper/utils';
import { extractPdfText } from '@/lib/resume';
import { loadSettingsProfile, splitList } from '@/lib/profile';
import { resumeProblem } from '@/lib/validate';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// POST multipart { resume: File } — replace the resume, merge the skills it mentions, refresh the embedding.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get('resume');
  if (!(file instanceof File)) return fail('Attach a PDF resume.', 400);
  const problem = resumeProblem(file);
  if (problem) return fail(problem, 400);

  let text = '';
  try {
    text = (await extractPdfText(file)).trim();
  } catch (err) {
    console.error('[RESUME] PDF read failed:', err instanceof Error ? err.message : err);
    return fail('This PDF could not be read. Save it again as a PDF (File → Save as PDF) and retry.', 422);
  }
  if (!text) return fail('No text found in this PDF. Export it as a text PDF (not a scanned image) and retry.', 422);

  try {
    const supabase = createServerClient();
    const { data: current, error } = await supabase
      .from('user_profiles')
      .select('skills, current_role, location')
      .eq('id', userId)
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!current) return fail('Complete onboarding first.', 404);

    const skills = [...new Set([...(current.skills || []), ...extractSkills(text)].map(normalizeSkill))].slice(0, 100);
    const roles = splitList(current.current_role);

    let embedding: number[] | null = null;
    try {
      embedding = await embedText(
        [
          roles.length ? 'Target roles: ' + roles.join(', ') : '',
          'Skills: ' + skills.join(', '),
          current.location ? 'Location: ' + current.location : '',
          text,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch (embedErr) {
      // Saved without a vector; the next match rebuilds it from resume_text.
      console.warn('[RESUME] Embedding skipped:', embedErr instanceof Error ? embedErr.message : embedErr);
    }

    const { error: updateErr } = await supabase
      .from('user_profiles')
      .update({
        resume_text: text,
        skills,
        resume_embedding: embedding ? toVectorLiteral(embedding) : null,
        resume_embedding_v2: null, // rebuilt from the new resume by the next match
      })
      .eq('id', userId);
    if (updateErr) return fail(updateErr.message, 500);

    return NextResponse.json({ profile: await loadSettingsProfile(supabase, userId) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
}
