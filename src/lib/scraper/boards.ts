/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================
// RADAR — Job-board sources (many employers per source)
// ============================
// Each of these is a free public feed. The real employer is stored in `employer`.
//   hackernews  "Ask HN: Who is hiring?" (latest month), via the official Algolia HN API
//   remotive    remotive.com/api — ToS: link back to Remotive, don't hammer (a few calls a day)
//   remoteok    remoteok.com/api — ToS: credit Remote OK and link to the job URL
//   arbeitnow   arbeitnow.com/api/job-board-api
//   himalayas   himalayas.app/jobs/api
//   jobicy      jobicy.com/api/v2 — ToS: keep Jobicy as the source, link its canonical job URL, at most hourly
//   themuse     themuse.com/api/public/jobs — public, 500 requests/hour without a key; link back to The Muse
//   adzuna      api.adzuna.com — official API, needs ADZUNA_APP_ID + ADZUNA_APP_KEY; descriptions are snippets
//   jooble      jooble.org/api — official API, needs JOOBLE_API_KEY; descriptions are snippets
//   weworkremotely  weworkremotely.com category RSS (robots.txt allows it); link back to the WWR listing
//   workingnomads   workingnomads.com/api/exposed_jobs (robots.txt allows everything); link back to Working Nomads
//   indeed_email / linkedin_email / wttj_email   your own job-alert emails, through the read-only Gmail link

import { createHash } from 'node:crypto';
import { createServerClient } from '@/lib/supabase/client';
import { splitList } from '@/lib/profile';
import { cityAliases } from '@/lib/geo/city-companies';
import { scrapeAlertEmails } from './alert-email';
import {
  decodeEntities,
  fetchJson,
  finalizeJob,
  htmlToText,
  isRelevantTitle,
  parseSalaryRange,
  searchTerms,
  splitEnvList,
  toIso,
  xmlTag,
  fetchText,
  type ScrapedJob,
} from './utils';

export { BOARD_PROVIDERS } from '@/types';

export async function scrapeBoard(provider: string): Promise<ScrapedJob[]> {
  switch (provider) {
    case 'hackernews':
      return scrapeHackerNews();
    case 'remotive':
      return scrapeRemotive();
    case 'remoteok':
      return scrapeRemoteOk();
    case 'arbeitnow':
      return scrapeArbeitnow();
    case 'himalayas':
      return scrapeHimalayas();
    case 'jobicy':
      return scrapeJobicy();
    case 'themuse':
      return scrapeTheMuse();
    case 'adzuna':
      return scrapeAdzuna();
    case 'jooble':
      return scrapeJooble();
    case 'weworkremotely':
      return scrapeWeWorkRemotely();
    case 'workingnomads':
      return scrapeWorkingNomads();
    case 'hasjob':
      return scrapeHasjob();
    case 'indeed_email':
    case 'linkedin_email':
    case 'wttj_email':
      return scrapeAlertEmails(provider);
    case 'jsearch':
      return scrapeJSearch();
    case 'googlejobs':
      return scrapeGoogleJobs();
    default:
      throw new Error('Unknown board: ' + provider);
  }
}

// ---------- We Work Remotely (RSS) ----------
const WWR_FEEDS = ['remote-programming-jobs', 'remote-devops-sysadmin-jobs'];

/** One RSS <item> → the fields RADAR keeps. Titles read "Company: Role". Pure, for tests. */
export function parseWwrItem(block: string) {
  const [employer, ...role] = xmlTag(block, 'title').split(': ');
  const link = xmlTag(block, 'link');
  return {
    external_id: xmlTag(block, 'guid') || link,
    employer: employer.trim(),
    title: role.join(': ').trim() || employer.trim(),
    region: xmlTag(block, 'region'),
    description: htmlToText(xmlTag(block, 'description')),
    link,
    posted: xmlTag(block, 'pubDate'),
  };
}

