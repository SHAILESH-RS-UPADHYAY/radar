/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================
// RADAR — Company ATS adapters
// ============================
// One adapter per applicant-tracking system. All of them use the public, unauthenticated
// job-board endpoints the ATS itself serves to the company's careers page.
//
// ats_identifier formats:
//   greenhouse       board token          e.g. "stripe"
//   lever            site slug            e.g. "meesho"   (prefix "eu:" for api.eu.lever.co)
//   ashby            board name           e.g. "linear"
//   workable         account slug         e.g. "blueground"
//   smartrecruiters  company identifier   e.g. "ServiceNow"
//   recruitee        subdomain            e.g. "bunq"
//   personio         subdomain            e.g. "personio"
//   breezy           subdomain            e.g. "acme"
//   teamtailor       career-site host     e.g. "careers.neat.no" or "chip.teamtailor.com"
//   workday          tenant/wdN/site      e.g. "nvidia/wd5/NVIDIAExternalCareerSite"
//   amazon           ISO-3 country code   e.g. "IND"

import {
  fetchJson,
  fetchText,
  finalizeJob,
  htmlToText,
  inferWorkType,
  isRelevantTitle,
  mapLimit,
  parseSalaryNumber,
  parseSalaryRange,
  searchTerms,
  toIso,
  decodeEntities,
  type ScrapedJob,
} from './utils';
import { scrapeBoard, BOARD_PROVIDERS } from './boards';

export type { ScrapedJob } from './utils';

// Big employers list thousands of roles; cap how many we pull (and fetch details for) per company.
const MAX_PER_COMPANY = Number(process.env.RADAR_MAX_JOBS_PER_COMPANY || 150);

// ---------- Greenhouse ----------
export async function scrapeGreenhouse(token: string): Promise<ScrapedJob[]> {
  const data = await fetchJson<any>('https://boards-api.greenhouse.io/v1/boards/' + token + '/jobs?content=true');
  return (data.jobs || []).map((job: any) => {
    const description = htmlToText(job.content);
    const pay = job.pay_input_ranges?.[0];
    return finalizeJob({
      external_id: String(job.id),
      title: job.title || '',
      description,
      location: job.location?.name || '',
      apply_url: job.absolute_url || '',
      department: job.departments?.[0]?.name || null,
      salary_min: pay ? Math.round(pay.min_cents / 100) : null,
      salary_max: pay ? Math.round(pay.max_cents / 100) : null,
      salary_currency: pay?.currency_type || null,
      posted_at: toIso(job.first_published || job.updated_at),
      employer: null,
    });
  });
}

