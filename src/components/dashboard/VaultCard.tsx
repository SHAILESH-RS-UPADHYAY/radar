'use client';

import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { BriefingButton, JobTitle, openOnClick, ScoreMeter, SkillChips } from './SkillChips';
import { formatSalary, postedTag, timeAgo, type MatchAction, type MatchedJob } from './types';

const badge = 'border px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em]';

export function VaultCard({
  match,
  onAction,
  onRun,
  onOpen,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
  /** Opens the HACK flow (assisted apply) for this job. */
  onRun: (id: string) => void;
  /** Opens the JD terminal for this match. */
  onOpen?: (id: string) => void;
}) {
  const { job } = match;
  const open = onOpen ? () => onOpen(match.id) : undefined;
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
      onClick={openOnClick(open)}
      className={
        'group relative border border-phosphor/30 bg-black/75 p-5 shadow-[0_0_40px_rgba(0,255,65,0.04)] transition-colors hover:border-phosphor/60 sm:p-6' +
        (open ? ' cursor-pointer' : '')
      }
    >
      <Brackets />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={badge + ' border-phosphor/40 bg-phosphor/10 text-phosphor'}>
              {job.company.name.toUpperCase()}
            </span>
            {postedTag(match) === 'NEW' && (
              <span className={badge + ' border-hud-amber/50 text-hud-amber'}>NEW · APPLY EARLY</span>
            )}
            {match.auto_saved && <span className={badge + ' border-hud-cyan/40 text-hud-cyan'}>AUTO-MATCHED</span>}
            {!job.is_active && <span className={badge + ' border-hud-red/40 text-hud-red'}>POSTING CLOSED</span>}
          </div>
          <JobTitle title={job.title} onOpen={open} className="text-lg font-bold leading-snug text-white sm:text-xl" />
          <p className="mt-1.5 font-mono text-[11px] text-dim">{facts.join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} maxMatching={8} maxMissing={5} />
          <p className="mt-4 text-sm leading-relaxed text-dim">
            <span className="text-phosphor">&gt; </span>
            {match.reasoning}
          </p>
          {open && <BriefingButton onOpen={open} />}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-44">
          <ScoreMeter score={match.score} />
          <button
            type="button"
            onClick={() => onRun(match.id)}
            className="group/run mt-2 flex items-center justify-center gap-2.5 rounded-full border border-phosphor bg-phosphor/10 py-2.5 font-mono text-[11px] font-bold tracking-[0.3em] text-phosphor shadow-[0_0_22px_rgba(0,255,65,0.35)] transition-all hover:bg-phosphor hover:text-black hover:shadow-[0_0_32px_rgba(0,255,65,0.6)]"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phosphor group-hover/run:bg-black" />
            <span className="glitch" data-text="HACK ▸">
              HACK ▸
            </span>
          </button>
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction(match.id, 'APPLY')}
            className="text-center font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-phosphor"
          >
            direct apply ↗
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
