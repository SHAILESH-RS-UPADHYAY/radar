'use client';

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { LOOKS } from '@/lib/looks';
import { tick, wakeSound } from './dial-sound';
import './briefing.css';

const N = LOOKS.length;
const STEP = 360 / N;
/** Chain teeth between two looks: each whirrs quietly as it passes the pawl. */
const TEETH = 5;
const mod = (n: number) => ((n % N) + N) % N;
const SOUND_KEY = 'radar:dial-sound';
const clock = () => performance.now();
const soundStored = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};
const snap = (a: number) => Math.round(a / STEP) * STEP;

/**
 * A watch crown for looks, and (with `arc`) the big bezel along the bottom of the screen turning with it. Grab either
 * and turn it, or scroll over it: the faster you turn, the faster the looks go by. The look under the notch is worn at
 * once; the dial clicks into every look and whirrs between them like a bike chain. Let go mid-spin and it coasts,
 * slows and settles on a look.
 */
export function LookDial({
  start,
  onLook,
  onTurn,
  arc = false,
}: {
  start: number;
  /** A look to wear: called once the dial rests on it (at once when turning slowly). */
  onLook: (i: number) => void;
  /** Every look that passes the notch, even mid-spin: cheap updates only (a name, a number). */
  onTurn?: (i: number) => void;
  arc?: boolean;
}) {
  const crown = useRef<HTMLDivElement>(null);
  const bezel = useRef<HTMLDivElement>(null);
  const rotors = useRef<(HTMLDivElement | null)[]>([]);
  const angle = useRef(-start * STEP);
  const shown = useRef(start);
  const tooth = useRef(-start * TEETH);
  const lastTick = useRef(0);
  const grab = useRef<{ a: number; samples: [number, number][] } | null>(null);
  const coast = useRef<AnimationPlaybackControls | null>(null);
  const wheelRest = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wear = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [at, setAt] = useState(start);
  // Client-only (opened by a click or loaded with next/dynamic): the stored choice can be read on the first render.
  const [sound, setSound] = useState(soundStored);
  const soundOn = useRef(sound);

  // Moves both rotors without a React render; only a new look under the notch updates state.
  const setAngle = (a: number) => {
    const now = clock();
    angle.current = a;
    for (const r of rotors.current) if (r) r.style.transform = `rotate(${a}deg)`;
    const t = Math.round(a / (STEP / TEETH));
    if (t === tooth.current) return;
    const gap = now - lastTick.current;
    lastTick.current = now;
    tooth.current = t;
    const i = mod(Math.round(-a / STEP));
    const major = i !== shown.current;
    if (soundOn.current) tick(1 - Math.min(1, gap / 120), major);
    if (!major) return;
    shown.current = i;
    setAt(i);
    onTurn?.(i);
    // Restyling the whole page for every look that flies past makes a fast spin stutter: the look is put on only
    // once the dial pauses on it. Turning slowly, that pause comes at every look, so the room changes as you go.
    clearTimeout(wear.current);
    wear.current = setTimeout(() => onLook(i), 110);
    try {
      navigator.vibrate?.(6);
    } catch {}
  };
  const settle = (target: number, duration: number) => {
    coast.current?.stop();
    coast.current = animate(angle.current, target, { duration, ease: [0.15, 0.85, 0.3, 1], onUpdate: setAngle });
  };

  // Scrolling over the dial turns it; how hard you scroll is how fast it turns. It settles on a look when you stop.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    e.preventDefault();
    coast.current?.stop();
    const px =
      (e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 400 : 1) *
      (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX);
    setAngle(angle.current - px * 0.14);
    clearTimeout(wheelRest.current);
    wheelRest.current = setTimeout(() => settle(snap(angle.current), 0.35), 140);
  });
  useEffect(() => {
    const els = [crown.current, bezel.current].filter((x): x is HTMLDivElement => !!x);
    const h = (e: WheelEvent) => onWheel(e);
    for (const el of els) el.addEventListener('wheel', h, { passive: false });
    return () => {
      for (const el of els) el.removeEventListener('wheel', h);
      coast.current?.stop();
      clearTimeout(wheelRest.current);
      clearTimeout(wear.current);
    };
  }, []);

  const pointerAngle = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const down = (e: PointerEvent<HTMLElement>) => {
    wakeSound();
    coast.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { a: pointerAngle(e), samples: [[clock(), angle.current]] };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const g = grab.current;
    if (!g) return;
    const a = pointerAngle(e);
    let d = a - g.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    g.a = a;
    setAngle(angle.current + d);
    g.samples.push([clock(), angle.current]);
    if (g.samples.length > 6) g.samples.shift();
  };
  const up = () => {
    const g = grab.current;
    grab.current = null;
    if (!g) return;
    // Flick speed over the last few moves, in degrees per millisecond: it coasts that far, then settles.
    const [t0, a0] = g.samples[0];
    const dt = clock() - t0;
    const v = dt > 0 && dt < 160 ? (angle.current - a0) / dt : 0;
    const throwBy = Math.max(-1080, Math.min(1080, v * 420));
    settle(snap(angle.current + throwBy), Math.min(2.4, 0.35 + Math.abs(throwBy) / 500));
  };
  const grabProps = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up };

  const turnBy = (looks: number) => {
    wakeSound();
    settle(snap(angle.current) - looks * STEP, 0.32);
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    const d =
      k === 'ArrowRight' || k === 'ArrowUp'
        ? 1
        : k === 'ArrowLeft' || k === 'ArrowDown'
          ? -1
          : k === 'PageUp'
            ? 5
            : k === 'PageDown'
              ? -5
              : 0;
    if (!d) return;
    e.preventDefault();
    turnBy(d);
  };
  const toBead = (i: number) => {
    let d = i - at;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    if (d) turnBy(d);
  };
  const beads = (cls: string) =>
    LOOKS.map((l, i) => {
      const [page, card, accent] = l.swatch;
      return (
        <span key={l.name} className={cls} style={{ transform: `rotate(${i * STEP}deg)` }}>
          <i
            data-on={i === at || undefined}
            onClick={() => toBead(i)}
            style={{ background: page, borderColor: accent, boxShadow: `inset 0 0 0 4px ${card}` }}
          />
        </span>
      );
    });

  return (
    <>
      <div className="bf-crown-wrap">
        {/* Drawn in the worn look's colours; the beads are fixed swatches of every look. */}
        <div
          ref={crown}
          role="slider"
          tabIndex={0}
          aria-label="Look dial. Turn it, scroll over it, or use the arrow keys."
          aria-valuemin={1}
          aria-valuemax={N}
          aria-valuenow={at + 1}
          aria-valuetext={LOOKS[at].name}
          className="bf-crown"
          onKeyDown={onKey}
          {...grabProps}
        >
          <span className="bf-crown-notch" aria-hidden />
          <div
            ref={(el) => {
              rotors.current[0] = el;
            }}
            className="bf-crown-rotor"
            style={{ transform: `rotate(${-start * STEP}deg)` }}
            aria-hidden
          >
            <span className="bf-crown-knurl" />
            <span className="bf-crown-ticks" />
            {beads('bf-crown-bead')}
          </div>
          <div className="bf-crown-cap" aria-hidden>
            <b>{String(at + 1).padStart(2, '0')}</b>
            <small>/ {N}</small>
          </div>
        </div>
        <button
          type="button"
          className="bf-quiet bf-crown-sound"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            soundOn.current = next;
            setSound(next);
            try {
              localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
            } catch {}
          }}
        >
          {sound ? 'Sound on' : 'Sound off'}
        </button>
      </div>

      {arc && (
        // The same dial, grown into a bezel whose top arc rises from the bottom edge. Mouse and touch only:
        // keyboards and screen readers use the crown above, which turns with it.
        <div ref={bezel} className="bf-arc" aria-hidden {...grabProps}>
          <span className="bf-arc-notch" />
          <div
            ref={(el) => {
              rotors.current[1] = el;
            }}
            className="bf-arc-rotor"
            style={{ transform: `rotate(${-start * STEP}deg)` }}
          >
            <span className="bf-arc-ticks" />
            {beads('bf-arc-bead')}
          </div>
        </div>
      )}
    </>
  );
}
