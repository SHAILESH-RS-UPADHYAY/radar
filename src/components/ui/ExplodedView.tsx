'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { n: '01', title: 'Tell Us Your Dream', desc: "Upload your resume, pick dream companies from 50+ firms, set your location. That's it.", accent: '#A67B5B' },
  { n: '02', title: 'AI Scans Everything', desc: 'Our engine hits ATS APIs every hour. AI embeddings match jobs to YOUR profile — not keywords, real understanding.', accent: '#1C1917' },
  { n: '03', title: 'Apply Before Anyone', desc: 'Ranked matches across Dream Companies, AI Picks, and Startup Gems. Expiry alerts. One-click apply.', accent: '#78716C' },
];

export default function ExplodedView() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      // Heading words reveal
      if (headingRef.current) {
        const words = headingRef.current.querySelectorAll('.word');
        gsap.fromTo(words, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: headingRef.current, start: 'top 80%', end: 'top 40%', scrub: 1 }
        });
      }

      // Parallax bg text
      if (bgTextRef.current) {
        gsap.to(bgTextRef.current, {
          y: -120, ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }

      // Pin the section and animate cards sequentially
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 10%',
          end: '+=200%',
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            // Update progress dots
            if (progressRef.current) {
              const dots = progressRef.current.querySelectorAll('.dot');
              const p = self.progress;
              dots.forEach((dot, i) => {
                const active = p > i * 0.3 && p < (i + 1) * 0.35;
                (dot as HTMLElement).style.background = active ? '#A67B5B' : '#E7E5E4';
                (dot as HTMLElement).style.transform = active ? 'scale(1.5)' : 'scale(1)';
              });
            }
          }
        }
      });

      // Card 1: fly in from left
      tl.fromTo(cardsRef.current[0], { x: -400, opacity: 0, rotateY: 15 }, { x: 0, opacity: 1, rotateY: 0, duration: 1, ease: 'power3.out' }, 0);
      tl.to(cardsRef.current[0], { x: 0, scale: 1, duration: 0.5 }, 0.8);
      // Card 1 hold then fade
      tl.to(cardsRef.current[0], { opacity: 0.15, scale: 0.9, y: -20, duration: 0.5 }, 1.5);

      // Card 2: fly in from right
      tl.fromTo(cardsRef.current[1], { x: 400, opacity: 0, rotateY: -15 }, { x: 0, opacity: 1, rotateY: 0, duration: 1, ease: 'power3.out' }, 1.2);
      tl.to(cardsRef.current[1], { opacity: 0.15, scale: 0.9, y: -20, duration: 0.5 }, 2.5);

      // Card 3: scale up from center
      tl.fromTo(cardsRef.current[2], { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: 'power3.out' }, 2.2);
      tl.to(cardsRef.current[2], { opacity: 0.15, scale: 0.9, y: -20, duration: 0.3 }, 3.2);

      // Final: all 3 snap into grid
      tl.to(cardsRef.current[0], { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 3.5);
      tl.to(cardsRef.current[1], { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 3.6);
      tl.to(cardsRef.current[2], { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 3.7);

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="relative py-24 px-6 overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Brutalist bg text */}
      <div ref={bgTextRef} className="absolute top-[-5%] right-[-5%] text-[22vw] font-black font-display leading-none pointer-events-none select-none" style={{ color: 'rgba(28,25,23,0.025)', whiteSpace: 'nowrap' }}>RADAR</div>

      {/* Progress dots (fixed on left during pin) */}
      <div ref={progressRef} className="absolute left-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        {[0,1,2].map(i => <div key={i} className="dot w-2.5 h-2.5 rounded-full transition-all duration-300" style={{ background: '#E7E5E4' }} />)}
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="section-label justify-center mb-6">How It Works</div>
          <h2 ref={headingRef} className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-display leading-tight" style={{ color: '#1C1917' }}>
            <span className="word inline-block">Three </span>
            <span className="word inline-block">steps </span>
            <span className="word inline-block">to </span>
            <span className="word inline-block">your </span>
            <span className="word inline-block text-warm-gradient">dream </span>
            <span className="word inline-block text-warm-gradient">job</span>
          </h2>
          <p className="text-base max-w-lg mx-auto mt-5" style={{ color: '#A8A29E' }}>No more scrolling. No more ghosting. RADAR does the hunting.</p>
        </div>

        {/* Cards grid — positioned for GSAP to animate */}
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={i} ref={el => { cardsRef.current[i] = el; }} className="card-premium p-8" style={{ opacity: 0 }}>
              <div className="flex items-start justify-between mb-6">
                <span className="text-6xl font-black font-display tracking-display" style={{ color: step.accent, opacity: 0.12 }}>{step.n}</span>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: step.accent }} />
              </div>
              <h3 className="text-xl font-bold font-display tracking-display mb-3" style={{ color: '#1C1917' }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#78716C' }}>{step.desc}</p>
              <div className="mt-6 h-px rounded-full" style={{ background: `linear-gradient(90deg, ${step.accent}, transparent)` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
