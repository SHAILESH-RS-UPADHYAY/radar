'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const STEPS = [
  { n: '01', title: 'Tell Us Your Dream', desc: "Upload your resume, pick dream companies from 50+ firms, set your location preferences. That's it.", accent: '#A67B5B' },
  { n: '02', title: 'AI Scans Everything', desc: 'Our engine hits ATS APIs every hour. AI embeddings match jobs to YOUR profile — not keywords, real understanding.', accent: '#1C1917' },
  { n: '03', title: 'Apply Before Anyone', desc: 'Get ranked matches across Dream Companies, AI Picks, and Startup Gems. Posted date. Expiry alerts. One-click apply.', accent: '#78716C' },
];

const EXPLODE = [
  { x: -280, y: -160, rotate: -12 },
  { x: 0, y: -200, rotate: 6 },
  { x: 280, y: -140, rotate: 10 },
];

function ExplodedCard({ step, explode, scrollY }: { step: typeof STEPS[0]; explode: typeof EXPLODE[0]; scrollY: any }) {
  const x = useSpring(useTransform(scrollY, [0.05,0.35,0.55,0.80], [0, explode.x, explode.x, 0]), { stiffness: 80, damping: 20 });
  const y = useSpring(useTransform(scrollY, [0.05,0.35,0.55,0.80], [50, explode.y, explode.y, 0]), { stiffness: 80, damping: 20 });
  const rotate = useSpring(useTransform(scrollY, [0.05,0.35,0.55,0.80], [0, explode.rotate, explode.rotate, 0]), { stiffness: 100, damping: 22 });
  const scale = useSpring(useTransform(scrollY, [0.05,0.25,0.55,0.75,0.90], [0.8,1.06,1.04,1.01,1]), { stiffness: 90, damping: 20 });
  const opacity = useTransform(scrollY, [0.03,0.15,0.85,0.98], [0,1,1,0]);

  return (
    <motion.div style={{ x, y, rotate, scale, opacity }} className="card-premium p-8 h-full">
      <div className="flex items-start justify-between mb-6">
        <span className="text-6xl font-black font-display tracking-display" style={{ color: step.accent, opacity: 0.12 }}>{step.n}</span>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: step.accent }} />
      </div>
      <h3 className="text-xl font-bold font-display tracking-display mb-3" style={{ color: '#1C1917' }}>{step.title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: '#78716C' }}>{step.desc}</p>
      <div className="mt-6 h-px rounded-full" style={{ background: `linear-gradient(90deg, ${step.accent}, transparent)` }} />
    </motion.div>
  );
}

export default function ExplodedView() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  return (
    <section ref={sectionRef} id="how" className="relative py-48 px-6 overflow-hidden">
      <div className="bg-text-brutalist">RADAR</div>
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }} className="text-center mb-28">
          <div className="section-label justify-center mb-6">How It Works</div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-display mb-5" style={{ color: '#1C1917' }}>
            Three steps to your <span className="text-warm-gradient">dream job</span>
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#A8A29E' }}>No more scrolling. No more ghosting. RADAR does the hunting.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          {STEPS.map((step, i) => (
            <ExplodedCard key={i} step={step} explode={EXPLODE[i]} scrollY={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}
