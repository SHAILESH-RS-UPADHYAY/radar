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
import { OverclockCard } from '@/components/dashboard/OverclockCard';
import { RunPanel } from '@/components/dashboard/RunPanel';
import { TailorPreview } from '@/components/dashboard/TailorPreview';
import { JobTerminal } from '@/components/dashboard/JobTerminal';
import { Modal } from '@/components/hud/Modal';
import { placeFit } from '@/lib/geo/city-companies';
import {
  ACTION_STATUS,
  ACTIVE_STAGES,
  CLOSED_STAGES,
  STAGE_META,
  OVERCLOCK_MAX,
  OVERCLOCK_MIN,
  opsSignals,
  timeAgo,
  type MatchAction,
  type MatchedJob,
  type TailoredSummary,
} from '@/components/dashboard/types';

type PrimaryTab = 'DISCOVERY' | 'VAULT' | 'OVERCLOCK' | 'OPS';
type Section = 'dream' | 'recommended' | 'startup';

interface VaultSettings {
  vault_min_score: number;
  auto_vault: boolean;
  last_matched_at: string | null;
  /** Comma-separated cities from Preferences; may include Remote. */
  location: string | null;
}

const PLACE_KEY = 'radar:place';
const LEGACY_CITY_FILTER_KEY = 'radar:only-my-cities';
const STALE_MS = 48 * 3600_000;

/** Where to look: everywhere (default), remote roles, the cities in Preferences, or one city. */
type Place = 'global' | 'remote' | 'mine' | `city:${string}`;

