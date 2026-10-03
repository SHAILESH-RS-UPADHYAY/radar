import { describe, expect, it } from 'vitest';
import { formatSalary, opsSignals, postedTag, timeAgo, todaysTen, type MatchedJob } from './types';

describe('timeAgo', () => {
  const now = Date.parse('2026-09-26T12:00:00Z');
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now);

  it('reads minutes and hours, not just "today"', () => {
    expect(ago(20_000)).toBe('just now');
    expect(ago(5 * 60_000)).toBe('5 min ago');
    expect(ago(3 * 3_600_000)).toBe('3h ago');
  });

  it('falls back to days and months, and handles missing or bad input', () => {
    expect(ago(30 * 3_600_000)).toBe('1 day ago');
    expect(ago(12 * 86_400_000)).toBe('12 days ago');
    expect(ago(65 * 86_400_000)).toBe('2 mo ago');
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo('not a date', now)).toBeNull();
  });
});

describe('opsSignals', () => {
  const now = Date.parse('2026-09-26T12:00:00Z');
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const app = (over: Partial<MatchedJob>, active = true) =>
    ({
      stage: 'applied',
      stage_changed_at: null,
      applied_at: daysAgo(1),
      job: { is_active: active },
      ...over,
    }) as MatchedJob;
  const labels = (m: MatchedJob) => opsSignals(m, now).map((s) => s.label);

  it('stays quiet for fresh applications', () => {
    expect(labels(app({}))).toEqual([]);
  });

  it('asks for a follow-up after a week and calls it ghosted after two', () => {
    expect(labels(app({ applied_at: daysAgo(8) }))).toEqual(['FOLLOW UP']);
    expect(labels(app({ stage: 'screening', stage_changed_at: daysAgo(15) }))).toEqual(['GHOSTED · 15D']);
  });

  it('never nags about interviews or offers, and flags closed postings', () => {
    expect(labels(app({ stage: 'interview', stage_changed_at: daysAgo(30) }))).toEqual([]);
    expect(labels(app({}, false))).toEqual(['POSTING CLOSED']);
  });
});

const at = Date.parse('2026-09-30T12:00:00Z');
const job = (id: string, score: number, daysAgo: number | null) =>
  ({
    id,
    score,
    job: { posted_at: daysAgo === null ? null : new Date(at - daysAgo * 86_400_000).toISOString() },
  }) as unknown as MatchedJob;

describe('todaysTen', () => {
  it('puts postings from the last 4 days first, then the last two weeks, each by score, and keeps 10', () => {
    const vault = [
      job('old-99', 99, 40),
      job('fresh-81', 81, 2),
      job('week-95', 95, 9),
      job('fresh-90', 90, 0),
      job('nodate-97', 97, null),
    ];
    expect(todaysTen(vault, at).map((m) => m.id)).toEqual(['fresh-90', 'fresh-81', 'week-95', 'old-99', 'nodate-97']);
    expect(
      todaysTen(
        Array.from({ length: 14 }, (_, i) => job('j' + i, 80 + i, 1)),
        at,
      ),
    ).toHaveLength(10);
  });
  it('tags how old a posting is', () => {
    expect([job('a', 1, 1), job('b', 1, 6), job('c', 1, 30), job('d', 1, null)].map((m) => postedTag(m, at))).toEqual([
      'NEW',
      '6D',
      '4W',
      '',
    ]);
  });
});

describe('formatSalary', () => {
  it('reads Indian pay in lakhs per annum', () => {
    const job = { salary_min: 1800000, salary_max: 2600000, salary_currency: 'INR' } as Parameters<
      typeof formatSalary
    >[0];
    expect(formatSalary(job)).toBe('18–26 LPA');
    expect(formatSalary({ ...job, salary_min: null, salary_max: 1250000 })).toBe('12.5 LPA');
    expect(formatSalary({ ...job, salary_min: 120000, salary_max: 150000, salary_currency: 'USD' })).toBe(
      'USD 120k – 150k',
    );
  });
});
