'use client';

// RADAR brand. The mark is a watch-dial bezel around a radar scope with an "R" monogram:
// the sweep turns, a light orbits the bezel, a scanline rolls through the scope, the R draws
// itself in on load, and the target blip pings exactly when the beam crosses it.
// The wordmark decrypts from noise on load and on hover. All motion is CSS (globals.css, "RADAR logo")
// and stops under prefers-reduced-motion.

import { useEffect, useId, useState } from 'react';

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180;
  const major = i % 5 === 0;
  const r0 = major ? 19.6 : 21.2;
  const r1 = 22.6;
  const p = (r: number) => [24 + r * Math.sin(a), 24 - r * Math.cos(a)].map((v) => v.toFixed(2));
  const [x1, y1] = p(r0);
  const [x2, y2] = p(r1);
  return { x1, y1, x2, y2, major };
});

export function RadarMark({ className = 'h-9 w-9', animated = true }: { className?: string; animated?: boolean }) {
  // useId can contain characters that break url(#id) references, so keep only safe ones.
  const clip = 'radar-clip-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const a = (cls: string) => (animated ? cls : undefined);
  return (
    <svg viewBox="0 0 48 48" fill="none" className={'logo-mark ' + className} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="17.5" />
        </clipPath>
      </defs>

      {/* bezel */}
      {TICKS.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="#00FF41"
          strokeOpacity={t.major ? 0.95 : 0.4}
          strokeWidth={t.major ? 1.1 : 0.6}
        />
      ))}
      <circle
        cx="24"
        cy="24"
        r="23.2"
        stroke="#B6FFC6"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeDasharray="10 136"
        className={a('logo-orbit')}
      />

      {/* scope */}
      <circle cx="24" cy="24" r="17.5" fill="#000401" fillOpacity=".6" stroke="#00FF41" strokeOpacity=".6" />
      <circle cx="24" cy="24" r="12" stroke="#00FF41" strokeOpacity=".3" strokeDasharray="1.2 2.2" />
      <g clipPath={`url(#${clip})`}>
        <g className={a('radar-sweep')}>
          <path d="M24 24V6.5a17.5 17.5 0 0 1 15.155 8.75Z" fill="#00FF41" fillOpacity=".1" />
          <path d="M24 24l8.75-15.155a17.5 17.5 0 0 1 6.405 6.405Z" fill="#00FF41" fillOpacity=".14" />
          <path d="M24 24l13.005-11.71a17.5 17.5 0 0 1 2.15 2.96Z" fill="#00FF41" fillOpacity=".24" />
          <path d="M24 24l15.155-8.75" stroke="#B6FFC6" strokeWidth="1.3" strokeLinecap="round" />
        </g>
        <rect x="6.5" y="6.5" width="35" height="0.7" fill="#B6FFC6" fillOpacity=".45" className={a('logo-scan')} />
      </g>

      {/* target blip: pings as the beam crosses it */}
      <circle cx="35.2" cy="13.4" r="1.3" stroke="#FACC15" strokeWidth=".6" className={a('logo-ping')} />
      <circle cx="35.2" cy="13.4" r="1.3" fill="#FACC15" className={a('logo-blip')} />

      {/* R monogram, with a dark halo so it reads over the sweep */}
      <path
        d="M19.5 33V15H26a4.75 4.75 0 0 1 0 9.5h-6.5m5 0 6 8.5"
        stroke="#000401"
        strokeWidth="4.4"
        strokeLinejoin="miter"
      />
      <path
        d="M19.5 33V15H26a4.75 4.75 0 0 1 0 9.5h-6.5m5 0 6 8.5"
        stroke="#00FF41"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        pathLength={1}
        className={a('logo-draw')}
      />
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
      <RadarMark className={s.mark + ' shrink-0 drop-shadow-[0_0_10px_rgba(0,255,65,0.45)]'} animated={animated} />
      <span className="flex flex-col font-mono leading-none">
        <span className={s.text + ' font-extrabold tracking-[0.3em]'}>
          <span className="bg-[linear-gradient(90deg,#ffffff,#b6ffc6_55%,#00ff41)] bg-clip-text text-transparent">
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
