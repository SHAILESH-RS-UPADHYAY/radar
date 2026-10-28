import { describe, expect, it } from 'vitest';
import { hnRows, hwwRows, placePriority } from './lists';
import { nameMatches, sameSite } from './ats';

describe('hnRows', () => {
  it('keeps posts that link an ATS board, named from the first "|" field', () => {
    const rows = hnRows(
      [
        {
          text: 'Legora | Software Engineer | Remote (EU, India) | <a href="https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;legora">apply</a>',
        },
        { text: 'Acme | Backend | NYC | email jobs@acme.com' },
        { text: 'Legora again <a href="https://jobs.ashbyhq.com/legora/123">job</a>' },
      ],
      ['Pune'],
    );
    expect(rows).toEqual([
      {
        source: 'hn',
        source_ref: 'ashby:legora',
        name: 'Legora',
        website: 'https://jobs.ashbyhq.com/legora',
        priority: 1,
      },
    ]);
  });
});

describe('hwwRows', () => {
  it('reads "- [Name](link) | Location | notes" lines', () => {
    const readme = [
      '# Hiring Without Whiteboards',
      '- [Aalyria](https://ats.rippling.com/aalyria-careers/jobs) | Remote | Timeboxed design exercise',
      '- [Acme](https://acme.io/careers/?ref=hww) | Pune, India | Take-home',
      'Not a company line',
    ].join('\n');
    const rows = hwwRows(readme, ['Pune']);
    expect(rows.map((r) => [r.name, r.website, r.priority])).toEqual([
      ['Aalyria', 'https://ats.rippling.com/aalyria-careers/jobs', 1],
      ['Acme', 'https://acme.io/careers', 2],
    ]);
  });
});

describe('placePriority', () => {
  it('ranks your cities over India and remote', () => {
    expect(placePriority('Bengaluru', ['Bengaluru'])).toBe(2);
    expect(placePriority('Hyderabad, India', ['Pune'])).toBe(1);
    expect(placePriority('REMOTE', [])).toBe(1);
    expect(placePriority('New York', ['Pune'])).toBe(0);
  });
});

describe('guess proof helpers', () => {
  it('matches board names exactly or by a 4+ letter prefix', () => {
    expect(nameMatches('Stripe', 'stripe')).toBe('exact');
    expect(nameMatches('Palantir Technologies', 'Palantir')).toBe('prefix');
    expect(nameMatches('Fe', 'Feather')).toBeNull();
    expect(nameMatches('Seam', 'Feather')).toBeNull();
  });
  it('treats a site, its www and its subdomains as the same site', () => {
    expect(sameSite('https://legora.com/careers', 'www.legora.com')).toBe(true);
    expect(sameSite('https://jobs.acme.io', 'https://acme.io')).toBe(true);
    expect(sameSite('https://acme.io', 'https://acme.com')).toBe(false);
    expect(sameSite(null, 'acme.io')).toBe(false);
  });
});
