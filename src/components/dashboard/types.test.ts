import { describe, expect, it } from 'vitest';
import { opsSignals, timeAgo, type MatchedJob } from './types';

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
