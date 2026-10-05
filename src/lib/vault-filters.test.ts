import { describe, expect, it } from 'vitest';
import type { MatchedJob } from '@/components/dashboard/types';
import {
  DEFAULT_FILTERS,
  applyVaultFilters,
  expBucket,
  filterCommand,
  lanesOf,
  parseFilters,
  payLpa,
  statedExperience,
  vaultFacets,
} from './vault-filters';

let n = 0;
function job(over: {
  category?: string;
  section?: string;
  provider?: string;
  exp?: string | null;
  pay?: [number | null, number | null, string | null];
  posted?: string | null;
  score?: number;
}): MatchedJob {
  n += 1;
  const [salary_min, salary_max, salary_currency] = over.pay ?? [null, null, null];
  return {
    id: 'm' + n,
    score: over.score ?? 80,
    reasoning: '',
    matching_skills: [],
    missing_skills: [],
    section: over.section ?? 'recommended',
    status: 'saved',
    auto_saved: true,
    status_changed_at: null,
    first_seen_at: null,
    stage: null,
    stage_changed_at: null,
    applied_at: null,
    notes: null,
    resume_version_id: null,
    last_event: null,
    job: {
      id: 'j' + n,
      title: 'Engineer',
      location: 'Mohali',
      work_type: null,
      skills: [],
      apply_url: '',
      form_url: '',
      department: null,
      posted_at: over.posted ?? null,
      is_active: true,
      experience_required: over.exp ?? null,
      salary_min,
      salary_max,
      salary_currency,
      company: {
        name: 'Co' + n,
        source: null,
        category: over.category ?? 'Startup',
        provider: over.provider ?? 'ashby',
      },
    },
  };
}

describe('statedExperience', () => {
  it('keeps the exact years the JD states, tidied', () => {
    expect(statedExperience('Engineer', 'You have 3 to 5 years of experience', null)).toEqual({
      text: '3–5 yrs',
      min: 3,
    });
    expect(statedExperience('Engineer', '<li>2+ years with React</li>', '1-3')).toEqual({ text: '2+ yrs', min: 2 });
    expect(statedExperience('Engineer', 'at least 1 year building APIs', null)).toEqual({ text: '1 yr', min: 1 });
    expect(statedExperience('Engineer', '3-8+ Years in backend', null)).toEqual({ text: '3–8 yrs', min: 3 });
  });

  it('skips company history and falls back to the title, then the stored bucket', () => {
    expect(statedExperience('Engineer', 'Founded 25 years ago. Need 2 years Python.', null).min).toBe(2);
    expect(statedExperience('Software Intern', 'Great team', null)).toEqual({ text: 'Fresher', min: 0 });
    expect(statedExperience('Engineer', 'Great team', '0-1')).toEqual({ text: '0–1 yrs', min: 0 });
    expect(statedExperience('Engineer', 'Great team', null)).toEqual({ text: null, min: null });
  });
});

describe('lanes', () => {
  it('puts a dream startup in both DREAM and STARTUPS, and board jobs in JOB BOARDS', () => {
    expect(lanesOf(job({ section: 'dream', category: 'Startup' }))).toEqual(['dream', 'startup']);
    expect(lanesOf(job({ category: 'MNC' }))).toEqual(['mnc']);
    expect(lanesOf(job({ category: 'Board', provider: 'adzuna' }))).toEqual(['board']);
  });
});

describe('experience buckets', () => {
  it('uses the JD years when RADAR read them, else the stored bucket', () => {
    const m = job({ exp: '1-3' });
    expect(expBucket(m)).toBe('1');
    expect(expBucket(m, { text: '3 yrs', min: 3 })).toBe('3');
    expect(expBucket(m, { text: '8+ yrs', min: 8 })).toBe('5');
    expect(expBucket(job({ exp: null }))).toBe('none');
  });
});

describe('pay', () => {
  it('reads INR as lakhs per year and ignores other currencies for LPA floors', () => {
    expect(payLpa(job({ pay: [1_200_000, 1_800_000, 'INR'] }))).toBe(18);
    expect(payLpa(job({ pay: [120_000, 160_000, 'USD'] }))).toBeNull();
  });
});

describe('applyVaultFilters and vaultFacets', () => {
  const list = [
    job({
      category: 'Startup',
      provider: 'ashby',
      exp: '1-3',
      pay: [1_000_000, 1_500_000, 'INR'],
      posted: '2026-10-01',
    }),
    job({ category: 'Startup', provider: 'lever', exp: null, posted: '2026-10-04' }),
    job({ category: 'MNC', provider: 'workday', exp: 'fresher', pay: [400_000, 600_000, 'INR'] }),
    job({ category: 'Board', provider: 'adzuna', exp: '3-5', pay: [100_000, 140_000, 'USD'] }),
  ];

  it('narrows by lane, experience, source and pay together', () => {
    expect(applyVaultFilters(list, { ...DEFAULT_FILTERS, lane: 'startup' })).toHaveLength(2);
    expect(applyVaultFilters(list, { ...DEFAULT_FILTERS, lane: 'startup', exp: ['1'] })).toHaveLength(1);
    expect(applyVaultFilters(list, { ...DEFAULT_FILTERS, source: 'adzuna' })).toHaveLength(1);
    expect(applyVaultFilters(list, { ...DEFAULT_FILTERS, pay: 'disclosed' })).toHaveLength(3);
    expect(applyVaultFilters(list, { ...DEFAULT_FILTERS, pay: 'lpa10' })).toHaveLength(1);
  });

  it('sorts by pay (INR first, then other disclosed pay) and by newest', () => {
    const byPay = applyVaultFilters(list, { ...DEFAULT_FILTERS, sort: 'pay' });
    expect(byPay.map((m) => m.job.company.provider)).toEqual(['ashby', 'workday', 'adzuna', 'lever']);
    const newest = applyVaultFilters(list, { ...DEFAULT_FILTERS, sort: 'newest' });
    expect(newest[0].job.company.provider).toBe('lever');
  });

  it('counts each menu without its own selection, and lists only sources that exist', () => {
    const f = vaultFacets(list, { ...DEFAULT_FILTERS, lane: 'startup' });
    expect(f.lanes).toMatchObject({ all: 4, startup: 2, mnc: 1, board: 1, growth: 0 });
    expect(f.sources.map((s) => s.key).sort()).toEqual(['ashby', 'lever']);
    expect(f.exp).toMatchObject({ '1': 1, none: 1, '0': 0 });
  });
});

describe('filterCommand and parseFilters', () => {
  it('prints the filters as a command and survives bad stored values', () => {
    expect(filterCommand(DEFAULT_FILTERS)).toBe('vault');
    expect(filterCommand({ lane: 'startup', exp: ['1', '5'], source: 'ashby', pay: 'lpa10', sort: 'pay' })).toBe(
      'vault --lane startup --exp 1,5+ --src ashby --pay 10L+ --sort pay',
    );
    expect(parseFilters('{"lane":"nope","exp":["2","x"],"pay":"lpa5"}')).toEqual({
      ...DEFAULT_FILTERS,
      exp: ['2'],
      pay: 'lpa5',
    });
    expect(parseFilters('not json')).toEqual(DEFAULT_FILTERS);
  });
});
