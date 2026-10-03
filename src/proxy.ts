// Next 16 'proxy' (formerly middleware): runs before routes render. Pages below require a session;
// API routes check auth themselves so they can answer 401 instead of redirecting.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)', '/settings(.*)', '/phantom(.*)']);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth.protect();
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
