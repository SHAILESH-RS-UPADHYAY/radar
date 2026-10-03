'use client';

// ZERO-DAY's runner: takes the next queued job, drafts its answers just in time (the same path as ↯ HACK), opens its
// form in a background tab and reads what the extension reports back. Every form is filled and pre-flight checked; when
// all checks pass the tab shows a 5 s countdown (FREEZE to review) and then presses Submit, unless DRY RUN is on.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useApi } from '@/lib/use-api';
import { autopilotExtension, launchInExtension, onExtension } from '@/lib/extension';
import { answerPageQuestions, packForm, prepareForm, rememberAnswer } from '@/lib/apply/client';
import type { AutopilotSettings } from '@/lib/autopilot';

export type QueueStatus =
  'queued' | 'prepared' | 'filling' | 'ready' | 'submitting' | 'submitted' | 'needs_you' | 'skipped' | 'failed';

/** One row of GET /api/autopilot's queue. */
export interface QueueRow {
  id: string;
  match_id: string;
  rank: number;
  status: QueueStatus;
  reason: string | null;
  form_url: string | null;
  ats_provider: string | null;
  started_at: string | null;
  finished_at: string | null;
  match_scores: {
    score: number;
    jobs: {
      title: string;
      employer: string | null;
      location: string | null;
      apply_url: string;
      companies: { name: string };
    };
  };
}

export const companyOf = (r: QueueRow) => r.match_scores.jobs.employer || r.match_scores.jobs.companies.name;

const WATCHDOG_MS = 8 * 60_000;
/** Seconds between two jobs on the same site, so no employer sees a burst. */
const SAME_SITE_MS = 60_000;
const hostOf = (r: QueueRow) => {
  try {
    return new URL(r.form_url || r.match_scores.jobs.apply_url).hostname;
  } catch {
    return '';
  }
};

export function useRunner(api: ReturnType<typeof useApi>, rows: QueueRow[], settings: AutopilotSettings | null) {
  const [running, setRunning] = useState(false);
  const [local, setLocal] = useState<Record<string, Partial<QueueRow>>>({});
  const active = useRef(new Map<string, { rowId: string; at: number }>());
  const lastBySite = useRef(new Map<string, number>());
  const view = rows.map((r) => ({ ...r, ...local[r.id] }));

  /** Record a job's state on the server and on screen at once. */
  const mark = useCallback(
    (row: QueueRow, status: QueueStatus, reason: string | null = null) => {
      setLocal((l) => ({ ...l, [row.id]: { status, reason } }));
      void api(`/api/autopilot/queue/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
    },
    [api],
  );

  const start = useCallback(
    async (row: QueueRow) => {
      active.current.set(row.match_id, { rowId: row.id, at: Date.now() });
      lastBySite.current.set(hostOf(row), Date.now());
      mark(row, 'filling');
      try {
        const company = companyOf(row);
        const prepared = await prepareForm(api, row.match_id);
        const packet = await packForm(api, prepared, company);
        launchInExtension({
          url: row.form_url || row.match_scores.jobs.apply_url,
          matchId: row.match_id,
          tailoredId: prepared.tailoredId,
          packet,
          auto: { dryRun: settings?.dryRun ?? false, consents: settings?.consents ?? [] },
        });
      } catch (err) {
        active.current.delete(row.match_id);
        mark(row, 'failed', err instanceof Error ? err.message : String(err));
      }
    },
    [api, mark, settings],
  );

  // What the extension reports from each ZERO-DAY tab.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  useEffect(
    () =>
      onExtension((e) => {
        if (e.type === 'learn' && e.question && e.answer) void rememberAnswer(api, e.question, e.answer);
        const row = viewRef.current.find((r) => r.match_id === e.matchId);
        if (!row || !e.matchId) return;
        if (e.type === 'questions' && e.id && e.fields?.length)
          void answerPageQuestions(api, { matchId: e.matchId, id: e.id, fields: e.fields, company: companyOf(row) });
        const finish = (status: QueueStatus, reason: string | null = null) => {
          active.current.delete(row.match_id);
          mark(row, status, reason);
        };
        if (e.type === 'launched' && !e.ok) finish('failed', e.error || 'the tab could not open');
        if (e.type !== 'autopilot') return;
        if (e.state === 'ready') {
          finish('ready');
          autopilotExtension.close(row.match_id);
        }
        if (e.state === 'parked') finish('needs_you', (e.reasons || []).join(' · ') || 'needs you');
      }),
    [api, mark],
  );

  // The loop: one more job whenever a slot is free, the site has rested, and the target is not reached.
  useEffect(() => {
    if (!running || !settings) return;
    const tick = setInterval(() => {
      const now = Date.now();
      for (const [matchId, a] of active.current)
        if (now - a.at > WATCHDOG_MS) {
          const row = viewRef.current.find((r) => r.id === a.rowId);
          active.current.delete(matchId);
          if (row) mark(row, 'needs_you', 'took longer than 8 minutes: check its tab');
        }
      const done = viewRef.current.filter((r) => r.status === 'ready' || r.status === 'submitted').length;
      if (done + active.current.size >= settings.target) return;
      if (active.current.size >= settings.concurrency) return;
      const next = viewRef.current.find(
        (r) =>
          r.status === 'queued' &&
          !active.current.has(r.match_id) &&
          now - (lastBySite.current.get(hostOf(r)) || 0) > SAME_SITE_MS,
      );
      if (next) void start(next);
      else if (!active.current.size && !viewRef.current.some((r) => r.status === 'queued')) setRunning(false);
    }, 2000);
    return () => clearInterval(tick);
  }, [running, settings, start, mark]);

  // The extension's icon shows how many jobs need you.
  const parked = view.filter((r) => r.status === 'needs_you').length;
  useEffect(() => autopilotExtension.badge(parked), [parked]);

  return {
    view,
    running,
    start: () => {
      autopilotExtension.run(true);
      setRunning(true);
    },
    pause: () => setRunning(false),
    kill: () => {
      autopilotExtension.run(false);
      setRunning(false);
      for (const matchId of active.current.keys()) autopilotExtension.close(matchId);
      active.current.clear();
    },
    mark,
    activeCount: () => active.current.size,
  };
}
