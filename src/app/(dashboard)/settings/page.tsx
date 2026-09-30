'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '@/lib/use-api';
import type { SettingsProfile } from '@/types';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { Toast, type Notice } from '@/components/hud/Toast';
import { MAX_DREAM_COMPANIES, resumeProblem } from '@/lib/validate';
import { useEscapeTo } from '@/lib/use-escape';
import { GmailLink } from '@/components/settings/GmailLink';
import { TargetImport } from '@/components/settings/TargetImport';
import { PortfolioSection } from '@/components/settings/PortfolioSection';
import { ScanConsole, type ScanDone } from '@/components/dashboard/ScanConsole';

interface CityCompany {
  name: string;
  tier: string;
  openJobs: number;
  tracked: boolean;
}

const CITY_SUGGESTIONS = [
  'Bangalore',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Mumbai',
  'Gurugram',
  'Noida',
  'Delhi',
  'Kolkata',
  'Remote',
];
const ROLE_SUGGESTIONS = [
  'AI Engineer',
  'AI Product Engineer',
  'Software Engineer',
  'ML Engineer',
  'GenAI Engineer',
  'Full Stack Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Data Scientist',
  'Data Engineer',
];

/** "React, Python; SQL" → ['React', 'Python', 'SQL'] */
const splitInput = (v: string) =>
  v
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Append items that are not already in the list (case-insensitive), keeping order. */
function addUnique(list: string[], items: string[]) {
  const seen = new Set(list.map((x) => x.toLowerCase()));
  const out = [...list];
  for (const item of items) {
    if (seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
  }
  return out;
}

/** Tag input: Enter or comma adds (comma-separated paste adds several), Backspace on empty removes the last. */
function ChipInput({
  values,
  onChange,
  placeholder,
  max = 100,
  suggestions = [],
  suggestionLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
  suggestions?: string[];
  suggestionLabel?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const full = values.length >= max;
  const commit = () => {
    const items = splitInput(draft);
    setDraft('');
    if (items.length) onChange(addUnique(values, items).slice(0, max));
  };
  const open = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-[48px] cursor-text flex-wrap items-center gap-2 border border-phosphor/25 bg-black/60 p-2 transition-colors focus-within:border-phosphor/70 focus-within:shadow-[0_0_18px_rgba(0,255,65,0.12)]"
      >
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-2 border border-phosphor/40 bg-phosphor/10 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-phosphor"
          >
            {v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((x) => x !== v));
              }}
              aria-label={'Remove ' + v}
              className="text-phosphor/60 transition-colors hover:text-hud-red"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={full ? 'Limit reached' : values.length ? 'Add more…' : placeholder}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 font-mono text-sm text-phosphor placeholder:text-phosphor/35 focus:outline-none"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={commit}
            className="bg-phosphor px-3 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-black"
          >
            ADD
          </button>
        )}
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-dim/80">
        Enter or comma to add · paste a comma list · Backspace removes the last
      </p>
      {open.length > 0 && !full && (
        <div className="mt-4">
          {suggestionLabel && <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-dim">{suggestionLabel}</p>}
          <div className="flex flex-wrap gap-1.5">
            {open.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(addUnique(values, [s]).slice(0, max))}
                className="border border-dashed border-phosphor/25 px-2 py-1 font-mono text-[11px] text-phosphor/70 transition-colors hover:border-phosphor hover:text-phosphor"
              >
                + {s}
              </button>
            ))}
            {open.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(addUnique(values, open).slice(0, max))}
                className="border border-phosphor/50 px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-phosphor transition-colors hover:bg-phosphor/10"
              >
                ++ ADD ALL
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  n,
  name,
  status,
  tone,
  hint,
  className = '',
  children,
}: {
  id: string;
  n: string;
  name: string;
  status?: string;
  tone?: 'ok' | 'warn' | 'alert' | 'info' | 'idle';
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <HudPanel
      id={id}
      label={`CONFIG://${n} · ${name}`}
      status={status}
      tone={tone}
      className={'min-w-0 scroll-mt-24 ' + className}
    >
      {hint && <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">{hint}</p>}
      {children}
    </HudPanel>
  );
}

