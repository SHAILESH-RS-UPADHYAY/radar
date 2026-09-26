// Renders a tailored resume as a clean, single-column, ATS-readable PDF (real text, standard fonts).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { TailoredResume } from '@/lib/ai/tailor';

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = { x: 50, top: 48, bottom: 48 };
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.75, 0.75, 0.75);

// Characters outside WinAnsi (what the standard PDF fonts can encode) that have a sensible stand-in.
const SWAPS: Record<string, string> = { '₹': 'INR ', '→': '->', '←': '<-', '✓': '', '✔': '', '★': '*' };
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Keep only what the standard fonts can draw, so a stray emoji or symbol never breaks the render. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFKC')) {
    const c = SWAPS[ch] ?? ch;
    for (const d of c) {
      const code = d.charCodeAt(0);
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(d)) out += d;
      else if (d === '\t' || d === '\n') out += ' ';
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Greedy word wrap by measured width; words longer than a line are broken by character. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  for (const word of text.split(' ').filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (fits(word)) {
      line = word;
      continue;
    }
    line = '';
    for (const ch of word) {
      if (!fits(line + ch)) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderResumePdf(resume: TailoredResume): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(pdfSafe(resume.name + ' - Resume'));
  doc.setAuthor(pdfSafe(resume.name));
  doc.setCreator('RADAR');

  const contentWidth = PAGE.width - MARGIN.x * 2;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN.top;

  const ensure = (height: number) => {
    if (y - height >= MARGIN.bottom) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN.top;
  };
  const text = (s: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(s, { x, y, size, font, color });

  /** Wrapped paragraph; `indent` hangs every line after a bullet or prefix. */
  const paragraph = (
    raw: string,
    opts: { size?: number; font?: PDFFont; color?: typeof INK; indent?: number } = {},
  ) => {
    const { size = 9.5, font = regular, color = INK, indent = 0 } = opts;
    const lineHeight = size * 1.35;
    for (const line of wrap(pdfSafe(raw), font, size, contentWidth - indent)) {
      ensure(lineHeight);
      y -= lineHeight;
      text(line, MARGIN.x + indent, size, font, color);
    }
  };
  const bullet = (raw: string) => {
    const size = 9.5;
    const lineHeight = size * 1.35;
    wrap(pdfSafe(raw), regular, size, contentWidth - 12).forEach((line, i) => {
      ensure(lineHeight);
      y -= lineHeight;
      if (i === 0) text('•', MARGIN.x + 2, size);
      text(line, MARGIN.x + 12, size);
    });
  };
  const heading = (label: string) => {
    ensure(28);
    y -= 16;
    text(pdfSafe(label.toUpperCase()), MARGIN.x, 10.5, bold);
    y -= 5;
    page.drawLine({
      start: { x: MARGIN.x, y },
      end: { x: PAGE.width - MARGIN.x, y },
      thickness: 0.6,
      color: RULE,
    });
    y -= 2;
  };
  /** Bold left label with muted text right-aligned on the same line (e.g. role and dates). */
  const entry = (left: string, right: string) => {
    const size = 10;
    const leftSafe = pdfSafe(left);
    const rightSafe = pdfSafe(right);
    const rightWidth = rightSafe ? regular.widthOfTextAtSize(rightSafe, 9) : 0;
    const lines = wrap(leftSafe, bold, size, contentWidth - rightWidth - 12);
    lines.forEach((line, i) => {
      ensure(size * 1.4);
      y -= size * (i === 0 ? 1.6 : 1.35);
      text(line, MARGIN.x, size, bold);
      if (i === 0 && rightSafe) text(rightSafe, PAGE.width - MARGIN.x - rightWidth, 9, regular, MUTED);
    });
  };

  // Header
  y -= 20;
  text(pdfSafe(resume.name), MARGIN.x, 20, bold);
  if (resume.headline) paragraph(resume.headline, { size: 10.5, color: MUTED });
  if (resume.contact.length) paragraph(resume.contact.join('  |  '), { size: 9, color: MUTED });

  if (resume.summary) {
    heading('Summary');
    paragraph(resume.summary);
  }
  if (resume.skills.length) {
    heading('Skills');
    for (const group of resume.skills) paragraph(group.group + ': ' + group.items.join(', '));
  }
  if (resume.experience.length) {
    heading('Experience');
    for (const e of resume.experience) {
      entry([e.title, e.company].filter(Boolean).join(' - '), e.dates);
      if (e.location) paragraph(e.location, { size: 9, color: MUTED });
      e.bullets.forEach(bullet);
    }
  }
  if (resume.projects.length) {
    heading('Projects');
    for (const p of resume.projects) {
      entry(p.name, p.link);
      if (p.stack) paragraph(p.stack, { size: 9, color: MUTED });
      p.bullets.forEach(bullet);
    }
  }
  if (resume.education.length) {
    heading('Education');
    for (const e of resume.education) {
      entry([e.degree, e.school].filter(Boolean).join(' - '), e.dates);
      if (e.details) paragraph(e.details, { size: 9, color: MUTED });
    }
  }
  for (const extra of resume.extras) {
    if (!extra.items.length) continue;
    heading(extra.heading);
    extra.items.forEach(bullet);
  }

  return doc.save();
}
