import { describe, expect, it } from 'vitest';
import { payBand, roleWords, titleLevel } from './pay';

const row = (min: number | null, max: number | null, currency = 'INR') => ({
  salary_min: min,
  salary_max: max,
  salary_currency: currency,
});

describe('payBand', () => {
  it('reads percentiles of each posting midpoint in one currency', () => {
    const band = payBand(
      [
        row(1_000_000, 1_400_000), // 12 L
        row(1_400_000, 1_800_000), // 16 L
        row(2_000_000, null), // 20 L
        row(null, 2_400_000), // 24 L
        row(2_600_000, 3_000_000), // 28 L
        row(150_000, 160_000, 'USD'), // other currency: left out
      ],
      'INR',
    );
    expect(band).toEqual({ currency: 'INR', p25: 1_600_000, p50: 2_000_000, p75: 2_400_000, n: 5 });
  });

  it('drops hourly or monthly pay and refuses a sample that is too small', () => {
    const monthly = [row(50_000, 60_000), row(40_000, 45_000)];
    const annual = [row(1_200_000, 1_200_000), row(1_300_000, 1_300_000), row(1_500_000, 1_500_000)];
    expect(payBand([...monthly, ...annual], 'INR')).toBeNull();
    expect(payBand([row(45, 60, 'USD'), ...Array(5).fill(row(100_000, 120_000, 'USD'))], 'USD')?.n).toBe(5);
  });
});

describe('similar roles', () => {
  it('reads the core title words', () => {
    expect(roleWords('Senior Backend Engineer - Payments')).toEqual(['backend', 'engineer']);
    expect(roleWords('Full-Stack Lead (Remote, India)')).toEqual(['full', 'stack']);
    expect(roleWords('Machine Learning Engineer II, Search')).toEqual(['machine', 'learning', 'engineer']);
    expect(roleWords('C++ Developer')).toEqual(['c++', 'developer']);
    expect(roleWords('Intern')).toEqual([]);
  });

  it('reads the level a title signals', () => {
    expect(titleLevel('Software Engineer')).toBe('mid');
    expect(titleLevel('Senior Software Engineer')).toBe('senior');
    expect(titleLevel('Senior Staff Engineer')).toBe('lead');
    expect(titleLevel('Senior Engineering Manager')).toBe('manager');
    expect(titleLevel('Software Engineering Intern')).toBe('intern');
  });
});
