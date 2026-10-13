// ============================
// RADAR — Job-alert emails: Indeed, LinkedIn, Welcome to the Jungle
// ============================
// The alerts you set up on those sites arrive in your inbox; every cycle RADAR reads the last three days of them
// through the read-only Gmail link and turns each job card into a job. LinkedIn and Indeed forbid automated access
// to their sites, so these emails are the only way their jobs reach RADAR, and nothing is fetched from them.
//
// A job is recognised by the stable id in its link (LinkedIn /jobs/view/<id>, Indeed jk=…, Welcome to the Jungle
// /companies/<company>/jobs/<slug>), however the email is laid out; the card text next to the link gives the title,
// company and location. Tracking links that wrap the real one (a redirect parameter, a base64 or gzip token) are
// unwrapped locally, never opened.

import { gunzipSync } from 'node:zlib';
import { accessTokenFor, getMessage, gmailConfig, messageBodies, messageDate, searchMessages } from '@/lib/gmail';
import { createServerClient } from '@/lib/supabase/client';
import { isKnownCity } from '@/lib/geo/city-companies';
import { decodeEntities, finalizeJob, isRelevantTitle, mapLimit, parseSalaryRange, type ScrapedJob } from './utils';

export type AlertProvider = 'indeed_email' | 'linkedin_email' | 'wttj_email';
export const ALERT_PROVIDERS: AlertProvider[] = ['indeed_email', 'linkedin_email', 'wttj_email'];

interface JobLink {
  /** Stable across emails: the same job in tomorrow's alert is the same row. */
  id: string;
  /** The public job page, tracking stripped. */
  url: string;
  /** The employer, when the link itself names it (Welcome to the Jungle). */
  company?: string;
}

interface AlertSource {
  name: string;
  /** Gmail search for this source's alert emails (application confirmations excluded). */
  query: string;
  job(url: URL): JobLink | null;
  /** A source whose whole card is one link reads it from the link's own lines. */
  readCard?(lines: string[]): { title: string; company: string; location: string } | null;
  /** Click-tracking hosts whose links are opaque: RADAR reads where they redirect (never the page itself). */
  tracker?: RegExp;
}

const titleCase = (slug: string) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const ALERT_SOURCES: Record<AlertProvider, AlertSource> = {
  indeed_email: {
    name: 'Indeed',
    query: 'from:(indeed.com OR indeedemail.com) -subject:(application OR applied OR interview OR message)',
    job(url) {
      if (!/(^|\.)indeed\.[a-z.]+$/.test(url.hostname)) return null;
      const jk = (url.searchParams.get('jk') || url.searchParams.get('vjk') || url.searchParams.get('jobkey') || '')
        .toLowerCase()
        .trim();
      if (!/^[a-f0-9]{16}$/.test(jk)) return null;
      // A country site keeps its host; indeed.com itself becomes the Indian site, where your alerts point.
      const host = /^[a-z]{2}\.indeed\.com$/.test(url.hostname) ? url.hostname : 'in.indeed.com';
      return { id: 'indeed:' + jk, url: `https://${host}/viewjob?jk=${jk}` };
    },
  },
  linkedin_email: {
    name: 'LinkedIn',
    query:
      'from:(jobalerts-noreply@linkedin.com OR jobs-listings@linkedin.com OR jobs-noreply@linkedin.com) -subject:(application OR applied OR viewed OR message)',
    job(url) {
      if (!/(^|\.)linkedin\.com$/.test(url.hostname)) return null;
      // /comm/jobs/view/4012345678/ in emails, /jobs/view/backend-engineer-at-acme-4012345678 on the site.
      const id = /\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/.exec(url.pathname)?.[1];
      return id ? { id: 'linkedin:' + id, url: `https://www.linkedin.com/jobs/view/${id}/` } : null;
    },
  },
  wttj_email: {
    name: 'Welcome to the Jungle',
    query: 'from:(welcometothejungle.com OR welcometothejungle.co OR wttj.co) -subject:(application OR candidature)',
    // Its alert links go through SendGrid to app.otta.com/jobs/<id>?token=… (the token logs you in: never kept).
    tracker: /(^|\.)ct\.sendgrid\.net$/,
    // "Semios / Data analytics platform for farmers / Software Developer / (Co-op) / Vancouver"
    readCard(lines) {
      const [company, , title, ...rest] = lines;
      if (!company || !title) return null;
      const qualifier = rest[0]?.startsWith('(') ? rest.shift()! : '';
      return { company, title: [title, qualifier].filter(Boolean).join(' '), location: rest[0] || '' };
    },
    job(url) {
      const otta = url.hostname === 'app.otta.com' && /^\/jobs\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
      if (otta) return { id: 'wttj:otta:' + otta, url: 'https://app.otta.com/jobs/' + otta };
      if (!/(^|\.)welcometothejungle\.com$/.test(url.hostname)) return null;
      const path = url.pathname.split('/').filter(Boolean);
      const i = path.indexOf('companies');
      const [company, jobs, slug] = i >= 0 ? path.slice(i + 1, i + 4) : [];
      if (!company || jobs !== 'jobs' || !slug) return null;
      return {
        id: `wttj:${company}/${slug}`,
        url: `https://www.welcometothejungle.com/en/companies/${company}/jobs/${slug}`,
        company: titleCase(company),
      };
    },
  },
};

