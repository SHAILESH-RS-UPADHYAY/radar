'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';

const RadarScene = dynamic(() => import('@/components/3d/RadarScene'), { ssr: false });

// Animated counter component
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 20);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Section wrapper with fade-in
function Section({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: '#0A0E27' }}>
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3' : 'py-5'}`}
        style={{ background: isScrolled ? 'rgba(10,14,39,0.85)' : 'transparent', backdropFilter: isScrolled ? 'blur(20px)' : 'none', borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
              <div className="w-5 h-5 border-2 border-white rounded-full relative">
                <div className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-white origin-bottom" style={{ transform: 'translate(-50%,-100%) rotate(45deg)' }} />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">RADAR</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Link href="/sign-in" className="px-5 py-2.5 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors rounded-xl hover:bg-white/5">Sign In</Link>
            <Link href="/sign-up" className="group relative px-6 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
              <span className="relative z-10">Start Free</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#00D4FF] to-[#00FF88] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative min-h-screen flex items-center justify-center px-6">
        <RadarScene />
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.3 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-medium tracking-wide uppercase"
              style={{ background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)', color: '#A5A0FF' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
              AI-Powered Job Intelligence
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.5 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tight mb-6">
            <span className="text-white">Your career,</span>
            <br />
            <span className="bg-gradient-to-r from-[#6C63FF] via-[#00D4FF] to-[#00FF88] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>
              on autopilot.
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }}
            className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#94A3B8' }}>
            RADAR scrapes 50+ company career pages every hour, matches jobs to your resume using AI, and serves the best opportunities — before anyone else finds them.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="group relative w-full sm:w-auto px-10 py-4 text-base font-bold rounded-2xl text-white overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-[0_0_50px_rgba(0,212,255,0.35)]"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                Start Scanning Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#00D4FF] to-[#00FF88] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </Link>
            <a href="#how-it-works" className="group flex items-center gap-2 px-8 py-4 text-sm font-medium rounded-2xl transition-all duration-300 hover:bg-white/5"
              style={{ color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center border border-[#00D4FF]/30 group-hover:border-[#00D4FF]/60 group-hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all">
                <svg className="w-3 h-3 text-[#00D4FF]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
              See How It Works
            </a>
          </motion.div>
        </div>
        {/* Scroll indicator */}
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
            <div className="w-1 h-2.5 rounded-full bg-[#00D4FF]" />
          </div>
        </motion.div>
      </section>

      {/* ========== STATS BAR ========== */}
      <Section className="relative py-8 z-10 border-y" delay={0.1}>
        <div className="absolute inset-0" style={{ background: 'rgba(22,27,61,0.4)', borderColor: 'rgba(255,255,255,0.05)' }} />
        <div className="relative max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 50, suffix: '+', label: 'Companies Tracked', color: '#00D4FF' },
            { value: 5000, suffix: '+', label: 'Jobs Scanned', color: '#00FF88' },
            { value: 384, suffix: 'D', label: 'AI Embedding Dims', color: '#6C63FF' },
            { value: 24, suffix: '/7', label: 'Auto Scanning', color: '#FF6B9D' },
          ].map((stat, i) => (
            <div key={i} className="py-4">
              <div className="text-3xl md:text-4xl font-black mb-1" style={{ color: stat.color }}>
                <Counter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs font-medium uppercase tracking-widest" style={{ color: '#64748B' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="relative py-28 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <Section className="text-center mb-20">
            <span className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#00D4FF' }}>How It Works</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Three steps to your <span className="bg-gradient-to-r from-[#00D4FF] to-[#00FF88] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>dream job</span></h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#64748B' }}>No more endless scrolling. RADAR does the hunting while you focus on preparing.</p>
          </Section>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🎯', title: 'Tell Us Your Dream', desc: 'Upload your resume or select skills. Pick your dream companies from 50+ top tech firms. Set your location.', color: '#6C63FF', glow: 'rgba(108,99,255,0.15)' },
              { step: '02', icon: '🔬', title: 'AI Scans Everything', desc: 'Our engine scrapes career pages every hour using ATS APIs. AI embeddings match jobs to YOUR specific profile.', color: '#00D4FF', glow: 'rgba(0,212,255,0.15)' },
              { step: '03', icon: '⚡', title: 'Apply Before Anyone', desc: 'Get ranked matches across 3 sections — Dream Companies, AI Recommended, and Startup Opportunities. One click apply.', color: '#00FF88', glow: 'rgba(0,255,136,0.15)' },
            ].map((item, i) => (
              <Section key={i} delay={i * 0.15}>
                <div className="group relative p-8 rounded-3xl h-full transition-all duration-500 hover:translate-y-[-8px] cursor-default overflow-hidden"
                  style={{ background: 'rgba(22,27,61,0.5)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
                  {/* Gradient border on hover */}
                  <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(135deg, ${item.color}22, transparent)` }} />
                  {/* Corner glow */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl"
                    style={{ background: item.glow }} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-5xl">{item.icon}</span>
                      <span className="text-6xl font-black" style={{ color: 'rgba(255,255,255,0.03)' }}>{item.step}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.desc}</p>
                    {/* Bottom accent line */}
                    <div className="mt-6 h-0.5 w-12 rounded-full group-hover:w-full transition-all duration-700" style={{ background: `linear-gradient(90deg, ${item.color}, transparent)` }} />
                  </div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <Section className="text-center mb-20">
            <span className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#00FF88' }}>Features</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">Built for <span className="bg-gradient-to-r from-[#6C63FF] to-[#00D4FF] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>freshers</span> who mean business</h2>
          </Section>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🏢', title: 'Direct from Career Pages', desc: 'We scrape Greenhouse, Lever & Ashby APIs — not third-party job boards. Real listings, zero duplicates.', accent: '#00D4FF' },
              { icon: '🧠', title: 'AI Resume Matching', desc: '384-dimension semantic embeddings compare your exact skills against every job description. Not keyword matching — understanding.', accent: '#6C63FF' },
              { icon: '📍', title: 'Location-Smart', desc: 'Haversine distance from your city to every job. Sort by nearest. Freshers in Chandigarh? See Gurugram jobs first.', accent: '#00FF88' },
              { icon: '💰', title: 'Salary Transparency', desc: 'When companies share compensation data, you see it. Sort by highest pay. No surprises.', accent: '#FFB700' },
              { icon: '🏠', title: 'Remote-First Filter', desc: 'One click: Remote → Hybrid → In-office. Color-coded badges so you know instantly.', accent: '#FF6B9D' },
              { icon: '⚡', title: 'Hourly Scans', desc: 'GitHub Actions cron runs every hour. New jobs appear on your dashboard before they hit LinkedIn.', accent: '#00D4FF' },
            ].map((feat, i) => (
              <Section key={i} delay={i * 0.1}>
                <div className="group relative p-6 rounded-2xl h-full transition-all duration-500 hover:translate-y-[-4px]"
                  style={{ background: 'rgba(22,27,61,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-2xl scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left"
                    style={{ background: `linear-gradient(90deg, ${feat.accent}, transparent)` }} />
                  <span className="text-3xl mb-4 block">{feat.icon}</span>
                  <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{feat.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <Section className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#FFB700' }}>Pricing</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">Start free. <span className="bg-gradient-to-r from-[#FFB700] to-[#FF6B9D] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>Upgrade when ready.</span></h2>
          </Section>
          <Section>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Free */}
              <div className="relative p-8 rounded-3xl" style={{ background: 'rgba(22,27,61,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: '#64748B' }}>Free Trial</div>
                <div className="text-4xl font-black text-white mb-1">₹0</div>
                <div className="text-xs mb-6" style={{ color: '#64748B' }}>1 day access</div>
                <ul className="space-y-3 mb-8">
                  {['All 3 job sections', '5 companies per section', '1 search included', 'AI match scoring'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm" style={{ color: '#94A3B8' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block w-full py-3.5 text-center text-sm font-semibold rounded-xl transition-all hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                  Try Free →
                </Link>
              </div>
              {/* Pro */}
              <div className="relative p-8 rounded-3xl overflow-hidden" style={{ background: 'rgba(22,27,61,0.7)', border: '1px solid rgba(0,212,255,0.2)' }}>
                <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }} />
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl" style={{ background: 'rgba(0,212,255,0.15)' }} />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#00D4FF' }}>Pro</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF' }}>Popular</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black text-white">₹249</span>
                    <span className="text-sm" style={{ color: '#64748B' }}>/week</span>
                  </div>
                  <div className="text-xs mb-6" style={{ color: '#64748B' }}>UPI & PayPal accepted</div>
                  <ul className="space-y-3 mb-8">
                    {['50+ dream companies', 'Hourly auto-scanning', 'All 3 sections unlimited', 'AI match + reasoning', 'Email job digests', 'Priority support'].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-white">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF' }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up" className="block w-full py-3.5 text-center text-sm font-bold rounded-xl text-white transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
                    Get Pro Access →
                  </Link>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <Section className="relative py-32 z-10 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            Stop searching.<br />
            <span className="bg-gradient-to-r from-[#6C63FF] via-[#00D4FF] to-[#00FF88] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>Start getting found.</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#64748B' }}>Join freshers and professionals who let AI find their next role — automatically.</p>
          <Link href="/sign-up" className="group inline-flex items-center gap-3 px-12 py-5 text-lg font-bold rounded-2xl text-white transition-all duration-500 hover:scale-105 hover:shadow-[0_0_60px_rgba(0,212,255,0.4)]"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
            Launch Your RADAR
            <span className="text-2xl group-hover:rotate-12 transition-transform">🚀</span>
          </Link>
        </div>
      </Section>

      {/* ========== FOOTER ========== */}
      <footer className="relative z-10 py-10 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
            <div className="w-3 h-3 border border-white rounded-full" />
          </div>
          <span className="text-sm font-bold text-white">RADAR</span>
        </div>
        <p className="text-xs" style={{ color: '#4B5563' }}>© 2026 RADAR. AI Job Intelligence Engine. Built with obsession.</p>
      </footer>
    </main>
  );
}
