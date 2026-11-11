// ============================
// RADAR — Looks: the skins of the whole product
// ============================
// RADAR (phosphor on black) is the product's own look and the default; it is never restyled. Every other look is a set
// of CSS variables and a few rules in src/app/looks.css, switched by `data-look` on <html> (and `data-mode="light"` for
// RADAR · DAYLIGHT). The choice is kept in this browser. Every page wears it.

export interface Look {
  id: string;
  /** RADAR only: its light mode is a second entry in the picker. */
  mode?: 'light';
  name: string;
  line: string;
  /** The picker's thumbnail: page, card, accent, ink. */
  swatch: [string, string, string, string];
  /** The font variable its name is set in on the home page's look wall. */
  font?: string;
}

export const LOOKS: Look[] = [
  {
    id: 'radar',
    name: 'RADAR',
    line: 'The original. Phosphor on black.',
    swatch: ['#000401', '#04120a', '#00ff41', '#dcffe3'],
  },
  {
    id: 'radar',
    mode: 'light',
    name: 'RADAR · DAYLIGHT',
    line: 'The same console, in daylight.',
    swatch: ['#f3f8f3', '#ffffff', '#007a33', '#10301b'],
  },
  {
    id: 'paper',
    name: 'PAPER',
    line: 'A morning broadsheet: ink, serif, newsprint.',
    swatch: ['#efe7d6', '#f9f3e5', '#1d1a15', '#26221c'],
    font: '--font-playfair',
  },
  {
    id: 'bloom',
    name: 'BLOOM',
    line: 'A garden in spring: blush, petals, soft corners.',
    swatch: ['#fff4f7', '#ffffff', '#c2336d', '#4a2a3f'],
    font: '--font-quicksand',
  },
  {
    id: 'atelier',
    name: 'ATELIER',
    line: 'A fashion house after hours: black and gold.',
    swatch: ['#0d0c0a', '#151310', '#d4af6a', '#ece4d2'],
    font: '--font-cormorant',
  },
  {
    id: 'blueprint',
    name: 'BLUEPRINT',
    line: "An architect's drawing table.",
    swatch: ['#0a2a5c', '#0c3068', '#d5e9ff', '#dcecff'],
    font: '--font-architect',
  },
  {
    id: 'arcade',
    name: 'ARCADE',
    line: 'Insert coin. Eight bits, hard shadows.',
    swatch: ['#120824', '#1c0f33', '#ffe14d', '#f3e9ff'],
    font: '--font-pixelify',
  },
  {
    id: 'clay',
    name: 'CLAY',
    line: 'Soft, round and pressable.',
    swatch: ['#e9edf7', '#f4f6fc', '#5350d6', '#2b2f4a'],
    font: '--font-baloo',
  },
  {
    id: 'moodboard',
    name: 'MOODBOARD',
    line: 'A pinboard: taped photos, a little crooked.',
    swatch: ['#faf6f2', '#ffffff', '#d6002a', '#2b2420'],
    font: '--font-dmsans',
  },
  {
    id: 'cottage',
    name: 'COTTAGE',
    line: 'Gingham, stitching and handwriting.',
    swatch: ['#f4eedd', '#fbf7ea', '#4f6f43', '#34402c'],
    font: '--font-caveat',
  },
  {
    id: 'meadow',
    name: 'MEADOW',
    line: 'A painted summer sky, clouds drifting by.',
    swatch: ['#bfe6ff', '#ffffff', '#1f8a4c', '#1d3f58'],
    font: '--font-nunito',
  },
  {
    id: 'neoncity',
    name: 'NEON CITY',
    line: 'Rain on a neon street at 2 a.m.',
    swatch: ['#0a0420', '#1d1146', '#ff3fd0', '#ece4ff'],
    font: '--font-chakra',
  },
  {
    id: 'manga',
    name: 'MANGA',
    line: 'Ink, screentone and speed lines.',
    swatch: ['#ffffff', '#ffffff', '#111111', '#1a1a1a'],
    font: '--font-bangers',
  },
  {
    id: 'comet',
    name: 'COMET',
    line: 'The hour after sunset, a comet crossing.',
    swatch: ['#1a1c5a', '#2a2c6e', '#ffb38a', '#e9e6ff'],
    font: '--font-zenmaru',
  },
  {
    id: 'lofi',
    name: 'LOFI',
    line: 'A warm lamp, rain on the window.',
    swatch: ['#251c33', '#2f2440', '#ffcf8a', '#efe3f7'],
    font: '--font-gaegu',
  },
  {
    id: 'studio',
    name: 'STUDIO',
    line: 'White, black and hairlines. Nothing extra.',
    swatch: ['#ffffff', '#ffffff', '#0a0a0a', '#171717'],
    font: '--font-inter',
  },
  {
    id: 'cloud',
    name: 'CLOUD',
    line: 'A cool, calm product console in blue.',
    swatch: ['#f6f8fc', '#ffffff', '#1a5fe0', '#1c2b44'],
    font: '--font-dmsans',
  },
  {
    id: 'ivory',
    name: 'IVORY',
    line: 'Ivory paper, navy ink, serif headings.',
    swatch: ['#faf8f3', '#fffefb', '#0f6b4f', '#1a2d48'],
    font: '--font-newsreader',
  },
  {
    id: 'mochi',
    name: 'MOCHI',
    line: 'Strawberry milk, blushing cards, floating hearts.',
    swatch: ['#fff1f4', '#fffafb', '#ef5d8a', '#5a3441'],
    font: '--font-mochiy',
  },
  {
    id: 'sticker',
    name: 'STICKERBOOK',
    line: 'Die-cut stickers that peel when you point.',
    swatch: ['#eee9ff', '#ffffff', '#6b4eff', '#2e2950'],
    font: '--font-patrick',
  },
  {
    id: 'matcha',
    name: 'MATCHA',
    line: 'A slow cafe afternoon, steam rising.',
    swatch: ['#eef0e2', '#fbfbf3', '#5b7f3a', '#33402a'],
    font: '--font-mplus',
  },
  {
    id: 'soda',
    name: 'SODA',
    line: 'A cold can, just opened. Fizz.',
    swatch: ['#c9f1ff', '#ffffff', '#ff4f9a', '#163b58'],
    font: '--font-fredoka',
  },
];

