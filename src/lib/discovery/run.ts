// ============================
// RADAR — Discovery: startup directories → careers feeds → companies RADAR scrapes
// ============================
// Runs from /api/cron/discover inside a time budget and resumes where it stopped:
//   1. Every 48h, StartupMap's sitemap queues new startups. Its /jobs/<city>/engineering pages (your cities
//      first, a slice per run) raise the priority of startups hiring engineers right now.
//   1b. Every 48h, free company lists are queued too: YC companies hiring now (yc-oss), the ATS links companies post
//      in HN's "Who is hiring?" threads, and Hiring Without Whiteboards (see lists.ts).
//   2. The queue: read a startup's page (or a company's own website), find its ATS board from the job links,
//      verify any guess, and add the company to `companies`. When the website shows no board, the board is guessed
//      from the company's name and accepted only with proof (guessFeed). From then on the normal scrape reads its
//      jobs straight from the ATS — the source of truth for what is actually open.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isSchemaMissing } from '@/lib/supabase/errors';
import { splitList } from '@/lib/profile';
import { COMPANY_SEEDS } from '@/lib/scraper/companies';
import { fetchJson, mapLimit } from '@/lib/scraper/utils';
import type { CompanyCategory } from '@/types';
import {
  boardUrl,
  detectAts,
  extractLinks,
  greenhouseJobId,
  nameMatches,
  sameSite,
  siteHost,
  slugCandidates,
  teamtailorJobHost,
  type AtsRef,
} from './ats';
import { hnRows, hwwRows, type ListRow } from './lists';
import { BOT_UA, politeFetcher, SiteBlockedError, type PoliteFetcher } from './polite';
import {
  citySlug,
  hiringSlugs,
  pageCity,
  parseStartupPage,
  readSitemap,
  STARTUPMAP,
  type DirectoryCompany,
} from './startupmap';

const CYCLE_MS = 48 * 3600_000; // full directory sync
const PAUSE_MS = 24 * 3600_000; // after a site says "slow down"
const RECHECK_NO_FEED_MS = 60 * 24 * 3600_000; // look again at companies that had no usable feed
const REOPEN_HIRING_MS = 7 * 24 * 3600_000; // a "no roles" company seen hiring again is rechecked at most weekly
const MAX_ATTEMPTS = 3;
const QUEUE_BATCH = 300;
const NO_SITE_FEED = 'no supported careers feed found on the website';
const SITE_REFUSES = 'the website refuses automated requests';
// Companies whose website showed no board before guessFeed existed get one more look.
const GUESS_SINCE = '2026-10-29T00:00:00Z';

interface StartupMapState {
  /** /jobs/<city>/engineering pages still to read this cycle, your cities first. */
  pages?: string[];
  cursor?: number;
  /** How many of `pages` are in your cities (their startups get priority 2). */
  hot?: number;
  slugs?: number;
  pausedUntil?: string;
  lastError?: string;
}

interface QueueRow {
  id: string;
  source: string;
  source_ref: string;
  name: string | null;
  website: string | null;
  attempts: number;
}

type Info = Partial<Omit<DirectoryCompany, 'jobLinks'>>;

interface ListSync {
  queued: number;
  error?: string;
}

export interface DiscoverySummary {
  /** False until migration 007 has been run. */
  ready: boolean;
  startupmap: { synced: boolean; pagesRead: number; pausedUntil?: string; error?: string };
  /** Companies queued this run from each free list (0 between 48h syncs). */
  yc: ListSync;
  hn: ListSync;
  hww: ListSync;
  processed: number;
  linked: number;
  noFeed: number;
  failed: number;
}

const now = () => new Date().toISOString();
const escLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
const SEED_NAMES = new Set(COMPANY_SEEDS.map((s) => s.name.toLowerCase()));

const categoryFor = (stage: string | null | undefined): CompanyCategory =>
  stage && /series [c-z]|growth|late|ipo|public|acquired/i.test(stage) ? 'Growth' : 'Startup';

