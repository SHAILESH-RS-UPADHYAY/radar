'use client';

import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { ScoreMeter, SkillChips } from './SkillChips';
import { formatSalary, timeAgo, type MatchAction, type MatchedJob } from './types';

export function DiscoveryCard({
  match,
  onAction,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const { job } = match;
  const meta = [job.location, job.department, formatSalary(job), timeAgo(job.posted_at)].filter(Boolean);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      transition={{ duration: 0.2 }}
      className="group relative border border-phosphor/15 bg-black/70 p-5 transition-colors hover:border-phosphor/45 sm:p-6"
    >
      <Brackets className="border-phosphor opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.2em]">
            <span className="border border-phosphor/40 bg-phosphor/10 px-2 py-1 font-bold text-phosphor">
              {job.company.name.toUpperCase()}
            </span>
            {job.work_type && (
              <span
                className={
                  'border px-2 py-1 ' +
                  (job.work_type === 'remote' ? 'border-hud-cyan/40 text-hud-cyan' : 'border-phosphor/15 text-dim')
                }
              >
                {job.work_type.toUpperCase()}
              </span>
            )}
            {job.company.source && <span className="text-dim">via {job.company.source}</span>}
          </div>
          <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">{job.title}</h3>
          <p className="mt-1.5 font-mono text-[11px] text-dim">{meta.join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} />
          <p className="mt-4 text-sm leading-relaxed text-dim">
            <span className="text-phosphor">&gt; </span>
            {match.reasoning}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-44">
          <ScoreMeter score={match.score} />
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction(match.id, 'APPLY')}
            className="mt-2 bg-phosphor py-2 text-center font-mono text-[11px] font-bold tracking-[0.2em] text-black transition-colors hover:bg-[#33FF66]"
          >
            APPLY ↗
          </a>
          <button
            onClick={() => onAction(match.id, 'SAVE')}
            className="border border-phosphor/40 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10"
          >
            + TO VAULT
          </button>
          <button
            onClick={() => onAction(match.id, 'DISMISS')}
            className="py-1 font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-hud-red"
          >
            NOT FOR ME
          </button>
        </div>
      </div>
    </motion.article>
  );
}
