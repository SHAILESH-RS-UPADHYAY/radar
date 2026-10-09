import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { setMatchStatus } from '@/lib/vault';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'saved', 'applied', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];

// PATCH { ids: string[], status, resumeVersionId? } — move matches between Discovery / Vault / Applied /
// dismissed. resumeVersionId (from RUN) records which tailored resume went out with the application.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    ids?: unknown;
    status?: unknown;
    resumeVersionId?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter(isUuid).slice(0, 500) : [];
  const status = body?.status as Status;
  if (!ids.length || !STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'Expected { ids: string[], status: new|saved|applied|dismissed }' },
      { status: 400 },
    );
  }

  const version = isUuid(body?.resumeVersionId) ? body.resumeVersionId : null;
  const { updated, error } = await setMatchStatus(createServerClient(), userId, ids, status, version);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ updated });
}

// GET — returns the exact stated experience strings read from each saved/applied job's JD,
// extracted with statedExperience(). Lightweight ({ [jobId]: { text, min } }), called
// in the background so the main dashboard payload stays small.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  const { data: rows, error } = await supabase
    .from('match_scores')
    .select('jobs!inner(id, title, experience_required, description)')
    .eq('user_id', userId)
    .in('status', ['saved', 'applied'])
    .limit(1000);

  if (error) {
    console.error('[VAULT] Experience fetch failed:', error.message);
    return serverError('API /vault', error);
  }

  interface JobRow {
    jobs: {
      id: string;
      title: string | null;
      experience_required: string | null;
      description: string | null;
    } | null;
  }

  // Import dynamically or directly from vault-filters
  const { statedExperience } = await import('@/lib/vault-filters');
  const experience: Record<string, { text: string | null; min: number | null }> = {};
  for (const row of (rows as unknown as JobRow[]) || []) {
    const j = row.jobs;
    if (j?.id) {
      experience[j.id] = statedExperience(j.title || '', j.description || '', j.experience_required);
    }
  }

  return NextResponse.json({ experience });
}
