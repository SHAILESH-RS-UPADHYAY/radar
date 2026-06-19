/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setProfile(d.profile);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black font-mono">
      <p className="text-sm text-[#00FF41] animate-pulse">INIT_SETTINGS_MODULE...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:20px_20px] font-mono relative overflow-hidden">
      {/* Scanline effect */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
      
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#00FF41]/30 relative z-20">
        <button onClick={() => router.push('/dashboard')} className="text-sm font-bold text-[#00FF41] hover:text-[#00CC33] hover:underline transition-colors">
          [ESC] RETURN_TO_DASHBOARD
        </button>
        <span className="text-xs uppercase tracking-widest font-bold text-[#00FF41]">/SETTINGS_ROOT</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12 relative z-20">
        <h1 className="text-2xl font-black text-[#00FF41] mb-8 uppercase tracking-widest">
          &gt; SYSTEM_CONFIG_
        </h1>

        <div className="space-y-6">
          {/* Account */}
          <div className="p-6 rounded-none bg-black border border-[#00FF41]/50 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 text-[#00FF41]">--- ACCOUNT_DATA ---</h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">UID_EMAIL</span>
                <span className="text-sm text-[#00FF41]">{user?.emailAddresses?.[0]?.emailAddress || 'NULL'}</span>
              </div>
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">ALIAS</span>
                <span className="text-sm text-[#00FF41]">{profile?.full_name || 'ANONYMOUS'}</span>
              </div>
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">ACCESS_LEVEL</span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-none"
                  style={{ background: profile?.tier === 'pro' ? '#00FF41' : 'transparent', color: profile?.tier === 'pro' ? '#000' : '#00FF41', border: profile?.tier === 'pro' ? 'none' : '1px solid #00FF41' }}>
                  {profile?.tier || 'STANDARD'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="p-6 rounded-none bg-black border border-[#00FF41]/50 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 text-[#00FF41]">--- USER_VECTORS ---</h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">GEO_LOCATION</span>
                <span className="text-sm text-[#00FF41]">{profile?.location || 'UNKNOWN'}</span>
              </div>
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">EXP_METRIC</span>
                <span className="text-sm text-[#00FF41]">{profile?.is_fresher ? 'L0_FRESHER' : `L${profile?.experience_years}_VETERAN`}</span>
              </div>
              <div className="flex justify-between border-b border-[#00FF41]/20 pb-2">
                <span className="text-sm text-[#00FF41]/70">RESUME_PAYLOAD</span>
                <span className="text-sm" style={{ color: profile?.resume_text ? '#00FF41' : '#EF4444' }}>
                  {profile?.resume_text ? '[DATA_PRESENT]' : '[NULL_POINTER]'}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-sm block mb-3 text-[#00FF41]/70">KNOWN_PROTOCOLS (SKILLS)</span>
                <div className="flex flex-wrap gap-2">
                  {(profile?.skills || []).map((s: string) => (
                    <span key={s} className="text-xs px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/50 uppercase tracking-wider">
                      {s}
                    </span>
                  ))}
                  {(!profile?.skills || profile?.skills.length === 0) && (
                    <span className="text-xs px-2 py-1 text-[#EF4444] border border-[#EF4444]/50">NO_DATA</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={() => router.push('/onboarding')}
            className="w-full py-4 mt-6 text-sm font-bold uppercase tracking-widest text-[#000] bg-[#00FF41] hover:bg-[#00CC33] transition-colors shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]">
            &gt; EXECUTE_PROFILE_UPDATE
          </button>
        </div>
      </div>
    </div>
  );
}
