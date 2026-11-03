import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validate';
import { serverError } from '@/lib/api';
import { TailorError } from '@/lib/ai/tailor';
import { COACH_KINDS, CoachError, JOBLESS, runCoach, type CoachKind, type MockLine } from '@/lib/coach';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// POST { kind, matchId?, history?, offer?, force? } — one COACH answer: interview prep, a mock interview turn, a follow-up,
// the referral kit, pay negotiation, the upskill plan or the LinkedIn rewrite.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return fail('Unauthorized', 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = body?.kind as CoachKind;
  if (!COACH_KINDS.includes(kind)) return fail('Expected { kind }', 400);
  if (!JOBLESS.includes(kind) && !isUuid(body?.matchId)) return fail('Expected { matchId }', 400);
  // A transcript is user text going into a prompt: bounded in length and turns.
  const history: MockLine[] = (Array.isArray(body?.history) ? body.history : [])
    .slice(-12)
    .filter((h): h is MockLine => typeof h?.question === 'string' && typeof h?.answer === 'string')
    .map((h) => ({ question: h.question.slice(0, 600), answer: h.answer.slice(0, 3000) }));

  try {
    const result = await runCoach(createServerClient(), userId, kind, {
      matchId: body?.matchId as string | undefined,
      history,
      offer: typeof body?.offer === 'string' ? body.offer.slice(0, 500) : '',
      force: body?.force === true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CoachError || err instanceof TailorError) return fail(err.message, err.status);
    return serverError('COACH', err);
  }
}
