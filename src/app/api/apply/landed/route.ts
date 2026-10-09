import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { atsFromUrl } from '@/lib/apply/form';
import { BOARD_PROVIDERS } from '@/types';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const Body = z.object({
  matchId: z.string().refine(isUuid),
  url: z.string().url().max(2000),
});

// The boards whose links pass through to the employer: their own page is never where you apply.
const PASS_THROUGH = /(^|\.)(adzuna\.[a-z.]+|jooble\.org)$/i;

// POST { matchId, url } — the extension followed a job board's link (Adzuna, Jooble) to the employer's page in your
// own browser. RADAR keeps where the job really applies: the next ↯ HACK opens that page directly (and reads its form
// ahead when it is an ATS), and the 6-hour check looks at the employer's page instead of the board's.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Expected { matchId, url }' }, { status: 400 });
  const url = new URL(parsed.data.url);
  if (url.protocol !== 'https:' || PASS_THROUGH.test(url.hostname))
    return NextResponse.json({ error: 'Not an employer page' }, { status: 400 });
  url.hash = '';

  const supabase = createServerClient();
  const { data: match, error } = await supabase
    .from('match_scores')
    .select('job_id, jobs!inner(companies!inner(ats_provider))')
    .eq('user_id', userId)
    .eq('id', parsed.data.matchId)
    .maybeSingle();
  if (error) return serverError('API /apply/landed', error);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const job = (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) as {
    companies: { ats_provider: string } | { ats_provider: string }[];
  };
  const provider = (Array.isArray(job.companies) ? job.companies[0] : job.companies).ats_provider;
  if (!(BOARD_PROVIDERS as readonly string[]).includes(provider))
    return NextResponse.json({ error: 'Only job-board postings lead elsewhere' }, { status: 400 });

  const { error: saveError } = await supabase.from('jobs').update({ resolved_url: url.href }).eq('id', match.job_id);
  if (saveError) return serverError('API /apply/landed', saveError);
  return NextResponse.json({ resolvedUrl: url.href, ats: atsFromUrl(url.href)?.provider ?? null, host: url.hostname });
}
