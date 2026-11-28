'use client';

import { useEffect, useState } from 'react';

// While a dashboard tab loads, a sheet of liquid glass lies over the page (the grid and colour still show through)
// and the request travels down it: your session, the API route, the tables it reads, the gates and the ranking,
// one hop at a time. The steps are the real path of GET /api/dashboard.

type Tab = 'DISCOVERY' | 'VAULT' | 'OVERCLOCK' | 'OPS' | 'UPSKILL';

const COMMON = [
  ['CLERK', 'session token verified', 'operator signed in'],
  ['EDGE → API', 'GET /api/dashboard', 'node runtime · Vercel'],
] as const;

const PATH: Record<Tab, readonly (readonly [string, string, string])[]> = {
  DISCOVERY: [
    ['SUPABASE', 'match_scores ⋈ jobs ⋈ companies', 'status = new'],
    ['GATE', 'closed · stale >120d · applied', 'dropped'],
    ['CAP', 'two roles per company', 'strongest first'],
    ['RANK', '60% meaning + 40% skills', 'sorted'],
  ],
  VAULT: [
    ['SUPABASE', 'match_scores · status = saved', 'your vault'],
    ['VERIFY', 'apply links checked', 'dead postings retired'],
    ['RANK', 'auto-vault ≥ threshold', 'then your saves'],
  ],
  OVERCLOCK: [
    ['SUPABASE', 'matches 50–79 · tailored_resumes', 'near misses'],
    ['DIFF', 'missing skills vs the JD', 'gaps found'],
    ['QUEUE', 'resume rewrites', 'ready to run'],
  ],
  OPS: [
    ['SUPABASE', 'status = applied · stage', 'your pipeline'],
    ['GMAIL', 'recruiter replies', 'matched to applications'],
    ['TIMELINE', 'applied date · time', 'next step'],
  ],
  UPSKILL: [
    ['SUPABASE', 'missing_skills across matches', 'collected'],
    ['COUNT', 'skills blocking the most jobs', 'ranked'],
    ['PLAN', 'what to learn first', 'drafted'],
  ],
};

const HOP_MS = 520;

