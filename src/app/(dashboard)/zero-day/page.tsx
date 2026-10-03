'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { Toast, type Notice } from '@/components/hud/Toast';
import { NeedsYou, QueueBoard } from '@/components/autopilot/Board';
import { useRunner, type QueueRow } from '@/components/autopilot/useRunner';
import { useApi } from '@/lib/use-api';
import { autopilotExtension, useExtension } from '@/lib/extension';
import { CONSENTS, type AutopilotSettings } from '@/lib/autopilot';

interface Today {
  settings: AutopilotSettings;
  cities: string[];
  day: string;
  queue: QueueRow[];
  supply: Record<string, { open: number; today: number; week: number }>;
}

const CONSENT_LABEL: Record<(typeof CONSENTS)[number], string> = {
  privacy: 'Privacy notice / data processing',
  accurate: '"My information is accurate"',
  talent_pool: 'Keep me in the talent pool',
};
const field =
  'w-full border border-phosphor/25 bg-black px-3 py-2 font-mono text-xs text-phosphor outline-none focus:border-phosphor';
const label = 'mb-1 block font-mono text-[10px] tracking-[0.25em] text-dim';

export default function AutopilotPage() {
  const api = useApi();
  const extension = useExtension();
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const runner = useRunner(api, today?.queue ?? [], today?.settings ?? null);

  const load = useCallback(
    async (build: boolean) => {
      const res = await api('/api/autopilot', { method: build ? 'POST' : 'GET' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error || 'HTTP ' + res.status);
      setError('');
      setToday(d as Today);
      return d as Today;
    },
    [api],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads today's queue from the server
    void load(false);
  }, [load]);

  const save = async (change: Partial<AutopilotSettings>) => {
    if (!today) return;
    const next = { ...today.settings, ...change };
    setToday({ ...today, settings: next });
    const res = await api('/api/autopilot', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: change }),
    });
    if (!res.ok) return setNotice({ tone: 'alert', text: 'Could not save that setting.' });
    autopilotExtension.schedule(next.enabled, next.schedule);
  };

  const start = async () => {
    if (!extension)
      return setNotice({ tone: 'alert', text: 'Install the RADAR extension first (Settings → Application Kit).' });
    const d = today?.queue.length ? today : await load(true);
    if (!d?.queue.length) return setNotice({ tone: 'info', text: 'No eligible jobs in your cities today.' });
    runner.start();
  };

  // The daily alarm opens this page with ?autostart=1.
  useEffect(() => {
    if (today?.settings.enabled && extension && new URLSearchParams(location.search).get('autostart') === '1') {
      history.replaceState(null, '', '/zero-day');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the alarm's autostart: one run when the page opens
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when settings and the extension are known
  }, [!!today, extension]);

  const rows = runner.view;
  const count = (...s: QueueRow['status'][]) => rows.filter((r) => s.includes(r.status)).length;
  const s = today?.settings;

  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="RADAR home">
            <RadarLogo />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="border border-phosphor/30 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor hover:bg-phosphor/10"
            >
              DASHBOARD
            </Link>
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-none border border-phosphor/40' } }}
            />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <p className="font-mono text-[11px] tracking-[0.35em] text-phosphor/70">{'// ZERO-DAY'}</p>
        <h1 className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          ZERO-DAY<span className="caret-blink text-phosphor">_</span>
        </h1>
        <p className="mt-2 text-sm text-dim">
          Today&apos;s jobs in your exact cities, filled and checked one after another in background tabs.{' '}
          <span className="text-hud-amber">
            {s?.dryRun
              ? 'DRY RUN: nothing is ever submitted.'
              : 'LIVE: every form that passes pre-flight is submitted after a 5 s countdown you can FREEZE.'}
          </span>
        </p>

        {error ? (
          <div className="mt-8 max-w-xl">
            <HudPanel label="ZERO-DAY://ERROR" status="OFFLINE" tone="alert">
              <p className="text-sm text-hud-red">{error}</p>
            </HudPanel>
          </div>
        ) : !today || !s ? (
          <div className="mt-8 h-64 animate-pulse border border-phosphor/10 bg-phosphor/[0.03]" aria-busy="true" />
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:gap-8">
            <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-px">
              <HudPanel
                label="ZERO-DAY://CONTROL"
                status={runner.running ? 'RUNNING' : 'IDLE'}
                tone={runner.running ? 'ok' : 'idle'}
              >
                {!extension && (
                  <p className="mb-4 text-xs text-hud-amber">
                    The RADAR extension is not connected: install or reload it.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => void start()}
                    disabled={runner.running}
                    className="bg-phosphor py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] text-black hover:bg-[#33FF66] disabled:opacity-40"
                  >
                    START
                  </button>
                  <button
                    type="button"
                    onClick={runner.pause}
                    disabled={!runner.running}
                    className="border border-phosphor/40 py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor disabled:opacity-40"
                  >
                    PAUSE
                  </button>
                  <button
                    type="button"
                    onClick={runner.kill}
                    className="border border-hud-red/60 py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] text-hud-red hover:bg-hud-red/10"
                  >
                    KILL
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void save({ dryRun: !s.dryRun })}
                  className={
                    'mt-4 flex w-full items-center justify-between border px-3 py-2 font-mono text-[10px] tracking-[0.2em] transition-colors ' +
                    (s.dryRun
                      ? 'border-hud-amber/40 text-hud-amber hover:bg-hud-amber/10'
                      : 'border-hud-red/60 text-hud-red hover:bg-hud-red/10')
                  }
                >
                  {s.dryRun ? 'DRY RUN' : 'LIVE FIRE'}
                  <span>{s.dryRun ? 'ON · TAP FOR LIVE' : 'SUBMITS · 5 s COUNTDOWN'}</span>
                </button>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <label>
                    <span className={label}>TARGET / DAY</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={s.target}
                      onChange={(e) => void save({ target: Number(e.target.value) })}
                      className={field}
                    />
                  </label>
                  <label>
                    <span className={label}>TABS AT ONCE</span>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={s.concurrency}
                      onChange={(e) => void save({ concurrency: Number(e.target.value) })}
                      className={field}
                    />
                  </label>
                  <label>
                    <span className={label}>PER COMPANY</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={s.perCompany}
                      onChange={(e) => void save({ perCompany: Number(e.target.value) })}
                      className={field}
                    />
                  </label>
                  <label>
                    <span className={label}>DAILY AT</span>
                    <input
                      type="time"
                      value={s.schedule}
                      onChange={(e) => void save({ schedule: e.target.value })}
                      className={field}
                    />
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className={label}>CITIES (EMPTY = YOUR PROFILE&apos;S)</span>
                  <input
                    defaultValue={s.cities.join(', ')}
                    placeholder={today.cities.join(', ')}
                    onBlur={(e) =>
                      void save({
                        cities: e.target.value
                          .split(',')
                          .map((c) => c.trim())
                          .filter(Boolean),
                      })
                    }
                    className={field}
                  />
                </label>
                {(
                  [
                    ['enabled', 'Open ZERO-DAY daily at that time'],
                    ['remote', 'Include remote roles'],
                    ['countryOnly', 'Include "India"-only postings'],
                  ] as const
                ).map(([k, text]) => (
                  <label
                    key={k}
                    className="mt-3 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-phosphor/80"
                  >
                    <input
                      type="checkbox"
                      checked={s[k]}
                      onChange={(e) => void save({ [k]: e.target.checked })}
                      className="accent-[#00FF41]"
                    />
                    {text}
                  </label>
                ))}
                <p className={label + ' mt-5'}>CONSENTS YOU PRE-APPROVE (ARBITRATION: NEVER)</p>
                {CONSENTS.map((c) => (
                  <label
                    key={c}
                    className="mt-2 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-phosphor/80"
                  >
                    <input
                      type="checkbox"
                      checked={s.consents.includes(c)}
                      onChange={(e) =>
                        void save({
                          consents: e.target.checked ? [...s.consents, c] : s.consents.filter((x) => x !== c),
                        })
                      }
                      className="accent-[#00FF41]"
                    />
                    {CONSENT_LABEL[c]}
                  </label>
                ))}
              </HudPanel>

              <HudPanel label="SUPPLY://CITIES" status={today.day}>
                {Object.keys(today.supply).length ? (
                  <ul className="space-y-1.5 font-mono text-[11px]">
                    {Object.entries(today.supply).map(([city, n]) => (
                      <li key={city} className="flex justify-between gap-3">
                        <span className="text-phosphor">{city.toUpperCase()}</span>
                        <span className="text-dim">
                          {n.today} today · {n.week} this week · {n.open} open
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-xs text-dim">No eligible jobs in your cities right now.</p>
                )}
              </HudPanel>
            </aside>

            <div className="min-w-0 space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ['READY · DRY', count('ready'), 'text-phosphor'],
                    ['FILLING', count('filling'), 'text-hud-cyan'],
                    ['NEEDS YOU', count('needs_you', 'failed'), 'text-hud-amber'],
                    ['QUEUED', count('queued'), 'text-dim'],
                    ['SENT', count('submitted'), 'text-phosphor'],
                  ] as const
                ).map(([k, v, tone]) => (
                  <div key={k} className="border border-phosphor/20 bg-black/70 px-3 py-2.5">
                    <p className="font-mono text-[9px] tracking-[0.25em] text-dim">{k}</p>
                    <p className={'font-mono text-2xl font-extrabold ' + tone}>{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex">
                <StatusLight tone={runner.running ? 'ok' : 'idle'} pulse={runner.running}>
                  {runner.running
                    ? s.dryRun
                      ? 'ZERO-DAY IS FILLING FORMS · DRY RUN'
                      : 'ZERO-DAY IS LIVE · SUBMITTING'
                    : 'ZERO-DAY IS IDLE'}
                </StatusLight>
              </div>
              <NeedsYou
                rows={rows}
                onSent={(r) => runner.mark(r, 'submitted')}
                onSkip={(r) => {
                  runner.mark(r, 'skipped');
                  autopilotExtension.close(r.match_id);
                }}
              />
              <QueueBoard rows={rows} />
            </div>
          </div>
        )}
      </main>
      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
