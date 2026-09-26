'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { ScoreMeter, SkillChips } from './SkillChips';
import { formatSalary, timeAgo, type MatchAction, type MatchedJob } from './types';

const badge = 'border px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em]';

export function VaultCard({
  match,
  onAction,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const { job } = match;
  const facts = [
    job.location,
    job.work_type?.toUpperCase(),
    job.experience_required ? 'EXP ' + job.experience_required : null,
    formatSalary(job),
    job.posted_at ? 'posted ' + timeAgo(job.posted_at) : null,
    job.company.source ? 'via ' + job.company.source : null,
  ].filter(Boolean);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      className="group relative border border-phosphor/30 bg-black/75 p-5 shadow-[0_0_40px_rgba(0,255,65,0.04)] transition-colors hover:border-phosphor/60 sm:p-6"
    >
      <Brackets />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={badge + ' border-phosphor/40 bg-phosphor/10 text-phosphor'}>
              {job.company.name.toUpperCase()}
            </span>
            {match.auto_saved && <span className={badge + ' border-hud-cyan/40 text-hud-cyan'}>AUTO-MATCHED</span>}
            {!job.is_active && <span className={badge + ' border-hud-red/40 text-hud-red'}>POSTING CLOSED</span>}
          </div>
          <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">{job.title}</h3>
          <p className="mt-1.5 font-mono text-[11px] text-dim">{facts.join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} maxMatching={8} maxMissing={5} />
          <p className="mt-4 text-sm leading-relaxed text-dim">
            <span className="text-phosphor">&gt; </span>
            {match.reasoning}
          </p>
          {job.description && (
            <>
              <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="mt-4 font-mono text-[10px] font-bold tracking-[0.25em] text-phosphor/80 transition-colors hover:text-phosphor"
              >
                {open ? '[-] HIDE BRIEFING' : '[+] FULL BRIEFING'}
              </button>
              {open && (
                <div className="custom-scrollbar mt-3 max-h-[480px] overflow-y-auto whitespace-pre-line border border-phosphor/15 bg-black/80 p-4 text-sm leading-relaxed text-ink/80">
                  {job.description}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-44">
          <ScoreMeter score={match.score} />
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction(match.id, 'APPLY')}
            className="mt-2 bg-phosphor py-2 text-center font-mono text-[11px] font-bold tracking-[0.2em] text-black shadow-[0_0_18px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66]"
          >
            APPLY ↗
          </a>
          <button
            onClick={() => onAction(match.id, 'REMOVE_SAVE')}
            title="Remove from Vault (it will not come back)"
            className="border border-phosphor/15 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-dim transition-colors hover:border-hud-red/60 hover:text-hud-red"
          >
            REMOVE
          </button>
        </div>
      </div>
    </motion.article>
  );
}
