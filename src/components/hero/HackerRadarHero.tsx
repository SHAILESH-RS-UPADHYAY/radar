'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CATALOG } from '@/lib/scraper/catalog';

// Decorative targets the sweep "acquires".
const TARGETS = [
  'STRIPE',
  'RAZORPAY',
  'NVIDIA',
  'FIGMA',
  'CRED',
  'ADOBE',
  'POSTMAN',
  'LINEAR',
  'NOTION',
  'SARVAM',
  'MEESHO',
  'VERCEL',
  'SALESFORCE',
  'COINBASE',
  'GROWW',
  'CISCO',
  'SUPABASE',
  'AMAZON',
  'INTEL',
  'PAYPAL',
];

const LOG_LINES = [
  ['OK', 'tls handshake boards-api.greenhouse.io'],
  ['GET', '/v1/boards/stripe/jobs → 200 (627)'],
  ['GET', 'api.lever.co/v0/postings/meesho → 200'],
  ['POST', 'nvidia.wd5/wday/cxs/…/jobs → 200'],
  ['OK', 'ashby/linear → 30 postings parsed'],
  ['EMB', 'e5-large batch 50 × 1024d'],
  ['SIM', 'cos(resume, jd#4821) = 0.8612'],
  ['HIT', 'score 87 ≥ 70 → VAULT'],
  ['GET', 'hn.algolia.com/items/49522897'],
  ['OK', 'smartrecruiters/Freshworks 145'],
  ['SHA', 'dedupe → 12 changed / 603 same'],
  ['DEL', 'stale postings closed: 7'],
] as const;

const TAG_COLOR: Record<string, string> = {
  OK: '#00FF41',
  GET: '#4ADE80',
  POST: '#4ADE80',
  EMB: '#22D3EE',
  SIM: '#22D3EE',
  HIT: '#FACC15',
  SHA: '#A3E635',
  DEL: '#F87171',
};

function useMatrixRain(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const chars = 'アイウエオカキクケコサシスセソ01010110ABCDEF0123456789<>/{}[]$#';
    const size = 14;
    let cols: number[] = [];
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      cols = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -60);
    };
    resize();
    window.addEventListener('resize', resize);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setInterval(
      () => {
        ctx.fillStyle = 'rgba(0, 4, 1, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = size + 'px ui-monospace, monospace';
        cols.forEach((y, i) => {
          const ch = chars[(Math.random() * chars.length) | 0];
          ctx.fillStyle = Math.random() > 0.975 ? '#CCFFD8' : 'rgba(0,255,65,0.55)';
          ctx.fillText(ch, i * size, y * size);
          cols[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
        });
      },
      reduce ? 200 : 55,
    );
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', resize);
    };
  }, [ref]);
}

type Band = 'VAULT' | 'OVERCLOCK' | 'NEW';
interface Lock {
  label: string;
  score: number;
  band: Band;
}
interface Contact extends Lock {
  angle: number; // canvas angle: 0 = east, clockwise
  drift: number; // rad/s
  lit: number; // echo after the sweep crosses, 1 → 0
  locked: number; // lock hold, 1 → 0
  lockAge: number; // s since the lock began
  trail: [number, number][];
  trailT: number;
}

const TAU = Math.PI * 2;
const BAND_RGB: Record<Band, string> = { VAULT: '0, 255, 65', OVERCLOCK: '250, 204, 21', NEW: '34, 211, 238' };
const HEX = '0123456789ABCDEF';
const hexByte = () => HEX[(Math.random() * 16) | 0] + HEX[(Math.random() * 16) | 0];
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
// Range = match: the centre is 100%, the rim 50%. New, unscored signals sit out on the rim.
const rangeOf = (c: Pick<Contact, 'band' | 'score'>) => (c.band === 'NEW' ? 0.9 : 0.06 + ((100 - c.score) / 50) * 0.84);
const CIPHER = 96; // cells in the outer cipher ring; every 8th is a bearing label

/**
 * The hero scope. A static layer (rings, match bands, grid, bezel) is painted once per size; each frame adds
 * the sweep and its trail, clutter, the spectrum core, the cipher ring the sweep reads and rewrites, the
 * tracked contacts with their echoes, lock-ons and callouts, and now and then a glitch. Pauses off-screen.
 */
