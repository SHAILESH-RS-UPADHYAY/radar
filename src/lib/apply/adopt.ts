// Jobs RADAR did not scrape but you are applying to: a careers page you adopted with the extension, or an application
// RADAR first heard of from your mail. They hang off one board company; `employer` carries the real name.

import type { SupabaseClient } from '@supabase/supabase-js';

const FINDS_COMPANY = 'Your finds';
let findsId: Promise<string> | null = null;

/** The company row your own finds hang off, created on first use. */
export function findsCompanyId(supabase: SupabaseClient): Promise<string> {
  findsId ??= (async () => {
    const { data } = await supabase.from('companies').select('id').eq('name', FINDS_COMPANY).maybeSingle();
    if (data) return data.id as string;
    const { data: made, error } = await supabase
      .from('companies')
      .insert({
        name: FINDS_COMPANY,
        ats_provider: 'custom',
        careers_url: 'https://radar.local/finds',
        category: 'Board',
      })
      .select('id')
      .single();
    if (error) throw new Error('Creating your finds failed: ' + error.message);
    return made.id as string;
  })().catch((err) => {
    findsId = null; // a failed lookup is retried on the next call
    throw err;
  });
  return findsId;
}

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
