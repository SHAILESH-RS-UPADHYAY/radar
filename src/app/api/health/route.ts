import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { searchSimilarJobs } from '@/lib/ai/embeddings';
import { env, missingServerEnv } from '@/lib/env';

const STALE_MS = 48 * 3600_000;

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

// GET /api/health — for uptime monitors. 200 when the database and the job search (pgvector) answer, 503 otherwise.
// Reports up/down, latency and whether the automatic loop has run in the last 48h; details go to the server log.
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
          await searchSimilarJobs(new Array(1024).fill(1), 1);
        }),
      ]);
  const ok = !missingEnv.length && database.ok && vectors.ok;
  // Is the automatic loop alive? Without CRON_SECRET in production every scheduled run is refused.
  let lastRunAt: string | null = null;
  if (database.ok) {
    const { data } = await createServerClient()
      .from('pipeline_runs')
      .select('finished_at')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastRunAt = data?.finished_at ?? null;
  }
  const pipeline = {
    cronSecretSet: !!env.cronSecret(),
    lastRunAt,
    stale: !lastRunAt || Date.now() - Date.parse(lastRunAt) > STALE_MS,
  };
  return NextResponse.json(
    { ok, database, vectors, pipeline, missingEnv, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
