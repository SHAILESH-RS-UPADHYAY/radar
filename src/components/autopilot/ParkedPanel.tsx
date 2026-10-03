'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/use-api';
import { autopilotExtension } from '@/lib/extension';
import { NeedsYou } from './Board';
import type { QueueRow } from './useRunner';

/**
 * The dashboard's NEEDS YOU: today's jobs ZERO-DAY left to you, with the same actions as /zero-day. Hidden when there
 * are none (or before migration 010). Re-reads when you come back to the tab, since the runner works in other tabs.
 */
export function ParkedPanel({ onApplied }: { onApplied: () => void }) {
  const api = useApi();
  const [rows, setRows] = useState<QueueRow[]>([]);

  const load = useCallback(async () => {
    const res = await api('/api/autopilot?parked=1').catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { parked: QueueRow[] };
    setRows(d.parked);
  }, [api]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads today's parked jobs from the server
    void load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const settle = async (row: QueueRow, status: 'submitted' | 'skipped') => {
    setRows((r) => r.filter((x) => x.id !== row.id));
    await api(`/api/autopilot/queue/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (status === 'skipped') autopilotExtension.close(row.match_id);
    else onApplied(); // it is in C2 · OPS now
  };

  if (!rows.length) return null;
  return (
    <div>
      <NeedsYou rows={rows} onSent={(r) => void settle(r, 'submitted')} onSkip={(r) => void settle(r, 'skipped')} />
      <Link
        href="/zero-day"
        className="mt-2 block text-right font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-phosphor"
      >
        OPEN ZERO-DAY ▸
      </Link>
    </div>
  );
}
