'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Modal } from '@/components/hud/Modal';
import { Decrypt } from '@/components/hud/Decrypt';
import { useApi } from '@/lib/use-api';
import { drawWords } from '@/lib/status-words';
import { SCAN_STAGES, type ScanEvent, type ScanStage } from '@/lib/scan-events';

export type ScanDone = Extract<ScanEvent, { stage: 'done' }>;
type Got = { [S in ScanStage]?: Extract<ScanEvent, { stage: S }> };

const STEP_MS = 420; // every stage stays on screen at least this long, so even a fast scan can be read
const SPIN = '◐◓◑◒';
const GOLDEN = 2.399963; // golden angle (radians): blips spread evenly around the scope
const C = 120; // scope centre and radius, in viewBox units
const R = 108;

const pct = (n: number) => n.toFixed(3);

/** What one finished stage found, in a few words. */
function metric(got: Got, stage: ScanStage): string {
  switch (stage) {
    case 'retire':
      return `${got.retire!.closed} closed postings cleared`;
    case 'profile': {
      const p = got.profile!;
      return `${p.skills} skills · ${p.roles} roles · ${p.cities} places`;
    }
    case 'vector':
      return `${got.vector!.cached ? 'cached' : 'embedded'} · ${got.vector!.dims}-d`;
    case 'search': {
      const s = got.search!;
      return `${s.candidates} closest jobs · cos ${pct(s.min)}–${pct(s.max)}`;
    }
    case 'load':
      return `${got.load!.jobs} open${got.load!.dream ? ` · +${got.load!.dream} dream` : ''}`;
    case 'score': {
      const s = got.score!;
      return `${s.bands[0]} at ${s.bar}+ · ${s.bands[1]} near · ${s.bands[2]} low`;
    }
    case 'gate':
      return `${got.gate!.waiting} new strong · ${got.gate!.closed} closed on check`;
    case 'vault':
      return `+${got.vault!.vaulted} into the Vault`;
  }
}

/**
 * SCAN://LIVE — a scan as it happens. POST /api/match?stream=1 reports each backend stage (closed postings retired,
 * resume vector, Pinecone top-K, the jobs from Supabase, scoring, the verify gate, the Vault), and this draws them:
 * a radar scope with one blip per candidate (closer = more alike), the pipeline with real numbers, and a log.
 */
