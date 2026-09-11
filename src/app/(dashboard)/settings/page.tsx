'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/use-api';
import { useRouter } from 'next/navigation';

interface Profile {
  full_name: string | null;
  location: string | null;
  is_fresher: boolean;
  experience_years: number;
  skills: string[];
  resume_text: string | null;
  vault_min_score?: number;
  auto_vault?: boolean;
}

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

const box = 'p-6 bg-black border border-[#00FF41]/40 shadow-[0_0_15px_rgba(0,255,65,0.08)]';
const label = 'block text-[11px] font-bold uppercase tracking-widest mb-2 text-[#00FF41]/70';
const input =
  'w-full bg-black border border-[#004400] px-3 py-2 text-sm text-[#00FF41] focus:outline-none focus:border-[#00FF41] placeholder:text-[#006600]';
const chip = 'text-xs px-2 py-1 border uppercase tracking-wider flex items-center gap-2';

export default function SettingsPage() {
  const { user } = useUser();
  const api = useApi();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');

  const [fullName, setFullName] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [isFresher, setIsFresher] = useState(true);
  const [years, setYears] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [dream, setDream] = useState<string[]>([]);
  const [hasResume, setHasResume] = useState(false);
  const [autoVault, setAutoVault] = useState(true);
  const [minScore, setMinScore] = useState(70);

  const [cityCompanies, setCityCompanies] = useState<CityCompany[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');

  useEffect(() => {
    api('/api/settings')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
        const p: Profile | null = d.profile;
        if (p) {
          setFullName(p.full_name || '');
          setCities(
            (p.location || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
          setIsFresher(p.is_fresher ?? true);
          setYears(p.experience_years ?? 0);
          setSkills(p.skills || []);
          setHasResume(!!p.resume_text);
          setAutoVault(p.auto_vault !== false);
          setMinScore(p.vault_min_score ?? 70);
        } else {
          setLoadError('No profile yet. Complete onboarding once, then edit everything here.');
        }
        setDream(d.dreamCompanies || []);
      })
      .catch((err) => setLoadError(String(err.message || err)))
      .finally(() => setLoading(false));
  }, [api]);

  // Companies really present in the selected cities
  useEffect(() => {
    if (loading) return;
    const remote = cities.some((c) => c.toLowerCase() === 'remote');
    const real = cities.filter((c) => c.toLowerCase() !== 'remote');
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
  }, [api, cities, loading]);

  const save = useCallback(
    async (patch: Record<string, unknown>, what: string) => {
      setStatus('SAVING ' + what + '...');
      try {
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const d = await res.json().catch(() => ({}));
        setStatus(res.ok ? what + ' SAVED ✓' : 'SAVE FAILED: ' + (d.error || res.status));
      } catch {
        setStatus('SAVE FAILED: network error');
      }
    },
    [api],
  );

  const addCity = (c: string) => {
    const v = c.trim();
    if (!v || cities.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    const next = [...cities, v];
    setCities(next);
    setCityInput('');
    void save({ location: next.join(', ') }, 'LOCATIONS');
  };
  const removeCity = (c: string) => {
    const next = cities.filter((x) => x !== c);
    setCities(next);
    void save({ location: next.join(', ') }, 'LOCATIONS');
  };
  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || skills.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    const next = [...skills, v];
    setSkills(next);
    setSkillInput('');
    void save({ skills: next }, 'SKILLS');
  };
  const removeSkill = (s: string) => {
    const next = skills.filter((x) => x !== s);
    setSkills(next);
    void save({ skills: next }, 'SKILLS');
  };
  const toggleDream = (name: string) => {
    const next = dream.includes(name) ? dream.filter((d) => d !== name) : dream.length >= 20 ? dream : [...dream, name];
    setDream(next);
    void save({ dream_companies: next }, 'DREAM COMPANIES');
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black font-mono">
        <p className="text-sm text-[#00FF41] animate-pulse">INIT_SETTINGS_MODULE...</p>
      </div>
    );

  const visibleCompanies = (cities.length ? cityCompanies : []).filter((c) =>
    c.name.toLowerCase().includes(companyFilter.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-black bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:20px_20px] font-mono">
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#00FF41]/30 bg-black/90 backdrop-blur">
        <button onClick={() => router.push('/dashboard')} className="text-sm font-bold text-[#00FF41] hover:underline">
          [ESC] DASHBOARD
        </button>
        <span className="text-[11px] font-bold tracking-widest text-[#00FF41]/80">{status || '/SETTINGS_ROOT'}</span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-[#00FF41] uppercase tracking-widest">&gt; SYSTEM_CONFIG_</h1>
          <p className="text-xs text-[#00FF41]/50 mt-2">Every change saves instantly. The next scan uses it.</p>
        </div>

        {loadError && (
          <div className="p-4 border border-[#EF4444] text-sm text-[#EF4444]">
            {loadError}
            <button onClick={() => router.push('/onboarding')} className="block mt-3 underline">
              Run onboarding →
            </button>
          </div>
        )}

        {/* Identity */}
        <section className={box}>
          <h2 className="text-xs font-bold tracking-widest mb-5 text-[#00FF41]">--- IDENTITY ---</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className={label}>Email</span>
              <p className="text-sm text-[#00FF41] py-2 break-all">{user?.emailAddresses?.[0]?.emailAddress || '—'}</p>
            </div>
            <div>
              <span className={label}>Name</span>
              <input
                className={input}
                value={fullName}
                placeholder="Your name"
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => save({ full_name: fullName }, 'NAME')}
              />
            </div>
          </div>
        </section>

        {/* Experience */}
        <section className={box}>
          <h2 className="text-xs font-bold tracking-widest mb-5 text-[#00FF41]">--- EXPERIENCE ---</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { v: true, t: 'Fresher / Intern' },
              { v: false, t: 'Experienced' },
            ].map((o) => (
              <button
                key={o.t}
                onClick={() => {
                  setIsFresher(o.v);
                  void save({ is_fresher: o.v, ...(o.v ? { experience_years: 0 } : {}) }, 'EXPERIENCE');
                  if (o.v) setYears(0);
                }}
                className="px-4 py-2 text-sm font-bold border"
                style={{
                  borderColor: isFresher === o.v ? '#00FF41' : '#004400',
                  color: isFresher === o.v ? '#00FF41' : '#00aa00',
                  background: isFresher === o.v ? 'rgba(0,255,65,0.1)' : 'transparent',
                }}
              >
                {o.t}
              </button>
            ))}
          </div>
          {!isFresher && (
            <div>
              <span className={label}>Years of experience: {years}</span>
              <input
                type="range"
                min={0}
                max={20}
                value={years}
                className="w-full accent-[#00FF41]"
                onChange={(e) => setYears(Number(e.target.value))}
                onPointerUp={() => save({ experience_years: years }, 'EXPERIENCE')}
                onKeyUp={() => save({ experience_years: years }, 'EXPERIENCE')}
              />
            </div>
          )}
        </section>

        {/* Locations */}
        <section className={box}>
          <h2 className="text-xs font-bold tracking-widest mb-5 text-[#00FF41]">--- TARGET LOCATIONS ---</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {cities.map((c) => (
              <span key={c} className={chip + ' border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10'}>
                {c}
                <button onClick={() => removeCity(c)} className="hover:text-[#EF4444]" aria-label={'Remove ' + c}>
                  ×
                </button>
              </span>
            ))}
            {!cities.length && <span className="text-xs text-[#EF4444]">No location set</span>}
          </div>
          <div className="flex gap-2 mb-3">
            <input
              className={input}
              value={cityInput}
              placeholder="Add a city (Enter)"
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCity(cityInput)}
            />
            <button
              onClick={() => addCity(cityInput)}
              className="px-4 border border-[#00FF41] text-[#00FF41] text-sm font-bold hover:bg-[#00FF41]/10"
            >
              ADD
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CITY_SUGGESTIONS.filter((s) => !cities.includes(s)).map((s) => (
              <button
                key={s}
                onClick={() => addCity(s)}
                className="text-[11px] px-2 py-1 border border-dashed border-[#004400] text-[#00aa00] hover:border-[#00FF41]"
              >
                + {s}
              </button>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className={box}>
          <h2 className="text-xs font-bold tracking-widest mb-1 text-[#00FF41]">--- SKILLS ---</h2>
          <p className="text-[11px] text-[#00FF41]/50 mb-4">
            Resume on file: {hasResume ? 'yes' : 'no — skills are all RADAR has to match on'}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((s) => (
              <span key={s} className={chip + ' border-[#00FF41]/60 text-[#00FF41] bg-[#00FF41]/10'}>
                {s}
                <button onClick={() => removeSkill(s)} className="hover:text-[#EF4444]" aria-label={'Remove ' + s}>
                  ×
                </button>
              </span>
            ))}
            {!skills.length && <span className="text-xs text-[#EF4444]">No skills yet</span>}
          </div>
          <div className="flex gap-2">
            <input
              className={input}
              value={skillInput}
              placeholder="e.g. React, Python, SQL (Enter)"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            />
            <button
              onClick={addSkill}
              className="px-4 border border-[#00FF41] text-[#00FF41] text-sm font-bold hover:bg-[#00FF41]/10"
            >
              ADD
            </button>
          </div>
        </section>

        {/* Dream companies */}
        <section className={box}>
          <div className="flex items-end justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xs font-bold tracking-widest text-[#00FF41]">--- DREAM COMPANIES ---</h2>
              <p className="text-[11px] text-[#00FF41]/50 mt-1">
                Only companies really in your cities. ● = live jobs tracked · number = open roles now
              </p>
            </div>
            <span className="text-2xl font-black text-[#00FF41]">{dream.length}</span>
          </div>
          {dream.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {dream.map((d) => (
                <span key={d} className={chip + ' border-[#00FF41] text-black bg-[#00FF41]'}>
                  {d}
                  <button onClick={() => toggleDream(d)} aria-label={'Remove ' + d}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            className={input + ' mb-3'}
            value={companyFilter}
            placeholder="Filter companies..."
            onChange={(e) => setCompanyFilter(e.target.value)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
            {visibleCompanies.map((c) => {
              const on = dream.includes(c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => toggleDream(c.name)}
                  className="px-3 py-2 text-left border text-xs font-bold"
                  style={{
                    borderColor: on ? '#00FF41' : '#004400',
                    color: on ? '#00FF41' : '#00aa00',
                    background: on ? 'rgba(0,255,65,0.1)' : 'transparent',
                  }}
                >
                  <span className="block truncate">
                    {c.tracked ? '● ' : ''}
                    {c.name}
                  </span>
                  <span className="block text-[10px] opacity-60">
                    {c.tier}
                    {c.openJobs ? ' · ' + c.openJobs + ' open' : ''}
                  </span>
                </button>
              );
            })}
            {!visibleCompanies.length && (
              <p className="col-span-full text-xs text-[#00aa00]">
                {cities.length ? 'No companies found for these cities yet.' : 'Add a location to see companies there.'}
              </p>
            )}
          </div>
        </section>

        {/* Auto vault */}
        <section className={box}>
          <h2 className="text-xs font-bold tracking-widest mb-5 text-[#00FF41]">--- AUTO_VAULT ---</h2>
          <label className="flex items-center justify-between cursor-pointer mb-5">
            <span className="text-sm text-[#00FF41]/80">Save strong matches to the Vault automatically</span>
            <input
              type="checkbox"
              className="w-5 h-5 accent-[#00FF41]"
              checked={autoVault}
              onChange={(e) => {
                setAutoVault(e.target.checked);
                void save({ auto_vault: e.target.checked }, 'AUTO VAULT');
              }}
            />
          </label>
          <span className={label}>Minimum match score: {minScore}%</span>
          <input
            type="range"
            min={40}
            max={95}
            step={5}
            value={minScore}
            className="w-full accent-[#00FF41]"
            onChange={(e) => setMinScore(Number(e.target.value))}
            onPointerUp={() => save({ vault_min_score: minScore }, 'MIN SCORE')}
            onKeyUp={() => save({ vault_min_score: minScore }, 'MIN SCORE')}
          />
        </section>

        <button
          onClick={() => router.push('/onboarding')}
          className="w-full py-3 text-xs font-bold uppercase tracking-widest border border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41]/10"
        >
          Re-upload resume / redo full onboarding
        </button>
      </div>
    </div>
  );
}
