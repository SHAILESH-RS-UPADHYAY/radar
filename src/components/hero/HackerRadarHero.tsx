'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

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

interface Blip {
  angle: number;
  radius: number;
  label: string;
  lit: number;
  locked: number;
}

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

function RadarScope({ onLock }: { onLock: (label: string) => void }) {
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
    const blips: Blip[] = TARGETS.map((label, i) => ({
      angle: (i / TARGETS.length) * Math.PI * 2 + Math.random() * 0.3,
      radius: 0.22 + Math.random() * 0.7,
      label,
      lit: 0,
      locked: 0,
    }));

    let size = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let sweep = 0,
      last = performance.now(),
      raf = 0,
      t = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const prev = sweep;
      sweep = (sweep + dt * (reduce ? 0.3 : 1.2)) % (Math.PI * 2);
      const c = size / 2,
        R = size / 2 - 18;

      ctx.fillStyle = 'rgba(0, 8, 3, 0.25)';
      ctx.fillRect(0, 0, size, size);

      // rings, crosshair, ticks
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        ctx.strokeStyle = i === 5 ? 'rgba(0,255,65,0.45)' : 'rgba(0,255,65,0.14)';
        ctx.setLineDash(i % 2 ? [] : [2, 6]);
        ctx.beginPath();
        ctx.arc(c, c, (R * i) / 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,255,65,0.14)';
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(c - Math.cos(a) * R, c - Math.sin(a) * R);
        ctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,255,65,0.5)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(0,255,65,0.6)';
      for (let d = 0; d < 360; d += 5) {
        const a = (d * Math.PI) / 180,
          inner = d % 30 === 0 ? R - 9 : R - 4;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
        ctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        ctx.stroke();
        if (d % 30 === 0)
          ctx.fillText(String(d).padStart(3, '0'), c + Math.cos(a) * (R + 9) - 8, c + Math.sin(a) * (R + 9) + 3);
      }

      // rotating inner ring segments
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a0 = -t * 0.6 + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(c, c, R * 0.12, a0, a0 + 1.2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;

      // sweep wedge
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(sweep - 0.9, c, c);
        g.addColorStop(0, 'rgba(0,255,65,0)');
        g.addColorStop(0.143, 'rgba(0,255,65,0.35)');
        g.addColorStop(0.1433, 'rgba(0,255,65,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, R, sweep - 0.9, sweep);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#B6FFC6';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00FF41';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;

      // blips + target locks
      for (const b of blips) {
        const crossed = prev < sweep ? b.angle > prev && b.angle <= sweep : b.angle > prev || b.angle <= sweep;
        if (crossed) {
          b.lit = 1;
          if (Math.random() < 0.35) {
            b.locked = 1;
            onLockRef.current(b.label);
          }
        }
        b.lit = Math.max(0, b.lit - dt * 0.4);
        b.locked = Math.max(0, b.locked - dt * 0.3);
        if (b.lit <= 0.02 && b.locked <= 0.02) continue;
        const x = c + Math.cos(b.angle) * b.radius * R,
          y = c + Math.sin(b.angle) * b.radius * R;
        ctx.fillStyle = `rgba(0,255,65,${Math.max(b.lit, 0.3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(0,255,65,${b.lit * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, 3 + (1 - b.lit) * 14, 0, Math.PI * 2);
        ctx.stroke();

        if (b.locked > 0.02) {
          const s = 9 + (1 - b.locked) * 3,
            a = b.locked;
          ctx.strokeStyle = `rgba(250,204,21,${a})`;
          ctx.beginPath();
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            ctx.moveTo(x + sx * s, y + sy * s - sy * 4);
            ctx.lineTo(x + sx * s, y + sy * s);
            ctx.lineTo(x + sx * s - sx * 4, y + sy * s);
          }
          ctx.stroke();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = `rgba(250,204,21,${a * 0.35})`;
          ctx.beginPath();
          ctx.moveTo(c, c);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.setLineDash([]);
          if (size > 300) {
            ctx.fillStyle = `rgba(250,204,21,${a})`;
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.fillText(b.label, x + s + 4, y - 2);
            ctx.fillStyle = `rgba(0,255,65,${a * 0.8})`;
            ctx.font = '8px ui-monospace, monospace';
            ctx.fillText(`${((b.angle * 180) / Math.PI).toFixed(1)}° r${b.radius.toFixed(2)}`, x + s + 4, y + 8);
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="block w-full aspect-square" aria-hidden="true" />;
}

function Corner({ pos }: { pos: string }) {
  return <span className={`absolute w-4 h-4 border-[#00FF41] ${pos}`} />;
}

export default function HackerRadarHero({ children }: { children?: ReactNode }) {
  const rainRef = useRef<HTMLCanvasElement>(null);
  useMatrixRain(rainRef);
  const [log, setLog] = useState<{ ts: string; tag: string; msg: string }[]>([]);
  const [locks, setLocks] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      const [tag, msg] = LOG_LINES[i++ % LOG_LINES.length];
      setLog((l) => [...l.slice(-6), { ts: new Date().toISOString().slice(11, 19), tag, msg }]);
    }, 850);
    return () => clearInterval(id);
  }, []);

  const onLock = (label: string) => {
    setCount((n) => n + 1);
    setLocks((l) => [label, ...l.filter((x) => x !== label)].slice(0, 4));
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
            </div>

            <div className="grid grid-cols-2 border-t border-[#00FF41]/25 text-[10px]">
              <div className="p-3 border-r border-[#00FF41]/25">
                <div className="text-[#00FF41]/50 mb-1 tracking-widest">LOCKED TARGETS</div>
                {locks.length ? (
                  locks.map((l, i) => (
                    <div key={l} className="flex justify-between" style={{ opacity: 1 - i * 0.2 }}>
                      <span className="text-[#FACC15]">▸ {l}</span>
                      <span className="text-[#00FF41]/60">ACQ</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[#00FF41]/40">acquiring…</div>
                )}
              </div>
              <div className="p-3 space-y-0.5 text-[#00FF41]/80">
                <div className="text-[#00FF41]/50 mb-1 tracking-widest">TELEMETRY</div>
                <div>
                  SOURCES <span className="float-right text-[#00FF41]">15/15</span>
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
