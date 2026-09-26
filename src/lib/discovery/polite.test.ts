import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRobots, politeFetcher, SiteBlockedError } from './polite';

afterEach(() => vi.unstubAllGlobals());

describe('parseRobots', () => {
  it("obeys StartupMap's rules", () => {
    const robots = parseRobots(
      'User-agent: *\nAllow: /\nContent-Signal: search=yes\n# Private\nDisallow: /admin/\nDisallow: /api\nDisallow: /settings\n',
    );
    expect(robots.allows('/startup/pleo_dk')).toBe(true);
    expect(robots.allows('/sitemap.xml')).toBe(true);
    expect(robots.allows('/api/startups?page=2')).toBe(false);
    expect(robots.allows('/admin/')).toBe(false);
  });

  it('uses a group naming the bot over *, and a rule for another bot does not apply', () => {
    const robots = parseRobots('User-agent: Bytespider\nDisallow: /\n\nUser-agent: *\nDisallow: /private\n');
    expect(robots.allows('/company/acme')).toBe(true);
    expect(robots.allows('/private/x')).toBe(false);
    expect(parseRobots('User-agent: radar\nDisallow: /\n').allows('/x')).toBe(false);
  });

  it('handles wildcards, $ anchors, longest match and Crawl-delay', () => {
    const robots = parseRobots(
      'User-agent: *\nDisallow: /*.pdf$\nDisallow: /jobs\nAllow: /jobs/engineering\nCrawl-delay: 4\n',
    );
    expect(robots.allows('/files/cv.pdf')).toBe(false);
    expect(robots.allows('/files/cv.pdf?x=1')).toBe(true);
    expect(robots.allows('/jobs/sales')).toBe(false);
    expect(robots.allows('/jobs/engineering/berlin')).toBe(true);
    expect(robots.delayMs).toBe(4000);
    expect(parseRobots('').allows('/anything')).toBe(true);
  });
});

describe('politeFetcher', () => {
  it('skips disallowed paths without requesting them, and stops at a 429', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /api\n');
      if (url.includes('/slow')) return new Response('', { status: 429 });
      return new Response('<html>ok</html>');
    });
    vi.stubGlobal('fetch', fetchMock);
    const http = politeFetcher({ minIntervalMs: 0 });

    expect((await http.get('https://site.test/api/list')).status).toBe(0);
    expect((await http.get('https://site.test/page')).text).toBe('<html>ok</html>');
    await expect(http.get('https://site.test/slow')).rejects.toBeInstanceOf(SiteBlockedError);
    await expect(http.get('https://site.test/page')).rejects.toBeInstanceOf(SiteBlockedError);
    // robots.txt once, /page once, /slow once — nothing after the block, nothing under /api.
    expect(fetchMock.mock.calls.map((c) => new URL(String(c[0])).pathname)).toEqual(['/robots.txt', '/page', '/slow']);
  });
});
