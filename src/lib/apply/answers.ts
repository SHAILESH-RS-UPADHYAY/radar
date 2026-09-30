// ============================
// RADAR — Answers for one application form
// ============================
// Profile facts fill what they can, exactly (name, email, links, notice period, pay, work authorization, EEO from
// your Application Kit). The AI drafts the rest in your voice from your resume, kit and projects, and must pick a
// listed option where the form lists them. Legal consents (agreements, arbitration, policies) are never answered
// for you, and neither is anything your materials do not say: those stay empty for you to decide.

import { z } from 'zod';
import { completeJson } from '@/lib/ai/tailor';
import type { FormField } from './form';

export interface Candidate {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
  currentCompany: string;
  currentTitle: string;
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
  currency: string;
  workAuthorization: string;
  needsSponsorship: '' | 'yes' | 'no';
  willingToRelocate: '' | 'yes' | 'no';
  gender: string;
  pronouns: string;
  veteranStatus: string;
  disabilityStatus: string;
  voiceNotes: string;
  experienceYears: number | null;
  skills: string[];
  targetRoles: string[];
  projects: { name: string; url: string; note: string }[];
}

export interface FilledField extends FormField {
  /** Text, or the chosen option(s) as shown on the form; '' = left for you. */
  value: string | string[];
  /** profile = an exact fact you saved · ai = drafted from your materials · you = yours to decide */
  by: 'profile' | 'ai' | 'you';
  note?: string;
}

/** Questions that are a legal or personal commitment: never answered on your behalf. */
export const YOUR_CALL =
  /\b(agree|agreement|consent|arbitrat\w*|acknowledge|certify|attest|confirm|declare|accurate|terms|privacy|policy|signature|sign)\b/i;
const DECLINE = /decline|don.?t wish|prefer not|not to (say|answer|disclose)|rather not/i;
const MAX_AI_OPTIONS = 60;

const pickOption = (options: string[] | undefined, wanted: string): string => {
  if (!options?.length || !wanted) return '';
  const w = wanted.toLowerCase().trim();
  return (
    options.find((o) => o.toLowerCase() === w) ||
    options.find((o) => o.toLowerCase().startsWith(w)) ||
    options.find((o) => o.toLowerCase().includes(w)) ||
    ''
  );
};
const yesNo = (options: string[] | undefined, v: '' | 'yes' | 'no') => (v ? pickOption(options, v) : '');

/** A fact from your profile for one field, or null when the profile does not say. Pure, for tests. */
export function fillFromProfile(
  field: FormField,
  c: Candidate,
  resumeText: string,
): Pick<FilledField, 'value' | 'note'> | null {
  const label = (field.label + ' ' + field.name).toLowerCase();
  const text = (value: string) => (value ? { value } : null);
  const option = (value: string) => (value ? { value } : null);
  const [first, ...rest] = c.fullName.trim().split(/\s+/);

  if (field.type === 'file') return /cover/.test(label) ? null : { value: 'resume.pdf', note: 'your resume PDF' };
  if (field.name === 'first_name' || /\bfirst name\b/.test(label)) return text(first || '');
  if (field.name === 'last_name' || /\b(last|family) name\b/.test(label)) return text(rest.join(' '));
  if (field.name === 'name' || /^(full )?name\b/.test(field.label.toLowerCase())) return text(c.fullName);
  if (field.type === 'email' || /\be-?mail\b/.test(label)) return text(c.email);
  if (field.type === 'tel' || /\bphone|mobile\b/.test(label)) return text(c.phone);
  if (/linkedin/.test(label)) return text(c.linkedin);
  if (/github/.test(label)) return text(c.github);
  if (/portfolio/.test(label)) return text(c.portfolio || c.website);
  if (/\b(website|personal site|blog)\b/.test(label)) return text(c.website || c.portfolio);

  if (field.type === 'select' || field.type === 'multiselect') {
    if (/sponsor/.test(label)) return option(yesNo(field.options, c.needsSponsorship));
    if (/relocat/.test(label) && c.willingToRelocate === 'yes') return option(pickOption(field.options, 'yes'));
    const eeo: [RegExp, string][] = [
      [/\bgender\b/, c.gender],
      [/pronoun/, c.pronouns],
      [/veteran/, c.veteranStatus],
      [/disabilit/, c.disabilityStatus],
      [/\brace\b|ethnic|hispanic|latino/, ''],
    ];
    for (const [test, kit] of eeo)
      if (test.test(label))
        return option(pickOption(field.options, kit) || field.options?.find((o) => DECLINE.test(o)) || '');
    // A long list (universities, countries): the option your resume names, longest first.
    if ((field.options?.length || 0) > MAX_AI_OPTIONS) {
      const found = [...(field.options || [])]
        .filter((o) => o.length > 3)
        .sort((a, b) => b.length - a.length)
        .find((o) => resumeText.toLowerCase().includes(o.toLowerCase()));
      return found ? { value: found, note: 'found in your resume' } : null;
    }
    return null;
  }

  if (/current (company|employer)|\borg\b|organi[sz]ation/.test(label)) return text(c.currentCompany);
  if (/current (title|role|position)|job title/.test(label)) return text(c.currentTitle);
  if (/notice period|earliest.*start|start date|when can you (start|join)|available to start/.test(label))
    return text(c.noticePeriod);
  const pay = (amount: string) => text(amount ? [amount, c.currency].filter(Boolean).join(' ') : '');
  if (/current (ctc|salary|compensation|pay)/.test(label)) return pay(c.currentCtc);
  if (/expected|desired|salary expectation|compensation expectation/.test(label)) return pay(c.expectedCtc);
  // Where you are now; a preferred office is left to the AI, which reads the job's locations.
  const where = field.label.toLowerCase().trim();
  if (field.type === 'text' && /^(current )?location\b|^city\b|where are you (located|based)/.test(where))
    return text(c.city);
  return null;
}

