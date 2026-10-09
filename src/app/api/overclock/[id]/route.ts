import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validate';
import { loadTailored, MIGRATION_HINT, toView } from '@/lib/overclock';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET — one tailored resume in full (resume, gaps, changes, cover note).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await loadTailored(createServerClient(), userId, id);
  if (isSchemaMissing(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
  if (error) return serverError('API /overclock/[id]', error);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toView(data));
}
