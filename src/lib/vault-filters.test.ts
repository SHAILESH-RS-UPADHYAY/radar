import { describe, expect, it } from 'vitest';
import type { MatchedJob } from '@/components/dashboard/types';
import {
  DEFAULT_FILTERS,
  PRESETS,
  applyFilters,
  arrivalDay,
  capPerCompany,
  expBucket,
  filterCommand,
  isPreset,
  lanesOf,
  originOf,
  parseFilters,
  payLpa,
  presetFilters,
  signalFacets,
  statedExperience,
} from './vault-filters';

let n = 0;
function job(over: {
  category?: string;
  section?: string;
  provider?: string;
  exp?: string | null;
  pay?: [number | null, number | null, string | null];
  posted?: string | null;
  seen?: string | null;
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
    first_seen_at: over.seen ?? null,
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

describe('applyFilters and signalFacets', () => {
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

  it('narrows by lane, experience, sources and pay together', () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, lane: 'startup' })).toHaveLength(2);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, lane: 'startup', exp: ['1'] })).toHaveLength(1);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sources: ['adzuna'] })).toHaveLength(1);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sources: ['adzuna', 'lever'] })).toHaveLength(2);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, pay: 'disclosed' })).toHaveLength(3);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, pay: 'lpa10' })).toHaveLength(1);
  });

  it('sorts by pay (INR first, then other disclosed pay) and by newest', () => {
    const byPay = applyFilters(list, { ...DEFAULT_FILTERS, sort: 'pay' });
    expect(byPay.map((m) => m.job.company.provider)).toEqual(['ashby', 'workday', 'adzuna', 'lever']);
    const newest = applyFilters(list, { ...DEFAULT_FILTERS, sort: 'newest' });
    expect(newest[0].job.company.provider).toBe('lever');
  });

  it('counts each menu without its own selection, and lists only sources that exist', () => {
    const f = signalFacets(list, { ...DEFAULT_FILTERS, lane: 'startup' });
    expect(f.lanes).toMatchObject({ all: 4, startup: 2, mnc: 1, board: 1, growth: 0 });
    expect(f.sources.map((s) => s.key).sort()).toEqual(['ashby', 'lever']);
    expect(f.origins).toMatchObject({ ats: 2, board: 0, alert: 0 });
    expect(f.exp).toMatchObject({ '1': 1, none: 1, '0': 0 });
  });
});

describe('when a job reached you', () => {
  const now = new Date(2026, 9, 10, 15, 0).getTime();
  const at = (daysAgo: number, hour = 9) => new Date(2026, 9, 10 - daysAgo, hour, 0).toISOString();

  it('counts calendar days in your timezone, a week or more as one bucket, and falls back to the posting date', () => {
    expect(arrivalDay(job({ seen: at(0, 0) }), now)).toBe(0);
    expect(arrivalDay(job({ seen: at(1, 23) }), now)).toBe(1);
    expect(arrivalDay(job({ seen: at(30) }), now)).toBe(7);
    expect(arrivalDay(job({ seen: null, posted: at(2) }), now)).toBe(2);
    expect(arrivalDay(job({ seen: null, posted: null }), now)).toBe(7);
  });

  it('filters and counts by arrival day, with the alerts of today as one preset', () => {
    const feed = [
      job({ provider: 'linkedin_email', seen: at(0) }),
      job({ provider: 'indeed_email', seen: at(1) }),
      job({ provider: 'greenhouse', seen: at(0) }),
    ];
    const todays = presetFilters(PRESETS[0], 'all');
    expect(applyFilters(feed, todays, {}, now).map((m) => m.job.company.provider)).toEqual(['linkedin_email']);
    expect(isPreset(todays, PRESETS[0])).toBe(true);
    expect(isPreset(DEFAULT_FILTERS, PRESETS[0])).toBe(false);
    const f = signalFacets(feed, { ...DEFAULT_FILTERS, days: [0] }, {}, now);
    expect(f.days.slice(0, 2)).toEqual([2, 1]);
    expect(f.origins).toMatchObject({ alert: 1, ats: 1 });
  });

  it('groups sources by where they reach RADAR', () => {
    expect(['linkedin_email', 'greenhouse', 'adzuna', 'custom'].map(originOf)).toEqual([
      'alert',
      'ats',
      'board',
      'yours',
    ]);
  });
});

describe('filterCommand and parseFilters', () => {
  it('prints the filters as a command and survives bad stored values', () => {
    expect(filterCommand(DEFAULT_FILTERS)).toBe('vault');
    expect(
      filterCommand({
        lane: 'startup',
        days: [0],
        exp: ['1', '5'],
        sources: ['ashby', 'linkedin_email'],
        pay: 'lpa10',
        sort: 'pay',
      }),
    ).toBe('vault --lane startup --since today --src ashby,linkedin.mail --exp 1,5+ --pay 10L+ --sort pay');
    expect(filterCommand({ ...DEFAULT_FILTERS, days: [2, 0, 1] }, 'discovery')).toBe('discovery --since 3d');
    expect(filterCommand({ ...DEFAULT_FILTERS, days: [3, 7] })).toBe('vault --day 3,7+');
    expect(parseFilters('{"lane":"nope","exp":["2","x"],"pay":"lpa5","days":[0,9]}')).toEqual({
      ...DEFAULT_FILTERS,
      days: [0],
      exp: ['2'],
      pay: 'lpa5',
    });
    // A single source saved by an older version becomes the source list.
    expect(parseFilters('{"source":"adzuna"}').sources).toEqual(['adzuna']);
    expect(parseFilters('not json')).toEqual(DEFAULT_FILTERS);
  });
});

describe('capPerCompany', () => {
  const m = (id: string, company: string, score: number) => ({ id, company, score });
  it('keeps the best roles of each company up to its share, fewer after applications, none after two', () => {
    const list = [
      m('e1', 'elevenlabs', 99),
      m('e2', 'elevenlabs', 98),
      m('e3', 'elevenlabs', 97),
      m('s1', 'sarvam', 80),
    ];
    const free = capPerCompany(list, new Map());
    expect(free.kept.map((x) => x.id)).toEqual(['e1', 'e2', 's1']);
    expect(free.hidden.get('elevenlabs')).toBe(1);
    expect(capPerCompany(list, new Map([['elevenlabs', 1]])).kept.map((x) => x.id)).toEqual(['e1', 's1']);
    const done = capPerCompany(list, new Map([['elevenlabs', 2]]));
    expect(done.kept.map((x) => x.id)).toEqual(['s1']);
    expect(done.hidden.get('elevenlabs')).toBe(3);
  });
});
