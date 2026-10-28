import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';
import { backfillEmbeddings } from '@/lib/ai/embeddings';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// GET /api/cron/embed — gives open jobs without a vector one, until about 4 minutes have passed. Needed once after
// migration 013 (every job); afterwards the autopilot loop backfills the odd miss. Call it again while `left` > 0.
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const startedAt = Date.now();
  let embedded = 0;
  try {
    while (Date.now() - startedAt < 240_000) {
      const n = await backfillEmbeddings(250);
      embedded += n;
      if (n < 250) return NextResponse.json({ ok: true, embedded, left: 0, durationMs: Date.now() - startedAt });
    }
    return NextResponse.json({ ok: true, embedded, left: 'more', durationMs: Date.now() - startedAt });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, embedded, error }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