// ---------- Lever ----------
export async function scrapeLever(slug: string): Promise<ScrapedJob[]> {
  const eu = slug.startsWith('eu:');
  const site = eu ? slug.slice(3) : slug;
  const host = eu ? 'https://api.eu.lever.co' : 'https://api.lever.co';
  const data = await fetchJson<any[]>(host + '/v0/postings/' + site + '?mode=json');
  return (data || []).map((job: any) => {
    const lists = (job.lists || []).map((l: any) => l.text + '\n' + htmlToText(l.content)).join('\n\n');
    // The HTML versions keep paragraphs and bullets; the plain ones are the fallback.
    const description = [
      htmlToText(job.description) || job.descriptionPlain,
      lists,
      htmlToText(job.additional) || job.additionalPlain || '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const location = job.categories?.allLocations?.join(' / ') || job.categories?.location || '';
    return finalizeJob({
      external_id: job.id,
      title: job.text || '',
      description,
      location,
      apply_url: job.hostedUrl || job.applyUrl || '',
      department: job.categories?.team || job.categories?.department || null,
      work_type:
        job.workplaceType === 'remote'
          ? 'remote'
          : job.workplaceType === 'hybrid'
            ? 'hybrid'
            : job.workplaceType === 'onsite'
              ? 'in-office'
              : inferWorkType(location),
      salary_min: parseSalaryNumber(job.salaryRange?.min),
      salary_max: parseSalaryNumber(job.salaryRange?.max),
      salary_currency: job.salaryRange?.currency || null,
      posted_at: toIso(job.createdAt),
      employer: null,
    });
  });
}

// ---------- Ashby ----------
export async function scrapeAshby(board: string): Promise<ScrapedJob[]> {
  const data = await fetchJson<any>(
    'https://api.ashbyhq.com/posting-api/job-board/' + board + '?includeCompensation=true',
  );
  return (data.jobs || [])
    .filter((job: any) => job.isListed !== false)
    .map((job: any) => {
      const pay = parseSalaryRange(
        job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary,
      );
      const location = [job.location, ...(job.secondaryLocations || []).map((l: any) => l.location)]
        .filter(Boolean)
        .join(' / ');
      return finalizeJob({
        external_id: job.id,
        title: job.title || '',
        description: htmlToText(job.descriptionHtml) || job.descriptionPlain || '',
        location,
        apply_url: job.jobUrl || job.applyUrl || '',
        department: job.department || job.team || null,
        work_type:
          job.workplaceType === 'Remote' || job.isRemote
            ? 'remote'
            : job.workplaceType === 'Hybrid'
              ? 'hybrid'
              : job.workplaceType === 'OnSite'
                ? 'in-office'
                : null,
        salary_min: pay.min,
        salary_max: pay.max,
        salary_currency: pay.currency,
        posted_at: toIso(job.publishedAt),
        employer: null,
      });
    });
}

// ---------- Workable ----------
export async function scrapeWorkable(account: string): Promise<ScrapedJob[]> {
  const data = await fetchJson<any>('https://apply.workable.com/api/v1/widget/accounts/' + account + '?details=true');
  return (data.jobs || []).map((job: any) => {
    const location = [job.city, job.state, job.country].filter(Boolean).join(', ');
    return finalizeJob({
      external_id: job.shortcode || job.code,
      title: job.title || '',
      description: htmlToText(job.description),
      location: job.telecommuting ? (location ? location + ' (Remote)' : 'Remote') : location,
      apply_url: job.url || job.application_url || '',
      department: job.department || job.function || null,
      work_type: job.telecommuting ? 'remote' : null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(job.published_on || job.created_at),
      employer: null,
    });
  });
}

// ---------- SmartRecruiters ----------
// The list endpoint has no description, so we fetch details for relevant postings only.
export async function scrapeSmartRecruiters(company: string): Promise<ScrapedJob[]> {
  const base = 'https://api.smartrecruiters.com/v1/companies/' + company + '/postings';
  const listings: any[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await fetchJson<any>(base + '?limit=100&offset=' + offset);
    listings.push(...(page.content || []));
    if (listings.length >= (page.totalFound || 0) || !page.content?.length) break;
  }
  const relevant = listings.filter((p) => isRelevantTitle(p.name || '')).slice(0, MAX_PER_COMPANY);

  const jobs = await mapLimit(relevant, 6, async (p) => {
    let description = '';
    let url = 'https://jobs.smartrecruiters.com/' + company + '/' + p.id;
    try {
      const detail = await fetchJson<any>(base + '/' + p.id, { retries: 1 });
      const s = detail.jobAd?.sections || {};
      description = [s.jobDescription?.text, s.qualifications?.text, s.additionalInformation?.text]
        .map(htmlToText)
        .filter(Boolean)
        .join('\n\n');
      url = detail.postingUrl || url;
    } catch {
      // keep the listing even when its detail page fails
    }
    const loc = p.location || {};
    return finalizeJob({
      external_id: String(p.id),
      title: (p.name || '').trim(),
      description,
      location: loc.fullLocation || [loc.city, loc.region, loc.country?.toUpperCase()].filter(Boolean).join(', '),
      apply_url: url,
      department: p.department?.label || p.function?.label || null,
      work_type: loc.remote ? 'remote' : loc.hybrid ? 'hybrid' : null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(p.releasedDate),
      employer: null,
    });
  });
  return jobs;
}

// ---------- Recruitee ----------
export async function scrapeRecruitee(subdomain: string): Promise<ScrapedJob[]> {
  const data = await fetchJson<any>('https://' + subdomain + '.recruitee.com/api/offers/');
  return (data.offers || []).map((job: any) =>
    finalizeJob({
      external_id: String(job.id),
      title: job.title || '',
      description: [htmlToText(job.description), htmlToText(job.requirements)].filter(Boolean).join('\n\n'),
      location: job.location || [job.city, job.country].filter(Boolean).join(', '),
      apply_url: job.careers_url || job.careers_apply_url || '',
      department: job.department || null,
      work_type: job.remote ? 'remote' : job.hybrid ? 'hybrid' : job.on_site ? 'in-office' : null,
      salary_min: parseSalaryNumber(job.salary?.min),
      salary_max: parseSalaryNumber(job.salary?.max),
      salary_currency: job.salary?.currency || null,
      posted_at: toIso(job.published_at || job.created_at),
      employer: null,
    }),
  );
}

// ---------- Personio (XML feed) ----------
export async function scrapePersonio(subdomain: string): Promise<ScrapedJob[]> {
  const xml = await fetchText('https://' + subdomain + '.jobs.personio.de/xml?language=en');
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
    return m ? decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim() : '';
  };
  const positions = xml.match(/<position>[\s\S]*?<\/position>/g) || [];
  return positions.map((block) => {
    const id = tag(block, 'id');
    const sections = (block.match(/<jobDescription>[\s\S]*?<\/jobDescription>/g) || [])
      .map((d) => tag(d, 'name') + '\n' + htmlToText(tag(d, 'value')))
      .join('\n\n');
    const years = tag(block, 'yearsOfExperience');
    return finalizeJob({
      external_id: id,
      title: tag(block, 'name'),
      description: sections + (years ? '\n\nExperience: ' + years + ' years' : ''),
      location: tag(block, 'office'),
      apply_url: 'https://' + subdomain + '.jobs.personio.de/job/' + id,
      department: tag(block, 'department') || null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(tag(block, 'createdAt')),
      employer: null,
    });
  });
}

