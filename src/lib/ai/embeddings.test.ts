import { describe, expect, it } from 'vitest';
import { calibrate, JD_CHARS, JD_CHARS_V2, jobText } from './embeddings';

describe('calibrate', () => {
  it('keeps v1 similarities and maps v2 onto the v1 band', () => {
    expect(calibrate(0.5, 'v1')).toBe(0.5);
    expect(calibrate(0.59, 'v2')).toBeCloseTo(0.32);
    expect(calibrate(0.76, 'v2')).toBeCloseTo(0.64);
    expect(calibrate(0.675, 'v2')).toBeCloseTo(0.48);
  });
});

describe('jobText', () => {
  const job = { title: 'Engineer', company_name: 'Acme', skills: [], location: null, description: 'x'.repeat(10_000) };
  it('cuts the JD at 800 characters for v1 and 8,000 for v2', () => {
    expect(jobText(job).length).toBe('Engineer | Acme | '.length + JD_CHARS);
    expect(jobText(job, JD_CHARS_V2).length).toBe('Engineer | Acme | '.length + 8000);
  });
});
