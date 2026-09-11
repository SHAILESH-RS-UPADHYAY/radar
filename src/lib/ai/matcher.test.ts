import { describe, expect, it } from 'vitest';
import { computeMatchScore, vectorToScore, type MatchInput } from './matcher';

const base: MatchInput = {
  userSkills: ['React', 'TypeScript', 'node'],
  jobSkills: ['react', 'typescript', 'node.js', 'aws'],
  vectorSimilarity: 0.85,
  isDreamCompany: false,
  companyCategory: 'Growth',
  userIsFresher: true,
  userExperienceYears: 0,
  jobExperience: null,
};

describe('vectorToScore', () => {
  it('stretches the compressed e5 band onto 0–100 and clamps', () => {
    expect(vectorToScore(0.72)).toBe(0);
    expect(vectorToScore(0.88)).toBe(100);
    expect(vectorToScore(0.5)).toBe(0);
    expect(vectorToScore(0.99)).toBe(100);
    expect(vectorToScore(0.8)).toBeCloseTo(50);
  });
});

describe('computeMatchScore', () => {
  it('normalizes skill spellings before comparing', () => {
    const r = computeMatchScore(base);
    expect(r.matchingSkills).toEqual(['react', 'typescript', 'node.js']);
    expect(r.missingSkills).toEqual(['aws']);
  });

  it('penalizes senior roles for freshers', () => {
    const open = computeMatchScore(base).score;
    const senior = computeMatchScore({ ...base, jobExperience: '5+' });
    expect(senior.score).toBe(open - 30);
    expect(senior.reasoning).toContain('Senior role');
  });

  it('boosts entry-level roles for freshers', () => {
    expect(computeMatchScore({ ...base, jobExperience: 'fresher' }).score).toBe(computeMatchScore(base).score + 5);
  });

  it('applies location fit', () => {
    const cities = ['Bangalore'];
    const inCity = computeMatchScore({ ...base, userCities: cities, jobLocation: 'Bengaluru, Karnataka, IND' });
    const remote = computeMatchScore({ ...base, userCities: cities, jobLocation: 'Remote', jobWorkType: 'remote' });
    const elsewhere = computeMatchScore({ ...base, userCities: cities, jobLocation: 'Madrid, Spain' });
    const neutral = computeMatchScore(base).score;
    expect(inCity.score).toBe(neutral + 5);
    expect(inCity.reasoning).toContain('In Bangalore');
    expect(remote.score).toBe(neutral - 10);
    expect(elsewhere.score).toBe(neutral - 25);
  });

  it('treats Remote as a wanted location', () => {
    const r = computeMatchScore({ ...base, userCities: ['Remote'], jobLocation: 'Remote (Worldwide)' });
    expect(r.score).toBe(computeMatchScore(base).score + 3);
  });

  it('keeps the score within 0–100 and assigns sections', () => {
    expect(
      computeMatchScore({
        ...base,
        vectorSimilarity: 0.1,
        jobExperience: '5+',
        userCities: ['Pune'],
        jobLocation: 'Tokyo',
      }).score,
    ).toBe(0);
    expect(computeMatchScore({ ...base, isDreamCompany: true }).section).toBe('dream');
    expect(computeMatchScore({ ...base, companyCategory: 'Startup' }).section).toBe('startup');
    expect(computeMatchScore(base).section).toBe('recommended');
  });
});