export async function runDiscovery(supabase: SupabaseClient, deadline: number): Promise<DiscoverySummary> {
  const summary: DiscoverySummary = {
    ready: true,
    startupmap: { synced: false, pagesRead: 0 },
    yc: { queued: 0 },
    hn: { queued: 0 },
    hww: { queued: 0 },
    processed: 0,
    linked: 0,
    noFeed: 0,
    failed: 0,
  };
  const { data: state, error } = await supabase
    .from('source_state')
    .select('synced_at, notes')
    .eq('source', 'startupmap')
    .maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) return { ...summary, ready: false };
    throw new Error('Reading discovery state failed: ' + error.message);
  }

  const http = politeFetcher();
  const notes: StartupMapState = { ...(state?.notes || {}) };
  let startupMapOpen = !(notes.pausedUntil && Date.parse(notes.pausedUntil) > Date.now());
  if (!startupMapOpen) summary.startupmap.pausedUntil = notes.pausedUntil;

  if (startupMapOpen) {
    let syncedAt: string | undefined;
    try {
      if (!state?.synced_at || Date.now() - Date.parse(state.synced_at) >= CYCLE_MS) {
        await syncSitemap(supabase, http, notes);
        syncedAt = now();
        summary.startupmap.synced = true;
      }
      // Hiring pages get at most ~40% of this run; the rest is for the queue.
      const stopAt = Date.now() + (deadline - Date.now()) * 0.4;
      summary.startupmap.pagesRead = await readHiringPages(supabase, http, notes, stopAt);
      delete notes.lastError;
    } catch (err) {
      if (err instanceof SiteBlockedError) {
        notes.pausedUntil = new Date(Date.now() + PAUSE_MS).toISOString();
        summary.startupmap.pausedUntil = notes.pausedUntil;
        startupMapOpen = false;
      } else summary.startupmap.error = notes.lastError = (err as Error).message.slice(0, 300);
    }
    await supabase
      .from('source_state')
      .upsert({ source: 'startupmap', notes, ...(syncedAt ? { synced_at: syncedAt } : {}) });
  }

  const { data: profiles } = await supabase.from('user_profiles').select('location').not('location', 'is', null);
  const cities = (profiles || []).flatMap((p) => splitList(p.location));
  const lists: [keyof Pick<DiscoverySummary, 'yc' | 'hn' | 'hww'>, () => Promise<ListRow[]>][] = [
    ['yc', async () => ycRows(await fetchJson<YcCompany[]>(YC_HIRING, { timeoutMs: 20_000 }), cities)],
    ['hn', () => hnListRows(cities)],
    ['hww', async () => hwwRows(await fetchText(HWW_README), cities)],
  ];
  for (const [source, load] of lists) {
    try {
      summary[source].queued = await syncList(supabase, source, load);
    } catch (err) {
      summary[source].error = (err as Error).message.slice(0, 300);
    }
  }

  if (await workQueue(supabase, http, deadline, summary, startupMapOpen)) {
    notes.pausedUntil = new Date(Date.now() + PAUSE_MS).toISOString();
    summary.startupmap.pausedUntil = notes.pausedUntil;
    await supabase.from('source_state').upsert({ source: 'startupmap', notes });
  }
  return summary;
}

// ---- 1. Directory sync ----

async function syncSitemap(supabase: SupabaseClient, http: PoliteFetcher, notes: StartupMapState) {
  const res = await http.get(STARTUPMAP + '/sitemap.xml');
  if (res.status !== 200) throw new Error('StartupMap sitemap answered ' + res.status);
  const { slugs, engineeringPages } = readSitemap(res.text);
  for (let i = 0; i < slugs.length; i += 500) {
    const { error } = await supabase.from('discovered_companies').upsert(
      slugs.slice(i, i + 500).map((s) => ({ source: 'startupmap', source_ref: s })),
      { onConflict: 'source,source_ref', ignoreDuplicates: true },
    );
    if (error) throw new Error('Queueing startups failed: ' + error.message);
  }
  const { data: profiles } = await supabase.from('user_profiles').select('location').not('location', 'is', null);
  const mine = new Set((profiles || []).flatMap((p) => splitList(p.location)).map(citySlug));
  const hot = engineeringPages.filter((p) => mine.has(pageCity(p)));
  notes.pages = [...hot, ...engineeringPages.filter((p) => !mine.has(pageCity(p)))];
  notes.hot = hot.length;
  notes.cursor = 0;
  notes.slugs = slugs.length;
}

