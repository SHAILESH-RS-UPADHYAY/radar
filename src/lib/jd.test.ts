import { describe, expect, it } from 'vitest';
import { formatDescription, headerLines, jdLines, sectionLine } from './jd';

describe('formatDescription', () => {
  it('turns the escaped HTML older scrapes stored into paragraphs, headings and bullets', () => {
    expect(
      formatDescription(
        '&lt;h2&gt;&lt;strong&gt;Who we are&lt;/strong&gt;&lt;/h2&gt; &lt;p&gt;We build payments.&lt;/p&gt; &lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;li&gt;Kafka&lt;/li&gt;&lt;/ul&gt;',
      ),
    ).toBe('Who we are\n\nWe build payments.\n\n• Go\n• Kafka');
  });

  it('splits a description flattened onto one line back into its sections', () => {
    const flat =
      "About the Team The Communications team shapes the story of the company. It works with leadership on every launch. What you'll do Lead media relations across India. Own the press calendar and every announcement.";
    expect(formatDescription(flat)).toBe(
      "About the Team\nThe Communications team shapes the story of the company. It works with leadership on every launch.\n\nWhat you'll do\nLead media relations across India. Own the press calendar and every announcement.",
    );
  });

  it('gives single-spaced prose paragraph breaks, but keeps bullets together', () => {
    expect(formatDescription('First paragraph ends here.\nSecond one too.\n• one\n• two')).toBe(
      'First paragraph ends here.\n\nSecond one too.\n• one\n• two',
    );
  });
});

const JD = `About the role
We are building the payments platform on Postgres.

Requirements:
• 3+ years with TypeScript and Node.js
• Experience running Kubernetes in production
• Python and Kubernetes both
- Go-to-market experience is a plus
Salary: €70k – €90k. Apply at https://acme.io/jobs
`;

describe('jdLines', () => {
  const lines = jdLines(JD, ['typescript', 'node.js', 'python'], ['kubernetes', 'go'], { years: 2 });
  const text = (i: number) => lines[i].segs.map((s) => s.text).join('');
  const marked = (i: number) => lines[i].segs.filter((s) => s.hl).map((s) => s.text);

  it('keeps sections and paragraphs', () => {
    expect(lines.map((l) => l.kind)).toEqual([
      'head',
      'text',
      'blank',
      'head',
      'bullet',
      'bullet',
      'bullet',
      'bullet',
      'text',
    ]);
    expect(text(0)).toBe('## About the role');
    expect(text(3)).toBe('## Requirements');
  });

  it('bands lines red when they ask for something you lack (skills or years), green only when you have it all', () => {
    // 3+ years asked, you have 2: a gap even though you know TypeScript and Node.js.
    // What you have keeps its (green) box on a red line.
    expect(lines[4].mark).toBe('-');
    expect(marked(4)).toEqual(['3+ years', 'TypeScript', 'Node.js']);
    expect(lines[5].mark).toBe('-');
    expect(marked(5)).toEqual(['Kubernetes']);
    expect(lines[6].mark).toBe('-');
    expect(marked(6)).toEqual(['Python', 'Kubernetes']);
    // "Go-to-market" is not the Go language: a plain bullet, so the blue band.
    expect(lines[7].mark).toBe('~');
    expect(lines[7].segs.some((s) => s.tone === 'gap')).toBe(false);
    // A paragraph carrying a detail (tech here) gets the blue band too.
    expect(lines[1].mark).toBe('~');
    const enough = jdLines('• 3+ years with TypeScript', ['typescript'], [], { years: 5 });
    expect(enough[0].mark).toBe('+');
    expect(enough[0].segs.filter((s) => s.hl).map((s) => s.text)).toEqual(['3+ years', 'TypeScript']);
  });

  it('keeps plain paragraphs white, and a blank line inside a block of one colour banded', () => {
    const plain = jdLines('We are a small team that loves shipping.', [], []);
    expect(plain[0].mark).toBeNull();
    expect(plain[0].segs.every((s) => s.tone === 'plain')).toBe(true);
    const block = jdLines('• Use Python daily\n\n• Write Python tests', ['python'], []);
    expect(block.map((l) => l.mark)).toEqual(['+', '+', '+']);
  });

  it('syntax-colours banded lines like code in a diff', () => {
    const tones = (i: number) => lines[i].segs.filter((s) => s.tone !== 'plain').map((s) => [s.text, s.tone]);
    expect(tones(5)).toEqual([
      ['• ', 'kw'],
      ['Experience', 'bold'],
      ['running', 'verb'],
      ['Kubernetes', 'gap'],
      ['in', 'conj'],
    ]);
    expect(tones(1)).toEqual([
      ['building', 'verb'],
      ['on', 'conj'],
      ['Postgres', 'tech'],
    ]);
    // "Salary:" is a key, like a property in code.
    expect(tones(8)).toEqual([
      ['Salary', 'fn'],
      ['€70k – €90k', 'str'],
      ['Apply', 'verb'],
      ['at', 'conj'],
      ['https://acme.io/jobs', 'link'],
    ]);
    // A capital mid-sentence is a name; the one opening the sentence is not.
    const names = jdLines('• Travel to Berlin twice a year.', [], [])[0].segs;
    expect(names.filter((s) => s.tone === 'name').map((s) => s.text)).toEqual(['Berlin']);
  });
});

describe('headerLines / sectionLine', () => {
  it('writes the facts as code, with gaps (red) and strengths (green) as a diff pair', () => {
    const lines = headerLines({
      title: 'Backend Engineer',
      company: 'Pleo',
      companyNote: 'Series C',
      where: 'London · HYBRID',
      pay: null,
      score: 86,
      have: ['python', 'react'],
      missing: ['kubernetes'],
      posting: 'CLOSED',
      postingNote: 'taken down',
    });
    const render = lines.map((l) => (l.mark ?? ' ') + l.segs.map((s) => s.text).join(''));
    expect(render).toEqual([
      ' const job = {',
      '   title: "Backend Engineer",',
      '   company: "Pleo",  // Series C',
      '   where: "London · HYBRID",',
      '   match: 86,',
      '-  gaps: ["kubernetes"],',
      '+  yours: ["python", "react"],',
      '-  posting: "CLOSED",  // taken down',
      ' };',
    ]);
    expect(lines[0].segs[0]).toEqual({ text: 'const', tone: 'decl' });
    expect(sectionLine('Read briefing.md', '(+3 -2)').segs).toEqual([
      { text: 'Read briefing.md', tone: 'plain' },
      { text: ' (+3 -2)', tone: 'dim' },
    ]);
  });
});
