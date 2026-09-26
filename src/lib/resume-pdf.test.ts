import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { TailoredResume } from '@/lib/ai/tailor';
import { pdfSafe, renderResumePdf, wrap } from './resume-pdf';

const resume = (bullets = 3): TailoredResume => ({
  name: 'Asha Rao',
  headline: 'AI Engineer',
  contact: ['asha@example.com', 'Bengaluru', 'github.com/asha'],
  summary: 'Builds retrieval-augmented systems in Python.',
  skills: [{ group: 'AI/ML', items: ['Python', 'RAG', 'PyTorch'] }],
  experience: [
    {
      title: 'ML Engineer',
      company: 'Acme',
      location: 'Remote',
      dates: '2025 - now',
      bullets: Array.from(
        { length: bullets },
        (_, i) => `Shipped improvement number ${i + 1} to the ranking pipeline.`,
      ),
    },
  ],
  projects: [],
  education: [{ degree: 'B.Tech CSE', school: 'VIT', dates: '2021 - 2025', details: '' }],
  extras: [],
});

describe('pdfSafe', () => {
  it('keeps what standard fonts can draw and swaps or drops the rest', () => {
    expect(pdfSafe('Salary ₹12L → 18L 🚀 café • “ok”')).toBe('Salary INR 12L -> 18L café • “ok”');
  });
});

describe('wrap', () => {
  it('breaks lines by width, including words longer than a line', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrap('short words then https://example.com/' + 'x'.repeat(200), font, 10, 150);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(150);
  });
});

describe('renderResumePdf', () => {
  it('produces a real PDF and adds pages when the content runs long', async () => {
    const short = await renderResumePdf(resume());
    expect(new TextDecoder().decode(short.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(short)).getPageCount()).toBe(1);
    const long = await renderResumePdf(resume(120));
    expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(1);
  });
});
