// The employer behind a careers page you opened yourself, for C2 · OPS and for matching Gmail replies by company.

const ATS_PATH =
  /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|recruitee\.com|breezy\.hr|smartrecruiters\.com|teamtailor\.com|welcometothejungle\.com)$/i;
const GENERIC = /^(www|careers?|jobs?|apply|boards|job-boards|app|hire|talent|work|en|in)$/i;

const titleCase = (s: string) =>
  s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** "jobs.lever.co/cohere/…" → "Cohere"; "acme.wd5.myworkdayjobs.com" → "Acme"; "careers.cohere.com" → "Cohere". */
export function employerFromPage(url: URL, siteName = '', title = ''): string {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.split('/').filter(Boolean);
  if (ATS_PATH.test(host)) {
    // Welcome to the Jungle: /en/companies/<slug>/jobs/…
    const i = path.indexOf('companies');
    const slug = i >= 0 ? path[i + 1] : path[0];
    if (slug) return titleCase(slug);
  }
  if (/myworkdayjobs\.com$/.test(host)) return titleCase(host.split('.')[0]);
  const site = siteName.trim();
  if (site && !/careers|jobs|workday|greenhouse|lever/i.test(site)) return site.slice(0, 120);
  // "Software Engineer - Cohere" / "Careers at Cohere"
  const fromTitle = /(?:careers at|jobs at|\bat)\s+([^|\-–—]+)$/i.exec(title)?.[1]?.trim();
  if (fromTitle) return fromTitle.slice(0, 120);
  const parts = host.split('.').filter((p) => !GENERIC.test(p));
  const name = parts.length > 1 ? parts[parts.length - 2] : parts[0] || host;
  return titleCase(name);
}