export function BootTrace({ tab }: { tab: Tab }) {
  const steps = [...COMMON, ...PATH[tab], ['RENDER', 'cards hydrated', 'on your screen']] as const;
  const [at, setAt] = useState(0);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const hop = setInterval(() => setAt((n) => (n < steps.length - 1 ? n + 1 : n)), HOP_MS);
    const clock = setInterval(() => setMs(Math.round(performance.now() - started)), 47);
    return () => {
      clearInterval(hop);
      clearInterval(clock);
    };
  }, [tab, steps.length]);

  return (
    <div className="lg-boot pointer-events-none fixed inset-0 z-30" aria-busy="true" aria-live="polite">
      <style>{`
        .lg-boot{animation:lg-in .35s ease both}
        .lg-boot .sheet{position:absolute;inset:0;
          background:linear-gradient(160deg,rgb(var(--glow)/.07),transparent 40%,rgb(34 211 238/.05) 75%,transparent);
          backdrop-filter:blur(14px) saturate(1.6) brightness(.85);-webkit-backdrop-filter:blur(14px) saturate(1.6) brightness(.85)}
        .lg-boot .blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.35;mix-blend-mode:screen}
        .lg-boot .b1{width:38vw;height:38vw;left:-6vw;top:8vh;background:rgb(var(--glow)/.55);animation:lg-drift1 9s ease-in-out infinite}
        .lg-boot .b2{width:30vw;height:30vw;right:-4vw;top:40vh;background:rgb(34 211 238/.45);animation:lg-drift2 11s ease-in-out infinite}
        .lg-boot .caustic{position:absolute;inset:-20%;opacity:.07;
          background:repeating-radial-gradient(circle at 30% 40%,rgb(255 255 255/.9) 0 1px,transparent 1px 22px);
          animation:lg-caustic 14s linear infinite}
        .lg-boot .pill{position:relative;border-radius:14px;overflow:hidden;
          background:linear-gradient(180deg,rgb(255 255 255/.10),rgb(255 255 255/.03));
          border:1px solid rgb(255 255 255/.14);
          box-shadow:inset 0 1px 0 rgb(255 255 255/.25),inset 0 -1px 0 rgb(0 0 0/.35),0 10px 30px rgb(0 0 0/.35);
          backdrop-filter:blur(10px) saturate(1.8);-webkit-backdrop-filter:blur(10px) saturate(1.8);
          transition:transform .45s cubic-bezier(.2,.8,.2,1),border-color .3s,box-shadow .3s,opacity .3s}
        .lg-boot .pill:before{content:"";position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgb(255 255 255/.18) 45%,transparent 60%);
          transform:translateX(-120%)}
        .lg-boot .pill.now{border-color:rgb(var(--glow)/.75);transform:scale(1.03);
          box-shadow:inset 0 1px 0 rgb(255 255 255/.3),0 0 0 1px rgb(var(--glow)/.35),0 0 36px rgb(var(--glow)/.35),0 14px 40px rgb(0 0 0/.4)}
        .lg-boot .pill.now:before{animation:lg-shine 1.1s ease-in-out infinite}
        .lg-boot .pill.wait{opacity:.38}
        .lg-boot .pipe{position:relative;width:2px;height:22px;margin:0 auto;
          background:linear-gradient(rgb(var(--glow)/.15),rgb(var(--glow)/.5),rgb(var(--glow)/.15))}
        .lg-boot .pipe.lit{background:rgb(var(--glow)/.7);box-shadow:0 0 10px rgb(var(--glow)/.6)}
        .lg-boot .pkt{position:absolute;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;
          background:radial-gradient(circle,#fff 0 25%,rgb(var(--glow)) 55%,transparent 70%);
          box-shadow:0 0 14px 4px rgb(var(--glow)/.7);animation:lg-fall ${HOP_MS}ms linear infinite}
        .lg-boot .live{animation:lg-blink .8s steps(2) infinite}
        @keyframes lg-in{from{opacity:0}}
        @keyframes lg-drift1{50%{transform:translate(8vw,6vh) scale(1.15)}}
        @keyframes lg-drift2{50%{transform:translate(-10vw,-8vh) scale(.9)}}
        @keyframes lg-caustic{to{transform:rotate(360deg)}}
        @keyframes lg-shine{to{transform:translateX(120%)}}
        @keyframes lg-fall{from{top:-4px}to{top:calc(100% - 4px)}}
        @keyframes lg-blink{50%{opacity:0}}
        @media (prefers-reduced-motion: reduce){.lg-boot *{animation:none!important;transition:none!important}}
      `}</style>

      {/* The glass itself: the page shows through, blurred, with slow light moving under it. */}
      <div className="sheet" />
      <div className="blob b1" aria-hidden="true" />
      <div className="blob b2" aria-hidden="true" />
      <div className="caustic" aria-hidden="true" />

      {/* The request, travelling down the glass. */}
      <div className="relative mx-auto mt-24 w-[min(520px,92vw)] font-mono">
        <div className="mb-4 flex items-baseline justify-between text-[10px] tracking-[0.3em] text-phosphor/80">
          <span>
            UPLINK://{tab} <span className="live">▌</span>
          </span>
          <span className="tabular-nums text-phosphor">
            T+{(ms / 1000).toFixed(2)}s · {Math.min(at + 1, steps.length)}/{steps.length}
          </span>
        </div>
        {steps.map(([node, what, result], i) => (
          <div key={node + i}>
            <div className={'pill px-4 py-2.5 ' + (i === at ? 'now' : i > at ? 'wait' : '')}>
              <div className="flex items-center justify-between gap-3">
                <span className={'text-[10px] tracking-[0.25em] ' + (i <= at ? 'text-phosphor' : 'text-phosphor/50')}>
                  {String(i + 1).padStart(2, '0')} · {node}
                </span>
                <span className="text-[10px] text-white/50">
                  {i < at ? '✓ ' + result : i === at ? 'in flight…' : 'queued'}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] text-white/85">{what}</p>
            </div>
            {i < steps.length - 1 && (
              <div className={'pipe ' + (i < at ? 'lit' : '')}>{i === at && <i className="pkt" />}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
