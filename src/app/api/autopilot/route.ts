import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { cleanAutopilot, MIGRATION_HINT, parkedToday, todaysQueue } from '@/lib/autopilot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function respond(userId: string, build: boolean) {
  try {
    const today = await todaysQueue(createServerClient(), userId, build);
    if (!today) return fail(MIGRATION_HINT, 503);
    return NextResponse.json(today);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
}

// GET — ZERO-DAY: your settings, today's queue and the live supply per city.
// GET ?parked=1 — only today's jobs left to you (light: the dashboard's NEEDS YOU panel).
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  if (req.nextUrl.searchParams.get('parked') !== '1') return respond(userId, false);
  try {
    const parked = await parkedToday(createServerClient(), userId);
    return NextResponse.json({ parked: parked ?? [], ready: parked !== null });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
}

// POST — build today's queue (once a day; later calls return the same queue).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  return respond(userId, true);
}

// PATCH { settings } — save your autopilot settings (merged with what you have, then checked field by field).
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  const body = (await req.json().catch(() => null)) as { settings?: unknown } | null;
  if (!body?.settings || typeof body.settings !== 'object') return fail('Expected { settings }', 400);
  const supabase = createServerClient();
  const { data, error } = await supabase.from('user_profiles').select('autopilot').eq('id', userId).maybeSingle();
  if (error) return fail(error.message.includes('autopilot') ? MIGRATION_HINT : error.message, 500);
  if (!data) return fail('Complete onboarding first.', 404);
  const settings = cleanAutopilot({ ...cleanAutopilot(data.autopilot), ...(body.settings as object) });
  const { error: e } = await supabase.from('user_profiles').update({ autopilot: settings }).eq('id', userId);
  if (e) return fail(e.message, 500);
  return NextResponse.json({ settings });
}
