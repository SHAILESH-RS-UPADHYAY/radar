import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { isSchemaMissing } from '@/lib/supabase/errors';

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

  const now = new Date().toISOString();
  const base: Record<string, unknown> = { status, status_changed_at: now };
  if (status !== 'saved') base.auto_saved = false;
  // C2 · OPS: applying opens an application at stage 'applied'; leaving 'applied' closes it.
  const ops =
    status === 'applied'
      ? { stage: 'applied', stage_changed_at: now, applied_at: now }
      : { stage: null, stage_changed_at: null, applied_at: null };
  const version =
    status === 'applied' && isUuid(body?.resumeVersionId)
      ? { resume_version_id: body.resumeVersionId }
      : status === 'applied'
        ? {}
        : { resume_version_id: null };

  const run = (update: Record<string, unknown>) => {
    let q = createServerClient().from('match_scores').update(update).eq('user_id', userId).in('id', ids);
    // Re-applying must not reset an application that has already moved on (e.g. to 'interview').
    if (status === 'applied') q = q.neq('status', 'applied');
    return q.select('id');
  };

  // Newest schema first (006 resume versions, then 005 stages); the status change works at every step.
  const attempts = [{ ...base, ...ops, ...version }, { ...base, ...ops }, base];
  let { data, error } = await run(attempts[0]);
  for (let i = 1; i < attempts.length && isSchemaMissing(error); i++) ({ data, error } = await run(attempts[i]));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length || 0 });
}
