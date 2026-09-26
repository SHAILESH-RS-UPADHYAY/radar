'use client';

import { motion } from 'framer-motion';
import { Brackets } from '@/components/hud/Hud';
import { JobTitle, openOnClick, ScoreMeter } from './SkillChips';
import { scoreColor, type MatchedJob, type TailoredSummary } from './types';

const button = 'border px-3 py-2 font-mono text-[10px] font-bold tracking-[0.2em] transition-colors';

/** A near-miss job in OVERCLOCK: current score, the tailored projection once it exists, and the gaps. */
export function OverclockCard({
  match,
  tailored,
  busy,
  onTailor,
  onReview,
  onOpen,
}: {
  match: MatchedJob;
  tailored: TailoredSummary | undefined;
  busy: boolean;
  onTailor: (matchId: string, force: boolean) => void;
  onReview: (tailoredId: string) => void;
  /** Opens the JD terminal for this match. */
  onOpen?: (id: string) => void;
}) {
  const { job } = match;
  const open = onOpen ? () => onOpen(match.id) : undefined;
  const projected = tailored?.projected_score ?? null;
  const delta = projected !== null ? projected - match.score : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80 }}
      onClick={openOnClick(open)}
      className={
        'group relative border border-phosphor/20 bg-black/75 p-5 transition-colors hover:border-hud-amber/50 sm:p-6' +
        (open ? ' cursor-pointer' : '')
      }
    >
      <Brackets className="border-hud-amber opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.2em]">
            <span className="border border-phosphor/40 bg-phosphor/10 px-2 py-1 font-bold text-phosphor">
              {job.company.name.toUpperCase()}
            </span>
            <span className="border border-hud-amber/40 px-2 py-1 text-hud-amber">NEAR MISS</span>
            {match.status === 'saved' && <span className="border border-phosphor/20 px-2 py-1 text-dim">IN VAULT</span>}
          </div>
          <JobTitle title={job.title} onOpen={open} className="text-lg font-bold leading-snug text-white" />
          <p className="mt-1.5 font-mono text-[11px] text-dim">
            {[job.location, job.department].filter(Boolean).join(' · ')}
          </p>
          {match.missing_skills.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] tracking-[0.25em] text-dim">THE POSTING ASKS FOR</p>
              <div className="flex flex-wrap gap-1.5">
                {match.missing_skills.slice(0, 8).map((s) => (
                  <span
                    key={s}
                    className="border border-hud-red/30 bg-hud-red/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-hud-red/90"
                  >
                    - {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-64">
          <ScoreMeter score={match.score} />
          {projected !== null && (
            <div className="font-mono">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] tracking-[0.3em] text-dim">TAILORED</span>
                <span className="text-2xl font-extrabold leading-none" style={{ color: scoreColor(projected) }}>
                  {projected}
                  <span className="text-sm">%</span>
                  {delta !== null && delta !== 0 && (
                    <span className={'ml-2 text-xs ' + (delta > 0 ? 'text-phosphor' : 'text-hud-red')}>
                      {delta > 0 ? '▲' : '▼'}
                      {Math.abs(delta)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
          {tailored && projected === null && (
            <p className="font-mono text-[10px] tracking-[0.2em] text-dim">TAILORED · PROJECTION UNAVAILABLE</p>
          )}

          {busy ? (
            <div className="flex items-center justify-center gap-2 border border-hud-amber/40 py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] text-hud-amber">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-hud-amber/30 border-t-hud-amber" />
              TAILORING · ~1 MIN
            </div>
          ) : tailored ? (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`/api/overclock/${tailored.id}/pdf`}
                className={button + ' border-phosphor bg-phosphor text-center text-black hover:bg-[#33FF66]'}
              >
                ⬇ PDF
              </a>
              <button
                type="button"
                onClick={() => onReview(tailored.id)}
                className={button + ' border-phosphor/40 text-phosphor hover:bg-phosphor/10'}
              >
                REVIEW
              </button>
              <button
                type="button"
                onClick={() => onTailor(match.id, true)}
                className={
                  button + ' col-span-2 border-phosphor/15 text-dim hover:border-hud-amber/60 hover:text-hud-amber'
                }
              >
                ↻ RE-RUN
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onTailor(match.id, false)}
              className={
                button +
                ' border-hud-amber bg-hud-amber/10 py-2.5 text-hud-amber shadow-[0_0_18px_rgba(250,204,21,0.2)] hover:bg-hud-amber/20'
              }
            >
              OVERCLOCK ▸
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
