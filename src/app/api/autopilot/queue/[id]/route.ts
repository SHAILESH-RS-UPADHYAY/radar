import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { setMatchStatus } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const STATUSES = ['queued', 'filling', 'ready', 'submitting', 'submitted', 'needs_you', 'skipped', 'failed'] as const;
type Status = (typeof STATUSES)[number];
const DONE: Status[] = ['ready', 'submitted', 'needs_you', 'skipped', 'failed'];

// PATCH { status, reason?, confirmation? } — what the runner did with one job of today's queue. 'submitted' (the
// employer confirmed, or you said you sent it) moves the match to C2 · OPS with the resume that went out.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
    reason?: unknown;
    confirmation?: unknown;
  } | null;
  const status = body?.status as Status;
  if (!isUuid(id) || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Expected { status }' }, { status: 400 });
  }
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from('apply_queue')
    .select(
      'id, match_id, attempts, tailored_id, match_scores!inner(jobs!inner(title, employer, companies!inner(name)))',
    )
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not in your queue' }, { status: 404 });

  const now = new Date().toISOString();
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 300) : null;
  const update: Record<string, unknown> = { status, reason };
  if (status === 'filling') Object.assign(update, { started_at: now, attempts: row.attempts + 1, finished_at: null });
  if (DONE.includes(status)) update.finished_at = now;
  if (status === 'submitted' && body?.confirmation && typeof body.confirmation === 'object')
    update.confirmation = { ...(body.confirmation as object), at: now };
  const { error: e } = await supabase.from('apply_queue').update(update).eq('id', id).eq('user_id', userId);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });

  const job = (
    row.match_scores as unknown as { jobs: { title: string; employer: string | null; companies: { name: string } } }
  ).jobs;
  const where = `${job.employer || job.companies.name} · ${job.title}`;
  if (status === 'submitted') {
    const applied = await setMatchStatus(supabase, userId, [row.match_id], 'applied', row.tailored_id);
    if (applied.error) return NextResponse.json({ error: applied.error }, { status: 500 });
  }
  // C2 · OPS keeps the story: what ZERO-DAY sent, and what it left to you and why.
  if (status === 'submitted' || status === 'needs_you') {
    await supabase.from('ops_events').insert({
      user_id: userId,
      match_id: row.match_id,
      source: 'radar',
      kind: status === 'submitted' ? 'autopilot_applied' : 'autopilot_parked',
      summary:
        status === 'submitted' ? `ZERO-DAY sent it · ${where}` : `ZERO-DAY left it to you (${reason}) · ${where}`,
    });
  }
  return NextResponse.json({ ok: true });
}
