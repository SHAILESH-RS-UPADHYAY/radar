import type { MouseEvent } from 'react';
import { ageDays, formatSalary, scoreColor, sourceLabel, timeAgo, type MatchedJob } from './types';

/** A click anywhere on a card opens the JD terminal, unless it landed on a control inside the card. */
export const openOnClick = (open: (() => void) | undefined) =>
  open
    ? (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest('a,button,input,select,textarea,label')) open();
      }
    : undefined;

/** The job title: a button that opens the JD terminal where one is wired (plain text on the landing sample). */
export function JobTitle({ title, onOpen, className }: { title: string; onOpen?: () => void; className: string }) {
  return (
    <h3 className={className}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="text-left underline-offset-4 transition-colors hover:text-phosphor hover:underline focus-visible:text-phosphor"
        >
          {title}
        </button>
      ) : (
        title
      )}
    </h3>
  );
}

export function BriefingButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-4 font-mono text-[10px] font-bold tracking-[0.25em] text-phosphor/80 transition-colors hover:text-phosphor"
    >
      [&gt;_] OPEN BRIEFING
    </button>
  );
}

const base = 'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]';

export function SkillChips({
  matching,
  missing,
  maxMatching = 5,
  maxMissing = 3,
}: {
  matching: string[];
  missing: string[];
  maxMatching?: number;
  maxMissing?: number;
}) {
  if (!matching.length && !missing.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {matching.slice(0, maxMatching).map((s) => (
        <span key={'m-' + s} className={base + ' border-phosphor/35 bg-phosphor/[0.07] text-phosphor'}>
          + {s}
        </span>
      ))}
      {missing.slice(0, maxMissing).map((s) => (
        <span key={'x-' + s} className={base + ' border-hud-red/30 bg-hud-red/[0.06] text-hud-red/90'}>
          - {s}
        </span>
      ))}
    </div>
  );
}

/** Big match percentage with a glowing bar, coloured by strength. */
const FACT = 'inline-flex max-w-full items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em]';

/**
 * A job's facts, each in its own colour so none melts into the green: where (cyan), pay (amber), experience (violet),
 * how fresh (green when new, red when old) and where RADAR read it (pink).
 */
export function JobFacts({ job }: { job: MatchedJob['job'] }) {
  const days = ageDays(job.posted_at);
  const exp = job.experience_required;
  const facts: [string, string | null, string][] = [
    ['⌖', job.location || null, 'border-hud-cyan/60 text-hud-cyan'],
    ['PAY', formatSalary(job), 'border-hud-amber/60 text-hud-amber'],
    ['EXP', exp ? (exp === 'fresher' ? 'FRESHER' : exp + ' YRS') : null, 'border-[#c792ea]/60 text-[#c792ea]'],
    [
      '◷',
      job.posted_at ? timeAgo(job.posted_at) : null,
      days === null || days <= 3
        ? 'border-phosphor/60 text-phosphor'
        : days > 30
          ? 'border-hud-red/60 text-hud-red'
          : 'border-white/30 text-white/80',
    ],
    ['SRC', sourceLabel(job), 'border-[#ff2a6d]/50 text-[#ff8fb1]'],
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {facts
        .filter(([, v]) => v)
        .map(([k, v, tone]) => (
          <span key={k} className={FACT + ' ' + tone}>
            <span className="opacity-60">{k}</span>
            <span className="truncate">{v}</span>
          </span>
        ))}
    </div>
  );
}

export function ScoreMeter({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="font-mono">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] tracking-[0.3em] text-dim">MATCH</span>
        <span className="text-3xl font-extrabold leading-none" style={{ color, textShadow: `0 0 16px ${color}55` }}>
          {score}
          <span className="text-base">%</span>
        </span>
      </div>
      <div className="mt-2 h-1 bg-phosphor/10">
        <div className="h-full" style={{ width: score + '%', background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}
