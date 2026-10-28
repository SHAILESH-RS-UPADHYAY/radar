import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';
import { runDiscovery } from '@/lib/discovery/run';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Startup discovery: StartupMap, YC's hiring list, HN "Who is hiring?" and Hiring Without Whiteboards every 48h
// + your imported companies → their ATS boards → `companies`.
// Called five times a day by Vercel Cron (vercel.json); each call resumes the work.
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const startedAt = Date.now();
  try {
    const summary = await runDiscovery(createServerClient(), startedAt + 280_000);
    if (!summary.ready)
      return NextResponse.json({
        ok: false,
        error: 'Discovery needs migration 007. Run supabase/migrations/007_discovery_verify_autopilot.sql.',
      });
    console.log('[DISCOVER]', JSON.stringify(summary));
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DISCOVER]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