async function readHiringPages(
  supabase: SupabaseClient,
  http: PoliteFetcher,
  notes: StartupMapState,
  stopAt: number,
): Promise<number> {
  const pages = notes.pages || [];
  let read = 0;
  while ((notes.cursor ?? 0) < pages.length && Date.now() < stopAt) {
    const i = notes.cursor ?? 0;
    const res = await http.get(pages[i]);
    notes.cursor = i + 1;
    read += 1;
    const slugs = res.status === 200 ? hiringSlugs(res.text) : [];
    if (slugs.length) await markHiring(supabase, slugs, i < (notes.hot ?? 0) ? 2 : 1);
  }
  return read;
}

/** Startups hiring engineers now: queue new ones, move pending ones up, recheck ones that had no roles. */
async function markHiring(supabase: SupabaseClient, slugs: string[], priority: number) {
  const table = () => supabase.from('discovered_companies');
  await table().upsert(
    slugs.map((s) => ({ source: 'startupmap', source_ref: s, priority })),
    { onConflict: 'source,source_ref', ignoreDuplicates: true },
  );
  await table()
    .update({ priority })
    .eq('source', 'startupmap')
    .in('source_ref', slugs)
    .eq('status', 'pending')
    .lt('priority', priority);
  await table()
    .update({ status: 'pending', priority })
    .eq('source', 'startupmap')
    .in('source_ref', slugs)
    .eq('status', 'no_feed')
    .lt('checked_at', new Date(Date.now() - REOPEN_HIRING_MS).toISOString());
}

// ---- 1b. YC companies hiring now ----

// The open yc-oss dataset: one static JSON file rebuilt from YC's public directory. No robots.txt, no API key.
const YC_HIRING = 'https://yc-oss.github.io/api/companies/hiring.json';

export interface YcCompany {
  slug: string;
  name: string;
  website: string | null;
  all_locations: string | null;
  status: string | null;
}

/** Active YC companies with a website → queue rows (checked like imports: website → careers page → ATS). */
export function ycRows(list: YcCompany[], cities: string[]) {
  const mine = cities.map((c) => c.toLowerCase()).filter(Boolean);
  return list
    .filter((c) => c.slug && c.website && (c.status ?? 'Active') === 'Active')
    .map((c) => {
      const where = (c.all_locations || '').toLowerCase();
      return {
        source: 'yc',
        source_ref: c.slug,
        name: c.name,
        website: c.website,
        // Your cities (or "remote" when you asked for it) first, then India, then everyone else.
        priority: mine.some((m) => where.includes(m)) ? 2 : where.includes('india') ? 1 : 0,
      };
    });
}

/** Every 48h: queue a list's companies. Returns how many were queued (existing ones are kept as they are). */
async function syncList(supabase: SupabaseClient, source: string, load: () => Promise<ListRow[]>): Promise<number> {
  const { data: state } = await supabase.from('source_state').select('synced_at').eq('source', source).maybeSingle();
  if (state?.synced_at && Date.now() - Date.parse(state.synced_at) < CYCLE_MS) return 0;
  const rows = await load();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('discovered_companies')
      .upsert(rows.slice(i, i + 500), { onConflict: 'source,source_ref', ignoreDuplicates: true });
    if (error) throw new Error(`Queueing ${source} companies failed: ` + error.message);
  }
  await supabase.from('source_state').upsert({ source, synced_at: now() });
  return rows.length;
}

// ---- 1c. HN "Who is hiring?" and Hiring Without Whiteboards ----

const HN_THREADS = 'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=12';
const HWW_README = 'https://raw.githubusercontent.com/poteto/hiring-without-whiteboards/main/README.md';