export function ScanConsole({
  onFinished,
  onFailed,
  onClose,
}: {
  onFinished: (done: ScanDone) => void;
  onFailed: (error: string) => void;
  onClose: () => void;
}) {
  const api = useApi();
  const still = useReducedMotion();
  const [got, setGot] = useState<Got>({});
  const [log, setLog] = useState<{ id: number; text: string; value: string }[]>([]);
  const [done, setDone] = useState<ScanDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  const [words] = useState(() => drawWords(24));
  const handlers = useRef({ onFinished, onFailed });
  useEffect(() => {
    handlers.current = { onFinished, onFailed };
  });

  useEffect(() => {
    let alive = true;
    let over = false;
    let seq = 0;
    let last = 0;
    const queue: ScanEvent[] = [];
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const t0 = performance.now();

    // Events are shown one at a time, at least STEP_MS apart.
    const pump = setInterval(() => {
      const now = performance.now();
      if (!over) setElapsed(now - t0);
      setTick((n) => n + 1);
      if (!queue.length || now - last < STEP_MS) return;
      last = now;
      const e = queue.shift()!;
      if (e.stage === 'done') {
        over = true;
        setDone(e);
        handlers.current.onFinished(e);
      } else if (e.stage === 'error') {
        over = true;
        setError(e.error);
        handlers.current.onFailed(e.error);
      } else {
        setGot((g) => {
          const next = { ...g, [e.stage]: e };
          const spec = SCAN_STAGES.find((s) => s.stage === e.stage)!;
          setLog((l) => [...l.slice(-7), { id: seq++, text: spec.call, value: metric(next, e.stage) }]);
          return next;
        });
      }
    }, 60);

    (async () => {
      try {
        const res = await api('/api/match?stream=1', { method: 'POST' });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          queue.push({
            stage: 'error',
            error: d.error || 'Scan failed (HTTP ' + res.status + ').',
            status: res.status,
          });
          return;
        }
        reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let ended = false;
        for (;;) {
          const { value, done: eof } = await reader.read();
          if (eof) break;
          buffer += decoder.decode(value, { stream: true });
          for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const e = JSON.parse(line) as ScanEvent;
            if (e.stage === 'done' || e.stage === 'error') ended = true;
            queue.push(e);
          }
        }
        if (alive && !ended) queue.push({ stage: 'error', error: 'The scan stopped before it finished.', status: 0 });
      } catch {
        if (alive) queue.push({ stage: 'error', error: 'Connection lost during the scan. Try again.', status: 0 });
      }
    })();

    return () => {
      alive = false;
      clearInterval(pump);
      reader?.cancel().catch(() => {});
    };
  }, [api]);

  const running = !done && !error;
  const active = running ? SCAN_STAGES.find((s) => !got[s.stage])?.stage : undefined;
  const word = words[Math.floor(tick / 12) % words.length];
  const seconds = (elapsed / 1000).toFixed(1);

  // The scope: one blip per candidate, nearer the centre the closer its meaning is to your resume.
  const search = got.search;
  const score = got.score;
  const spread = search ? Math.max(1e-6, search.max - search.min) : 1;
  const blips = (search?.sims || []).map((sim, i) => {
    const r = R * (0.14 + 0.8 * ((search!.max - sim) / spread));
    const a = i * GOLDEN;
    const s = score?.scores[i];
    const tone =
      s === undefined ? 'rgba(0,255,65,0.45)' : s >= score!.bar ? '#00FF41' : s >= 50 ? '#FACC15' : '#2F4A35';
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, tone, hit: s !== undefined && s >= score!.bar, i };
  });
  const landed = !!(got.vault || done);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      label="SCAN://LIVE"
      status={
        <span className={error ? 'text-hud-red' : done ? 'text-phosphor' : 'text-hud-amber'}>
          {error ? 'FAILED' : done ? 'COMPLETE · T+' + seconds + 's' : SPIN[tick % 4] + ' T+' + seconds + 's'}
        </span>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Scope */}
        <div>
          <svg viewBox="0 0 240 240" className="mx-auto block w-full max-w-[320px]" role="img" aria-label="Radar scope">
            <defs>
              <radialGradient id="scan-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FF41" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#00FF41" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="scan-wedge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00FF41" stopOpacity="0" />
                <stop offset="100%" stopColor="#00FF41" stopOpacity="0.35" />
              </linearGradient>
            </defs>
            <circle cx={C} cy={C} r={R} fill="url(#scan-glow)" />
            {[0.25, 0.5, 0.75, 1].map((k) => (
              <circle
                key={k}
                cx={C}
                cy={C}
                r={R * k}
                fill="none"
                stroke="#00FF41"
                strokeOpacity={k === 1 ? 0.45 : 0.14}
                strokeDasharray={k === 1 ? undefined : '2 4'}
              />
            ))}
            <path d={`M${C - R} ${C}H${C + R}M${C} ${C - R}V${C + R}`} stroke="#00FF41" strokeOpacity="0.12" />
            {Array.from({ length: 36 }, (_, i) => {
              const a = (i * Math.PI) / 18;
              const inner = i % 3 ? R - 3 : R - 7;
              return (
                <line
                  key={i}
                  x1={C + Math.cos(a) * inner}
                  y1={C + Math.sin(a) * inner}
                  x2={C + Math.cos(a) * R}
                  y2={C + Math.sin(a) * R}
                  stroke="#00FF41"
                  strokeOpacity="0.35"
                />
              );
            })}
            {running && !still && (
              <g className="radar-sweep">
                <path
                  d={`M${C} ${C}L${C + R} ${C}A${R} ${R} 0 0 0 ${C + R * Math.cos(-0.55)} ${C + R * Math.sin(-0.55)}Z`}
                  fill="url(#scan-wedge)"
                />
                <line x1={C} y1={C} x2={C + R} y2={C} stroke="#00FF41" strokeOpacity="0.9" />
              </g>
            )}
            {blips.map((b) => (
              <g key={b.i}>
                <motion.circle
                  cx={b.x}
                  cy={b.y}
                  initial={still ? false : { r: 0, opacity: 0 }}
                  animate={{ r: b.hit ? 3 : 2.1, opacity: 1, fill: b.tone }}
                  transition={{ delay: still ? 0 : Math.min(1.2, b.i * 0.007), duration: 0.35 }}
                  style={b.hit ? { filter: 'drop-shadow(0 0 3px #00FF41)' } : undefined}
                />
                {landed && b.hit && !still && (
                  <motion.circle
                    cx={b.x}
                    cy={b.y}
                    fill="none"
                    stroke="#00FF41"
                    initial={{ r: 3, opacity: 0.9 }}
                    animate={{ r: 13, opacity: 0 }}
                    transition={{ duration: 1.1, repeat: 2, delay: (b.i % 7) * 0.08 }}
                  />
                )}
              </g>
            ))}
            <circle cx={C} cy={C} r="3.2" fill="#00FF41" className={running ? 'animate-pulse' : undefined} />
            <text x={C + 7} y={C - 6} fill="#00FF41" fillOpacity="0.8" fontSize="7" fontFamily="monospace">
              YOU
            </text>
          </svg>

          <dl className="mt-4 grid grid-cols-3 border border-phosphor/15 font-mono">
            {[
              ['CANDIDATES', search?.candidates ?? '—'],
              ['SCORED', score?.scored ?? '—'],
              ['VAULT', got.vault ? '+' + got.vault.vaulted : done ? '+' + done.vaulted : '—'],
            ].map(([k, v]) => (
              <div key={k} className="border-r border-phosphor/10 px-3 py-2 last:border-r-0">
                <dt className="text-[9px] tracking-[0.25em] text-dim">{k}</dt>
                <motion.dd
                  key={String(v)}
                  initial={still ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-0.5 text-xl font-extrabold text-phosphor"
                >
                  {v}
                </motion.dd>
              </div>
            ))}
          </dl>
          {score && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] tracking-wider text-dim">
              <span>
                <span className="text-phosphor">●</span> {score.bar}+ VAULT
              </span>
              <span>
                <span className="text-hud-amber">●</span> 50–{score.bar - 1} NEAR
              </span>
              <span>
                <span className="text-[#2F4A35]">●</span> LOW
              </span>
            </p>
          )}
        </div>

        {/* Pipeline */}
        <div className="min-w-0">
          <ol className="border border-phosphor/15">
            {SCAN_STAGES.map(({ stage, label, call }) => {
              const isDone = !!got[stage];
              const isActive = stage === active;
              const skipped = !isDone && !running;
              return (
                <li
                  key={stage}
                  className={
                    'border-b border-phosphor/10 px-4 py-2.5 transition-colors last:border-b-0 ' +
                    (isActive ? 'bg-phosphor/[0.06]' : '')
                  }
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.15em]">
                    <span
                      className={
                        'w-3 shrink-0 text-center ' +
                        (isDone ? 'text-phosphor' : isActive ? 'text-hud-amber' : 'text-dim/60')
                      }
                    >
                      {isDone ? '■' : isActive ? SPIN[tick % 4] : skipped ? '–' : '○'}
                    </span>
                    <span className={isDone ? 'text-phosphor' : isActive ? 'text-white' : 'text-dim'}>{label}</span>
                    <span className="min-w-0 basis-full truncate pl-6 text-[10px] tracking-wider sm:ml-auto sm:basis-auto sm:pl-0 sm:text-right">
                      {isDone ? (
                        <Decrypt text={metric(got, stage)} className="text-white/85" />
                      ) : isActive ? (
                        <span className="text-hud-amber">{word}…</span>
                      ) : skipped ? (
                        <span className="text-dim">skipped</span>
                      ) : null}
                    </span>
                  </div>
                  {isActive && <p className="mt-1 truncate pl-6 font-mono text-[10px] text-dim">{call}</p>}
                </li>
              );
            })}
          </ol>

          {score && score.top.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] tracking-[0.35em] text-dim">LOCKED TARGETS</p>
              <ul className="space-y-1.5">
                {score.top.map((t, i) => (
                  <li key={i} className="hacker-log-line flex items-center gap-3 font-mono text-xs">
                    <span className="text-dim">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <Decrypt text={`${t.company} · ${t.title}`} className="text-white" />
                    </span>
                    <span className="font-extrabold text-phosphor">{t.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Log */}
      <div className="mt-6 border border-phosphor/15 bg-black/70 px-4 py-3 font-mono text-[11px] leading-6">
        {log.length === 0 && running && <p className="text-dim">λ connecting to the pipeline…</p>}
        {log.map((l) => (
          <p key={l.id} className="hacker-log-line truncate">
            <span className="text-[#FF2A6D]">λ </span>
            <span className="text-white/70">{l.text}</span>
            <span className="text-dim"> ⟶ </span>
            <span className="text-phosphor">{l.value}</span>
          </p>
        ))}
        {error && <p className="hacker-log-line text-hud-red">! {error}</p>}
      </div>

      {(done || error) && (
        <motion.div
          initial={still ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="font-mono text-sm">
            {done ? (
              done.total ? (
                <>
                  <span className="font-extrabold text-phosphor">SCAN COMPLETE</span>
                  <span className="text-dim">
                    {' '}
                    · {done.total} scored · +{done.vaulted} in the Vault
                    {done.retired ? ` · ${done.retired} closed cleared` : ''}
                  </span>
                </>
              ) : (
                <span className="text-hud-amber">{done.message || 'No jobs to score yet.'}</span>
              )
            ) : (
              <span className="text-hud-red">SCAN FAILED</span>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="bg-phosphor px-6 py-2.5 font-mono text-[11px] font-bold tracking-[0.25em] text-black transition-colors hover:bg-[#33FF66]"
          >
            {done && done.vaulted ? 'OPEN THE VAULT ▸' : 'CLOSE'}
          </button>
        </motion.div>
      )}
    </Modal>
  );
}
