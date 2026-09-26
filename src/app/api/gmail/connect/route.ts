import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { authUrl, gmailConfig, GMAIL_STATE_COOKIE } from '@/lib/gmail';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

// GET — send the signed-in user to Google's consent screen (read-only Gmail). The random state in an
// httpOnly cookie is checked on the way back, so a forged callback cannot link someone else's inbox.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(SITE_URL + '/sign-in');
  const cfg = gmailConfig();
  if (!cfg) return NextResponse.redirect(SITE_URL + '/settings?gmail=not-configured#gmail');

  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(authUrl(cfg, state));
  res.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: SITE_URL.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/gmail',
    maxAge: 600,
  });
  return res;
}
