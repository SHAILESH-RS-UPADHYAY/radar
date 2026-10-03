// ============================
// RADAR — HUMANIZE: answers that read like you typed them
// ============================
// Every answer the AI drafts for a form goes through a loop before it reaches the form:
//   1. validate  RADAR's own checks plus a strict reviewer (the model you enabled, with fresh eyes: it sees only the
//                questions and the answers) hunt for anything machine-written: stock words, rule-of-three lists,
//                even rhythm, summary closers, dashes, formatting
//   2. fix       only the flagged answers are rewritten, from the reviewer's exact notes, keeping every fact
//   3. repeat    until the validator finds nothing (at most MAX_ROUNDS, within the time budget)
// Last, formatting tells (dashes, "!", lists, emojis) are scrubbed so none of them can ever reach the form.

import { z } from 'zod';
import { completeJson, unfence } from '@/lib/ai/tailor';

/** Words and phrases that give a text away as AI-written. Also the draft prompt's "never write" list. */
export const STOCK_PHRASES = [
  'thrilled',
  'passion',
  'delve',
  'tapestry',
  'testament',
  'unwavering',
  'leverage',
  'synergy',
  'cutting-edge',
  'seamless',
  'spearhead',
  'pivotal',
  'realm',
  'holistic',
  'embark',
  'journey',
  'elevate',
  'empower',
  'game-changer',
  'meticulous',
  'harness',
  'paramount',
  'furthermore',
  'moreover',
  'additionally',
  'in conclusion',
  'resonate',
  'showcase',
  'honed',
  'invaluable',
  'underscore',
  'ever-evolving',
  'fast-paced',
  'excited to',
  'eager to',
  'aligns perfectly',
  'perfect fit',
  'great fit',
  'deeply',
  'truly',
  'commitment to',
  'at the intersection of',
];
// A single word matches its usual forms (leverage → leveraged, leveraging; passion → passionate), never another
// word that starts the same (elevate does not catch "elevator"). A phrase matches as written.
const FORMS = '(?:e|es|ed|d|s|ing|ly|ate|ately)?';
const stem = (p: string) => (p.includes(' ') ? p : p.replace(/e$/, '') + FORMS).replace(/-/g, '[- ]?');
const STOCK = new RegExp(`\\b(${STOCK_PHRASES.map(stem).join('|')})\\b`, 'gi');

