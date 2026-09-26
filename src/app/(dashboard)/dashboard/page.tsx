'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '@/lib/use-api';
import type { MatchStatus, Stage } from '@/types';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { Toast, type Notice } from '@/components/hud/Toast';
import { OpsCard } from '@/components/dashboard/OpsCard';
import { DiscoveryCard } from '@/components/dashboard/DiscoveryCard';
import { VaultCard } from '@/components/dashboard/VaultCard';
import {
  ACTION_STATUS,
  ACTIVE_STAGES,
  CLOSED_STAGES,
  STAGE_META,
  opsSignals,
  timeAgo,
  type MatchAction,
  type MatchedJob,
} from '@/components/dashboard/types';

type PrimaryTab = 'DISCOVERY' | 'VAULT' | 'OPS';
type Section = 'dream' | 'recommended' | 'startup';

interface VaultSettings {
  vault_min_score: number;
  auto_vault: boolean;
  last_matched_at: string | null;
}

const byScore = (a: MatchedJob, b: MatchedJob) => b.score - a.score;
const byRecent = (a: MatchedJob, b: MatchedJob) => (b.status_changed_at || '').localeCompare(a.status_changed_at || '');

const SECTIONS: { key: Section; label: string; hint: string }[] = [
  { key: 'dream', label: 'DREAM', hint: 'your picked companies' },
  { key: 'recommended', label: 'RECOMMENDED', hint: 'best fits elsewhere' },
  { key: 'startup', label: 'STARTUPS', hint: 'early-stage teams' },
];

function EmptyState({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <HudPanel label={label} status="IDLE" tone="idle" bodyClassName="px-6 py-16 text-center sm:py-20">
      <p className="font-mono text-4xl text-phosphor/25">[ ∅ ]</p>
      <p className="mt-5 font-mono text-lg font-bold tracking-wide text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-dim">{body}</p>
      {children}
    </HudPanel>
  );
}