async function scrapeWeWorkRemotely(): Promise<ScrapedJob[]> {
  const jobs = new Map<string, ScrapedJob>();
  for (const feed of WWR_FEEDS) {
    const xml = await fetchText(`https://weworkremotely.com/categories/${feed}.rss`);
    for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) || []) {
      const item = parseWwrItem(block);
      if (!item.link || !isRelevantTitle(item.title)) continue;
      jobs.set(
        item.external_id,
        finalizeJob({
          external_id: item.external_id,
          title: item.title,
          description: item.description + '\n\nSource: We Work Remotely',
          location: 'Remote' + (item.region ? ' (' + item.region + ')' : ''),
          apply_url: item.link,
          department: null,
          salary_min: null,
          salary_max: null,
          salary_currency: null,
          // RSS dates read "Wed, 30 Sep 2026 10:00:00 +0000"; Date.parse understands them, toIso's cleanup would not.
          posted_at: toIso(Date.parse(item.posted) || null),
          employer: item.employer,
        }),
      );
    }
  }
  return [...jobs.values()];
}

// ---------- Working Nomads ----------
async function scrapeWorkingNomads(): Promise<ScrapedJob[]> {
  const data = await fetchJson<any[]>('https://www.workingnomads.com/api/exposed_jobs/');
  return (data || [])
    .filter((job: any) => job.url && job.title && isRelevantTitle(job.title))
    .map((job: any) =>
      finalizeJob({
        external_id: String(job.url.match(/\/(\d+)\/?$/)?.[1] || job.url),
        title: decodeEntities(job.title),
        description:
          htmlToText(job.description || '') + (job.tags ? '\n\nTags: ' + job.tags : '') + '\nSource: Working Nomads',
        location: job.location ? 'Remote (' + job.location + ')' : 'Remote',
        apply_url: job.url,
        department: job.category_name || null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        posted_at: toIso(job.pub_date),
        employer: job.company_name || null,
      }),
    );
}

// ---------- Hacker News: Who is hiring? ----------
const ROLE_WORDS =
  /engineer|developer|scientist|designer|manager|lead|architect|analyst|sre|devops|founding|intern|researcher|programmer|swe|full[- ]?stack|frontend|backend|ml|ai/i;

/**
 * Posts conventionally start "Company | Role | Location | Remote | Salary | url".
 * We read the first line, pick the segment that looks like a role, and keep the full text as the description.
 */
export function parseHnPost(
  html: string,
): { employer: string; title: string; location: string; salary: string | null; url: string | null } | null {
  const firstLine = decodeEntities(html.split(/<p>/i)[0].replace(/<[^>]+>/g, '')).trim();
  const parts = firstLine
    .split(/\s+[|•·–—]\s+|\s\|\s?|\|/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const employer = parts[0]
    .replace(/\(.*?\)/g, '')
    .trim()
    .slice(0, 80);
  const rest = parts.slice(1);
  const title = rest.find((p) => ROLE_WORDS.test(p) && p.length < 140) || rest[0];
  const salary = rest.find((p) => /[$€£₹]\s?\d|\d+\s?k\b/i.test(p)) || null;
  const location =
    rest.find(
      (p) =>
        p !== title &&
        p !== salary &&
        /remote|onsite|on-site|hybrid|[A-Z][a-z]+,|\b(US|USA|UK|EU|India|Europe|NYC|SF)\b/.test(p),
    ) || '';
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => decodeEntities(m[1]));
  const url = hrefs.find((h) => /jobs|careers|apply|greenhouse|lever|ashby|workable/i.test(h)) || hrefs[0] || null;

  if (!employer || !title) return null;
  return { employer, title: title.slice(0, 200), location, salary, url };
}

async function scrapeHackerNews(): Promise<ScrapedJob[]> {
  const search = await fetchJson<any>(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10',
  );
  const thread = (search.hits || []).find((h: any) => /who is hiring/i.test(h.title || ''));
  if (!thread) return [];

  const item = await fetchJson<any>('https://hn.algolia.com/api/v1/items/' + thread.objectID, { timeoutMs: 40000 });
  const jobs: ScrapedJob[] = [];
  for (const c of item.children || []) {
    if (!c.text || c.author === 'whoishiring') continue;
    const parsed = parseHnPost(c.text);
    if (!parsed || !isRelevantTitle(parsed.title)) continue;
    const pay = parseSalaryRange(parsed.salary);
    const hnLink = 'https://news.ycombinator.com/item?id=' + c.id;
    jobs.push(
      finalizeJob({
        external_id: String(c.id),
        title: parsed.title,
        description: htmlToText(c.text) + '\n\nHN post: ' + hnLink,
        location: parsed.location,
        apply_url: parsed.url || hnLink,
        department: null,
        salary_min: pay.min,
        salary_max: pay.max,
        salary_currency: pay.currency,
        posted_at: toIso(c.created_at_i),
        employer: parsed.employer,
      }),
    );
  }
  return jobs;
}

