'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RadarLogo } from '@/components/brand/RadarLogo';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/use-api';
import { motion, AnimatePresence } from 'framer-motion';
import { TiltCard } from '@/components/onboarding/TiltCard';
import { TOP_CITIES, REMOTE_REGIONS, FIELDS_OF_STUDY, ROLES, ORG_CULTURES } from '@/components/onboarding/constants';

export default function OnboardingPage() {
  const { user } = useUser();
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Career State
  const [careerStage, setCareerStage] = useState<'Fresher' | 'Experienced' | 'Intern' | null>(null);

  // 2. Professional XP
  const [experienceYears, setExperienceYears] = useState(1);
  const [currentRole, setCurrentRole] = useState('');
  const [customRole, setCustomRole] = useState('');

  // 3. Academics
  const [educationLevel, setEducationLevel] = useState('');
  const [passingYear, setPassingYear] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [customField, setCustomField] = useState('');

  // 4. Operating Base (Work Model + Location)
  const [workModel, setWorkModel] = useState('');
  const [country, setCountry] = useState('India');
  const [locations, setLocations] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);

  // 5. Org Culture
  const [orgCultures, setOrgCultures] = useState<string[]>([]);

  // 6. Dream Stack
  const [dreamCompanies, setDreamCompanies] = useState<string[]>([]);

  // 7. Resume & Builder Console
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualSkills, setManualSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [manualProjects, setManualProjects] = useState('');
  const [manualBio, setManualBio] = useState('');

  const [companyResult, setCompanyResult] = useState<{
    key: string;
    list: { name: string; tier: string; openJobs: number; tracked: boolean; evidence: string }[];
  }>({ key: '', list: [] });
  const companyQuery = new URLSearchParams(
    workModel.toLowerCase().includes('remote') ? { remote: '1' } : { cities: locations.join(',') },
  ).toString();
  const cityCompanies = companyResult.list;
  const companiesLoading = step === 6 && companyResult.key !== companyQuery;

  useEffect(() => {
    if (step !== 6) return;
    let cancelled = false;
    api('/api/companies?' + companyQuery)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCompanyResult({ key: companyQuery, list: d.companies || [] });
      })
      .catch(() => {
        if (!cancelled) setCompanyResult({ key: companyQuery, list: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [api, step, companyQuery]);

  const toggleCulture = (cultureTitle: string) => {
    setOrgCultures((prev) => {
      if (prev.includes(cultureTitle)) return prev.filter((c) => c !== cultureTitle);
      return [...prev, cultureTitle];
    });
  };

  const toggleCompany = (companyName: string) => {
    setDreamCompanies((prev) => {
      if (prev.includes(companyName)) return prev.filter((c) => c !== companyName);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, companyName];
    });
  };

  const toggleLocation = (loc: string) => {
    setLocations((prev) => {
      if (prev.includes(loc)) return prev.filter((l) => l !== loc);
      return [...prev, loc];
    });
  };

  const addCustomCity = () => {
    if (customCity && !locations.includes(customCity)) {
      setLocations([...locations, customCity]);
      setCustomCity('');
      setShowCustomCity(false);
    }
  };

  const addManualSkill = () => {
    if (skillInput.trim() && !manualSkills.includes(skillInput.trim())) {
      setManualSkills([...manualSkills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeManualSkill = (skill: string) => {
    setManualSkills(manualSkills.filter((s) => s !== skill));
  };

  const selectAndNext = (setter: any, val: any, skipLogic?: (val: any) => number) => {
    setter(val);
    setTimeout(() => {
      if (skipLogic) setStep(skipLogic(val));
      else setStep((s) => s + 1);
    }, 250);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setResumeFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleNext = () => {
    if (step === 1 && !careerStage) return setError('Please select your career stage.');
    if (step === 2 && careerStage === 'Experienced' && (!currentRole || (currentRole === 'Other' && !customRole)))
      return setError('Please enter your current role.');
    if (step === 3 && (!educationLevel || !passingYear || !fieldOfStudy || (fieldOfStudy === 'Other' && !customField)))
      return setError('Please fill all education details.');
    if (step === 4 && (!workModel || locations.length === 0))
      return setError('Please select your work model and at least one location.');
    if (step === 5 && orgCultures.length === 0) return setError('Please select at least one organizational culture.');
    if (step === 6 && dreamCompanies.length < minDream)
      return setError('Please select at least ' + minDream + ' dream companies.');
    if (step === 7 && !resumeFile && !showManualEntry)
      return setError('Please upload your resume or enter details manually.');
    if (step === 7 && showManualEntry && manualSkills.length === 0) return setError('Please add at least one skill.');

    setError('');

    if (step === 1 && (careerStage === 'Fresher' || careerStage === 'Intern')) setStep(3);
    else setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 3 && (careerStage === 'Fresher' || careerStage === 'Intern')) setStep(1);
    else setStep((s) => s - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!resumeFile && !showManualEntry) return setError('Please upload your resume or enter details manually.');
    if (showManualEntry && manualSkills.length === 0) return setError('Please add at least one skill.');

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (resumeFile) formData.append('resume', resumeFile);
      formData.append('career_stage', careerStage as string);
      if (careerStage === 'Experienced') {
        formData.append('experience_years', String(experienceYears));
        formData.append('current_role', currentRole === 'Other' ? customRole : currentRole);
      }
      formData.append('education_level', educationLevel);
      formData.append('passing_year', passingYear);
      formData.append('field_of_study', fieldOfStudy === 'Other' ? customField : fieldOfStudy);
      formData.append('org_culture', JSON.stringify(orgCultures));
      formData.append('dream_companies', JSON.stringify(dreamCompanies));
      formData.append('work_model', workModel);
      formData.append('country', country);
      formData.append('location', JSON.stringify(locations));

      if (showManualEntry) {
        formData.append('manual_skills', manualSkills.join(', '));
        if (manualProjects) formData.append('manual_projects', manualProjects);
        if (manualBio) formData.append('manual_bio', manualBio);
      }

      const res = await api('/api/onboarding', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  let passingYearsOptions: string[] = [];
  if (careerStage === 'Intern') {
    passingYearsOptions = Array.from({ length: 5 }).map((_, i) => (currentYear + i).toString());
  } else if (careerStage === 'Fresher') {
    // Freshers graduated recently - show last 5 years only
    passingYearsOptions = Array.from({ length: 5 }).map((_, i) => (currentYear - i).toString());
  } else {
    // Experienced - show last 15 years
    passingYearsOptions = Array.from({ length: 15 }).map((_, i) => (currentYear - i).toString());
  }

  // Companies really present in the chosen cities (live job evidence + known offices).
  // Culture picks narrow by tier: Titans → MNC, Rocketship/Establishment → Growth, Garage/DeepEnd → Startup.
  const cultureTiers = new Set(
    orgCultures.flatMap((title) => {
      const id = ORG_CULTURES.find((c) => c.title === title)?.id;
      return id === 'Titans'
        ? ['MNC']
        : id === 'Rocketship' || id === 'Establishment'
          ? ['Growth']
          : id
            ? ['Startup', 'Board']
            : [];
    }),
  );
  const tierFiltered = cityCompanies.filter((c) => cultureTiers.size === 0 || cultureTiers.has(c.tier));
  const displayedCompanies = tierFiltered.length >= 5 ? tierFiltered : cityCompanies;
  const minDream = Math.min(5, Math.max(1, displayedCompanies.length));

  return (
    <div className="min-h-screen font-mono uppercase flex items-center justify-center px-4 py-24 relative overflow-hidden bg-void">
      <div className="hud-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 normal-case sm:px-8">
        <Link href="/" aria-label="RADAR home" className="transition-opacity hover:opacity-85">
          <RadarLogo />
        </Link>
        <span className="font-mono text-[11px] tracking-[0.3em] text-phosphor/70">
          STEP <span className="text-phosphor">{step}</span>/7
        </span>
      </header>
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(0,255,65,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-4xl relative z-10 flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-2 mb-8 shrink-0">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div
              key={s}
              className="flex-1 h-1.5 rounded-none relative overflow-hidden"
              style={{ background: '#002200' }}
            >
              <div
                className="absolute top-0 left-0 h-full w-full transition-transform duration-500 origin-left"
                style={{
                  background: '#00FF41',
                  transform: step > s ? 'scaleX(1)' : step === s ? 'scaleX(0.5)' : 'scaleX(0)',
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 pr-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Career Stage */}
              {step === 1 && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    CAREER STAGE
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Are you entering the workforce or bringing experience?
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => selectAndNext(setCareerStage, 'Intern', () => 3)}
                      className="p-4 text-left rounded-none transition-all hover:-translate-y-1"
                      style={{
                        border: `2px solid ${careerStage === 'Intern' ? '#00FF41' : '#004400'}`,
                        background: careerStage === 'Intern' ? 'rgba(0,255,65,0.1)' : '#000000',
                      }}
                    >
                      <div className="text-2xl mb-3">🌱</div>
                      <h3 className="text-[#00FF41] font-bold mb-1">Intern</h3>
                      <p className="text-xs" style={{ color: '#00aa00' }}>
                        Still studying
                      </p>
                    </button>
                    <button
                      onClick={() => selectAndNext(setCareerStage, 'Fresher', () => 3)}
                      className="p-4 text-left rounded-none transition-all hover:-translate-y-1"
                      style={{
                        border: `2px solid ${careerStage === 'Fresher' ? '#00FF41' : '#004400'}`,
                        background: careerStage === 'Fresher' ? 'rgba(0,255,65,0.1)' : '#000000',
                      }}
                    >
                      <div className="text-2xl mb-3">🎓</div>
                      <h3 className="text-[#00FF41] font-bold mb-1">Fresher</h3>
                      <p className="text-xs" style={{ color: '#00aa00' }}>
                        Recent graduate
                      </p>
                    </button>
                    <button
                      onClick={() => selectAndNext(setCareerStage, 'Experienced', () => 2)}
                      className="p-4 text-left rounded-none transition-all hover:-translate-y-1"
                      style={{
                        border: `2px solid ${careerStage === 'Experienced' ? '#00FF41' : '#004400'}`,
                        background: careerStage === 'Experienced' ? 'rgba(0,255,65,0.1)' : '#000000',
                      }}
                    >
                      <div className="text-2xl mb-3">💼</div>
                      <h3 className="text-[#00FF41] font-bold mb-1">Experienced</h3>
                      <p className="text-xs" style={{ color: '#00aa00' }}>
                        Mid/Senior level
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Experience Details */}
              {step === 2 && careerStage === 'Experienced' && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    PROFESSIONAL XP
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Quantify your professional background.
                  </p>

                  <div className="mb-10">
                    <label
                      className="block text-xs uppercase tracking-wider font-bold mb-3"
                      style={{ color: '#00aa00' }}
                    >
                      Current / Target Role
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      {ROLES.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setCurrentRole(role);
                            setCustomRole('');
                          }}
                          className="px-3 py-3 rounded-none text-sm font-bold transition-all text-center"
                          style={{
                            border: `1px solid ${currentRole === role ? '#00FF41' : '#004400'}`,
                            background: currentRole === role ? 'rgba(0,255,65,0.1)' : '#000000',
                            color: currentRole === role ? '#00FF41' : '#00aa00',
                          }}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    <AnimatePresence>
                      {currentRole === 'Other' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <input
                            type="text"
                            placeholder="Specify your role..."
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            className="w-full bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41]"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs uppercase tracking-wider font-bold" style={{ color: '#00aa00' }}>
                        Years of Experience
                      </label>
                      <span className="text-[#00FF41] font-bold">
                        {experienceYears} {experienceYears === 1 ? 'year' : 'years'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(parseInt(e.target.value))}
                      className="w-full accent-[#00FF41]"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Education */}
              {step === 3 && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    ACADEMICS
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Tell us about your educational background.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {[
                      (careerStage === 'Intern' ? 'Graduating' : 'Graduate') + ' (B.Tech, B.Sc, etc.)',
                      (careerStage === 'Intern' ? 'Postgraduating' : 'Postgraduate') + ' (M.Tech, MBA, etc.)',
                    ].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setEducationLevel(lvl)}
                        className="p-4 text-center rounded-none border transition-all text-sm font-bold"
                        style={{
                          borderColor: educationLevel === lvl ? '#00FF41' : '#004400',
                          background: educationLevel === lvl ? 'rgba(0,255,65,0.1)' : '#000000',
                          color: educationLevel === lvl ? '#00FF41' : '#00aa00',
                        }}
                      >
                        {lvl.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider font-bold mb-3"
                        style={{ color: '#00aa00' }}
                      >
                        Field of Study
                      </label>
                      <div className="relative mb-3">
                        <select
                          value={fieldOfStudy}
                          onChange={(e) => {
                            setFieldOfStudy(e.target.value);
                            setCustomField('');
                          }}
                          className="w-full bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors appearance-none focus:ring-1 focus:ring-[#00FF41]"
                        >
                          <option value="" disabled>
                            Select Field
                          </option>
                          {FIELDS_OF_STUDY.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#00aa00]">
                          ▼
                        </div>
                      </div>

                      <AnimatePresence>
                        {fieldOfStudy === 'Other' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <input
                              type="text"
                              placeholder="Specify your field"
                              value={customField}
                              onChange={(e) => setCustomField(e.target.value)}
                              className="w-full bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41]"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider font-bold mb-3"
                        style={{ color: '#00aa00' }}
                      >
                        Passing Year
                      </label>
                      <div className="relative">
                        <select
                          value={passingYear}
                          onChange={(e) => setPassingYear(e.target.value)}
                          className="w-full bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors appearance-none focus:ring-1 focus:ring-[#00FF41]"
                        >
                          <option value="" disabled>
                            Select Year
                          </option>
                          {passingYearsOptions.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#00aa00]">
                          ▼
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Work Model & Location */}
              {step === 4 && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    OPERATING BASE
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Define where and how you prefer to work.
                  </p>

                  <div className="mb-10">
                    <label
                      className="block text-xs uppercase tracking-wider font-bold mb-4"
                      style={{ color: '#00aa00' }}
                    >
                      1. Work Model
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Remote', 'In-Office', 'Hybrid', 'Anywhere (Omnipresent)'].map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            setWorkModel(model);
                            setLocations([]);
                          }}
                          className="p-4 rounded-none transition-all text-center"
                          style={{
                            border: `1px solid ${workModel === model ? '#00FF41' : '#004400'}`,
                            background: workModel === model ? 'rgba(0,255,65,0.1)' : '#000000',
                          }}
                        >
                          <span className="font-bold text-sm text-[#00FF41]">{model}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {workModel && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label
                          className="block text-xs uppercase tracking-wider font-bold mb-4"
                          style={{ color: '#00aa00' }}
                        >
                          2. Preferred Geography (Select Multiple)
                        </label>
                        {workModel.includes('Remote') || workModel.includes('Anywhere') ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            {REMOTE_REGIONS.map((reg) => (
                              <button
                                key={reg}
                                onClick={() => toggleLocation(reg)}
                                className="px-4 py-4 rounded-none text-sm font-bold transition-all text-center hover:scale-105"
                                style={{
                                  border: `1px solid ${locations.includes(reg) ? '#00FF41' : '#004400'}`,
                                  background: locations.includes(reg) ? 'rgba(0,255,65,0.1)' : '#000000',
                                  color: locations.includes(reg) ? '#00FF41' : '#00aa00',
                                }}
                              >
                                {reg}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="mb-6">
                              <label
                                className="block text-xs uppercase tracking-wider font-bold mb-2"
                                style={{ color: '#00aa00' }}
                              >
                                Country
                              </label>
                              <div className="relative">
                                <select
                                  value={country}
                                  onChange={(e) => {
                                    setCountry(e.target.value);
                                    setLocations([]);
                                    setShowCustomCity(false);
                                  }}
                                  className="w-full bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors appearance-none focus:ring-1 focus:ring-[#00FF41]"
                                >
                                  {Object.keys(TOP_CITIES).map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                  <option value="Other">Other</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#00aa00]">
                                  ▼
                                </div>
                              </div>
                            </div>
                            {country !== 'Other' && TOP_CITIES[country] ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {TOP_CITIES[country].map((city) => (
                                  <button
                                    key={city}
                                    onClick={() => toggleLocation(city)}
                                    className="px-4 py-3 rounded-none text-sm font-bold transition-all text-center hover:scale-105"
                                    style={{
                                      border: `1px solid ${locations.includes(city) ? '#00FF41' : '#004400'}`,
                                      background: locations.includes(city) ? 'rgba(0,255,65,0.1)' : '#000000',
                                      color: locations.includes(city) ? '#00FF41' : '#00aa00',
                                    }}
                                  >
                                    {city}
                                  </button>
                                ))}
                                {locations
                                  .filter((loc) => !TOP_CITIES[country].includes(loc))
                                  .map((custom) => (
                                    <button
                                      key={custom}
                                      onClick={() => toggleLocation(custom)}
                                      className="px-4 py-3 rounded-none text-sm font-bold transition-all text-center border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]"
                                    >
                                      {custom}
                                    </button>
                                  ))}
                                {!showCustomCity ? (
                                  <button
                                    onClick={() => setShowCustomCity(true)}
                                    className="px-4 py-3 rounded-none text-sm font-bold transition-all text-center border border-dashed border-[#004400] hover:border-[#00FF41] text-[#00aa00]"
                                  >
                                    + Other
                                  </button>
                                ) : (
                                  <div className="col-span-2 sm:col-span-3 md:col-span-4 flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Type city name..."
                                      value={customCity}
                                      onChange={(e) => setCustomCity(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && addCustomCity()}
                                      className="flex-1 bg-black border border-[#004400] rounded-none px-3 py-2 text-[#00FF41] text-sm focus:outline-none focus:border-[#00FF41]"
                                    />
                                    <button
                                      onClick={addCustomCity}
                                      className="px-4 py-2 bg-[#00FF41] text-[#00FF41] rounded-none text-sm font-bold"
                                    >
                                      Add
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {locations.map((loc) => (
                                    <div
                                      key={loc}
                                      className="px-3 py-1.5 rounded-none text-sm font-bold flex items-center gap-2 border-[#00FF41] bg-[#00FF41]/10 border text-[#00FF41]"
                                    >
                                      <span>{loc}</span>
                                      <button
                                        onClick={() => toggleLocation(loc)}
                                        className="text-[#00FF41] hover:text-[#00FF41]"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="e.g. New York, London, Dubai"
                                    value={customCity}
                                    onChange={(e) => setCustomCity(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomCity()}
                                    className="flex-1 bg-black border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41]"
                                  />
                                  <button
                                    onClick={addCustomCity}
                                    className="px-6 py-3 bg-[#00FF41] text-black rounded-none text-sm font-bold hover:bg-[#33FF66]"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Step 5: Organization Culture */}
              {step === 5 && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    THE BATTLEGROUND
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Select the corporate environments where you thrive. (Select all that apply)
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {ORG_CULTURES.map((culture, index) => (
                      <TiltCard
                        key={culture.id}
                        onClick={() => toggleCulture(culture.title)}
                        active={orgCultures.includes(culture.title)}
                        className={`p-5 rounded-none text-left flex flex-col gap-1 w-full ${index === 4 ? 'sm:col-span-2 sm:w-[calc(50%-0.5rem)] sm:mx-auto' : ''}`}
                        style={{
                          background: orgCultures.includes(culture.title) ? 'rgba(0,255,65,0.1)' : '#000000',
                          border: `1px solid ${orgCultures.includes(culture.title) ? '#00FF41' : '#004400'}`,
                        }}
                      >
                        <div className="text-3xl mb-1 pointer-events-none">{culture.icon}</div>
                        <span className="font-bold text-lg text-[#00FF41] tracking-tight pointer-events-none">
                          {culture.title}
                        </span>
                        <span className="text-xs font-medium text-[#00aa00] pointer-events-none">{culture.desc}</span>
                      </TiltCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 6: Dream Companies */}
              {step === 6 && (
                <div>
                  <div className="flex justify-between items-end mb-10">
                    <div>
                      <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                        DREAM STACK
                      </h1>
                      <p className="text-sm" style={{ color: '#00aa00' }}>
                        Companies actually in{' '}
                        {workModel.toLowerCase().includes('remote')
                          ? 'remote hiring'
                          : locations.join(', ') || 'your cities'}
                        . Select at least {minDream}.
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: '#007700' }}>
                        ● = RADAR tracks their live jobs · number = open roles there right now
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#00FF41]">{dreamCompanies.length}</span>
                      <span className="text-sm block" style={{ color: '#00aa00' }}>
                        Selected
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {companiesLoading && (
                      <p className="col-span-full text-sm text-[#00aa00] animate-pulse">SCANNING SECTOR...</p>
                    )}
                    {!companiesLoading && displayedCompanies.length === 0 && (
                      <p className="col-span-full text-sm text-[#00aa00]">
                        No companies found for these cities yet. Go back and add a bigger city nearby, or run a scrape
                        so live jobs show up.
                      </p>
                    )}
                    {displayedCompanies.map((company) => (
                      <TiltCard
                        key={company.name}
                        onClick={() => toggleCompany(company.name)}
                        active={dreamCompanies.includes(company.name)}
                        className="px-3 py-3 rounded-none text-sm font-bold text-center"
                        style={{
                          background: dreamCompanies.includes(company.name) ? 'rgba(0,255,65,0.1)' : '#000000',
                          border: `1px solid ${dreamCompanies.includes(company.name) ? '#00FF41' : '#004400'}`,
                          color: dreamCompanies.includes(company.name) ? '#00FF41' : '#00aa00',
                        }}
                      >
                        <span className="pointer-events-none block truncate">
                          {company.tracked ? '● ' : ''}
                          {company.name}
                        </span>
                        {company.openJobs > 0 && (
                          <span className="pointer-events-none block text-[10px] opacity-70">
                            {company.openJobs} open
                          </span>
                        )}
                      </TiltCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 7: Resume Upload / Manual Entry */}
              {step === 7 && (
                <div>
                  <h1 className="text-3xl md:text-3xl font-black font-mono text-[#00FF41] mb-2 tracking-tight">
                    UPLOAD CONTEXT
                  </h1>
                  <p className="text-sm mb-10" style={{ color: '#00aa00' }}>
                    Provide your resume or enter details manually for AI matching.
                  </p>

                  <AnimatePresence mode="wait">
                    {!showManualEntry ? (
                      <motion.div
                        key="upload"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                      >
                        <label
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          className={`w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-none cursor-pointer transition-all ${isDragging ? 'border-[#00FF41] bg-[#00FF41]/5' : 'border-[#004400] bg-black hover:border-[#00FF41]/50'}`}
                        >
                          <input
                            type="file"
                            className="hidden"
                            accept="application/pdf,.pdf"
                            onChange={(e) => e.target.files && setResumeFile(e.target.files[0])}
                          />
                          <div
                            className="w-16 h-16 rounded-none flex items-center justify-center mb-4"
                            style={{ background: 'rgba(0,255,65,0.1)' }}
                          >
                            <span className="text-2xl">📄</span>
                          </div>
                          {resumeFile ? (
                            <div className="text-center">
                              <p className="text-[#00FF41] font-bold text-lg mb-1">{resumeFile.name}</p>
                              <p className="text-sm" style={{ color: '#00aa00' }}>
                                {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-[#00FF41] font-bold text-lg mb-2">Drop your resume here</p>
                              <p className="text-sm" style={{ color: '#00aa00' }}>
                                PDF up to 4 MB
                              </p>
                              <p className="text-xs mt-6" style={{ color: '#00FF41' }}>
                                Required for AI Matching
                              </p>
                            </div>
                          )}
                        </label>

                        <div className="mt-8 text-center border-t border-[#002200] pt-8">
                          <p className="text-sm text-[#00aa00] mb-4">
                            Don't have a resume ready? No sweat. We can do this the hard way.
                          </p>
                          <button
                            onClick={() => setShowManualEntry(true)}
                            className="px-6 py-2.5 border-2 border-[#00FF41] text-[#00FF41] rounded-none text-sm font-bold hover:bg-[#00FF41] hover:text-[#00FF41] transition-all shadow-[0_0_15px_rgba(0,255,65,0.15)]"
                          >
                            Build Profile Manually ⚡
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="manual"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-black border border-[#004400] rounded-none p-4 shadow-2xl relative"
                      >
                        <button
                          onClick={() => setShowManualEntry(false)}
                          className="absolute top-4 right-4 text-[#00aa00] hover:text-[#00FF41] transition-colors text-sm font-bold"
                        >
                          ✕ Cancel
                        </button>

                        <h2 className="text-xl font-bold text-[#00FF41] mb-6 flex items-center gap-2">
                          <span className="text-[#00FF41]">⚡</span> The Builder Console
                        </h2>

                        {/* Skills */}
                        <div className="mb-6">
                          <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#00aa00]">
                            Core Skills (Required)
                          </label>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <AnimatePresence>
                              {manualSkills.map((skill) => (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  key={skill}
                                  className="px-3 py-1.5 rounded-none text-sm font-bold flex items-center gap-2 bg-[#00FF41]/10 border border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]"
                                >
                                  {skill}
                                  <button
                                    onClick={() => removeManualSkill(skill)}
                                    className="text-[#00FF41] hover:text-[#EF4444] transition-colors"
                                  >
                                    ×
                                  </button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. React, Python, Product Strategy..."
                              value={skillInput}
                              onChange={(e) => setSkillInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addManualSkill()}
                              className="flex-1 bg-[#000000] border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41]"
                            />
                            <button
                              onClick={addManualSkill}
                              className="px-6 py-3 bg-[#004400] text-[#00FF41] rounded-none font-bold hover:bg-[#00FF41] transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Projects */}
                        <div className="mb-6">
                          <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#00aa00]">
                            Top Projects (Optional)
                          </label>
                          <textarea
                            placeholder="Briefly describe 1-2 impactful projects you've built or contributed to..."
                            rows={3}
                            value={manualProjects}
                            onChange={(e) => setManualProjects(e.target.value)}
                            className="w-full bg-[#000000] border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41] resize-none"
                          />
                        </div>

                        {/* Bio / Other */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#00aa00]">
                            The X-Factor / Bio (Optional)
                          </label>
                          <textarea
                            placeholder="What makes you unique? Hackathons, open-source, blogs, or just your drive..."
                            rows={2}
                            value={manualBio}
                            onChange={(e) => setManualBio(e.target.value)}
                            className="w-full bg-[#000000] border border-[#004400] rounded-none px-4 py-3 text-[#00FF41] focus:outline-none focus:border-[#00FF41] transition-colors focus:ring-1 focus:ring-[#00FF41] resize-none"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-[#EF4444] text-sm text-center font-bold bg-[#EF4444]/10 py-3 rounded-none border border-[#EF4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div
          className="flex justify-between items-center pt-6 shrink-0 mt-4"
          style={{ borderTop: '1px solid #004400' }}
        >
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-6 py-2.5 text-sm font-bold uppercase tracking-wider rounded-none transition-colors hover:bg-[#002200]"
              style={{ color: '#00aa00', border: '1px solid #004400' }}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Hide Continue button on auto-continue steps */}
          {step < 7 ? (
            step !== 1 && (
              <button
                onClick={handleNext}
                className="px-8 py-2.5 text-sm font-bold uppercase tracking-wider rounded-none text-black transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]"
                style={{ background: '#00FF41' }}
              >
                Continue
              </button>
            )
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2.5 text-sm font-bold uppercase tracking-wider rounded-none text-black transition-all hover:-translate-y-0.5 shadow-[0_0_30px_rgba(0,255,65,0.5)] disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: '#00FF41' }}
            >
              {loading ? 'INITIALIZING...' : 'LAUNCH RADAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
