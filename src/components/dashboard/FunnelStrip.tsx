'use client';

import { MotionConfig, motion } from 'framer-motion';
import { HudPanel } from '@/components/hud/Hud';
import { CountUp } from '@/components/hud/CountUp';
import { opsFunnel, type FunnelSplit, type MatchedJob } from './types';

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** One habit, callbacks with it against without it, as two bars. */
function Split({ s }: { s: FunnelSplit }) {
  const bar = (label: string, [hit, of]: [number, number], strong: boolean) => (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 font-mono text-[10px] tracking-[0.15em]">
      <span className="text-dim">{label}</span>
      <span className="h-1.5 bg-phosphor/10">
        {/* Grows from zero when it scrolls in (instant under reduced motion, see MotionConfig below). */}
        <motion.span
          className={
            'block h-full ' + (strong ? 'bg-phosphor shadow-[0_0_10px_rgb(var(--glow)/0.6)]' : 'bg-phosphor/40')
          }
          initial={{ width: 0 }}
          whileInView={{ width: pct(hit, of) + '%' }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      <span className={strong ? 'text-phosphor' : 'text-dim'}>
        {hit}/{of} · {pct(hit, of)}%
      </span>
    </div>
  );
  const better = pct(...s.yes) >= pct(...s.no);
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-phosphor/80">{s.label}</p>
      {bar('WITH', s.yes, better)}
      {bar('WITHOUT', s.no, !better)}
    </div>
  );
}

/** INTEL://FUNNEL — how far applications got, and which habits earned callbacks (screening or further). */
export function FunnelStrip({ applied }: { applied: MatchedJob[] }) {
  const f = opsFunnel(applied);
  const steps: [string, number][] = [
    ['APPLIED', f.applied],
    ['HEARD BACK', f.heardBack],
    ['CALLBACKS', f.callbacks],
    ['INTERVIEWS', f.interviews],
    ['OFFERS', f.offers],
  ];
  return (
    <MotionConfig reducedMotion="user">
      <HudPanel
        label="INTEL://FUNNEL"
        status={`${pct(f.callbacks, f.applied)}% CALLBACK RATE`}
        tone="info"
        className="mb-6"
        bodyClassName="grid items-center gap-6 p-5 lg:grid-cols-[3fr_2fr]"
      >
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {steps.map(([label, n], i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              className="border border-phosphor/15 bg-black/40 px-2 py-3 text-center"
            >
              <CountUp value={n} className="block font-mono text-2xl font-bold text-white" />
              <p className="mt-1 font-mono text-[9px] tracking-[0.2em] text-dim">{label}</p>
              {i > 0 && <p className="font-mono text-[10px] text-phosphor/70">{pct(n, f.applied)}%</p>}
            </motion.li>
          ))}
        </ol>
        <div className="space-y-4">
          {f.splits.length ? (
            f.splits.map((s) => <Split key={s.label} s={s} />)
          ) : (
            <p className="text-sm text-dim">
              Once some applications go out with a tailored resume and some without (or early and late), RADAR compares
              their callback rates here.
            </p>
          )}
        </div>
      </HudPanel>
    </MotionConfig>
  );
}
