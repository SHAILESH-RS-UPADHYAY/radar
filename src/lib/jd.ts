// ============================
// RADAR — Job description → terminal lines
// ============================
// The JD terminal prints a job the way a colour terminal prints a code diff: "⎿" section lines, a numbered
// `const job = {…}` block, then the description paragraph by paragraph, section by section.
// Diff bands carry meaning: red (−) = the line asks for something you do not have yet (a skill, or more
// years than you have), green (+) = it asks only for things you have. The words that decide it get a
// brighter box, like the changed characters in a real diff. Pure; the modal only animates.

import { decodeEntities, htmlToText, SKILL_ALIASES } from '@/lib/scraper/utils';

export type Tone =
  | 'plain'
  | 'bold'
  | 'dim'
  | 'kw'
  | 'decl'
  | 'fn'
  | 'str'
  | 'num'
  | 'req'
  | 'comment'
  | 'head'
  | 'have'
  | 'gap'
  | 'tech'
  | 'link'
  | 'conj'
  | 'verb'
  | 'name';
export interface Seg {
  text: string;
  tone: Tone;
  /** Brighter background inside a band: the words that earned the line its colour. */
  hl?: boolean;
}
/** '+' asks only for what you have, '-' asks for something you lack, '~' a posting detail that touches neither. */
export type Mark = '+' | '-' | '~' | null;
export interface TermLine {
  /** 'section' lines ("⎿ …") sit outside the numbered gutter. */
  kind: 'section' | 'code' | 'head' | 'bullet' | 'text' | 'blank';
  mark: Mark;
  segs: Seg[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BULLET = /^(?:[•·▪◦‣∙*–—-]|\d{1,2}[.)])\s+/;

// ---- 1. Shape: stored descriptions come in three forms; all leave here as paragraphs, headings, bullets.

const SECTION_NAMES =
  "about (?:the |this )?(?:team|role|company|job|position|opportunity)|about (?:us|you)|the (?:role|team|opportunity)|your (?:role|team|mission)|role overview|overview|what you(?:'|’)ll (?:do|bring|need|get|work on)|what you will (?:do|bring|need|get)|what (?:we(?:'|’)re|we are) looking for|what we offer|what you(?:'|’)ll get|who you are|(?:key |your )?responsibilities|(?:minimum |basic |key |job )?requirements|(?:minimum |basic |preferred |key )?qualifications|nice[- ]to[- ]haves?|bonus points|(?:our )?benefits|perks(?: (?:and|&) benefits)?|compensation(?: (?:and|&) benefits)?|why (?:join )?us|how to apply|(?:our )?tech stack|skills";
// A section name glued into flattened text: "…governance. What you'll do Lead the…" (checked for a capital after).
const SECTION_IN_TEXT = new RegExp('(^|[.!?:]\\s+)(' + SECTION_NAMES + '):?\\s+', 'gi');
const SECTION_LINE = new RegExp('^(' + SECTION_NAMES + ')\\b', 'i');

/** Every ~3 sentences of an over-long paragraph become their own paragraph. */
function splitLongParagraph(p: string): string {
  if (p.length < 600 || BULLET.test(p)) return p;
  const sentences = p.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join(' '));
  return out.join('\n\n');
}

/**
 * Any stored description → readable text. HTML (older scrapes kept Greenhouse's escaped HTML) goes through the
 * structure-keeping converter; a description flattened onto one line is split back into its sections and
 * bullets; single-spaced lines get paragraph breaks where a sentence ends.
 */
export function formatDescription(raw: string): string {
  let text = (raw || '').trim();
  if (!text) return '';
  if (/&lt;\/?[a-z]|<\/?(p|br|li|ul|ol|h[1-6]|div|strong)\b/i.test(text)) text = htmlToText(text);
  else if (/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text)) text = decodeEntities(text);
  if (!text.includes('\n') && text.length > 120) {
    text = text
      .replace(/\s+[•·▪]\s+/g, '\n• ')
      .replace(SECTION_IN_TEXT, (m, lead: string, name: string, offset: number, all: string) =>
        /[A-Z•]/.test(all[offset + m.length] || '') ? lead.trimEnd() + '\n\n' + name + '\n' : m,
      );
  }
  const lines = text.split('\n').map((l) => l.trim());
  const out: string[] = [];
  lines.forEach((line, i) => {
    out.push(splitLongParagraph(line));
    const next = lines[i + 1];
    // A finished sentence followed by more prose is the end of a paragraph.
    if (line && next && !BULLET.test(next) && /[.!?)]$/.test(line)) out.push('');
  });
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- 2. Colour: words coloured like code.

type Hit = { start: number; end: number; tone: Tone; years?: number };