// ---- Links (pure) ----

const REDIRECT_PARAMS = ['url', 'u', 'target', 'dest', 'destination', 'redirect', 'redirect_url', 'link', 'l', 'to'];
const URL_IN_TEXT = /https?:\/\/[^\s"'<>\\]+/g;

/** A token that packs a URL: base64 of "http…" (aHR0c…) or gzip (H4sI…), as click trackers and Indeed use. */
function unpack(token: string): string {
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (token.startsWith('H4sI')) return gunzipSync(bytes).toString('utf-8');
    if (token.startsWith('aHR0c')) return bytes.toString('utf-8');
  } catch {
    // not a packed token
  }
  return '';
}

/** Every URL a link stands for: itself, URLs in its redirect parameters, URLs packed in its tokens. Pure. */
export function unwrapLink(href: string, depth = 0): URL[] {
  let url: URL;
  try {
    url = new URL(decodeEntities(href).trim());
  } catch {
    return [];
  }
  const out = [url];
  if (depth >= 2) return out;
  for (const key of REDIRECT_PARAMS) {
    const value = url.searchParams.get(key);
    if (value && /^https?:\/\//i.test(value)) out.push(...unwrapLink(value, depth + 1));
  }
  for (const token of [...url.pathname.split('/'), ...url.searchParams.values()]) {
    if (token.length < 16) continue;
    const packed = unpack(token);
    for (const found of packed.match(URL_IN_TEXT) || []) out.push(...unwrapLink(found, depth + 1));
    // Indeed's tokens can carry the job key without a URL around it.
    const jk = /\bjk["'=:\s]+"?([a-f0-9]{16})\b/i.exec(packed)?.[1];
    if (jk) out.push(new URL('https://in.indeed.com/viewjob?jk=' + jk.toLowerCase()));
  }
  return out;
}

/** Where a tracked link redirects, read ahead by scrapeAlertEmails: tracked href → target URL. */
type Resolved = Map<string, string>;

const jobLinkOf = (href: string, source: AlertSource, resolved?: Resolved) =>
  [...unwrapLink(href), ...unwrapLink(resolved?.get(decodeEntities(href).trim()) ?? '')].reduce<JobLink | null>(
    (found, url) => found ?? source.job(url),
    null,
  );

// ---- Cards (pure) ----

interface Card {
  link: JobLink;
  title: string;
  company: string;
  location: string;
  snippet: string;
}

/** Card lines that are badges, buttons, counts or footer, never a company or a place. */
const NOISE =
  /^(actively (recruiting|hiring)|easy apply|promoted|be an early applicant|apply( now)?|view (job|details)|see (all|more)( jobs)?|save( job)?|new|urgently hiring|hiring|reposted|just posted|top applicant|verified|featured|sponsored|responses managed off linkedin|your profile matches.*|\d+\+?\s*(connections?|applicants?|alumni|school alumni|company alumni|people|new jobs?).*|.*\b(ago|today|yesterday)|unsubscribe.*|manage (job )?alerts?.*|job alert.*|help|privacy.*|©.*|[·•|–—-]+)$/i;

const PLACE =
  /,|\b(remote|hybrid|on-?site|anywhere|worldwide|india|united states|usa|uk|united kingdom|england|scotland|ireland|germany|france|spain|portugal|italy|netherlands|belgium|sweden|norway|denmark|finland|poland|switzerland|austria|canada|mexico|brazil|argentina|singapore|uae|dubai|australia|japan|europe|emea|apac|latam)\b/i;
const looksLikePlace = (s: string) => s.length <= 80 && (PLACE.test(s) || isKnownCity(s.replace(/\(.*\)/, '')));

/** "Cohere · Toronto, ON (Hybrid)" or "SmartData - Mohali, Punjab" → [company, place]; null when no place follows. */
function splitCompanyPlace(line: string): [string, string] | null {
  for (const sep of [' · ', ' • ', ' | ', ' - ', ' – ', ' — ']) {
    const at = line.indexOf(sep);
    if (at <= 0) continue;
    const place = line.slice(at + sep.length).trim();
    if (looksLikePlace(place)) return [line.slice(0, at).trim(), place];
  }
  return null;
}

const SALARY =
  /(?:₹|rs\.?|inr|\$|£|€)\s*[\d,.]+\s*[kml]?(?:\s*(?:-|–|to)\s*(?:₹|rs\.?|inr|\$|£|€)?\s*[\d,.]+\s*[kml]?)?/i;

const same = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Title, then company and place from the lines that follow it on the card. When the link names the company
 * (Welcome to the Jungle), the line after the title is the place even if RADAR does not know the city.
 */
function card(link: JobLink, title: string, lines: string[]): Card {
  const at = lines.findIndex((l) => l === title);
  const rest = (at >= 0 ? lines.slice(at + 1) : lines).filter((l) => l !== title && !NOISE.test(l));
  let company = '';
  let location = '';
  let used = 0;
  if (link.company) {
    company = link.company;
    if (rest[0] && same(rest[0], company)) used = 1;
    if (rest[used] && rest[used].length <= 60) [location, used] = [rest[used], used + 1];
  } else {
    const split = rest[0] ? splitCompanyPlace(rest[0]) : null;
    if (split) [company, location, used] = [...split, 1];
    else if (rest[0] && !looksLikePlace(rest[0])) [company, used] = [rest[0], 1];
    if (!location && rest[used] && looksLikePlace(rest[used])) [location, used] = [rest[used], used + 1];
  }
  return {
    link,
    title,
    company: company.slice(0, 120),
    location: location.slice(0, 120),
    snippet: rest
      .slice(used, used + 3)
      .join(' ')
      .slice(0, 600),
  };
}

const ANCHOR = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

/** An HTML fragment as its text nodes, one per line: card fields sit in their own cells, spans and paragraphs. */
const textLines = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '\n'),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const isLabel = (s: string) => s.length >= 3 && s.length <= 150 && !NOISE.test(s) && !/^https?:/i.test(s);

/**
 * Cards from the HTML part. A job's card runs from its first link to the next job's link, or to the email's own
 * links after it ("See all jobs", "Unsubscribe"), so the footer never reads as a company or a place.
 */
function htmlCards(html: string, source: AlertSource, resolved?: Resolved): Card[] {
  const anchors = [...html.matchAll(ANCHOR)].map((m) => ({
    at: m.index!,
    job: jobLinkOf(m[2], source, resolved),
    inner: m[3],
    text: textLines(m[3]).join(' '),
  }));
  if (source.readCard)
    return anchors.flatMap((a) => {
      const read = a.job && source.readCard!(textLines(a.inner));
      return read ? [{ link: a.job!, ...read, snippet: '' }] : [];
    });
  const ids = [...new Set(anchors.flatMap((a) => (a.job ? [a.job.id] : [])))];
  return ids.map((id) => {
    const own = anchors.filter((a) => a.job?.id === id);
    const last = own[own.length - 1].at;
    const stop = anchors.find((a) => a.at > own[0].at && (a.job ? a.job.id !== id : a.at > last && NOISE.test(a.text)));
    const lines = textLines(html.slice(own[0].at, stop?.at ?? last + 1500));
    const title = own.find((a) => isLabel(a.text))?.text || lines.find(isLabel) || '';
    return card(own[0].job!, title, lines);
  });
}

/** Cards from the plain-text part: the lines right above each job link (up to a blank line) are its card. */
function textCards(text: string, source: AlertSource): Card[] {
  const cards: Card[] = [];
  let block: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[-_=*]{5,}$/.test(line)) {
      block = [];
      continue;
    }
    const job = (line.match(URL_IN_TEXT) || []).map((u) => jobLinkOf(u, source)).find(Boolean);
    if (!job) {
      block.push(line);
      continue;
    }
    // "Backend Engineer: https://…" carries its own title.
    const label = line
      .replace(URL_IN_TEXT, '')
      .replace(/[:\-–|]\s*$/, '')
      .trim();
    const lines = [...block, ...(isLabel(label) && !/^(view|apply|see)\b/i.test(label) ? [label] : [])].filter(
      (l) => !NOISE.test(l),
    );
    if (lines.length) cards.push(card(job, lines[0], lines));
    block = [];
  }
  return cards;
}

