'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { playSound } from '@/lib/audio';
import TicTacToe from '@/components/ui/MiniGame';

const TubesHero = dynamic(() => import('@/components/3d/TubesHero'), { ssr: false });
const ExplodedView = dynamic(() => import('@/components/ui/ExplodedView'), { ssr: false });

const CheckIcon = () => <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
const CrossIcon = () => <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const WarnIcon = () => <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const IconMap: Record<string, React.FC<{style?: React.CSSProperties}>> = {
  check: ({ style }) => <span style={style}><CheckIcon /></span>,
  cross: () => <span className="text-[#444]"><CrossIcon /></span>,
  warn: () => <span className="text-[#FFB700]"><WarnIcon /></span>,
};

function FadeUp({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  );
}

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let v = 0; const step = Math.ceil(target / 55);
      const t = setInterval(() => { v += step; if (v >= target) { setN(target); clearInterval(t); } else setN(v); }, 22);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

const QUOTES = [
  "Your placement officer can't do what our AI does in 60 seconds.",
  "Gharwale poochenge 'Beta job lagi?' — You say 'RADAR laga rakha hai.'",
  "While you sleep, RADAR scrapes. While they scroll LinkedIn, you apply first.",
  "50 companies. 1 click. 0 recruiter ghosting. Math checks out.",
  "Your resume isn't bad. Your job search strategy was. Until now.",
  "We don't find jobs. We intercept them before they go viral.",
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const startScan = () => {
    playSound('scan');
    setTimeout(() => playSound('chain'), 200);
    setIsScanning(true);
    setTimeout(() => { setIsScanning(false); playSound('chime'); }, 13000);
  };

  return (
    <main className="relative min-h-screen bg-grid scanlines">
      {/* ══ NAVBAR ══ */}
      <nav className={'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ' + (scrolled ? 'py-3' : 'py-4')}
        style={{ background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(24px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Image src="/logo.png" alt="RADAR" width={34} height={34} className="rounded-xl" style={{ boxShadow: '0 0 14px rgba(0,255,212,0.25)' }} />
            <span className="text-xl font-black tracking-tight text-white">RADAR</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Link href="/sign-in" className="px-5 py-2 text-sm font-medium text-[#555] hover:text-white transition-colors rounded-xl hover:bg-white/5"
              onMouseEnter={() => playSound('tick')} onClick={() => playSound('gear')}>Sign In</Link>
            <Link href="/sign-up" className="btn-neon text-sm px-6 py-2.5"
              onMouseEnter={() => playSound('tick')} onClick={() => playSound('gear')}>Start Free</Link>
          </motion.div>
        </div>
      </nav>

      {/* ══ SCANNING OVERLAY ══ */}
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-lg">
            <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10 text-center">
              <h2 className="text-3xl font-black text-white mb-2 glitch-text">Intercepting Data Streams</h2>
              <p className="text-[#00FFD4] text-xs uppercase tracking-[0.25em] animate-pulse">Running 384-dimensional semantic match...</p>
            </motion.div>
            <TicTacToe />
            <button onClick={() => setIsScanning(false)} className="mt-8 text-[11px] text-[#444] hover:text-white transition-colors uppercase tracking-widest"
              onMouseEnter={() => playSound('tick')}>[ Abort Scan ]</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO — TUBES BACKGROUND ══ */}
      <section className="relative min-h-screen">
        <TubesHero>
          <div className="flex flex-col items-center justify-center w-full h-full pt-20 pb-10 px-6 text-center pointer-events-none">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.3 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-bold tracking-[0.18em] uppercase pulse-border pointer-events-auto"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,255,212,0.2)', color: '#00FFD4', backdropFilter: 'blur(8px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FFD4] animate-pulse" />
                Live — Scanning 50+ Companies Right Now
              </div>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.45 }}
              className="text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[7rem] font-black leading-[0.88] tracking-tight mb-7 glitch-text neon-glow-text">
              <span className="text-white drop-shadow-[0_0_40px_rgba(0,0,0,1)]">Your career,</span><br />
              <span className="text-glow-alt">on autopilot.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.65 }}
              className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed text-[#94A3B8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              style={{ backdropFilter: 'blur(2px)' }}>
              RADAR scrapes 50+ career pages hourly via ATS APIs, matches every job to your resume using 384-dimension AI embeddings, and delivers ranked results — before anyone else.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto">
              <button onClick={startScan} onMouseEnter={() => playSound('tick')}
                className="btn-neon text-base px-10 py-4 w-full sm:w-auto">
                Demo Scan + Play Game
              </button>
              <a href="#how" className="flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold rounded-2xl border border-white/10 text-[#666] hover:text-white hover:bg-white/5 transition-all w-full sm:w-auto"
                onMouseEnter={() => playSound('tick')} onClick={() => playSound('gear')}>
                See How It Works
              </a>
            </motion.div>
          </div>
        </TubesHero>
      </section>

      {/* ══ LIVE STATS ══ */}
      <FadeUp className="relative z-10" delay={0.1}>
        <div className="divider-glow" />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: 50, s: '+', l: 'Companies Tracked', c: '#00FFD4' },
              { v: 5000, s: '+', l: 'Jobs Scanned Daily', c: '#8B5CF6' },
              { v: 384, s: 'D', l: 'AI Embedding Dims', c: '#FF3D71' },
              { v: 24, s: '/7', l: 'Always Scanning', c: '#FFB700' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-3xl md:text-4xl font-black" style={{ color: s.c, textShadow: `0 0 20px ${s.c}40` }}>
                  <Counter target={s.v} suffix={s.s} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] mt-1 text-[#333]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="divider-glow" />
      </FadeUp>

      {/* ══ HOW IT WORKS — EXPLODED VIEW ══ */}
      <ExplodedView />

      {/* ══ FEATURES ══ */}
      <section className="relative py-24 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#8B5CF6]">Features</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Built for <span className="text-glow">freshers</span> who mean business</h2>
          </FadeUp>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { title: 'Direct ATS Scraping', desc: 'Greenhouse, Lever, Ashby APIs. Real listings, zero duplicates.', c: '#00FFD4' },
              { title: '384D AI Matching', desc: 'Semantic embeddings compare your skills vs every JD. Real understanding.', c: '#8B5CF6' },
              { title: 'Location Intelligence', desc: 'Haversine distance sorting. See nearby jobs first.', c: '#FF3D71' },
              { title: 'Date & Expiry Alerts', desc: 'See posted date and expiry. Never miss a closing window.', c: '#FFB700' },
              { title: 'Remote-First Filter', desc: 'One click: Remote, Hybrid, In-office. Color-coded. Instantly clear.', c: '#00FFD4' },
              { title: 'Hourly Auto-Scan', desc: 'GitHub Actions cron every hour. New jobs before LinkedIn.', c: '#8B5CF6' },
            ].map((f, i) => (
              <FadeUp key={i} delay={i * 0.07}>
                <div className="glow-card-hover p-6 h-full" onMouseEnter={() => playSound('tick')}>
                  <div className="w-1 h-8 rounded-full mb-4" style={{ background: `linear-gradient(180deg, ${f.c}, transparent)` }} />
                  <h3 className="text-sm font-black text-white mb-2">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-[#555]">{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ QUOTE ROTATOR ══ */}
      <FadeUp className="relative py-14 z-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatePresence mode="wait">
            <motion.p key={quoteIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }} className="text-xl md:text-2xl font-bold text-white quote-glow italic leading-relaxed">
              "{QUOTES[quoteIdx]}"
            </motion.p>
          </AnimatePresence>
          <div className="flex justify-center gap-2 mt-5">
            {QUOTES.map((_, i) => (
              <button key={i} onClick={() => { playSound('tick'); setQuoteIdx(i); }}
                onMouseEnter={() => playSound('tick')}
                className="transition-all duration-300"
                style={{ width: i === quoteIdx ? 24 : 8, height: 8, borderRadius: 4, background: i === quoteIdx ? '#00FFD4' : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ══ COMPARISON ══ */}
      <section className="relative py-24 z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp className="text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#FF3D71]">Why RADAR</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Us vs. <span className="text-glow">Everyone Else</span></h2>
          </FadeUp>
          <FadeUp>
            <div className="glow-card p-1 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-white/5">
                  <th className="p-4 font-semibold text-[#333]">Feature</th>
                  <th className="p-4 font-bold text-[#00FFD4]">RADAR</th>
                  <th className="p-4 font-semibold text-[#333]">LinkedIn</th>
                  <th className="p-4 font-semibold text-[#333]">Naukri</th>
                </tr></thead>
                <tbody>
                  {[
                    ['AI Resume Match', {i:'check',t:' 384D',c:'#00FFD4'}, {i:'cross'}, {i:'cross'}],
                    ['Direct ATS Data', {i:'check',c:'#00FFD4'}, {i:'cross'}, {i:'cross'}],
                    ['Hourly Scan', {i:'check',c:'#00FFD4'}, {i:'cross'}, {i:'cross'}],
                    ['Fresher-First', {i:'check',c:'#00FFD4'}, {i:'cross'}, {i:'warn'}],
                    ['Location Sort', {i:'check',c:'#00FFD4'}, {i:'warn'}, {i:'warn'}],
                    ['Free to Start', {i:'check',t:' 3 Searches',c:'#00FFD4'}, {i:'check',c:'#fff'}, {i:'check',c:'#fff'}],
                    ['Mini-Games', {i:'check',c:'#00FFD4'}, {i:'cross'}, {i:'cross'}],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-medium text-white text-sm">{row[0] as string}</td>
                      {(row.slice(1) as {i:string,t?:string,c?:string}[]).map((cell, j) => {
                        const Icon = IconMap[cell.i];
                        return <td key={j} className="p-4"><div className="flex items-center gap-1.5"><Icon style={{ color: cell.c }} />{cell.t && <span style={{ color: cell.c }} className="font-semibold text-xs">{cell.t}</span>}</div></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section className="relative py-24 z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp className="text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#FFB700]">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Start free. <span className="text-glow">Upgrade when ready.</span></h2>
          </FadeUp>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <FadeUp>
              <div className="glow-card p-8 h-full" onMouseEnter={() => playSound('tick')}>
                <div className="text-sm font-bold uppercase tracking-widest mb-2 text-[#333]">Free</div>
                <div className="text-4xl font-black text-white mb-1">₹0</div>
                <div className="text-xs mb-7 text-[#333]">3 searches included</div>
                <ul className="space-y-3 mb-8">
                  {['All 3 job sections','5 companies per section','3 total searches','AI match scoring','2 mini-games while loading'].map((f,i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-[#666]">
                      <span className="text-[#444]"><CheckIcon /></span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block w-full py-3.5 text-center text-sm font-semibold rounded-xl border border-white/8 text-[#555] hover:text-white hover:bg-white/5 transition-all"
                  onMouseEnter={() => playSound('tick')} onClick={() => playSound('gear')}>Try Free</Link>
              </div>
            </FadeUp>
            <FadeUp delay={0.12}>
              <div className="glow-card p-8 relative overflow-hidden h-full" onMouseEnter={() => playSound('tick')}>
                <div className="absolute inset-0 opacity-[0.04]" style={{ background: 'linear-gradient(135deg, #00FFD4, #8B5CF6)' }} />
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(0,255,212,0.07)' }} />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-black uppercase tracking-widest text-[#00FFD4]">Pro</span>
                    <span className="badge badge-pro">Popular</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-black text-white">₹249</span><span className="text-xs text-[#333]">/week</span></div>
                  <div className="text-xs mb-7 text-[#333]">UPI & PayPal accepted</div>
                  <ul className="space-y-3 mb-8">
                    {['50+ dream companies','Unlimited scanning','All sections unlimited','AI match + reasoning','Priority alerts','4 premium mini-games'].map((f,i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-white">
                        <span className="text-[#00FFD4]"><CheckIcon /></span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up" className="btn-neon block w-full py-3.5 text-center text-sm"
                    onMouseEnter={() => playSound('tick')} onClick={() => playSound('gear')}>Get Pro Access</Link>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="relative py-24 z-10 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeUp className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-white">Frequently Asked</h2>
          </FadeUp>
          {[
            {q:'Is RADAR really free?',a:'Yes. 3 searches, all 3 sections, AI matching — completely free. No credit card.'},
            {q:'Where do the jobs come from?',a:'Directly from company career pages via Greenhouse, Lever, and Ashby APIs.'},
            {q:'How is this different from LinkedIn?',a:"We don't show ads. We scrape hourly, match with AI embeddings, and rank by YOUR skills."},
            {q:'Is this for freshers only?',a:'Primarily built for Indian freshers, but anyone can use it. Location sorting works globally.'},
            {q:'How do I pay for Pro?',a:'UPI (scan QR) for India, PayPal for international. ₹249/week. Cancel anytime.'},
            {q:'What are the mini-games?',a:'Play Tic-Tac-Toe, Reaction Test (free) or Snake, Word Scramble (pro) while RADAR scans.'},
          ].map((faq,i) => (
            <FadeUp key={i} delay={i * 0.05}>
              <details className="glow-card-hover mb-2.5 group" onMouseEnter={() => playSound('tick')}>
                <summary className="p-5 cursor-pointer text-sm font-semibold text-white flex items-center justify-between relative z-10"
                  onClick={() => playSound('gear')}>
                  {faq.q}
                  <span className="text-[#00FFD4] text-xl leading-none transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-[#555] relative z-10">{faq.a}</div>
              </details>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <FadeUp className="relative py-32 z-10 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="divider-glow mb-16" />
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight glitch-text">
            Stop searching.<br /><span className="text-glow-alt">Start intercepting.</span>
          </h2>
          <p className="text-base mb-10 max-w-lg mx-auto text-[#444]">Join freshers who let AI find their next role — automatically, hourly, relentlessly.</p>
          <Link href="/sign-up" className="btn-neon inline-flex items-center gap-3 px-12 py-5 text-lg"
            onMouseEnter={() => playSound('chain')} onClick={() => playSound('gear')}>
            Launch Your RADAR
          </Link>
          <div className="divider-glow mt-16" />
        </div>
      </FadeUp>

      {/* ══ FOOTER ══ */}
      <footer className="relative z-10 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Image src="/logo.png" alt="RADAR" width={22} height={22} className="rounded-lg" />
          <span className="text-sm font-black text-white">RADAR</span>
        </div>
        <p className="text-[11px] text-[#222]">© 2026 RADAR. AI Job Intelligence Engine. Built with obsession.</p>
      </footer>
    </main>
  );
}