const YEARS = /\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b/gi;
const MONEY =
  /[$€£₹]\s?\d[\d,.]*\s?(?:[kKmM]|L\b)?(?:\s?(?:-|–|to)\s?[$€£₹]?\s?\d[\d,.]*\s?(?:[kKmM]|L\b)?)?|\b\d[\d,.]*\s?[kK]?\s?(?:USD|EUR|GBP|INR|LPA)\b/g;
const URL_RE = /https?:\/\/[^\s)]+/g;
const QUOTED = /"[^"\n]{1,80}"|“[^”\n]{1,80}”/g;
const NUMBER = /\b\d+(?:[.,]\d+)?(?:%|x|k|K|M|ms|s)?\b/g;
const REQUIREMENT =
  /\b(must|required|requirement|mandatory|preferred|ideally|nice to have|a plus|bonus|strong|proven|excellent)\b/gi;

// Same word boundaries as extractSkills: "go" never lights up inside "google" or "Go-to-market".
const wordPattern = (words: string[]) =>
  new RegExp(
    '(^|[^a-z0-9+#.])(' +
      [...words]
        .sort((a, b) => b.length - a.length)
        .map(escapeRe)
        .join('|') +
      ')(?![a-z0-9+#]|-to-| to market)',
    'gi',
  );

/** Every spelling of every known skill, and which tone it gets for this reader. */
function skillPattern(have: string[], missing: string[]) {
  const tones = new Map<string, Tone>();
  const add = (skill: string, tone: Tone) => {
    const canonical = skill.trim().toLowerCase();
    for (const alias of SKILL_ALIASES[canonical] || [canonical])
      if (alias && !tones.has(alias.toLowerCase())) tones.set(alias.toLowerCase(), tone);
  };
  have.forEach((s) => add(s, 'have'));
  missing.forEach((s) => add(s, 'gap'));
  for (const canonical of Object.keys(SKILL_ALIASES)) add(canonical, 'tech');
  return { re: wordPattern([...tones.keys()]), tones };
}
type SkillPattern = ReturnType<typeof skillPattern>;

/**
 * One line of text → coloured segments. `yearsHave` turns "3+ years" into a verdict: 'have' when you have
 * that much experience, 'gap' when you do not. Earlier patterns win where two overlap.
 */
