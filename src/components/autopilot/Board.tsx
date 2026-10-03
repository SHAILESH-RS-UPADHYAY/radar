'use client';

import { HudPanel } from '@/components/hud/Hud';
import { autopilotExtension } from '@/lib/extension';
import { companyOf, type QueueRow, type QueueStatus } from './useRunner';

const CHIP: Record<QueueStatus, [string, string]> = {
  queued: ['QUEUED', 'border-phosphor/20 text-dim'],
  prepared: ['PREPARED', 'border-phosphor/30 text-phosphor/70'],
  filling: ['FILLING', 'border-hud-cyan/50 text-hud-cyan animate-pulse'],
  ready: ['READY · DRY', 'border-phosphor/60 text-phosphor'],
  submitting: ['SUBMITTING', 'border-hud-cyan/50 text-hud-cyan'],
  submitted: ['SUBMITTED', 'border-phosphor bg-phosphor/15 text-phosphor'],
  needs_you: ['NEEDS YOU', 'border-hud-amber/60 text-hud-amber'],
  skipped: ['SKIPPED', 'border-phosphor/15 text-dim'],
  failed: ['FAILED', 'border-hud-red/50 text-hud-red'],
};

const btn =
  'border px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.18em] transition-colors hover:bg-phosphor/10';

/** NEEDS YOU: every parked job with its reason; jump to its tab, mark it sent, or skip it. */
export function NeedsYou({
  rows,
  onSent,
  onSkip,
}: {
  rows: QueueRow[];
  onSent: (r: QueueRow) => void;
  onSkip: (r: QueueRow) => void;
}) {
  const parked = rows.filter((r) => r.status === 'needs_you' || r.status === 'failed');
  return (
    <HudPanel
      label="NEEDS://YOU"
      status={parked.length ? parked.length + ' PARKED' : 'CLEAR'}
      tone={parked.length ? 'warn' : 'ok'}
      bodyClassName="p-0"
    >
      {parked.length ? (
        <ul className="divide-y divide-phosphor/10">
          {parked.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-bold text-white">
                  {companyOf(r)} · {r.match_scores.jobs.title}
                </p>
                <p className="mt-0.5 text-xs text-hud-amber">{r.reason || 'needs you'}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => autopilotExtension.focus(r.match_id)}
                  className={btn + ' border-hud-amber/50 text-hud-amber'}
                >
                  JUMP TO TAB
                </button>
                <button type="button" onClick={() => onSent(r)} className={btn + ' border-phosphor/50 text-phosphor'}>
                  ✓ I SUBMITTED IT
                </button>
                <button type="button" onClick={() => onSkip(r)} className={btn + ' border-phosphor/15 text-dim'}>
                  SKIP
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 font-mono text-xs text-dim">Nothing parked. Every form so far passed its checks.</p>
      )}
    </HudPanel>
  );
}

/** Today's queue, live: each job's state, site, city and score. */
export function QueueBoard({ rows }: { rows: QueueRow[] }) {
  return (
    <HudPanel label="QUEUE://TODAY" status={rows.length + ' JOBS'} bodyClassName="p-0">
      {rows.length ? (
        <ol className="divide-y divide-phosphor/10">
          {rows.map((r) => {
            const [label, tone] = CHIP[r.status];
            return (
              <li key={r.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                <span className="font-mono text-[10px] text-dim">#{String(r.rank).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    <span className="font-bold">{companyOf(r)}</span> · {r.match_scores.jobs.title}
                  </p>
                  <p className="truncate font-mono text-[10px] text-dim">
                    {[r.match_scores.jobs.location, r.ats_provider?.toUpperCase(), r.match_scores.score + '%']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className={'border px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] ' + tone}>{label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-4 py-4 font-mono text-xs text-dim">
          No queue yet. Press START: RADAR picks today&apos;s jobs from your cities.
        </p>
      )}
    </HudPanel>
  );
}