// ---------- Breezy HR ----------
export async function scrapeBreezy(subdomain: string): Promise<ScrapedJob[]> {
  const data = await fetchJson<any[]>('https://' + subdomain + '.breezy.hr/json');
  return (data || []).map((job: any) => {
    const pay = parseSalaryRange(job.salary);
    return finalizeJob({
      external_id: job.id,
      title: job.name || '',
      // The public feed has no description; the title + department still embed usefully.
      description: [job.name, job.department, job.type?.name].filter(Boolean).join(' · '),
      location: job.location?.name || '',
      apply_url: job.url || '',
      department: job.department || null,
      work_type: job.location?.is_remote ? 'remote' : null,
      salary_min: pay.min,
      salary_max: pay.max,
      salary_currency: pay.currency,
      posted_at: toIso(job.published_date),
      employer: null,
    });
  });
}

// ---------- Teamtailor ----------
// Every Teamtailor career site (custom domain or *.teamtailor.com) serves a public JSON Feed at /jobs.json,
// with a schema.org JobPosting per item.
export async function scrapeTeamtailor(host: string): Promise<ScrapedJob[]> {
  const feed = await fetchJson<any>('https://' + host + '/jobs.json');
  return (feed.items || []).map((item: any) => {
    const posting = item._jobposting || {};
    const places = (posting.jobLocation || [])
      .map((p: any) => String(p.address?.addressLocality || '').trim())
      .filter(Boolean);
    return finalizeJob({
      external_id: String(posting.identifier?.value ?? item.id ?? ''),
      title: item.title || '',
      description: htmlToText(item.content_html),
      location: [...new Set(places)].join(' / '),
      apply_url: item.url || '',
      department: null,
      work_type: posting.jobLocationType === 'TELECOMMUTE' ? 'remote' : null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(item.date_published || posting.datePosted),
      employer: null,
    });
  });
}

