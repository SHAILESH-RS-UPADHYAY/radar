// Public facts about the deployment, for metadata, robots.txt, the sitemap and the legal pages.

/** Canonical origin: NEXT_PUBLIC_SITE_URL, else Vercel's production domain, else local dev. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '') ||
  'http://localhost:3000';

/** Contact address for privacy and terms questions; the pages omit the line when it is unset. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

/** Pages anyone can visit, in sitemap order. */
export const PUBLIC_PATHS = ['/', '/system', '/protocol', '/architecture', '/privacy', '/terms'];
