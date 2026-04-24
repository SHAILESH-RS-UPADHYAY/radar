'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const STEPS = [
  { n: '01', title: 'Tell Us Your Dream', desc: "Upload resume. Pick dream companies from 50+ firms. Set location. That's it.", accent: '#00FFD4' },
  { n: '02', title: 'AI Scans Everything', desc: 'Our engine hits ATS APIs every hour. AI embeddings match jobs to YOUR profile — not keywords, understanding.', accent: '#8B5CF6' },
  { n: '03', title: 'Apply Before Anyone', desc: 'Get ranked matches across Dream Companies, AI Picks, and Startup Gems. Posted date. Expiry alerts. One-click apply.', accent: '#FF3D71' },
];

// Explode offsets for each card — where they scatter to mid-scroll
const EXPLODE = [
  { x: -320, y: -180, rotate: -18 },
  { x: 0,    y: -240, rotate: 8  },
  { x: 320,  y: -160, rotate: 15 },
];

function ExplodedCard({ step, explode, scrollY }: {
  step: typeof STEPS[0];
  explode: typeof EXPLODE[0];
  scrollY: any;
}) {
  // scrollY: 0 = section enters, 1 = section leaves
  // 0.0-0.25  → card starts centered/hidden  (opacity 0→1)
  // 0.25-0.45 → explodes outward
  // 0.45-0.65 → floats at exploded position
  // 0.65-0.9  → flies back and locks in grid
  const x = useSpring(useTransform(scrollY,
    [0.05, 0.35, 0.55, 0.80],
    [0, explode.x, explode.x, 0]
  ), { stiffness: 80, damping: 20 });

  const y = useSpring(useTransform(scrollY,
    [0.05, 0.35, 0.55, 0.80],
    [60, explode.y, explode.y, 0]
  ), { stiffness: 80, damping: 20 });

  const rotate = useSpring(useTransform(scrollY,
    [0.05, 0.35, 0.55, 0.80],
    [0, explode.rotate, explode.rotate, 0]
  ), { stiffness: 100, damping: 22 });

  const scale = useSpring(useTransform(scrollY,
    [0.05, 0.25, 0.55, 0.75, 0.90],
    [0.7, 1.08, 1.05, 1.02, 1]
  ), { stiffness: 90, damping: 20 });

  const opacity = useTransform(scrollY, [0.03, 0.15, 0.85, 0.98], [0, 1, 1, 0]);

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity }}
      className="glow-card-explode p-8 h-full"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <span className="text-6xl font-black" style={{ color: step.accent, opacity: 0.15, lineHeight: 1 }}>{step.n}</span>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: step.accent, boxShadow: `0 0 8px ${step.accent}` }} />
        </div>
        <h3 className="text-xl font-black text-white mb-3 leading-tight">{step.title}</h3>
        <p className="text-sm leading-relaxed text-[#94A3B8]">{step.desc}</p>
        <div className="mt-6 h-px rounded-full" style={{ background: `linear-gradient(90deg, ${step.accent}, transparent)` }} />
      </div>
    </motion.div>
  );
}

export default function ExplodedView() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  return (
    <section ref={sectionRef} id="how" className="relative py-56 z-10 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header — fades in independently */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-32"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block text-[#00FFD4]">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Three steps to your <span className="text-glow">dream job</span>
          </h2>
          <p className="text-base max-w-xl mx-auto text-[#475569]">
            No more scrolling. No more ghosting. RADAR does the hunting.
          </p>
        </motion.div>

        {/* Exploded cards grid — position: relative so transform is from grid slot */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {STEPS.map((step, i) => (
            <ExplodedCard key={i} step={step} explode={EXPLODE[i]} scrollY={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}
