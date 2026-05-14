'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const EarthHeroScene = dynamic(() => import('@/components/3d/EarthHeroScene'), { ssr: false });
const CursorSparkle = dynamic(() => import('@/components/ui/CursorSparkle'), { ssr: false });
const SmoothScroll = dynamic(() => import('@/components/providers/SmoothScroll'), { ssr: false });

const Chk = () => (
  <svg className="w-4 h-4 shrink-0" style={{ color: '#A67B5B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const Crs = () => (
  <svg className="w-4 h-4 shrink-0" style={{ color: '#555' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const Wrn = () => (
  <svg className="w-4 h-4 shrink-0" style={{ color: '#888' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const IM: Record<string, React.FC> = { check: Chk, cross: Crs, warn: Wrn };

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let v = 0;
      const step = Math.ceil(target / 50);
      const t = setInterval(() => {
        v += step;
        if (v >= target) { setN(target); clearInterval(t); } else setN(v);
      }, 25);
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
  "We don't find jobs. We intercept them before they go viral.",
];

const FEATURES = [
  { letter: 'A', title: 'DREAM COMPANY TRACKING', desc: 'Select from 50+ top companies. Get matched the instant they post a role — before LinkedIn, before Naukri, before anyone.', status: 'ACTIVE', statusColor: '#10B981' },
  { letter: 'B', title: 'AI SEMANTIC MATCHING', desc: '384-dimension sentence embeddings analyze your resume against every JD. Not keywords — real understanding of your skills.', status: 'OPTIMAL', statusColor: '#F59E0B' },
  { letter: 'C', title: 'AUTOMATED HOURLY SCRAPE', desc: 'Greenhouse, Lever, Ashby APIs scraped every 60 minutes. Zero manual effort. Jobs flow to you automatically.', status: 'READY', statusColor: '#A67B5B' },
];

const STATS = [
  { value: 50, suffix: '+', label: 'Companies Tracked' },
  { value: 5000, suffix: '+', label: 'Jobs Scanned Daily' },
  { value: 384, suffix: 'D', label: 'AI Embedding Dims' },
  { value: 24, suffix: '/7', label: 'Always Scanning' },
];

const COMPARISON = [
  ['AI Resume Match', { i: 'check', t: ' 384D' }, { i: 'cross' }, { i: 'cross' }],
  ['Direct ATS Data', { i: 'check' }, { i: 'cross' }, { i: 'cross' }],
  ['Hourly Scan', { i: 'check' }, { i: 'cross' }, { i: 'cross' }],
  ['Fresher-First', { i: 'check' }, { i: 'cross' }, { i: 'warn' }],
  ['Location Sort', { i: 'check' }, { i: 'warn' }, { i: 'warn' }],
  ['Free to Start', { i: 'check', t: ' 3 Searches' }, { i: 'check' }, { i: 'check' }],
];

const FAQ = [
  { q: 'Is RADAR really free?', a: 'Yes. 3 searches, all sections, AI matching. No credit card.' },
  { q: 'Where do jobs come from?', a: 'Directly from company career pages via Greenhouse, Lever, and Ashby public APIs.' },
  { q: 'How is this different from LinkedIn?', a: 'We scrape hourly, match with AI embeddings, and rank by YOUR specific skills.' },
  { q: 'Is this for freshers only?', a: 'Primarily Indian freshers and recent graduates, but anyone can use RADAR.' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [scrollP, setScrollP] = useState(0);
  const cardsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 50);
      setScrollP(window.scrollY / (document.body.scrollHeight - window.innerHeight));
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (cardsRef.current) {
      gsap.fromTo(cardsRef.current.querySelectorAll('.feature-card'), { opacity: 0, y: 40 },
        { opacity: 1, y: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out',
          scrollTrigger: { trigger: cardsRef.current, start: 'top 75%' } });
    }
    if (statsRef.current) {
      gsap.fromTo(statsRef.current.querySelectorAll('.stat-item'), { opacity: 0, y: 30 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: statsRef.current, start: 'top 80%' } });
    }
    if (tableRef.current) {
      gsap.fromTo(tableRef.current.querySelectorAll('tr'), { opacity: 0, x: 30 },
        { opacity: 1, x: 0, stagger: 0.08, duration: 0.4, ease: 'power2.out',
          scrollTrigger: { trigger: tableRef.current, start: 'top 75%' } });
    }
  }, []);

  const scrollVal = 'scaleX(' + scrollP + ')';

  return (
    <SmoothScroll>
    <main className="relative min-h-screen" style={{ background: '#0A0A0A' }}>
      <CursorSparkle />
      <div className="scroll-progress" style={{ transform: 'scaleX(' + scrollP + ')' }} />

      {/* 1. NAVBAR */}
      <nav className={'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ' + (scrolled ? 'glass-nav-dark py-3' : 'py-5')} style={{ background: scrolled ? undefined : 'transparent' }}>
        <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: '#A67B5B' }}>
              <span className="text-white text-xs font-black font-display">R</span>
            </div>
            <span className="text-lg font-black font-display tracking-display text-white">RADAR<span style={{ color: '#A67B5B' }}>.CORE</span></span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a href="#how-it-works" className="text-xs font-semibold uppercase tracking-label transition-opacity hover:opacity-60" style={{ color: '#888' }}>SYSTEMS</a>
            <a href="#features" className="text-xs font-semibold uppercase tracking-label transition-opacity hover:opacity-60" style={{ color: '#888' }}>PROTOCOL</a>
            <a href="#pricing" className="text-xs font-semibold uppercase tracking-label transition-opacity hover:opacity-60" style={{ color: '#888' }}>ARCHITECTURE</a>
          </div>
          <div className="flex items-center gap-3">
            <SignedIn>
              <Link href="/dashboard" className="text-sm font-bold uppercase tracking-label transition-opacity hover:opacity-80" style={{ color: '#A67B5B' }}>Dashboard</Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 rounded-md border border-[#2A2A2A]" } }} />
            </SignedIn>
            <SignedOut>
              <Link href="/sign-in" className="text-sm font-medium transition-opacity hover:opacity-60" style={{ color: '#888' }}>Sign In</Link>
              <Link href="/sign-up" className="btn-outline-dark text-xs px-5 py-2" style={{ borderColor: '#EF4444', color: '#EF4444' }}>LOGIN TERMINAL</Link>
            </SignedOut>
          </div>
        </div>
      </nav>

      {/* 2. HERO */}
      <section className="relative" style={{ minHeight: '100vh' }}>
        <EarthHeroScene>
          <div className="flex flex-col items-center w-full px-6 text-center" style={{ minHeight: '100vh', paddingTop: '42vh', paddingBottom: '4rem' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
              <div className="dashed-box-dark inline-flex items-center gap-3 mb-8">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                <span className="text-xs font-bold uppercase tracking-label" style={{ color: '#A67B5B' }}>Live — Scanning 50+ Companies Worldwide</span>
              </div>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.45 }}
              className="text-4xl sm:text-6xl md:text-[4.5rem] lg:text-[5.5rem] font-black font-display tracking-display leading-[0.9] mb-6 max-w-4xl"
            >
              <span className="text-white">THE FRAMEWORK{'\n'}FOR FUTURE </span>
              <span className="text-warm-gradient">CAREER.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.65 }}
              className="text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: '#888' }}
            >
              AI-powered job intelligence engine. 384-dimension embeddings. Hourly scraping. Before LinkedIn. Before Naukri. Before anyone.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Link href="/sign-up" className="btn-primary-dark px-10 py-4">REQUEST ACCESS NOW</Link>
              <a href="#how-it-works" className="btn-outline-dark px-8 py-4 text-sm">See How It Works</a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-10">
              <div className="scroll-indicator-dark mx-auto" />
            </motion.div>
          </div>
        </EarthHeroScene>
      </section>

      {/* 3. CORE MODULES */}
      <section id="how-it-works" className="relative py-28 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display tracking-display heading-underline-dark text-white">
              CORE MODULES
            </h2>
            <p className="text-sm max-w-lg mx-auto mt-10" style={{ color: '#888' }}>
              Three precision-engineered systems working in concert. Each module is a calibrated point of control.
            </p>
          </div>
          <div ref={cardsRef} className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card card-dark p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-6">
                    <span className="text-4xl font-black font-display" style={{ color: f.statusColor }}>{f.letter}</span>
                    <h3 className="text-sm font-bold uppercase tracking-label pt-2 text-white">{f.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-8" style={{ color: '#888' }}>{f.desc}</p>
                </div>
                <div className="flex items-center justify-between pt-6" style={{ borderTop: '1px dashed #2A2A2A' }}>
                  <span className="badge-status-dark" style={{ color: f.statusColor }}>STATUS: {f.status}</span>
                  <button className="btn-ghost-dark">VIEW SCHEMA</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 4. COMPARISON */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="section-label-dark justify-center mb-6">Why RADAR</div>
            <h2 className="text-3xl md:text-4xl font-black font-display tracking-display text-white">
              Us vs. <span className="text-warm-gradient">Everyone Else</span>
            </h2>
          </div>
          <div ref={tableRef} className="card-dark p-1 overflow-hidden">
            <table className="w-full text-sm table-dark">
              <thead>
                <tr className="text-left">
                  <th className="p-4 font-medium" style={{ color: '#555' }}>Feature</th>
                  <th className="p-4 font-bold featured" style={{ color: '#A67B5B' }}>RADAR</th>
                  <th className="p-4 font-medium" style={{ color: '#555' }}>LinkedIn</th>
                  <th className="p-4 font-medium" style={{ color: '#555' }}>Naukri</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="p-4 font-medium text-white">{row[0] as string}</td>
                    {(row.slice(1) as { i: string; t?: string }[]).map((c, j) => {
                      const Icon = IM[c.i];
                      return (
                        <td key={j} className={'p-4 ' + (j === 0 ? 'featured' : '')}>
                          <div className="flex items-center gap-1.5">
                            <Icon />
                            {c.t && <span className="font-semibold text-xs" style={{ color: j === 0 ? '#A67B5B' : '#555' }}>{c.t}</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 5. STATS */}
      <section className="relative py-24 px-6">
        <div ref={statsRef} className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div key={i} className="stat-item text-center p-8 card-dark">
                <div className="text-4xl md:text-5xl font-black font-mono tracking-display mb-2" style={{ color: '#A67B5B' }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-label" style={{ color: '#555' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 6. QUOTES */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatePresence mode="wait">
            <motion.p key={qIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}
              className="text-xl md:text-2xl font-bold font-display tracking-display italic text-white"
            >
              "{QUOTES[qIdx]}"
            </motion.p>
          </AnimatePresence>
          <div className="flex justify-center gap-2.5 mt-8">
            {QUOTES.map((_, i) => (
              <button key={i} onClick={() => setQIdx(i)} className="transition-all duration-300 rounded-full"
                style={{ width: i === qIdx ? 28 : 8, height: 8, background: i === qIdx ? '#A67B5B' : '#2A2A2A' }}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 7. PRICING */}
      <section id="pricing" className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label-dark justify-center mb-6">Pricing</div>
            <h2 className="text-3xl md:text-4xl font-black font-display tracking-display text-white">
              Start free. <span className="text-warm-gradient">Upgrade when ready.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="card-dark p-8 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-label mb-3" style={{ color: '#888' }}>Free</div>
              <div className="text-5xl font-black font-display tracking-display mb-1 text-white">FREE</div>
              <div className="text-xs mb-8" style={{ color: '#555' }}>3 searches included</div>
              <ul className="space-y-3 mb-8 flex-1">
                {['All 3 job sections', '5 companies per section', '3 total searches', 'AI match scoring', '2 mini-games'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#888' }}><Chk />{f}</li>
                ))}
              </ul>
              <Link href="/sign-up" className="btn-outline-dark block w-full py-3.5 text-center text-sm">Try Free</Link>
            </div>
            <div className="card-dark p-8 flex flex-col relative overflow-hidden" style={{ border: '2px solid #A67B5B' }}>
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl glow-pulse" style={{ background: 'rgba(166,123,91,0.08)' }} />
              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-label" style={{ color: '#A67B5B' }}>Pro</span>
                  <span className="badge-pro-dark">Popular</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black font-display tracking-display text-white">PRO</span>
                </div>
                <div className="text-xs mb-8" style={{ color: '#555' }}>UPI & PayPal accepted</div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['50+ dream companies', 'Unlimited scanning', 'All sections unlimited', 'AI match + reasoning', 'Priority alerts', '4 premium mini-games'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-white"><Chk />{f}</li>
                  ))}
                </ul>
                <Link href="/sign-up" className="btn-primary-dark block w-full py-3.5 text-center text-sm">Get Pro Access</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 8. FAQ */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black font-display tracking-display text-white">Frequently Asked</h2>
          </div>
          {FAQ.map((f, i) => (
            <details key={i} className="faq-item-dark group">
              <summary className="py-5 px-2 text-sm font-semibold flex items-center justify-between text-white">
                {f.q}
                <span className="text-xl transition-transform duration-200 group-open:rotate-45" style={{ color: '#A67B5B' }}>+</span>
              </summary>
              <div className="px-2 pb-5 text-sm leading-relaxed" style={{ color: '#888' }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      <div className="divider-dark max-w-[1280px] mx-auto" />

      {/* 9. CTA */}
      <section className="relative py-32 px-6 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[16vw] font-black font-display leading-none pointer-events-none select-none" style={{ color: 'rgba(166,123,91,0.04)' }}>
          INTERCEPT
        </div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-6xl font-black font-display tracking-display mb-6 leading-tight text-white">
            INITIATE SYSTEM<br /><span className="text-warm-gradient">OVERRIDE.</span>
          </h2>
          <p className="text-base mb-10 max-w-lg mx-auto" style={{ color: '#888' }}>
            The future requires infrastructure that doesn't exist yet. Secure your allocation now.
          </p>
          <Link href="/sign-up" className="btn-primary-dark inline-flex items-center gap-3 px-12 py-5 text-base" style={{ borderColor: '#EF4444', background: '#EF4444' }}>
            REQUEST ACCESS NOW
          </Link>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="relative py-12 px-6" style={{ borderTop: '1px solid #2A2A2A' }}>
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#A67B5B' }}>
                <span className="text-white text-[9px] font-black font-display">R</span>
              </div>
              <span className="text-sm font-black font-display text-white">RADAR</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: '#A67B5B' }}>// SECURITY</a>
              <a href="#" className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: '#A67B5B' }}>// TERMS</a>
              <a href="#" className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: '#A67B5B' }}>// DISCONNECT</a>
            </div>
            <p className="text-[11px]" style={{ color: '#555' }}>
              &copy; 2026 RADAR. AI Job Intelligence Engine. | INTERFACE V. 3.1.4
            </p>
          </div>
        </div>
      </footer>
    </main>
    </SmoothScroll>
  );
}