/** "London, England, United Kingdom / Remote" → "London"; null for remote or unknown. */
function mainCity(location: string | null): string | null {
  const first = (location || '')
    .split(/\s*(?:\/|;|\||·)\s*/)[0]
    .split(',')[0]
    .trim();
  return first && !/^(remote|anywhere|worldwide|not specified|global|flexible)/i.test(first) ? first : null;
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
  const [tailoredByJob, setTailoredByJob] = useState<Record<string, TailoredSummary>>({});
  const [overclockReady, setOverclockReady] = useState(true);
  const [tailoring, setTailoring] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [hack, setHack] = useState<{ ids: string[]; i: number } | null>(null);
  const [place, setPlaceState] = useState<Place>('global');
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<{ at: string | null; stale: boolean } | null>(null);
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
    async (ids: string[], status: MatchStatus, resumeVersionId: string | null = null) => {
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
            resume_version_id: m.resume_version_id,
          });
          // Mirrors /api/vault: applying opens an application at 'applied', leaving 'applied' closes it.
          const ops =
            status === 'applied'
              ? {
                  stage: 'applied' as const,
                  stage_changed_at: now,
                  applied_at: now,
                  resume_version_id: resumeVersionId,
                }
              : { stage: null, stage_changed_at: null, applied_at: null, resume_version_id: null };
          return { ...m, status, auto_saved: status === 'saved' ? m.auto_saved : false, ...ops };
        }),
      );
      try {
        const res = await api('/api/vault', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids, status, ...(resumeVersionId ? { resumeVersionId } : {}) }),
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

  // Lets the RETRY button call the latest fetchMatches without fetchMatches referencing itself.
  const retryLoad = useRef<() => void>(() => {});
  const fetchMatches = useCallback(async () => {
    try {
      const res = await api('/api/dashboard');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setMatches(data.matches || []);
      setVaultSettings(data.settings || null);
      setOpsReady(data.opsReady !== false);
      const at: string | null = data.pipelineRunAt ?? null;
      setPipeline({ at, stale: !at || Date.now() - Date.parse(at) > STALE_MS });
    } catch (err) {
      console.warn('[DASHBOARD] load failed:', err);
      setNotice({
        tone: 'alert',
        text: 'Could not load your matches.',
        action: { label: 'RETRY', run: () => retryLoad.current() },
      });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    retryLoad.current = () => void fetchMatches();
  }, [fetchMatches]);

  const fetchTailored = useCallback(async () => {
    try {
      const res = await api('/api/overclock');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
      setOverclockReady(data.ready !== false);
      setTailoredByJob(Object.fromEntries((data.items as TailoredSummary[]).map((t) => [t.job_id, t])));
    } catch (err) {
      console.warn('[OVERCLOCK] list failed:', err);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    void Promise.all([fetchMatches(), fetchTailored()]);
  }, [fetchMatches, fetchTailored]);

  // The location view is a per-device preference; GLOBAL until you pick one.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLACE_KEY);
      const legacy = localStorage.getItem(LEGACY_CITY_FILTER_KEY) === '1';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a stored preference after mount
      if (stored) setPlaceState(stored as Place);
      else if (legacy) setPlaceState('mine');
    } catch {
      // storage unavailable: keep the default
    }
  }, []);
  const setPlace = (next: Place) => {
    setPlaceState(next);
    try {
      localStorage.setItem(PLACE_KEY, next);
    } catch {
      // storage unavailable: the choice still applies for this visit
    }
  };

  /** Tailor the resume for one match; a projection that clears the Vault bar moves it to the Vault server-side. */
  const tailor = useCallback(
    async (matchId: string, force = false) => {
      setTailoring((t) => [...t, matchId]);
      try {
        const res = await api('/api/overclock', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ matchId, force }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        setTailoredByJob((prev) => ({
          ...prev,
          [data.jobId]: {
            id: data.id,
            job_id: data.jobId,
            base_score: data.baseScore,
            projected_score: data.projectedScore,
            created_at: data.createdAt,
          },
        }));
        if (data.movedToVault) {
          setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, status: 'saved', auto_saved: true } : m)));
        }
        setNotice({
          tone: 'ok',
          text:
            data.projectedScore !== null
              ? `Tailored · projected ${data.projectedScore}% (was ${data.baseScore}%).` +
                (data.movedToVault ? ' Moved to your Vault.' : '')
              : 'Tailored resume ready.',
        });
      } catch (err) {
        setNotice({ tone: 'alert', text: 'Overclock failed: ' + (err instanceof Error ? err.message : String(err)) });
      } finally {
        setTailoring((t) => t.filter((x) => x !== matchId));
      }
    },
    [api],
  );

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

  const myCities = (vaultSettings?.location || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const inMyCities = (m: MatchedJob) => {
    const fit = placeFit(myCities, m.job.location, m.job.work_type);
    return fit.kind === 'any' || fit.kind === 'city' || (fit.kind === 'remote' && fit.wanted);
  };
  const inPlace = (m: MatchedJob) => {
    if (place === 'global') return true;
    if (place === 'mine') return !myCities.length || inMyCities(m);
    if (place === 'remote') return placeFit(['Remote'], m.job.location, m.job.work_type).kind === 'remote';
    return placeFit([place.slice(5)], m.job.location, m.job.work_type).kind === 'city';
  };
  // Applications in C2 · OPS are always shown, wherever they are.
  const shown = place === 'global' ? matches : matches.filter((m) => m.status === 'applied' || inPlace(m));
  const hiddenByLocation = matches.length - shown.length;
  // The cities your matches are in, busiest first: one click narrows the whole dashboard to one of them.
  const topCities = Object.entries(
    matches
      .filter((m) => m.status !== 'applied')
      .reduce<Record<string, number>>((acc, m) => {
        const city = mainCity(m.job.location);
        if (city) acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const placeLabel =
    place === 'global' ? 'GLOBAL' : place === 'remote' ? 'REMOTE' : place === 'mine' ? 'MY CITIES' : place.slice(5);
  const briefing = briefingId ? (matches.find((m) => m.id === briefingId) ?? null) : null;

  const available = shown.filter((m) => m.status === 'new');
  const saved = shown.filter((m) => m.status === 'saved').sort(byScore);
  const applied = matches.filter((m) => m.status === 'applied').sort(byRecent);
  const archived = applied.filter((m) => CLOSED_STAGES.includes(m.stage || 'applied'));
  const activeOps = applied.filter((m) => !CLOSED_STAGES.includes(m.stage || 'applied'));
  const needsAttention = activeOps.filter((m) => opsSignals(m).length > 0).length;
  const discovery = available.filter((m) => m.section === activeTab).sort(byScore);
  const candidates = shown
    .filter(
      (m) =>
        (m.status === 'new' || m.status === 'saved') &&
        m.job.is_active &&
        m.score >= OVERCLOCK_MIN &&
        m.score <= OVERCLOCK_MAX,
    )
    .sort(byScore);
  // Skills the near-miss jobs keep asking for, most common first.
  const gapRadar = Object.entries(
    candidates
      .flatMap((m) => m.missing_skills)
      .reduce<Record<string, number>>((acc, skill) => {
        acc[skill] = (acc[skill] || 0) + 1;
        return acc;
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const hackMatch = hack ? matches.find((m) => m.id === hack.ids[hack.i]) : undefined;
  const startHack = (ids: string[]) => ids.length > 0 && setHack({ ids, i: 0 });
  const nextHack = () => {
    if (!hack) return;
    if (hack.i + 1 < hack.ids.length) setHack({ ...hack, i: hack.i + 1 });
    else {
      setHack(null);
      if (hack.ids.length > 1) setNotice({ tone: 'ok', text: 'HACK queue complete.' });
    }
  };
  const onApplied = (matchId: string, resumeVersionId: string | null) => {
    void setStatus([matchId], 'applied', resumeVersionId);
    setNotice({
      tone: 'ok',
      text: 'Logged in C2 · OPS' + (resumeVersionId ? ' with the tailored resume attached.' : '.'),
    });
    nextHack();
  };

  const TABS: { key: PrimaryTab; label: string; short: string; count: number }[] = [
    { key: 'DISCOVERY', label: 'DISCOVERY', short: 'DISCOVER', count: available.length },
    { key: 'VAULT', label: 'THE VAULT', short: 'VAULT', count: saved.length },
    { key: 'OVERCLOCK', label: 'OVERCLOCK', short: 'BOOST', count: candidates.length },
    { key: 'OPS', label: 'C2 · OPS', short: 'OPS', count: activeOps.length },
  ];
  const minScore = vaultSettings?.vault_min_score ?? 80;
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
    {
      label: 'STRONG',
      hint: minScore + '+',
      count: available.filter((m) => m.score >= minScore).length,
      bar: 'bg-phosphor',
    },
    {
      label: 'NEAR MISS',
      hint: OVERCLOCK_MIN + '-' + (minScore - 1),
      count: available.filter((m) => m.score >= OVERCLOCK_MIN && m.score < minScore).length,
      bar: 'bg-hud-amber',
    },
    {
      label: 'WEAK',
      hint: '<' + OVERCLOCK_MIN,
      count: available.filter((m) => m.score < OVERCLOCK_MIN).length,
      bar: 'bg-dim',
    },
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

        <nav className="grid grid-cols-4 border-t border-phosphor/10 md:hidden" aria-label="Dashboard sections">
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
          {pipeline && (
            <span>
              JOBS REFRESHED{' '}
              <span className={pipeline.stale ? 'text-hud-amber' : 'text-phosphor/80'}>
                {pipeline.at ? timeAgo(pipeline.at) : 'never'}
              </span>
            </span>
          )}
          {user?.firstName && (
            <span className="ml-auto hidden sm:inline">
              OPERATOR <span className="text-phosphor/80">{user.firstName.toUpperCase()}</span>
            </span>
          )}
        </div>
      </div>

      {pipeline?.stale && (
        <div className="relative border-b border-hud-amber/30 bg-hud-amber/[0.06]">
          <p className="mx-auto max-w-[1440px] px-4 py-2.5 font-mono text-[11px] leading-relaxed text-hud-amber sm:px-6 lg:px-10">
            ⚠ PIPELINE://STALE · jobs were {pipeline.at ? 'last refreshed ' + timeAgo(pipeline.at) : 'never refreshed'}.
            SCAN only re-scores what is stored. The automatic loop needs CRON_SECRET set in Vercel (then redeploy);
            until then jobs can go out of date.
          </p>
        </div>
      )}

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

                <HudPanel
                  label="FILTER://LOCATION"
                  status={placeLabel}
                  tone={place === 'global' ? 'info' : 'ok'}
                  bodyClassName="p-5"
                >
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where to look">
                    {(
                      [
                        ['global', 'GLOBAL'],
                        ['remote', 'REMOTE'],
                        ...(myCities.length ? [['mine', 'MY CITIES']] : []),
                      ] as [Place, string][]
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={place === key}
                        onClick={() => setPlace(key)}
                        className={
                          'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] transition-colors ' +
                          (place === key
                            ? 'border-phosphor bg-phosphor text-black'
                            : 'border-phosphor/20 text-dim hover:border-phosphor/50 hover:text-phosphor')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {topCities.length > 0 && (
                    <>
                      <p className="mb-2 mt-4 font-mono text-[10px] tracking-[0.25em] text-dim">
                        WHERE YOUR MATCHES ARE
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {topCities.map(([city, count]) => {
                          const key: Place = `city:${city}`;
                          return (
                            <button
                              key={city}
                              type="button"
                              aria-pressed={place === key}
                              onClick={() => setPlace(place === key ? 'global' : key)}
                              className={
                                'border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] transition-colors ' +
                                (place === key
                                  ? 'border-phosphor bg-phosphor text-black'
                                  : 'border-phosphor/20 text-dim hover:border-phosphor/50 hover:text-phosphor')
                              }
                            >
                              {city.toUpperCase()} <span className="opacity-60">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.15em] text-dim">
                    {place === 'mine' ? myCities.join(' · ').toUpperCase() : 'SCORES USE YOUR PREFERENCE CITIES'}
                    {hiddenByLocation > 0 ? ' · ' + hiddenByLocation + ' HIDDEN' : ''}
                  </p>
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
                        <DiscoveryCard key={m.id} match={m} onAction={onAction} onOpen={setBriefingId} />
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
                {saved.length > 1 && (
                  <button
                    type="button"
                    onClick={() => startHack(saved.map((m) => m.id))}
                    className="group/hack mb-5 flex w-full items-center justify-center gap-3 rounded-full border border-phosphor bg-phosphor/10 py-3.5 font-mono text-xs font-bold tracking-[0.35em] text-phosphor shadow-[0_0_28px_rgba(0,255,65,0.3)] transition-all hover:bg-phosphor hover:text-black sm:w-auto sm:px-10"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-phosphor group-hover/hack:bg-black" />
                    <span className="glitch" data-text={'HACK ALL · ' + saved.length}>
                      HACK ALL · {saved.length}
                    </span>
                  </button>
                )}
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
                        <VaultCard
                          key={m.id}
                          match={m}
                          onAction={onAction}
                          onRun={(id) => startHack([id])}
                          onOpen={setBriefingId}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {primaryTab === 'OVERCLOCK' && (
            <motion.section
              key="OVERCLOCK"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8"
            >
              <aside className="space-y-5 lg:sticky lg:top-24">
                <HudPanel label="OVERCLOCK://PROTOCOL" status="HONEST MODE" tone="warn" bodyClassName="space-y-3 p-5">
                  <p className="text-sm leading-relaxed text-dim">
                    Claude rewrites your resume for one job using only what is already in it: it reorders, sharpens, and
                    mirrors the posting’s wording where that is true.
                  </p>
                  <p className="text-sm leading-relaxed text-dim">
                    Nothing is invented. What the job wants and your resume cannot show is listed as a gap instead.
                  </p>
                  <p className="text-sm leading-relaxed text-dim">
                    The projection is measured with RADAR’s own matcher. When it clears your Vault bar, the job moves to
                    the Vault with the tailored resume attached.
                  </p>
                </HudPanel>
                <HudPanel label="GAP://RADAR" status={gapRadar.length + ' SKILLS'} tone="info" bodyClassName="p-5">
                  {gapRadar.length === 0 ? (
                    <p className="text-sm text-dim">No repeated gaps across your near-misses.</p>
                  ) : (
                    <>
                      <ul className="space-y-2 font-mono text-xs">
                        {gapRadar.map(([skill, count]) => (
                          <li key={skill} className="flex items-center justify-between gap-3">
                            <span className="uppercase tracking-[0.15em] text-hud-amber">{skill}</span>
                            <span className="text-dim">
                              {count} job{count > 1 ? 's' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-xs leading-relaxed text-dim">
                        Have one of these for real? Add it in Preferences and every job that asks for it scores higher.
                      </p>
                    </>
                  )}
                </HudPanel>
              </aside>

              <div className="min-w-0">
                <PageTitle kicker="// OVERCLOCK" title="Push near-misses past 80">
                  Jobs scoring {OVERCLOCK_MIN}–{OVERCLOCK_MAX}%. Tailor your resume to one, then HACK it from the Vault.
                </PageTitle>
                {!overclockReady && (
                  <div className="mb-6">
                    <HudPanel label="OVERCLOCK://OFFLINE" status="MIGRATION NEEDED" tone="warn" bodyClassName="p-5">
                      <p className="text-sm text-dim">
                        Run <span className="font-mono text-phosphor">005_sources_ops_overclock.sql</span> in the
                        Supabase SQL editor to switch OVERCLOCK on.
                      </p>
                    </HudPanel>
                  </div>
                )}
                {candidates.length === 0 ? (
                  <EmptyState
                    label="OVERCLOCK://IDLE"
                    title="No near-misses right now."
                    body="Jobs scoring 50–79% show up here after a scan. Strong matches are already in your Vault."
                  />
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {candidates.map((m) => (
                        <OverclockCard
                          key={m.id}
                          match={m}
                          tailored={tailoredByJob[m.job.id]}
                          busy={tailoring.includes(m.id)}
                          onTailor={(id, force) => void tailor(id, force)}
                          onReview={setPreview}
                          onOpen={setBriefingId}
                        />
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
                                  onOpen={setBriefingId}
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
                            onOpen={setBriefingId}
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

      <Modal
        open={!!hackMatch}
        onClose={() => setHack(null)}
        label={'HACK://' + (hackMatch?.job.company.name.toUpperCase() ?? '')}
        status={
          hack && hack.ids.length > 1 ? (
            <span className="text-hud-amber">
              {hack.i + 1}/{hack.ids.length}
            </span>
          ) : undefined
        }
        wide
      >
        {hackMatch && hack && (
          <RunPanel
            key={hackMatch.id}
            match={hackMatch}
            position={hack.i + 1}
            total={hack.ids.length}
            tailored={tailoredByJob[hackMatch.job.id]}
            tailoring={tailoring.includes(hackMatch.id)}
            fullName={user?.fullName || ''}
            email={user?.primaryEmailAddress?.emailAddress || ''}
            onTailor={(id) => void tailor(id)}
            onReview={setPreview}
            onApplied={onApplied}
            onSkip={nextHack}
          />
        )}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} label="OVERCLOCK://REVIEW" wide>
        {preview && <TailorPreview key={preview} id={preview} />}
      </Modal>

      <JobTerminal
        match={briefing}
        onClose={() => setBriefingId(null)}
        onAction={onAction}
        onRun={(id) => startHack([id])}
      />

      <Toast notice={notice} onClose={closeNotice} />
    </div>
  );
}
