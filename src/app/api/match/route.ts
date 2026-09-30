import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { matchUser, MatchError } from '@/lib/pipeline/match';
import { retireClosedMatches } from '@/lib/pipeline/verify';
import { explainVectorError } from '@/lib/ai/embeddings';
import type { ScanEvent } from '@/lib/scan-events';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// A scan scores hundreds of jobs; a double click or a stuck button should not run it twice.
const COOLDOWN_MS = 15_000;

const failure = (err: unknown) => {
  const config = explainVectorError(err);
  const status = config ? 503 : err instanceof MatchError ? err.status : 500;
  const error = config || (err instanceof Error ? err.message : String(err));
  console.error('[MATCH]', error);
  return { error, status };
};

// POST /api/match — rescore every open job for you. With ?stream=1 the answer is one JSON event per line, sent as each
// stage finishes (the SCAN://LIVE console draws them); without it, one JSON summary at the end.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  const { data: last } = await supabase.from('user_profiles').select('last_matched_at').eq('id', userId).maybeSingle();
  const since = last?.last_matched_at ? Date.now() - Date.parse(last.last_matched_at) : Infinity;
  if (since < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - since) / 1000);
    return NextResponse.json(
      { error: 'Scanned a moment ago. Try again in ' + wait + 's.' },
      { status: 429, headers: { 'retry-after': String(wait) } },
    );
  }

  // Closed postings leave your lists first, so the scan shows only live jobs.
  const run = async (report: (e: ScanEvent) => void) => {
    const retired = await retireClosedMatches(supabase, userId);
    report({ stage: 'retire', closed: retired });
    return { summary: await matchUser(supabase, userId, report), retired };
  };

  if (req.nextUrl.searchParams.get('stream') === '1') {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Closing the console cancels the stream; the scan still finishes and saves, it just stops reporting.
        let open = true;
        const send = (e: ScanEvent) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
          } catch {
            open = false;
          }
        };
        try {
          const { summary, retired } = await run(send);
          send({ stage: 'done', total: summary.total, vaulted: summary.vaulted, retired, message: summary.message });
        } catch (err) {
          send({ stage: 'error', ...failure(err) });
        } finally {
          try {
            controller.close();
          } catch {
            // Already cancelled by the reader.
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  try {
    const { summary, retired } = await run(() => {});
    return NextResponse.json({
      message:
        (summary.message || 'Computed ' + summary.total + ' matches, ' + summary.vaulted + ' new in your Vault') +
        (retired ? ` · ${retired} closed postings cleared` : ''),
      ...summary,
      retired,
    });
  } catch (err) {
    const { error, status } = failure(err);
    return NextResponse.json({ error }, { status });
  }
}
