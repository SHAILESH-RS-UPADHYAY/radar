import { describe, expect, it } from 'vitest';
import { timeAgo } from './types';

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
