import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { MAX_TARGETS, siteDomain } from '@/lib/discovery/targets';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SOURCES = ['startupmap', 'yc', 'import'] as const;
const STATUSES = ['pending', 'linked', 'no_feed', 'failed'] as const;
const MIGRATION_HINT = 'Discovery needs migration 007. Run supabase/migrations/007_discovery_verify_autopilot.sql.';

// GET — discovery progress for Settings: queue counts per source and StartupMap's crawl state.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();

  const cells = SOURCES.flatMap((source) => STATUSES.map((status) => ({ source, status })));
  const [state, ...counts] = await Promise.all([
    supabase.from('source_state').select('synced_at, notes').eq('source', 'startupmap').maybeSingle(),
    ...cells.map(({ source, status }) =>
      supabase
        .from('discovered_companies')
        .select('id', { count: 'exact', head: true })
        .eq('source', source)
        .eq('status', status),
    ),
  ]);
  if (isSchemaMissing(state.error)) return NextResponse.json({ ready: false, hint: MIGRATION_HINT });
  if (state.error) return serverError('API /discovery', state.error);

  const totals = Object.fromEntries(SOURCES.map((s) => [s, Object.fromEntries(STATUSES.map((st) => [st, 0]))]));
  cells.forEach(({ source, status }, i) => (totals[source][status] = counts[i].count ?? 0));
  const notes = (state.data?.notes || {}) as {
    pages?: string[];
    cursor?: number;
    pausedUntil?: string;
    lastError?: string;
  };
  return NextResponse.json({
    ready: true,
    totals,
    startupmap: {
      syncedAt: state.data?.synced_at ?? null,
      pagesLeft: Math.max(0, (notes.pages?.length ?? 0) - (notes.cursor ?? 0)),
      paused: !!notes.pausedUntil && Date.parse(notes.pausedUntil) > Date.now(),
      lastError: notes.lastError ?? null,
    },
  });
}

// POST { targets: [{ name?, website }] } — queue companies you pick (a FundedStartupsDaily CSV export you
// bought, companies you liked on WorldStartupMap, …). RADAR finds each one's careers feed on the next run.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { targets?: unknown } | null;
  if (!Array.isArray(body?.targets) || !body.targets.length)
    return NextResponse.json({ error: 'Send { targets: [{ name, website }] }.' }, { status: 400 });
  if (body.targets.length > MAX_TARGETS)
    return NextResponse.json({ error: `Up to ${MAX_TARGETS} companies per import.` }, { status: 400 });

  const rows = new Map<string, { source: string; source_ref: string; name: string | null; website: string }>();
  for (const t of body.targets as { name?: unknown; website?: unknown }[]) {
    const domain = typeof t?.website === 'string' ? siteDomain(t.website) : null;
    if (!domain || rows.has(domain)) continue;
    const name = typeof t.name === 'string' ? t.name.trim().slice(0, 120) || null : null;
    rows.set(domain, { source: 'import', source_ref: domain, name, website: 'https://' + domain });
  }
  if (!rows.size) return NextResponse.json({ error: 'No valid company websites found.' }, { status: 400 });

  const { data, error } = await createServerClient()
    .from('discovered_companies')
    .upsert([...rows.values()], { onConflict: 'source,source_ref', ignoreDuplicates: true })
    .select('id');
  if (isSchemaMissing(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
  if (error) return serverError('API /discovery', error);
  const queued = data?.length ?? 0;
  return NextResponse.json({ queued, alreadyKnown: rows.size - queued });
}
