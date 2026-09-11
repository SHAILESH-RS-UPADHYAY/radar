import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { runScrape } from '@/lib/pipeline/scrape';
import { isCronAuthorized } from '@/lib/pipeline/cron-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Scrape only. For the full automatic loop (scrape → match → vault) use /api/cron.
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const companyIds = req.nextUrl.searchParams.get('companies')?.split(',').filter(Boolean);
    const summary = await runScrape(createServerClient(), { budgetMs: 270_000, companyIds });
    return NextResponse.json({
      message:
        'Scraped ' +
        summary.scraped +
        '/' +
        summary.totalCompanies +
        ' sources, ' +
        summary.totalJobs +
        ' jobs, ' +
        summary.embedded +
        ' newly embedded',
      ...summary,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
