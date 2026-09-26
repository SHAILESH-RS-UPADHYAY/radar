'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HudPanel } from '@/components/hud/Hud';
import type { Notice } from '@/components/hud/Toast';
import { timeAgo } from '@/components/dashboard/types';
import { MAX_TARGETS, parseTargets } from '@/lib/discovery/targets';
import { useApi } from '@/lib/use-api';

type Counts = Record<'pending' | 'linked' | 'no_feed' | 'failed', number>;
interface DiscoveryStatus {
  ready: boolean;
  hint?: string;
  totals?: { startupmap: Counts; import: Counts };
  startupmap?: { syncedAt: string | null; pagesLeft: number; paused: boolean; lastError: string | null };
}

const button =
  'border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';

function Stat({ label, value, tone = 'text-phosphor' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="border border-phosphor/15 bg-black/50 px-3 py-2">
      <p className={'font-mono text-lg font-bold leading-none ' + tone}>{value}</p>
      <p className="mt-1 font-mono text-[9px] tracking-[0.25em] text-dim">{label}</p>
    </div>
  );
}

/** CONFIG://10 — startup discovery status, and importing companies RADAR should track. */
export function TargetImport({ onNotice }: { onNotice: (n: Notice) => void }) {
  const api = useApi();
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const targets = useMemo(() => parseTargets(text), [text]);

  const load = useCallback(async () => {
    const r = await api('/api/discovery');
    if (r.ok) setStatus(await r.json());
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    void load();
  }, [load]);

  const queue = async () => {
    setBusy(true);
    try {
      const r = await api('/api/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targets }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
      setText('');
      onNotice({
        tone: 'ok',
        text: `Queued ${d.queued} companies${d.alreadyKnown ? ` (${d.alreadyKnown} already known)` : ''}. RADAR looks for their careers feeds on the next discovery run.`,
      });
      await load();
    } catch (err) {
      onNotice({ tone: 'alert', text: 'Import failed: ' + (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return onNotice({ tone: 'alert', text: 'That file is over 5 MB.' });
    setText(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const sm = status?.totals?.startupmap;
  const imp = status?.totals?.import;
  const found = sm ? sm.pending + sm.linked + sm.no_feed + sm.failed : 0;
  const tracked = (sm?.linked ?? 0) + (imp?.linked ?? 0);
  const crawl = status?.startupmap;

  return (
    <HudPanel
      id="targets"
      label="CONFIG://10 · TARGETS"
      status={!status ? 'CHECKING' : !status.ready ? 'NEEDS MIGRATION' : tracked + ' TRACKED'}
      tone={!status ? 'idle' : !status.ready ? 'warn' : 'ok'}
      className="scroll-mt-24"
    >
      <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">
        RADAR crawls StartupMap every 48h, politely, and reads each funded startup&apos;s own careers feed.
        FundedStartupsDaily&apos;s terms forbid scraping and WorldStartupMap keeps its data behind a blocked API, so for
        those you bring the list: FSD sells a CSV export licensed for your own use. Drop it here, or paste websites.
      </p>

      {status && !status.ready && <p className="mb-4 font-mono text-xs text-hud-amber">{status.hint}</p>}

      {status?.ready && (
        <div className="mb-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="STARTUPS FOUND" value={found.toLocaleString()} />
            <Stat label="FEEDS TRACKED" value={tracked.toLocaleString()} />
            <Stat
              label="IN QUEUE"
              value={(
                (sm?.pending ?? 0) +
                (sm?.failed ?? 0) +
                (imp?.pending ?? 0) +
                (imp?.failed ?? 0)
              ).toLocaleString()}
              tone="text-hud-cyan"
            />
          </div>
          <p className="font-mono text-[10px] leading-relaxed tracking-wider text-dim">
            STARTUPMAP · last sync {timeAgo(crawl?.syncedAt ?? null) || 'pending first run'}
            {crawl?.pagesLeft ? ` · ${crawl.pagesLeft} hiring pages left this cycle` : ''}
            {crawl?.paused ? ' · paused (site asked to slow down)' : ''}
            {imp && imp.pending + imp.linked + imp.no_feed + imp.failed > 0
              ? ` · IMPORTS ${imp.linked} tracked / ${imp.no_feed} no feed`
              : ''}
          </p>
          {crawl?.lastError && <p className="font-mono text-[10px] text-hud-red">! {crawl.lastError}</p>}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        aria-label="Companies to import"
        placeholder={'acme.io\nIsomorphic Labs https://isomorphiclabs.com\n…or load a CSV with a Website column'}
        className="custom-scrollbar w-full resize-y border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-xs leading-relaxed text-phosphor placeholder:text-phosphor/30 focus:border-phosphor/70 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={button + ' cursor-pointer border-phosphor/40 text-phosphor hover:bg-phosphor/10'}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
            }}
          />
          LOAD CSV
        </label>
        <button
          type="button"
          disabled={busy || !targets.length || !status?.ready}
          onClick={queue}
          className={button + ' border-phosphor bg-phosphor text-black hover:bg-[#33FF66]'}
        >
          {busy ? 'QUEUEING…' : `QUEUE ${targets.length || ''} ${targets.length === 1 ? 'COMPANY' : 'COMPANIES'}`}
        </button>
        <span className="font-mono text-[10px] tracking-wider text-dim">max {MAX_TARGETS} per import</span>
      </div>
    </HudPanel>
  );
}