/** How complete the profile is, and what to fill in next for better matches. */
function profileChecks(profile: SettingsProfile, cities: string[], dream: string[]) {
  return [
    { id: 'roles', label: 'Target roles set', done: profile.target_roles.length > 0, weight: 20 },
    { id: 'skills', label: '5+ skills confirmed', done: profile.skills.length >= 5, weight: 25 },
    { id: 'resume', label: 'Resume on file', done: profile.has_resume, weight: 25 },
    { id: 'locations', label: 'Cities chosen', done: cities.length > 0, weight: 15 },
    { id: 'companies', label: '3+ dream companies', done: dream.length >= 3, weight: 15 },
  ];
}

const INDEX = [
  ['roles', 'TARGET_ROLES'],
  ['skills', 'SKILLS'],
  ['resume', 'RESUME'],
  ['portfolio', 'PORTFOLIO'],
  ['experience', 'EXPERIENCE'],
  ['locations', 'LOCATIONS'],
  ['auto-vault', 'AUTOPILOT'],
  ['companies', 'DREAM_COMPANIES'],
  ['identity', 'IDENTITY'],
  ['gmail', 'GMAIL_LINK'],
  ['targets', 'TARGETS'],
];

export default function SettingsPage() {
  const { user } = useUser();
  const api = useApi();
  const router = useRouter();
  useEscapeTo('/dashboard');

  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [dream, setDream] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState(false);
  /** What changed since the last SAVE or rescan, for the save bar. */
  const [dirty, setDirty] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [name, setName] = useState('');
  const [cityCompanies, setCityCompanies] = useState<CityCompany[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');

  const queue = useRef<Promise<void>>(Promise.resolve());
  const failedRef = useRef(false);
  const markSaved = useCallback((label: string) => {
    setSavedAt(Date.now());
    setDirty((d) => (d.includes(label) ? d : [...d, label]));
  }, []);
  const inFlight = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  // Lets a failed save's RETRY button call the latest save without save referencing itself.
  const retryRef = useRef<(patch: Record<string, unknown>, label: string) => void>(() => {});

  const load = useCallback(async () => {
    try {
      const r = await api('/api/settings');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
      if (!d.profile) setLoadError('No profile yet. Complete onboarding once, then edit everything here.');
      setProfile(d.profile);
      setName(d.profile?.full_name || '');
      setDream(d.dreamCompanies || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    void load();
  }, [load]);

  // Saves run one at a time, in order, so a slow request can never overwrite a newer change.
  const save = useCallback(
    (patch: Record<string, unknown>, label: string) => {
      inFlight.current += 1;
      setPending(inFlight.current);
      queue.current = queue.current.then(async () => {
        try {
          const res = await api('/api/settings', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(patch),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
          setFailed(false);
          failedRef.current = false;
          setChanged(true);
          markSaved(label);
          // Take the server's copy only once nothing newer is queued behind this save.
          if (inFlight.current === 1 && d.profile) setProfile(d.profile);
        } catch (err) {
          setFailed(true);
          failedRef.current = true;
          setNotice({
            tone: 'alert',
            text: `${label} not saved (${err instanceof Error ? err.message : 'network error'}). Showing what is stored.`,
            action: { label: 'RETRY', run: () => retryRef.current(patch, label) },
          });
          await load();
        } finally {
          inFlight.current -= 1;
          setPending(inFlight.current);
        }
      });
    },
    [api, load, markSaved],
  );

  useEffect(() => {
    retryRef.current = save;
  }, [save]);

  /** Optimistic local update + queued save. */
  const update = useCallback(
    (fields: Partial<SettingsProfile>, patch: Record<string, unknown>, label: string) => {
      setProfile((p) => (p ? { ...p, ...fields } : p));
      save(patch, label);
    },
    [save],
  );

  const cities = (profile?.location || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const citiesKey = cities.join('|');

  // Companies really present in the selected cities.
  useEffect(() => {
    if (loading) return;
    const list = citiesKey ? citiesKey.split('|') : [];
    const remote = list.some((c) => c.toLowerCase() === 'remote');
    const real = list.filter((c) => c.toLowerCase() !== 'remote');
    if (!real.length && !remote) return;
    const params = new URLSearchParams({ cities: real.join(','), ...(remote ? { remote: '1' } : {}) });
    let cancelled = false;
    api('/api/companies?' + params)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCityCompanies(d.companies || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, citiesKey, loading]);

  const setCities = (next: string[]) =>
    update({ location: next.join(', ') }, { location: next.join(', ') }, 'Locations');
  const toggleDream = (company: string) => {
    if (!dream.includes(company) && dream.length >= MAX_DREAM_COMPANIES)
      return setNotice({
        tone: 'info',
        text: `Up to ${MAX_DREAM_COMPANIES} dream companies. Remove one to add another.`,
      });
    const next = dream.includes(company) ? dream.filter((d) => d !== company) : [...dream, company];
    setDream(next);
    save({ dream_companies: next }, 'Dream companies');
  };

  const uploadResume = async (file: File) => {
    const problem = resumeProblem(file);
    if (problem) return setNotice({ tone: 'alert', text: problem });
    setUploading(true);
    try {
      await queue.current;
      const fd = new FormData();
      fd.append('resume', file);
      const res = await api('/api/settings/resume', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
      setProfile(d.profile);
      setChanged(true);
      markSaved('Resume');
      setNotice({
        tone: 'ok',
        text: `Resume updated · ${d.profile.resume_skills.length} skills detected and merged into your profile.`,
      });
    } catch (err) {
      setNotice({ tone: 'alert', text: 'Upload failed: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // RESCAN opens SCAN://LIVE once every queued save has landed, so the scan uses the newest profile.
  const [scanRun, setScanRun] = useState(0);
  const rescan = async () => {
    setRescanning(true);
    await queue.current;
    setScanRun((n) => n + 1);
  };
  const onScanFinished = (done: ScanDone) => {
    setRescanning(false);
    setChanged(false);
    setDirty([]);
    setNotice({
      tone: 'ok',
      text: done.total
        ? `Rescored ${done.total} jobs · ${done.vaulted} new in your Vault.`
        : done.message || 'No jobs indexed yet.',
      action: { label: 'OPEN DASHBOARD', run: () => router.push('/dashboard') },
    });
  };
  const onScanFailed = (error: string) => {
    setRescanning(false);
    setNotice({ tone: 'alert', text: 'Rescan failed: ' + error });
  };

  /** SAVE: every change is already on its way; wait for the last write, then confirm it landed. */
  const confirmSave = async () => {
    await queue.current;
    if (failedRef.current) return;
    setDirty([]);
    setNotice({
      tone: 'ok',
      text: 'Preferences saved. Rescan to rescore every open job with them.',
      action: { label: 'RESCAN', run: () => void rescan() },
    });
  };
  const showBar = pending > 0 || failed || dirty.length > 0;

  const syncState =
    pending > 0 ? (
      <StatusLight tone="warn">SYNCING</StatusLight>
    ) : failed ? (
      <StatusLight tone="alert">SAVE FAILED</StatusLight>
    ) : (
      <StatusLight tone="ok" pulse={false}>
        ALL CHANGES SAVED
      </StatusLight>
    );

  const visibleCompanies = (cities.length ? cityCompanies : []).filter((c) =>
    c.name.toLowerCase().includes(companyFilter.toLowerCase()),
  );
  const suggestedSkills = (profile?.resume_skills || []).filter(
    (s) => !(profile?.skills || []).some((x) => x.toLowerCase() === s),
  );

  const checks = profile ? profileChecks(profile, cities, dream) : [];
  const strength = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);

  const rescanPanel = (
    <HudPanel label="APPLY://RESCAN" status={changed ? 'PENDING' : 'IN SYNC'} tone={changed ? 'warn' : 'ok'}>
      <p className="text-sm leading-relaxed text-dim">
        {changed
          ? 'Your profile changed. Rescan to rescore every open job with it now.'
          : 'The next scheduled scan uses this profile. Rescan any time to see results now.'}
      </p>
      <button
        type="button"
        onClick={rescan}
        disabled={rescanning || uploading}
        className="mt-4 flex w-full items-center justify-center gap-2 bg-phosphor px-6 py-3 font-mono text-xs font-bold tracking-[0.2em] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66] disabled:cursor-wait disabled:bg-phosphor/40"
      >
        {rescanning && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
        {rescanning ? 'RESCANNING' : '[ RESCAN NOW ]'}
      </button>
    </HudPanel>
  );

  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="RADAR home" className="transition-opacity hover:opacity-85">
            <RadarLogo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{syncState}</span>
            <Link
              href="/dashboard"
              aria-keyshortcuts="Escape"
              title="Back to the dashboard (Esc)"
              className="border border-phosphor/30 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10"
            >
              <kbd className="font-mono">[ESC]</kbd> DASHBOARD
            </Link>
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-none border border-phosphor/40' } }}
            />
          </div>
        </div>
      </header>

      <main
        className={'relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10' + (showBar ? ' pb-40 sm:pb-28' : '')}
      >
        <div>
          <p className="font-mono text-[11px] tracking-[0.35em] text-phosphor/70">{'// PREFERENCES'}</p>
          <h1 className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            SYSTEM_CONFIG<span className="caret-blink text-phosphor">_</span>
          </h1>
          <p className="mt-2 text-sm text-dim">Every change saves instantly. Rescan to apply it to every open job.</p>
          <div className="mt-3 sm:hidden">{syncState}</div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-8" aria-busy="true">
            <div className="hidden h-96 animate-pulse border border-phosphor/10 bg-phosphor/[0.03] lg:block" />
            <div className="grid gap-6 xl:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-56 animate-pulse border border-phosphor/10 bg-phosphor/[0.03]" />
              ))}
            </div>
          </div>
        ) : !profile ? (
          <div className="mt-8 max-w-xl">
            <HudPanel label="CONFIG://ERROR" status="NO PROFILE" tone="alert">
              <p className="text-sm text-hud-red">{loadError || 'No profile found.'}</p>
              <Link
                href="/onboarding"
                className="mt-4 inline-block font-mono text-xs tracking-[0.2em] text-phosphor hover:underline"
              >
                → RUN ONBOARDING
              </Link>
            </HudPanel>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
            <aside className="space-y-6 lg:sticky lg:top-24">
              <HudPanel
                label="PROFILE://STRENGTH"
                status={strength >= 80 ? 'STRONG' : strength >= 50 ? 'PARTIAL' : 'WEAK'}
                tone={strength >= 80 ? 'ok' : strength >= 50 ? 'warn' : 'alert'}
              >
                <div className="flex items-end justify-between gap-3 font-mono">
                  <span className="text-5xl font-extrabold leading-none text-phosphor [text-shadow:0_0_20px_rgba(0,255,65,0.35)]">
                    {strength}
                    <span className="text-xl">%</span>
                  </span>
                  <span className="text-[10px] tracking-[0.25em] text-dim">MATCH READINESS</span>
                </div>
                <div className="mt-4 h-1.5 bg-phosphor/10">
                  <div
                    className="h-full bg-phosphor shadow-[0_0_10px_#00FF41] transition-[width] duration-500"
                    style={{ width: strength + '%' }}
                  />
                </div>
                <ul className="mt-5 space-y-2.5 font-mono text-xs">
                  {checks.map((c) => (
                    <li key={c.id}>
                      <a
                        href={'#' + c.id}
                        className={
                          'flex items-center justify-between gap-3 transition-colors ' +
                          (c.done ? 'text-phosphor/75' : 'text-hud-amber hover:text-white')
                        }
                      >
                        <span>
                          {c.done ? '[x] ' : '[ ] '}
                          {c.label}
                        </span>
                        {!c.done && <span className="shrink-0 text-[10px] tracking-[0.2em]">FIX →</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </HudPanel>

              {rescanPanel}

              <nav
                aria-label="Preference sections"
                className="hidden border-l border-phosphor/15 pl-5 font-mono lg:block"
              >
                <p className="mb-3 text-[10px] tracking-[0.35em] text-dim">{'// INDEX'}</p>
                <ol className="space-y-2">
                  {INDEX.map(([id, label], i) => (
                    <li key={id}>
                      <a
                        href={'#' + id}
                        className="text-[11px] tracking-[0.2em] text-phosphor/60 transition-colors hover:text-phosphor"
                      >
                        <span className="text-dim">{String(i + 1).padStart(2, '0')} </span>
                        {label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <div className="grid gap-6 xl:grid-cols-2">
              <Section
                id="roles"
                n="01"
                name="TARGET_ROLES"
                status={profile.target_roles.length ? profile.target_roles.length + ' SET' : 'NONE'}
                tone={profile.target_roles.length ? 'ok' : 'warn'}
                hint="The roles you want. Any job whose title contains one of these gets +10, so they rise to the top."
              >
                <ChipInput
                  values={profile.target_roles}
                  max={8}
                  placeholder="e.g. AI Engineer, Software Engineer"
                  suggestions={ROLE_SUGGESTIONS}
                  suggestionLabel="QUICK ADD"
                  onChange={(next) => update({ target_roles: next }, { target_roles: next }, 'Target roles')}
                />
              </Section>

              <Section
                id="skills"
                n="02"
                name="SKILLS"
                status={profile.skills.length ? profile.skills.length + ' CONFIRMED' : 'FROM RESUME'}
                tone={profile.skills.length ? 'ok' : 'warn'}
                hint={
                  profile.skills.length
                    ? '40% of every score is how many of a job’s listed skills you have.'
                    : `Matching currently uses the ${profile.resume_skills.length} skills found in your resume. Add your own to take control.`
                }
              >
                <ChipInput
                  values={profile.skills}
                  placeholder="e.g. Python, LangChain, RAG, React"
                  suggestions={suggestedSkills}
                  suggestionLabel="DETECTED IN YOUR RESUME"
                  onChange={(next) => update({ skills: next }, { skills: next }, 'Skills')}
                />
              </Section>

              <Section
                id="resume"
                n="03"
                name="RESUME"
                status={profile.has_resume ? 'ON FILE' : 'MISSING'}
                tone={profile.has_resume ? 'ok' : 'alert'}
                hint="Your resume drives the semantic half of every score. Upload a new one any time; its skills are merged into yours."
              >
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void uploadResume(f);
                  }}
                  className={
                    'flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors ' +
                    (dragging
                      ? 'border-phosphor bg-phosphor/10'
                      : 'border-phosphor/30 hover:border-phosphor/70 hover:bg-phosphor/[0.03]')
                  }
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadResume(f);
                    }}
                  />
                  <span className="font-mono text-sm font-bold tracking-[0.2em] text-phosphor">
                    {uploading ? 'PARSING RESUME…' : '[ UPLOAD NEW RESUME ]'}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-dim">
                    PDF · max 4 MB · drop it here or click
                  </span>
                </label>
              </Section>

              <PortfolioSection
                portfolio={profile.portfolio}
                onSave={(next) => update({ portfolio: next }, { portfolio: next }, 'Portfolio')}
              />

              <Section
                id="experience"
                n="05"
                name="EXPERIENCE"
                hint="Used to keep senior-only roles from crowding your feed."
              >
                <div className="grid grid-cols-2 border border-phosphor/25">
                  {[
                    { v: true, t: 'FRESHER / INTERN' },
                    { v: false, t: 'EXPERIENCED' },
                  ].map((o) => (
                    <button
                      key={o.t}
                      type="button"
                      aria-pressed={profile.is_fresher === o.v}
                      onClick={() =>
                        update(
                          { is_fresher: o.v, ...(o.v ? { experience_years: 0 } : {}) },
                          { is_fresher: o.v, ...(o.v ? { experience_years: 0 } : {}) },
                          'Experience',
                        )
                      }
                      className={
                        'py-3 font-mono text-xs font-bold tracking-[0.2em] transition-colors first:border-r first:border-phosphor/25 ' +
                        (profile.is_fresher === o.v ? 'bg-phosphor text-black' : 'text-dim hover:text-phosphor')
                      }
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
                {!profile.is_fresher && (
                  <div className="mt-5">
                    <div className="flex justify-between font-mono text-[11px] tracking-[0.2em] text-dim">
                      <span>YEARS OF EXPERIENCE</span>
                      <span className="text-phosphor">{profile.experience_years}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={profile.experience_years}
                      aria-label="Years of experience"
                      className="mt-2 w-full accent-[#00FF41]"
                      onChange={(e) => setProfile({ ...profile, experience_years: Number(e.target.value) })}
                      onPointerUp={() => save({ experience_years: profile.experience_years }, 'Experience')}
                      onKeyUp={() => save({ experience_years: profile.experience_years }, 'Experience')}
                    />
                  </div>
                )}
              </Section>

              <Section
                id="locations"
                n="06"
                name="LOCATIONS"
                status={cities.length ? cities.length + ' CITIES' : 'NONE'}
                tone={cities.length ? 'ok' : 'alert'}
                hint="+5 for jobs in these cities, −25 for anywhere else. Add Remote if you want remote roles."
              >
                <ChipInput
                  values={cities}
                  placeholder="Add a city"
                  suggestions={CITY_SUGGESTIONS}
                  suggestionLabel="QUICK ADD"
                  onChange={setCities}
                />
              </Section>

              <Section
                id="auto-vault"
                n="07"
                name="AUTOPILOT"
                status={profile.auto_vault ? (profile.auto_overclock ? 'ARMED · OVERCLOCK' : 'ARMED') : 'OFF'}
                tone={profile.auto_vault ? 'ok' : 'idle'}
                hint="After every scan, new matches at or above this score are saved to your Vault for you."
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.auto_vault}
                  onClick={() =>
                    update({ auto_vault: !profile.auto_vault }, { auto_vault: !profile.auto_vault }, 'Auto-vault')
                  }
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-sm text-ink">Save strong matches automatically</span>
                  <span
                    className={
                      'relative h-6 w-11 shrink-0 border transition-colors ' +
                      (profile.auto_vault ? 'border-phosphor bg-phosphor/20' : 'border-phosphor/25')
                    }
                  >
                    <span
                      className={
                        'absolute top-0.5 h-4 w-4 transition-all ' +
                        (profile.auto_vault ? 'left-[22px] bg-phosphor shadow-[0_0_8px_#00FF41]' : 'left-0.5 bg-dim')
                      }
                    />
                  </span>
                </button>
                <div className={'mt-6 ' + (profile.auto_vault ? '' : 'opacity-40')}>
                  <div className="flex justify-between font-mono text-[11px] tracking-[0.2em] text-dim">
                    <span>MINIMUM MATCH SCORE</span>
                    <span className="text-phosphor">{profile.vault_min_score}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={95}
                    step={5}
                    value={profile.vault_min_score}
                    disabled={!profile.auto_vault}
                    aria-label="Minimum match score for auto-vault"
                    className="mt-2 w-full accent-[#00FF41]"
                    onChange={(e) => setProfile({ ...profile, vault_min_score: Number(e.target.value) })}
                    onPointerUp={() => save({ vault_min_score: profile.vault_min_score }, 'Minimum score')}
                    onKeyUp={() => save({ vault_min_score: profile.vault_min_score }, 'Minimum score')}
                  />
                </div>

                <div className="mt-6 border-t border-phosphor/10 pt-5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!profile.auto_overclock}
                    disabled={profile.auto_overclock === null}
                    onClick={() =>
                      update(
                        { auto_overclock: !profile.auto_overclock },
                        { auto_overclock: !profile.auto_overclock },
                        'Auto-OVERCLOCK',
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>
                      <span className="block text-sm text-ink">Auto-OVERCLOCK near misses</span>
                      <span className="mt-1 block text-xs leading-relaxed text-dim">
                        Every day the AI tailors your resume for the best 50–79% matches; any that project past your bar
                        move into the Vault with the tailored CV attached. Each one is a paid API call.
                      </span>
                    </span>
                    <span
                      className={
                        'relative h-6 w-11 shrink-0 border transition-colors ' +
                        (profile.auto_overclock ? 'border-phosphor bg-phosphor/20' : 'border-phosphor/25')
                      }
                    >
                      <span
                        className={
                          'absolute top-0.5 h-4 w-4 transition-all ' +
                          (profile.auto_overclock
                            ? 'left-[22px] bg-phosphor shadow-[0_0_8px_#00FF41]'
                            : 'left-0.5 bg-dim')
                        }
                      />
                    </span>
                  </button>
                  {profile.auto_overclock === null ? (
                    <p className="mt-3 font-mono text-[10px] tracking-wider text-hud-amber">
                      Run migration 007 to switch this on.
                    </p>
                  ) : (
                    <div className={'mt-4 ' + (profile.auto_overclock ? '' : 'opacity-40')}>
                      <div className="flex justify-between font-mono text-[11px] tracking-[0.2em] text-dim">
                        <span>TAILORINGS PER DAY (MAX)</span>
                        <span className="text-phosphor">{profile.overclock_daily_cap}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={profile.overclock_daily_cap}
                        disabled={!profile.auto_overclock}
                        aria-label="Auto-OVERCLOCK tailorings per day"
                        className="mt-2 w-full accent-[#00FF41]"
                        onChange={(e) => setProfile({ ...profile, overclock_daily_cap: Number(e.target.value) })}
                        onPointerUp={() => save({ overclock_daily_cap: profile.overclock_daily_cap }, 'Daily cap')}
                        onKeyUp={() => save({ overclock_daily_cap: profile.overclock_daily_cap }, 'Daily cap')}
                      />
                    </div>
                  )}
                </div>
              </Section>

              <Section
                id="companies"
                n="08"
                name="DREAM_COMPANIES"
                status={dream.length + ' / ' + MAX_DREAM_COMPANIES}
                tone={dream.length ? 'ok' : 'idle'}
                className="xl:col-span-2"
                hint="Every open role at these companies is scored for you on each scan. ● = live jobs tracked · number = open roles now."
              >
                {dream.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {dream.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-2 bg-phosphor px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-black"
                      >
                        {d.toUpperCase()}
                        <button type="button" onClick={() => toggleDream(d)} aria-label={'Remove ' + d}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={companyFilter}
                  placeholder="Filter companies…"
                  aria-label="Filter companies"
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="mb-3 w-full border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-sm text-phosphor placeholder:text-phosphor/35 focus:border-phosphor/70 focus:outline-none"
                />
                <div className="custom-scrollbar grid max-h-96 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {visibleCompanies.map((c) => {
                    const on = dream.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDream(c.name)}
                        className={
                          'border px-3 py-2 text-left font-mono text-xs transition-colors ' +
                          (on
                            ? 'border-phosphor bg-phosphor/10 text-phosphor'
                            : 'border-phosphor/15 text-phosphor/70 hover:border-phosphor/50 hover:text-phosphor')
                        }
                      >
                        <span className="block truncate font-bold">
                          {c.tracked ? '● ' : ''}
                          {c.name}
                        </span>
                        <span className="block text-[10px] text-dim">
                          {c.tier}
                          {c.openJobs ? ' · ' + c.openJobs + ' open' : ''}
                        </span>
                      </button>
                    );
                  })}
                  {!visibleCompanies.length && (
                    <p className="col-span-full font-mono text-xs text-dim">
                      {cities.length
                        ? 'No companies found for these cities yet.'
                        : 'Add a location to see companies there.'}
                    </p>
                  )}
                </div>
              </Section>

              <Section id="identity" n="09" name="IDENTITY" className="xl:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-dim">EMAIL</p>
                    <p className="break-all py-2 font-mono text-sm text-phosphor/90">
                      {user?.emailAddresses?.[0]?.emailAddress || '—'}
                    </p>
                  </div>
                  <label>
                    <span className="mb-2 block font-mono text-[10px] tracking-[0.3em] text-dim">NAME</span>
                    <input
                      value={name}
                      placeholder="Your name"
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        if (name.trim() !== (profile.full_name || ''))
                          update({ full_name: name.trim() }, { full_name: name }, 'Name');
                      }}
                      className="w-full border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-sm text-phosphor placeholder:text-phosphor/35 focus:border-phosphor/70 focus:outline-none"
                    />
                  </label>
                </div>
              </Section>

              <GmailLink onNotice={setNotice} />
              <TargetImport onNotice={setNotice} />

              <Link
                href="/onboarding"
                className="block border border-phosphor/15 py-3 text-center font-mono text-[11px] tracking-[0.25em] text-dim transition-colors hover:border-phosphor/40 hover:text-phosphor xl:col-span-2"
              >
                REDO FULL ONBOARDING
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* COMMIT://CONFIG — every change saves as you make it; this bar shows that, and SAVE confirms it landed. */}
      <AnimatePresence>
        {showBar && profile && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-phosphor/30 bg-black/90 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            <div
              className={
                'absolute inset-x-0 top-0 h-px ' + (pending > 0 ? 'hud-flow' : failed ? 'bg-hud-red' : 'bg-phosphor/60')
              }
            />
            <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-[0.35em] text-dim">COMMIT://CONFIG</p>
                <div className="mt-1 flex min-w-0 items-center gap-3">
                  {pending > 0 ? (
                    <StatusLight tone="warn">
                      WRITING {pending} CHANGE{pending > 1 ? 'S' : ''}
                    </StatusLight>
                  ) : failed ? (
                    <StatusLight tone="alert">LAST CHANGE NOT SAVED · USE RETRY</StatusLight>
                  ) : (
                    <StatusLight tone="ok" pulse={false}>
                      SAVED
                      {savedAt ? ' · ' + new Date(savedAt).toLocaleTimeString([], { hour12: false }) : ''}
                    </StatusLight>
                  )}
                  {dirty.length > 0 && (
                    <span className="truncate font-mono text-[11px] text-phosphor/70">
                      {dirty.join(' · ').toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void confirmSave()}
                  disabled={pending > 0 || uploading}
                  className="flex-1 border border-phosphor/50 px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.25em] text-phosphor transition-colors hover:bg-phosphor/10 disabled:cursor-wait disabled:opacity-50 sm:flex-none"
                >
                  [ SAVE ]
                </button>
                <button
                  type="button"
                  onClick={() => void rescan()}
                  disabled={rescanning || uploading}
                  className="flex flex-1 items-center justify-center gap-2 bg-phosphor px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.25em] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66] disabled:cursor-wait disabled:bg-phosphor/40 sm:flex-none"
                >
                  {rescanning && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  )}
                  {rescanning ? 'RESCANNING' : 'SAVE & RESCAN'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {scanRun > 0 && (
        <ScanConsole
          key={scanRun}
          onFinished={onScanFinished}
          onFailed={onScanFailed}
          onClose={() => {
            setScanRun(0);
            setRescanning(false);
          }}
        />
      )}

      <Toast notice={notice} onClose={closeNotice} raised={showBar} />
    </div>
  );
}
