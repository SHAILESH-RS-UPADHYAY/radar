import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validate';
import { STAGES, type Stage } from '@/types';

export const dynamic = 'force-dynamic';

const MAX_NOTES = 2000;

// PATCH { id, stage?, notes? } — move an application through C2 · OPS or annotate it.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { id?: unknown; stage?: unknown; notes?: unknown } | null;
  if (!body || !isUuid(body.id))
    return NextResponse.json({ error: 'Expected { id, stage?, notes? }' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage as Stage)) {
      return NextResponse.json({ error: 'stage must be one of ' + STAGES.join(', ') }, { status: 400 });
    }
    update.stage = body.stage;
    update.stage_changed_at = new Date().toISOString();
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return NextResponse.json({ error: 'notes must be text' }, { status: 400 });
    update.notes = body.notes.trim().slice(0, MAX_NOTES) || null;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await createServerClient()
    .from('match_scores')
    .update(update)
    .eq('user_id', userId)
    .eq('id', body.id)
    .eq('status', 'applied')
    .select('id, stage, stage_changed_at, notes')
    .maybeSingle();

  if (isSchemaMissing(error)) {
    return NextResponse.json(
      { error: 'C2 · OPS needs migration 005. Run supabase/migrations/005_sources_ops_overclock.sql.' },
      { status: 503 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json(data);
}
