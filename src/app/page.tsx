'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const RadarScene = dynamic(() => import('@/components/3d/RadarScene'), { ssr: false });

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 50);
    const timer = setInterval(() => { start += step; if (start >= target) { setCount(target); clearInterval(timer); } else setCount(start); }, 25);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  );
}

// Quotes rotation
const QUOTES = [
  { text: "Your placement officer can't do what our AI does in 60 seconds.", emoji: "ðŸ’€" },
  { text: "Gharwale poochenge 'Beta job lagi?' â€” You say 'RADAR laga rakha hai.'", emoji: "ðŸ˜Ž" },
  { text: "While you sleep, RADAR scrapes. While they scroll LinkedIn, you apply first.", emoji: "âš¡" },
  { text: "50 companies. 1 click. 0 recruiter ghosting. Math checks out.", emoji: "ðŸ“Š" },
  { text: "Your resume isn't bad. Your job search strategy was. Until now.", emoji: "ðŸŽ¯" },
  { text: "We don't find jobs. We intercept them before they go viral.", emoji: "ðŸ”¥" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="relative min-h-screen bg-grid scanlines">
      {/* ===== NAVBAR ===== */}
      <nav className={'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ' + (scrolled ? 'py-2.5' : 'py-4')}
        style={{ background: scrolled ? 'rgba(5,8,22,0.9)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(0,255,212,0.06)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="RADAR" width={36} height={36} className="rounded-xl" style={{ boxShadow: '0 0 15px rgba(0,255,212,0.3)' }} />
            <span className="text-xl font-extrabold tracking-tight">RADAR</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Link href="/sign-in" className="px-5 py-2 text-sm font-medium text-[#64748B] hover:text-white transition-colors rounded-xl hover:bg-white/5">Sign In</Link>
            <Link href="/sign-up" className="btn-neon text-sm px-6 py-2.5">Start Free â†’</Link>
          </motion.div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center px-6">
        <RadarScene />
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-semibold tracking-[0.15em] uppercase pulse-border"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#A78BFA' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFD4] animate-pulse" />
              Live â€” Scanning 50+ Companies Right Now
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[0.92] tracking-tight mb-7 glitch-text">
            <span className="text-white">Your career,</span><br />
            <span className="text-glow">on autopilot.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
            className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#94A3B8' }}>
            RADAR scrapes 50+ career pages hourly via ATS APIs, matches every job to your resume using 384-dimension AI embeddings, and delivers ranked results â€” before anyone else.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="btn-neon text-base px-10 py-4 w-full sm:w-auto flex items-center justify-center gap-2">
              Start Scanning Free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <a href="#how" className="group flex items-center gap-2.5 px-8 py-4 text-sm font-medium rounded-2xl transition-all hover:bg-white/5"
              style={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center border border-[#00FFD4]/30 group-hover:border-[#00FFD4]/70 group-hover:shadow-[0_0_12px_rgba(0,255,212,0.2)] transition-all">
                <svg className="w-3 h-3 text-[#00FFD4]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </span>
              See How It Works
            </a>
          </motion.div>
        </div>
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <div className="w-5 h-9 rounded-full border border-white/15 flex justify-center pt-2"><div className="w-0.5 h-2 rounded-full bg-[#00FFD4]" /></div>
        </motion.div>
      </section>

      {/* ===== LIVE STATS ===== */}
      <FadeIn className="relative py-6 z-10" delay={0.1}>
        <div className="max-w-6xl mx-auto px-6" style={{ borderTop: '1px solid rgba(0,255,212,0.06)', borderBottom: '1px solid rgba(0,255,212,0.06)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 text-center">
            {[
              { v: 50, s: '+', l: 'Companies Tracked', c: '#00FFD4' },
              { v: 5000, s: '+', l: 'Jobs Scanned Daily', c: '#00FF88' },
              { v: 384, s: 'D', l: 'AI Embedding Dims', c: '#8B5CF6' },
              { v: 24, s: '/7', l: 'Always Scanning', c: '#FF3D71' },
            ].map((s, i) => (
              <div key={i}><div className="text-3xl md:text-4xl font-black" style={{ color: s.c }}><Counter target={s.v} suffix={s.s} /></div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] mt-1" style={{ color: '#475569' }}>{s.l}</div></div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="relative py-28 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-20">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#00FFD4' }}>How It Works</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Three steps to your <span className="text-glow">dream job</span></h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#475569' }}>No more scrolling. No more ghosting. RADAR does the hunting.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', icon: 'ðŸŽ¯', title: 'Tell Us Your Dream', desc: 'Upload resume. Pick dream companies from 50+ firms. Set location. That\'s it.', c: '#8B5CF6' },
              { n: '02', icon: 'ðŸ”¬', title: 'AI Scans Everything', desc: 'Our engine hits ATS APIs every hour. AI embeddings match jobs to YOUR profile â€” not keywords, understanding.', c: '#00FFD4' },
              { n: '03', icon: 'âš¡', title: 'Apply Before Anyone', desc: 'Get ranked matches across Dream Companies, AI Picks, and Startup Gems. Posted date. Expiry alerts. One-click apply.', c: '#00FF88' },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <div className="glow-card-hover p-8 h-full cursor-default">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-4xl">{item.icon}</span>
                      <span className="text-5xl font-black" style={{ color: 'rgba(255,255,255,0.03)' }}>{item.n}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.desc}</p>
                    <div className="mt-6 h-0.5 w-12 rounded-full group-hover:w-full transition-all duration-700" style={{ background: 'linear-gradient(90deg, ' + item.c + ', transparent)' }} />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-20">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#00FF88' }}>Features</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Built for <span className="text-glow">freshers</span> who mean business</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'ðŸ¢', title: 'Direct ATS Scraping', desc: 'Greenhouse, Lever, Ashby APIs. Real listings, zero duplicates, structured data.', a: '#00FFD4' },
              { icon: 'ðŸ§ ', title: '384D AI Matching', desc: 'Semantic embeddings compare your skills vs every JD. Not keywords â€” real understanding.', a: '#8B5CF6' },
              { icon: 'ðŸ“', title: 'Location Intelligence', desc: 'Haversine distance sorting. Freshers in Chandigarh see Gurugram jobs first.', a: '#00FF88' },
              { icon: 'ðŸ“…', title: 'Date & Expiry Alerts', desc: 'See when each job was posted and when it expires. Red alerts for closing soon.', a: '#FF3D71' },
              { icon: 'ðŸ ', title: 'Remote-First Filter', desc: 'One click: Remote, Hybrid, In-office. Color-coded badges. Instantly clear.', a: '#FFB700' },
              { icon: 'âš¡', title: 'Hourly Auto-Scan', desc: 'GitHub Actions cron every hour. New jobs appear before they hit LinkedIn.', a: '#00FFD4' },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="glow-card-hover p-6 h-full">
                  <div className="relative z-10">
                    <span className="text-3xl mb-4 block">{f.icon}</span>
                    <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{f.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== QUOTE ===== */}
      <FadeIn className="relative py-16 z-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatePresence mode="wait">
            <motion.div key={quoteIdx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.5 }}>
              <p className="text-xl md:text-2xl font-bold text-white quote-glow italic leading-relaxed">"{QUOTES[quoteIdx].text}"</p>
              <span className="text-3xl mt-3 block">{QUOTES[quoteIdx].emoji}</span>
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-center gap-1.5 mt-6">
            {QUOTES.map((_, i) => (
              <button key={i} onClick={() => setQuoteIdx(i)} className="w-2 h-2 rounded-full transition-all" style={{ background: i === quoteIdx ? '#00FFD4' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ===== COMPARISON ===== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#8B5CF6' }}>Why RADAR</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Us vs. <span className="text-glow">Everyone Else</span></h2>
          </FadeIn>
          <FadeIn>
            <div className="glow-card p-1 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ borderBottom: '1px solid rgba(0,255,212,0.08)' }}>
                  <th className="p-4 font-semibold" style={{ color: '#64748B' }}>Feature</th>
                  <th className="p-4 font-bold text-[#00FFD4]">RADAR</th>
                  <th className="p-4 font-semibold" style={{ color: '#64748B' }}>LinkedIn</th>
                  <th className="p-4 font-semibold" style={{ color: '#64748B' }}>Naukri</th>
                </tr></thead>
                <tbody>
                  {[
                    ['AI Resume Match', 'âœ… 384D', 'âŒ', 'âŒ'],
                    ['Direct ATS Data', 'âœ…', 'âŒ', 'âŒ'],
                    ['Hourly Scan', 'âœ…', 'âŒ', 'âŒ'],
                    ['Fresher-First', 'âœ…', 'âŒ', 'âš ï¸'],
                    ['Location Sort', 'âœ…', 'âš ï¸', 'âš ï¸'],
                    ['Free to Start', 'âœ… 3 Searches', 'âœ…', 'âœ…'],
                    ['Mini-Games ðŸŽ®', 'âœ…', 'âŒ', 'âŒ'],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {row.map((cell, j) => (
                        <td key={j} className={'p-4 ' + (j === 0 ? 'font-medium text-white' : j === 1 ? 'font-semibold' : '')}
                          style={j === 1 ? { color: '#00FFD4' } : j > 1 ? { color: '#64748B' } : {}}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block" style={{ color: '#FFB700' }}>Pricing</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Start free. <span className="text-glow">Upgrade when ready.</span></h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <FadeIn><div className="glow-card p-8">
              <div className="relative z-10">
                <div className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Free</div>
                <div className="text-4xl font-black text-white mb-1">â‚¹0</div>
                <div className="text-xs mb-6" style={{ color: '#475569' }}>3 searches included</div>
                <ul className="space-y-3 mb-8">
                  {['All 3 job sections', '5 companies per section', '3 total searches', 'AI match scoring', '2 mini-games while loading'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm" style={{ color: '#94A3B8' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88' }}>âœ“</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block w-full py-3.5 text-center text-sm font-semibold rounded-xl transition-all hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>Try Free â†’</Link>
              </div>
            </div></FadeIn>
            <FadeIn delay={0.15}><div className="glow-card p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.07]" style={{ background: 'linear-gradient(135deg, #8B5CF6, #00FFD4)' }} />
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl" style={{ background: 'rgba(0,255,212,0.1)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#00FFD4' }}>Pro</span>
                  <span className="badge badge-pro text-[10px]">Popular</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-black text-white">â‚¹249</span><span className="text-sm" style={{ color: '#475569' }}>/week</span></div>
                <div className="text-xs mb-6" style={{ color: '#475569' }}>UPI & PayPal accepted</div>
                <ul className="space-y-3 mb-8">
                  {['50+ dream companies', 'Unlimited scanning', 'All sections unlimited', 'AI match + reasoning', 'Priority alerts', '4 premium mini-games'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(0,255,212,0.12)', color: '#00FFD4' }}>âœ“</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="btn-neon block w-full py-3.5 text-center text-sm">Get Pro Access â†’</Link>
              </div>
            </div></FadeIn>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="relative py-28 z-10 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white">Frequently Asked</h2>
          </FadeIn>
          {[
            { q: 'Is RADAR really free?', a: 'Yes. 3 searches, all 3 sections, AI matching â€” completely free. No credit card.' },
            { q: 'Where do the jobs come from?', a: 'Directly from company career pages via Greenhouse, Lever, and Ashby APIs. Real listings from the source.' },
            { q: 'How is this different from LinkedIn?', a: 'We don\'t show ads. We don\'t show irrelevant jobs. We scrape hourly, match with AI embeddings, and rank by YOUR skills.' },
            { q: 'Is this for freshers only?', a: 'Primarily built for Indian freshers, but anyone can use it. Location sorting works globally.' },
            { q: 'How do I pay for Pro?', a: 'UPI (scan QR) for India, PayPal for international. â‚¹249/week. Cancel anytime.' },
            { q: 'What are the mini-games?', a: 'While your RADAR scans for jobs, play Reaction Test, Memory Match (free) or Snake, Word Scramble (pro). Time flies.' },
          ].map((faq, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <details className="glow-card-hover mb-3 group">
                <summary className="p-5 cursor-pointer text-sm font-semibold text-white flex items-center justify-between relative z-10">
                  {faq.q}
                  <span className="text-[#00FFD4] text-lg transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed relative z-10" style={{ color: '#94A3B8' }}>{faq.a}</div>
              </details>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <FadeIn className="relative py-32 z-10 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Stop searching.<br /><span className="text-glow">Start intercepting.</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: '#475569' }}>Join freshers who let AI find their next role â€” automatically, hourly, relentlessly.</p>
          <Link href="/sign-up" className="btn-neon inline-flex items-center gap-3 px-12 py-5 text-lg">
            Launch Your RADAR <span className="text-2xl">ðŸš€</span>
          </Link>
        </div>
      </FadeIn>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 py-10 px-6 text-center" style={{ borderTop: '1px solid rgba(0,255,212,0.05)' }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #00FFD4)', boxShadow: '0 0 10px rgba(0,255,212,0.2)' }}>
            <div className="w-3 h-3 border border-white rounded-full" />
          </div>
          <span className="text-sm font-bold">RADAR</span>
        </div>
        <p className="text-[11px]" style={{ color: '#334155' }}>Â© 2026 RADAR. AI Job Intelligence Engine. Built with obsession, powered by zero patience for bad job searches.</p>
      </footer>
    </main>
  );
}

