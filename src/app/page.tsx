'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { playSound } from '@/lib/audio';
import { Card } from '@/components/ui/CardSwap';

gsap.registerPlugin(ScrollTrigger);

const TubesHero = dynamic(() => import('@/components/3d/TubesHero'), { ssr: false });
const ExplodedView = dynamic(() => import('@/components/ui/ExplodedView'), { ssr: false });
const CardSwap = dynamic(() => import('@/components/ui/CardSwap'), { ssr: false });
const SmoothScroll = dynamic(() => import('@/components/providers/SmoothScroll'), { ssr: false });

const Chk = () => <svg className="w-4 h-4 shrink-0" style={{color:'#A67B5B'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
const Crs = () => <svg className="w-4 h-4 shrink-0" style={{color:'#D6D3D1'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const Wrn = () => <svg className="w-4 h-4 shrink-0" style={{color:'#A8A29E'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;
const IM: Record<string, React.FC> = { check: Chk, cross: Crs, warn: Wrn };

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [n, setN] = useState(0); const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; obs.disconnect(); let v = 0; const step = Math.ceil(target / 55); const t = setInterval(() => { v += step; if (v >= target) { setN(target); clearInterval(t); } else setN(v); }, 22); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current); return () => obs.disconnect();
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

const CARDS = [
  { title: 'Dream Companies', desc: 'Track 50+ top firms. Get matched the moment they post.', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop' },
  { title: 'AI-Picked Gems', desc: '384-dimension embeddings find roles you never knew existed.', img: 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=600&auto=format&fit=crop' },
  { title: 'Startup Radar', desc: 'Seed-stage startups hiring fast. Be early, be first.', img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=600&auto=format&fit=crop' },
  { title: 'Hourly Scanning', desc: 'Every 60 min. ATS APIs. Before LinkedIn even indexes.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&auto=format&fit=crop' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [scrollP, setScrollP] = useState(0);
  const featRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => { setScrolled(window.scrollY > 50); setScrollP(window.scrollY / (document.body.scrollHeight - window.innerHeight)); };
    window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h);
  }, []);
  useEffect(() => { const t = setInterval(() => setQIdx(i => (i + 1) % QUOTES.length), 5000); return () => clearInterval(t); }, []);

  // GSAP stagger reveals
  useEffect(() => {
    if (featRef.current) {
      gsap.fromTo(featRef.current.querySelectorAll('.feat-item'), { opacity: 0, x: -30 },
        { opacity: 1, x: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: featRef.current, start: 'top 70%' } });
    }
    if (tableRef.current) {
      gsap.fromTo(tableRef.current.querySelectorAll('tr'), { opacity: 0, x: 40 },
        { opacity: 1, x: 0, stagger: 0.08, duration: 0.4, ease: 'power2.out',
          scrollTrigger: { trigger: tableRef.current, start: 'top 70%' } });
    }
  }, []);

  return (
    <SmoothScroll>
    <main className="relative min-h-screen" style={{ background: '#FAF7F5' }}>
      {/* Scroll Progress */}
      <div className="scroll-progress" style={{ transform: `scaleX(${scrollP})` }} />

      {/* NAV */}
      <nav className={'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ' + (scrolled ? 'glass-nav py-3' : 'py-5')} style={{ background: scrolled ? undefined : 'transparent' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="RADAR" width={32} height={32} className="rounded-xl" />
            <span className="text-lg font-black font-display tracking-display" style={{ color: '#1C1917' }}>RADAR</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['How It Works','Features','Pricing'].map(s => (
              <a key={s} href={`#${s.toLowerCase().replace(/ /g,'-')}`} className="text-xs font-semibold uppercase tracking-label hover:opacity-60 transition-opacity" style={{ color: '#78716C' }} onMouseEnter={() => playSound('tick')}>{s}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium hover:opacity-60 transition-opacity" style={{ color: '#78716C' }}>Sign In</Link>
            <Link href="/sign-up" className="btn-primary text-sm px-6 py-2.5"><span>Get Started</span></Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen">
        <TubesHero>
          <div className="flex flex-col items-center justify-center w-full h-full pt-24 pb-16 px-6 text-center pointer-events-none min-h-screen">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
              <div className="section-label justify-center mb-10 pointer-events-auto" style={{ background: 'rgba(250,247,245,0.8)', padding: '8px 20px', borderRadius: '100px', backdropFilter: 'blur(8px)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#A67B5B' }} /> Live — Scanning 50+ Companies
              </div>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.45 }} className="text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[7rem] font-black font-display tracking-display leading-[0.88] mb-7">
              <span style={{ color: '#1C1917' }}>Your career,</span><br />
              <span className="text-warm-gradient">on autopilot.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.65 }} className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: '#A8A29E' }}>
              RADAR scrapes 50+ career pages hourly, matches every job using 384-dimension AI embeddings, and delivers ranked results — before anyone else.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }} className="flex flex-col sm:flex-row items-center gap-4 pointer-events-auto">
              <Link href="/sign-up" className="btn-primary text-base px-10 py-4" onClick={() => playSound('gear')}><span>Start Scanning Free</span></Link>
              <a href="#how-it-works" className="btn-secondary px-8 py-4 text-sm">See How It Works</a>
            </motion.div>
            {/* Scroll indicator */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-16">
              <div className="scroll-indicator mx-auto" />
            </motion.div>
          </div>
        </TubesHero>
      </section>

      {/* STATS */}
      <div className="divider-warm" />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[{ v:50,s:'+',l:'Companies Tracked',c:'#A67B5B' },{ v:5000,s:'+',l:'Jobs Scanned Daily',c:'#1C1917' },{ v:384,s:'D',l:'AI Embedding Dims',c:'#78716C' },{ v:24,s:'/7',l:'Always Scanning',c:'#A67B5B' }].map((s,i) => (
            <div key={i}><div className="text-3xl md:text-4xl font-black font-display tracking-display" style={{ color: s.c }}><Counter target={s.v} suffix={s.s} /></div>
            <div className="text-[10px] font-semibold uppercase tracking-label mt-2" style={{ color: '#A8A29E' }}>{s.l}</div></div>
          ))}
        </div>
      </div>
      <div className="divider-warm" />

      {/* HOW IT WORKS */}
      <ExplodedView />

      {/* FEATURES */}
      <section id="features" className="relative py-28 px-6 overflow-hidden" style={{ background: '#F5F5F4' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="section-label mb-6">Features</div>
            <h2 className="text-4xl md:text-5xl font-black font-display tracking-display mb-5" style={{ color: '#1C1917' }}>Built for <span className="text-warm-gradient">freshers</span> who mean business</h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: '#78716C' }}>Every feature designed with one goal: get you hired faster.</p>
            <div ref={featRef} className="space-y-5">
              {[{t:'Direct ATS Scraping',d:'Greenhouse, Lever, Ashby APIs.'},{t:'384D AI Matching',d:'Semantic embeddings vs every JD.'},{t:'Location Intelligence',d:'Haversine distance. Nearby first.'},{t:'Date & Expiry Alerts',d:'Never miss a closing window.'},{t:'Remote-First Filter',d:'Remote, Hybrid, In-office.'},{t:'Hourly Auto-Scan',d:'New jobs before LinkedIn.'}].map((f,i) => (
                <div key={i} className="feat-item flex items-start gap-3" onMouseEnter={() => playSound('tick')}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(166,123,91,0.1)' }}><Chk /></div>
                  <div><h4 className="text-sm font-bold" style={{ color: '#1C1917' }}>{f.t}</h4><p className="text-xs" style={{ color: '#A8A29E' }}>{f.d}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[420px]">
            <CardSwap width={380} height={280} cardDistance={35} verticalDistance={35} delay={4000} pauseOnHover skewAmount={3}>
              {CARDS.map((c,i) => (
                <Card key={i} className="p-0 overflow-hidden group cursor-pointer">
                  <div className="relative h-full w-full flex flex-col">
                    <div className="flex-1 overflow-hidden"><img src={c.img} alt={c.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,25,23,0.7), transparent)' }} /></div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white"><h3 className="text-lg font-bold font-display mb-1">{c.title}</h3><p className="text-xs opacity-70 leading-relaxed">{c.desc}</p></div>
                  </div>
                </Card>
              ))}
            </CardSwap>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <div className="relative py-20 px-6"><div className="max-w-3xl mx-auto text-center">
        <AnimatePresence mode="wait"><motion.p key={qIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }} className="text-xl md:text-2xl font-bold font-display tracking-display italic" style={{ color: '#1C1917' }}>"{QUOTES[qIdx]}"</motion.p></AnimatePresence>
        <div className="flex justify-center gap-2.5 mt-6">{QUOTES.map((_,i) => (<button key={i} onClick={() => { playSound('tick'); setQIdx(i); }} className="transition-all duration-300 rounded-full" style={{ width: i===qIdx?28:8, height:8, background: i===qIdx?'#A67B5B':'#E7E5E4' }} />))}</div>
      </div></div>

      {/* COMPARISON */}
      <section className="relative py-24 px-6" style={{ background: '#F5F5F4' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14"><div className="section-label justify-center mb-6">Why RADAR</div><h2 className="text-4xl md:text-5xl font-black font-display tracking-display" style={{ color: '#1C1917' }}>Us vs. <span className="text-warm-gradient">Everyone Else</span></h2></div>
          <div ref={tableRef} className="card-premium p-1 overflow-hidden"><table className="w-full text-sm table-premium"><thead><tr className="text-left"><th className="p-4 font-medium" style={{ color: '#A8A29E' }}>Feature</th><th className="p-4 font-bold featured rounded-t-lg" style={{ color: '#A67B5B' }}>RADAR</th><th className="p-4 font-medium" style={{ color: '#A8A29E' }}>LinkedIn</th><th className="p-4 font-medium" style={{ color: '#A8A29E' }}>Naukri</th></tr></thead><tbody>
            {[['AI Resume Match',{i:'check',t:' 384D'},{i:'cross'},{i:'cross'}],['Direct ATS Data',{i:'check'},{i:'cross'},{i:'cross'}],['Hourly Scan',{i:'check'},{i:'cross'},{i:'cross'}],['Fresher-First',{i:'check'},{i:'cross'},{i:'warn'}],['Location Sort',{i:'check'},{i:'warn'},{i:'warn'}],['Free to Start',{i:'check',t:' 3 Searches'},{i:'check'},{i:'check'}],['Mini-Games',{i:'check'},{i:'cross'},{i:'cross'}]].map((row,i) => (
              <tr key={i} className="hover:bg-[#FAF7F5] transition-colors"><td className="p-4 font-medium" style={{ color: '#1C1917' }}>{row[0] as string}</td>
              {(row.slice(1) as {i:string,t?:string}[]).map((c,j) => { const Icon = IM[c.i]; return <td key={j} className={`p-4 ${j===0?'featured':''}`}><div className="flex items-center gap-1.5"><Icon />{c.t && <span className="font-semibold text-xs" style={{ color: j===0?'#A67B5B':'#A8A29E' }}>{c.t}</span>}</div></td>; })}</tr>
            ))}</tbody></table></div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative py-28 px-6"><div className="max-w-4xl mx-auto">
        <div className="text-center mb-16"><div className="section-label justify-center mb-6">Pricing</div><h2 className="text-4xl md:text-5xl font-black font-display tracking-display" style={{ color: '#1C1917' }}>Start free. <span className="text-warm-gradient">Upgrade when ready.</span></h2></div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="card-premium p-8 h-full">
            <div className="text-xs font-bold uppercase tracking-label mb-2" style={{ color: '#A8A29E' }}>Free</div>
            <div className="text-4xl font-black font-display tracking-display mb-1" style={{ color: '#1C1917' }}>₹0</div>
            <div className="text-xs mb-7" style={{ color: '#A8A29E' }}>3 searches included</div>
            <ul className="space-y-3 mb-8">{['All 3 job sections','5 companies per section','3 total searches','AI match scoring','2 mini-games'].map((f,i) => <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#78716C' }}><Chk />{f}</li>)}</ul>
            <Link href="/sign-up" className="btn-secondary block w-full py-3.5 text-center text-sm">Try Free</Link>
          </div>
          <div className="card-premium p-8 h-full relative overflow-hidden" style={{ border: '2px solid #A67B5B' }}>
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(166,123,91,0.08)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold uppercase tracking-label" style={{ color: '#A67B5B' }}>Pro</span><span className="badge-pro">Popular</span></div>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-black font-display tracking-display" style={{ color: '#1C1917' }}>₹249</span><span className="text-xs" style={{ color: '#A8A29E' }}>/week</span></div>
              <div className="text-xs mb-7" style={{ color: '#A8A29E' }}>UPI & PayPal accepted</div>
              <ul className="space-y-3 mb-8">{['50+ dream companies','Unlimited scanning','All sections unlimited','AI match + reasoning','Priority alerts','4 premium mini-games'].map((f,i) => <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#1C1917' }}><Chk />{f}</li>)}</ul>
              <Link href="/sign-up" className="btn-wood block w-full py-3.5 text-center text-sm" onClick={() => playSound('gear')}>Get Pro Access</Link>
            </div>
          </div>
        </div>
      </div></section>

      {/* FAQ */}
      <section className="relative py-24 px-6" style={{ background: '#F5F5F4' }}><div className="max-w-3xl mx-auto">
        <div className="text-center mb-14"><h2 className="text-3xl md:text-4xl font-black font-display tracking-display" style={{ color: '#1C1917' }}>Frequently Asked</h2></div>
        {[{q:'Is RADAR really free?',a:'Yes. 3 searches, all sections, AI matching — free. No credit card.'},{q:'Where do jobs come from?',a:'Directly from career pages via Greenhouse, Lever, Ashby APIs.'},{q:'How is this different from LinkedIn?',a:"We scrape hourly, match with AI embeddings, and rank by YOUR skills."},{q:'Is this for freshers only?',a:'Primarily Indian freshers, but anyone can use it.'},{q:'How do I pay for Pro?',a:'UPI or PayPal. ₹249/week. Cancel anytime.'},{q:'What are the mini-games?',a:'Tic-Tac-Toe, Reaction Test (free) or Snake, Word Scramble (pro).'}].map((f,i) => (
          <details key={i} className="faq-item group"><summary className="py-5 px-2 text-sm font-semibold flex items-center justify-between" style={{ color: '#1C1917' }} onClick={() => playSound('gear')}>{f.q}<span className="text-xl transition-transform duration-200 group-open:rotate-45" style={{ color: '#A67B5B' }}>+</span></summary><div className="px-2 pb-5 text-sm leading-relaxed" style={{ color: '#78716C' }}>{f.a}</div></details>
        ))}
      </div></section>

      {/* CTA */}
      <div className="relative py-32 px-6 text-center overflow-hidden">
        <div className="absolute top-0 right-[-5%] text-[18vw] font-black font-display leading-none pointer-events-none select-none" style={{ color: 'rgba(28,25,23,0.025)' }}>INTERCEPT</div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-6xl font-black font-display tracking-display mb-6 leading-tight" style={{ color: '#1C1917' }}>Stop searching.<br /><span className="text-warm-gradient">Start intercepting.</span></h2>
          <p className="text-base mb-10 max-w-lg mx-auto" style={{ color: '#A8A29E' }}>Join freshers who let AI find their next role — automatically.</p>
          <Link href="/sign-up" className="btn-primary inline-flex items-center gap-3 px-12 py-5 text-lg" onClick={() => playSound('gear')}><span>Launch Your RADAR</span></Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="relative py-10 px-6 text-center" style={{ borderTop: '1px solid #E7E5E4' }}>
        <div className="flex items-center justify-center gap-2.5 mb-3"><Image src="/logo.png" alt="RADAR" width={22} height={22} className="rounded-lg" /><span className="text-sm font-black font-display" style={{ color: '#1C1917' }}>RADAR</span></div>
        <p className="text-[11px]" style={{ color: '#D6D3D1' }}>© 2026 RADAR. AI Job Intelligence Engine.</p>
      </footer>
    </main>
    </SmoothScroll>
  );
}
