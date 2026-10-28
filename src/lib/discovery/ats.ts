// ============================
// RADAR — Which applicant-tracking system does a link point at?
// ============================
// Startup directories and careers pages link to job postings. The host and path of those links name the
// ATS board RADAR can read (identifier formats: scraper/adapters.ts). Pure functions, no network.

import type { AtsProvider } from '@/types';
import { decodeEntities } from '@/lib/scraper/utils';

export interface AtsRef {
  provider: AtsProvider;
  identifier: string;
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'career', 'careers', 'help', 'support']);

function parse(raw: string): URL | null {
  try {
    return new URL(decodeEntities(raw.trim()));
  } catch {
    return null;
  }
}

const segments = (u: URL) =>
  u.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

/** The ATS board a job or careers URL belongs to, or null for any other link. */
export function atsFromUrl(raw: string): AtsRef | null {
  const u = parse(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const path = segments(u);
  const sub = host.split('.')[0];
  const ref = (provider: AtsProvider, id: string | null | undefined, keepCase = false): AtsRef | null =>
    id && SLUG.test(id) ? { provider, identifier: keepCase ? id : id.toLowerCase() } : null;

  if (host === 'jobs.ashbyhq.com') return ref('ashby', path[0]);
  if (host === 'api.ashbyhq.com' && path[0] === 'posting-api') return ref('ashby', path[2]);
  if (/^(job-)?boards(\.eu)?\.greenhouse\.io$/.test(host))
    return ref('greenhouse', path[0] === 'embed' ? u.searchParams.get('for') : path[0]);
  if (host === 'boards-api.greenhouse.io' && path[1] === 'boards') return ref('greenhouse', path[2]);
  if (host === 'jobs.lever.co') return ref('lever', path[0]);
  if (host === 'jobs.eu.lever.co')
    return path[0] && SLUG.test(path[0]) ? { provider: 'lever', identifier: 'eu:' + path[0].toLowerCase() } : null;
  if (host === 'api.lever.co' && path[1] === 'postings') return ref('lever', path[2]);
  if (host === 'apply.workable.com') return ref('workable', path[0] === 'api' ? path[4] : path[0]);
  // SmartRecruiters company identifiers are case-sensitive ("ServiceNow").
  if (host === 'jobs.smartrecruiters.com' || host === 'careers.smartrecruiters.com')
    return ref('smartrecruiters', path[0], true);
  if (host.endsWith('.recruitee.com') && !RESERVED_SUBDOMAINS.has(sub)) return ref('recruitee', sub);
  if (/\.jobs\.personio\.(de|com)$/.test(host)) return ref('personio', sub);
  if (host.endsWith('.breezy.hr') && !RESERVED_SUBDOMAINS.has(sub)) return ref('breezy', sub);
  if (host.endsWith('.teamtailor.com') && host.split('.').length === 3 && !RESERVED_SUBDOMAINS.has(sub))
    return { provider: 'teamtailor', identifier: host };
  const workday = host.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/);
  if (workday) {
    const site = path.find((s) => !/^[a-z]{2}-[A-Z]{2}$/.test(s));
    return site && SLUG.test(site) ? { provider: 'workday', identifier: `${workday[1]}/${workday[2]}/${site}` } : null;
  }
  return null;
}

/** The board most of these links point at (a page can also link to a partner's board once). */
export function detectAts(urls: Iterable<string>): AtsRef | null {
  const votes = new Map<string, { ref: AtsRef; n: number }>();
  for (const url of urls) {
    const ref = atsFromUrl(url);
    if (!ref) continue;
    const key = ref.provider + ':' + ref.identifier.toLowerCase();
    const vote = votes.get(key);
    if (vote) vote.n += 1;
    else votes.set(key, { ref, n: 1 });
  }
  let best: { ref: AtsRef; n: number } | null = null;
  for (const vote of votes.values()) if (!best || vote.n > best.n) best = vote;
  return best?.ref ?? null;
}