// ---------- Remotive ----------
async function scrapeRemotive(): Promise<ScrapedJob[]> {
  const categories = (process.env.RADAR_REMOTIVE_CATEGORIES || 'software-dev,data').split(',');
  const jobs: ScrapedJob[] = [];
  for (const category of categories) {
    const data = await fetchJson<any>(
      'https://remotive.com/api/remote-jobs?category=' + encodeURIComponent(category.trim()),
    );
    for (const job of data.jobs || []) {
      const pay = parseSalaryRange(job.salary);
      jobs.push(
        finalizeJob({
          external_id: String(job.id),
          title: job.title || '',
          description: htmlToText(job.description) + '\n\nSource: Remotive',
          location: 'Remote' + (job.candidate_required_location ? ' (' + job.candidate_required_location + ')' : ''),
          apply_url: job.url || '',
          department: job.category || null,
          work_type: 'remote',
          salary_min: pay.min,
          salary_max: pay.max,
          salary_currency: pay.currency,
          posted_at: toIso(job.publication_date),
          employer: job.company_name || null,
          skills: undefined,
        }),
      );
    }
  }
  return jobs;
}

// ---------- Remote OK ----------
async function scrapeRemoteOk(): Promise<ScrapedJob[]> {
  const data = await fetchJson<any[]>('https://remoteok.com/api');
  return (data || [])
    .filter((job: any) => job.id && job.position)
    .map((job: any) =>
      finalizeJob({
        external_id: String(job.id),
        title: decodeEntities(job.position),
        description: htmlToText(job.description) + '\n\nTags: ' + (job.tags || []).join(', ') + '\nSource: Remote OK',
        location: job.location ? 'Remote (' + job.location + ')' : 'Remote',
        apply_url: job.url || job.apply_url || '',
        department: null,
        work_type: 'remote',
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        salary_currency: job.salary_min ? 'USD' : null,
        posted_at: toIso(job.date || job.epoch),
        employer: job.company || null,
      }),
    );
}

// ---------- Arbeitnow ----------
async function scrapeArbeitnow(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await fetchJson<any>('https://www.arbeitnow.com/api/job-board-api?page=' + page);
    for (const job of data.data || []) {
      jobs.push(
        finalizeJob({
          external_id: job.slug,
          title: job.title || '',
          description: htmlToText(job.description),
          location: job.remote ? (job.location ? job.location + ' (Remote)' : 'Remote') : job.location || '',
          apply_url: job.url || '',
          department: null,
          work_type: job.remote ? 'remote' : null,
          salary_min: null,
          salary_max: null,
          salary_currency: null,
          posted_at: toIso(job.created_at),
          employer: job.company_name || null,
        }),
      );
    }
    if (!data.links?.next) break;
  }
  return jobs;
}

// ---------- Himalayas ----------
async function scrapeHimalayas(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const url: string =
      'https://himalayas.app/jobs/api?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const data: any = await fetchJson<any>(url);
    for (const job of data.jobs || []) {
      const restrictions: string[] = job.locationRestrictions || [];
      jobs.push(
        finalizeJob({
          external_id: job.guid || job.applicationLink,
          title: job.title || '',
          description: htmlToText(job.description || job.excerpt),
          location: 'Remote' + (restrictions.length ? ' (' + restrictions.join(', ') + ')' : ''),
          apply_url: job.applicationLink || job.guid || '',
          department: job.categories?.[0] || null,
          work_type: 'remote',
          salary_min: job.salaryPeriod === 'hourly' ? null : job.minSalary || null,
          salary_max: job.salaryPeriod === 'hourly' ? null : job.maxSalary || null,
          salary_currency: job.currency || null,
          posted_at: toIso(job.pubDate),
          employer: job.companyName || null,
        }),
      );
    }
    cursor = data.nextCursor || null;
    if (!cursor) break;
  }
  return jobs;
}

