import { describe, expect, it } from 'vitest';
import {
  cleanAutopilot,
  DEFAULT_AUTOPILOT,
  notEligible,
  pickQueue,
  runDate,
  supplyByCity,
  type PickOptions,
  type QueueCandidate,
} from './autopilot';

const job = (over: Partial<QueueCandidate>): QueueCandidate => ({
  matchId: over.matchId || 'm' + Math.random(),
  jobId: 'j',
  score: 90,
  status: 'saved',
  title: 'Backend Engineer',
  company: 'Acme',
  location: 'Pune, India',
  workType: null,
  experience: '1-3',
  provider: 'greenhouse',
  postedAt: new Date().toISOString(),
  isActive: true,
  tailored: false,
  ...over,
});
const opts: PickOptions = { settings: DEFAULT_AUTOPILOT, cities: ['Pune'], bar: 80, years: 1, applied: [], limit: 50 };

describe('notEligible', () => {
  it('lets a strong, open, local, account-free match through', () => {
    expect(notEligible(job({}), opts)).toBeNull();
  });
  it('says why everything else stays out', () => {
    expect(notEligible(job({ isActive: false }), opts)).toBe('posting closed');
    expect(notEligible(job({ status: 'applied' }), opts)).toBe('already handled');
    expect(notEligible(job({ location: 'Mumbai' }), opts)).toBe('outside your cities');
    expect(notEligible(job({ location: 'Remote', workType: 'remote' }), opts)).toBe('outside your cities');
    expect(notEligible(job({ provider: 'workday' }), opts)).toBe('needs an account');
    expect(notEligible(job({ experience: '5+' }), opts)).toBe('too senior');
    expect(notEligible(job({ score: 70 }), opts)).toBe('below your bar');
    expect(
      notEligible(job({ title: 'Backend  Engineer!' }), {
        ...opts,
        applied: [{ company: 'acme', title: 'Backend Engineer' }],
      }),
    ).toBe('applied in the last 60 days');
  });
  it('takes a 50–79 match when OVERCLOCK already tailored a resume for it', () => {
    expect(notEligible(job({ score: 70, tailored: true }), opts)).toBeNull();
    expect(notEligible(job({ score: 45, tailored: true }), opts)).toBe('below your bar');
  });
  it('remote roles only when you allow them', () => {
    const remote = { ...opts, settings: { ...DEFAULT_AUTOPILOT, remote: true } };
    expect(notEligible(job({ location: 'Remote', workType: 'remote' }), remote)).toBeNull();
  });
});

describe('pickQueue', () => {
  it('ranks by score, keeps one per company + title and at most perCompany per company', () => {
    const picks = pickQueue(
      [
        job({ matchId: 'a', company: 'Acme', title: 'Backend Engineer', score: 85 }),
        job({ matchId: 'b', company: 'Acme', title: 'Backend Engineer', score: 95 }),
        job({ matchId: 'c', company: 'Acme', title: 'Data Engineer', score: 90 }),
        job({ matchId: 'd', company: 'Acme', title: 'ML Engineer', score: 88 }),
        job({ matchId: 'e', company: 'Globex', title: 'Backend Engineer', score: 82 }),
        job({ matchId: 'f', company: 'Initech', provider: 'amazon', score: 99 }),
      ],
      opts,
    );
    expect(picks.map((p) => p.matchId)).toEqual(['b', 'c', 'e']);
  });
  it('stops at the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => job({ company: 'Co' + i, score: 80 + i }));
    expect(pickQueue(many, { ...opts, limit: 3 }).map((p) => p.company)).toEqual(['Co9', 'Co8', 'Co7']);
  });
});

describe('supplyByCity', () => {
  it('counts eligible jobs per city, today and this week', () => {
    const now = Date.parse('2026-10-03T12:00:00Z');
    const s = supplyByCity(
      [
        job({ postedAt: '2026-10-03T06:00:00Z' }),
        job({ postedAt: '2026-09-29T06:00:00Z' }),
        job({ postedAt: '2026-08-01T06:00:00Z' }),
        job({ location: 'Mumbai' }),
      ],
      opts,
      now,
    );
    expect(s).toEqual({ Pune: { open: 3, today: 1, week: 2 } });
  });
});

describe('cleanAutopilot', () => {
  it('fills defaults, clamps numbers and drops what it does not know', () => {
    expect(cleanAutopilot(null)).toEqual(DEFAULT_AUTOPILOT);
    const s = cleanAutopilot({
      target: 500,
      concurrency: 9,
      schedule: '25:00',
      consents: ['privacy', 'arbitration'],
      cities: [' Pune ', 'Pune', 7],
      dryRun: false,
      evil: true,
    });
    expect(s).toMatchObject({
      target: 50,
      concurrency: 3,
      schedule: '10:00',
      consents: ['privacy'],
      cities: ['Pune'],
      dryRun: false,
    });
    expect('evil' in s).toBe(false);
  });
  it('starts live (the 5 s countdown in the tab is the last word)', () => {
    expect(DEFAULT_AUTOPILOT.dryRun).toBe(false);
  });
});

describe('runDate', () => {
  it('uses the day in India', () => {
    expect(runDate(new Date('2026-10-02T20:00:00Z'))).toBe('2026-10-03');
    expect(runDate(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-03');
  });
});