/** The last six "Who is hiring?" threads: an older post's board is still worth a look (closed ones have no jobs). */
async function hnListRows(cities: string[]): Promise<ListRow[]> {
  const { hits } = await fetchJson<{ hits: { objectID: string; title: string }[] }>(HN_THREADS, { timeoutMs: 20_000 });
  const threads = hits.filter((h) => /who is hiring/i.test(h.title)).slice(0, 6);
  const rows = new Map<string, ListRow>();
  for (const t of threads) {
    const item = await fetchJson<{ children?: { text?: string | null }[] }>(
      'https://hn.algolia.com/api/v1/items/' + t.objectID,
      { timeoutMs: 30_000 },
    );
    for (const r of hnRows(item.children || [], cities)) if (!rows.has(r.source_ref)) rows.set(r.source_ref, r);
  }
  return [...rows.values()];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': BOT_UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(url + ' answered ' + res.status);
  return res.text();
}

// ---- 2. Queue ----

/** Works the queue until the deadline. Returns true if StartupMap asked us to back off. */
async function workQueue(
  supabase: SupabaseClient,
  http: PoliteFetcher,
  deadline: number,
  summary: DiscoverySummary,
  startupMapOpen: boolean,
): Promise<boolean> {
  const recheck = new Date(Date.now() - RECHECK_NO_FEED_MS).toISOString();
  let query = supabase
    .from('discovered_companies')
    .select('id, source, source_ref, name, website, attempts')
    .or(
      `status.eq.pending,status.eq.failed,and(status.eq.no_feed,checked_at.lt."${recheck}"),` +
        `and(status.eq.no_feed,note.in.("${NO_SITE_FEED}","${SITE_REFUSES}"),checked_at.lt."${GUESS_SINCE}")`,
    );
  // While StartupMap is paused its rows would only fill the batch and be skipped, starving every other source.
  if (!startupMapOpen) query = query.neq('source', 'startupmap');
  const { data: rows, error } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(QUEUE_BATCH);
  if (error) throw new Error('Reading the discovery queue failed: ' + error.message);

  let blocked = false;
  // Different companies' sites run side by side; StartupMap requests still queue one gap apart in the fetcher.
  await mapLimit((rows || []) as QueueRow[], 4, async (row) => {
    if (Date.now() > deadline - 15_000) return;
    if (row.source === 'startupmap' && (blocked || !startupMapOpen)) return;
    try {
      const found = await resolveRow(http, row);
      summary.processed += 1;
      await settle(supabase, row, found, summary);
    } catch (err) {
      if (err instanceof SiteBlockedError && err.origin === STARTUPMAP) {
        blocked = true;
        return;
      }
      summary.processed += 1;
      summary.failed += 1;
      const attempts = row.attempts + 1;
      await supabase
        .from('discovered_companies')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'no_feed' : 'failed',
          attempts,
          checked_at: now(),
          note: (err instanceof SiteBlockedError ? SITE_REFUSES : (err as Error).message).slice(0, 200),
        })
        .eq('id', row.id);
    }
  });
  return blocked;
}

interface Found {
  ref: AtsRef | null;
  info: Info;
  note: string | null;
}

async function resolveRow(http: PoliteFetcher, row: QueueRow): Promise<Found> {
  if (row.source === 'startupmap') {
    const res = await http.get(`${STARTUPMAP}/startup/${encodeURIComponent(row.source_ref)}`);
    if (res.status === 0) return { ref: null, info: {}, note: 'robots.txt disallows this page' };
    if (res.status === 404 || res.status === 410)
      return { ref: null, info: {}, note: 'no longer listed on StartupMap' };
    if (res.status !== 200) throw new Error('StartupMap page answered ' + res.status);
    const page = parseStartupPage(res.text);
    if (!page) return { ref: null, info: {}, note: 'no company data on the page' };
    const { jobLinks, ...info } = page;
    if (!jobLinks.length) return { ref: null, info, note: 'no open roles listed' };
    const ref = await feedFromLinks(jobLinks, page.name, page.website);
    return { ref, info, note: ref ? null : 'careers feed not supported yet (' + new URL(jobLinks[0]).hostname + ')' };
  }
  // A list that links the ATS board itself (HN posts, some Hiring Without Whiteboards entries).
  const direct = row.website ? detectAts([row.website]) : null;
  if (direct) return { ref: direct, info: {}, note: null };
  let ref: AtsRef | null = null;
  if (row.website) {
    try {
      ref = await feedFromWebsite(http, row.website, row.name);
    } catch (err) {
      // A website that turns bots away can still have a public board: the guess never touches the website.
      if (!(err instanceof SiteBlockedError)) throw err;
    }
  }
  ref ??= await guessFeed(http, row.name, row.website);
  return { ref, info: {}, note: ref ? null : NO_SITE_FEED };
}

