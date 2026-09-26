import { describe, expect, it } from 'vitest';
import { isUuid, MAX_RESUME_BYTES, resumeProblem } from './validate';

describe('isUuid', () => {
  it('accepts database ids and rejects anything else', () => {
    expect(isUuid('6147a43e-2767-4d19-9dd8-68eb8f917235')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe('resumeProblem', () => {
  const pdf = { name: 'cv.pdf', size: 1000, type: 'application/pdf' };
  it('accepts a PDF under the size limit, by type or by extension', () => {
    expect(resumeProblem(pdf)).toBeNull();
    expect(resumeProblem({ ...pdf, type: '' })).toBeNull();
  });
  it('explains empty, oversized and non-PDF files', () => {
    expect(resumeProblem({ ...pdf, size: 0 })).toMatch(/empty/);
    expect(resumeProblem({ ...pdf, size: MAX_RESUME_BYTES + 1 })).toMatch(/5 MB/);
    expect(resumeProblem({ name: 'cv.docx', size: 1000, type: 'application/msword' })).toMatch(/PDF/);
  });
});
