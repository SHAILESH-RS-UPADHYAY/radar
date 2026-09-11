'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { motion, useMotionValue, useTransform } from 'framer-motion';

/** Selectable card with a subtle 3D tilt that follows the cursor. */
export function TiltCard({ children, className, style, onClick, active }: any) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);

  function handleMouse(event: any) {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left - rect.width / 2);
    y.set(event.clientY - rect.top - rect.height / 2);
  }

  return (
    <motion.button
      onClick={onClick}
      onMouseMove={handleMouse}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ rotateX, rotateY, ...style }}
      className={`relative transform-gpu ${className} ${active ? 'ring-2 ring-[#00FF41]' : ''}`}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.button>
  );
}