const tryJson = <T>(url: string) => fetchJson<T>(url, { retries: 0, timeoutMs: 10_000 }).catch(() => null);

/** Does the text mention the company's website (proof for a short or partly matching name)? */
const mentionsSite = (text: string, host: string | null) => !!host && text.toLowerCase().includes(host);

/**
 * The board of a company whose website shows none (careers pages built in the browser hide their ATS links), guessed
 * from its name and website and accepted only with proof, because names collide ("Feather", "Seam"):
 *   Ashby       the board page names the company's website (publicWebsite).
 *   Greenhouse, Lever, Workable   the board's company name is the company's; a short (< 6 letters) or partial name
 *               also needs the website named in the board's jobs or description.
 * Only boards with open jobs count. Measured on 40 stuck YC companies (2026-10-29): 15 had a board, 8 with jobs.
 */
export async function guessFeed(
  http: PoliteFetcher,
  name: string | null,
  website: string | null,
): Promise<AtsRef | null> {
  if (!name) return null;
  const host = siteHost(website);
  const trusted = (match: 'exact' | 'prefix' | null, text: () => string) =>
    !!match && ((match === 'exact' && name.replace(/[^a-z0-9]/gi, '').length >= 6) || mentionsSite(text(), host));
  for (const slug of slugCandidates(name, website)) {
    const ashby = await tryJson<{ jobs?: unknown[] }>('https://api.ashbyhq.com/posting-api/job-board/' + slug);
    if (ashby?.jobs?.length && website) {
      const page = await http.get('https://jobs.ashbyhq.com/' + slug);
      const site = page.status === 200 ? /"publicWebsite":"([^"]+)"/.exec(page.text)?.[1] : null;
      if (site && sameSite(site, website)) return { provider: 'ashby', identifier: slug };
    }
    const gh = await tryJson<{ name?: string }>('https://boards-api.greenhouse.io/v1/boards/' + slug);
    if (gh?.name && nameMatches(gh.name, name)) {
      const jobs = await tryJson<{ jobs?: { content?: string }[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      );
      if (jobs?.jobs?.length && trusted(nameMatches(gh.name, name), () => jobs.jobs!.map((j) => j.content).join(' ')))
        return { provider: 'greenhouse', identifier: slug };
    }
    const lever = await tryJson<{ descriptionPlain?: string }[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (Array.isArray(lever) && lever.length) {
      const page = await http.get('https://jobs.lever.co/' + slug);
      const title = page.status === 200 ? /<title>([^<]*)<\/title>/.exec(page.text)?.[1] : null;
      if (trusted(nameMatches(title, name), () => lever.map((p) => p.descriptionPlain).join(' ')))
        return { provider: 'lever', identifier: slug };
    }
    const wk = await tryJson<{ name?: string; description?: string; jobs?: { description?: string }[] }>(
      'https://apply.workable.com/api/v1/widget/accounts/' + slug,
    );
    if (wk?.jobs?.length && trusted(nameMatches(wk.name, name), () => (wk.description || '') + JSON.stringify(wk.jobs)))
      return { provider: 'workable', identifier: slug };
  }
  return null;
}

const answers = (url: string) =>
  fetchJson(url, { retries: 0, timeoutMs: 10_000 }).then(
    () => true,
    () => false,
  );

