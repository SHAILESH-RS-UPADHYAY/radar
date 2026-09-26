import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { embedText, toVectorLiteral } from '@/lib/ai/embeddings';
import { extractSkills, normalizeSkill } from '@/lib/scraper/utils';
import { extractPdfText } from '@/lib/resume';
import { loadSettingsProfile, splitList } from '@/lib/profile';

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// POST multipart { resume: File } — replace the resume, merge the skills it mentions, refresh the embedding.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get('resume');
  if (!(file instanceof File) || file.size === 0) return fail('Attach a PDF resume.', 400);
  if (file.size > MAX_BYTES) return fail('Resume must be under 5 MB.', 413);
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return fail('Only PDF resumes are supported.', 415);

  const text = (await extractPdfText(file).catch(() => '')).trim();
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
      .update({ resume_text: text, skills, resume_embedding: embedding ? toVectorLiteral(embedding) : null })
      .eq('id', userId);
    if (updateErr) return fail(updateErr.message, 500);

    return NextResponse.json({ profile: await loadSettingsProfile(supabase, userId) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
}
