// ============================
// RADAR — the browser side of applying: ask RADAR for a form's answers, and pack them for the form
// ============================
// Used by HACK (FORM://INTERCEPT) and by ONE-CLICK APPLY on the cards. Nothing here talks to the employer.

import type { useApi } from '@/lib/use-api';
import { armInExtension, launchInExtension, type PageQuestion } from '@/lib/extension';
import type { FilledField } from './answers';
import type { HumanizeReport } from './humanize';
import { fillPacket, type FillPacket } from './bridge';

type Api = ReturnType<typeof useApi>;

/** POST /api/apply/prepare: the form RADAR read for this match, with every answer it could give. */
export interface Prepared {
  source: 'greenhouse' | 'lever' | 'standard' | 'page';
  /** The page with the form itself (Greenhouse embed, Lever /apply, Ashby /application, else the apply link). */
  formUrl: string;
  fields: FilledField[];
  model: string | null;
  aiError: string | null;
  /** The validate → fix loop on the written answers; null when the AI wrote none. */
  humanized: HumanizeReport | null;
  tailoredId: string | null;
  kitReady: boolean;
}

/** Read the posting's application form (or the questions given) and answer it; `draft: false` = facts only, fast. */
export async function prepareForm(
  api: Api,
  matchId: string,
  opts: { draft?: boolean; fields?: PageQuestion[] } = {},
): Promise<Prepared> {
  const res = await api('/api/apply/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ matchId, ...opts }),
  });
  const d = (await res.json().catch(() => ({}))) as Prepared & { error?: string };
  if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
  return d;
}

// Your uploaded resume PDF, kept in this browser only (Cache Storage), so a form gets your real file when there is no
// tailored resume for the job. RADAR's server keeps only its text (see /privacy).
const RESUME_CACHE = 'radar-resume';
const RESUME_KEY = '/radar/resume.pdf';
/** Fired on window when a new resume PDF is kept, so a status line can refresh. */
export const RESUME_KEPT = 'radar:resume-kept';

export async function keepResumeFile(file: File): Promise<void> {
  try {
    const headers = { 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent(file.name) };
    await (await caches.open(RESUME_CACHE)).put(RESUME_KEY, new Response(file, { headers }));
    window.dispatchEvent(new Event(RESUME_KEPT));
  } catch {
    // No Cache Storage here (a private window): forms get the tailored PDF only.
  }
}

/** The resume PDF kept in this browser: its file name, or null. */
export async function keptResumeName(): Promise<string | null> {
  try {
    const kept = await (await caches.open(RESUME_CACHE)).match(RESUME_KEY);
    return kept ? decodeURIComponent(kept.headers.get('x-file-name') || 'Resume.pdf') : null;
  } catch {
    return null;
  }
}

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** The PDF for this job: the tailored one if OVERCLOCK made it, else the resume kept in this browser. */
async function resumeFor(api: Api, d: Prepared, company: string): Promise<FillPacket['resume']> {
  if (d.tailoredId) {
    const pdf = await api(`/api/overclock/${d.tailoredId}/pdf`);
    // The server names it "<your name> - <company>.pdf" (pdfFileName in src/lib/overclock.ts).
    const name = /filename="([^"]+)"/.exec(pdf.headers.get('content-disposition') || '')?.[1];
    if (pdf.ok) return { name: name || `Resume - ${company}.pdf`, data: toBase64(await pdf.arrayBuffer()) };
  }
  try {
    const kept = await (await caches.open(RESUME_CACHE)).match(RESUME_KEY);
    if (kept) return { name: (await keptResumeName()) || 'Resume.pdf', data: toBase64(await kept.arrayBuffer()) };
  } catch {
    // no Cache Storage: no PDF
  }
  return undefined;
}

/** The answers (with your edits) and the PDF, as the fill packet the extension and the bookmark read. */
export async function packForm(
  api: Api,
  d: Prepared,
  company: string,
  valueOf: (f: FilledField) => FilledField['value'] = (f) => f.value,
  extra: Pick<FillPacket, 'partial'> & { resume?: boolean } = {},
): Promise<FillPacket> {
  const resume = extra.resume === false ? undefined : await resumeFor(api, d, company);
  return fillPacket(
    company,
    d.fields.map((f) => ({ ...f, value: valueOf(f) })),
    resume,
    {
      // The questions RADAR read itself; on a form it could not read, the extension reads them all.
      asked: d.source === 'standard' ? [] : d.fields.map((f) => f.label),
      partial: extra.partial,
    },
  );
}

/**
 * ONE-CLICK APPLY. The form opens at once; your profile facts and the PDF reach it in about a second (no AI); the
 * AI's answers follow when they are drafted and humanized. A form RADAR could not read ahead (Ashby, company sites)
 * gets no AI pass here: the tab reads its real questions and asks for them (answerPageQuestions).
 * `draft` replaces the AI pass (HACK uses its own, so step 02 shows the log).
 */
export async function oneClickApply(
  api: Api,
  job: { matchId: string; url: string; company: string },
  draft: () => Promise<Prepared | null> = () => prepareForm(api, job.matchId),
): Promise<void> {
  const { matchId, company } = job;
  launchInExtension({ url: job.url, matchId, tailoredId: null });
  try {
    const facts = await prepareForm(api, matchId, { draft: false });
    const readAhead = facts.source !== 'standard';
    armInExtension({
      matchId,
      tailoredId: facts.tailoredId,
      packet: await packForm(api, facts, company, undefined, { partial: readAhead }),
    });
    if (!readAhead) return;
    const full = await draft();
    if (!full) throw new Error('the AI answers could not be drafted');
    armInExtension({ matchId, packet: await packForm(api, full, company, undefined, { resume: false }) });
  } catch (err) {
    armInExtension({
      matchId,
      error: 'RADAR could not prepare the answers: ' + (err instanceof Error ? err.message : err),
    });
  }
}

/** Questions the form tab read (RADAR could not read them ahead): answered like any other, then sent back. */
export async function answerPageQuestions(
  api: Api,
  q: { matchId: string; id: number; fields: PageQuestion[]; company: string },
): Promise<void> {
  try {
    const d = await prepareForm(api, q.matchId, { fields: q.fields });
    armInExtension({ matchId: q.matchId, more: { id: q.id, packet: fillPacket(q.company, d.fields) } });
  } catch (err) {
    armInExtension({ matchId: q.matchId, more: { id: q.id, error: err instanceof Error ? err.message : String(err) } });
  }
}
