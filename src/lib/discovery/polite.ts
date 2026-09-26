// ============================
// RADAR — Polite fetching for third-party websites
// ============================
// What keeps RADAR welcome on startup directories and company homepages:
//   1. robots.txt is read first and obeyed (including Crawl-delay);
//   2. an honest User-Agent that names the bot and links to what it does;
//   3. one request at a time per site, with a pause between them;
//   4. at the first "too many" / "forbidden" / "unavailable" answer, the site is left alone.
// No browser disguise, no proxy rotation, no CAPTCHA solving — if a site says no, RADAR takes no for an answer.

import { SITE_URL } from '@/lib/site';

export const BOT_UA = `RADAR-Discovery/1.0 (+${SITE_URL}/system; personal job-search bot)`;
const BOT_TOKEN = 'radar-discovery';

/** A site answered 429/403/503 (or its robots.txt could not be read): stop asking it for now. */
export class SiteBlockedError extends Error {
  constructor(
    public readonly origin: string,
    public readonly status: number,
  ) {
    super(`${origin} answered ${status || 'no response'}; pausing requests to it`);
    this.name = 'SiteBlockedError';
  }
}

export interface Robots {
  allows(pathAndQuery: string): boolean;
  /** Crawl-delay in ms, if the site asks for one. */
  delayMs: number | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * robots.txt rules for our bot: the group naming us, else the `*` group. Google semantics — `*` wildcards,
 * `$` anchors the end, the longest matching rule wins and Allow wins a tie.
 */
export function parseRobots(txt: string, token = BOT_TOKEN): Robots {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[]; delay: number | null };
  const groups: Group[] = [];
  let current: Group | null = null;
  let inAgentLines = false;
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') {
      if (!current || !inAgentLines) groups.push((current = { agents: [], rules: [], delay: null }));
      current.agents.push(m[2].toLowerCase());
      inAgentLines = true;
      continue;
    }
    inAgentLines = false;
    if (!current) continue;
    if ((key === 'allow' || key === 'disallow') && m[2]) current.rules.push({ allow: key === 'allow', path: m[2] });
    if (key === 'crawl-delay' && Number(m[2]) > 0) current.delay = Number(m[2]) * 1000;
  }
  const named = groups.filter((g) => g.agents.some((a) => a && a !== '*' && token.includes(a)));
  const applied = named.length ? named : groups.filter((g) => g.agents.includes('*'));
  const rules = applied.flatMap((g) => g.rules);
  const delays = applied.map((g) => g.delay).filter((d): d is number => d !== null);

  return {
    delayMs: delays.length ? Math.max(...delays) : null,
    allows(path) {
      let best: { allow: boolean; length: number } | null = null;
      for (const rule of rules) {
        const anchored = rule.path.endsWith('$');
        const body = anchored ? rule.path.slice(0, -1) : rule.path;
        const re = new RegExp('^' + body.split('*').map(escapeRe).join('.*') + (anchored ? '$' : ''));
        if (!re.test(path)) continue;
        if (!best || rule.path.length > best.length || (rule.path.length === best.length && rule.allow))
          best = { allow: rule.allow, length: rule.path.length };
      }
      return best ? best.allow : true;
    },
  };
}

export interface PoliteResponse {
  /** HTTP status; 0 = not fetched because robots.txt disallows the path. */
  status: number;
  /** Final URL after redirects. */
  url: string;
  text: string;
}

export interface PoliteFetcher {
  get(url: string): Promise<PoliteResponse>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A fetcher that follows the rules above. Keep one per run so robots.txt and pacing are shared. */
export function politeFetcher({ minIntervalMs = 1500, timeoutMs = 20_000 } = {}): PoliteFetcher {
  const robots = new Map<string, Promise<Robots>>();
  const nextSlot = new Map<string, number>();
  const blocked = new Map<string, number>();

  const request = (url: string, accept: string) =>
    fetch(url, {
      headers: { 'user-agent': BOT_UA, accept },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

  async function loadRobots(origin: string): Promise<Robots> {
    let res: Response;
    try {
      res = await request(origin + '/robots.txt', 'text/plain,*/*;q=0.5');
    } catch {
      throw new SiteBlockedError(origin, 0);
    }
    // Like Google: a missing robots.txt (4xx) means no rules; an erroring one (5xx, 429) means "not now".
    if (res.status === 429 || res.status >= 500) throw new SiteBlockedError(origin, res.status);
    return parseRobots(res.ok ? await res.text() : '');
  }

  return {
    async get(url) {
      const target = new URL(url);
      const origin = target.origin;
      if (blocked.has(origin)) throw new SiteBlockedError(origin, blocked.get(origin)!);

      let rules = robots.get(origin);
      if (!rules) robots.set(origin, (rules = loadRobots(origin)));
      let parsed: Robots;
      try {
        parsed = await rules;
      } catch (err) {
        if (err instanceof SiteBlockedError) blocked.set(origin, err.status);
        throw err;
      }
      if (!parsed.allows(target.pathname + target.search)) return { status: 0, url, text: '' };

      // Reserve this origin's next slot before waiting, so parallel callers line up one gap apart.
      const gap = Math.max(minIntervalMs, parsed.delayMs ?? 0);
      const at = Math.max(Date.now(), nextSlot.get(origin) ?? 0);
      nextSlot.set(origin, at + gap);
      if (at > Date.now()) await sleep(at - Date.now());

      const res = await request(url, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
      if (res.status === 429 || res.status === 403 || res.status === 503) {
        blocked.set(origin, res.status);
        throw new SiteBlockedError(origin, res.status);
      }
      return { status: res.status, url: res.url || url, text: res.ok ? await res.text() : '' };
    },
  };
}
