/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================
// RADAR — FORM://INTERCEPT: the questions an application form will ask, read before you open it
// ============================
// Greenhouse publishes each posting's questions on its public Job Board API (?questions=true). Lever renders them
// into the apply page (robots.txt allows it; each custom card carries its full definition as JSON). Ashby's form API
// sits under /api/, which its robots.txt disallows, so Ashby and every other source get the standard fields.
// Nothing here submits anything: RADAR reads the form, you send it.

import { decodeEntities, fetchJson, fetchText, htmlToText } from '@/lib/scraper/utils';

export interface FormField {
  /** The input's name on the employer's form (so the autofill bridge can find it). */
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'multiselect' | 'file';
  required: boolean;
  /** Choices as shown; `values` are what the form submits for each (same order), when they differ. */
  options?: string[];
  values?: string[];
  /** Short help text under the question, if the form has one. */
  help?: string;
}

export interface ApplicationForm {
  /** page = questions the extension read on the open form, which RADAR could not read ahead. */
  source: 'greenhouse' | 'lever' | 'standard' | 'page';
  fields: FormField[];
}

/** The fields almost every application asks for, used where a form cannot be read. */
const STANDARD_FIELDS: FormField[] = [
  { name: 'name', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: false },
  { name: 'location', label: 'Current location', type: 'text', required: false },
  { name: 'org', label: 'Current company', type: 'text', required: false },
  { name: 'resume', label: 'Resume/CV', type: 'file', required: true },
  { name: 'urls[LinkedIn]', label: 'LinkedIn URL', type: 'url', required: false },
  { name: 'urls[GitHub]', label: 'GitHub URL', type: 'url', required: false },
  { name: 'urls[Portfolio]', label: 'Portfolio URL', type: 'url', required: false },
  { name: 'why', label: 'Why do you want to work here?', type: 'textarea', required: false },
];

const GH_TYPES: Record<string, FormField['type']> = {
  input_text: 'text',
  textarea: 'textarea',
  input_file: 'file',
  multi_value_single_select: 'select',
  multi_value_multi_select: 'multiselect',
  input_hidden: 'text',
};

/** Greenhouse Job Board API posting (?questions=true) → form fields. Pure, for tests. */
export function parseGreenhouseForm(job: any): FormField[] {
  const out: FormField[] = [];
  const add = (q: any) => {
    for (const f of q.fields || []) {
      const type = GH_TYPES[f.type];
      if (!type || f.type === 'input_hidden') continue;
      // "Resume/CV" offers a file and a paste box; the file is the one to fill.
      if (/_text$/.test(f.name) && (q.fields || []).some((g: any) => g.type === 'input_file')) continue;
      const values = (f.values || []) as { label: string; value: string | number }[];
      out.push({
        name: f.name,
        label: decodeEntities(String(q.label || f.name)).trim(),
        type: f.name === 'email' ? 'email' : f.name === 'phone' ? 'tel' : type,
        required: !!q.required,
        ...(values.length ? { options: values.map((v) => v.label), values: values.map((v) => String(v.value)) } : {}),
        ...(q.description ? { help: htmlToText(q.description).slice(0, 300) } : {}),
      });
    }
  };
  for (const q of job.questions || []) add(q);
  for (const q of job.location_questions || []) add(q);
  for (const group of job.compliance || []) for (const q of group.questions || []) add(q);
  return out;
}

const LEVER_STANDARD: [name: string, test: RegExp, field: Omit<FormField, 'name'>][] = [
  ['name', /name="name"/, { label: 'Full name', type: 'text', required: true }],
  ['email', /name="email"/, { label: 'Email', type: 'email', required: true }],
  ['phone', /name="phone"/, { label: 'Phone', type: 'tel', required: false }],
  ['location', /name="location"/, { label: 'Current location', type: 'text', required: false }],
  ['org', /name="org"/, { label: 'Current company', type: 'text', required: false }],
  ['resume', /name="resume"/, { label: 'Resume/CV', type: 'file', required: true }],
];
const LEVER_TYPES: Record<string, FormField['type']> = {
  text: 'text',
  textarea: 'textarea',
  dropdown: 'select',
  'multiple-choice': 'select',
  'multiple-select': 'multiselect',
};