const Answers = z.object({
  answers: z.array(z.object({ name: z.string(), value: z.union([z.string(), z.array(z.string())]) })),
});

const SYSTEM = `You fill in one job application for the candidate, in the candidate's own voice.

Rules:
- Write in first person ("I", "my") as a sharp engineer writing their own application: plain words, specific systems, real numbers from the materials.
- Use only facts from the resume, profile, Application Kit and projects given. Never invent employers, titles, dates, numbers, schools, visas or links.
- If the materials do not answer a question, return "" for it. The candidate will answer it.
- Short text fields: a few words. "Why this company / role": 2 to 4 sentences, under 80 words, tied to what the company builds and what the candidate has built. Other long answers: under 120 words.
- A field that lists options: the value must be exactly one of the options (multi-select: an array of them).
- Never write: thrilled, passionate, delve, tapestry, testament, unwavering, eager to leverage, aligns perfectly, synergy, cutting-edge, excited to. No emojis, no exclamation marks, no em dashes.

Reply with JSON only: {"answers":[{"name":"<field name>","value":"<text>" or ["<option>", ...]}]}`;

export interface AnswerContext {
  job: { title: string; company: string; location: string | null; description: string };
  resumeText: string;
  tailoredText: string | null;
}

/** Profile facts first, then one AI call for everything else it may answer. */
export async function answerForm(
  fields: FormField[],
  c: Candidate,
  ctx: AnswerContext,
): Promise<{ fields: FilledField[]; model: string | null; aiError: string | null }> {
  const filled: FilledField[] = fields.map((f) => {
    if (YOUR_CALL.test(f.label)) return { ...f, value: '', by: 'you', note: 'a legal consent: your decision' };
    const fact = fillFromProfile(f, c, ctx.resumeText);
    if (fact && (Array.isArray(fact.value) ? fact.value.length : fact.value)) return { ...f, ...fact, by: 'profile' };
    return { ...f, value: '', by: 'you' };
  });

  const ask = filled.filter(
    (f) =>
      f.by === 'you' && !YOUR_CALL.test(f.label) && f.type !== 'file' && (f.options?.length || 0) <= MAX_AI_OPTIONS,
  );
  if (!ask.length) return { fields: filled, model: null, aiError: null };

  const candidate = [
    `NAME: ${c.fullName}`,
    c.currentTitle || c.currentCompany ? `NOW: ${[c.currentTitle, c.currentCompany].filter(Boolean).join(' at ')}` : '',
    c.experienceYears !== null ? `EXPERIENCE: ${c.experienceYears} years` : '',
    c.targetRoles.length ? `TARGET ROLES: ${c.targetRoles.join(', ')}` : '',
    c.skills.length ? `SKILLS: ${c.skills.join(', ')}` : '',
    c.city ? `BASED IN: ${c.city}` : '',
    c.workAuthorization ? `WORK AUTHORIZATION: ${c.workAuthorization}` : '',
    c.needsSponsorship ? `NEEDS VISA SPONSORSHIP: ${c.needsSponsorship}` : '',
    c.willingToRelocate ? `WILLING TO RELOCATE: ${c.willingToRelocate}` : '',
    c.noticePeriod ? `NOTICE PERIOD: ${c.noticePeriod}` : '',
    c.expectedCtc ? `EXPECTED PAY: ${c.expectedCtc} ${c.currency}` : '',
    c.voiceNotes ? `IN MY OWN WORDS: ${c.voiceNotes}` : '',
    ...c.projects.map((p) => `PROJECT I BUILT: ${p.name} (${p.url})${p.note ? ' - ' + p.note : ''}`),
  ].filter(Boolean);
  const user = [
    `<job>\nTITLE: ${ctx.job.title}\nCOMPANY: ${ctx.job.company}\nLOCATION: ${ctx.job.location || 'not stated'}\n${ctx.job.description.slice(0, 3500)}\n</job>`,
    `<candidate>\n${candidate.join('\n')}\n</candidate>`,
    `<resume>\n${ctx.resumeText.slice(0, 6000)}\n</resume>`,
    ctx.tailoredText
      ? `<resume_tailored_for_this_job>\n${ctx.tailoredText.slice(0, 4000)}\n</resume_tailored_for_this_job>`
      : '',
    `<questions>\n${JSON.stringify(ask.map((f) => ({ name: f.name, label: f.label, type: f.type, required: f.required, ...(f.options ? { options: f.options } : {}), ...(f.help ? { help: f.help } : {}) })))}\n</questions>`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const { text, model } = await completeJson(SYSTEM, user);
    const parsed = Answers.safeParse(
      JSON.parse(
        text
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, ''),
      ),
    );
    if (!parsed.success) return { fields: filled, model, aiError: 'The AI reply could not be read. Try again.' };
    const byName = new Map(parsed.data.answers.map((a) => [a.name, a.value]));
    for (const f of filled) {
      if (f.by !== 'you' || !byName.has(f.name)) continue;
      const raw = byName.get(f.name)!;
      let value: string | string[] = '';
      if (f.type === 'multiselect') value = (Array.isArray(raw) ? raw : [raw]).filter((v) => f.options?.includes(v));
      else if (f.type === 'select') value = f.options?.includes(String(raw)) ? String(raw) : '';
      else value = (Array.isArray(raw) ? raw.join(', ') : raw).trim().slice(0, 2000);
      if (Array.isArray(value) ? value.length : value) Object.assign(f, { value, by: 'ai' as const });
    }
    return { fields: filled, model, aiError: null };
  } catch (err) {
    return { fields: filled, model: null, aiError: err instanceof Error ? err.message : String(err) };
  }
}
