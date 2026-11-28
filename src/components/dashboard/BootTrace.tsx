'use client';

import { useEffect, useState } from 'react';

// While a dashboard tab loads, show the request actually travelling: your session, the API route, the tables it
// reads and the shaping it does, one hop at a time. The steps are the real path of GET /api/dashboard.

type Tab = 'DISCOVERY' | 'VAULT' | 'OVERCLOCK' | 'OPS' | 'UPSKILL';

const COMMON = [
  ['CLERK', 'session token verified · operator signed in'],
  ['API', 'GET /api/dashboard · edge → node runtime'],
] as const;

const PATH: Record<Tab, readonly (readonly [string, string])[]> = {
  DISCOVERY: [
    ['SUPABASE', 'match_scores ⋈ jobs ⋈ companies · status = new'],
    ['GATE', 'drop closed, stale (>120d) and already-applied roles'],
    ['CAP', 'two roles per company · strongest first'],
    ['RANK', 'score = 60% meaning + 40% skills'],
  ],
  VAULT: [
    ['SUPABASE', 'match_scores · status = saved'],
    ['VERIFY', 'apply links checked · dead postings retired'],
    ['RANK', 'auto-vault ≥ your threshold, then your own saves'],
  ],
  OVERCLOCK: [
    ['SUPABASE', 'matches 50–79 · tailored_resumes'],
    ['DIFF', 'missing skills vs the job description'],
    ['QUEUE', 'resume rewrites ready to run'],
  ],
  OPS: [
    ['SUPABASE', 'match_scores · status = applied · stage'],
    ['GMAIL', 'recruiter replies matched to applications'],
    ['TIMELINE', 'applied date · time · next step'],
  ],
  UPSKILL: [
    ['SUPABASE', 'missing_skills across your matches'],
    ['COUNT', 'skills that block the most jobs'],
    ['PLAN', 'what to learn first'],
  ],
};

export function BootTrace({ tab }: { tab: Tab }) {
  const steps = [...COMMON, ...PATH[tab], ['RENDER', 'cards hydrated']] as const;
  const [at, setAt] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAt((n) => (n < steps.length - 1 ? n + 1 : n)), 420);
    return () => clearInterval(id);
  }, [tab, steps.length]);

  return (
    <div className="boot-trace relative overflow-hidden border border-phosphor/20 bg-black/60 p-5" aria-busy="true">
      <style>{`
        .boot-trace .wire{background:repeating-linear-gradient(90deg,rgb(0 255 65/.25) 0 6px,transparent 6px 10px)}
        .boot-trace .pkt{animation:bt-run 1.1s cubic-bezier(.6,0,.3,1) infinite;box-shadow:0 0 12px 3px rgb(0 255 65/.7)}
        .boot-trace .live{animation:bt-blink .8s steps(2) infinite}
        .boot-trace .sweep{animation:bt-sweep 2.4s linear infinite;background:linear-gradient(90deg,transparent,rgb(0 255 65/.08),transparent)}
        @keyframes bt-run{from{left:0}to{left:calc(100% - 6px)}}
        @keyframes bt-blink{50%{opacity:0}}
        @keyframes bt-sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
        @media (prefers-reduced-motion: reduce){.boot-trace *{animation:none!important}}
      `}</style>
      <div className="sweep pointer-events-none absolute inset-0" aria-hidden="true" />
      <p className="font-mono text-[10px] tracking-[0.3em] text-phosphor/70">
        UPLINK://{tab} <span className="live text-phosphor">▌</span>
      </p>

      {/* The hops as a wire with a packet running across the current one. */}
      <div className="mt-4 flex items-center gap-0 overflow-x-auto pb-1" aria-hidden="true">
        {steps.map(([node], i) => (
          <div key={node + i} className="flex min-w-0 items-center">
            <span
              className={
                'shrink-0 border px-2 py-1 font-mono text-[9px] tracking-[0.2em] transition-colors duration-300 ' +
                (i < at
                  ? 'border-phosphor/60 bg-phosphor/10 text-phosphor'
                  : i === at
                    ? 'border-phosphor bg-phosphor text-black'
                    : 'border-phosphor/15 text-phosphor/30')
              }
            >
              {node}
            </span>
            {i < steps.length - 1 && (
              <span className="wire relative mx-1 h-px w-8 shrink-0 sm:w-12">
                {i === at && <i className="pkt absolute -top-[2px] h-[5px] w-[6px] bg-phosphor" />}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* The log: each hop prints its line as the packet reaches it. */}
      <ol className="mt-4 space-y-1 font-mono text-[11px] leading-relaxed">
        {steps.slice(0, at + 1).map(([node, line], i) => (
          <li key={node + i} className={i === at ? 'text-phosphor' : 'text-phosphor/50'}>
            <span className="text-phosphor/35">{String(i + 1).padStart(2, '0')}</span>{' '}
            <span className="text-phosphor/80">[{node}]</span> {line}
            {i === at && <span className="live ml-1">_</span>}
            {i < at && <span className="ml-2 text-phosphor/60">✓</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