function RadarScope({ onLock }: { onLock: (lock: Lock) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onLockRef = useRef(onLock);
  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const probe = document.createElement('span');
    probe.className = 'font-mono';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily || 'monospace';
    probe.remove();

    const contacts: Contact[] = TARGETS.map((label, i) => {
      const fresh = i % 4 === 3;
      const score = fresh ? 0 : 52 + Math.floor(Math.random() * 47);
      return {
        label,
        score,
        band: fresh ? 'NEW' : score >= 80 ? 'VAULT' : 'OVERCLOCK',
        angle: (i / TARGETS.length) * TAU + Math.random() * 0.25,
        drift: (Math.random() - 0.5) * 0.05,
        lit: 0,
        locked: 0,
        lockAge: 0,
        trail: [],
        trailT: Math.random(),
      };
    });
    const cipher = Array.from({ length: CIPHER }, hexByte);
    const clutter: { x: number; y: number; life: number }[] = [];

    let size = 0;
    let dpr = 1;
    const layer = document.createElement('canvas');
    const paintStatic = () => {
      layer.width = size * dpr;
      layer.height = size * dpr;
      const g = layer.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = size / 2;
      const R = size / 2 - 34;
      const disc = g.createRadialGradient(c, c, 0, c, c, R);
      disc.addColorStop(0, 'rgba(0,255,65,0.07)');
      disc.addColorStop(1, 'rgba(0,255,65,0.012)');
      g.fillStyle = disc;
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.fill();
      // Match rings: 90 / 80 / 70 / 60 / 50 from the centre out. 80 is the Vault bar.
      g.font = `500 8px ${family}`;
      for (const s of [90, 80, 70, 60, 50]) {
        const r = rangeOf({ band: 'VAULT', score: s }) * R;
        const vault = s === 80;
        g.setLineDash(vault ? [4, 4] : s === 50 ? [] : [1, 5]);
        g.strokeStyle = vault ? 'rgba(0,255,65,0.55)' : 'rgba(0,255,65,0.2)';
        g.lineWidth = vault ? 1.2 : 1;
        g.beginPath();
        g.arc(c, c, r, 0, TAU);
        g.stroke();
        g.fillStyle = vault ? 'rgba(0,255,65,0.85)' : 'rgba(0,255,65,0.4)';
        const la = -Math.PI / 4;
        g.fillText(vault ? 'VAULT 80%' : s + '%', c + Math.cos(la) * r + 4, c + Math.sin(la) * r - 3);
      }
      g.setLineDash([]);
      // Spokes every 30°, and a polar dot grid every 10°.
      g.strokeStyle = 'rgba(0,255,65,0.09)';
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * R * 0.06, c + Math.sin(a) * R * 0.06);
        g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,255,65,0.28)';
      for (const s of [90, 80, 70, 60])
        for (let d = 0; d < 360; d += 10) {
          const a = (d * Math.PI) / 180;
          const r = rangeOf({ band: 'VAULT', score: s }) * R;
          g.fillRect(c + Math.cos(a) * r - 0.5, c + Math.sin(a) * r - 0.5, 1, 1);
        }
      // Bezel: a double rim with 2° / 10° / 30° ticks.
      g.strokeStyle = 'rgba(0,255,65,0.6)';
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(0,255,65,0.25)';
      g.beginPath();
      g.arc(c, c, R + 9, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(0,255,65,0.55)';
      g.beginPath();
      for (let d = 0; d < 360; d += 2) {
        const a = (d * Math.PI) / 180;
        const len = d % 30 === 0 ? 9 : d % 10 === 0 ? 6 : 3;
        g.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        g.lineTo(c + Math.cos(a) * (R + len), c + Math.sin(a) * (R + len));
      }
      g.stroke();
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStatic();
    };
    resize();
    window.addEventListener('resize', resize);

    const brackets = (s: number, arm: number) => {
      ctx.beginPath();
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        ctx.moveTo(sx * s, sy * s - sy * arm);
        ctx.lineTo(sx * s, sy * s);
        ctx.lineTo(sx * s - sx * arm, sy * s);
      }
      ctx.stroke();
    };
    const shape = (band: Band, x: number, y: number, r: number) => {
      ctx.beginPath();
      if (band === 'VAULT') ctx.arc(x, y, r, 0, TAU);
      else if (band === 'OVERCLOCK') {
        ctx.moveTo(x, y - r - 1);
        ctx.lineTo(x + r + 1, y);
        ctx.lineTo(x, y + r + 1);
        ctx.lineTo(x - r - 1, y);
      } else {
        ctx.moveTo(x, y - r - 1);
        ctx.lineTo(x + r + 1, y + r);
        ctx.lineTo(x - r - 1, y + r);
      }
      ctx.closePath();
      ctx.fill();
    };

    let sweep = 0;
    let last = performance.now();
    let raf = 0;
    let t = 0;
    let glitchIn = 5;
    let glitchUntil = -1;
    let visible = true;

    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const prev = sweep;
      sweep = (sweep + dt * (reduce ? 0.3 : 1.05)) % TAU;
      const c = size / 2;
      const R = size / 2 - 34;
      const big = size > 360;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(layer, 0, 0, size, size);

      // The sweep: a long fading trail and a bright leading edge.
      const TRAIL = 1.9;
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(sweep - TRAIL, c, c);
        g.addColorStop(0, 'rgba(0,255,65,0)');
        g.addColorStop(TRAIL / TAU, 'rgba(0,255,65,0.32)');
        g.addColorStop(TRAIL / TAU + 0.0005, 'rgba(0,255,65,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, R, sweep - TRAIL, sweep);
        ctx.closePath();
        ctx.fill();
      }
      const ex = c + Math.cos(sweep) * R;
      const ey = c + Math.sin(sweep) * R;
      const edge = ctx.createLinearGradient(c, c, ex, ey);
      edge.addColorStop(0, 'rgba(182,255,198,0.15)');
      edge.addColorStop(1, 'rgba(225,255,232,0.95)');
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00FF41';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Clutter: specks the sweep lights up, which fade behind it.
      if (!reduce)
        for (let i = 0; i < 3; i++) {
          const r = R * (0.08 + Math.random() * 0.9);
          const a = sweep - Math.random() * 0.04;
          clutter.push({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r, life: 0.5 + Math.random() * 0.5 });
        }
      for (let i = clutter.length - 1; i >= 0; i--) {
        const p = clutter[i];
        p.life -= dt * 0.55;
        if (p.life <= 0) {
          clutter.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(0,255,65,${(p.life * 0.45).toFixed(3)})`;
        ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }

      // Spectrum core: bars that breathe, and jump where the sweep passes.
      const r0 = R * 0.12;
      ctx.strokeStyle = 'rgba(34,211,238,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * TAU;
        const v = 0.5 + 0.5 * Math.sin(a * 3 + t * 2.1) * Math.sin(a * 5 - t * 1.3);
        const near = wrap(sweep - a) < 0.35 ? 1 - wrap(sweep - a) / 0.35 : 0;
        const len = R * (0.012 + 0.045 * v * v + 0.05 * near);
        ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * (r0 + len), c + Math.sin(a) * (r0 + len));
      }
      ctx.stroke();

      // Core: counter-rotating arcs and a pulse.
      ctx.strokeStyle = 'rgba(34,211,238,0.6)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a0 = -t * 0.6 + (k * TAU) / 3;
        ctx.beginPath();
        ctx.arc(c, c, R * 0.07, a0, a0 + 1.2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(182,255,198,${(0.6 + 0.4 * Math.sin(t * 4)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(c, c, 2, 0, TAU);
      ctx.fill();

      // Cipher ring: hex bytes the sweep reads and rewrites, with the bearings set into it.
      if (big) {
        const rr = R + 22;
        ctx.font = `500 8px ${family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < CIPHER; i++) {
          const a = (i / CIPHER) * TAU - Math.PI / 2;
          const behind = wrap(sweep - a);
          const bearing = i % 8 === 0;
          if (!bearing && behind < 0.06 && Math.random() < 0.6) cipher[i] = hexByte();
          const glow = behind < 0.7 ? 1 - behind / 0.7 : 0;
          ctx.fillStyle = bearing
            ? `rgba(0,255,65,${(0.75 + 0.25 * glow).toFixed(3)})`
            : `rgba(${glow > 0.5 ? '225,255,232' : '0,255,65'},${(0.14 + 0.8 * glow).toFixed(3)})`;
          ctx.fillText(
            bearing ? String((i / 8) * 30).padStart(3, '0') : cipher[i],
            c + Math.cos(a) * rr,
            c + Math.sin(a) * rr,
          );
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      // Contacts: drifting tracks, echoes when the sweep hits, lock-ons with a callout.
      for (const k of contacts) {
        k.angle = wrap(k.angle + k.drift * dt);
        const r = rangeOf(k) * R;
        const x = c + Math.cos(k.angle) * r;
        const y = c + Math.sin(k.angle) * r;
        k.trailT += dt;
        if (k.trailT > 0.6) {
          k.trailT = 0;
          k.trail.push([x, y]);
          if (k.trail.length > 5) k.trail.shift();
        }
        const crossed = prev < sweep ? k.angle > prev && k.angle <= sweep : k.angle > prev || k.angle <= sweep;
        if (crossed) {
          k.lit = 1;
          if (k.locked < 0.05 && Math.random() < 0.3) {
            k.locked = 1;
            k.lockAge = 0;
            onLockRef.current({ label: k.label, score: k.score, band: k.band });
          }
        }
        k.lit = Math.max(0, k.lit - dt * 0.35);
        if (k.locked > 0) {
          k.locked = Math.max(0, k.locked - dt * 0.22);
          k.lockAge += dt;
        }
        const rgb = BAND_RGB[k.band];
        const vis = Math.max(k.lit, 0.14);
        k.trail.forEach(([tx, ty], j) => {
          ctx.fillStyle = `rgba(${rgb},${((vis * 0.3 * (j + 1)) / k.trail.length).toFixed(3)})`;
          ctx.fillRect(tx - 0.8, ty - 0.8, 1.6, 1.6);
        });
        ctx.fillStyle = `rgba(${rgb},${vis.toFixed(3)})`;
        shape(k.band, x, y, 3);
        if (k.lit > 0.02) {
          ctx.strokeStyle = `rgba(${rgb},${(k.lit * 0.6).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 3 + (1 - k.lit) * 16, 0, TAU);
          ctx.stroke();
        }
        if (k.locked <= 0.02) continue;

        // Acquisition: the brackets turn in from 45° and close on the contact.
        const acq = Math.min(1, k.lockAge / 0.45);
        const e = 1 - Math.pow(1 - acq, 3);
        const a = Math.min(1, k.locked * 1.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((1 - e) * Math.PI) / 4);
        ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        brackets(22 - e * 12, 4);
        ctx.restore();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = `rgba(${rgb},${(a * 0.3).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (!big || acq < 1) continue;

        // Callout: an elbow leader and three typed lines.
        const right = x >= c;
        const sx = right ? 1 : -1;
        const elbowX = x + sx * 22;
        const elbowY = y - 16;
        const endX = elbowX + sx * 14;
        ctx.strokeStyle = `rgba(${rgb},${(a * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x + sx * 7, y - 7);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(endX, elbowY);
        ctx.stroke();
        const bearing = String(Math.round(((k.angle * 180) / Math.PI + 90) % 360)).padStart(3, '0');
        const lines: [string, string, string][] = [
          [k.label, `bold 9px ${family}`, `rgba(${rgb},${a.toFixed(3)})`],
          [
            k.band === 'NEW' ? 'NEW SIGNAL · SCORING' : `MATCH ${k.score}% · ${k.band}`,
            `500 8px ${family}`,
            `rgba(182,255,198,${(a * 0.9).toFixed(3)})`,
          ],
          [
            `BRG ${bearing}° · RNG ${(r / R).toFixed(2)}`,
            `500 8px ${family}`,
            `rgba(0,255,65,${(a * 0.6).toFixed(3)})`,
          ],
        ];
        let shown = Math.floor((k.lockAge - 0.45) / 0.012);
        ctx.textAlign = right ? 'left' : 'right';
        lines.forEach(([text, font, fill], i) => {
          if (shown <= 0) return;
          const part = text.slice(0, shown);
          shown -= text.length;
          ctx.font = font;
          ctx.fillStyle = fill;
          ctx.fillText(part, endX + sx * 3, elbowY + 3 + i * 10);
        });
        ctx.textAlign = 'left';
      }

      // Interference: every few seconds, slices of the scope jump sideways for a frame or two.
      if (!reduce) {
        glitchIn -= dt;
        if (glitchIn <= 0) {
          glitchIn = 6 + Math.random() * 5;
          glitchUntil = t + 0.14;
        }
        if (t < glitchUntil)
          for (let i = 0; i < 3; i++) {
            const sy = Math.random() * size;
            const sh = 3 + Math.random() * 12;
            ctx.drawImage(canvas, 0, sy * dpr, size * dpr, sh * dpr, (Math.random() - 0.5) * 14, sy, size, sh);
            ctx.fillStyle = i % 2 ? 'rgba(34,211,238,0.08)' : 'rgba(255,42,109,0.08)';
            ctx.fillRect(0, sy, size, sh);
          }
      }

      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="block aspect-square w-full" aria-hidden="true" />;
}

function Corner({ pos }: { pos: string }) {
  return <span className={`absolute w-4 h-4 border-[#00FF41] ${pos}`} />;
}

export default function HackerRadarHero({ children }: { children?: ReactNode }) {
  const rainRef = useRef<HTMLCanvasElement>(null);
  useMatrixRain(rainRef);
  const [log, setLog] = useState<{ ts: string; tag: string; msg: string }[]>([]);
  const [locks, setLocks] = useState<Lock[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      const [tag, msg] = LOG_LINES[i++ % LOG_LINES.length];
      setLog((l) => [...l.slice(-6), { ts: new Date().toISOString().slice(11, 19), tag, msg }]);
    }, 850);
    return () => clearInterval(id);
  }, []);

  const onLock = (lock: Lock) => {
    setCount((n) => n + 1);
    setLocks((l) => [lock, ...l.filter((x) => x.label !== lock.label)].slice(0, 4));
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ background: '#000401' }}>
      <canvas ref={rainRef} className="absolute inset-0 w-full h-full opacity-[0.18]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0 1px, transparent 1px 3px)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 30% 50%, transparent 30%, rgba(0,0,0,0.9) 100%)' }}
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 pt-28 pb-16 min-h-screen grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
        {/* Left: copy */}
        <div className="min-w-0">{children}</div>

        {/* Right: scope console */}
        <div className="relative w-full max-w-[560px] mx-auto font-mono">
          <div className="relative border border-[#00FF41]/40 bg-black/70 backdrop-blur-sm shadow-[0_0_60px_rgba(0,255,65,0.12)]">
            <Corner pos="-top-px -left-px border-t-2 border-l-2" />
            <Corner pos="-top-px -right-px border-t-2 border-r-2" />
            <Corner pos="-bottom-px -left-px border-b-2 border-l-2" />
            <Corner pos="-bottom-px -right-px border-b-2 border-r-2" />

            <div className="flex items-center justify-between px-3 py-2 border-b border-[#00FF41]/25 text-[10px] tracking-widest">
              <span className="text-[#00FF41]">SIGINT://RADAR-01</span>
              <span className="flex items-center gap-2 text-[#00FF41]/70">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-pulse" /> REC ·{' '}
                {String(count).padStart(4, '0')} LOCKS
              </span>
            </div>

            <div className="p-3 sm:p-5">
              <RadarScope onLock={onLock} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[9px] tracking-widest text-[#00FF41]/60">
                <span>
                  <span className="text-[#00FF41]">●</span> VAULT ≥80
                </span>
                <span>
                  <span className="text-[#FACC15]">◆</span> OVERCLOCK 50–79
                </span>
                <span>
                  <span className="text-[#22D3EE]">▲</span> NEW SIGNAL
                </span>
                <span>CENTRE = 100% MATCH</span>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-[#00FF41]/25 text-[10px]">
              <div className="p-3 border-r border-[#00FF41]/25">
                <div className="text-[#00FF41]/50 mb-1 tracking-widest">LOCKED TARGETS</div>
                {locks.length ? (
                  locks.map((l, i) => (
                    <div key={l.label} className="flex justify-between" style={{ opacity: 1 - i * 0.2 }}>
                      <span style={{ color: `rgb(${BAND_RGB[l.band]})` }}>▸ {l.label}</span>
                      <span className="text-[#00FF41]/60">{l.band === 'NEW' ? 'NEW' : l.score + '%'}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[#00FF41]/40">acquiring…</div>
                )}
              </div>
              <div className="p-3 space-y-0.5 text-[#00FF41]/80">
                <div className="text-[#00FF41]/50 mb-1 tracking-widest">TELEMETRY</div>
                <div>
                  SOURCES{' '}
                  <span className="float-right text-[#00FF41]">
                    {CATALOG.sources}/{CATALOG.sources}
                  </span>
                </div>
                <div>
                  MODEL <span className="float-right text-[#22D3EE]">e5-L 1024D</span>
                </div>
                <div>
                  CYCLE <span className="float-right text-[#00FF41]">6h</span>
                </div>
                <div>
                  MODE <span className="float-right text-[#FACC15] animate-pulse">SCANNING</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#00FF41]/25 p-3 h-[132px] overflow-hidden text-[10.5px] leading-[17px]">
              {log.map((l, i) => (
                <div key={i} className="truncate hacker-log-line">
                  <span className="text-[#00FF41]/40">{l.ts}</span>{' '}
                  <span style={{ color: TAG_COLOR[l.tag] }}>[{l.tag.padEnd(4, ' ')}]</span>{' '}
                  <span className="text-[#00FF41]/85">{l.msg}</span>
                </div>
              ))}
              <span className="inline-block w-2 h-3 bg-[#00FF41] animate-pulse align-middle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
