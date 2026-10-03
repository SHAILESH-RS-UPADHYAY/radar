import { describe, expect, it } from 'vitest';
import { MANUAL_DETAILS, onboardingResume } from './profile';

const saved = { resume_text: 'Backend engineer. Python, Postgres.', skills: ['Python', 'Postgres'] };

describe('onboardingResume: onboarding again never erases', () => {
  it('keeps the saved resume and skills when no new PDF or details came', () => {
    expect(onboardingResume(saved, { text: '', manual: '', skills: [] })).toEqual({
      resumeText: saved.resume_text,
      skills: ['Python', 'Postgres'],
    });
  });

  it('adds typed details to the saved resume, and skills only grow', () => {
    const r = onboardingResume(saved, { text: '', manual: 'SKILLS: Go\n', skills: ['Go'] });
    expect(r.resumeText).toBe(saved.resume_text + MANUAL_DETAILS + 'SKILLS: Go\n');
    expect(r.skills).toEqual(['Python', 'Postgres', 'Go']);
  });

  it('a new PDF replaces the resume text (typed details from before are dropped with it)', () => {
    const before = { resume_text: 'Old resume' + MANUAL_DETAILS + 'BIO: old\n', skills: [] };
    expect(onboardingResume(before, { text: 'New resume', manual: '', skills: [] }).resumeText).toBe('New resume');
  });

  it('a first onboarding saves what came', () => {
    expect(onboardingResume(null, { text: 'Resume', manual: '', skills: ['SQL'] })).toEqual({
      resumeText: 'Resume',
      skills: ['SQL'],
    });
  });
});
