import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';

/** Vercel Cron and the GitHub Actions schedule both send `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(req: NextRequest) {
  const secret = env.cronSecret();
  if (secret) return req.headers.get('authorization') === 'Bearer ' + secret;
  return process.env.NODE_ENV !== 'production';
}
