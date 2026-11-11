// ============================
// RADAR — Looks: the skins of the signed-in app
// ============================
// RADAR (phosphor on black) is the product's own look and the default; it is never restyled. Every other look is a set
// of CSS variables and a few rules in src/app/looks.css, switched by `data-look` on <html> (and `data-mode="light"` for
// RADAR · DAYLIGHT). The choice is kept in this browser. The public site and the sign-in pages always stay RADAR.

export interface Look {
  id: string;
  /** RADAR only: its light mode is a second entry in the picker. */
  mode?: 'light';
  name: string;
  line: string;
  /** The picker's thumbnail: page, card, accent, ink. */
  swatch: [string, string, string, string];
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
  },
  {
    id: 'bloom',
    name: 'BLOOM',
    line: 'A garden in spring: blush, petals, soft corners.',
    swatch: ['#fff4f7', '#ffffff', '#c2336d', '#4a2a3f'],
  },
  {
    id: 'aurora',
    name: 'AURORA',
    line: 'Night glass under the northern lights.',
    swatch: ['#060a18', '#131b3a', '#5eead4', '#dbe4ff'],
  },
  {
    id: 'atelier',
    name: 'ATELIER',
    line: 'A fashion house after hours: black and gold.',
    swatch: ['#0d0c0a', '#151310', '#d4af6a', '#ece4d2'],
  },
  {
    id: 'blueprint',
    name: 'BLUEPRINT',
    line: "An architect's drawing table.",
    swatch: ['#0a2a5c', '#0c3068', '#d5e9ff', '#dcecff'],
  },
  {
    id: 'arcade',
    name: 'ARCADE',
    line: 'Insert coin. Eight bits, hard shadows.',
    swatch: ['#120824', '#1c0f33', '#ffe14d', '#f3e9ff'],
  },
  {
    id: 'clay',
    name: 'CLAY',
    line: 'Soft, round and pressable.',
    swatch: ['#e9edf7', '#f4f6fc', '#5350d6', '#2b2f4a'],
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
