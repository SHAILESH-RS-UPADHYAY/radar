import { describe, expect, it } from 'vitest';
import { closurePolicy, dueForScrape, withinExperience } from './scrape';

describe('withinExperience', () => {
  it('keeps up to 3 years and unstated, drops 3-5 and 5+', () => {
    const keep = ['fresher', '0-1', '1-3', null].map((e) => withinExperience({ experience_required: e }));
    const drop = ['3-5', '5+'].map((e) => withinExperience({ experience_required: e }));
    expect(keep).toEqual([true, true, true, true]);
    expect(drop).toEqual([false, false]);
  });
});

describe('closurePolicy', () => {
  const hours = (p: string) => closurePolicy(p).graceMs / 3600_000;
  it('closes a missing ATS job after two missed runs, windowed reads after a week', () => {
    expect(hours('greenhouse')).toBe(10);
    expect(closurePolicy('greenhouse').liveProofMs).toBeNull();
    expect(hours('workday')).toBe(7 * 24);
  });

  it('gives boards and alert emails days, and lets a recent link check keep them open', () => {
    expect(hours('adzuna')).toBe(5 * 24);
    expect(hours('linkedin_email')).toBe(21 * 24);
    expect(closurePolicy('adzuna').liveProofMs).toBe(2 * 24 * 3600_000);
  });
});

describe('dueForScrape', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
  it('runs every feed every cycle, and quota-limited search APIs only once their interval has passed', () => {
    expect(dueForScrape({ ats_provider: 'greenhouse', last_scraped_at: ago(1) }, now)).toBe(true);
    expect(dueForScrape({ ats_provider: 'adzuna', last_scraped_at: ago(6) }, now)).toBe(false);
    expect(dueForScrape({ ats_provider: 'adzuna', last_scraped_at: ago(23) }, now)).toBe(true);
    expect(dueForScrape({ ats_provider: 'jooble', last_scraped_at: ago(12) }, now)).toBe(true);
    expect(dueForScrape({ ats_provider: 'adzuna', last_scraped_at: null }, now)).toBe(true);
  });
});
