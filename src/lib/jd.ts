// ============================
// RADAR — Job description → terminal lines
// ============================
// The JD terminal draws a job like a code diff: a `const job = {…}` header, then the description line by line.
// A line that asks for a skill you have is marked '+' (green band); one that asks only for skills you lack is
// marked '-' (red band). Skill words, years and pay are highlighted. Pure, so the modal only animates.

import { SKILL_ALIASES } from '@/lib/scraper/utils';

export type Tone = 'plain' | 'dim' | 'kw' | 'type' | 'str' | 'num' | 'comment' | 'head' | 'have' | 'gap' | 'link';
export interface Seg {
  text: string;
  tone: Tone;
}
export type Mark = '+' | '-' | null;
export interface TermLine {
  kind: 'code' | 'head' | 'bullet' | 'text' | 'blank' | 'fold';
  mark: Mark;
  segs: Seg[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BULLET = /^(?:[•·▪◦‣∙*–—-]|\d{1,2}[.)])\s+/;
const KNOWN_HEADING =
  /^(about( (the|this) (role|job|team|company|position))?|about (us|you)|the role|your role|role overview|overview|(key )?responsibilities|what you('| wi)ll (do|bring|need|get|work on)|what we('| a)re looking for|what we offer|who you are|requirements|qualifications|(minimum|basic|preferred) qualifications|nice to have|bonus( points)?|skills|tech stack|our stack|benefits|perks|why (join )?us|how to apply|the team|you have|you will)\b/i;

function isHeading(t: string): boolean {
  if (t.length > 70 || BULLET.test(t)) return false;
  if (t.endsWith(':')) return true;
  const words = t.split(' ').length;
  if (KNOWN_HEADING.test(t) && !/[.!?]$/.test(t) && words <= 8) return true;
  return t === t.toUpperCase() && /[A-Z]{3}/.test(t) && words <= 6;
}

type Hit = { start: number; end: number; tone: Tone };

const YEARS = /\b\d{1,2}\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b/gi;
const MONEY =
  /[$€£₹]\s?\d[\d,.]*\s?(?:[kKmM]|L\b)?(?:\s?(?:-|–|to)\s?[$€£₹]?\s?\d[\d,.]*\s?(?:[kKmM]|L\b)?)?|\b\d[\d,.]*\s?[kK]?\s?(?:USD|EUR|GBP|INR|LPA)\b/g;
const URL_RE = /https?:\/\/[^\s)]+/g;

/** Builds the skill highlighter once per job: every spelling of your skills and your gaps. */
function skillPattern(have: string[], missing: string[]) {
  const tones = new Map<string, Tone>();
  const add = (skill: string, tone: Tone) => {
    const canonical = skill.trim().toLowerCase();
    for (const alias of SKILL_ALIASES[canonical] || [canonical])
      if (alias && !tones.has(alias.toLowerCase())) tones.set(alias.toLowerCase(), tone);
  };
  have.forEach((s) => add(s, 'have'));
  missing.forEach((s) => add(s, 'gap'));
  if (!tones.size) return null;
  const alternatives = [...tones.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|');
  // Same word boundaries as extractSkills: "go" never lights up inside "google" or "Go-to-market".
  return {
    re: new RegExp('(^|[^a-z0-9+#.])(' + alternatives + ')(?![a-z0-9+#]|-to-| to market)', 'gi'),
    tones,
  };
}

/** One line of text → highlighted segments. */
export function highlight(text: string, skills: ReturnType<typeof skillPattern>): Seg[] {
  const hits: Hit[] = [];
  if (skills)
    for (const m of text.matchAll(skills.re)) {
      const start = m.index! + m[1].length;
      hits.push({ start, end: start + m[2].length, tone: skills.tones.get(m[2].toLowerCase()) || 'plain' });
    }
  for (const [re, tone] of [
    [YEARS, 'num'],
    [MONEY, 'str'],
    [URL_RE, 'link'],
  ] as const)
    for (const m of text.matchAll(re)) hits.push({ start: m.index!, end: m.index! + m[0].length, tone });

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const segs: Seg[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at) continue; // overlaps an earlier highlight
    if (h.start > at) segs.push({ text: text.slice(at, h.start), tone: 'plain' });
    segs.push({ text: text.slice(h.start, h.end), tone: h.tone });
    at = h.end;
  }
  if (at < text.length) segs.push({ text: text.slice(at), tone: 'plain' });
  return segs;
}

/** The description as terminal lines, marked against your skills and gaps. */
export function jdLines(description: string, have: string[], missing: string[]): TermLine[] {
  const skills = skillPattern(have, missing);
  const out: TermLine[] = [];
  for (const raw of description.replace(/\r/g, '').split('\n')) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) {
      if (out.length && out[out.length - 1].kind !== 'blank') out.push({ kind: 'blank', mark: null, segs: [] });
      continue;
    }
    if (isHeading(text)) {
      out.push({
        kind: 'head',
        mark: null,
        segs: [
          { text: '## ', tone: 'dim' },
          { text: text.replace(/:$/, ''), tone: 'head' },
        ],
      });
      continue;
    }
    const bullet = BULLET.test(text);
    const segs = highlight(bullet ? text.replace(BULLET, '') : text, skills);
    const mark: Mark = segs.some((s) => s.tone === 'have') ? '+' : segs.some((s) => s.tone === 'gap') ? '-' : null;
    out.push({ kind: bullet ? 'bullet' : 'text', mark, segs: bullet ? [{ text: '• ', tone: 'dim' }, ...segs] : segs });
  }
  while (out.length && out[out.length - 1].kind === 'blank') out.pop();
  return out;
}

export interface JobFacts {
  title: string;
  company: string;
  /** e.g. "Series A · Fintech · via StartupMap" */
  companyNote: string | null;
  where: string;
  pay: string | null;
  score: number | null;
  matched: number;
  gaps: number;
  posting: 'LIVE' | 'CLOSED' | 'UNVERIFIED';
  postingNote: string | null;
}

/** `const job = { … };` — the facts, typed first, as the code the screenshot shows. */
export function headerLines(f: JobFacts): TermLine[] {
  const str = (s: string): Seg => ({ text: JSON.stringify(s), tone: 'str' });
  const field = (key: string, value: Seg, comment?: string | null, mark: Mark = null): TermLine => ({
    kind: 'code',
    mark,
    segs: [
      { text: '  ' + key, tone: 'type' },
      { text: ': ', tone: 'plain' },
      value,
      { text: ',', tone: 'plain' },
      ...(comment ? [{ text: '  // ' + comment, tone: 'comment' as Tone }] : []),
    ],
  });
  return [
    {
      kind: 'code',
      mark: null,
      segs: [
        { text: 'const ', tone: 'kw' },
        { text: 'job', tone: 'plain' },
        { text: ' = {', tone: 'plain' },
      ],
    },
    field('title', str(f.title)),
    field('company', str(f.company), f.companyNote),
    field('where', str(f.where)),
    ...(f.pay ? [field('pay', str(f.pay))] : []),
    ...(f.score === null
      ? []
      : [
          field(
            'match',
            { text: String(f.score), tone: 'num' },
            `${f.matched} of your skills asked · ${f.gaps} gap${f.gaps === 1 ? '' : 's'}`,
            f.score >= 80 ? '+' : f.score < 50 ? '-' : null,
          ),
        ]),
    field('posting', str(f.posting), f.postingNote, f.posting === 'LIVE' ? '+' : f.posting === 'CLOSED' ? '-' : null),
    { kind: 'code', mark: null, segs: [{ text: '};', tone: 'plain' }] },
    { kind: 'fold', mark: null, segs: [] },
  ];
}
