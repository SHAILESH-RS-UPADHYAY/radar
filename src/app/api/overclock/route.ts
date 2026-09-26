import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validate';
import { TailorError } from '@/lib/ai/tailor';
import { overclockMatch, OverclockError } from '@/lib/overclock';

// Claude with adaptive thinking can take a minute or more on a long resume.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// GET — the user's tailored resumes (scores only), so the OVERCLOCK tab knows which jobs are done.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  const { data, error } = await createServerClient()
    .from('tailored_resumes')
    .select('id, job_id, base_score, projected_score, created_at')
    .eq('user_id', userId);
  if (isSchemaMissing(error)) return NextResponse.json({ ready: false, items: [] });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ready: true, items: data || [] });
}

// POST { matchId, force? } — tailor the resume for that match's job (cached per job unless force).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  const body = (await req.json().catch(() => null)) as { matchId?: unknown; force?: unknown } | null;
  if (!body || !isUuid(body.matchId)) return fail('Expected { matchId }', 400);

  try {
    const { view, movedToVault } = await overclockMatch(createServerClient(), userId, body.matchId, {
      force: body.force === true,
    });
    return NextResponse.json({ ...view, movedToVault });
  } catch (err) {
    if (err instanceof OverclockError || err instanceof TailorError) return fail(err.message, err.status);
    console.error('[OVERCLOCK]', err);
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
}
