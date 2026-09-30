import { describe, expect, it } from 'vitest';
import { cleanPortfolio, cleanUrl, isUuid, MAX_PROJECTS, MAX_RESUME_BYTES, resumeProblem } from './validate';

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
    expect(resumeProblem({ ...pdf, size: MAX_RESUME_BYTES + 1 })).toMatch(/4 MB/);
    expect(resumeProblem({ name: 'cv.docx', size: 1000, type: 'application/msword' })).toMatch(/PDF/);
  });
});

describe('cleanUrl / cleanPortfolio', () => {
  it('adds https:// to bare addresses and refuses what is not a web address', () => {
    expect(cleanUrl('github.com/asha')).toBe('https://github.com/asha');
    expect(cleanUrl(' https://asha.dev/ ')).toBe('https://asha.dev/');
    expect(cleanUrl('')).toBe('');
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
    expect(cleanUrl('not a link')).toBeNull();
  });
  it('keeps the four links and the built projects, named, capped and trimmed', () => {
    const out = cleanPortfolio({
      github: 'github.com/asha',
      linkedin: 'linkedin.com/in/asha',
      projects: [
        { name: ' Shop redesign ', url: 'shop.example.com', note: 'Rebuilt checkout in Next.js' },
        { name: '', url: 'blog.example.com' },
        { name: '', url: '' },
        ...Array.from({ length: 20 }, (_, i) => ({ name: 'p' + i, url: 'p' + i + '.dev' })),
      ],
    });
    if (typeof out === 'string') throw new Error(out);
    expect(out.github).toBe('https://github.com/asha');
    expect(out.portfolio).toBe('');
    expect(out.projects[0]).toEqual({
      name: 'Shop redesign',
      url: 'https://shop.example.com/',
      note: 'Rebuilt checkout in Next.js',
    });
    expect(out.projects[1].name).toBe('blog.example.com');
    expect(out.projects.length).toBeLessThanOrEqual(MAX_PROJECTS);
    expect(cleanPortfolio({ website: 'ftp://files' })).toMatch(/Website/);
  });
});
