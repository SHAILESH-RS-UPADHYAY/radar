import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { setMatchStatus } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'saved', 'applied', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];

// PATCH { ids: string[], status, resumeVersionId? } — move matches between Discovery / Vault / Applied /
// dismissed. resumeVersionId (from RUN) records which tailored resume went out with the application.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    ids?: unknown;
    status?: unknown;
    resumeVersionId?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter(isUuid).slice(0, 500) : [];
  const status = body?.status as Status;
  if (!ids.length || !STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'Expected { ids: string[], status: new|saved|applied|dismissed }' },
      { status: 400 },
    );
  }

  const version = isUuid(body?.resumeVersionId) ? body.resumeVersionId : null;
  const { updated, error } = await setMatchStatus(createServerClient(), userId, ids, status, version);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ updated });
}
