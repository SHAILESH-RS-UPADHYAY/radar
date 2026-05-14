'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

const SKILL_OPTIONS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js',
  'Java', 'C++', 'Go', 'Rust', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
  'Git', 'CI/CD', 'REST API', 'GraphQL', 'Microservices',
  'Pandas', 'NumPy', 'PyTorch', 'TensorFlow', 'FastAPI', 'Django', 'Flask',
  'HTML', 'CSS', 'Tailwind', 'Figma', 'UI/UX',
  'Agile', 'Scrum', 'JIRA', 'Data Structures', 'Algorithms',
];

const CITIES = [
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune',
  'Kolkata', 'Ahmedabad', 'Gurugram', 'Noida', 'Chandigarh',
  'Jaipur', 'Lucknow', 'Indore', 'Kochi', 'Remote',
];

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [isFresher, setIsFresher] = useState(true);
  const [experienceYears, setExperienceYears] = useState(0);
  const [error, setError] = useState('');

  const toggleSkill = (skill: string) => {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      if (resumeFile) formData.append('resume', resumeFile);
      formData.append('skills', JSON.stringify(skills));
      formData.append('location', location);
      formData.append('is_fresher', String(isFresher));
      formData.append('experience_years', String(experienceYears));

      const res = await fetch('/api/onboarding', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save profile');

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0A0A0A' }}>
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-12">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full" style={{
              background: step >= s ? '#A67B5B' : '#2A2A2A',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <h1 className="text-3xl font-black font-display text-white mb-2 tracking-tight">
          {step === 1 && 'UPLOAD YOUR RESUME'}
          {step === 2 && 'SELECT YOUR SKILLS'}
          {step === 3 && 'YOUR LOCATION'}
        </h1>
        <p className="text-sm mb-10" style={{ color: '#888' }}>
          {step === 1 && 'We extract text and generate AI embeddings to match you with jobs.'}
          {step === 2 && 'Pick the skills you are confident in. This improves match accuracy.'}
          {step === 3 && 'We prioritize jobs near you. Select Remote for worldwide opportunities.'}
        </p>

        {/* Step 1: Resume */}
        {step === 1 && (
          <div>
            <label
              className="block w-full p-12 text-center rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              style={{ border: '2px dashed #2A2A2A', background: '#111' }}
            >
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setResumeFile(e.target.files?.[0] || null)}
              />
              {resumeFile ? (
                <div>
                  <p className="text-white font-bold text-lg">{resumeFile.name}</p>
                  <p className="text-xs mt-2" style={{ color: '#A67B5B' }}>
                    {(resumeFile.size / 1024).toFixed(0)} KB — Ready
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-white text-lg mb-2">Drop your resume PDF here</p>
                  <p className="text-xs" style={{ color: '#666' }}>or click to browse</p>
                </div>
              )}
            </label>

            <div className="mt-8 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFresher} onChange={e => setIsFresher(e.target.checked)}
                  className="accent-[#A67B5B]" />
                <span className="text-sm text-white">I am a fresher / new graduate</span>
              </label>
            </div>
            {!isFresher && (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-wider font-bold" style={{ color: '#888' }}>
                  Years of Experience
                </label>
                <input type="number" min={0} max={30} value={experienceYears}
                  onChange={e => setExperienceYears(Number(e.target.value))}
                  className="block mt-2 w-24 px-3 py-2 rounded text-white text-sm"
                  style={{ background: '#111', border: '1px solid #2A2A2A' }} />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Skills */}
        {step === 2 && (
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map(skill => (
              <button key={skill} onClick={() => toggleSkill(skill)}
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: skills.includes(skill) ? '#A67B5B' : '#111',
                  color: skills.includes(skill) ? '#fff' : '#888',
                  border: '1px solid ' + (skills.includes(skill) ? '#A67B5B' : '#2A2A2A'),
                }}>
                {skill}
              </button>
            ))}
            <p className="w-full mt-4 text-xs" style={{ color: '#A67B5B' }}>
              {skills.length} skills selected
            </p>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CITIES.map(city => (
              <button key={city} onClick={() => setLocation(city)}
                className="px-4 py-3 rounded-lg text-sm font-bold transition-all text-left"
                style={{
                  background: location === city ? '#A67B5B' : '#111',
                  color: location === city ? '#fff' : '#ccc',
                  border: '1px solid ' + (location === city ? '#A67B5B' : '#2A2A2A'),
                }}>
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        {/* Navigation */}
        <div className="flex justify-between mt-12">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 text-sm font-bold uppercase tracking-wider rounded"
              style={{ color: '#888', border: '1px solid #2A2A2A' }}>
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="px-8 py-3 text-sm font-bold uppercase tracking-wider rounded text-white"
              style={{ background: '#A67B5B' }}
              disabled={step === 1 && !resumeFile}>
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !location}
              className="px-8 py-3 text-sm font-bold uppercase tracking-wider rounded text-white"
              style={{ background: loading ? '#555' : '#A67B5B' }}>
              {loading ? 'Setting up...' : 'LAUNCH RADAR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
