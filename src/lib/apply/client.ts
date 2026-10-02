// ============================
// RADAR — the browser side of applying: ask RADAR for a form's answers, and pack them for the form
// ============================
// Used by HACK (FORM://INTERCEPT) and by ONE-CLICK APPLY on the cards. Nothing here talks to the employer.

import type { useApi } from '@/lib/use-api';
import type { FilledField } from './answers';
import type { HumanizeReport } from './humanize';
import { fillPacket, type FillPacket } from './bridge';

type Api = ReturnType<typeof useApi>;

/** POST /api/apply/prepare: the form RADAR read for this match, with every answer it could give. */
export interface Prepared {
  source: 'greenhouse' | 'lever' | 'standard';
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

/** Read the posting's application form and draft its answers. */
export async function prepareForm(api: Api, matchId: string): Promise<Prepared> {
  const res = await api('/api/apply/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ matchId }),
  });
  const d = (await res.json().catch(() => ({}))) as Prepared & { error?: string };
  if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
  return d;
}

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** The answers (with your edits) and the tailored PDF, as the fill packet the extension and the bookmark read. */
export async function packForm(
  api: Api,
  d: Prepared,
  company: string,
  valueOf: (f: FilledField) => FilledField['value'] = (f) => f.value,
): Promise<FillPacket> {
  let resume: FillPacket['resume'];
  if (d.tailoredId) {
    const pdf = await api(`/api/overclock/${d.tailoredId}/pdf`);
    // The server names it "<your name> - <company>.pdf" (pdfFileName in src/lib/overclock.ts).
    const name = /filename="([^"]+)"/.exec(pdf.headers.get('content-disposition') || '')?.[1];
    if (pdf.ok) resume = { name: name || `Resume - ${company}.pdf`, data: toBase64(await pdf.arrayBuffer()) };
  }
  return fillPacket(
    company,
    d.fields.map((f) => ({ ...f, value: valueOf(f) })),
    resume,
  );
}
