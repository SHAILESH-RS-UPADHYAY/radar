'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

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
  const [activeTab, setActiveTab] = useState<'dream' | 'recommended' | 'startup'>('recommended');

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

  const filteredMatches = matches
    .filter(m => m.section === activeTab)
    .sort((a, b) => b.score - a.score);

  const tabs = [
    { key: 'dream' as const, label: 'DREAM', count: matches.filter(m => m.section === 'dream').length },
    { key: 'recommended' as const, label: 'RECOMMENDED', count: matches.filter(m => m.section === 'recommended').length },
    { key: 'startup' as const, label: 'STARTUPS', count: matches.filter(m => m.section === 'startup').length },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-black text-white"
            style={{ background: '#A67B5B' }}>R</div>
          <span className="text-white font-bold text-sm tracking-wider">RADAR.CORE</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleScan} disabled={scanning}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white transition-opacity"
            style={{ background: scanning ? '#555' : '#A67B5B' }}>
            {scanning ? 'SCANNING...' : 'SCAN NOW'}
          </button>
          <span className="text-xs" style={{ color: '#666' }}>
            {user?.emailAddresses?.[0]?.emailAddress}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {tabs.map(t => (
            <div key={t.key} className="p-4 rounded-lg text-center cursor-pointer transition-all"
              onClick={() => setActiveTab(t.key)}
              style={{
                background: activeTab === t.key ? '#141414' : '#0D0D0D',
                border: '1px solid ' + (activeTab === t.key ? '#A67B5B' : '#1A1A1A'),
              }}>
              <p className="text-2xl font-black text-white font-mono">{t.count}</p>
              <p className="text-xs font-bold uppercase tracking-wider mt-1"
                style={{ color: activeTab === t.key ? '#A67B5B' : '#555' }}>{t.label}</p>
            </div>
          ))}
        </div>

        {/* Job Cards */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: '#555' }}>Loading matches...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-white font-bold mb-2">No matches yet</p>
            <p className="text-sm mb-6" style={{ color: '#666' }}>
              Click "SCAN NOW" to compute your AI match scores
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMatches.map(match => (
              <div key={match.id} className="p-5 rounded-lg transition-all hover:scale-[1.01]"
                style={{ background: '#111', border: '1px solid #1A1A1A' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: '#1A1A1A', color: '#A67B5B' }}>
                        {match.job.company.name}
                      </span>
                      {match.job.work_type && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: match.job.work_type === 'remote' ? '#10B98120' : '#1A1A1A',
                            color: match.job.work_type === 'remote' ? '#10B981' : '#666',
                          }}>
                          {match.job.work_type.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold text-base mb-1">{match.job.title}</h3>
                    <p className="text-xs mb-3" style={{ color: '#666' }}>
                      {match.job.location} {match.job.department ? '· ' + match.job.department : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {match.matching_skills.slice(0, 5).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#A67B5B20', color: '#A67B5B', border: '1px solid #A67B5B40' }}>
                          {s}
                        </span>
                      ))}
                      {match.missing_skills.slice(0, 3).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#FF444420', color: '#FF6666', border: '1px solid #FF444440' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: '#555' }}>{match.reasoning}</p>
                  </div>
                  <div className="text-right ml-4 flex flex-col items-end gap-2">
                    <div className="text-2xl font-black font-mono"
                      style={{ color: match.score >= 70 ? '#10B981' : match.score >= 40 ? '#F59E0B' : '#666' }}>
                      {match.score}%
                    </div>
                    <a href={match.job.apply_url} target="_blank" rel="noopener noreferrer"
                      className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-white"
                      style={{ background: '#A67B5B' }}>
                      APPLY
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
