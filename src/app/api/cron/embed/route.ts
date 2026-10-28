import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';
import { backfillEmbeddings, type Space } from '@/lib/ai/embeddings';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// GET /api/cron/embed — gives open jobs without a vector one, for about 3½ minutes: first the v1 space (fast, Pinecone
// inference), then Gemini's v2 space, paced to its free 30,000 tokens a minute (about 35 jobs a minute). Vercel Cron
// calls it every hour (vercel.json); call it again by hand while `left` says "more".
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const startedAt = Date.now();
  const embedded: Record<Space, number> = { v1: 0, v2: 0 };
  try {
    for (const [space, batch] of [
      ['v1', 250],
      ['v2', 20],
    ] as const) {
      while (Date.now() - startedAt < 200_000) {
        const n = await backfillEmbeddings(batch, space);
        embedded[space] += n;
        if (n < batch) break;
      }
    }
    const left = Date.now() - startedAt < 200_000 ? 0 : 'more';
    return NextResponse.json({ ok: true, embedded, left, durationMs: Date.now() - startedAt });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, embedded, error }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