export function highlight(
  text: string,
  skills: SkillPattern,
  yearsHave: number | null = null,
  company: RegExp | null = null,
): Seg[] {
  const hits: Hit[] = [];
  if (company)
    for (const m of text.matchAll(company)) hits.push({ start: m.index!, end: m.index! + m[0].length, tone: 'str' });
  for (const m of text.matchAll(skills.re)) {
    const start = m.index! + m[1].length;
    hits.push({ start, end: start + m[2].length, tone: skills.tones.get(m[2].toLowerCase()) || 'tech' });
  }
  for (const m of text.matchAll(YEARS)) {
    const needed = Number(m[1]);
    const tone: Tone = yearsHave === null ? 'num' : yearsHave >= needed ? 'have' : 'gap';
    hits.push({ start: m.index!, end: m.index! + m[0].length, tone });
  }
  for (const [re, tone] of [
    [URL_RE, 'link'],
    [MONEY, 'str'],
    [QUOTED, 'str'],
    [NUMBER, 'num'],
    [REQUIREMENT, 'req'],
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

// On a banded line the prose is syntax-coloured like code in a diff: connectors are keywords (pink), verbs are
// calls (green), names mid-sentence are literals (yellow), a "Key:" is a property (green); the rest stays white.
// Unbanded lines stay white.
const CONNECTORS = new Set(
  'and or with without for to in into on of at by from via per across within through as than if when while where not no'.split(
    ' ',
  ),
);
const VERBS = new Set(
  'build design develop own lead drive work collaborate ship maintain create implement deploy scale improve write test debug partner mentor define deliver manage support ensure help join grow learn use apply optimize optimise architect analyze analyse research operate monitor integrate automate contribute communicate review solve launch evolve shape turn make bring take run serve handle champion influence identify prototype experiment iterate measure translate coordinate execute plan prioritize prioritise document troubleshoot investigate evaluate validate craft enable empower expand streamline establish oversee hire train coach present report track respond resolve refactor migrate secure protect understand thrive enjoy travel simplify strengthen reduce increase accelerate adopt advocate align assess assist benchmark configure consult demonstrate detect diagnose engage enhance facilitate foster gather guide leverage modernize negotiate onboard organize participate perform pioneer produce promote provide publish recommend refine represent scope share spearhead standardize supervise sustain tackle teach transform unblock upgrade utilize led built wrote ran grew made took brought'.split(
    ' ',
  ),
);

// Bullets that open with one of these are requirements ("Experience with…", "Strong…"), banded like actions.
const ASKS = new Set(
  "experience experienced knowledge familiarity understanding ability proficiency proficient expertise background degree bachelor’s bachelor's master’s master's solid deep hands-on strong excellent proven".split(
    ' ',
  ),
);

function isVerb(w: string): boolean {
  if (VERBS.has(w)) return true;
  for (const [end, add] of [
    ['s', ''],
    ['es', ''],
    ['d', ''],
    ['ed', ''],
    ['ing', ''],
    ['ing', 'e'],
  ] as const)
    if (w.endsWith(end) && VERBS.has(w.slice(0, -end.length) + add)) return true;
  const doubled = w.match(/^(.*?)([b-df-hj-np-tv-z])\2(?:ing|ed)$/); // shipping, planned
  return !!doubled && VERBS.has(doubled[1] + doubled[2]);
}

/** Plain words → code-like classes; spaces and punctuation stay plain. `start`: the text opens a sentence. */
function prose(text: string, start: boolean): Seg[] {
  const segs: Seg[] = [];
  const push = (t: string, tone: Tone) => {
    const last = segs[segs.length - 1];
    if (last?.tone === tone) last.text += t;
    else segs.push({ text: t, tone });
  };
  let sentenceStart = start;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*|[^A-Za-z]+/g)) {
    const t = m[0];
    if (!/^[A-Za-z]/.test(t)) {
      push(t, 'plain');
      if (/[.!?]/.test(t)) sentenceStart = true;
      continue;
    }
    const w = t.toLowerCase();
    push(
      t,
      text[m.index + t.length] === ':'
        ? 'fn'
        : CONNECTORS.has(w)
          ? 'conj'
          : isVerb(w)
            ? 'verb'
            : t.length > 1 && /^[A-Z]/.test(t) && !sentenceStart
              ? 'name'
              : 'plain',
    );
    sentenceStart = false;
  }
  return segs;
}

/** A short line that stands alone and ends without punctuation reads as a section title. */
function isHeading(t: string, prevBlank: boolean, next: string | undefined): boolean {
  if (t.length > 70 || BULLET.test(t)) return false;
  const words = t.split(' ').length;
  if (t.endsWith(':') && words <= 8) return true;
  if (SECTION_LINE.test(t) && words <= 8 && !/[.!?]$/.test(t)) return true;
  if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && words <= 6) return true;
  return prevBlank && !!next && words <= 7 && !/[.!?,;:)]$/.test(t) && /^[A-Z]/.test(t);
}

