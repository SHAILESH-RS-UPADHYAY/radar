import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { matchUser, MatchError } from '@/lib/pipeline/match';
import { retireClosedMatches } from '@/lib/pipeline/verify';
import { explainVectorError } from '@/lib/ai/embeddings';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// A scan scores hundreds of jobs; a double click or a stuck button should not run it twice.
const COOLDOWN_MS = 15_000;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServerClient();
    const { data: last } = await supabase
      .from('user_profiles')
      .select('last_matched_at')
      .eq('id', userId)
      .maybeSingle();
    const since = last?.last_matched_at ? Date.now() - Date.parse(last.last_matched_at) : Infinity;
    if (since < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - since) / 1000);
      return NextResponse.json(
        { error: 'Scanned a moment ago. Try again in ' + wait + 's.' },
        { status: 429, headers: { 'retry-after': String(wait) } },
      );
    }
    // Closed postings leave your lists first, so the scan shows only live jobs.
    const retired = await retireClosedMatches(supabase, userId);
    const summary = await matchUser(supabase, userId);
    return NextResponse.json({
      message:
        (summary.message || 'Computed ' + summary.total + ' matches, ' + summary.vaulted + ' new in your Vault') +
        (retired ? ` · ${retired} closed postings cleared` : ''),
      ...summary,
      retired,
    });
  } catch (err) {
    const config = explainVectorError(err);
    const status = config ? 503 : err instanceof MatchError ? err.status : 500;
    const message = config || (err instanceof Error ? err.message : String(err));
    console.error('[MATCH]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
