// Shared answers for the API routes: a failure inside RADAR is logged where it happened, and the client gets a plain
// message, because a database or provider error names tables, columns and constraints.

import { NextResponse } from 'next/server';

export const SERVER_ERROR = 'Something went wrong on our side. Try again in a minute.';

/** Log a failure inside RADAR with where it happened; answer 500 without its internals. */
export function serverError(where: string, err: unknown): NextResponse {
  const detail = err instanceof Error ? err.message : ((err as { message?: unknown } | null)?.message ?? err);
  console.error(`[${where}]`, detail);
  return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
}