const pick = (a: string, b: string) => a || b;

/** The jobs in one alert email. HTML and plain-text cards are merged by job id, each filling what the other lacks. */
export function parseAlertEmail(
  provider: AlertProvider,
  mail: { html: string; text: string; date: string | null },
  resolved?: Resolved,
): ScrapedJob[] {
  const source = ALERT_SOURCES[provider];
  const cards = new Map<string, Card>();
  for (const c of [...htmlCards(mail.html, source, resolved), ...textCards(mail.text, source)]) {
    const had = cards.get(c.link.id);
    cards.set(
      c.link.id,
      had
        ? {
            link: had.link,
            title: pick(had.title, c.title),
            company: pick(had.company, c.company),
            location: pick(had.location, c.location),
            snippet: pick(had.snippet, c.snippet),
          }
        : c,
    );
  }
  return [...cards.values()]
    .filter((c) => c.title && isRelevantTitle(c.title))
    .map((c) => {
      const pay = parseSalaryRange(SALARY.exec(c.snippet)?.[0]);
      return finalizeJob({
        external_id: c.link.id,
        title: c.title.slice(0, 300),
        description: [c.snippet, `From your ${source.name} job alert.`].filter(Boolean).join('\n\n'),
        location: c.location,
        apply_url: c.link.url,
        department: null,
        salary_min: pay.min,
        salary_max: pay.max,
        salary_currency: pay.currency,
        posted_at: mail.date,
        employer: c.company || null,
      });
    });
}

