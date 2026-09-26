import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { isSchemaMissing } from '@/lib/supabase/errors';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'saved', 'applied', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];

// PATCH { ids: string[], status } — move matches between Discovery / Vault / Applied / dismissed.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ids?: unknown; status?: unknown } | null;
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

  const run = (update: Record<string, unknown>) => {
    let q = createServerClient().from('match_scores').update(update).eq('user_id', userId).in('id', ids);
    // Re-applying must not reset an application that has already moved on (e.g. to 'interview').
    if (status === 'applied') q = q.neq('status', 'applied');
    return q.select('id');
  };

  let { data, error } = await run({ ...base, ...ops });
  // Before migration 005 the stage columns do not exist; the status change still has to work.
  if (isSchemaMissing(error)) ({ data, error } = await run(base));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length || 0 });
}
