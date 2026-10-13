'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { STAGES, type Stage } from '@/types';
import { Brackets, StatusLight } from '@/components/hud/Hud';
import { JobTitle, openOnClick, JobFacts } from './SkillChips';
import { ACTIVE_STAGES, STAGE_META, opsSignals, timeAgo, type MatchAction, type MatchedJob } from './types';

const SIGNAL_STYLE = {
  ok: 'border-phosphor/40 text-phosphor',
  info: 'border-hud-cyan/40 text-hud-cyan',
  warn: 'border-hud-amber/50 text-hud-amber',
  alert: 'border-hud-red/50 text-hud-red',
  idle: 'border-phosphor/15 text-dim',
} as const;
const button = 'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] transition-colors';

/** What a mail or RADAR event means, at a glance. */
const EVENT: Record<string, { icon: string; label: string; tone: string }> = {
  received: { icon: '📨', label: 'APPLICATION RECEIVED', tone: 'text-hud-cyan' },
  assessment: { icon: '🧪', label: 'ASSESSMENT', tone: 'text-hud-amber' },
  interview: { icon: '🎙️', label: 'INTERVIEW', tone: 'text-phosphor' },
  offer: { icon: '🏆', label: 'OFFER', tone: 'text-phosphor' },
  rejection: { icon: '❌', label: 'NOT SHORTLISTED', tone: 'text-hud-red' },
  expired: { icon: '⏰', label: 'WINDOW MISSED', tone: 'text-hud-red' },
};
const eventMeta = (kind: string) =>
  EVENT[kind] ?? { icon: '⚡', label: kind.replace(/_/g, ' ').toUpperCase(), tone: 'text-hud-cyan' };

/** Older events read 'KIND · "Subject" from Sender'; newer ones 'Subject — Sender'. */
function readSummary(summary: string): { subject: string; sender: string } {
  const old = /^[A-Z_]+ · "(.*)" from (.*)$/.exec(summary);
  if (old) return { subject: old[1], sender: old[2] };
  const [subject, sender = ''] = summary.split(' — ');
  return { subject, sender };
}

/** Why a closed application closed. */
function closedReason(stage: string, kind: string | undefined): string | null {
  if (stage === 'rejected') return '❌ Not shortlisted';
  if (stage === 'withdrawn') return kind === 'expired' ? '⏰ Missed: the window closed' : '↩ Withdrawn';
  return null;
}

/** One application in C2 · OPS: stage controls, notes, and the signals RADAR has picked up. */
export function OpsCard({
  match,
  editable,
  onStage,
  onNotes,
  onAction,
  onOpen,
}: {
  match: MatchedJob;
  /** Opens the JD terminal for this match. */
  onOpen?: (id: string) => void;
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
  const open = onOpen ? () => onOpen(match.id) : undefined;

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
      onClick={openOnClick(open)}
      className={
        'group relative border border-phosphor/20 bg-black/75 p-4 transition-colors hover:border-phosphor/45' +
        (open ? ' cursor-pointer' : '')
      }
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
      <JobTitle title={job.title} onOpen={open} className="mt-3 text-sm font-bold leading-snug text-white" />
      <JobFacts job={job} />
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-dim">
        {[
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

      {closedReason(stage, match.last_event?.kind) && (
        <p className="mt-3 inline-block border border-hud-red/40 bg-hud-red/[0.07] px-2 py-1 font-mono text-[10px] font-bold tracking-[0.15em] text-hud-red">
          {closedReason(stage, match.last_event?.kind)}
        </p>
      )}

      {match.last_event &&
        (() => {
          const e = match.last_event;
          const meta = eventMeta(e.kind);
          const { subject, sender } = readSummary(e.summary);
          return (
            <div tabIndex={0} className="group/event relative mt-3 outline-none">
              <div className="border-l-2 border-hud-cyan/50 pl-2 font-mono text-[10px] leading-relaxed">
                <span className={'block tracking-[0.18em] ' + meta.tone}>
                  {meta.icon} {meta.label} · {e.source === 'gmail' ? 'GMAIL' : 'RADAR'} · {timeAgo(e.occurred_at)}
                </span>
                <span className="line-clamp-1 text-ink/75">{subject}</span>
              </div>
              {/* The full message on hover or focus: a HUD panel, with a way to the mail itself. */}
              <div
                role="tooltip"
                className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-1 border border-phosphor/40 bg-black/95 p-3 font-mono text-[11px] leading-relaxed opacity-0 shadow-[0_0_24px_rgba(0,255,65,0.15)] transition-opacity duration-150 group-focus-within/event:pointer-events-auto group-focus-within/event:opacity-100 group-hover/event:pointer-events-auto group-hover/event:opacity-100"
              >
                <p className={'tracking-[0.2em] ' + meta.tone}>
                  {'> '}
                  {meta.icon} {meta.label}
                </p>
                <p className="mt-1.5 text-ink">{subject}</p>
                {sender && <p className="mt-1 text-dim">from {sender}</p>}
                <p className="mt-1 text-dim/80">{new Date(e.occurred_at).toLocaleString('en-IN')}</p>
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block border border-phosphor/40 px-2 py-1 font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10"
                  >
                    OPEN IN GMAIL ↗
                  </a>
                )}
              </div>
            </div>
          );
        })()}

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
        {match.resume_version_id && (
          <a
            href={`/api/overclock/${match.resume_version_id}/pdf`}
            title="The tailored resume sent with this application"
            className={button + ' ml-auto border-phosphor/40 text-phosphor hover:bg-phosphor/10'}
          >
            SENT CV ⬇
          </a>
        )}
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className={
            button +
            (match.resume_version_id ? '' : ' ml-auto') +
            ' border-hud-cyan/40 text-hud-cyan hover:bg-hud-cyan/10'
          }
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
