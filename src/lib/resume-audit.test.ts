import { describe, expect, it } from 'vitest';
import { auditResume } from './resume-audit';

const filler = (n: number) => Array(n).fill('word').join(' ');

describe('auditResume', () => {
  it('passes a resume with numbers, strong openers, contact and sections', () => {
    const audit = auditResume(
      [
        'Asha Rao · asha@example.com · +91 98765 43210 · linkedin.com/in/asha · github.com/asha',
        'EXPERIENCE',
        '- Built a RAG service serving 40k queries a day at 120 ms p95',
        '- Cut cloud spend 32% by moving batch jobs to spot instances',
        '- Led a team of 3 to ship the billing rewrite in 6 weeks',
        '- Designed the event pipeline behind search ranking',
        'EDUCATION',
        'B.Tech, Computer Science, 2023',
        'SKILLS',
        'Python, Go, Postgres',
        filler(320),
      ].join('\n'),
    );
    expect(audit.checks.filter((c) => !c.ok)).toEqual([]);
    expect(audit.score).toBe(100);
  });

  it('names what to fix on a weak resume', () => {
    const audit = auditResume(
      [
        'Asha Rao',
        '- Responsible for the backend of the app',
        '- Worked on many features as a hardworking team player',
        '- I helped my team with testing',
      ].join('\n'),
    );
    const failed = Object.fromEntries(audit.checks.filter((c) => !c.ok).map((c) => [c.label, c.detail]));
    expect(Object.keys(failed)).toEqual([
      'Numbers in your bullets',
      'Strong openers',
      'Easy to reach',
      'Sections an ATS can read',
      'Length',
      'No filler words',
    ]);
    expect(failed['Strong openers']).toContain('"Responsible for"');
    expect(failed['No filler words']).toContain('hardworking');
    expect(audit.score).toBe(10);
  });
});
