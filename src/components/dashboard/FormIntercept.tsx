'use client';

import { useState } from 'react';
import { useApi } from '@/lib/use-api';
import { CopyButton } from '@/components/hud/CopyButton';
import type { FilledField } from '@/lib/apply/answers';
import { fillPacket } from '@/lib/apply/bridge';

interface Prepared {
  source: 'greenhouse' | 'lever' | 'standard';
  fields: FilledField[];
  model: string | null;
  aiError: string | null;
  tailoredId: string | null;
  kitReady: boolean;
}

const BY = {
  profile: { tag: 'PROFILE', tone: 'border-phosphor/50 text-phosphor' },
  ai: { tag: 'AI DRAFT', tone: 'border-hud-cyan/50 text-hud-cyan' },
  you: { tag: 'YOUR CALL', tone: 'border-hud-amber/50 text-hud-amber' },
} as const;
const SOURCE = { greenhouse: 'GREENHOUSE FORM', lever: 'LEVER FORM', standard: 'STANDARD FIELDS' } as const;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * FORM://INTERCEPT inside HACK: read this posting's real application form, fill it from your profile and Application
 * Kit, draft the rest with the AI, let you edit, then copy a fill packet for the RADAR FILL bookmark.
 */
export function FormIntercept({ matchId, company, fileName }: { matchId: string; company: string; fileName: string }) {
  const api = useApi();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [log, setLog] = useState<{ tag: string; text: string; tone: string }[]>([]);
  const [data, setData] = useState<Prepared | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [packet, setPacket] = useState('');

  const line = (tag: string, text: string, tone = 'text-phosphor') => setLog((l) => [...l, { tag, text, tone }]);

  const intercept = async () => {
    setPhase('running');
    setLog([]);
    setData(null);
    setEdits({});
    setPacket('');
    line('SYS', `probing ${company}'s application form…`, 'text-dim');
    try {
      const res = await api('/api/apply/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const d = (await res.json().catch(() => ({}))) as Prepared & { error?: string };
      if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
      const count = (by: FilledField['by']) => d.fields.filter((f) => f.by === by).length;
      const steps: [string, string, string][] = [
        ['OK', `${SOURCE[d.source]} · ${d.fields.length} fields intercepted`, 'text-phosphor'],
        [
          'DB',
          `${count('profile')} filled from your profile${d.kitReady ? ' and Application Kit' : ''}`,
          'text-phosphor',
        ],
        d.aiError
          ? ['AI', 'draft failed: ' + d.aiError, 'text-hud-red']
          : ['AI', `${count('ai')} answers drafted in your voice${d.model ? ' · ' + d.model : ''}`, 'text-hud-cyan'],
        ['YOU', `${count('you')} left for you: consents, and what your materials do not say`, 'text-hud-amber'],
        d.tailoredId
          ? ['PDF', 'tailored resume armed for the upload field', 'text-phosphor']
          : ['PDF', 'no tailored resume yet: attach your own, or OVERCLOCK first', 'text-dim'],
      ];
      for (const [tag, text, tone] of steps) {
        await wait(260);
        line(tag, text, tone);
      }
      setData(d);
      setPhase('done');
    } catch (err) {
      line('ERR', err instanceof Error ? err.message : String(err), 'text-hud-red');
      setPhase('error');
    }
  };

  const valueOf = (f: FilledField) => (f.name in edits ? edits[f.name] : f.value);
  const shown = (v: FilledField['value']) => (Array.isArray(v) ? v.join(', ') : v);

  const copyPacket = async () => {
    if (!data) return;
    setPacket('arming…');
    try {
      let resume: { name: string; data: string } | undefined;
      if (data.tailoredId) {
        const pdf = await api(`/api/overclock/${data.tailoredId}/pdf`);
        if (pdf.ok) resume = { name: fileName, data: toBase64(await pdf.arrayBuffer()) };
      }
      const fields = data.fields.map((f) => ({ ...f, value: valueOf(f) }));
      const p = fillPacket(company, fields, resume);
      await navigator.clipboard.writeText(JSON.stringify(p));
      setPacket(`copied · ${p.fields.length} answers${resume ? ' + PDF' : ''}. Open the form, click RADAR FILL.`);
    } catch {
      setPacket('the browser blocked the clipboard: copy the answers one by one below.');
    }
  };

  return (
    <div className="mb-4 border border-phosphor/25 bg-black/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phosphor/15 px-4 py-2.5">
        <p className="font-mono text-[10px] tracking-[0.35em] text-phosphor/80">FORM://INTERCEPT</p>
        <div className="flex flex-wrap gap-2">
          {phase === 'done' && (
            <button
              type="button"
              onClick={() => void copyPacket()}
              className="bg-phosphor px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] text-black transition-colors hover:bg-[#33FF66]"
            >
              COPY FILL PACKET
            </button>
          )}
          <button
            type="button"
            onClick={() => void intercept()}
            disabled={phase === 'running'}
            className="border border-phosphor/50 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10 disabled:cursor-wait disabled:opacity-60"
          >
            {phase === 'running' ? 'INTERCEPTING…' : phase === 'idle' ? '⚡ INTERCEPT FORM' : 'RE-INTERCEPT'}
          </button>
        </div>
      </div>

      {phase === 'idle' && (
        <p className="px-4 py-3 text-sm leading-relaxed text-dim">
          Reads this job&apos;s real application questions, answers them from your profile and Application Kit, and
          drafts the rest in your voice. You review, then RADAR FILL puts them in the form.
        </p>
      )}

      {log.length > 0 && (
        <div className="border-b border-phosphor/10 px-4 py-3 font-mono text-[11px] leading-6">
          {log.map((l, i) => (
            <p key={i} className="hacker-log-line">
              <span className="text-dim">[{l.tag}]</span> <span className={l.tone}>{l.text}</span>
            </p>
          ))}
          {packet && <p className="hacker-log-line text-phosphor">[CLIP] {packet}</p>}
        </div>
      )}

      {data && (
        <ul className="custom-scrollbar max-h-[46vh] overflow-y-auto px-4">
          {data.fields
            .filter((f) => f.type !== 'file')
            .map((f) => {
              const v = shown(valueOf(f));
              const editable = f.by === 'ai' && (f.type === 'text' || f.type === 'textarea');
              return (
                <li key={f.name} className="border-b border-phosphor/10 py-2.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[13px] leading-snug text-white/90">
                      <span
                        className={
                          'mr-2 inline-block border px-1.5 font-mono text-[9px] tracking-[0.15em] ' + BY[f.by].tone
                        }
                      >
                        {BY[f.by].tag}
                      </span>
                      {f.label}
                      {f.required && <span className="text-hud-red"> *</span>}
                    </p>
                    {v && <CopyButton value={v} />}
                  </div>
                  {editable ? (
                    <textarea
                      value={v}
                      rows={f.type === 'textarea' ? 3 : 1}
                      onChange={(e) => setEdits((x) => ({ ...x, [f.name]: e.target.value }))}
                      className="mt-1.5 w-full resize-y border border-hud-cyan/25 bg-black/60 px-2 py-1.5 text-sm leading-relaxed text-ink focus:border-hud-cyan/60 focus:outline-none"
                    />
                  ) : (
                    <p className={'mt-1 break-words text-sm ' + (v ? 'text-ink' : 'text-dim')}>
                      {v || (f.by === 'you' ? f.note || 'yours to answer on the form' : '—')}
                    </p>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
