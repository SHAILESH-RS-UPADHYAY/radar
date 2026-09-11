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

import {
  decodeEntities,
  fetchJson,
  finalizeJob,
  htmlToText,
  isRelevantTitle,
  parseSalaryRange,
  toIso,
  type ScrapedJob,
} from './utils';

export const BOARD_PROVIDERS = ['hackernews', 'remotive', 'remoteok', 'arbeitnow', 'himalayas'] as const;

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
    default:
      throw new Error('Unknown board: ' + provider);
  }
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