// ---- Gmail ----

const WINDOW = 'newer_than:3d';
const MAX_EMAILS = 25;
const MAX_TRACKED = 30;

/**
 * Where an email's opaque tracking links lead: one request each, redirects not followed, so the target page itself is
 * never opened. Links that do not answer with a redirect are left out.
 */
async function resolveTracked(html: string, tracker: RegExp): Promise<Resolved> {
  const hrefs = [
    ...new Set(
      [...html.matchAll(ANCHOR)]
        .map((m) => decodeEntities(m[2]).trim())
        .filter((h) => {
          try {
            return tracker.test(new URL(h).hostname);
          } catch {
            return false;
          }
        }),
    ),
  ].slice(0, MAX_TRACKED);
  const resolved: Resolved = new Map();
  await mapLimit(hrefs, 4, async (href) => {
    const res = await fetch(href, { redirect: 'manual', signal: AbortSignal.timeout(8_000) }).catch(() => null);
    const to = res?.headers.get('location');
    if (to) resolved.set(href, to);
  });
  return resolved;
}

export interface AlertReadState {
  emails: number;
  jobs: number;
  lastEmailAt: string | null;
  error: string | null;
}

/**
 * The jobs in every linked inbox's alert emails from one source, newest card first. What was read is kept in
 * source_state (`alerts:<provider>`), so Settings can show whether your alerts are arriving.
 */
export async function scrapeAlertEmails(provider: AlertProvider): Promise<ScrapedJob[]> {
  const cfg = gmailConfig();
  if (!cfg) return [];
  const supabase = createServerClient();
  const { data: links, error } = await supabase.from('gmail_links').select('user_id, refresh_token_enc');
  if (error) throw new Error('Reading Gmail links failed: ' + error.message);
  if (!links?.length) return [];

  const source = ALERT_SOURCES[provider];
  const jobs = new Map<string, ScrapedJob>();
  const state: AlertReadState = { emails: 0, jobs: 0, lastEmailAt: null, error: null };
  for (const link of links) {
    try {
      const token = await accessTokenFor(cfg, link.user_id, link.refresh_token_enc);
      const ids = await searchMessages(token, `${WINDOW} ${source.query}`, MAX_EMAILS);
      state.emails += ids.length;
      for (const msg of await mapLimit(ids, 4, (id) => getMessage(token, id))) {
        const date = messageDate(msg);
        if (!state.lastEmailAt || date > state.lastEmailAt) state.lastEmailAt = date;
        // Newest email first: a job seen in several alerts keeps its newest card.
        const bodies = messageBodies(msg.payload);
        const resolved = source.tracker ? await resolveTracked(bodies.html, source.tracker) : undefined;
        for (const job of parseAlertEmail(provider, { ...bodies, date }, resolved))
          if (!jobs.has(job.external_id)) jobs.set(job.external_id, job);
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err);
      console.warn('[ALERTS]', provider, link.user_id, state.error);
    }
  }
  state.jobs = jobs.size;
  await supabase
    .from('source_state')
    .upsert({ source: 'alerts:' + provider, synced_at: new Date().toISOString(), notes: state });
  return [...jobs.values()];
}
