// ============================
// RADAR — StartupMap (startupmap.one) directory reader
// ============================
// About 4,700 funded European startups. Each /startup/<slug> page carries schema.org JSON-LD (name, website,
// city, stage) and links straight to the company's live postings on its ATS, which tells RADAR which board to
// read. Only sitemap-listed public pages are read; /api is off-limits in robots.txt and never touched.
// Pure parsers here; the crawl itself (pacing, queue) lives in run.ts.

import { decodeEntities } from '@/lib/scraper/utils';

export const STARTUPMAP = 'https://startupmap.one';

export interface DirectoryCompany {
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
  funding_stage: string | null;
  /** Outbound links to the company's job postings (StartupMap tags them utm_source=startupmap). */
  jobLinks: string[];
}

/** Startup slugs, plus the /jobs/<city>/engineering pages, listed in the sitemap. */
export function readSitemap(xml: string): { slugs: string[]; engineeringPages: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const slugs = locs.map((l) => l.match(/\/startup\/([^/?#]+)$/)?.[1]).filter((s): s is string => !!s);
  return {
    slugs: [...new Set(slugs)],
    engineeringPages: locs.filter((l) => /\/jobs\/[^/]+\/engineering$/.test(l)),
  };
}

/** Startups a /jobs/... page links to: they are hiring there right now. */
export function hiringSlugs(html: string): string[] {
  return [...new Set([...html.matchAll(/href="\/startup\/([^"?#/]+)"/g)].map((m) => m[1]))];
}

const STAGE = /^(pre-?seed|seed|series [a-z]\+?|growth|late stage|ipo|public|acquired|bootstrapped|grant)$/i;

interface JsonLdNode {
  '@type'?: string;
  name?: string;
  url?: string;
  keywords?: string;
  location?: { address?: { addressLocality?: string; addressCountry?: string } };
}

/** One /startup/<slug> page → company facts and job links. Null when the page has no organisation data. */
export function parseStartupPage(html: string): DirectoryCompany | null {
  let org: JsonLdNode | undefined;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: JsonLdNode[] = data['@graph'] || [data];
      org = nodes.find((n) => n['@type'] === 'Organization' && n.url && !n.url.includes('startupmap.one'));
      if (org) break;
    } catch {
      // a malformed block; try the next one
    }
  }
  if (!org?.name) return null;

  const keywords = String(org.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const address = org.location?.address || {};
  const jobLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
    .map((m) => decodeEntities(m[1]))
    .filter((u) => /[?&]utm_source=startupmap/.test(u));

  return {
    name: decodeEntities(org.name).trim(),
    website: org.url || null,
    city: address.addressLocality?.trim() || null,
    country: address.addressCountry?.trim() || null,
    funding_stage: keywords.find((k) => STAGE.test(k)) || null,
    sector: keywords.find((k) => !STAGE.test(k)) || null,
    jobLinks: [...new Set(jobLinks)],
  };
}

/** "/jobs/new-york/engineering" → "new-york" */
export const pageCity = (url: string) => url.match(/\/jobs\/([^/]+)\/engineering$/)?.[1] ?? '';

/** "New York" → "new-york", matching StartupMap's city slugs. */
export const citySlug = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
