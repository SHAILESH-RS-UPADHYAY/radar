'use client';

import { HudPanel } from '@/components/hud/Hud';
import { postedTag, scoreColor, type MatchedJob } from './types';

/** TODAY://10 in the Vault: the jobs to apply to first (see todaysTen), each opening its briefing, and one HACK run. */
export function TodayPanel({
  today,
  onOpen,
  onHack,
}: {
  today: MatchedJob[];
  onOpen: (id: string) => void;
  onHack: () => void;
}) {
  return (
    <HudPanel label="TODAY://10" status="APPLY FIRST" tone="warn" bodyClassName="p-0">
      <p className="px-5 pb-3 pt-4 text-sm leading-relaxed text-dim">
        Fresh postings first: in the first four days an application is still read.
      </p>
      <ol className="border-y border-phosphor/10">
        {today.map((m, i) => {
          const tag = postedTag(m);
          return (
            <li key={m.id} className="border-b border-phosphor/5 last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(m.id)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-phosphor/5 focus-visible:bg-phosphor/10 focus-visible:outline-none"
              >
                <span className="w-4 shrink-0 font-mono text-[10px] text-dim">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] font-bold tracking-wider text-white">
                    {m.job.company.name}
                  </span>
                  <span className="block truncate text-xs text-dim">{m.job.title}</span>
                </span>
                <span className="shrink-0 text-right font-mono">
                  <span className="block text-sm font-extrabold" style={{ color: scoreColor(m.score) }}>
                    {m.score}
                  </span>
                  <span
                    className={'block text-[9px] tracking-[0.15em] ' + (tag === 'NEW' ? 'text-hud-amber' : 'text-dim')}
                  >
                    {tag || '—'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="p-4">
        <button
          type="button"
          onClick={onHack}
          className="w-full border border-hud-amber/60 bg-hud-amber/10 py-2.5 font-mono text-[11px] font-bold tracking-[0.25em] text-hud-amber transition-colors hover:bg-hud-amber hover:text-black"
        >
          HACK THESE {today.length}
        </button>
      </div>
    </HudPanel>
  );
}
