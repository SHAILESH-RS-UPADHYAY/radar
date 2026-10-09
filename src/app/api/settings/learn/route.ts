import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { cleanKit, learnKey } from '@/lib/validate';
import { serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// POST { question, answer } — remember your answer to a form question RADAR could not answer, so every later form
// that asks it gets your words (Application Kit → learned). Sent by the extension's panel through the RADAR tab.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { question?: unknown; answer?: unknown } | null;
  const question = typeof body?.question === 'string' ? body.question : '';
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
  if (!learnKey(question) || !answer)
    return NextResponse.json({ error: 'Expected { question, answer }' }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase.from('user_profiles').select('application_kit').eq('id', userId).maybeSingle();
  if (error) return serverError('API /settings/learn', error);
  if (!data) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 404 });
  const kit = cleanKit(data.application_kit);
  const next = cleanKit({ ...kit, learned: { ...kit.learned, [learnKey(question)]: answer } });
  const { error: e } = await supabase.from('user_profiles').update({ application_kit: next }).eq('id', userId);
  if (e) return serverError('API /settings/learn', e);
  return NextResponse.json({ learned: Object.keys(next.learned || {}).length });
}
