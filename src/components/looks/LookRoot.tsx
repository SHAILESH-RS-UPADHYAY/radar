'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import {
  Architects_Daughter,
  Baloo_2,
  Cormorant_Garamond,
  Jost,
  Newsreader,
  Pixelify_Sans,
  Playfair_Display,
  Quicksand,
  Sora,
} from 'next/font/google';
import { applyLook, LOOK_BOOT, onLookChange, readLook } from '@/lib/looks';
import '@/app/looks.css';

// One typeface family per look. Not preloaded: a browser fetches a font only when the look that uses it is on.
// next/font needs every option written out as a literal.
const newsreader = Newsreader({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-playfair',
});
const quicksand = Quicksand({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-quicksand' });
const sora = Sora({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-sora' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});
const jost = Jost({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-jost' });
const architect = Architects_Daughter({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: '400',
  variable: '--font-architect',
});
const pixelify = Pixelify_Sans({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-pixelify' });
const baloo = Baloo_2({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-baloo' });
const FONT_VARS = [newsreader, playfair, quicksand, sora, cormorant, jost, architect, pixelify, baloo].map(
  (f) => f.variable,
);

/**
 * Wraps the signed-in app: puts your look on <html> while you are in it and takes it off when you leave, so the
 * public site stays RADAR. The font variables go on <html> too, because modals render outside this tree.
 */
export function LookRoot({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(...FONT_VARS);
    const sync = () => applyLook(readLook());
    sync();
    const off = onLookChange(sync);
    return () => {
      off();
      applyLook({ id: 'radar', light: false });
      root.classList.remove(...FONT_VARS);
    };
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LOOK_BOOT }} />
      {children}
    </>
  );
}