/** The ATS board behind a set of job links, verifying anything that had to be guessed. */
async function feedFromLinks(links: string[], name: string | null, website: string | null): Promise<AtsRef | null> {
  const direct = detectAts(links);
  if (direct) return direct;
  // Greenhouse embedded on the company's own domain (?gh_jid=): the job id proves which board token is right.
  const jobId = links.map(greenhouseJobId).find(Boolean);
  if (jobId) {
    for (const token of slugCandidates(name, website))
      if (await answers(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${jobId}`))
        return { provider: 'greenhouse', identifier: token };
  }
  // Teamtailor on a custom domain (/jobs/<id>-<title>): confirmed by its public JSON feed.
  const host = links.map(teamtailorJobHost).find(Boolean);
  if (host) {
    const feed = await fetchJson<{ items?: unknown[] }>(`https://${host}/jobs.json`, {
      retries: 0,
      timeoutMs: 10_000,
    }).catch(() => null);
    if (Array.isArray(feed?.items)) return { provider: 'teamtailor', identifier: host };
  }
  return null;
}

const CAREERS_LINK = /career|jobs|join[-_ ]?us|work[-_ ]?with[-_ ]?us|hiring|vacanc|open[-_ ]?(roles|positions)/i;

/** An imported company: its homepage, then its careers page, looking for an ATS board. */
async function feedFromWebsite(http: PoliteFetcher, website: string, name: string | null): Promise<AtsRef | null> {
  const home = await http.get(website);
  if (home.status !== 200) return null;
  const links = extractLinks(home.text, home.url);
  const fromHome = await feedFromLinks(links, name, website);
  if (fromHome) return fromHome;

  const site = new URL(home.url).hostname.replace(/^www\./, '');
  const careers = links.find((l) => {
    const u = new URL(l);
    return u.hostname.endsWith(site) && CAREERS_LINK.test(u.hostname.split('.')[0] + ' ' + u.pathname);
  });
  if (!careers) return null;
  const page = await http.get(careers);
  return page.status === 200 ? feedFromLinks(extractLinks(page.text, page.url), name, website) : null;
}

async function settle(supabase: SupabaseClient, row: QueueRow, found: Found, summary: DiscoverySummary) {
  const info: Info = { ...found.info, name: found.info.name ?? row.name ?? undefined };
  let companyId: string | null = null;
  let note = found.note;
  if (found.ref) {
    const linked = await linkCompany(supabase, row, found.ref, info);
    if (typeof linked === 'string') companyId = linked;
    else note = linked.note;
  }
  const facts = Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined && v !== null));
  await supabase
    .from('discovered_companies')
    .update({
      ...facts,
      status: companyId ? 'linked' : 'no_feed',
      company_id: companyId,
      checked_at: now(),
      attempts: 0,
      note,
    })
    .eq('id', row.id);
  if (companyId) summary.linked += 1;
  else summary.noFeed += 1;
}

/** The company row for this board: an existing one, an upgraded untracked one, or a new one. */
async function linkCompany(
  supabase: SupabaseClient,
  row: QueueRow,
  ref: AtsRef,
  info: Info,
): Promise<string | { note: string }> {
  const { data: same } = await supabase
    .from('companies')
    .select('id')
    .eq('ats_provider', ref.provider)
    .ilike('ats_identifier', escLike(ref.identifier))
    .limit(1);
  if (same?.[0]) return same[0].id;

  const name = (info.name || row.name || ref.identifier).slice(0, 120);
  const found = {
    careers_url: boardUrl(ref),
    ats_provider: ref.provider,
    ats_identifier: ref.identifier,
    website: info.website ?? row.website,
    source: row.source,
    funding_stage: info.funding_stage ?? null,
    is_active: true,
  };
  const { data: clash } = await supabase
    .from('companies')
    .select('id, ats_provider')
    .ilike('name', escLike(name))
    .limit(1);
  if (clash?.[0]) {
    // A dream company you typed in (untracked) now has a feed: track it. Curated seeds keep their own settings.
    if (clash[0].ats_provider !== 'custom' || SEED_NAMES.has(name.toLowerCase()))
      return { note: `another company named "${name}" is already tracked` };
    const { error } = await supabase.from('companies').update(found).eq('id', clash[0].id);
    if (error) throw new Error('Tracking company failed: ' + error.message);
    return clash[0].id;
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({
      ...found,
      name,
      category: categoryFor(info.funding_stage),
      country: info.country ?? null,
      city: info.city ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error('Adding company failed: ' + error.message);
  return data.id;
}