/** The description as terminal lines: sections, paragraphs and bullets, marked against your profile. */
export function jdLines(
  description: string,
  have: string[],
  missing: string[],
  { years = null, company = null }: { years?: number | null; company?: string | null } = {},
): TermLine[] {
  const skills = skillPattern(have, missing);
  const companyRe =
    company && company.trim().length > 1 ? new RegExp('\\b' + escapeRe(company.trim()) + '\\b', 'g') : null;
  const source = formatDescription(description).split('\n');
  // The next line with text, so a heading can be recognised across the blank line under it.
  const nextText = (i: number) =>
    source
      .slice(i + 1)
      .find((l) => l.trim())
      ?.trim();
  const out: TermLine[] = [];
  const blank = (): TermLine => ({ kind: 'blank', mark: null, segs: [] });

  source.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    const prevBlank = i === 0 || !source[i - 1].trim();
    if (!text) {
      // One blank line between blocks, none straight under a heading.
      const last = out[out.length - 1];
      if (last && last.kind !== 'blank' && last.kind !== 'head') out.push(blank());
      return;
    }
    if (isHeading(text, prevBlank, nextText(i))) {
      // A blank line before a new section, but not between a heading and its sub-heading.
      const last = out[out.length - 1];
      if (last && last.kind !== 'blank' && last.kind !== 'head') out.push(blank());
      out.push({
        kind: 'head',
        mark: null,
        segs: [
          { text: '## ', tone: 'kw' },
          { text: text.replace(/:$/, ''), tone: 'head' },
        ],
      });
      return;
    }
    const bullet = BULLET.test(text);
    const segs = highlight(bullet ? text.replace(BULLET, '') : text, skills, years, companyRe);
    // A bullet's first word is its verb ("Build", "Own"): bold, like a function name.
    if (bullet && segs[0]?.tone === 'plain') {
      const m = segs[0].text.match(/^([A-Za-z][\w'’-]*)([\s\S]*)$/);
      if (m) segs.splice(0, 1, { text: m[1], tone: 'bold' }, ...(m[2] ? [{ text: m[2], tone: 'plain' as Tone }] : []));
    }
    // A gap anywhere makes the line red: what you still need is what matters most. Every word you have
    // keeps its green box, even on a red line. A line carrying a detail (tech, a number, pay, a link, a
    // "must") or a bullet that is an action ("Build…") gets the blue band: about 70% of a real briefing
    // ends up banded, while short perks and plain prose stay white.
    const detail = segs.some(
      (s) => s.tone === 'tech' || s.tone === 'num' || s.tone === 'str' || s.tone === 'req' || s.tone === 'link',
    );
    const first = bullet && segs[0]?.tone === 'bold' ? segs[0].text.toLowerCase() : '';
    const action = !!first && (isVerb(first) || ASKS.has(first));
    const mark: Mark = segs.some((s) => s.tone === 'gap')
      ? '-'
      : segs.some((s) => s.tone === 'have')
        ? '+'
        : detail || action
          ? '~'
          : null;
    for (const s of segs) if (s.tone === 'gap' || s.tone === 'have') s.hl = true;
    const coloured = mark
      ? segs.flatMap((s, k) => (s.tone === 'plain' ? prose(s.text, k === 0 && !bullet) : [s]))
      : segs;
    out.push({
      kind: bullet ? 'bullet' : 'text',
      mark,
      segs: bullet ? [{ text: '• ', tone: 'kw' }, ...coloured] : coloured,
    });
  });
  while (out.length && out[out.length - 1].kind === 'blank') out.pop();
  // A blank line inside a block of one colour keeps the band, so blocks read as solid, like a real diff.
  out.forEach((l, i) => {
    if (l.kind === 'blank' && out[i - 1]?.mark && out[i - 1].mark === out[i + 1]?.mark) l.mark = out[i - 1].mark;
  });
  return out;
}

// ---- 3. The header block.

export interface JobFacts {
  title: string;
  company: string;
  /** e.g. "Series A · found on StartupMap" */
  companyNote: string | null;
  where: string;
  pay: string | null;
  score: number | null;
  /** Your skills the posting asks for, and the ones it asks for that you have not listed. */
  have: string[];
  missing: string[];
  posting: 'LIVE' | 'CLOSED' | 'UNVERIFIED';
  postingNote: string | null;
}

/** `const job = { … };` — the facts as code, with your gaps and strengths as a red / green diff pair. */
export function headerLines(f: JobFacts): TermLine[] {
  const str = (s: string, hl = false): Seg => ({ text: JSON.stringify(s), tone: 'str', ...(hl ? { hl } : {}) });
  const list = (items: string[]): Seg[] => [
    { text: '[', tone: 'plain' },
    ...items.flatMap((s, i) => [...(i ? [{ text: ', ', tone: 'plain' as Tone }] : []), str(s, true)]),
    { text: ']', tone: 'plain' },
  ];
  const field = (key: string, value: Seg[], comment?: string | null, mark: Mark = null): TermLine => ({
    kind: 'code',
    mark,
    segs: [
      { text: '  ' + key, tone: 'fn' },
      { text: ': ', tone: 'plain' },
      ...value,
      { text: ',', tone: 'plain' },
      ...(comment ? [{ text: '  // ' + comment, tone: 'comment' as Tone }] : []),
    ],
  });
  return [
    {
      kind: 'code',
      mark: null,
      segs: [
        { text: 'const', tone: 'decl' },
        { text: ' job ', tone: 'plain' },
        { text: '=', tone: 'kw' },
        { text: ' {', tone: 'plain' },
      ],
    },
    field('title', [str(f.title)]),
    field('company', [str(f.company)], f.companyNote),
    field('where', [str(f.where)]),
    ...(f.pay ? [field('pay', [str(f.pay)])] : []),
    ...(f.score === null ? [] : [field('match', [{ text: String(f.score), tone: 'num' }])]),
    ...(f.missing.length ? [field('gaps', list(f.missing), null, '-')] : []),
    ...(f.have.length ? [field('yours', list(f.have), null, '+')] : []),
    field('posting', [str(f.posting)], f.postingNote, f.posting === 'CLOSED' ? '-' : null),
    { kind: 'code', mark: null, segs: [{ text: '};', tone: 'plain' }] },
  ];
}

/** A "⎿ …" line: what the terminal just did, with optional grey detail. */
export const sectionLine = (text: string, detail?: string, tone: Tone = 'plain'): TermLine => ({
  kind: 'section',
  mark: null,
  segs: [{ text, tone }, ...(detail ? [{ text: ' ' + detail, tone: 'dim' as Tone }] : [])],
});