const TELLS: [RegExp, string][] = [
  [/[—–]/, 'a dash (— or –)'],
  [/!/, 'an exclamation mark'],
  [/\p{Extended_Pictographic}/u, 'an emoji'],
  [/^\s*([-*•]|\d+[.)])\s/m, 'list formatting'],
  [/\*\*|__|^#+\s/m, 'markdown'],
  [/;/, 'a semicolon'],
  [/\bnot only\b[^.]*\bbut also\b/i, '"not only … but also"'],
  [/^\s*(as an?\b|i am writing|i'?m writing|with (over|more than) \d+)/i, 'a stock opening'],
  [/^\s*(you('re| are)\b|your (team|company|mission|work|product)\b)/i, 'opens by addressing the company'],
  [/thank you for (considering|your consideration)|i look forward to/i, 'a stock closing'],
];

/** Everything in one answer that reads machine-written, by RADAR's own rules. Pure, for tests. */
export function aiTells(text: string): string[] {
  const found = TELLS.filter(([re]) => re.test(text)).map(([, what]) => what);
  for (const m of new Set((text.match(STOCK) || []).map((w) => w.toLowerCase()))) found.push(`stock wording "${m}"`);
  // People write short and long sentences; a machine keeps them even.
  const lengths = text
    .split(/(?<=[.?])\s+/)
    .map((s) => s.split(/\s+/).length)
    .filter((n) => n > 2);
  if (lengths.length >= 3) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length);
    if (sd / mean < 0.2) found.push('every sentence about the same length');
  }
  return found;
}

/** Formatting tells removed outright; the words are the loop's job. Pure, for tests. */
export function scrub(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, '.')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\s*([-*•]|\d+[.)])\s+/gm, '')
    .replace(/;\s+(\w)/g, (_, c: string) => '. ' + c.toUpperCase())
    .replace(/\s+([,.])/g, '$1')
    .replace(/([,.])\1+/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const VALIDATOR = `You review answers a candidate is about to submit on a job application, and you are strict: your job is to catch anything that would make a recruiter think an AI wrote it.

Look for: stock or inflated wording, generic praise of the company, rule-of-three lists, sentences that all have the same shape or length, hedging, a neat summary line at the end, over-polished or formal tone, phrases no one types into a form, buzzwords, dashes, exclamation marks, lists, markdown.

Do not nitpick. If a sharp recruiter would believe a person typed it in a couple of minutes, it is human: no issues. Otherwise quote the exact words or describe the exact pattern for each issue.

Reply with JSON only: {"reviews":[{"name":"<name>","human":true or false,"issues":["<exact words or pattern> - <why it reads as AI>"]}]}`;

const FIXER = `You rewrite job-application answers so they read like the candidate typed them, in their own voice.

Rules:
- Fix every issue listed for an answer. Keep every fact, number, name and claim; add none that the candidate's materials do not support.
- Answer the question asked, from the candidate's side. Never open by addressing the company ("You are building…").
- First person, plain words, contractions where natural. Mix short and longer sentences. One concrete detail beats three adjectives. No summary line at the end.
- A light, dry touch of humour is fine only where the question invites personality. Never on factual, legal, visa or salary questions.
- Keep the length the answer had (or shorter). No dashes, exclamation marks, semicolons, lists, markdown or emojis.

Reply with JSON only: {"answers":[{"name":"<name>","value":"<the rewritten answer>"}]}`;

const Review = z.object({
  reviews: z.array(z.object({ name: z.string(), human: z.boolean(), issues: z.array(z.string()).default([]) })),
});
const Rewrite = z.object({ answers: z.array(z.object({ name: z.string(), value: z.string() })) });

export const MAX_ROUNDS = 4;
/** What one validate + fix round may take on a slow model: no round starts without it. */
const ROUND_MS = 30_000;

export interface Draft {
  name: string;
  label: string;
  value: string;
}

export interface HumanizeReport {
  rounds: number;
  /** The validator's last word: nothing AI-like left. False when the rounds or the time ran out first. */
  clean: boolean;
  /** Answers rewritten, counted once per round. */
  fixed: number;
}

/** Validate → fix → validate… until the validator finds nothing AI-like. Returns the final answers by field name. */
export async function humanize(
  drafts: Draft[],
  opts: { context: string; deadline: number; complete?: typeof completeJson },
): Promise<{ values: Map<string, string>; report: HumanizeReport }> {
  const complete = opts.complete ?? completeJson;
  const values = new Map(drafts.map((d) => [d.name, d.value]));
  const question = new Map(drafts.map((d) => [d.name, d.label]));
  const report: HumanizeReport = { rounds: 0, clean: false, fixed: 0 };

  while (values.size && report.rounds < MAX_ROUNDS && Date.now() + ROUND_MS < opts.deadline) {
    report.rounds++;
    const answers = [...values].map(([name, answer]) => ({ name, question: question.get(name), answer }));

    // 1. validate: RADAR's checks, then the reviewer.
    const issues = new Map<string, string[]>();
    for (const a of answers) {
      const tells = aiTells(a.answer);
      if (tells.length) issues.set(a.name, tells);
    }
    let reviewed = false;
    try {
      const review = Review.safeParse(JSON.parse(unfence((await complete(VALIDATOR, JSON.stringify(answers))).text)));
      if (review.success) {
        reviewed = true;
        for (const r of review.data.reviews)
          if (values.has(r.name) && (!r.human || r.issues.length))
            issues.set(r.name, [...(issues.get(r.name) || []), ...r.issues]);
      }
    } catch {
      // The reviewer is unavailable this round: RADAR's own checks still decide what to fix.
    }
    if (!issues.size) {
      report.clean = reviewed;
      break;
    }

    // 2. fix only what was flagged.
    const flagged = [...issues].map(([name, list]) => ({
      name,
      question: question.get(name),
      answer: values.get(name),
      issues: list,
    }));
    try {
      const { text } = await complete(
        FIXER,
        `${opts.context}\n\n<answers_to_fix>\n${JSON.stringify(flagged)}\n</answers_to_fix>`,
      );
      const rewrite = Rewrite.safeParse(JSON.parse(unfence(text)));
      if (!rewrite.success) break;
      for (const a of rewrite.data.answers)
        if (issues.has(a.name) && a.value.trim()) {
          values.set(a.name, a.value.trim().slice(0, 2000));
          report.fixed++;
        }
    } catch {
      break; // keep the answers as they are; the scrub below still runs
    }
  }

  for (const [name, value] of values) values.set(name, scrub(value));
  return { values, report };
}
