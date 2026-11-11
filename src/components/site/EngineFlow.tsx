'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HudPanel } from '@/components/hud/Hud';
import { CATALOG } from '@/lib/scraper/catalog';

// INSIDE THE ENGINE: the whole backend as one scroll. The left rail stays put and lights each stage as its card on the
// right reaches the middle of the screen; every card prints what that stage really does, as a short log.
const FLOW: { code: string; title: string; where: string; body: string; log: string[] }[] = [
  {
    code: 'SRC',
    title: 'Sources',
    where: 'Every 6 hours · Vercel Cron',
    body: `${CATALOG.sources} adapters read openings straight from company hiring systems (Greenhouse, Lever, Ashby, Workday, SmartRecruiters and more) plus clean job boards and your own job-alert emails.`,
    log: [
      `GET  boards-api.greenhouse.io  → 200  (${CATALOG.tracked} companies)`,
      'GET  api.lever.co/v0/postings  → 200',
      'MAIL indeed alert · 4 jobs parsed',
    ],
  },
  {
    code: 'CLN',
    title: 'Clean',
    where: 'Scraper · posting guard',
    body: 'Duplicates merged, reposts and dead links dropped, experience read from the description, salary and remote/hybrid detected. Senior roles stay away from freshers.',
    log: ['dedupe   1,284 → 1,031', 'closed   37 postings retired', 'exp      "1-3 yrs" inferred · 812 jobs'],
  },
  {
    code: 'EMB',
    title: 'Understand',
    where: 'Gemini embeddings · pgvector',
    body: 'Each new or changed job becomes a 1,024-number fingerprint of its meaning. Unchanged jobs are skipped by a content hash, so nothing is paid for twice.',
    log: ['hash     964 unchanged · skipped', 'embed    67 new  → vector(1024)', 'store    supabase.pgvector  ✓'],
  },
  {
    code: 'SCR',
    title: 'Score',
    where: 'Matcher · 0 to 100',
    body: 'Your resume meets every open job: meaning, skills you have and miss, the role you want, seniority, city and freshness. Every score comes with its reasons.',
    log: ['cos(resume, jd)  0.61 → 88', 'skills   5/6 · missing kubernetes', 'place    Bengaluru ✓  ·  fresh +4'],
  },
  {
    code: 'VLT',
    title: 'Vault',
    where: 'Your dashboard',
    body: 'Strong matches are saved to your Vault automatically; the rest wait in Discovery, strongest first. Anything you dismiss never comes back.',
    log: ['vault    3 new ≥ 80', 'discover 14 signals ranked', 'notify   "3 strong matches today"'],
  },
  {
    code: 'APL',
    title: 'Apply',
    where: 'Extension · OVERCLOCK · ZERO-DAY',
    body: 'One click opens the real application form already filled with your answers and resume. OVERCLOCK tailors a resume to one job. You always press Submit yourself.',
    log: ['fill     14/15 fields · 1 for you', 'attach   resume_tailored.pdf', 'wait     you press Submit'],
  },
  {
    code: 'TRK',
    title: 'Track',
    where: 'Gmail (read-only) · C2 · OPS',
    body: 'Interview invites and rejections in your inbox move each application along on its own, so your pipeline is always up to date.',
    log: [
      'gmail    "Interview invitation" → INTERVIEW',
      'gmail    "Unfortunately…"  → CLOSED',
      'ops      funnel updated',
    ],
  },
];

export function EngineFlow() {
  const [active, setActive] = useState(0);
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: '-45% 0px -45% 0px' }, // a card counts once it crosses the middle of the screen
    );
    cards.current.forEach((c) => c && io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      {/* The rail: sticky on wide screens. */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <HudPanel
          label="ENGINE://LIVE"
          status={`STAGE ${active + 1}/${FLOW.length}`}
          tone="ok"
          bodyClassName="p-5 sm:p-6"
        >
          <ol className="relative">
            <span className="absolute bottom-4 left-[19px] top-4 w-px bg-phosphor/15" aria-hidden="true" />
            <motion.span
              className="absolute left-[19px] top-4 w-px bg-phosphor shadow-[0_0_10px_rgb(var(--glow)/0.8)]"
              animate={{
                height: `calc(${(active / (FLOW.length - 1)) * 100}% - ${(active / (FLOW.length - 1)) * 32}px)`,
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            />
            {FLOW.map((f, i) => {
              const on = i === active;
              const done = i < active;
              return (
                <li key={f.code} className="relative flex items-center gap-4 py-2.5">
                  <motion.span
                    animate={{ scale: on ? 1.12 : 1 }}
                    className={
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-[10px] font-bold tracking-widest transition-colors duration-300 ' +
                      (on
                        ? 'border-phosphor bg-phosphor text-black shadow-[0_0_18px_rgb(var(--glow)/0.6)]'
                        : done
                          ? 'border-phosphor/60 bg-black text-phosphor'
                          : 'border-phosphor/20 bg-black text-dim')
                    }
                  >
                    {f.code}
                    {on && (
                      <motion.span
                        className="absolute inset-0 border border-phosphor"
                        initial={{ opacity: 0.8, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        aria-hidden="true"
                      />
                    )}
                  </motion.span>
                  <span className="min-w-0">
                    <span
                      className={
                        'block font-mono text-sm font-bold tracking-[0.15em] transition-colors ' +
                        (on ? 'text-white' : done ? 'text-phosphor/80' : 'text-dim')
                      }
                    >
                      {f.title.toUpperCase()}
                    </span>
                    <span className="block truncate text-[11px] text-dim">{f.where}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </HudPanel>
      </div>

      {/* The stages. */}
      <div className="space-y-6 lg:space-y-[14vh] lg:py-[8vh]">
        {FLOW.map((f, i) => (
          <motion.div
            key={f.code}
            ref={(el) => {
              cards.current[i] = el;
            }}
            data-i={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <HudPanel
              label={`STAGE ${String(i + 1).padStart(2, '0')} · ${f.code}`}
              status={f.where.split(' · ')[0].toUpperCase()}
              tone={i === active ? 'ok' : 'idle'}
              bodyClassName="p-6"
            >
              <h3 className="font-mono text-2xl font-extrabold tracking-tight text-white">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-dim">{f.body}</p>
              <div className="mt-5 border border-phosphor/15 bg-black/60 p-4 font-mono text-[11.5px] leading-6">
                {f.log.map((line, j) => (
                  <motion.p
                    key={line}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + j * 0.25, duration: 0.4 }}
                    className="truncate text-phosphor/85"
                  >
                    <span className="text-dim">$ </span>
                    {line}
                  </motion.p>
                ))}
              </div>
            </HudPanel>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