// ---------- Jobicy (remote, worldwide) ----------
async function scrapeJobicy(): Promise<ScrapedJob[]> {
  const jobs = new Map<string, ScrapedJob>();
  for (const industry of splitEnvList(process.env.RADAR_JOBICY_INDUSTRIES || 'engineering,data-science')) {
    const data = await fetchJson<any>(
      'https://jobicy.com/api/v2/remote-jobs?count=100&industry=' + encodeURIComponent(industry),
    );
    for (const job of data.jobs || []) {
      if (!job.id || !job.url) continue;
      const geo = String(job.jobGeo || '')
        .replace(/\s+/g, ' ')
        .trim();
      jobs.set(
        String(job.id),
        finalizeJob({
          external_id: String(job.id),
          title: decodeEntities(job.jobTitle || ''),
          description: htmlToText(job.jobDescription || job.jobExcerpt) + '\n\nSource: Jobicy',
          location: 'Remote' + (geo && geo !== 'Anywhere' ? ' (' + geo + ')' : ''),
          apply_url: job.url,
          department: job.jobIndustry?.[0] || null,
          work_type: 'remote',
          salary_min: Number(job.annualSalaryMin) || null,
          salary_max: Number(job.annualSalaryMax) || null,
          salary_currency: job.salaryCurrency || null,
          posted_at: toIso(job.pubDate),
          employer: job.companyName || null,
        }),
      );
    }
  }
  return [...jobs.values()];
}

// ---------- The Muse (software engineering, by location) ----------
// Location names contain commas, so RADAR_MUSE_LOCATIONS is pipe-separated.
async function scrapeTheMuse(): Promise<ScrapedJob[]> {
  const locations = splitEnvList(
    process.env.RADAR_MUSE_LOCATIONS ||
      'Flexible / Remote|Bengaluru, India|London, United Kingdom|Berlin, Germany|Amsterdam, Netherlands',
    '|',
  );
  const pages = Math.max(1, Number(process.env.RADAR_MUSE_PAGES) || 3);
  const jobs = new Map<string, ScrapedJob>();
  for (const location of locations) {
    for (let page = 1; page <= pages; page++) {
      const data = await fetchJson<any>(
        'https://www.themuse.com/api/public/jobs?category=Software%20Engineering&page=' +
          page +
          '&location=' +
          encodeURIComponent(location),
      );
      for (const job of data.results || []) {
        if (!job.id || !job.refs?.landing_page) continue;
        const places: string[] = (job.locations || []).map((l: any) => l.name).filter(Boolean);
        jobs.set(
          String(job.id),
          finalizeJob({
            external_id: String(job.id),
            title: decodeEntities(job.name || ''),
            description: htmlToText(job.contents) + '\n\nSource: The Muse',
            location: places.join(' / ') || location,
            apply_url: job.refs.landing_page,
            department: job.categories?.[0]?.name || null,
            salary_min: null,
            salary_max: null,
            salary_currency: null,
            posted_at: toIso(job.publication_date),
            employer: job.company?.name || null,
          }),
        );
      }
      if (page >= (data.page_count || 0)) break;
    }
  }
  return [...jobs.values()];
}

// ---------- Adzuna (official API, many countries) ----------
const ADZUNA_CURRENCY: Record<string, string> = {
  in: 'INR',
  gb: 'GBP',
  us: 'USD',
  sg: 'SGD',
  de: 'EUR',
  nl: 'EUR',
  fr: 'EUR',
};

/**
 * Adzuna's geographical database uses legacy or specific spellings for some Indian cities.
 * For example, "Gurugram" returns 0 jobs while "Gurgaon" returns 2,600+ jobs.
 */
export function adzunaSearchCity(city: string): string {
  const c = city.trim().toLowerCase();
  if (c === 'gurugram' || c === 'gurgaon') return 'Gurgaon';
  if (c === 'bengaluru' || c === 'banglore' || c === 'bangalore') return 'Bangalore';
  if (c === 'sas nagar') return 'Mohali';
  return city.trim();
}

