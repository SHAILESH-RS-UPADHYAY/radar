import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { disconnectGmail, gmailConfig, syncGmail } from '@/lib/gmail';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYNC_COOLDOWN_MS = 60_000;

async function readLink(userId: string) {
  return createServerClient()
    .from('gmail_links')
    .select('email, connected_at, last_synced_at, last_error')
    .eq('user_id', userId)
    .maybeSingle();
}

// GET — link status for Settings. `ready` is false until migration 006 has been run.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await readLink(userId);
  if (error && !isSchemaMissing(error)) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: !!gmailConfig(), ready: !error, link: data ?? null });
}

// POST — sync now. The automatic loop also syncs every linked inbox.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: link } = await readLink(userId);
  const since = link?.last_synced_at ? Date.now() - Date.parse(link.last_synced_at) : Infinity;
  if (since < SYNC_COOLDOWN_MS) {
    const wait = Math.ceil((SYNC_COOLDOWN_MS - since) / 1000);
    return NextResponse.json({ error: 'Synced a moment ago. Try again in ' + wait + 's.' }, { status: 429 });
  }
  try {
    const result = await syncGmail(createServerClient(), userId);
    return NextResponse.json(result, { status: result.error ? 409 : 200 });
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
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
