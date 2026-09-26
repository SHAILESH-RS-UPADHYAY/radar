import { describe, expect, it } from 'vitest';
import { citySlug, hiringSlugs, pageCity, parseStartupPage, readSitemap } from './startupmap';
import { parseCsv, parseTargets, siteDomain } from './targets';

// Trimmed from the real pages' structure (2026-09-26): JSON-LD graph + outbound job links.
const HIRING_PAGE = `
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"StartupMap","url":"https://startupmap.one"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Pleo","url":"https://www.pleo.io","keywords":"Fintech, Series C","location":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Copenhagen","addressCountry":"Denmark"}}},{"@type":"BreadcrumbList"}]}</script>
<a href="https://jobs.ashbyhq.com/pleo/9e57f45b?utm_source=startupmap&amp;utm_medium=referral">Revenue Operations Analyst</a>
<a href="https://jobs.ashbyhq.com/pleo/52cf67d4?utm_source=startupmap&amp;utm_medium=referral">Staff Analyst</a>
<a href="https://www.pleo.io">Visit Pleo</a>`;

const QUIET_PAGE = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"011h","url":"https://011h.com/","keywords":"Climate Tech, Series A","location":{"address":{"addressLocality":"Barcelona","addressCountry":"Spain"}}}]}</script><p>No open roles listed right now.</p>`;

describe('StartupMap parsers', () => {
  it('reads company facts and ATS job links from a startup page', () => {
    expect(parseStartupPage(HIRING_PAGE)).toEqual({
      name: 'Pleo',
      website: 'https://www.pleo.io',
      city: 'Copenhagen',
      country: 'Denmark',
      sector: 'Fintech',
      funding_stage: 'Series C',
      jobLinks: [
        'https://jobs.ashbyhq.com/pleo/9e57f45b?utm_source=startupmap&utm_medium=referral',
        'https://jobs.ashbyhq.com/pleo/52cf67d4?utm_source=startupmap&utm_medium=referral',
      ],
    });
    expect(parseStartupPage(QUIET_PAGE)).toMatchObject({ name: '011h', funding_stage: 'Series A', jobLinks: [] });
    expect(parseStartupPage('<html>no data</html>')).toBeNull();
  });

  it('reads the sitemap and the hiring lists', () => {
    const xml = `<urlset><url><loc>https://startupmap.one/</loc></url><url><loc>https://startupmap.one/startup/pleo_dk</loc></url>
      <url><loc>https://startupmap.one/startup/011h_es</loc></url><url><loc>https://startupmap.one/jobs/london/engineering</loc></url>
      <url><loc>https://startupmap.one/jobs/london/sales</loc></url><url><loc>https://startupmap.one/startups/london/ai</loc></url></urlset>`;
    expect(readSitemap(xml)).toEqual({
      slugs: ['pleo_dk', '011h_es'],
      engineeringPages: ['https://startupmap.one/jobs/london/engineering'],
    });
    expect(
      hiringSlugs(
        '<a href="/startup/duffel_gb">x</a><a href="/startup/pleo_dk">y</a><a href="/startup/duffel_gb">z</a>',
      ),
    ).toEqual(['duffel_gb', 'pleo_dk']);
    expect(pageCity('https://startupmap.one/jobs/new-york/engineering')).toBe('new-york');
    expect(citySlug('New York')).toBe('new-york');
    expect(citySlug('Reykjavík')).toBe('reykjavik');
  });
});

describe('import parsing', () => {
  it('finds the website column of a CSV export, with quoted commas', () => {
    const csv =
      'Company,Amount,Website,Outreach angle\n' +
      '"Acme, Inc.",€2M,https://www.acme.io/about,"Hiring, fast"\n' +
      'Beta,$1M,beta.dev,x\nNoSite,$1M,,y\nDup,$1M,acme.io,z\n';
    expect(parseTargets(csv)).toEqual([
      { name: 'Acme, Inc.', website: 'https://acme.io' },
      { name: 'Beta', website: 'https://beta.dev' },
    ]);
  });

  it('reads free text, one company per line, and skips profile links', () => {
    expect(
      parseTargets('Isomorphic Labs https://isomorphiclabs.com\nlinear.app\nhttps://www.linkedin.com/company/x\n'),
    ).toEqual([
      { name: 'Isomorphic Labs', website: 'https://isomorphiclabs.com' },
      { name: null, website: 'https://linear.app' },
    ]);
    expect(siteDomain('not a site')).toBeNull();
    expect(parseCsv('a,"b ""q"" c"\n')).toEqual([['a', 'b "q" c']]);
  });
});
