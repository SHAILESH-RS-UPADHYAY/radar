'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

/** Smooth wheel scrolling for the page it is mounted on. Renders nothing, so it never blocks SSR of the content. */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: true,
    });
    return () => lenis.destroy();
  }, []);

  return null;
}
