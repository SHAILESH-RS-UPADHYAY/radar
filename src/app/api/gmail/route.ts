import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { disconnectGmail, gmailConfig, syncGmail } from '@/lib/gmail';
import { ALERT_PROVIDERS, type AlertReadState } from '@/lib/scraper/alert-email';
import { runScrape } from '@/lib/pipeline/scrape';
import { matchUser } from '@/lib/pipeline/match';
import { serverError } from '@/lib/api';

// SYNC NOW reads replies, reads the alert emails and scores what they brought: up to a couple of minutes.
export const maxDuration = 150;
export const dynamic = 'force-dynamic';

const SYNC_COOLDOWN_MS = 60_000;

async function readLink(userId: string) {
  return createServerClient()
    .from('gmail_links')
    .select('email, connected_at, last_synced_at, last_error')
    .eq('user_id', userId)
    .maybeSingle();
}

interface AlertSourceStatus extends Partial<AlertReadState> {
  provider: string;
  /** Jobs from this source open in RADAR now. */
  open: number;
  readAt: string | null;
}

/** Per alert source: what the last read found, and how many of its jobs are open in RADAR. */
async function alertStatus(): Promise<AlertSourceStatus[]> {
  const supabase = createServerClient();
  const [{ data: states }, { data: companies }] = await Promise.all([
    supabase
      .from('source_state')
      .select('source, synced_at, notes')
      .in(
        'source',
        ALERT_PROVIDERS.map((p) => 'alerts:' + p),
      ),
    supabase.from('companies').select('id, ats_provider').in('ats_provider', ALERT_PROVIDERS),
  ]);
  return Promise.all(
    ALERT_PROVIDERS.map(async (provider) => {
      const state = (states || []).find((s) => s.source === 'alerts:' + provider);
      const company = (companies || []).find((c) => c.ats_provider === provider);
      const { count } = company
        ? await supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('is_active', true)
        : { count: 0 };
      return { provider, open: count ?? 0, readAt: state?.synced_at ?? null, ...(state?.notes as AlertReadState) };
    }),
  );
}

// GET — link status for Settings, with what each job-alert source brought. `ready` is false until migration 006.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await readLink(userId);
  if (error && !isSchemaMissing(error)) return serverError('API /gmail', error);
  return NextResponse.json({
    configured: !!gmailConfig(),
    ready: !error,
    link: data ?? null,
    alerts: data ? await alertStatus() : [],
  });
}

// POST — sync now: recruiter replies into C2 · OPS, then your job-alert emails into Discovery, scored for you.
// The 6-hour loop does the same for every linked inbox.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: link } = await readLink(userId);
  const since = link?.last_synced_at ? Date.now() - Date.parse(link.last_synced_at) : Infinity;
  if (since < SYNC_COOLDOWN_MS) {
    const wait = Math.ceil((SYNC_COOLDOWN_MS - since) / 1000);
    return NextResponse.json({ error: 'Synced a moment ago. Try again in ' + wait + 's.' }, { status: 429 });
  }
  const supabase = createServerClient();
  try {
    const replies = await syncGmail(supabase, userId);
    if (replies.error) return NextResponse.json(replies, { status: 409 });
    const { data: sources } = await supabase.from('companies').select('id').in('ats_provider', ALERT_PROVIDERS);
    const scrape = await runScrape(supabase, { companyIds: (sources || []).map((c) => c.id), budgetMs: 110_000 });
    // Scoring needs a resume; without one the alert jobs still wait in RADAR for your first scan.
    const vaulted = await matchUser(supabase, userId).then(
      (m) => m.vaulted,
      () => null,
    );
    return NextResponse.json({ ...replies, alertJobs: scrape.totalJobs, vaulted });
  } catch (err) {
    console.error('[GMAIL] sync failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Gmail sync failed. Try again in a minute.' }, { status: 502 });
  }
}

// DELETE — disconnect: revoke at Google and forget the token.
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await disconnectGmail(createServerClient(), userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('API /gmail', err);
  }
}