/** Targeted tech skills for Indian city queries so results score high against modern developer resumes. */
export function citySearchTerms(): string[] {
  return splitEnvList(process.env.RADAR_CITY_SEARCH_TERMS || 'python,react,node,full stack,developer');
}

/**
 * The Indian cities in your preferences (Mohali, Chandigarh, Gurgaon, Bangalore…), for localized searches.
 * Tricity neighbors (Chandigarh/Mohali) are included so local engineering clusters are not missed.
 */
export async function preferenceCities(): Promise<string[]> {
  const { data } = await createServerClient().from('user_profiles').select('location').not('location', 'is', null);
  // Search terms are cities in India: skip places abroad and words that are not a city ("Worldwide", "test").
  const notHere = new Set(
    ['san francisco', 'new york', 'london', 'toronto', 'singapore', 'dubai'].flatMap((c) => cityAliases(c)),
  );
  const seen = new Map<string, string>();
  for (const rawCity of (data || []).flatMap((p) => splitList(p.location as string))) {
    if (/^(remote|worldwide|anywhere|global|india|test)$/i.test(rawCity) || notHere.has(rawCity.toLowerCase()))
      continue;
    const mapped = adzunaSearchCity(rawCity);
    seen.set(mapped.toLowerCase(), mapped);
    // If Mohali or Chandigarh is present, ensure both are searched in the Tricity job market
    if (/^(mohali|chandigarh|sas nagar)$/i.test(rawCity)) {
      seen.set('mohali', 'Mohali');
      seen.set('chandigarh', 'Chandigarh');
    }
  }
  return [...seen.values()].slice(0, 12);
}

const ADZUNA_GAP_MS = 2_500;

async function scrapeAdzuna(): Promise<ScrapedJob[]> {
  const id = process.env.ADZUNA_APP_ID?.trim();
  const key = process.env.ADZUNA_APP_KEY?.trim();
  if (!id || !key) {
    console.warn('[SCRAPE] Adzuna skipped: set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable it.');
    return [];
  }
  const jobs = new Map<string, ScrapedJob>();
  // Adzuna allows 25 calls a minute (and 250 a day): one search every 2.5 s keeps a run under it.
  let lastCall = 0;
  const pace = async () => {
    const wait = lastCall + ADZUNA_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();
  };
  // Country-wide searches, then India city by city for your cities.
  const searches: [string, string][] = splitEnvList(process.env.RADAR_ADZUNA_COUNTRIES || 'in,gb,de,nl,fr,sg,us').map(
    (c) => [c, ''],
  );
  for (const city of await preferenceCities().catch(() => [])) searches.push(['in', city]);
  for (const [country, where] of searches) {
    // For specific Indian cities, query skill pillars (python, react, node, etc.) so returned jobs match user profile
    const terms = where ? citySearchTerms() : searchTerms();
    for (const term of terms) {
      const cityQuery = where ? adzunaSearchCity(where) : undefined;
      const params = new URLSearchParams({
        app_id: id,
        app_key: key,
        what: term,
        ...(cityQuery ? { where: cityQuery } : {}),
        results_per_page: '50',
        max_days_old: '30',
        'content-type': 'application/json',
      });
      await pace();
      const data = await fetchJson<any>(
        'https://api.adzuna.com/v1/api/jobs/' + encodeURIComponent(country) + '/search/1?' + params,
      ).catch((e) => {
        console.warn('[SCRAPE] Adzuna search failed for', country, where || 'all', term, ':', e.message);
        return { results: [] };
      });
      for (const job of data.results || []) {
        if (!job.id || !job.redirect_url) continue;
        // A predicted salary is Adzuna's estimate, not the employer's figure.
        const stated = String(job.salary_is_predicted) !== '1' && Number(job.salary_min) > 0;
        jobs.set(
          country + ':' + job.id,
          finalizeJob({
            external_id: country + ':' + job.id,
            title: htmlToText(job.title),
            description: htmlToText(job.description) + '\n\nSource: Adzuna',
            location: job.location?.display_name || where || country.toUpperCase(),
            apply_url: job.redirect_url,
            department: job.category?.label || null,
            salary_min: stated ? Math.round(job.salary_min) : null,
            salary_max: stated && job.salary_max ? Math.round(job.salary_max) : null,
            salary_currency: stated ? ADZUNA_CURRENCY[country] || null : null,
            posted_at: toIso(job.created),
            employer: job.company?.display_name || null,
          }),
        );
      }
    }
  }
  return [...jobs.values()];
}

