'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { STAGES, type Stage } from '@/types';
import { Brackets, StatusLight } from '@/components/hud/Hud';
import { ACTIVE_STAGES, STAGE_META, opsSignals, timeAgo, type MatchAction, type MatchedJob } from './types';

const SIGNAL_STYLE = {
  ok: 'border-phosphor/40 text-phosphor',
  info: 'border-hud-cyan/40 text-hud-cyan',
  warn: 'border-hud-amber/50 text-hud-amber',
  alert: 'border-hud-red/50 text-hud-red',
  idle: 'border-phosphor/15 text-dim',
} as const;
const button = 'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] transition-colors';

/** One application in C2 · OPS: stage controls, notes, and the signals RADAR has picked up. */
export function OpsCard({
  match,
  editable,
  onStage,
  onNotes,
  onAction,
}: {
  match: MatchedJob;
  /** False until migration 005 adds the stage columns. */
  editable: boolean;
  onStage: (id: string, stage: Stage) => void;
  onNotes: (id: string, notes: string) => void;
  onAction: (id: string, action: MatchAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(match.notes || '');
  const stage = match.stage || 'applied';
  const at = ACTIVE_STAGES.indexOf(stage);
  const next = at >= 0 && at < ACTIVE_STAGES.length - 1 ? ACTIVE_STAGES[at + 1] : null;
  const signals = opsSignals(match);
  const { job } = match;

  const saveNotes = () => {
    setEditing(false);
    if (draft.trim() !== (match.notes || '')) onNotes(match.id, draft);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group relative border border-phosphor/20 bg-black/75 p-4 transition-colors hover:border-phosphor/45"
    >
      <Brackets className="border-hud-cyan opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <span className="truncate border border-hud-cyan/40 bg-hud-cyan/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-hud-cyan">
          {job.company.name.toUpperCase()}
        </span>
        <StatusLight tone={STAGE_META[stage].tone} pulse={false}>
          {STAGE_META[stage].label}
        </StatusLight>
      </div>
      <h3 className="mt-3 text-sm font-bold leading-snug text-white">{job.title}</h3>
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-dim">
        {[
          job.location,
          match.applied_at ? 'applied ' + timeAgo(match.applied_at) : null,
          match.stage_changed_at && stage !== 'applied' ? 'stage ' + timeAgo(match.stage_changed_at) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <span
              key={s.label}
              title={s.hint}
              className={'border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em] ' + SIGNAL_STYLE[s.tone]}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}

      {editable &&
        (editing ? (
          <textarea
            autoFocus
            value={draft}
            maxLength={2000}
            rows={3}
            aria-label={'Notes for ' + job.title}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveNotes}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(match.notes || '');
                setEditing(false);
              }
            }}
            className="mt-3 w-full resize-y border border-phosphor/30 bg-black px-2 py-1.5 font-mono text-xs text-ink focus:border-phosphor/70 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(match.notes || '');
              setEditing(true);
            }}
            className="mt-3 block w-full text-left font-mono text-[11px] leading-relaxed text-dim transition-colors hover:text-phosphor"
          >
            {match.notes ? <span className="line-clamp-3 whitespace-pre-line">{match.notes}</span> : '+ ADD NOTE'}
          </button>
        ))}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {editable && next && (
          <button
            type="button"
            onClick={() => onStage(match.id, next)}
            className={button + ' border-phosphor/50 text-phosphor hover:bg-phosphor/10'}
          >
            ADVANCE ▸ {STAGE_META[next].label}
          </button>
        )}
        {editable && stage !== 'rejected' && (
          <button
            type="button"
            onClick={() => onStage(match.id, 'rejected')}
            className={button + ' border-phosphor/15 text-dim hover:border-hud-red/60 hover:text-hud-red'}
          >
            ✕ REJECTED
          </button>
        )}
        {editable && (
          <select
            value={stage}
            aria-label="Stage"
            onChange={(e) => onStage(match.id, e.target.value as Stage)}
            className="border border-phosphor/20 bg-black px-1.5 py-1.5 font-mono text-[10px] tracking-[0.15em] text-phosphor/80 focus:border-phosphor/60 focus:outline-none"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_META[s].label}
              </option>
            ))}
          </select>
        )}
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className={button + ' ml-auto border-hud-cyan/40 text-hud-cyan hover:bg-hud-cyan/10'}
        >
          OPEN ↗
        </a>
        <button
          type="button"
          onClick={() => onAction(match.id, 'REMOVE_APPLY')}
          title="Move back to the Vault"
          className={button + ' border-phosphor/15 text-dim hover:border-phosphor/50 hover:text-phosphor'}
        >
          ← VAULT
        </button>
      </div>
    </motion.article>
  );
}
