'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';

// ----------------------------------------------------
// Custom 3D Tilt Hook
// ----------------------------------------------------
function useTilt() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return { rotateX, rotateY, handleMouseMove, handleMouseLeave };
}

// ----------------------------------------------------
// 3D Tilt Card Component
// ----------------------------------------------------
const TiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const { rotateX, rotateY, handleMouseMove, handleMouseLeave } = useTilt();

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layout
      className={`relative perspective-1000 ${className || ''}`}
    >
      <div style={{ transform: "translateZ(30px)" }} className="h-full w-full">
        {children}
      </div>
    </motion.div>
  );
};

// ----------------------------------------------------
// Types
// ----------------------------------------------------
interface MatchedJob {
  id: string;
  score: number;
  reasoning: string;
  matching_skills: string[];
  missing_skills: string[];
  section: string;
  job: {
    id: string;
    title: string;
    location: string;
    work_type: string;
    skills: string[];
    apply_url: string;
    department: string;
    salary_min: number | null;
    salary_max: number | null;
    company: { name: string; category: string };
  };
}

export default function DashboardPage() {
  const { user } = useUser();
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  
  // High-Level Navigation
  const [primaryTab, setPrimaryTab] = useState<'DISCOVERY' | 'VAULT' | 'BATTLEFIELD'>('DISCOVERY');
  // Sub-Navigation for Discovery
  const [activeTab, setActiveTab] = useState<'dream' | 'recommended' | 'startup'>('recommended');

  // Local Storage for Saved / Applied States
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    if (user?.id) {
      const storedSaved = localStorage.getItem(`radar_saved_${user.id}`);
      const storedApplied = localStorage.getItem(`radar_applied_${user.id}`);
      if (storedSaved) setSavedIds(JSON.parse(storedSaved));
      if (storedApplied) setAppliedIds(JSON.parse(storedApplied));
    }
  }, [user?.id]);

  // Sync to local storage
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`radar_saved_${user.id}`, JSON.stringify(savedIds));
      localStorage.setItem(`radar_applied_${user.id}`, JSON.stringify(appliedIds));
    }
  }, [savedIds, appliedIds, user?.id]);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/match', { method: 'POST' });
      if (res.ok) await fetchMatches();
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleAction = (id: string, action: 'SAVE' | 'APPLY' | 'REMOVE_SAVE' | 'REMOVE_APPLY') => {
    if (action === 'SAVE') {
      if (!savedIds.includes(id)) setSavedIds([...savedIds, id]);
      setAppliedIds(appliedIds.filter(aid => aid !== id));
    }
    if (action === 'APPLY') {
      if (!appliedIds.includes(id)) setAppliedIds([...appliedIds, id]);
      setSavedIds(savedIds.filter(sid => sid !== id));
    }
    if (action === 'REMOVE_SAVE') {
      setSavedIds(savedIds.filter(sid => sid !== id));
    }
    if (action === 'REMOVE_APPLY') {
      setAppliedIds(appliedIds.filter(aid => aid !== id));
    }
  };

  // Derive Lists
  const availableMatches = matches.filter(m => !savedIds.includes(m.id) && !appliedIds.includes(m.id));
  const savedMatches = matches.filter(m => savedIds.includes(m.id)).sort((a, b) => b.score - a.score);
  const appliedMatches = matches.filter(m => appliedIds.includes(m.id)).sort((a, b) => b.score - a.score);

  const discoveryFiltered = availableMatches
    .filter(m => m.section === activeTab)
    .sort((a, b) => b.score - a.score);

  const discoveryTabs = [
    { key: 'dream' as const, label: 'DREAM', count: availableMatches.filter(m => m.section === 'dream').length },
    { key: 'recommended' as const, label: 'RECOMMENDED', count: availableMatches.filter(m => m.section === 'recommended').length },
    { key: 'startup' as const, label: 'STARTUPS', count: availableMatches.filter(m => m.section === 'startup').length },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0A0A' }}>
      
      {/* --------------------------------------------------- */}
      {/* GLOBAL HEADER */}
      {/* --------------------------------------------------- */}
      <header className="flex items-center justify-between px-6 py-4 shrink-0 relative z-50" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-black text-white shadow-[0_0_15px_rgba(166,123,91,0.3)]"
            style={{ background: '#A67B5B' }}>R</div>
          <span className="text-white font-bold text-sm tracking-wider">RADAR.CORE</span>
        </Link>

        {/* Top Navigation */}
        <div className="hidden md:flex items-center bg-[#111] border border-[#222] rounded-full p-1 shadow-inner">
          {['DISCOVERY', 'VAULT', 'BATTLEFIELD'].map((tab) => (
            <button
              key={tab}
              onClick={() => setPrimaryTab(tab as any)}
              className={`px-6 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all ${
                primaryTab === tab ? 'bg-[#A67B5B] text-white shadow-lg' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {tab === 'VAULT' ? `THE VAULT (${savedMatches.length})` : 
               tab === 'BATTLEFIELD' ? `BATTLEFIELD (${appliedMatches.length})` : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link href="/settings" className="flex items-center gap-2 group mr-2 text-[#888] hover:text-[#A67B5B] transition-colors" title="Change your preferences">
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute right-[140px]">Edit Preferences</span>
          </Link>
          <button onClick={handleScan} disabled={scanning}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white transition-opacity shadow-[0_0_15px_rgba(166,123,91,0.2)]"
            style={{ background: scanning ? '#555' : '#A67B5B' }}>
            {scanning ? 'SCANNING...' : 'SCAN NOW'}
          </button>
        </div>
      </header>

      {/* --------------------------------------------------- */}
      {/* MOBILE NAVIGATION FALLBACK */}
      {/* --------------------------------------------------- */}
      <div className="md:hidden flex items-center justify-center gap-2 py-4 border-b border-[#1A1A1A] bg-[#0A0A0A]">
          {['DISCOVERY', 'VAULT', 'BATTLEFIELD'].map((tab) => (
            <button
              key={tab}
              onClick={() => setPrimaryTab(tab as any)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-widest transition-all ${
                primaryTab === tab ? 'bg-[#A67B5B] text-white' : 'text-[#666] bg-[#111]'
              }`}
            >
              {tab === 'VAULT' ? `VAULT (${savedMatches.length})` : 
               tab === 'BATTLEFIELD' ? `APPLIED (${appliedMatches.length})` : tab}
            </button>
          ))}
      </div>

      {/* --------------------------------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* --------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-[500px] pointer-events-none" style={{ 
          background: primaryTab === 'VAULT' ? 'radial-gradient(circle at 50% 0%, rgba(166,123,91,0.08) 0%, transparent 70%)' :
                      primaryTab === 'BATTLEFIELD' ? 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 70%)' :
                      'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)'
        }} />

        <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
          <AnimatePresence mode="wait">

            {/* ======================================= */}
            {/* DISCOVERY VIEW */}
            {/* ======================================= */}
            {primaryTab === 'DISCOVERY' && (
              <motion.div key="DISCOVERY" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {discoveryTabs.map(t => (
                    <div key={t.key} className="p-4 rounded-xl text-center cursor-pointer transition-all hover:scale-[1.02]"
                      onClick={() => setActiveTab(t.key)}
                      style={{
                        background: activeTab === t.key ? '#141414' : '#0D0D0D',
                        border: '1px solid ' + (activeTab === t.key ? '#A67B5B' : '#1A1A1A'),
                        boxShadow: activeTab === t.key ? '0 0 20px rgba(166,123,91,0.1)' : 'none'
                      }}>
                      <p className="text-2xl font-black text-white font-mono">{t.count}</p>
                      <p className="text-xs font-bold uppercase tracking-wider mt-1"
                        style={{ color: activeTab === t.key ? '#A67B5B' : '#555' }}>{t.label}</p>
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div className="text-center py-20"><p className="text-sm" style={{ color: '#555' }}>Loading Intelligence...</p></div>
                ) : discoveryFiltered.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-[#222] rounded-xl bg-[#0D0D0D]">
                    <p className="text-lg text-white font-bold mb-2">No active signals.</p>
                    <p className="text-sm mb-6 text-[#666]">Your discovery feed is empty or fully processed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {discoveryFiltered.map(match => (
                        <motion.div key={match.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, x: -100 }} transition={{ duration: 0.2 }}
                          className="p-6 rounded-xl transition-all" style={{ background: '#111', border: '1px solid #222' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
                                  style={{ background: '#1A1A1A', color: '#A67B5B' }}>
                                  {match.job.company.name}
                                </span>
                                {match.job.work_type && (
                                  <span className="text-xs px-2 py-1 rounded"
                                    style={{ background: match.job.work_type === 'remote' ? '#10B98115' : '#1A1A1A', color: match.job.work_type === 'remote' ? '#10B981' : '#666' }}>
                                    {match.job.work_type.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-white font-bold text-xl mb-1">{match.job.title}</h3>
                              <p className="text-sm mb-4" style={{ color: '#666' }}>
                                {match.job.location} {match.job.department ? '? ' + match.job.department : ''}
                              </p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {match.matching_skills.slice(0, 5).map(s => (
                                  <span key={s} className="text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-bold"
                                    style={{ background: '#A67B5B10', color: '#A67B5B', border: '1px solid #A67B5B30' }}>
                                    {s}
                                  </span>
                                ))}
                                {match.missing_skills.slice(0, 3).map(s => (
                                  <span key={s} className="text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-bold"
                                    style={{ background: '#FF444410', color: '#FF6666', border: '1px solid #FF444430' }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                              <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{match.reasoning}</p>
                            </div>
                            
                            {/* Action Block */}
                            <div className="ml-8 flex flex-col items-end gap-3 min-w-[120px]">
                              <div className="text-3xl font-black font-mono mb-2"
                                style={{ color: match.score >= 70 ? '#10B981' : match.score >= 40 ? '#F59E0B' : '#666' }}>
                                {match.score}%
                              </div>
                              <button onClick={() => handleAction(match.id, 'SAVE')}
                                className="w-full py-2 rounded text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#A67B5B] hover:text-white border border-[#333]"
                                style={{ background: '#1A1A1A' }}>
                                TO VAULT
                              </button>
                              <a href={match.job.apply_url} target="_blank" rel="noopener noreferrer" onClick={() => handleAction(match.id, 'APPLY')}
                                className="w-full text-center py-2 rounded text-xs font-bold uppercase tracking-wider text-black bg-white hover:bg-gray-200 transition-all">
                                APPLY NOW
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* ======================================= */}
            {/* THE VAULT VIEW */}
            {/* ======================================= */}
            {primaryTab === 'VAULT' && (
              <motion.div key="VAULT" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <div className="mb-8">
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">The Vault</h1>
                  <p className="text-[#888]">Your curated list of highly targeted opportunities.</p>
                </div>

                {savedMatches.length === 0 ? (
                  <div className="text-center py-32 border border-[#222] rounded-2xl bg-[#0D0D0D]">
                    <div className="text-[#333] text-6xl mb-4">??</div>
                    <p className="text-xl text-white font-bold mb-2">The Vault is empty.</p>
                    <p className="text-[#666]">Save jobs from the Discovery feed to lock them in here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {savedMatches.map(match => (
                        <TiltCard key={match.id} className="bg-[#111] border border-[#A67B5B] border-opacity-30 rounded-2xl p-6 flex flex-col shadow-[0_0_30px_rgba(166,123,91,0.05)]">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#A67B5B20] text-[#A67B5B]">
                              {match.job.company.name}
                            </span>
                            <span className="text-xl font-black font-mono text-white">{match.score}%</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-1 leading-tight flex-1">{match.job.title}</h3>
                          <p className="text-xs text-[#666] mb-6">{match.job.location}</p>
                          
                          <div className="flex gap-2">
                            <a href={match.job.apply_url} target="_blank" rel="noopener noreferrer" onClick={() => handleAction(match.id, 'APPLY')}
                              className="flex-1 text-center py-2 rounded text-xs font-bold uppercase tracking-wider bg-[#A67B5B] text-white hover:bg-opacity-80 transition-all shadow-[0_0_15px_rgba(166,123,91,0.3)]">
                              DEPLOY
                            </a>
                            <button onClick={() => handleAction(match.id, 'REMOVE_SAVE')}
                              className="px-3 py-2 rounded border border-[#333] hover:border-[#FF4444] hover:text-[#FF4444] text-[#666] transition-all">
                              ?
                            </button>
                          </div>
                        </TiltCard>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* ======================================= */}
            {/* THE BATTLEFIELD VIEW */}
            {/* ======================================= */}
            {primaryTab === 'BATTLEFIELD' && (
              <motion.div key="BATTLEFIELD" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <div className="mb-8">
                  <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">The Battlefield</h1>
                  <p className="text-[#888]">Track your active deployments and ongoing offensives.</p>
                </div>

                {appliedMatches.length === 0 ? (
                  <div className="text-center py-32 border border-[#222] rounded-2xl bg-[#0D0D0D]">
                    <div className="text-[#333] text-6xl mb-4">??</div>
                    <p className="text-xl text-white font-bold mb-2">No active deployments.</p>
                    <p className="text-[#666]">Apply to jobs to track them on the battlefield.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {appliedMatches.map(match => (
                        <TiltCard key={match.id} className="bg-[#111] border border-[#10B981] border-opacity-30 rounded-2xl p-6 flex flex-col shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#10B98120] text-[#10B981]">
                              {match.job.company.name}
                            </span>
                            <span className="text-xs font-bold px-2 py-1 bg-white text-black rounded uppercase">Active</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-1 leading-tight flex-1">{match.job.title}</h3>
                          <p className="text-xs text-[#666] mb-6">{match.job.location}</p>
                          
                          <button onClick={() => handleAction(match.id, 'REMOVE_APPLY')}
                            className="w-full py-2 rounded border border-[#333] hover:border-[#FF4444] hover:text-[#FF4444] text-[#666] transition-all text-xs font-bold tracking-wider uppercase">
                            RETREAT (Remove)
                          </button>
                        </TiltCard>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