// ---------- Jooble (official API, many countries) ----------
async function scrapeJooble(): Promise<ScrapedJob[]> {
  const key = process.env.JOOBLE_API_KEY?.trim();
  if (!key) {
    console.warn('[SCRAPE] Jooble skipped: set JOOBLE_API_KEY to enable it.');
    return [];
  }
  const envLocs = process.env.RADAR_JOOBLE_LOCATIONS;
  const pref = await preferenceCities().catch(() => []);
  const locations = envLocs
    ? splitEnvList(envLocs, '|')
    : pref.length
      ? ['India', ...pref.slice(0, 4).map((c) => c + ', India')]
      : splitEnvList('India|United Kingdom|Germany|Netherlands|Remote', '|');
  const jobs = new Map<string, ScrapedJob>();
  for (const location of locations) {
    for (const term of searchTerms()) {
      const data = await fetchJson<any>('https://jooble.org/api/' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: term, location, page: '1' }),
      }).catch((e) => {
        console.warn('[SCRAPE] Jooble search failed for', location, term, ':', e.message);
        return { jobs: [] };
      });
      for (const job of data.jobs || []) {
        if (!job.id || !job.link) continue;
        const pay = parseSalaryRange(job.salary);
        jobs.set(
          String(job.id),
          finalizeJob({
            external_id: String(job.id),
            title: htmlToText(job.title),
            description: htmlToText(job.snippet) + '\n\nSource: Jooble',
            location: job.location || location,
            apply_url: job.link,
            department: null,
            salary_min: pay.min,
            salary_max: pay.max,
            salary_currency: pay.currency,
            posted_at: toIso(job.updated),
            employer: job.company || null,
          }),
        );
      }
    }
  }
  return [...jobs.values()];
}

// ---------- Hasjob (HasGeek official Atom feed, pure Indian tech jobs) ----------
export function parseHasjobEntry(block: string) {
  const tag = (name: string) => {
    const m = block.match(new RegExp('<' + name + '(?:\\s+[^>]*)?>([\\s\\S]*?)</' + name + '>'));
    return m ? decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim() : '';
  };
  const title = tag('title');
  const linkMatch = block.match(/<link[^>]+href="([^"]+)"/);
  const link = linkMatch ? linkMatch[1] : tag('id');
  const location = tag('location') || 'India';
  const content = tag('content');
  const empMatch =
    content.match(/<strong[^>]*><a[^>]*>([^<]+)<\/a><\/strong>/i) || content.match(/<strong[^>]*>([^<]+)<\/strong>/i);
  const employer = empMatch ? decodeEntities(empMatch[1]).trim() : 'Startup';
  const published = tag('published') || tag('updated');

  return {
    external_id: tag('id') || link,
    title,
    employer,
    location,
    description: htmlToText(content) + '\n\nSource: Hasjob',
    link,
    posted_at: toIso(published),
  };
}

