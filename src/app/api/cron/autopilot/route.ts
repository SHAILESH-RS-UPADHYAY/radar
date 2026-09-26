import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';
import { syncAllGmail } from '@/lib/gmail';
import { retireClosedMatches, reverifyVault } from '@/lib/pipeline/verify';
import { autoOverclockAll } from '@/lib/overclock';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Daily autopilot, after /api/cron has scraped and matched:
//   1. re-check every board posting sitting in a Vault; closed ones leave the Vault;
//   2. read recruiter replies from every linked Gmail and move applications along in C2 · OPS;
//   3. auto-OVERCLOCK: tailor the best near-miss matches for users who switched it on (daily cap).
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const startedAt = Date.now();
  const deadline = startedAt + 285_000;

  const vault = await reverifyVault(supabase, Math.min(deadline, startedAt + 100_000));
  const retired = await retireClosedMatches(supabase);
  const gmail = await syncAllGmail(supabase, deadline);
  const overclock = await autoOverclockAll(supabase, deadline);
  const summary = {
    vault: { ...vault, retired },
    overclock,
    gmail: {
      inboxes: gmail.length,
      matched: gmail.reduce((s, r) => s + r.matched, 0),
      stagesMoved: gmail.reduce((s, r) => s + r.updated, 0),
      errors: gmail.filter((r) => r.error).length,
    },
  };
  console.log('[AUTOPILOT]', JSON.stringify(summary));
  return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary });
}

export const GET = handle;
export const POST = handle;
