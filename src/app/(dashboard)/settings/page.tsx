/* eslint-disable @typescript-eslint/no-explicit-any */
 
 
 
 
 
 

﻿'use client';
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
      <p className="text-sm" style={{ color: '#555' }}>Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <button onClick={() => router.push('/dashboard')} className="text-sm font-bold text-white">
          ← Back to Dashboard
        </button>
        <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#A67B5B' }}>SETTINGS</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-black text-white mb-8 font-display tracking-tight">PROFILE SETTINGS</h1>

        <div className="space-y-6">
          {/* Account */}
          <div className="p-6 rounded-lg" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#A67B5B' }}>Account</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Email</span>
                <span className="text-sm text-white">{user?.emailAddresses?.[0]?.emailAddress || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Name</span>
                <span className="text-sm text-white">{profile?.full_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Tier</span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                  style={{ background: profile?.tier === 'pro' ? '#A67B5B' : '#1A1A1A', color: '#fff' }}>
                  {profile?.tier || 'free'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="p-6 rounded-lg" style={{ background: '#111', border: '1px solid #1A1A1A' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#A67B5B' }}>Profile</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Location</span>
                <span className="text-sm text-white">{profile?.location || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Experience</span>
                <span className="text-sm text-white">{profile?.is_fresher ? 'Fresher' : profile?.experience_years + ' years'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: '#888' }}>Resume</span>
                <span className="text-sm" style={{ color: profile?.resume_text ? '#10B981' : '#FF6666' }}>
                  {profile?.resume_text ? 'Uploaded ✓' : 'Not uploaded'}
                </span>
              </div>
              <div>
                <span className="text-sm block mb-2" style={{ color: '#888' }}>Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.skills || []).map((s: string) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#A67B5B20', color: '#A67B5B', border: '1px solid #A67B5B40' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button onClick={() => router.push('/onboarding')}
            className="w-full py-3 rounded text-sm font-bold uppercase tracking-wider text-white"
            style={{ background: '#A67B5B' }}>
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
