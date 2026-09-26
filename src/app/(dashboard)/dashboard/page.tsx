'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '@/lib/use-api';
import type { MatchStatus } from '@/types';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { Toast, type Notice } from '@/components/hud/Toast';
import { AppliedCard } from '@/components/dashboard/AppliedCard';
import { DiscoveryCard } from '@/components/dashboard/DiscoveryCard';
import { VaultCard } from '@/components/dashboard/VaultCard';
import { ACTION_STATUS, timeAgo, type MatchAction, type MatchedJob } from '@/components/dashboard/types';

type PrimaryTab = 'DISCOVERY' | 'VAULT' | 'BATTLEFIELD';
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
  const autoScanned = useRef(false);
  const closeNotice = useCallback(() => setNotice(null), []);

  // Optimistic: move the cards now, and put exactly those cards back if the server says no.
  const setStatus = useCallback(
    async (ids: string[], status: MatchStatus) => {
      if (!ids.length) return;
      const before = new Map<string, Pick<MatchedJob, 'status' | 'auto_saved'>>();
      setMatches((prev) =>
        prev.map((m) => {
          if (!ids.includes(m.id)) return m;
          before.set(m.id, { status: m.status, auto_saved: m.auto_saved });
          return { ...m, status, auto_saved: status === 'saved' ? m.auto_saved : false };
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
  const discovery = available.filter((m) => m.section === activeTab).sort(byScore);

  const TABS: { key: PrimaryTab; label: string; short: string; count: number }[] = [
    { key: 'DISCOVERY', label: 'DISCOVERY', short: 'DISCOVER', count: available.length },
    { key: 'VAULT', label: 'THE VAULT', short: 'VAULT', count: saved.length },
    { key: 'BATTLEFIELD', label: 'BATTLEFIELD', short: 'APPLIED', count: applied.length },
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

  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(0,255,65,0.07),transparent_65%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.2em] text-dim sm:px-6">
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

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          {primaryTab === 'DISCOVERY' && (
            <motion.section
              key="DISCOVERY"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <PageTitle kicker="// DISCOVERY" title="Live signals">
                New matches from the latest scan, strongest first.
              </PageTitle>

              <div className="mb-8 grid grid-cols-3 border border-phosphor/20 bg-black/60">
                {SECTIONS.map((s) => {
                  const active = activeTab === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveTab(s.key)}
                      aria-pressed={active}
                      className={
                        'relative border-r border-phosphor/15 p-4 text-left transition-colors last:border-r-0 sm:p-5 ' +
                        (active ? 'bg-phosphor/[0.07]' : 'hover:bg-phosphor/[0.03]')
                      }
                    >
                      {active && (
                        <span className="absolute inset-x-0 top-0 h-0.5 bg-phosphor shadow-[0_0_10px_#00FF41]" />
                      )}
                      <p
                        className={
                          'font-mono text-2xl font-extrabold sm:text-3xl ' + (active ? 'text-phosphor' : 'text-white')
                        }
                      >
                        {available.filter((m) => m.section === s.key).length}
                      </p>
                      <p
                        className={
                          'mt-1 font-mono text-[10px] tracking-[0.25em] ' + (active ? 'text-phosphor' : 'text-dim')
                        }
                      >
                        {s.label}
                      </p>
                      <p className="mt-0.5 hidden text-[11px] text-dim/70 sm:block">{s.hint}</p>
                    </button>
                  );
                })}
              </div>

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
            </motion.section>
          )}

          {primaryTab === 'VAULT' && (
            <motion.section
              key="VAULT"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
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
            </motion.section>
          )}

          {primaryTab === 'BATTLEFIELD' && (
            <motion.section
              key="BATTLEFIELD"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <PageTitle kicker="// BATTLEFIELD" title="Active deployments">
                Everything you have applied to, most recent first.
              </PageTitle>
              {applied.length === 0 ? (
                <EmptyState
                  label="BATTLEFIELD://QUIET"
                  title="No active deployments."
                  body="Open a job's apply link from Discovery or the Vault and it will be tracked here."
                />
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {applied.map((m) => (
                      <AppliedCard key={m.id} match={m} onAction={onAction} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <Toast notice={notice} onClose={closeNotice} />
    </div>
  );
}
