'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const RadarScene = dynamic(() => import('@/components/3d/RadarScene'), { ssr: false });

// Icons to replace emojis completely
const CheckIcon = () => <svg className="w-5 h-5 text-[#00FFD4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const CrossIcon = () => <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const WarnIcon = () => <svg className="w-5 h-5 text-[#FFB700]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

const IconMap: Record<string, React.FC> = {
  check: CheckIcon,
  cross: CrossIcon,
  warn: WarnIcon,
};

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

const QUOTES = [
  { text: "Your placement officer can't do what our AI does in 60 seconds." },
  { text: "Gharwale poochenge 'Beta job lagi?' — You say 'RADAR laga rakha hai.'" },
  { text: "While you sleep, RADAR scrapes. While they scroll LinkedIn, you apply first." },
  { text: "50 companies. 1 click. 0 recruiter ghosting. Math checks out." },
  { text: "Your resume isn't bad. Your job search strategy was. Until now." },
  { text: "We don't find jobs. We intercept them before they go viral." },
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
        style={{ background: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Image src="/logo.png" alt="RADAR" width={36} height={36} className="rounded-xl" style={{ boxShadow: '0 0 15px rgba(0,255,212,0.2)' }} />
            <span className="text-xl font-extrabold tracking-tight">RADAR</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <Link href="/sign-in" className="px-5 py-2 text-sm font-medium text-[#64748B] hover:text-white transition-colors rounded-xl hover:bg-white/5">Sign In</Link>
            <Link href="/sign-up" className="btn-neon text-sm px-6 py-2.5">Start Free</Link>
          </motion.div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center px-6">
        <RadarScene />
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-semibold tracking-[0.15em] uppercase pulse-border bg-[#111111] border border-[#333333] text-[#00FFD4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFD4] animate-pulse" />
              Live — Scanning 50+ Companies Right Now
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[0.92] tracking-tight mb-7 glitch-text">
            <span className="text-white">Your career,</span><br />
            <span className="text-glow">on autopilot.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
            className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-[#94A3B8]">
            RADAR scrapes 50+ career pages hourly via ATS APIs, matches every job to your resume using 384-dimension AI embeddings, and delivers ranked results.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="btn-neon text-base px-10 py-4 w-full sm:w-auto flex items-center justify-center gap-2">
              Start Scanning Free
            </Link>
            <a href="#how" className="group flex items-center gap-2.5 px-8 py-4 text-sm font-medium rounded-2xl transition-all hover:bg-white/5 border border-white/10 text-[#64748B]">
              See How It Works
            </a>
          </motion.div>
        </div>
      </section>

      {/* ===== LIVE STATS ===== */}
      <FadeIn className="relative py-6 z-10" delay={0.1}>
        <div className="max-w-6xl mx-auto px-6 border-y border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 text-center">
            {[
              { v: 50, s: '+', l: 'Companies Tracked', c: '#00FFD4' },
              { v: 5000, s: '+', l: 'Jobs Scanned Daily', c: '#ffffff' },
              { v: 384, s: 'D', l: 'AI Embedding Dims', c: '#8B5CF6' },
              { v: 24, s: '/7', l: 'Always Scanning', c: '#00FFD4' },
            ].map((s, i) => (
              <div key={i}><div className="text-3xl md:text-4xl font-black" style={{ color: s.c }}><Counter target={s.v} suffix={s.s} /></div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] mt-1 text-[#475569]">{s.l}</div></div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="relative py-28 z-10 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-20">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#00FFD4]">How It Works</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Three steps to your <span className="text-glow">dream job</span></h2>
            <p className="text-base max-w-xl mx-auto text-[#475569]">No more scrolling. No more ghosting. RADAR does the hunting.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Tell Us Your Dream', desc: 'Upload resume. Pick dream companies from 50+ firms. Set location. That\'s it.', c: '#00FFD4' },
              { n: '02', title: 'AI Scans Everything', desc: 'Our engine hits ATS APIs every hour. AI embeddings match jobs to YOUR profile — not keywords, understanding.', c: '#ffffff' },
              { n: '03', title: 'Apply Before Anyone', desc: 'Get ranked matches across Dream Companies, AI Picks, and Startup Gems. Posted date. Expiry alerts. One-click apply.', c: '#8B5CF6' },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <div className="glow-card-hover p-8 h-full cursor-default">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-5xl font-black text-white/5">{item.n}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[#94A3B8]">{item.desc}</p>
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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#ffffff]">Features</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Built for <span className="text-glow">freshers</span> who mean business</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Direct ATS Scraping', desc: 'Greenhouse, Lever, Ashby APIs. Real listings, zero duplicates, structured data.' },
              { title: '384D AI Matching', desc: 'Semantic embeddings compare your skills vs every JD. Not keywords — real understanding.' },
              { title: 'Location Intelligence', desc: 'Haversine distance sorting. Freshers in Chandigarh see Gurugram jobs first.' },
              { title: 'Date & Expiry Alerts', desc: 'See when each job was posted and when it expires. Alerts for closing soon.' },
              { title: 'Remote-First Filter', desc: 'One click: Remote, Hybrid, In-office. Color-coded badges. Instantly clear.' },
              { title: 'Hourly Auto-Scan', desc: 'GitHub Actions cron every hour. New jobs appear before they hit LinkedIn.' },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="glow-card-hover p-6 h-full">
                  <div className="relative z-10">
                    <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-[#64748B]">{f.desc}</p>
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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#ffffff]">Why RADAR</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Us vs. <span className="text-glow">Everyone Else</span></h2>
          </FadeIn>
          <FadeIn>
            <div className="glow-card p-1 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-white/10">
                  <th className="p-4 font-semibold text-[#64748B]">Feature</th>
                  <th className="p-4 font-bold text-[#00FFD4]">RADAR</th>
                  <th className="p-4 font-semibold text-[#64748B]">LinkedIn</th>
                  <th className="p-4 font-semibold text-[#64748B]">Naukri</th>
                </tr></thead>
                <tbody>
                  {[
                    ['AI Resume Match', {i:'check',t:' 384D'}, {i:'cross'}, {i:'cross'}],
                    ['Direct ATS Data', {i:'check'}, {i:'cross'}, {i:'cross'}],
                    ['Hourly Scan', {i:'check'}, {i:'cross'}, {i:'cross'}],
                    ['Fresher-First', {i:'check'}, {i:'cross'}, {i:'warn'}],
                    ['Location Sort', {i:'check'}, {i:'warn'}, {i:'warn'}],
                    ['Free to Start', {i:'check',t:' 3 Searches'}, {i:'check'}, {i:'check'}],
                    ['Mini-Games', {i:'check'}, {i:'cross'}, {i:'cross'}],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="p-4 font-medium text-white">{row[0] as string}</td>
                      {(row.slice(1) as {i:string, t?:string}[]).map((cell, j) => {
                        const Icon = IconMap[cell.i];
                        return (
                          <td key={j} className="p-4">
                            <div className="flex items-center gap-1.5">
                              <Icon />
                              {cell.t && <span className={j === 0 ? "font-semibold text-[#00FFD4]" : "text-[#64748B]"}>{cell.t}</span>}
                            </div>
                          </td>
                        );
                      })}
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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#00FFD4]">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-black text-white">Start free. <span className="text-glow">Upgrade when ready.</span></h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <FadeIn><div className="glow-card p-8">
              <div className="relative z-10">
                <div className="text-sm font-bold uppercase tracking-widest mb-2 text-[#475569]">Free</div>
                <div className="text-4xl font-black text-white mb-1">₹0</div>
                <div className="text-xs mb-6 text-[#475569]">3 searches included</div>
                <ul className="space-y-3 mb-8">
                  {['All 3 job sections', '5 companies per section', '3 total searches', 'AI match scoring', '2 mini-games while loading'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[#94A3B8]">
                      <div className="w-5 h-5 flex items-center justify-center bg-white/5 rounded-full"><CheckIcon /></div>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block w-full py-3.5 text-center text-sm font-semibold rounded-xl transition-all hover:bg-white/5 border border-white/10 text-[#94A3B8]">Try Free</Link>
              </div>
            </div></FadeIn>
            <FadeIn delay={0.15}><div className="glow-card p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.05] bg-gradient-to-br from-[#00FFD4] to-transparent" />
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl bg-[#00FFD4]/10" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold uppercase tracking-widest text-[#00FFD4]">Pro</span>
                  <span className="badge badge-pro text-[10px]">Popular</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-black text-white">₹249</span><span className="text-sm text-[#475569]">/week</span></div>
                <div className="text-xs mb-6 text-[#475569]">UPI & PayPal accepted</div>
                <ul className="space-y-3 mb-8">
                  {['50+ dream companies', 'Unlimited scanning', 'All sections unlimited', 'AI match + reasoning', 'Priority alerts', '4 premium mini-games'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <div className="w-5 h-5 flex items-center justify-center bg-[#00FFD4]/10 rounded-full"><CheckIcon /></div>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="btn-neon block w-full py-3.5 text-center text-sm">Get Pro Access</Link>
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
            { q: 'Is RADAR really free?', a: 'Yes. 3 searches, all 3 sections, AI matching — completely free. No credit card.' },
            { q: 'Where do the jobs come from?', a: 'Directly from company career pages via Greenhouse, Lever, and Ashby APIs. Real listings from the source.' },
            { q: 'How is this different from LinkedIn?', a: 'We don\'t show ads. We don\'t show irrelevant jobs. We scrape hourly, match with AI embeddings, and rank by YOUR skills.' },
            { q: 'Is this for freshers only?', a: 'Primarily built for Indian freshers, but anyone can use it. Location sorting works globally.' },
            { q: 'How do I pay for Pro?', a: 'UPI (scan QR) for India, PayPal for international. ₹249/week. Cancel anytime.' },
            { q: 'What are the mini-games?', a: 'While your RADAR scans for jobs, play Reaction Test, Memory Match (free) or Snake, Word Scramble (pro). Time flies.' },
          ].map((faq, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <details className="glow-card-hover mb-3 group">
                <summary className="p-5 cursor-pointer text-sm font-semibold text-white flex items-center justify-between relative z-10">
                  {faq.q}
                  <span className="text-[#00FFD4] text-lg transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed relative z-10 text-[#94A3B8]">{faq.a}</div>
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
          <p className="text-lg mb-10 max-w-xl mx-auto text-[#475569]">Join freshers who let AI find their next role — automatically, hourly, relentlessly.</p>
          <Link href="/sign-up" className="btn-neon inline-flex items-center gap-3 px-12 py-5 text-lg">
            Launch Your RADAR
          </Link>
        </div>
      </FadeIn>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 py-10 px-6 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Image src="/logo.png" alt="RADAR" width={24} height={24} className="rounded-lg" />
          <span className="text-sm font-bold">RADAR</span>
        </div>
        <p className="text-[11px] text-[#334155]">© 2026 RADAR. AI Job Intelligence Engine. Built with obsession, powered by zero patience for bad job searches.</p>
      </footer>
    </main>
  );
}