const LOOK_KEY = 'radar:look';
const MODE_KEY = 'radar:mode';
const CHANGED = 'radar:look-changed';
const IDS = new Set(LOOKS.map((l) => l.id));

export interface LookChoice {
  id: string;
  light: boolean;
}

/** The look kept in this browser; RADAR when nothing (or something unknown) is stored. */
export function readLook(): LookChoice {
  try {
    const id = localStorage.getItem(LOOK_KEY) || 'radar';
    return { id: IDS.has(id) ? id : 'radar', light: localStorage.getItem(MODE_KEY) === 'light' };
  } catch {
    return { id: 'radar', light: false }; // storage blocked: the default look
  }
}

/** Put a look on the page. RADAR is the absence of `data-look`, so its styles are exactly the ones it always had. */
export function applyLook({ id, light }: LookChoice, root: HTMLElement = document.documentElement) {
  if (id === 'radar') root.removeAttribute('data-look');
  else root.setAttribute('data-look', id);
  if (id === 'radar' && light) root.setAttribute('data-mode', 'light');
  else root.removeAttribute('data-mode');
}

export function saveLook(choice: LookChoice) {
  try {
    localStorage.setItem(LOOK_KEY, choice.id);
    localStorage.setItem(MODE_KEY, choice.light ? 'light' : 'dark');
  } catch {
    // Storage blocked: the look still applies to this page.
  }
  applyLook(choice);
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * saveLook, with the new look opening as a circle from where you clicked (browsers without view transitions, and
 * people who asked for less motion, get the plain switch).
 */
export function switchLook(choice: LookChoice, x: number, y: number) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return saveLook(choice);
  const root = document.documentElement;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('look-switching');
  const vt = document.startViewTransition(() => saveLook(choice));
  vt.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {});
  vt.finished.finally(() => root.classList.remove('look-switching'));
}

/** Runs before the first paint of an app page, so a chosen look never flashes RADAR first. Mirrors readLook + applyLook. */
export const LOOK_BOOT = `(function(){try{var d=document.documentElement,l=localStorage.getItem('${LOOK_KEY}')||'radar',ok=${JSON.stringify(
  [...IDS],
)};if(ok.indexOf(l)<0)l='radar';if(l!=='radar')d.setAttribute('data-look',l);else if(localStorage.getItem('${MODE_KEY}')==='light')d.setAttribute('data-mode','light')}catch(e){}})()`;

export const onLookChange = (listener: () => void) => {
  window.addEventListener(CHANGED, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener('storage', listener);
  };
};
