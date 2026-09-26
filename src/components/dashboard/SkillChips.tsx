import { scoreColor } from './types';

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
