'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
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
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);
  const { job } = match;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
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
      className="bg-[#111] border border-[#10B981]/30 rounded-2xl p-6 flex flex-col shadow-[0_0_30px_rgba(16,185,129,0.05)]"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#10B98120] text-[#10B981]">
          {job.company.name}
        </span>
        <span className="text-xs font-bold px-2 py-1 bg-white text-black rounded uppercase">Active</span>
      </div>
      <h3 className="text-white font-bold text-lg mb-1 leading-tight flex-1">{job.title}</h3>
      <p className="text-xs text-[#666] mb-6">
        {[job.location, match.status_changed_at ? 'Applied ' + timeAgo(match.status_changed_at) : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="flex gap-2">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 rounded border border-[#333] text-[#AAA] hover:text-white transition-all text-xs font-bold tracking-wider uppercase"
        >
          OPEN
        </a>
        <button
          onClick={() => onAction(match.id, 'REMOVE_APPLY')}
          className="flex-1 py-2 rounded border border-[#333] hover:border-[#FF4444] hover:text-[#FF4444] text-[#666] transition-all text-xs font-bold tracking-wider uppercase"
        >
          BACK TO VAULT
        </button>
      </div>
    </motion.div>
  );
}