/** Greenhouse job id from `?gh_jid=` — a Greenhouse board embedded on the company's own domain. */
export function greenhouseJobId(url: string): string | null {
  const id = parse(url)?.searchParams.get('gh_jid');
  return id && /^\d+$/.test(id) ? id : null;
}

/** Host of a Teamtailor-style job link on a custom domain: /jobs/<numeric id>-<title>. Needs a feed check. */
export function teamtailorJobHost(url: string): string | null {
  const u = parse(url);
  return u && /^\/jobs\/\d{5,}-/.test(u.pathname) ? u.hostname.toLowerCase() : null;
}

/** Board tokens worth trying for a company, from its website's domain and its name. */
export function slugCandidates(name: string | null, website: string | null): string[] {
  const out: string[] = [];
  const host = website ? parse(website.includes('://') ? website : 'https://' + website)?.hostname : null;
  if (host) out.push(host.replace(/^(www|careers|jobs)\./, '').split('.')[0]);
  if (name) {
    const words = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean);
    out.push(words.join(''), words.join('-'), words[0] || '');
  }
  return [...new Set(out.filter((s) => s.length >= 2 && SLUG.test(s)))].slice(0, 4);
}

const normName = (s: string | null | undefined) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

/**
 * How well a board's company name fits a company: 'exact' ("Stripe" / "stripe"), 'prefix' ("Palantir" /
 * "Palantir Technologies", 4+ letters) or null.
 */
export function nameMatches(
  board: string | null | undefined,
  company: string | null | undefined,
): 'exact' | 'prefix' | null {
  const a = normName(board);
  const b = normName(company);
  if (!a || !b) return null;
  if (a === b) return 'exact';
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short) ? 'prefix' : null;
}

/** The host of a website or URL without "www.", or null. */
export function siteHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return (
    parse(raw.includes('://') ? raw : 'https://' + raw)
      ?.hostname.replace(/^www\./, '')
      .toLowerCase() || null
  );
}

/** Two links on the same site: "https://legora.com/careers" and "www.legora.com", or a subdomain of it. */
export function sameSite(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = siteHost(a);
  const y = siteHost(b);
  return !!x && !!y && (x === y || x.endsWith('.' + y) || y.endsWith('.' + x));
}

/** Public board URL, stored as the company's careers link. */
export function boardUrl({ provider, identifier: id }: AtsRef): string {
  switch (provider) {
    case 'ashby':
      return 'https://jobs.ashbyhq.com/' + id;
    case 'greenhouse':
      return 'https://job-boards.greenhouse.io/' + id;
    case 'lever':
      return id.startsWith('eu:') ? 'https://jobs.eu.lever.co/' + id.slice(3) : 'https://jobs.lever.co/' + id;
    case 'workable':
      return 'https://apply.workable.com/' + id;
    case 'smartrecruiters':
      return 'https://jobs.smartrecruiters.com/' + id;
    case 'recruitee':
      return 'https://' + id + '.recruitee.com';
    case 'personio':
      return 'https://' + id + '.jobs.personio.de';
    case 'breezy':
      return 'https://' + id + '.breezy.hr';
    case 'teamtailor':
      return 'https://' + id + '/jobs';
    case 'workday': {
      const [tenant, wd, site] = id.split('/');
      return `https://${tenant}.${wd}.myworkdayjobs.com/${site}`;
    }
    case 'amazon':
      return 'https://www.amazon.jobs/';
    case 'eightfold':
      return 'https://' + id.split('|')[0] + '/careers';
  }
}

/** Absolute URLs of every href/src on a page, resolved against the page's own URL. */
export function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"'#\s][^"']*)["']/gi)) {
    try {
      const u = new URL(decodeEntities(m[1]), base);
      if (u.protocol === 'https:' || u.protocol === 'http:') out.add(u.href);
    } catch {
      // not a URL
    }
  }
  return [...out];
}
