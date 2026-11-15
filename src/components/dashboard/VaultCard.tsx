'use client';

import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { BriefingButton, JobFacts, JobTitle, openOnClick, ScoreMeter, SkillChips } from './SkillChips';
import { CoachPanel } from './CoachPanel';
import { postedTag, type MatchAction, type MatchedJob } from './types';

const PILL =
  'group/run mt-2 flex items-center justify-center gap-2.5 rounded-full border border-phosphor bg-phosphor/10 py-2.5 font-mono text-[11px] font-bold tracking-[0.3em] text-phosphor shadow-[0_0_22px_rgb(var(--glow)/0.35)] transition-all hover:bg-phosphor hover:text-black hover:shadow-[0_0_32px_rgb(var(--glow)/0.6)]';
const badge = 'border px-2 py-1 font-mono text-[10px] font-bold tracking-[0.2em]';

export function VaultCard({
  match,
  statedExp,
  onAction,
  onInfiltrate,
  onOpen,
  onHack,
}: {
  match: MatchedJob;
  statedExp?: string | null;
  onAction: (id: string, action: MatchAction) => void;
  /** INFILTRATE: the step-by-step run for this job (tailored resume, the form's answers, then the form). */
  onInfiltrate: (id: string) => void;
  /** Opens the JD terminal for this match. */
  onOpen?: (id: string) => void;
  /** ↯ HACK (with the RADAR extension): one click, the form opens filled; you press Submit. */
  onHack?: (id: string) => void;
}) {
  const { job } = match;
  const open = onOpen ? () => onOpen(match.id) : undefined;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      onClick={openOnClick(open)}
      className={
        'group relative border border-phosphor/30 bg-black/75 p-5 shadow-[0_0_40px_rgb(var(--glow)/0.04)] transition-colors hover:border-phosphor/60 sm:p-6' +
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
            {job.company.category && job.company.category !== 'Board' && (
              <span
                className={
                  badge +
                  (job.company.category === 'Startup'
                    ? ' border-hud-cyan/50 bg-hud-cyan/10 text-hud-cyan'
                    : job.company.category === 'Growth'
                      ? ' border-hud-violet/50 bg-hud-violet/10 text-hud-violet'
                      : ' border-phosphor/40 bg-phosphor/10 text-phosphor')
                }
              >
                {job.company.category.toUpperCase()}
              </span>
            )}
            {postedTag(match) === 'NEW' && (
              <span className={badge + ' border-hud-amber/50 text-hud-amber'}>NEW · APPLY EARLY</span>
            )}
            {match.auto_saved && <span className={badge + ' border-hud-cyan/40 text-hud-cyan'}>AUTO-MATCHED</span>}
            {!job.is_active && <span className={badge + ' border-hud-red/40 text-hud-red'}>POSTING CLOSED</span>}
          </div>
          <JobTitle title={job.title} onOpen={open} className="text-lg font-bold leading-snug text-white sm:text-xl" />
          <JobFacts job={job} statedExp={statedExp} />
          <SkillChips matching={match.matching_skills} missing={match.missing_skills} maxMatching={8} maxMissing={5} />
          <p className="mt-4 text-sm leading-relaxed text-dim">
            <span className="text-phosphor">&gt; </span>
            {match.reasoning}
          </p>
          {open && <BriefingButton onOpen={open} />}
          {/* A referral before applying beats a cold application. */}
          <CoachPanel matchId={match.id} stage="vault" kinds={['referral']} />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-44">
          <ScoreMeter score={match.score} />
          {/* ↯ HACK first: the one-click run. INFILTRATE (step by step) under it. */}
          {onHack && (
            <button
              type="button"
              onClick={() => onHack(match.id)}
              title="One click: the form opens filled with your answers and resume. You press Submit."
              className={PILL}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phosphor group-hover/run:bg-black" />
              <span className="glitch" data-text="↯ HACK">
                ↯ HACK
              </span>
            </button>
          )}
          {/* Without the extension the real posting comes first: you can check the job exists before anything else. */}
          {!onHack && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noreferrer"
              title="Opens the employer's own posting in a new tab"
              className={PILL}
            >
              VIEW JOB ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => onInfiltrate(match.id)}
            title="Step by step: the tailored resume, every answer of the form to review, then the form"
            className="border border-phosphor/40 py-2 font-mono text-[11px] font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10"
          >
            INFILTRATE ▸
          </button>
          <button
            onClick={() => onAction(match.id, 'REMOVE_SAVE')}
            title="Remove from Vault (it will not come back)"
            className="border border-phosphor/15 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-dim transition-colors hover:border-hud-red/60 hover:text-hud-red"
          >
            REMOVE
          </button>
          <button
            onClick={() => onAction(match.id, 'MARK_APPLIED')}
            title="You applied to this outside RADAR: log it in C2 · OPS (it counts toward the company's two)"
            className="py-1 font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-phosphor"
          >
            ALREADY APPLIED
          </button>
        </div>
      </div>
    </motion.article>
  );
}
