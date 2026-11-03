'use client';

import { MotionConfig, motion } from 'framer-motion';
import type { ResumeAudit } from '@/types';
import { CountUp } from '@/components/hud/CountUp';

/** AUDIT://RESUME — the rule checks on your resume, worst first, each with what to change. */
export function ResumeAuditView({ audit }: { audit: ResumeAudit }) {
  const tone = audit.score >= 80 ? 'text-phosphor' : audit.score >= 60 ? 'text-hud-amber' : 'text-hud-red';
  const checks = [...audit.checks].sort((a, b) => Number(a.ok) - Number(b.ok));
  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-4 border border-phosphor/25 bg-black/50 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3 font-mono text-[10px] tracking-[0.3em]">
          <span className="text-phosphor/80">AUDIT://RESUME · WHAT A RECRUITER AND AN ATS SEE</span>
          <span className={'text-xl font-bold tracking-normal ' + tone}>
            <CountUp value={audit.score} suffix="/100" />
          </span>
        </div>
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {checks.map((c, i) => (
            <motion.li
              key={c.label}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="text-[12px] leading-relaxed"
            >
              <p className={'font-mono font-bold ' + (c.ok ? 'text-phosphor' : 'text-hud-amber')}>
                {c.ok ? '✓' : '✕'} {c.label}
              </p>
              <p className="text-dim">{c.detail}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </MotionConfig>
  );
}
