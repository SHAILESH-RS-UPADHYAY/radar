'use client';

import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { BriefingButton, JobTitle, openOnClick, ScoreMeter, SkillChips } from './SkillChips';
import { formatSalary, postedTag, timeAgo, type MatchAction, type MatchedJob } from './types';

export function DiscoveryCard({
  match,
  onAction,
  onOpen,
  onInfiltrate,
  onHack,
}: {
  match: MatchedJob;
  onAction: (id: string, action: MatchAction) => void;
  /** Opens the JD terminal for this match. */
  onOpen?: (id: string) => void;
  /** INFILTRATE: the step-by-step run (tailored resume, the form's answers, then the form). */
  onInfiltrate: (id: string) => void;
  /** ↯ HACK (with the RADAR extension): one click, the form opens filled; you press Submit. */
  onHack?: (id: string) => void;
}) {
  const { job } = match;
  const open = onOpen ? () => onOpen(match.id) : undefined;
  const meta = [job.location, job.department, formatSalary(job), timeAgo(job.posted_at)].filter(Boolean);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      transition={{ duration: 0.2 }}
      onClick={openOnClick(open)}
      className={
        'group relative border border-phosphor/15 bg-black/70 p-5 transition-colors hover:border-phosphor/45 sm:p-6' +
        (open ? ' cursor-pointer' : '')
      }
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
            {postedTag(match) === 'NEW' && (
              <span className="border border-hud-amber/50 px-2 py-1 text-hud-amber">NEW · APPLY EARLY</span>
            )}
            {job.company.source && <span className="text-dim">via {job.company.source}</span>}
          </div>
          <JobTitle title={job.title} onOpen={open} className="text-lg font-bold leading-snug text-white sm:text-xl" />
          <p className="mt-1.5 font-mono text-[11px] text-dim">{meta.join(' · ')}</p>
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} />
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
            onClick={() => (onHack ? onHack(match.id) : onInfiltrate(match.id))}
            title={
              onHack
                ? 'One click: the form opens filled with your answers and resume. You press Submit.'
                : 'Step by step: the tailored resume, every answer of the form to review, then the form'
            }
            className="mt-2 bg-phosphor py-2 text-center font-mono text-[11px] font-bold tracking-[0.25em] text-black transition-colors hover:bg-[#33FF66]"
          >
            {onHack ? '↯ HACK' : 'INFILTRATE ▸'}
          </button>
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