async function scrapeHasjob(): Promise<ScrapedJob[]> {
  const xml = await fetchText('https://hasjob.co/feed').catch((e) => {
    console.warn('[SCRAPE] Hasjob feed fetch failed:', e.message);
    return '';
  });
  if (!xml) return [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const jobs: ScrapedJob[] = [];
  for (const block of entries) {
    const item = parseHasjobEntry(block);
    if (!item.link || !isRelevantTitle(item.title)) continue;
    jobs.push(
      finalizeJob({
        external_id: item.external_id,
        title: item.title,
        description: item.description,
        location: item.location,
        apply_url: item.link,
        department: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        posted_at: item.posted_at,
        employer: item.employer,
      }),
    );
  }
  return jobs;
}

// ---------- JSearch (RapidAPI: aggregated Indeed, Glassdoor & LinkedIn) ----------
async function scrapeJSearch(): Promise<ScrapedJob[]> {
  const key = process.env.RAPIDAPI_KEY?.trim() || process.env.JSEARCH_API_KEY?.trim();
  if (!key) {
    console.info('[SCRAPE] JSearch skipped: set RAPIDAPI_KEY or JSEARCH_API_KEY to enable it.');
    return [];
  }
  const cities = await preferenceCities().catch(() => []);
  const targetCities = cities.length ? cities.slice(0, 4) : ['Mohali', 'Chandigarh', 'Gurgaon', 'Bangalore'];
  const terms = citySearchTerms().slice(0, 2);
  const jobs = new Map<string, ScrapedJob>();

  for (const city of targetCities) {
    for (const term of terms) {
      const query = `${term} in ${city}, India`;
      const data = await fetchJson<any>(
        'https://jsearch.p.rapidapi.com/search?' +
          new URLSearchParams({
            query,
            page: '1',
            num_pages: '1',
            date_posted: 'month',
          }),
        {
          headers: {
            'x-rapidapi-key': key,
            'x-rapidapi-host': 'jsearch.p.rapidapi.com',
          },
          timeoutMs: 15_000,
        },
      ).catch((e) => {
        console.warn('[SCRAPE] JSearch search failed for', query, ':', e.message);
        return { data: [] };
      });

      for (const item of data.data || []) {
        if (!item.job_id || !item.job_title || !isRelevantTitle(item.job_title)) continue;
        const loc = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || city;
        const externalId = `jsearch:${item.job_id}`;
        jobs.set(
          externalId,
          finalizeJob({
            external_id: externalId,
            title: htmlToText(item.job_title),
            description:
              htmlToText(item.job_description || '') + `\n\nSource: JSearch (${item.job_publisher || 'Indeed/Web'})`,
            location: loc,
            apply_url: item.job_apply_link || '',
            department: null,
            salary_min: item.job_min_salary ? Math.round(Number(item.job_min_salary)) : null,
            salary_max: item.job_max_salary ? Math.round(Number(item.job_max_salary)) : null,
            salary_currency: item.job_salary_currency || (item.job_min_salary ? 'INR' : null),
            posted_at: item.job_posted_at_timestamp ? toIso(item.job_posted_at_timestamp) : new Date().toISOString(),
            employer: item.employer_name || null,
          }),
        );
      }
    }
  }

  return [...jobs.values()];
}

// ---------- Google Jobs (via Serper.dev: indexes Indeed India postings) ----------
async function scrapeGoogleJobs(): Promise<ScrapedJob[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) {
    console.info('[SCRAPE] Google Jobs skipped: set SERPER_API_KEY to enable it.');
    return [];
  }
  const cities = await preferenceCities().catch(() => []);
  const targetCities = cities.length ? cities.slice(0, 4) : ['Mohali', 'Chandigarh', 'Gurgaon', 'Bangalore'];
  const terms = citySearchTerms().slice(0, 2);
  const jobs = new Map<string, ScrapedJob>();

  for (const city of targetCities) {
    for (const term of terms) {
      const q = `${term} developer jobs in ${city}`;
      const data = await fetchJson<any>('https://google.serper.dev/jobs', {
        method: 'POST',
        headers: {
          'X-API-KEY': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q,
          gl: 'in',
          hl: 'en',
          location: `${city}, India`,
        }),
        timeoutMs: 15_000,
      }).catch((e) => {
        console.warn('[SCRAPE] Google Jobs search failed for', q, ':', e.message);
        return { jobs: [] };
      });

      for (const item of data.jobs || []) {
        const link = item.link || item.jobProviders?.[0]?.link;
        if (!item.title || !link || !isRelevantTitle(item.title)) continue;
        const externalId = `googlejobs:${createHash('sha1').update(`${item.companyName}:${item.title}:${link}`).digest('hex').slice(0, 16)}`;
        const pay = parseSalaryRange(item.description);

        jobs.set(
          externalId,
          finalizeJob({
            external_id: externalId,
            title: htmlToText(item.title),
            description:
              htmlToText(item.description || '') + `\n\nSource: Google Jobs (${item.via || 'Indeed/Direct'})`,
            location: item.location || city,
            apply_url: link,
            department: null,
            salary_min: pay.min,
            salary_max: pay.max,
            salary_currency: pay.currency,
            posted_at: new Date().toISOString(),
            employer: item.companyName || null,
          }),
        );
      }
    }
  }

  return [...jobs.values()];
}
