'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/use-api';
import type { SettingsProfile } from '@/types';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { Toast, type Notice } from '@/components/hud/Toast';

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
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

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
  n,
  name,
  status,
  tone,
  hint,
  children,
}: {
  n: string;
  name: string;
  status?: string;
  tone?: 'ok' | 'warn' | 'alert' | 'info' | 'idle';
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <HudPanel label={`CONFIG://${n} · ${name}`} status={status} tone={tone}>
      {hint && <p className="-mt-1 mb-5 text-sm leading-relaxed text-dim">{hint}</p>}
      {children}
    </HudPanel>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const api = useApi();
  const router = useRouter();

  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [dream, setDream] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [name, setName] = useState('');
  const [cityCompanies, setCityCompanies] = useState<CityCompany[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');

  const queue = useRef<Promise<void>>(Promise.resolve());
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
          setChanged(true);
          // Take the server's copy only once nothing newer is queued behind this save.
          if (inFlight.current === 1 && d.profile) setProfile(d.profile);
        } catch (err) {
          setFailed(true);
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
    [api, load],
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
    if (!dream.includes(company) && dream.length >= 20)
      return setNotice({ tone: 'info', text: 'Up to 20 dream companies. Remove one to add another.' });
    const next = dream.includes(company) ? dream.filter((d) => d !== company) : [...dream, company];
    setDream(next);
    save({ dream_companies: next }, 'Dream companies');
  };

  const uploadResume = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return setNotice({ tone: 'alert', text: 'Resume must be a PDF.' });
    if (file.size > MAX_RESUME_BYTES) return setNotice({ tone: 'alert', text: 'Resume must be under 5 MB.' });
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

  const rescan = async () => {
    setRescanning(true);
    try {
      await queue.current;
      const res = await api('/api/match', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'HTTP ' + res.status);
      setChanged(false);
      setNotice({
        tone: 'ok',
        text: d.total
          ? `Rescored ${d.total} jobs · ${d.vaulted} new in your Vault.`
          : d.message || 'No jobs indexed yet.',
        action: { label: 'OPEN DASHBOARD', run: () => router.push('/dashboard') },
      });
    } catch (err) {
      setNotice({ tone: 'alert', text: 'Rescan failed: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setRescanning(false);
    }
  };

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

  return (
    <div className="relative min-h-screen bg-void">
      <div className="hud-grid pointer-events-none fixed inset-0" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-phosphor/15 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="RADAR home" className="transition-opacity hover:opacity-85">
            <RadarLogo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{syncState}</span>
            <Link
              href="/dashboard"
              className="border border-phosphor/30 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.2em] text-phosphor transition-colors hover:bg-phosphor/10"
            >
              [ESC] DASHBOARD
            </Link>
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-none border border-phosphor/40' } }}
            />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.35em] text-phosphor/70">{'// PREFERENCES'}</p>
          <h1 className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            SYSTEM_CONFIG<span className="caret-blink text-phosphor">_</span>
          </h1>
          <p className="mt-2 text-sm text-dim">Every change saves instantly. Rescan to apply it to every open job.</p>
          <div className="mt-3 sm:hidden">{syncState}</div>
        </div>

        {loading ? (
          <div className="space-y-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse border border-phosphor/10 bg-phosphor/[0.03]" />
            ))}
          </div>
        ) : !profile ? (
          <HudPanel label="CONFIG://ERROR" status="NO PROFILE" tone="alert">
            <p className="text-sm text-hud-red">{loadError || 'No profile found.'}</p>
            <Link
              href="/onboarding"
              className="mt-4 inline-block font-mono text-xs tracking-[0.2em] text-phosphor hover:underline"
            >
              → RUN ONBOARDING
            </Link>
          </HudPanel>
        ) : (
          <>
            <Section
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
                  'flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors ' +
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
                  PDF · max 5 MB · drop it here or click
                </span>
              </label>
            </Section>

            <Section n="04" name="EXPERIENCE" hint="Used to keep senior-only roles from crowding your feed.">
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
              n="05"
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
              n="06"
              name="DREAM_COMPANIES"
              status={dream.length + ' / 20'}
              tone={dream.length ? 'ok' : 'idle'}
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
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="mb-3 w-full border border-phosphor/25 bg-black/60 px-3 py-2 font-mono text-sm text-phosphor placeholder:text-phosphor/35 focus:border-phosphor/70 focus:outline-none"
              />
              <div className="custom-scrollbar grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
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

            <Section
              n="07"
              name="AUTO_VAULT"
              status={profile.auto_vault ? 'ARMED' : 'OFF'}
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
            </Section>

            <Section n="08" name="IDENTITY">
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

            <HudPanel
              label="APPLY://RESCAN"
              status={changed ? 'CHANGES PENDING' : 'IN SYNC'}
              tone={changed ? 'warn' : 'ok'}
              className="border-phosphor/50"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-dim">
                  {changed
                    ? 'Your profile changed. Rescan to rescore every open job with it now.'
                    : 'The next scheduled scan uses this profile. Rescan any time to see results now.'}
                </p>
                <button
                  type="button"
                  onClick={rescan}
                  disabled={rescanning || uploading}
                  className="flex shrink-0 items-center justify-center gap-2 bg-phosphor px-6 py-3 font-mono text-xs font-bold tracking-[0.2em] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-colors hover:bg-[#33FF66] disabled:cursor-wait disabled:bg-phosphor/40"
                >
                  {rescanning && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  )}
                  {rescanning ? 'RESCANNING' : '[ RESCAN NOW ]'}
                </button>
              </div>
            </HudPanel>

            <Link
              href="/onboarding"
              className="block border border-phosphor/15 py-3 text-center font-mono text-[11px] tracking-[0.25em] text-dim transition-colors hover:border-phosphor/40 hover:text-phosphor"
            >
              REDO FULL ONBOARDING
            </Link>
          </>
        )}
      </main>

      <Toast notice={notice} onClose={closeNotice} />
    </div>
  );
}
