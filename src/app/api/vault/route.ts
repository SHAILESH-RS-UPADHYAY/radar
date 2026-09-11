import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'saved', 'applied', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];

// PATCH { ids: string[], status } — move matches between Discovery / Vault / Applied / dismissed.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ids?: unknown; status?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 500)
    : [];
  const status = body?.status as Status;
  if (!ids.length || !STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'Expected { ids: string[], status: new|saved|applied|dismissed }' },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { status, status_changed_at: new Date().toISOString() };
  if (status !== 'saved') update.auto_saved = false;

  const { data, error } = await createServerClient()
    .from('match_scores')
    .update(update)
    .eq('user_id', userId)
    .in('id', ids)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length || 0 });
}
