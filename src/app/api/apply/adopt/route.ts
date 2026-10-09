import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/client';
import { employerFromPage, findsCompanyId } from '@/lib/apply/adopt';

export const dynamic = 'force-dynamic';

const Body = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(400).default(''),
  heading: z.string().max(400).default(''),
  siteName: z.string().max(200).default(''),
  text: z.string().max(20000).default(''),
});

// POST { url, title, heading, siteName, text } — the extension's ↯ RADAR button on a page RADAR did not open: find
// or create the job for that page and your match for it, so the usual HACK flow (answers, fill, "applied" → C2 · OPS,
// Gmail tracking by company) works on it. The job is kept out of Discovery and the Vault: you found it yourself.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Expected { url, title?, heading?, text? }' }, { status: 400 });
  const page = parsed.data;
  const url = new URL(page.url);
  if (url.protocol !== 'https:') return NextResponse.json({ error: 'Only https pages' }, { status: 400 });
  url.hash = '';

  const supabase = createServerClient();
  let companyId: string;
  try {
    companyId = await findsCompanyId(supabase);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const employer = employerFromPage(url, page.siteName, page.title);
  const title = (page.heading || page.title.split(/\s[|\-–—]\s/)[0] || 'Job at ' + employer).trim().slice(0, 300);
  const externalId = 'page:' + createHash('sha256').update(url.href).digest('hex').slice(0, 24);
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .upsert(
      {
        company_id: companyId,
        external_id: externalId,
        title,
        employer,
        description: page.text || null,
        apply_url: url.href,
        is_active: false,
        scraped_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,external_id' },
    )
    .select('id')
    .single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

  // An existing match keeps its status: opening a page you already applied from must not undo that.
  const { data: had } = await supabase
    .from('match_scores')
    .select('id')
    .eq('user_id', userId)
    .eq('job_id', job.id)
    .maybeSingle();
  let matchId = had?.id as string | undefined;
  if (!matchId) {
    const { data: match, error } = await supabase
      .from('match_scores')
      .insert({ user_id: userId, job_id: job.id, score: 0, section: 'recommended', status: 'saved' })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    matchId = match.id;
  }
  return NextResponse.json({ matchId, company: employer, title });
}
