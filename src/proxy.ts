// Next 16 'proxy' (formerly middleware): runs before routes render. Pages below require a session;
// API routes check auth themselves so they can answer 401 instead of redirecting.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, userAgent } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)', '/settings(.*)', '/zero-day(.*)']);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth.protect();
    }
    // A first visit to the home page starts at the briefing's look screen, once per browser. Only a real page load
    // counts (not a prefetch), never a crawler, never someone signed in. Everyone else gets the home page as before.
    if (
      req.nextUrl.pathname === '/' &&
      req.headers.get('sec-fetch-dest') === 'document' &&
      !req.cookies.has('radar_briefed') &&
      !userAgent(req).isBot &&
      !(await auth()).userId
    ) {
      const res = NextResponse.redirect(new URL('/briefing/look', req.url));
      res.cookies.set('radar_briefed', '1', { maxAge: 60 * 60 * 24 * 730, sameSite: 'lax', path: '/' });
      return res;
    }
  },
  // Signed-out visitors go to our /sign-in page, not the hosted Account Portal, whatever the env says.
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
