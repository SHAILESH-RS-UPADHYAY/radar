import { describe, expect, it } from 'vitest';
import { headerLines, jdLines } from './jd';

const JD = `About the role
We are building the payments platform.

Requirements:
• 3+ years with TypeScript and Node.js
• Experience running Kubernetes in production
- Go-to-market experience is a plus
Salary: €70k – €90k. Apply at https://acme.io/jobs


`;

describe('jdLines', () => {
  const lines = jdLines(JD, ['typescript', 'node.js'], ['kubernetes', 'go']);
  const text = (i: number) => lines[i].segs.map((s) => s.text).join('');

  it('finds headings, bullets and blank lines, and trims the tail', () => {
    expect(lines.map((l) => l.kind)).toEqual(['head', 'text', 'blank', 'head', 'bullet', 'bullet', 'bullet', 'text']);
    expect(text(0)).toBe('## About the role');
    expect(text(3)).toBe('## Requirements');
    expect(text(4)).toBe('• 3+ years with TypeScript and Node.js');
  });

  it("marks lines with your skills '+' and lines with only gaps '-'", () => {
    expect(lines[4].mark).toBe('+');
    expect(lines[5].mark).toBe('-');
    // "Go-to-market" is not the Go language.
    expect(lines[6].mark).toBeNull();
    expect(lines[1].mark).toBeNull();
  });

  it('highlights skills, years, pay and links', () => {
    const tones = (i: number) => lines[i].segs.filter((s) => s.tone !== 'plain' && s.tone !== 'dim');
    expect(tones(4)).toEqual([
      { text: '3+ years', tone: 'num' },
      { text: 'TypeScript', tone: 'have' },
      { text: 'Node.js', tone: 'have' },
    ]);
    expect(tones(5)).toEqual([{ text: 'Kubernetes', tone: 'gap' }]);
    expect(tones(7)).toEqual([
      { text: '€70k – €90k', tone: 'str' },
      { text: 'https://acme.io/jobs', tone: 'link' },
    ]);
  });
});

describe('headerLines', () => {
  it('writes the facts as a code block and bands the verdicts', () => {
    const lines = headerLines({
      title: 'Backend Engineer',
      company: 'Pleo',
      companyNote: 'Series C · Fintech',
      where: 'London · HYBRID',
      pay: null,
      score: 86,
      matched: 5,
      gaps: 1,
      posting: 'CLOSED',
      postingNote: 'checked 2h ago',
    });
    const render = lines.map((l) => (l.mark ?? ' ') + l.segs.map((s) => s.text).join(''));
    expect(render).toEqual([
      ' const job = {',
      '   title: "Backend Engineer",',
      '   company: "Pleo",  // Series C · Fintech',
      '   where: "London · HYBRID",',
      '+  match: 86,  // 5 of your skills asked · 1 gap',
      '-  posting: "CLOSED",  // checked 2h ago',
      ' };',
      ' ',
    ]);
  });
});
