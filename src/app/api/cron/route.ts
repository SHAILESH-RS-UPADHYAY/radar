import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { runScrape } from '@/lib/pipeline/scrape';
import { matchAllUsers } from '@/lib/pipeline/match';
import { retireClosedMatches } from '@/lib/pipeline/verify';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// The automatic loop: scrape every source → score new jobs for every user → strong matches into the Vault.
// Called by Vercel Cron (daily) and .github/workflows/radar-cron.yml (every 6 hours).
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  const startedAt = Date.now();
  const deadline = startedAt + 285_000;
  const trigger = req.headers.get('user-agent')?.includes('vercel-cron')
    ? 'vercel-cron'
    : req.nextUrl.searchParams.get('trigger') || 'manual';

  const { data: run } = await supabase.from('pipeline_runs').insert({ trigger }).select('id').single();

  try {
    // Scraping stops starting companies at ~155s; with the 60s per-company limit it ends by ~215s, which
    // always leaves matching (and the Vault) its share of the 300s function.
    const scrape = await runScrape(supabase, { budgetMs: 180_000 });
    // Postings the scrape found taken down leave every Discovery list and Vault before matching.
    const retired = await retireClosedMatches(supabase);
    const matches = await matchAllUsers(supabase, deadline);
    const vaulted = matches.reduce((s, m) => s + m.vaulted, 0);

    const summary = {
      companies_scraped: scrape.scraped,
      companies_failed: scrape.failed,
      jobs_found: scrape.totalJobs,
      jobs_embedded: scrape.embedded,
      users_matched: matches.length,
      vaulted,
      notes: {
        retired,
        skippedForTime: scrape.skippedForTime,
        failures: scrape.results
          .filter((r) => r.status === 'failed')
          .map((r) => ({ company: r.company, error: r.error })),
      },
    };
    if (run)
      await supabase
        .from('pipeline_runs')
        .update({ ...summary, finished_at: new Date().toISOString() })
        .eq('id', run.id);

    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary, matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (run)
      await supabase
        .from('pipeline_runs')
        .update({ finished_at: new Date().toISOString(), notes: { error: message } })
        .eq('id', run.id);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
