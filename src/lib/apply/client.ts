// ============================
// RADAR — the browser side of applying: ask RADAR for a form's answers, and pack them for the form
// ============================
// Used by INFILTRATE (FORM://INTERCEPT) and by ↯ HACK on the cards. Nothing here talks to the employer.

import { useEffect, useState } from 'react';
import type { useApi } from '@/lib/use-api';
import { armInExtension, keepResumeInExtension, launchInExtension, type PageQuestion } from '@/lib/extension';
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

// Your uploaded resume PDF, kept on this computer only, so a form gets your real file when there is no tailored resume
// for the job: in this browser's Cache Storage for this address, and in the extension, which keeps it for every RADAR
// address (localhost, the live site). RADAR's server keeps only its text (see /privacy).
const RESUME_CACHE = 'radar-resume';
const RESUME_KEY = '/radar/resume.pdf';
/** Fired on window when a new resume PDF is kept, so a status line can refresh. */
const RESUME_KEPT = 'radar:resume-kept';

export async function keepResumeFile(file: File): Promise<void> {
  // The extension's copy first, on its own: it is what forms get, on every RADAR address.
  keepResumeInExtension({ name: file.name, data: toBase64(await file.arrayBuffer()) });
  try {
    const headers = { 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent(file.name) };
    await (await caches.open(RESUME_CACHE)).put(RESUME_KEY, new Response(file, { headers }));
    window.dispatchEvent(new Event(RESUME_KEPT));
  } catch {
    // No Cache Storage here (a private window, a full disk): the extension's copy still serves every form.
  }
}

/** Give the extension the PDF kept here (a resume uploaded before it was installed). */
export async function shareKeptResume(): Promise<void> {
  try {
    const kept = await (await caches.open(RESUME_CACHE)).match(RESUME_KEY);
    if (kept)
      keepResumeInExtension({
        name: (await keptResumeName()) || 'Resume.pdf',
        data: toBase64(await kept.arrayBuffer()),
      });
  } catch {
    // nothing kept here
  }
}

/** The resume PDF kept in this browser, kept current as you upload: its name, null for none, undefined while reading. */
export function useKeptResume(): string | null | undefined {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => void keptResumeName().then(setName);
    read();
    window.addEventListener(RESUME_KEPT, read);
    return () => window.removeEventListener(RESUME_KEPT, read);
  }, []);
  return name;
}

/** The resume PDF kept in this browser: its file name, or null. */
async function keptResumeName(): Promise<string | null> {
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
 * ↯ HACK, one click. The form opens at once; your profile facts and the PDF reach it in about a second (no AI); the
 * AI's answers follow when they are drafted and humanized. A form RADAR could not read ahead (Ashby, company sites)
 * gets no AI pass here: the tab reads its real questions and asks for them (answerPageQuestions).
 * `draft` replaces the AI pass (INFILTRATE uses its own, so step 02 shows the log).
 */
export async function oneClickApply(
  api: Api,
  job: { matchId: string; url: string; company: string; tabId?: number },
  draft: () => Promise<Prepared | null> = () => prepareForm(api, job.matchId),
): Promise<void> {
  const { matchId, company } = job;
  launchInExtension({ url: job.url, matchId, tailoredId: null, tabId: job.tabId });
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

/**
 * The extension's icon on a careers page RADAR did not open: register the page as a job of yours, then run ↯ HACK in
 * that same tab. Submitting it logs it in C2 · OPS, and Gmail replies from that company are tracked like any other.
 */
export async function adoptPage(
  api: Api,
  tabId: number,
  page: { url: string; title: string; heading: string; siteName: string; text: string },
): Promise<{ matchId: string; company: string; title: string }> {
  const res = await api('/api/apply/adopt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(page),
  });
  const d = (await res.json().catch(() => ({}))) as {
    matchId?: string;
    company?: string;
    title?: string;
    error?: string;
  };
  if (!res.ok || !d.matchId) throw new Error(d.error || 'HTTP ' + res.status);
  const job = { matchId: d.matchId, company: d.company || 'RADAR', title: d.title || '' };
  await oneClickApply(api, { ...job, url: page.url, tabId });
  return job;
}

/** Remember an answer you gave in the extension's panel: every later form that asks the same question gets it. */
export async function rememberAnswer(api: Api, question: string, answer: string): Promise<void> {
  await api('/api/settings/learn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, answer }),
  }).catch(() => {});
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