// ---------- Workday ----------
// Uses the JSON endpoints behind every *.myworkdayjobs.com careers site. Large tenants have
// thousands of roles, so we search with RADAR_SEARCH_TERMS and cap the result.
export async function scrapeWorkday(identifier: string): Promise<ScrapedJob[]> {
  const [tenant, wd, site] = identifier.split('/');
  if (!tenant || !wd || !site) throw new Error('Workday identifier must be tenant/wdN/site, got "' + identifier + '"');
  const host = 'https://' + tenant + '.' + wd + '.myworkdayjobs.com';
  const api = host + '/wday/cxs/' + tenant + '/' + site;

  const postings = new Map<string, any>();
  for (const term of searchTerms()) {
    for (let offset = 0; offset < 200 && postings.size < MAX_PER_COMPANY; offset += 20) {
      const page = await fetchJson<any>(api + '/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: term }),
      });
      const batch = page.jobPostings || [];
      for (const p of batch) if (p.externalPath && isRelevantTitle(p.title || '')) postings.set(p.externalPath, p);
      if (batch.length < 20) break;
    }
  }

  const list = [...postings.values()].slice(0, MAX_PER_COMPANY);
  return mapLimit(list, 5, async (p) => {
    let info: any = {};
    try {
      info = (await fetchJson<any>(api + p.externalPath, { retries: 1 })).jobPostingInfo || {};
    } catch {
      // fall back to the listing fields
    }
    const location =
      [info.location, ...(info.additionalLocations || [])].filter(Boolean).join(' / ') || p.locationsText || '';
    return finalizeJob({
      external_id: info.jobReqId || p.bulletFields?.[0] || p.externalPath,
      title: info.title || p.title || '',
      description: htmlToText(info.jobDescription),
      location,
      apply_url: info.externalUrl || host + '/' + site + p.externalPath,
      department: null,
      work_type: inferWorkType(location + ' ' + (info.remoteType || '')),
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(info.startDate),
      employer: null,
    });
  });
}

// ---------- Amazon (amazon.jobs search API) ----------
export async function scrapeAmazon(countryCode: string): Promise<ScrapedJob[]> {
  const seen = new Map<string, any>();
  for (const term of searchTerms()) {
    for (let offset = 0; offset < 200 && seen.size < MAX_PER_COMPANY; offset += 100) {
      const url =
        'https://www.amazon.jobs/en/search.json?result_limit=100&sort=recent&offset=' +
        offset +
        '&base_query=' +
        encodeURIComponent(term) +
        '&normalized_country_code%5B%5D=' +
        encodeURIComponent(countryCode || 'IND');
      const data = await fetchJson<any>(url);
      const batch = data.jobs || [];
      for (const j of batch) if (isRelevantTitle(j.title || '')) seen.set(j.id_icims || j.id, j);
      if (batch.length < 100) break;
    }
  }
  return [...seen.values()].slice(0, MAX_PER_COMPANY).map((job: any) =>
    finalizeJob({
      external_id: String(job.id_icims || job.id),
      title: job.title || '',
      description: [
        htmlToText(job.description),
        'Basic qualifications:\n' + htmlToText(job.basic_qualifications),
        'Preferred qualifications:\n' + htmlToText(job.preferred_qualifications),
      ].join('\n\n'),
      location: job.normalized_location || job.location || '',
      apply_url: 'https://www.amazon.jobs' + (job.job_path || ''),
      department: job.job_category || null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: toIso(job.posted_date),
      employer: null,
    }),
  );
}

// ---------- Dispatcher ----------
export const ATS_PROVIDERS = [
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'smartrecruiters',
  'recruitee',
  'personio',
  'breezy',
  'teamtailor',
  'workday',
  'amazon',
] as const;

export async function scrapeCompany(provider: string | null, identifier: string | null): Promise<ScrapedJob[]> {
  if (!provider) return [];
  let jobs: ScrapedJob[];
  switch (provider) {
    case 'greenhouse':
      jobs = await scrapeGreenhouse(identifier!);
      break;
    case 'lever':
      jobs = await scrapeLever(identifier!);
      break;
    case 'ashby':
      jobs = await scrapeAshby(identifier!);
      break;
    case 'workable':
      jobs = await scrapeWorkable(identifier!);
      break;
    case 'smartrecruiters':
      jobs = await scrapeSmartRecruiters(identifier!);
      break;
    case 'recruitee':
      jobs = await scrapeRecruitee(identifier!);
      break;
    case 'personio':
      jobs = await scrapePersonio(identifier!);
      break;
    case 'breezy':
      jobs = await scrapeBreezy(identifier!);
      break;
    case 'teamtailor':
      jobs = await scrapeTeamtailor(identifier!);
      break;
    case 'workday':
      jobs = await scrapeWorkday(identifier!);
      break;
    case 'amazon':
      jobs = await scrapeAmazon(identifier || 'IND');
      break;
    default:
      if ((BOARD_PROVIDERS as readonly string[]).includes(provider)) {
        jobs = await scrapeBoard(provider);
        break;
      }
      throw new Error('No adapter for provider: ' + provider);
  }
  return jobs.filter((j) => j.external_id && j.title && j.apply_url && isRelevantTitle(j.title));
}
