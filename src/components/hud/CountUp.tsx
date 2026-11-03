'use client';

import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

/** A number that counts up from 0 the first time it scrolls into view (shown at once with reduced motion). */
export function CountUp({ value, suffix = '', className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !seen) return;
    if (reduce) {
      el.textContent = value + suffix;
      return;
    }
    const run = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = Math.round(v) + suffix),
    });
    return () => run.stop();
  }, [seen, value, suffix, reduce]);
  return (
    <span ref={ref} className={className} aria-label={value + suffix}>
      {reduce ? value + suffix : '0' + suffix}
    </span>
  );
}