function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="font-mono text-[11px] tracking-[0.35em] text-phosphor/70">{kicker}</p>
      <h1 className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 text-sm text-dim">{children}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const api = useApi();
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [vaultSettings, setVaultSettings] = useState<VaultSettings | null>(null);
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('DISCOVERY');
  const [activeTab, setActiveTab] = useState<Section>('recommended');
  const [opsReady, setOpsReady] = useState(true);
  const autoScanned = useRef(false);
  const closeNotice = useCallback(() => setNotice(null), []);

  /** Optimistic patch of one application in C2 · OPS, reverted if the server refuses. */
  const patchOps = useCallback(
    async (id: string, change: Partial<MatchedJob>, body: Record<string, unknown>, what: string) => {
      let before: Partial<MatchedJob> | undefined;
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          before = { stage: m.stage, stage_changed_at: m.stage_changed_at, notes: m.notes };
          return { ...m, ...change };
        }),
      );
      try {
        const res = await api('/api/ops', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, ...body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
      } catch (err) {
        setMatches((prev) => prev.map((m) => (m.id === id && before ? { ...m, ...before } : m)));
        setNotice({
          tone: 'alert',
          text: `Could not save the ${what}: ${err instanceof Error ? err.message : 'network error'}.`,
        });
      }
    },
    [api],
  );
  const setStage = useCallback(
    (id: string, stage: Stage) =>
      void patchOps(id, { stage, stage_changed_at: new Date().toISOString() }, { stage }, 'stage'),
    [patchOps],
  );
  const setNotes = useCallback(
    (id: string, notes: string) => void patchOps(id, { notes: notes.trim() || null }, { notes }, 'note'),
    [patchOps],
  );

  // Optimistic: move the cards now, and put exactly those cards back if the server says no.
  const setStatus = useCallback(
    async (ids: string[], status: MatchStatus) => {
      if (!ids.length) return;
      const now = new Date().toISOString();
      const before = new Map<string, Partial<MatchedJob>>();
      setMatches((prev) =>
        prev.map((m) => {
          if (!ids.includes(m.id) || m.status === status) return m;
          before.set(m.id, {
            status: m.status,
            auto_saved: m.auto_saved,
            stage: m.stage,
            stage_changed_at: m.stage_changed_at,
            applied_at: m.applied_at,
          });
          // Mirrors /api/vault: applying opens an application at 'applied', leaving 'applied' closes it.
          const ops =
            status === 'applied'
              ? { stage: 'applied' as const, stage_changed_at: now, applied_at: now }
              : { stage: null, stage_changed_at: null, applied_at: null };
          return { ...m, status, auto_saved: status === 'saved' ? m.auto_saved : false, ...ops };
        }),
      );
      try {
        const res = await api('/api/vault', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids, status }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (err) {
        console.warn('[VAULT] status update failed, reverting:', err);
        setMatches((prev) => prev.map((m) => (before.has(m.id) ? { ...m, ...before.get(m.id) } : m)));
        setNotice({ tone: 'alert', text: 'Could not save that change, so it was reverted. Check your connection.' });
      }
    },
    [api],
  );

  // One-time move of Vault/Applied lists that older versions kept in localStorage.
  useEffect(() => {
    if (!user?.id || loading) return;
    try {
      const savedKey = `radar_saved_${user.id}`;
      const appliedKey = `radar_applied_${user.id}`;
      const saved: string[] = JSON.parse(localStorage.getItem(savedKey) || '[]');
      const applied: string[] = JSON.parse(localStorage.getItem(appliedKey) || '[]');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing legacy localStorage to the server
      if (saved.length) void setStatus(saved, 'saved');
      if (applied.length) void setStatus(applied, 'applied');
      localStorage.removeItem(savedKey);
      localStorage.removeItem(appliedKey);
    } catch {
      // storage unavailable — nothing to migrate
    }
  }, [user?.id, loading, setStatus]);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await api('/api/dashboard');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setMatches(data.matches || []);
      setVaultSettings(data.settings || null);
      setOpsReady(data.opsReady !== false);
    } catch (err) {
      console.warn('[DASHBOARD] load failed:', err);
      setNotice({
        tone: 'alert',
        text: 'Could not load your matches.',
        action: { label: 'RETRY', run: () => void fetchMatches() },
      });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanNote('');
    try {
      const res = await api('/api/match', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'Scan failed. Complete onboarding and make sure jobs have been scraped.';
        setScanNote(msg);
        setNotice({ tone: 'alert', text: msg });
        return;
      }
      if (!data.total) setScanNote(data.message || 'No matching jobs yet. The next pipeline run will bring some in.');
      else {
        setNotice({
          tone: 'ok',
          text: `Scan complete · ${data.total} jobs scored · ${data.vaulted} new in your Vault.`,
        });
        if (data.vaulted > 0) setPrimaryTab('VAULT');
      }
      await fetchMatches();
    } catch (err) {
      console.warn('[SCAN] failed:', err);
      setNotice({ tone: 'alert', text: 'Scan failed. Check your connection and try again.' });
    } finally {
      setScanning(false);
    }
  }, [api, fetchMatches]);

  // First visit with an empty feed: scan once automatically.
  useEffect(() => {
    if (loading || autoScanned.current || matches.length > 0) return;
    autoScanned.current = true;
    void handleScan();
  }, [loading, matches.length, handleScan]);

  const onAction = (id: string, action: MatchAction) => void setStatus([id], ACTION_STATUS[action]);

  const available = matches.filter((m) => m.status === 'new');
  const saved = matches.filter((m) => m.status === 'saved').sort(byScore);
  const applied = matches.filter((m) => m.status === 'applied').sort(byRecent);
  const archived = applied.filter((m) => CLOSED_STAGES.includes(m.stage || 'applied'));
  const activeOps = applied.filter((m) => !CLOSED_STAGES.includes(m.stage || 'applied'));
  const needsAttention = activeOps.filter((m) => opsSignals(m).length > 0).length;
  const discovery = available.filter((m) => m.section === activeTab).sort(byScore);

  const TABS: { key: PrimaryTab; label: string; short: string; count: number }[] = [
    { key: 'DISCOVERY', label: 'DISCOVERY', short: 'DISCOVER', count: available.length },
    { key: 'VAULT', label: 'THE VAULT', short: 'VAULT', count: saved.length },
    { key: 'OPS', label: 'C2 · OPS', short: 'OPS', count: activeOps.length },
  ];
  const minScore = vaultSettings?.vault_min_score ?? 70;
  const autoVault = vaultSettings?.auto_vault !== false;

  const scanButton = (
    <button
      onClick={handleScan}
      disabled={scanning}
      className="flex items-center gap-2 bg-phosphor px-4 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-black shadow-[0_0_18px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66] disabled:cursor-wait disabled:bg-phosphor/40"
    >
      {scanning && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
      {scanning ? 'SCANNING' : 'SCAN NOW'}
    </button>
  );

  // How strong today's new signals are, for the Discovery rail.
  const quality = [
    { label: 'STRONG', hint: '70+', count: available.filter((m) => m.score >= 70).length, bar: 'bg-phosphor' },
    {
      label: 'GOOD',
      hint: '40-69',
      count: available.filter((m) => m.score >= 40 && m.score < 70).length,
      bar: 'bg-hud-amber',
    },
    { label: 'WEAK', hint: '<40', count: available.filter((m) => m.score < 40).length, bar: 'bg-dim' },
  ];
  const vaultStats = [
    ['IN VAULT', String(saved.length)],
    ['AUTO-SAVED', String(saved.filter((m) => m.auto_saved).length)],
    ['BEST MATCH', saved.length ? saved[0].score + '%' : '—'],
    ['CLOSED', String(saved.filter((m) => !m.job.is_active).length)],
  ];

  const tunePanel = (
    <HudPanel label="TUNE://MATCHES" tone="idle" bodyClassName="p-5">
      <p className="text-sm leading-relaxed text-dim">
        Target roles and confirmed skills sharpen every score. Change them any time; the next scan uses them.
      </p>
      <Link
        href="/settings"
        className="mt-4 block border border-phosphor/40 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10"
      >
        OPEN PREFERENCES →
      </Link>
    </HudPanel>
  );

  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(0,255,65,0.07),transparent_65%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="RADAR home" className="transition-opacity hover:opacity-85">
            <RadarLogo />
          </Link>

          <nav className="hidden items-center border border-phosphor/20 md:flex" aria-label="Dashboard sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setPrimaryTab(t.key)}
                aria-current={primaryTab === t.key ? 'page' : undefined}
                className={
                  'px-4 py-2 font-mono text-[11px] font-bold tracking-[0.2em] transition-colors ' +
                  (primaryTab === t.key ? 'bg-phosphor text-black' : 'text-dim hover:text-phosphor')
                }
              >
                {t.label} <span className="opacity-60">{t.count}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/settings"
              className="group flex items-center gap-2 border border-phosphor/20 px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-dim transition-colors hover:border-phosphor/60 hover:text-phosphor"
            >
              <span className="inline-block transition-transform duration-300 group-hover:rotate-90">⚙</span>
              <span className="hidden sm:inline">PREFERENCES</span>
            </Link>
            {scanButton}
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-none border border-phosphor/40' } }}
            />
          </div>
        </div>

        <nav className="grid grid-cols-3 border-t border-phosphor/10 md:hidden" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPrimaryTab(t.key)}
              className={
                'py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] ' +
                (primaryTab === t.key ? 'bg-phosphor text-black' : 'text-dim')
              }
            >
              {t.short} {t.count}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative border-b border-phosphor/10 bg-black/50">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.2em] text-dim sm:px-6 lg:px-10">
          <StatusLight tone={scanning ? 'warn' : 'ok'}>{scanning ? 'SCANNING' : 'LINK ACTIVE'}</StatusLight>
          <span>
            LAST SCAN{' '}
            <span className="text-phosphor/80">{timeAgo(vaultSettings?.last_matched_at ?? null) ?? 'never'}</span>
          </span>
          <span>
            AUTO-VAULT <span className="text-phosphor/80">{autoVault ? '≥ ' + minScore + '%' : 'OFF'}</span>
          </span>
          <span>
            SIGNALS <span className="text-phosphor/80">{matches.length}</span>
          </span>
          {user?.firstName && (
            <span className="ml-auto hidden sm:inline">
              OPERATOR <span className="text-phosphor/80">{user.firstName.toUpperCase()}</span>
            </span>
          )}
        </div>
      </div>

      <main className="relative mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait">
          {primaryTab === 'DISCOVERY' && (
            <motion.section
              key="DISCOVERY"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8"
            >
              <aside className="space-y-5 lg:sticky lg:top-24">
                <HudPanel label="LANES" status={available.length + ' NEW'} bodyClassName="p-0">
                  <div className="grid grid-cols-3 lg:grid-cols-1">
                    {SECTIONS.map((s) => {
                      const active = activeTab === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setActiveTab(s.key)}
                          aria-pressed={active}
                          className={
                            'relative flex flex-col gap-0.5 border-phosphor/10 px-4 py-4 text-left transition-colors max-lg:border-r max-lg:last:border-r-0 lg:flex-row lg:items-center lg:justify-between lg:border-b lg:last:border-b-0 ' +
                            (active ? 'bg-phosphor/[0.08]' : 'hover:bg-phosphor/[0.03]')
                          }
                        >
                          {active && (
                            <span className="absolute inset-y-0 left-0 hidden w-0.5 bg-phosphor shadow-[0_0_10px_#00FF41] lg:block" />
                          )}
                          <span>
                            <span
                              className={
                                'block font-mono text-[11px] font-bold tracking-[0.25em] ' +
                                (active ? 'text-phosphor' : 'text-ink/80')
                              }
                            >
                              {s.label}
                            </span>
                            <span className="hidden text-[11px] text-dim lg:block">{s.hint}</span>
                          </span>
                          <span
                            className={
                              'font-mono text-2xl font-extrabold ' + (active ? 'text-phosphor' : 'text-white/80')
                            }
                          >
                            {available.filter((m) => m.section === s.key).length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </HudPanel>

                <HudPanel label="SIGNAL://QUALITY" tone="info" status="ALL LANES" bodyClassName="space-y-3 p-5">
                  {quality.map((q) => (
                    <div key={q.label} className="font-mono">
                      <div className="flex justify-between text-[10px] tracking-[0.25em]">
                        <span className="text-dim">
                          {q.label} <span className="text-dim/60">{q.hint}</span>
                        </span>
                        <span className="text-ink">{q.count}</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-phosphor/10">
                        <div
                          className={'h-full ' + q.bar}
                          style={{ width: (available.length ? (q.count / available.length) * 100 : 0) + '%' }}
                        />
                      </div>
                    </div>
                  ))}
                </HudPanel>

                <div className="hidden lg:block">{tunePanel}</div>
              </aside>

              <div className="min-w-0">
                <PageTitle kicker="// DISCOVERY" title="Live signals">
                  New matches from the latest scan in the {SECTIONS.find((s) => s.key === activeTab)?.label} lane,
                  strongest first.
                </PageTitle>
                {loading ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-40 animate-pulse border border-phosphor/10 bg-phosphor/[0.03]" />
                    ))}
                  </div>
                ) : discovery.length === 0 ? (
                  <EmptyState
                    label={'SIGNAL://' + activeTab.toUpperCase()}
                    title="No active signals."
                    body={scanNote || 'Nothing new in this lane. Scan to match your profile against live jobs.'}
                  >
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      {scanButton}
                      <Link
                        href="/settings"
                        className="border border-phosphor/30 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-phosphor/80 hover:text-phosphor"
                      >
                        TUNE PROFILE
                      </Link>
                    </div>
                  </EmptyState>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {discovery.map((m) => (
                        <DiscoveryCard key={m.id} match={m} onAction={onAction} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {primaryTab === 'VAULT' && (
            <motion.section
              key="VAULT"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8"
            >
              <aside className="space-y-5 lg:sticky lg:top-24">
                <HudPanel label="VAULT://STATUS" status={autoVault ? 'AUTO' : 'MANUAL'} bodyClassName="p-5">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-5 font-mono">
                    {vaultStats.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10px] tracking-[0.25em] text-dim">{k}</dt>
                        <dd className="mt-1 text-2xl font-extrabold text-phosphor">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link
                    href="/settings#auto-vault"
                    className="mt-5 block border-t border-phosphor/10 pt-4 font-mono text-[11px] tracking-[0.2em] text-phosphor/70 transition-colors hover:text-phosphor"
                  >
                    {autoVault ? 'AUTO-SAVE ≥ ' + minScore + '%' : 'AUTO-VAULT OFF'} · CHANGE →
                  </Link>
                </HudPanel>
                <div className="hidden lg:block">{tunePanel}</div>
              </aside>

              <div className="min-w-0">
                <PageTitle kicker="// THE VAULT" title="Your shortlist">
                  {autoVault
                    ? `Matches scoring ${minScore}%+ land here automatically after every scan.`
                    : 'Auto-vault is off. Save jobs from Discovery to keep them here.'}
                </PageTitle>
                {saved.length === 0 ? (
                  <EmptyState
                    label="VAULT://EMPTY"
                    title="The Vault is empty."
                    body="Strong matches are saved automatically after each scan, or save jobs from Discovery yourself."
                  />
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {saved.map((m) => (
                        <VaultCard key={m.id} match={m} onAction={onAction} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {primaryTab === 'OPS' && (
            <motion.section
              key="OPS"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <PageTitle kicker="// C2 · OPS" title="Command & control">
                Every application, where it stands, and what RADAR has noticed since you applied.
              </PageTitle>

              {!opsReady && (
                <div className="mb-6">
                  <HudPanel label="OPS://OFFLINE" status="MIGRATION NEEDED" tone="warn" bodyClassName="p-5">
                    <p className="text-sm text-dim">
                      Stages and notes switch on after running{' '}
                      <span className="font-mono text-phosphor">supabase/migrations/005_sources_ops_overclock.sql</span>{' '}
                      in the Supabase SQL editor. Your applications are listed below meanwhile.
                    </p>
                  </HudPanel>
                </div>
              )}

              {applied.length === 0 ? (
                <EmptyState
                  label="OPS://QUIET"
                  title="No active operations."
                  body="Apply to a job from Discovery or the Vault and it will be tracked here, stage by stage."
                />
              ) : (
                <>
                  <div className="mb-6 grid grid-cols-2 border border-phosphor/20 bg-black/60 sm:grid-cols-3 lg:grid-cols-6">
                    {[...ACTIVE_STAGES, 'closed' as const].map((s) => {
                      const count =
                        s === 'closed'
                          ? applied.filter((m) => CLOSED_STAGES.includes(m.stage || 'applied')).length
                          : applied.filter((m) => (m.stage || 'applied') === s).length;
                      return (
                        <div key={s} className="border-b border-r border-phosphor/10 p-4">
                          <p className="font-mono text-2xl font-extrabold text-white">{count}</p>
                          <p className="mt-1 font-mono text-[10px] tracking-[0.25em] text-dim">
                            {s === 'closed' ? 'CLOSED' : STAGE_META[s].label}
                          </p>
                        </div>
                      );
                    })}
                    <div className="border-b border-r border-phosphor/10 p-4">
                      <p className="font-mono text-2xl font-extrabold text-hud-amber">{needsAttention}</p>
                      <p className="mt-1 font-mono text-[10px] tracking-[0.25em] text-dim">NEED ATTENTION</p>
                    </div>
                  </div>

                  <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {ACTIVE_STAGES.map((s) => {
                      const column = applied.filter((m) => (m.stage || 'applied') === s);
                      return (
                        <section key={s} aria-label={STAGE_META[s].label} className="min-w-0">
                          <div className="mb-3 flex items-center justify-between border-b border-phosphor/15 pb-2">
                            <StatusLight tone={STAGE_META[s].tone} pulse={false}>
                              {STAGE_META[s].label}
                            </StatusLight>
                            <span className="font-mono text-[11px] text-dim">{column.length}</span>
                          </div>
                          <div className="space-y-3">
                            <AnimatePresence>
                              {column.map((m) => (
                                <OpsCard
                                  key={m.id}
                                  match={m}
                                  editable={opsReady}
                                  onStage={setStage}
                                  onNotes={setNotes}
                                  onAction={onAction}
                                />
                              ))}
                            </AnimatePresence>
                            {column.length === 0 && (
                              <p className="border border-dashed border-phosphor/10 py-6 text-center font-mono text-[10px] tracking-[0.25em] text-dim/60">
                                EMPTY
                              </p>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                  {archived.length > 0 && (
                    <details className="group mt-8 border border-phosphor/15 bg-black/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[11px] tracking-[0.25em] text-dim transition-colors hover:text-phosphor [&::-webkit-details-marker]:hidden">
                        <span>ARCHIVE · REJECTED / WITHDRAWN ({archived.length})</span>
                        <span className="transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <div className="grid gap-3 border-t border-phosphor/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                        {archived.map((m) => (
                          <OpsCard
                            key={m.id}
                            match={m}
                            editable={opsReady}
                            onStage={setStage}
                            onNotes={setNotes}
                            onAction={onAction}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <Toast notice={notice} onClose={closeNotice} />
    </div>
  );
}
