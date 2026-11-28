import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { serverError } from '@/lib/api';
import { politeFetcher } from '@/lib/discovery/polite';
import { checkPosting, mayOpen, recordChecks } from '@/lib/pipeline/verify';

export const dynamic = 'force-dynamic';

const Body = z.object({ matchId: z.string().refine(isUuid) });

// POST { matchId } — the extension opened this job's form and found the posting gone (expired, removed).
// Jobs are shared by every user, so one report never closes a job on its word: RADAR opens the link itself, and only
// when it reads "closed" too is the job closed for everyone (it leaves every feed, like the 6-hour check does).
// Other users' matches on it are retired by the next cycle. Either way it leaves your Discovery and Vault.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Expected { matchId }' }, { status: 400 });

  const supabase = createServerClient();
  const { data: match, error } = await supabase
    .from('match_scores')
    .select('id, status, job_id, jobs!inner(apply_url, resolved_url)')
    .eq('user_id', userId)
    .eq('id', parsed.data.matchId)
    .maybeSingle();
  if (error) return serverError('API /apply/gone', error);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const job = (Array.isArray(match.jobs) ? match.jobs[0] : match.jobs) as {
    apply_url: string;
    resolved_url: string | null;
  };

  const url = [job.resolved_url, job.apply_url].find((u) => u && mayOpen(u));
  const state = url ? await checkPosting(politeFetcher({ timeoutMs: 12_000 }), url) : 'unknown';
  if (state === 'closed') await recordChecks(supabase, [], [match.job_id]);

  // Applied matches stay in C2 · OPS; only Discovery / Vault ones are retired.
  if (match.status === 'new' || match.status === 'saved') {
    const { error: e } = await supabase
      .from('match_scores')
      // Marked retired (back if the posting reopens) only when RADAR saw it closed too; else simply dismissed, or
      // the next cycle would find the job open and bring the match straight back.
      .update(
        state === 'closed'
          ? { status: 'dismissed', retired_at: new Date().toISOString(), retired_from: match.status }
          : { status: 'dismissed' },
      )
      .eq('id', match.id);
    if (e) return serverError('API /apply/gone', e);
  }
  return NextResponse.json({ closed: state === 'closed', checked: state });
}
