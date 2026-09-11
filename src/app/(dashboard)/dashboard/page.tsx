'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '@/lib/use-api';
import type { MatchStatus } from '@/types';
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

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="text-center py-32 border border-[#222] rounded-2xl bg-[#0D0D0D]">
      <div className="text-[#333] text-6xl mb-4">{icon}</div>
      <p className="text-xl text-white font-bold mb-2">{title}</p>
      <p className="text-[#666]">{body}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const api = useApi();
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [vaultSettings, setVaultSettings] = useState<VaultSettings | null>(null);
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('DISCOVERY');
  const [activeTab, setActiveTab] = useState<Section>('recommended');
  const autoScanned = useRef(false);

  const setStatus = useCallback(
    async (ids: string[], status: MatchStatus) => {
      if (!ids.length) return;
      setMatches((prev) =>
        prev.map((m) =>
          ids.includes(m.id) ? { ...m, status, auto_saved: status === 'saved' ? m.auto_saved : false } : m,
        ),
      );
      try {
        const res = await api('/api/vault', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids, status }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } catch (err) {
        console.error('Failed to update status:', err);
        setScanError('Could not save that change. Refresh and try again.');
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
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setVaultSettings(data.settings || null);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    void fetchMatches();
  }, [fetchMatches]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError('');
    try {
      const res = await api('/api/match', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScanError(data.error || 'Scan failed. Complete onboarding and make sure jobs have been scraped.');
        return;
      }
      if (!data.total) setScanError(data.message || 'No matching jobs yet. Run the scrape job first.');
      else if (data.vaulted > 0) setPrimaryTab('VAULT');
      await fetchMatches();
    } catch (err) {
      console.error('Scan failed:', err);
      setScanError('Scan failed. Check your connection and try again.');
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
  const applied = matches.filter((m) => m.status === 'applied').sort(byScore);
  const discovery = available.filter((m) => m.section === activeTab).sort(byScore);

  const sectionTabs: { key: Section; label: string }[] = [
    { key: 'dream', label: 'DREAM' },
    { key: 'recommended', label: 'RECOMMENDED' },
    { key: 'startup', label: 'STARTUPS' },
  ];
  const tabLabel = (tab: PrimaryTab, short = false) =>
    tab === 'VAULT'
      ? `${short ? 'VAULT' : 'THE VAULT'} (${saved.length})`
      : tab === 'BATTLEFIELD'
        ? `${short ? 'APPLIED' : 'BATTLEFIELD'} (${applied.length})`
        : tab;
  const TABS: PrimaryTab[] = ['DISCOVERY', 'VAULT', 'BATTLEFIELD'];

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A]">
      <header className="flex items-center justify-between px-6 py-4 shrink-0 relative z-50 border-b border-[#1A1A1A]">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-black text-white bg-[#A67B5B] shadow-[0_0_15px_rgba(166,123,91,0.3)]">
            R
          </div>
          <span className="text-white font-bold text-sm tracking-wider">RADAR.CORE</span>
        </Link>

        <nav className="hidden md:flex items-center bg-[#111] border border-[#222] rounded-full p-1 shadow-inner">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setPrimaryTab(tab)}
              className={`px-6 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all ${primaryTab === tab ? 'bg-[#A67B5B] text-white shadow-lg' : 'text-[#666] hover:text-[#999]'}`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="flex items-center gap-2 group px-3 py-2 rounded border border-[#222] text-[#888] hover:text-[#A67B5B] hover:border-[#A67B5B] transition-colors"
          >
            <svg
              className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline whitespace-nowrap">
              Preferences
            </span>
          </Link>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(166,123,91,0.2)]"
            style={{ background: scanning ? '#555' : '#A67B5B' }}
          >
            {scanning ? 'SCANNING...' : 'SCAN NOW'}
          </button>
          {scanError && primaryTab === 'DISCOVERY' && discovery.length > 0 && (
            <span className="hidden lg:block max-w-[220px] text-[10px] text-red-400">{scanError}</span>
          )}
        </div>
      </header>

      <nav className="md:hidden flex items-center justify-center gap-2 py-4 border-b border-[#1A1A1A]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setPrimaryTab(tab)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-widest transition-all ${primaryTab === tab ? 'bg-[#A67B5B] text-white' : 'text-[#666] bg-[#111]'}`}
          >
            {tabLabel(tab, true)}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
          <AnimatePresence mode="wait">
            {primaryTab === 'DISCOVERY' && (
              <motion.section
                key="DISCOVERY"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {sectionTabs.map((t) => {
                    const active = activeTab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className="p-4 rounded-xl text-center transition-all hover:scale-[1.02]"
                        style={{
                          background: active ? '#141414' : '#0D0D0D',
                          border: '1px solid ' + (active ? '#A67B5B' : '#1A1A1A'),
                        }}
                      >
                        <p className="text-2xl font-black text-white font-mono">
                          {available.filter((m) => m.section === t.key).length}
                        </p>
                        <p
                          className="text-xs font-bold uppercase tracking-wider mt-1"
                          style={{ color: active ? '#A67B5B' : '#555' }}
                        >
                          {t.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {loading ? (
                  <p className="text-center py-20 text-sm text-[#555]">Loading Intelligence...</p>
                ) : discovery.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-[#222] rounded-xl bg-[#0D0D0D]">
                    <p className="text-lg text-white font-bold mb-2">No active signals.</p>
                    <p className="text-sm mb-6 text-[#666]">
                      {scanError || 'Your discovery feed is empty. Scan to match your resume against live jobs.'}
                    </p>
                    <button
                      onClick={handleScan}
                      disabled={scanning}
                      className="px-6 py-2 rounded text-xs font-bold uppercase tracking-wider text-white bg-[#A67B5B]"
                    >
                      {scanning ? 'SCANNING...' : 'SCAN NOW'}
                    </button>
                    <p className="text-xs mt-4">
                      <Link href="/settings" className="underline text-[#888]">
                        Update your profile
                      </Link>
                    </p>
                  </div>
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="mb-8">
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">The Vault</h1>
                  <p className="text-[#888]">
                    {vaultSettings?.auto_vault !== false
                      ? `Matches scoring ${vaultSettings?.vault_min_score ?? 70}%+ land here automatically after every scan.`
                      : 'Your curated list of highly targeted opportunities.'}
                    {vaultSettings?.last_matched_at && (
                      <span className="text-[#555]"> Last scan: {timeAgo(vaultSettings.last_matched_at)}.</span>
                    )}
                  </p>
                </div>
                {saved.length === 0 ? (
                  <EmptyState
                    icon="🔒"
                    title="The Vault is empty."
                    body="Strong matches are added automatically after each scan, or save jobs from Discovery."
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="mb-8">
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">The Battlefield</h1>
                  <p className="text-[#888]">Track your active deployments and ongoing offensives.</p>
                </div>
                {applied.length === 0 ? (
                  <EmptyState
                    icon="⚔️"
                    title="No active deployments."
                    body="Apply to jobs to track them on the battlefield."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>
      </main>
    </div>
  );
}
