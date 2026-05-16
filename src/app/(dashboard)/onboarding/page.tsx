'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

// --- Components ---
function TiltCard({ children, className, style, onClick, active }: any) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);

  function handleMouse(event: any) {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left - rect.width / 2);
    y.set(event.clientY - rect.top - rect.height / 2);
  }

  return (
    <motion.button
      onClick={onClick}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, ...style }}
      className={`relative transform-gpu ${className} ${active ? 'ring-2 ring-[#A67B5B]' : ''}`}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.button>
  );
}

// --- Data ---
const TOP_CITIES: Record<string, string[]> = {
  India: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Gurugram', 'Noida', 'Chandigarh', 'Jaipur', 'Lucknow', 'Indore', 'Kochi', 'Thiruvananthapuram', 'Coimbatore', 'Mysore', 'Bhubaneswar', 'Guwahati', 'Nagpur', 'Patna', 'Bhopal', 'Surat', 'Visakhapatnam'],
  USA: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston', 'Los Angeles'],
  UK: ['London', 'Manchester', 'Edinburgh', 'Cambridge', 'Bristol'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Waterloo', 'Calgary'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
  Singapore: ['Singapore'],
  UAE: ['Dubai', 'Abu Dhabi']
};

const REMOTE_REGIONS = ['Worldwide', 'India', 'USA', 'UK', 'Canada', 'Australia', 'New Zealand', 'Germany', 'Singapore', 'UAE', 'Europe', 'Asia & Pacific', 'Latin America'];

const FIELDS_OF_STUDY = [
  'Computer Science & IT', 'Electrical & Electronics', 'Mechanical & Civil', 
  'Business & Management (BBA/MBA)', 'Arts & Humanities', 'Natural Sciences', 'Other'
];

const ROLES = [
  'Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Fullstack Engineer',
  'AI / ML Engineer', 'Data Scientist', 'Product Manager', 'UI / UX Designer',
  'DevOps / SRE', 'QA / Test Engineer', 'Security Engineer', 'Other'
];

const ORG_CULTURES = [
  { id: 'Garage', icon: '🚀', title: 'The Garage', desc: 'Early-Stage Startups' },
  { id: 'Rocketship', icon: '☄️', title: 'The Rocketship', desc: 'Hyper-Growth (Series B/C)' },
  { id: 'Establishment', icon: '🏢', title: 'The Establishment', desc: 'Mid-Size & Scale-ups' },
  { id: 'Titans', icon: '🏛️', title: 'The Titans', desc: 'MNCs & Fortune 500' },
  { id: 'DeepEnd', icon: '🔬', title: 'The Deep End', desc: 'Research & Deep Tech' }
];

const COMPANIES_DB: Record<string, {name: string, domain: string}[]> = {
  Garage: [
    { name: 'OpenAI', domain: 'openai.com' }, { name: 'Stripe', domain: 'stripe.com' }, { name: 'Anthropic', domain: 'anthropic.com' }, 
    { name: 'Notion', domain: 'notion.so' }, { name: 'Vercel', domain: 'vercel.com' }, { name: 'Supabase', domain: 'supabase.io' }, 
    { name: 'Linear', domain: 'linear.app' }, { name: 'Cursor', domain: 'cursor.sh' }, { name: 'Scale AI', domain: 'scale.com' },
    { name: 'Hugging Face', domain: 'huggingface.co' }, { name: 'Perplexity', domain: 'perplexity.ai' }, { name: 'Mistral', domain: 'mistral.ai' },
    { name: 'Cohere', domain: 'cohere.ai' }, { name: 'Glean', domain: 'glean.com' }, { name: 'Replit', domain: 'replit.com' },
    { name: 'Figma', domain: 'figma.com' }, { name: 'PostHog', domain: 'posthog.com' }, { name: 'Resend', domain: 'resend.com' },
    { name: 'Raycast', domain: 'raycast.com' }, { name: 'Dub', domain: 'dub.co' }
  ],
  Rocketship: [
    { name: 'Databricks', domain: 'databricks.com' }, { name: 'Discord', domain: 'discord.com' }, { name: 'Plaid', domain: 'plaid.com' },
    { name: 'Rippling', domain: 'rippling.com' }, { name: 'Canva', domain: 'canva.com' }, { name: 'Brex', domain: 'brex.com' },
    { name: 'Ramp', domain: 'ramp.com' }, { name: 'Gusto', domain: 'gusto.com' }, { name: 'Deel', domain: 'deel.com' },
    { name: 'Checkr', domain: 'checkr.com' }, { name: 'Fivetran', domain: 'fivetran.com' }, { name: 'Snyk', domain: 'snyk.io' },
    { name: 'Wiz', domain: 'wiz.io' }, { name: 'Anduril', domain: 'anduril.com' }, { name: 'Retool', domain: 'retool.com' }
  ],
  Establishment: [
    { name: 'Atlassian', domain: 'atlassian.com' }, { name: 'Dropbox', domain: 'dropbox.com' }, { name: 'Snowflake', domain: 'snowflake.com' },
    { name: 'Datadog', domain: 'datadoghq.com' }, { name: 'CrowdStrike', domain: 'crowdstrike.com' }, { name: 'Okta', domain: 'okta.com' },
    { name: 'Zscaler', domain: 'zscaler.com' }, { name: 'Twilio', domain: 'twilio.com' }, { name: 'Shopify', domain: 'shopify.com' },
    { name: 'Square', domain: 'squareup.com' }, { name: 'Coinbase', domain: 'coinbase.com' }, { name: 'Robinhood', domain: 'robinhood.com' },
    { name: 'Spotify', domain: 'spotify.com' }, { name: 'Airbnb', domain: 'airbnb.com' }, { name: 'Uber', domain: 'uber.com' },
    { name: 'Lyft', domain: 'lyft.com' }, { name: 'Pinterest', domain: 'pinterest.com' }, { name: 'Snap', domain: 'snap.com' }
  ],
  Titans: [
    { name: 'Google', domain: 'google.com' }, { name: 'Microsoft', domain: 'microsoft.com' }, { name: 'Amazon', domain: 'amazon.com' },
    { name: 'Apple', domain: 'apple.com' }, { name: 'Meta', domain: 'meta.com' }, { name: 'Netflix', domain: 'netflix.com' },
    { name: 'Salesforce', domain: 'salesforce.com' }, { name: 'Oracle', domain: 'oracle.com' }, { name: 'SAP', domain: 'sap.com' },
    { name: 'Cisco', domain: 'cisco.com' }, { name: 'Intel', domain: 'intel.com' }, { name: 'Nvidia', domain: 'nvidia.com' },
    { name: 'AMD', domain: 'amd.com' }, { name: 'Qualcomm', domain: 'qualcomm.com' }, { name: 'IBM', domain: 'ibm.com' },
    { name: 'TCS', domain: 'tcs.com' }, { name: 'Infosys', domain: 'infosys.com' }, { name: 'Accenture', domain: 'accenture.com' }
  ],
  DeepEnd: [
    { name: 'DeepMind', domain: 'deepmind.com' }, { name: 'Boston Dynamics', domain: 'bostondynamics.com' }, { name: 'Neuralink', domain: 'neuralink.com' },
    { name: 'Waymo', domain: 'waymo.com' }, { name: 'Cruise', domain: 'getcruise.com' }, { name: 'SpaceX', domain: 'spacex.com' },
    { name: 'Blue Origin', domain: 'blueorigin.com' }, { name: 'Palantir', domain: 'palantir.com' }, { name: 'DeepLearning.AI', domain: 'deeplearning.ai' }
  ]
};

export default function OnboardingPage() {
  const { user } = useUser();
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

  const toggleCulture = (cultureTitle: string) => {
    setOrgCultures(prev => {
      if (prev.includes(cultureTitle)) return prev.filter(c => c !== cultureTitle);
      return [...prev, cultureTitle];
    });
  };

  const toggleCompany = (companyName: string) => {
    setDreamCompanies(prev => {
      if (prev.includes(companyName)) return prev.filter(c => c !== companyName);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, companyName];
    });
  };

  const toggleLocation = (loc: string) => {
    setLocations(prev => {
      if (prev.includes(loc)) return prev.filter(l => l !== loc);
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
    setManualSkills(manualSkills.filter(s => s !== skill));
  };

  const selectAndNext = (setter: any, val: any, skipLogic?: (val: any) => number) => {
    setter(val);
    setTimeout(() => {
      if (skipLogic) setStep(skipLogic(val));
      else setStep(s => s + 1);
    }, 250);
  };

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setResumeFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleNext = () => {
    if (step === 1 && !careerStage) return setError('Please select your career stage.');
    if (step === 2 && careerStage === 'Experienced' && (!currentRole || (currentRole === 'Other' && !customRole))) return setError('Please enter your current role.');
    if (step === 3 && (!educationLevel || !passingYear || !fieldOfStudy || (fieldOfStudy === 'Other' && !customField))) return setError('Please fill all education details.');
    if (step === 4 && (!workModel || locations.length === 0)) return setError('Please select your work model and at least one location.');
    if (step === 5 && orgCultures.length === 0) return setError('Please select at least one organizational culture.');
    if (step === 6 && dreamCompanies.length < 5) return setError('Please select at least 5 dream companies.');
    if (step === 7 && !resumeFile && !showManualEntry) return setError('Please upload your resume or enter details manually.');
    if (step === 7 && showManualEntry && manualSkills.length === 0) return setError('Please add at least one skill.');
    
    setError('');
    
    if (step === 1 && (careerStage === 'Fresher' || careerStage === 'Intern')) setStep(3);
    else setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 3 && (careerStage === 'Fresher' || careerStage === 'Intern')) setStep(1);
    else setStep(s => s - 1);
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
      formData.append('location', JSON.stringify(locations));
      
      if (showManualEntry) {
        formData.append('manual_skills', manualSkills.join(', '));
        if (manualProjects) formData.append('manual_projects', manualProjects);
        if (manualBio) formData.append('manual_bio', manualBio);
      }

      const res = await fetch('/api/onboarding', { method: 'POST', body: formData });
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

  // Dynamic Companies
  const displayedCompanies = orgCultures.length > 0 
    ? orgCultures.flatMap(cultureTitle => {
        const cultureObj = ORG_CULTURES.find(c => c.title === cultureTitle);
        return cultureObj ? COMPANIES_DB[cultureObj.id] || [] : [];
      }).filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)
    : Object.values(COMPANIES_DB).flat();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 relative overflow-hidden" style={{ background: '#0A0A0A' }}>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ 
        background: 'radial-gradient(circle at 50% 0%, rgba(166,123,91,0.05) 0%, transparent 70%)' 
      }} />

      <div className="w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-2 mb-8 shrink-0">
          {[1, 2, 3, 4, 5, 6, 7].map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full relative overflow-hidden" style={{ background: '#1A1A1A' }}>
              <div className="absolute top-0 left-0 h-full w-full transition-transform duration-500 origin-left" style={{ 
                background: '#A67B5B', 
                transform: step > s ? 'scaleX(1)' : step === s ? 'scaleX(0.5)' : 'scaleX(0)' 
              }} />
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 pr-2">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            
            {/* Step 1: Career Stage */}
            {step === 1 && (
              <div>
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">CAREER STAGE</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Are you entering the workforce or bringing experience?</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <button onClick={() => selectAndNext(setCareerStage, 'Intern', () => 3)} className="p-4 text-left rounded-xl transition-all hover:-translate-y-1" style={{ 
                    border: `2px solid ${careerStage === 'Intern' ? '#A67B5B' : '#2A2A2A'}`, background: careerStage === 'Intern' ? 'rgba(166,123,91,0.1)' : '#111' 
                  }}>
                    <div className="text-2xl mb-3">🌱</div>
                    <h3 className="text-white font-bold mb-1">Intern</h3>
                    <p className="text-xs" style={{ color: '#888' }}>Still studying</p>
                  </button>
                  <button onClick={() => selectAndNext(setCareerStage, 'Fresher', () => 3)} className="p-4 text-left rounded-xl transition-all hover:-translate-y-1" style={{ 
                    border: `2px solid ${careerStage === 'Fresher' ? '#A67B5B' : '#2A2A2A'}`, background: careerStage === 'Fresher' ? 'rgba(166,123,91,0.1)' : '#111' 
                  }}>
                    <div className="text-2xl mb-3">🎓</div>
                    <h3 className="text-white font-bold mb-1">Fresher</h3>
                    <p className="text-xs" style={{ color: '#888' }}>Recent graduate</p>
                  </button>
                  <button onClick={() => selectAndNext(setCareerStage, 'Experienced', () => 2)} className="p-4 text-left rounded-xl transition-all hover:-translate-y-1" style={{ 
                    border: `2px solid ${careerStage === 'Experienced' ? '#A67B5B' : '#2A2A2A'}`, background: careerStage === 'Experienced' ? 'rgba(166,123,91,0.1)' : '#111' 
                  }}>
                    <div className="text-2xl mb-3">💼</div>
                    <h3 className="text-white font-bold mb-1">Experienced</h3>
                    <p className="text-xs" style={{ color: '#888' }}>Mid/Senior level</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Experience Details */}
            {step === 2 && careerStage === 'Experienced' && (
              <div>
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">PROFESSIONAL XP</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Quantify your professional background.</p>
                
                <div className="mb-10">
                  <label className="block text-xs uppercase tracking-wider font-bold mb-3" style={{ color: '#888' }}>Current / Target Role</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {ROLES.map(role => (
                      <button key={role} onClick={() => { setCurrentRole(role); setCustomRole(''); }} className="px-3 py-3 rounded-lg text-sm font-bold transition-all text-center" style={{ 
                        border: `1px solid ${currentRole === role ? '#A67B5B' : '#2A2A2A'}`, background: currentRole === role ? 'rgba(166,123,91,0.1)' : '#111', color: currentRole === role ? '#fff' : '#888' 
                      }}>
                        {role}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {currentRole === 'Other' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <input type="text" placeholder="Specify your role..." value={customRole} onChange={e => setCustomRole(e.target.value)}
                          className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs uppercase tracking-wider font-bold" style={{ color: '#888' }}>Years of Experience</label>
                    <span className="text-white font-bold">{experienceYears} {experienceYears === 1 ? 'year' : 'years'}</span>
                  </div>
                  <input type="range" min="1" max="20" value={experienceYears} onChange={e => setExperienceYears(parseInt(e.target.value))}
                    className="w-full accent-[#A67B5B]" />
                </div>
              </div>
            )}

            {/* Step 3: Education */}
            {step === 3 && (
              <div>
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">ACADEMICS</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Tell us about your educational background.</p>
                
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  {[(careerStage === 'Intern' ? 'Graduating' : 'Graduate') + ' (B.Tech, B.Sc, etc.)', (careerStage === 'Intern' ? 'Postgraduating' : 'Postgraduate') + ' (M.Tech, MBA, etc.)'].map(lvl => (
                    <button key={lvl} onClick={() => setEducationLevel(lvl)} className="p-4 text-center rounded-lg border transition-all text-sm font-bold" style={{ 
                      borderColor: educationLevel === lvl ? '#A67B5B' : '#2A2A2A', background: educationLevel === lvl ? 'rgba(166,123,91,0.1)' : '#111', color: educationLevel === lvl ? '#fff' : '#888' 
                    }}>
                      {lvl.split(' ')[0]}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold mb-3" style={{ color: '#888' }}>Field of Study</label>
                    <div className="relative mb-3">
                      <select value={fieldOfStudy} onChange={e => { setFieldOfStudy(e.target.value); setCustomField(''); }} className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors appearance-none focus:ring-1 focus:ring-[#A67B5B]">
                        <option value="" disabled>Select Field</option>
                        {FIELDS_OF_STUDY.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#888]">▼</div>
                    </div>
                    
                    <AnimatePresence>
                      {fieldOfStudy === 'Other' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <input type="text" placeholder="Specify your field" value={customField} onChange={e => setCustomField(e.target.value)}
                            className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold mb-3" style={{ color: '#888' }}>Passing Year</label>
                    <div className="relative">
                      <select value={passingYear} onChange={e => setPassingYear(e.target.value)} className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors appearance-none focus:ring-1 focus:ring-[#A67B5B]">
                        <option value="" disabled>Select Year</option>
                        {passingYearsOptions.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#888]">▼</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Work Model & Location */}
            {step === 4 && (
              <div>
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">OPERATING BASE</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Define where and how you prefer to work.</p>
                
                <div className="mb-10">
                  <label className="block text-xs uppercase tracking-wider font-bold mb-4" style={{ color: '#888' }}>1. Work Model</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Remote', 'In-Office', 'Hybrid', 'Anywhere (Omnipresent)'].map(model => (
                      <button key={model} onClick={() => {setWorkModel(model); setLocations([]);}} className="p-4 rounded-xl transition-all text-center" style={{ 
                        border: `1px solid ${workModel === model ? '#A67B5B' : '#2A2A2A'}`, background: workModel === model ? 'rgba(166,123,91,0.1)' : '#111'
                      }}>
                        <span className="font-bold text-sm text-white">{model}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {workModel && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-xs uppercase tracking-wider font-bold mb-4" style={{ color: '#888' }}>2. Preferred Geography (Select Multiple)</label>
                      {workModel.includes('Remote') || workModel.includes('Anywhere') ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          {REMOTE_REGIONS.map(reg => (
                            <button key={reg} onClick={() => toggleLocation(reg)} className="px-4 py-4 rounded-lg text-sm font-bold transition-all text-center hover:scale-105" style={{ 
                              border: `1px solid ${locations.includes(reg) ? '#A67B5B' : '#2A2A2A'}`, background: locations.includes(reg) ? 'rgba(166,123,91,0.1)' : '#111', color: locations.includes(reg) ? '#fff' : '#888' 
                            }}>
                              {reg}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <div className="mb-6">
                            <label className="block text-xs uppercase tracking-wider font-bold mb-2" style={{ color: '#888' }}>Country</label>
                            <div className="relative">
                              <select value={country} onChange={e => { setCountry(e.target.value); setLocations([]); setShowCustomCity(false); }} className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors appearance-none focus:ring-1 focus:ring-[#A67B5B]">
                                {Object.keys(TOP_CITIES).map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="Other">Other</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#888]">▼</div>
                            </div>
                          </div>
                          {country !== 'Other' && TOP_CITIES[country] ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {TOP_CITIES[country].map(city => (
                                <button key={city} onClick={() => toggleLocation(city)} className="px-4 py-3 rounded-lg text-sm font-bold transition-all text-center hover:scale-105" style={{ 
                                  border: `1px solid ${locations.includes(city) ? '#A67B5B' : '#2A2A2A'}`, background: locations.includes(city) ? 'rgba(166,123,91,0.1)' : '#111', color: locations.includes(city) ? '#fff' : '#888' 
                                }}>
                                  {city}
                                </button>
                              ))}
                              {locations.filter(loc => !TOP_CITIES[country].includes(loc)).map(custom => (
                                <button key={custom} onClick={() => toggleLocation(custom)} className="px-4 py-3 rounded-lg text-sm font-bold transition-all text-center border-[#A67B5B] bg-[#A67B5B]/10 text-white">
                                  {custom}
                                </button>
                              ))}
                              {!showCustomCity ? (
                                <button onClick={() => setShowCustomCity(true)} className="px-4 py-3 rounded-lg text-sm font-bold transition-all text-center border border-dashed border-[#2A2A2A] hover:border-[#A67B5B] text-[#888]">
                                  + Other
                                </button>
                              ) : (
                                <div className="col-span-2 sm:col-span-3 md:col-span-4 flex gap-2">
                                  <input type="text" placeholder="Type city name..." value={customCity} onChange={e => setCustomCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCity()} className="flex-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#A67B5B]" />
                                  <button onClick={addCustomCity} className="px-4 py-2 bg-[#A67B5B] text-white rounded-lg text-sm font-bold">Add</button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {locations.map(loc => (
                                  <div key={loc} className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border-[#A67B5B] bg-[#A67B5B]/10 border text-white">
                                    <span>{loc}</span>
                                    <button onClick={() => toggleLocation(loc)} className="text-[#A67B5B] hover:text-white">×</button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input type="text" placeholder="e.g. New York, London, Dubai" value={customCity} onChange={e => setCustomCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCity()}
                                  className="flex-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B]" />
                                <button onClick={addCustomCity} className="px-6 py-3 bg-[#A67B5B] text-white rounded-lg text-sm font-bold hover:bg-opacity-80">Add</button>
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
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">THE BATTLEGROUND</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Select the corporate environments where you thrive. (Select all that apply)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {ORG_CULTURES.map((culture, index) => (
                    <TiltCard key={culture.id} onClick={() => toggleCulture(culture.title)} active={orgCultures.includes(culture.title)} 
                      className={`p-5 rounded-xl text-left flex flex-col gap-1 w-full ${index === 4 ? "sm:col-span-2 sm:w-[calc(50%-0.5rem)] sm:mx-auto" : ""}`}
                      style={{ 
                        background: orgCultures.includes(culture.title) ? 'rgba(166,123,91,0.1)' : '#111',
                        border: `1px solid ${orgCultures.includes(culture.title) ? '#A67B5B' : '#2A2A2A'}`
                      }}
                    >
                      <div className="text-3xl mb-1 pointer-events-none">{culture.icon}</div>
                      <span className="font-bold text-lg text-white tracking-tight pointer-events-none">{culture.title}</span>
                      <span className="text-xs font-medium text-[#888] pointer-events-none">{culture.desc}</span>
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
                    <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">DREAM STACK</h1>
                    <p className="text-sm" style={{ color: '#888' }}>Select at least 5 target companies from your selected cultures.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">{dreamCompanies.length}</span>
                    <span className="text-sm block" style={{ color: '#888' }}>Selected</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {displayedCompanies.map(company => (
                    <TiltCard key={company.name} onClick={() => toggleCompany(company.name)} active={dreamCompanies.includes(company.name)}
                      className="px-4 py-3 rounded-lg text-sm font-bold text-center truncate" 
                      style={{ 
                        background: dreamCompanies.includes(company.name) ? 'rgba(166,123,91,0.1)' : '#111',
                        border: `1px solid ${dreamCompanies.includes(company.name) ? '#A67B5B' : '#2A2A2A'}`,
                        color: dreamCompanies.includes(company.name) ? '#fff' : '#888' 
                      }}
                    >
                      <span className="pointer-events-none">{company.name}</span>
                    </TiltCard>
                  ))}
                </div>
              </div>
            )}

            {/* Step 7: Resume Upload / Manual Entry */}
            {step === 7 && (
              <div>
                <h1 className="text-3xl md:text-3xl font-black font-display text-white mb-2 tracking-tight">UPLOAD CONTEXT</h1>
                <p className="text-sm mb-10" style={{ color: '#888' }}>Provide your resume or enter details manually for AI matching.</p>

                <AnimatePresence mode="wait">
                  {!showManualEntry ? (
                    <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <label onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className={`w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging ? 'border-[#A67B5B] bg-[#A67B5B]/5' : 'border-[#2A2A2A] bg-[#111] hover:border-[#A67B5B]/50'}`}>
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => e.target.files && setResumeFile(e.target.files[0])} />
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(166,123,91,0.1)' }}>
                          <span className="text-2xl">📄</span>
                        </div>
                        {resumeFile ? (
                          <div className="text-center">
                            <p className="text-white font-bold text-lg mb-1">{resumeFile.name}</p>
                            <p className="text-sm" style={{ color: '#888' }}>{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-white font-bold text-lg mb-2">Drop your resume here</p>
                            <p className="text-sm" style={{ color: '#888' }}>PDF, DOC, DOCX up to 5MB</p>
                            <p className="text-xs mt-6" style={{ color: '#A67B5B' }}>Required for AI Matching</p>
                          </div>
                        )}
                      </label>

                      <div className="mt-8 text-center border-t border-[#1A1A1A] pt-8">
                        <p className="text-sm text-[#888] mb-4">Don't have a resume ready? No sweat. We can do this the hard way.</p>
                        <button onClick={() => setShowManualEntry(true)} className="px-6 py-2.5 border-2 border-[#A67B5B] text-[#A67B5B] rounded-lg text-sm font-bold hover:bg-[#A67B5B] hover:text-white transition-all shadow-[0_0_15px_rgba(166,123,91,0.15)]">
                          Build Profile Manually ⚡
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="manual" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#111] border border-[#2A2A2A] rounded-xl p-4 shadow-2xl relative">
                      <button onClick={() => setShowManualEntry(false)} className="absolute top-4 right-4 text-[#888] hover:text-white transition-colors text-sm font-bold">
                        ✕ Cancel
                      </button>
                      
                      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="text-[#A67B5B]">⚡</span> The Builder Console
                      </h2>

                      {/* Skills */}
                      <div className="mb-6">
                        <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#888]">Core Skills (Required)</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <AnimatePresence>
                            {manualSkills.map(skill => (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} key={skill} className="px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 bg-[#A67B5B]/10 border border-[#A67B5B] text-white shadow-[0_0_10px_rgba(166,123,91,0.2)]">
                                {skill}
                                <button onClick={() => removeManualSkill(skill)} className="text-[#A67B5B] hover:text-[#EF4444] transition-colors">×</button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="e.g. React, Python, Product Strategy..." value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManualSkill()}
                            className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B]" />
                          <button onClick={addManualSkill} className="px-6 py-3 bg-[#2A2A2A] text-white rounded-lg font-bold hover:bg-[#A67B5B] transition-colors">Add</button>
                        </div>
                      </div>

                      {/* Projects */}
                      <div className="mb-6">
                        <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#888]">Top Projects (Optional)</label>
                        <textarea placeholder="Briefly describe 1-2 impactful projects you've built or contributed to..." rows={3} value={manualProjects} onChange={e => setManualProjects(e.target.value)}
                          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B] resize-none" />
                      </div>

                      {/* Bio / Other */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#888]">The X-Factor / Bio (Optional)</label>
                        <textarea placeholder="What makes you unique? Hackathons, open-source, blogs, or just your drive..." rows={2} value={manualBio} onChange={e => setManualBio(e.target.value)}
                          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#A67B5B] transition-colors focus:ring-1 focus:ring-[#A67B5B] resize-none" />
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-[#EF4444] text-sm text-center font-bold bg-[#EF4444] bg-opacity-10 py-3 rounded border border-[#EF4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </motion.div>
        )}

          </motion.div>
        </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 shrink-0 mt-4" style={{ borderTop: '1px solid #2A2A2A' }}>
          {step > 1 ? (
            <button onClick={handleBack} className="px-6 py-2.5 text-sm font-bold uppercase tracking-wider rounded transition-colors hover:bg-[#1A1A1A]" style={{ color: '#888', border: '1px solid #2A2A2A' }}>
              Back
            </button>
          ) : <div />}

          {/* Hide Continue button on auto-continue steps */}
          {step < 7 ? (
            step !== 1 && (
              <button onClick={handleNext} className="px-8 py-2.5 text-sm font-bold uppercase tracking-wider rounded text-white transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(166,123,91,0.3)] hover:shadow-[0_0_30px_rgba(166,123,91,0.5)]" style={{ background: '#A67B5B' }}>
                Continue
              </button>
            )
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="px-8 py-2.5 text-sm font-bold uppercase tracking-wider rounded text-white transition-all hover:-translate-y-0.5 shadow-[0_0_30px_rgba(166,123,91,0.5)] disabled:opacity-50 disabled:hover:translate-y-0" style={{ background: '#A67B5B' }}>
              {loading ? 'INITIALIZING...' : 'LAUNCH RADAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
