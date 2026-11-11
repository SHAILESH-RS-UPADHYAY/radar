'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import {
  Architects_Daughter,
  Baloo_2,
  Bangers,
  Caveat,
  Chakra_Petch,
  Comic_Neue,
  Cormorant_Garamond,
  DM_Sans,
  Fredoka,
  Gaegu,
  Jost,
  Lora,
  M_PLUS_Rounded_1c,
  Mochiy_Pop_One,
  Newsreader,
  Nunito,
  Patrick_Hand,
  Pixelify_Sans,
  Playfair_Display,
  Quicksand,
  Zen_Maru_Gothic,
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
const dmsans = DM_Sans({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-dmsans' });
const lora = Lora({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-lora',
});
const caveat = Caveat({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-caveat' });
const nunito = Nunito({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-nunito' });
const chakra = Chakra_Petch({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra',
});
const comic = Comic_Neue({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-comic',
});
const bangers = Bangers({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: '400',
  variable: '--font-bangers',
});
const zenmaru = Zen_Maru_Gothic({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['400', '500', '700', '900'],
  variable: '--font-zenmaru',
});
const gaegu = Gaegu({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-gaegu',
});
const fredoka = Fredoka({ subsets: ['latin'], preload: false, display: 'swap', variable: '--font-fredoka' });
const mochiy = Mochiy_Pop_One({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: '400',
  variable: '--font-mochiy',
});
const patrick = Patrick_Hand({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: '400',
  variable: '--font-patrick',
});
const mplus = M_PLUS_Rounded_1c({
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  weight: ['400', '500', '700', '800'],
  variable: '--font-mplus',
});
const FONT_VARS = [
  newsreader,
  playfair,
  quicksand,
  cormorant,
  jost,
  architect,
  pixelify,
  baloo,
  dmsans,
  lora,
  caveat,
  nunito,
  chakra,
  comic,
  bangers,
  zenmaru,
  gaegu,
  fredoka,
  mochiy,
  patrick,
  mplus,
].map((f) => f.variable);

/**
 * Wraps every page (root layout): puts your look on <html> and keeps it in step with the picker and other tabs.
 * The font variables go on <html> too, because modals render outside this tree.
 */
export function LookRoot({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(...FONT_VARS);
    const sync = () => applyLook(readLook());
    sync();
    const off = onLookChange(sync);
    return off;
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LOOK_BOOT }} />
      {children}
    </>
  );
}