/** A Lever apply page (HTML) → form fields: the standard inputs present, links, then every custom card. Pure. */
export function parseLeverForm(html: string): FormField[] {
  const out: FormField[] = [];
  for (const [name, test, field] of LEVER_STANDARD) if (test.test(html)) out.push({ name, ...field });
  for (const m of html.matchAll(/name="urls\[([^\]]+)\]"/g))
    out.push({ name: `urls[${m[1]}]`, label: m[1] + ' URL', type: 'url', required: false });
  for (const m of html.matchAll(/value="([^"]*)" name="cards\[([^\]]+)\]\[baseTemplate\]"/g)) {
    let card: any;
    try {
      card = JSON.parse(decodeEntities(m[1]));
    } catch {
      continue;
    }
    (card.fields || []).forEach((f: any, i: number) => {
      const type = LEVER_TYPES[f.type];
      if (!type) return;
      const options = (f.options || []).map((o: any) => String(o.text));
      out.push({
        name: `cards[${m[2]}][field${i}]`,
        label: String(f.text || card.text || '').trim(),
        type,
        required: !!f.required,
        ...(options.length ? { options } : {}),
        ...(f.description ? { help: String(f.description).slice(0, 300) } : {}),
      });
    });
  }
  if (/name="comments"/.test(html))
    out.push({ name: 'comments', label: 'Additional information', type: 'textarea', required: false });
  return out;
}

/**
 * The page where the application form itself is, so the extension lands on the form. Checked live (2026-10-02):
 * Greenhouse's embed form works for every board, also where the hosted page redirects to the company's own site
 * (Stripe, Datadog, Coinbase); Lever's form is `…/apply`, Ashby's `…/application`. Anything else: the apply link.
 */
export function applicationFormUrl(job: {
  provider: string | null;
  identifier: string | null;
  externalId: string;
  applyUrl: string;
}): string {
  if (job.provider === 'greenhouse' && job.identifier) {
    const host = /\.eu\.greenhouse\.io/.test(job.applyUrl) ? 'job-boards.eu.greenhouse.io' : 'job-boards.greenhouse.io';
    return `https://${host}/embed/job_app?for=${encodeURIComponent(job.identifier)}&token=${encodeURIComponent(job.externalId)}`;
  }
  if (job.provider === 'lever') return leverApplyUrl(job.applyUrl) || job.applyUrl;
  const ashby = job.applyUrl.match(/^https:\/\/jobs\.ashbyhq\.com\/[^/?#]+\/[0-9a-f-]{36}/i);
  if (job.provider === 'ashby' && ashby) return ashby[0] + '/application';
  return job.applyUrl;
}

export interface AtsPosting {
  provider: string;
  identifier: string | null;
  externalId: string;
  applyUrl: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * The ATS posting behind a URL, for an employer page a job board led to (Adzuna → Greenhouse): RADAR then opens and
 * reads ahead that form like any ATS job. Null for any other page. Pure.
 */
export function atsFromUrl(raw: string): AtsPosting | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const path = url.pathname.split('/').filter(Boolean);
  if (/(^|\.)greenhouse\.io$/.test(url.hostname)) {
    const board = url.searchParams.get('for') || (path[1] === 'jobs' ? path[0] : null);
    const id = url.searchParams.get('token') || (path[1] === 'jobs' ? path[2] : null);
    return board && id && /^\d+$/.test(id)
      ? { provider: 'greenhouse', identifier: board, externalId: id, applyUrl: raw }
      : null;
  }
  if (/^jobs\.(eu\.)?lever\.co$/.test(url.hostname) && path[1] && UUID.test(path[1]))
    return {
      provider: 'lever',
      identifier: path[0],
      externalId: path[1],
      applyUrl: `https://${url.hostname}/${path[0]}/${path[1]}`,
    };
  if (url.hostname === 'jobs.ashbyhq.com' && path[1] && UUID.test(path[1]))
    return {
      provider: 'ashby',
      identifier: path[0],
      externalId: path[1],
      applyUrl: `https://jobs.ashbyhq.com/${path[0]}/${path[1]}`,
    };
  return null;
}

/** "https://jobs.lever.co/acme/1234-…" (or its /apply page) → the apply page URL. */
const leverApplyUrl = (url: string) => {
  const m = url.match(/^https:\/\/jobs\.(eu\.)?lever\.co\/[^/]+\/[0-9a-f-]{36}/i);
  return m ? m[0] + '/apply' : null;
};

/** Read one posting's application form. Anything that cannot be read falls back to the standard fields. */
export async function readApplicationForm(job: {
  provider: string | null;
  identifier: string | null;
  externalId: string;
  applyUrl: string;
}): Promise<ApplicationForm> {
  try {
    if (job.provider === 'greenhouse' && job.identifier) {
      const posting = await fetchJson<any>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(job.identifier)}/jobs/${encodeURIComponent(job.externalId)}?questions=true`,
        { retries: 0, timeoutMs: 10_000 },
      );
      const fields = parseGreenhouseForm(posting);
      if (fields.length) return { source: 'greenhouse', fields };
    }
    const lever = job.provider === 'lever' ? leverApplyUrl(job.applyUrl) : null;
    if (lever) {
      const fields = parseLeverForm(await fetchText(lever, 12_000));
      if (fields.length) return { source: 'lever', fields };
    }
  } catch (err) {
    console.warn('[APPLY] form read failed, using the standard fields:', err instanceof Error ? err.message : err);
  }
  return { source: 'standard', fields: STANDARD_FIELDS };
}
