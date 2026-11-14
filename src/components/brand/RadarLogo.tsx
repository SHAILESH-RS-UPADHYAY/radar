'use client';

// RADAR brand. The mark is a precision instrument: a steel bezel around a phosphor radar dial with a gold hub.
// The beam turns; a gold job blip pings exactly as the beam crosses it. The wordmark decrypts from noise on load and
// on hover. All motion is CSS (globals.css, "RADAR logo") and stops under prefers-reduced-motion.

import { useEffect, useId, useState } from 'react';

const DIAL = { G: '#00FF41', MINT: '#B6FFC6', GOLD: '#FACC15' };
// The blip sits 38.4° past north; the beam starts at north and turns once in 3.6s, so it crosses at 0.384s.
const CROSS = { animationDelay: '0.384s' };

function RadarMark({ className = 'h-9 w-9', animated = true }: { className?: string; animated?: boolean }) {
  // useId can contain characters that break url(#id) references, so keep only safe ones.
  const id = 'rl' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const a = (cls: string) => (animated ? cls : undefined);
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" className={'logo-mark ' + className} aria-hidden="true">
      <defs>
        <linearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b211e" />
          <stop offset="0.16" stopColor="#7c8883" />
          <stop offset="0.34" stopColor="#161b19" />
          <stop offset="0.52" stopColor="#3b4541" />
          <stop offset="0.7" stopColor="#c4ccc8" />
          <stop offset="0.84" stopColor="#1c2320" />
          <stop offset="1" stopColor="#4d5853" />
        </linearGradient>
        <radialGradient id={id + 'f'} cx="0.45" cy="0.4">
          <stop offset="0" stopColor="#07301a" />
          <stop offset="0.65" stopColor="#03160b" />
          <stop offset="1" stopColor="#010703" />
        </radialGradient>
        <radialGradient id={id + 'g'} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff8d6" />
          <stop offset="0.4" stopColor="#f5c542" />
          <stop offset="1" stopColor="#7a5300" />
        </radialGradient>
        <linearGradient id={id + 'b'} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={DIAL.G} stopOpacity="0.8" />
          <stop offset="1" stopColor={DIAL.G} stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill={`url(#${id}f)`} />
      <circle cx="12" cy="12" r="10.7" stroke={`url(#${id}s)`} strokeWidth="2.4" />
      <circle cx="12" cy="12" r="11.85" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.15" />
      <circle cx="12" cy="12" r="9.5" stroke="#000" strokeOpacity="0.8" strokeWidth="0.2" />
      <path d="M12 0.6V2.2" stroke={DIAL.GOLD} strokeWidth="0.55" transform="rotate(22.5 12 12)" />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d="M12 3.2V4.6"
          stroke={DIAL.MINT}
          strokeOpacity={i % 3 ? 0.55 : 1}
          strokeWidth={i % 3 ? 0.35 : 0.6}
          strokeLinecap="butt"
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="5.2" stroke={DIAL.G} strokeOpacity="0.6" strokeWidth="0.35" />
      <g className={a('radar-sweep')}>
        <path d="M12 12L12 2.5A9.5 9.5 0 0 0 4.22 6.55Q7.6 9.6 12 12Z" fill={`url(#${id}b)`} />
        <path d="M12 12V2.7" stroke={DIAL.MINT} strokeWidth="0.7" />
      </g>
      <circle
        className={a('logo-ping')}
        style={CROSS}
        cx="15.8"
        cy="7.2"
        r="1.1"
        stroke={DIAL.GOLD}
        strokeWidth="0.5"
      />
      <circle className={a('logo-blip')} style={CROSS} cx="15.8" cy="7.2" r="1.1" fill={DIAL.GOLD} />
      <circle cx="12" cy="12" r="1.5" fill={`url(#${id}g)`} stroke="#000" strokeOpacity="0.7" strokeWidth="0.2" />
    </svg>
  );
}

const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFXZ';

/** Text that resolves from random glyphs, left to right. Re-runs whenever `run` changes. */
function useDecrypt(text: string, run: number) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOut(
        text
          .split('')
          .map((ch, i) => (frame > 3 + i * 2 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(''),
      );
      if (frame > 3 + text.length * 2) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [text, run]);
  return out;
}

const SIZES = {
  sm: { mark: 'h-8 w-8', text: 'text-[15px]', tag: 'text-[8px]' },
  md: { mark: 'h-9 w-9', text: 'text-[17px]', tag: 'text-[9px]' },
  lg: { mark: 'h-16 w-16', text: 'text-3xl', tag: 'text-[11px]' },
};

/** Mark + decrypting wordmark. `tagline` adds the descriptor underneath (footer, auth pages). */
export function RadarLogo({
  className = '',
  size = 'md',
  tagline = false,
  animated = true,
}: {
  className?: string;
  size?: keyof typeof SIZES;
  tagline?: boolean;
  animated?: boolean;
}) {
  const [run, setRun] = useState(0);
  const word = useDecrypt('RADAR', run);
  const s = SIZES[size];
  return (
    <span
      className={'group inline-flex items-center gap-3 ' + className}
      onMouseEnter={() => animated && setRun((n) => n + 1)}
    >
      <RadarMark className={s.mark + ' shrink-0 drop-shadow-[0_0_10px_rgb(var(--glow)/0.45)]'} animated={animated} />
      <span className="flex flex-col font-mono leading-none">
        <span className={s.text + ' font-extrabold tracking-[0.3em]'}>
          <span className="bg-[linear-gradient(90deg,var(--color-white),var(--color-phosphor-soft)_55%,var(--color-phosphor))] bg-clip-text text-transparent">
            {word}
          </span>
          <span className="caret-blink text-phosphor">_</span>
        </span>
        <span className="logo-underline mt-1.5 block h-px w-full" aria-hidden="true" />
        {tagline && (
          <span className={s.tag + ' mt-1.5 tracking-[0.32em] text-phosphor/60'}>JOB INTELLIGENCE ENGINE</span>
        )}
      </span>
    </span>
  );
}
