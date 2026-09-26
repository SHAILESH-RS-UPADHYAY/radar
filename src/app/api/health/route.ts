import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getIndex } from '@/lib/ai/embeddings';
import { missingServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function probe(check: () => Promise<void>) {
  const start = Date.now();
  try {
    await check();
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    console.error('[HEALTH]', err instanceof Error ? err.message : err);
    return { ok: false, ms: Date.now() - start };
  }
}

// GET /api/health — for uptime monitors. 200 when the database and the vector index answer, 503 otherwise.
// Reports only up/down and latency; details go to the server log.
export async function GET() {
  const missingEnv = missingServerEnv();
  const skipped = { ok: false, ms: 0 };
  const [database, vectors] = missingEnv.length
    ? [skipped, skipped]
    : await Promise.all([
        probe(async () => {
          const { error } = await createServerClient().from('companies').select('id', { head: true }).limit(1);
          if (error) throw new Error(error.message);
        }),
        probe(async () => {
          await getIndex().describeIndexStats();
        }),
      ]);
  const ok = !missingEnv.length && database.ok && vectors.ok;
  return NextResponse.json(
    { ok, database, vectors, missingEnv, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
