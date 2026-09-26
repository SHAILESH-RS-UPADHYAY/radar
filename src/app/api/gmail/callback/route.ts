import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/client';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { exchangeCode, gmailConfig, gmailProfile, GMAIL_STATE_COOKIE, revokeToken, sealToken } from '@/lib/gmail';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** Back to Settings with the outcome; the one-time state cookie is cleared either way. */
function back(outcome: string) {
  const res = NextResponse.redirect(SITE_URL + '/settings?gmail=' + outcome + '#gmail');
  res.cookies.set(GMAIL_STATE_COOKIE, '', { path: '/api/gmail', maxAge: 0 });
  return res;
}

// GET — Google returns here with ?code&state, or ?error when the user cancels.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(SITE_URL + '/sign-in');
  const cfg = gmailConfig();
  if (!cfg) return back('not-configured');

  const params = req.nextUrl.searchParams;
  const state = params.get('state');
  // The state must be the one /api/gmail/connect set in this browser, or the callback is forged.
  if (!state || state !== req.cookies.get(GMAIL_STATE_COOKIE)?.value) return back('state-mismatch');
  if (params.get('error')) return back('denied');
  const code = params.get('code');
  if (!code) return back('failed');

  try {
    const tokens = await exchangeCode(cfg, code);
    // Without a refresh token RADAR could read the inbox only for the next hour, so the link is useless.
    if (!tokens.refresh_token) {
      await revokeToken(tokens.access_token!);
      return back('no-refresh-token');
    }
    const { emailAddress } = await gmailProfile(tokens.access_token!);
    const { error } = await createServerClient()
      .from('gmail_links')
      .upsert({
        user_id: userId,
        email: emailAddress,
        refresh_token_enc: sealToken(cfg, tokens.refresh_token),
        connected_at: new Date().toISOString(),
        last_error: null,
      });
    if (error) {
      await revokeToken(tokens.refresh_token);
      console.error('[GMAIL] saving link failed:', error.message);
      return back(isSchemaMissing(error) ? 'needs-migration' : 'failed');
    }
    return back('connected');
  } catch (err) {
    console.error('[GMAIL] callback failed:', err instanceof Error ? err.message : err);
    return back('failed');
  }
}
