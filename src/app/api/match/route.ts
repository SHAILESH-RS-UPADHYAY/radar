import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { matchUser, MatchError } from '@/lib/pipeline/match';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const summary = await matchUser(createServerClient(), userId);
    return NextResponse.json({
      message: summary.message || 'Computed ' + summary.total + ' matches, ' + summary.vaulted + ' new in your Vault',
      ...summary,
    });
  } catch (err) {
    const status = err instanceof MatchError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MATCH]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
