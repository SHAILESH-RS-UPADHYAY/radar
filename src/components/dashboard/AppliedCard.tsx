'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { timeAgo, type MatchAction, type MatchedJob } from './types';

export function AppliedCard({
  match,
  onAction,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [8, -8]);
  const rotateY = useTransform(x, [-100, 100], [-8, 8]);
  const { job } = match;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left - r.width / 2);
        y.set(e.clientY - r.top - r.height / 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="relative flex flex-col border border-hud-cyan/30 bg-black/75 p-5 shadow-[0_0_40px_rgba(34,211,238,0.05)]"
    >
      <Brackets className="border-hud-cyan" />
      <div className="mb-4 flex items-center justify-between gap-2 font-mono text-[10px] font-bold tracking-[0.2em]">
        <span className="border border-hud-cyan/40 bg-hud-cyan/10 px-2 py-1 text-hud-cyan">
          {job.company.name.toUpperCase()}
        </span>
        <span className="flex items-center gap-1.5 text-hud-cyan">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hud-cyan" /> DEPLOYED
        </span>
      </div>
      <h3 className="flex-1 text-base font-bold leading-snug text-white sm:text-lg">{job.title}</h3>
      <p className="mt-2 mb-5 font-mono text-[11px] text-dim">
        {[job.location, match.status_changed_at ? 'applied ' + timeAgo(match.status_changed_at) : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="flex gap-2 font-mono text-[10px] font-bold tracking-[0.2em]">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 border border-hud-cyan/40 py-2 text-center text-hud-cyan transition-colors hover:bg-hud-cyan/10"
        >
          OPEN ↗
        </a>
        <button
          onClick={() => onAction(match.id, 'REMOVE_APPLY')}
          className="flex-1 border border-phosphor/15 py-2 text-dim transition-colors hover:border-phosphor/50 hover:text-phosphor"
        >
          ← VAULT
        </button>
      </div>
    </motion.article>
  );
}
