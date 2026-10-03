'use client';
import { useEffect, useRef } from 'react';
import { bits, curvature, fmt, wrapAngle } from '@/lib/cursor-math';

// The mouse as a RADAR operator's pointer, drawn on one canvas:
// • a reticle that eases after the pointer: ring, turning radar sweep, compass ticks, live coordinates
// • a thin wake of glyphs where it passed: they decrypt (scramble → hex), then fade through ▒ ░ · and vanish
// • a quick flick shows θ and |v| beside the reticle; holding the button and dragging opens the full maths:
//   a unit circle with θ, cos θ and sin θ, the tangent, the osculating circle (R = 1/κ), and a compact
//   CALC://LIVE panel with an oscilloscope of |v| and d|v|/dt and a typed log of real values
// • resting on text shows that letter in binary; dragging across text streams each letter's bits
// • a lock-on frame hugs small controls; a large one gets a compact lock at the pointer instead
// • a hit marker on click (a ring, four strokes kicking out, the locked target flashing), a data streak while scrolling
// • a clean aperture: a thin red ring around the pointer whose inside nothing is ever drawn over, so what you are about
//   to click is always plain to see; every animation above lives outside it
// Mouse only, never with reduced motion, never over dialogs; no frames at all while idle.

const CW = 11; // glyph cell, CSS px
const CH = 18;
const LIFE = 1100; // ms a glyph lives
const SCRAMBLE = 140; // ms it flickers before it settles
const SETTLE = 600; // ms it stays a clear glyph before decaying
const MAX_CELLS = 260;
const IDLE_MS = 2600; // the reticle fades this long after the last move
const FAST = 700; // px/s: a flick faster than this shows θ and |v| beside the reticle
const FLICK_HOLD = 450; // ms that readout stays after the pointer slows down
const DRAG_START = 8; // px the pointer must travel with the button held before it counts as a drag
const CLEAR = 30; // px: the clean circle around the pointer; nothing is drawn inside it
const UNIT = CLEAR + 16; // unit-circle radius around the reticle, outside the clean circle
const PANEL_W = 236;
const LOG_LINES = 4;
const LOCK_MAX_W = 200; // a control bigger than this gets a compact lock at the pointer, not a frame around it
const LOCK_MAX_H = 52;
const CLICK_MS = 520; // the hit marker's life
const DWELL_MS = 250; // rest this long on a letter before its binary shows
const LOG_EVERY = 150; // ms between log lines
const GLYPHS = '0123456789ABCDEF<>/\\|{}[]#$%&*+=?!:;';
const DECAY = ['▒', '░', '·']; // a settled glyph fades out through these
const PHOS = '0, 255, 65';
const CYAN = '34, 211, 238';
const MAGENTA = '255, 42, 109';
const GREEN = '166, 226, 46';
const YELLOW = '230, 219, 116';
const VIOLET = '199, 146, 234';
const WHITE = '248, 248, 242';
const DIM = '138, 138, 138';
const RED = '255, 85, 85';
const LOCKABLE = 'a[href], button, [role="button"], [role="tab"], [role="switch"], input, select, textarea, summary';

interface Cell {
  col: number;
  row: number;
  born: number;
  swap: number;
  glyph: string;
  tone: string;
  /** A bit that settles to this glyph (dragged letters) instead of a random one. */
  fixed?: string;
}
type Part = [text: string, rgb: string];

const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, '0');
const num = (n: number, d = 2) => n.toFixed(d).replace('-', '−');
const deg = (r: number) => num((r * 180) / Math.PI, 1) + '°';
// innerText, not textContent: only the words on screen (a button can hide a short and a long label).
const nameOf = (el: Element) =>
  (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || el.tagName)
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 24);

type CaretDoc = Document & {
  caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
};
const nodeIds = new WeakMap<Node, number>();
let nodeSeq = 0;

/** The letter under a point, if the point is on one: the character and a key that names that exact spot. */
function letterAt(x: number, y: number): { ch: string; key: string } | null {
  const doc = document as CaretDoc;
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) ({ offsetNode: node, offset } = p);
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent || '';
  const range = document.createRange();
  for (const i of [offset, offset - 1]) {
    if (i < 0 || i >= text.length || !/[\p{L}\p{N}]/u.test(text[i])) continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const b = range.getBoundingClientRect();
    if (x < b.left - 1 || x > b.right + 1 || y < b.top - 1 || y > b.bottom + 1) continue;
    if (!nodeIds.has(node)) nodeIds.set(node, ++nodeSeq);
    return { ch: text[i], key: nodeIds.get(node) + ':' + i };
  }
  return null;
}

export default function SignalCursor() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // next/font gives the mono face a generated family name; read it off the class that uses it.
    const probe = document.createElement('span');
    probe.className = 'font-mono';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily || 'monospace';
    probe.remove();

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const t0 = performance.now();
    const cells = new Map<number, Cell>();
    const pings: { x: number; y: number; born: number }[] = [];
    const mouse = { x: 0, y: 0, seen: -Infinity, inside: false, muted: false, dragging: false };
    const ret = { x: 0, y: 0, alpha: 0, spin: 0, boost: 0 };
    const frame = { l: 0, t: 0, r: 0, b: 0, a: 0 };
    // The motion, from pointer samples: velocity and acceleration in px/s and px/s², heading θ (maths
    // convention, y up), turn rate ω, curvature κ, and the distance travelled, ∫|v|dt.
    const kin = { t: 0, vx: 0, vy: 0, ax: 0, ay: 0, speed: 0, along: 0, theta: 0, omega: 0, kappa: 0, dist: 0 };
    const trace: { x: number; y: number; t: number }[] = [];
    const scope: [number, number][] = [];
    const logs: { parts: Part[]; born: number; len: number }[] = [];
    const panel = { x: 0, y: 0 };
    let math = 0; // how much of the maths is showing, 0–1
    let lastFast = -Infinity;
    let nextLog = 0;
    let turn = 0;
    let letter: { ch: string; key: string } | null = null;
    let letterAtTime = 0;
    let letterSince = 0;
    let down: { x: number; y: number } | null = null;
    let clickAt = -Infinity;
    let compact = false;
    let lastBitsKey = '';
    let target: Element | null = null;
    let label = '';
    let lockedAt = 0;
    let last: { x: number; y: number } | null = null;
    let lastScroll = window.scrollY;
    let raf = 0;
    let prev = 0;

    const mark = (x: number, y: number, born: number, fixed?: string, tone?: string) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const col = Math.floor(x / CW);
      const row = Math.floor(y / CH);
      const key = row * 4096 + col;
      const old = cells.get(key);
      const r = Math.random();
      cells.delete(key); // re-insert, so the map stays oldest-first
      cells.set(key, {
        col,
        row,
        born,
        swap: born,
        glyph: fixed ?? pick(GLYPHS),
        fixed,
        tone: tone ?? old?.tone ?? (r < 0.015 ? MAGENTA : r < 0.075 ? CYAN : PHOS),
      });
      if (cells.size > MAX_CELLS) cells.delete(cells.keys().next().value!);
    };

    // Faster strokes leave a wider wake.
    const trail = (x: number, y: number, now: number) => {
      if (!last) {
        last = { x, y };
        mark(x, y, now);
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(24, Math.ceil(dist / (CW * 1.4)));
      const spread = dist > 60 ? Math.min(1.2, dist / 80) : 0;
      for (let i = 1; i <= steps; i++) {
        const px = last.x + (dx * i) / steps;
        const py = last.y + (dy * i) / steps;
        mark(px, py, now);
        if (Math.random() < spread * 0.25)
          mark(px + (Math.random() - 0.5) * CW * 2 * spread, py + (Math.random() - 0.5) * CH * 1.6 * spread, now);
      }
      last = { x, y };
    };

    // Velocity over the last ~90 ms of samples; acceleration from how that velocity changes.
    const sample = (x: number, y: number, now: number) => {
      const tail = trace[trace.length - 1];
      if (tail) kin.dist += Math.hypot(x - tail.x, y - tail.y);
      trace.push({ x, y, t: now });
      while (trace.length > 2 && now - trace[0].t > 90) trace.shift();
      const o = trace[0];
      const span = (now - o.t) / 1000;
      if (span < 0.012) return;
      const vx = (x - o.x) / span;
      const vy = (y - o.y) / span;
      const step = kin.t ? (now - kin.t) / 1000 : 0;
      if (step > 0) {
        kin.ax += ((vx - kin.vx) / step - kin.ax) * 0.25;
        kin.ay += ((vy - kin.vy) / step - kin.ay) * 0.25;
      }
      const speed = Math.hypot(vx, vy);
      const theta = Math.atan2(-vy, vx);
      if (speed > 30) {
        if (step > 0) kin.omega += (wrapAngle(theta - kin.theta) / step - kin.omega) * 0.25;
        kin.theta = theta;
      }
      kin.along = speed > 1 ? (vx * kin.ax + vy * kin.ay) / speed : 0;
      kin.kappa = speed > 60 ? curvature(vx, vy, kin.ax, kin.ay) : 0;
      kin.vx = vx;
      kin.vy = vy;
      kin.speed = speed;
      kin.t = now;
      if (speed > FAST) lastFast = now;
    };

    // One line of the calc log: λ lhs = expression = value, each part in its own colour.
    const CALC: (() => [string, string, string])[] = [
      () => ['θ', 'atan2(−ẏ, ẋ)', deg(kin.theta)],
      () => ['|v|', '√(ẋ² + ẏ²)', fmt(kin.speed) + ' px/s'],
      () => ['cos θ', 'ẋ / |v|', num(Math.cos(kin.theta), 3)],
      () => ['sin θ', '−ẏ / |v|', num(Math.sin(kin.theta), 3)],
      () => ['d|v|/dt', 'v̂ · a', fmt(kin.along) + ' px/s²'],
      () => ['∫|v|dt', 'Σ |Δr|', fmt(kin.dist) + ' px'],
      () => ['κ', '(ẋÿ − ẏẍ) / |v|³', num(Math.abs(kin.kappa), 4)],
      () => ['R', '1 / κ', kin.kappa ? fmt(1 / Math.abs(kin.kappa)) + ' px' : '∞'],
      () => ['ω', 'dθ/dt', num(kin.omega) + ' rad/s'],
      () => [
        'e^(iθ)',
        'cos θ + i·sin θ',
        `${num(Math.cos(kin.theta))} ${Math.sin(kin.theta) < 0 ? '−' : '+'} ${Math.abs(Math.sin(kin.theta)).toFixed(2)}i`,
      ],
      () => ['tan θ', 'sin θ / cos θ', Math.abs(Math.cos(kin.theta)) < 1e-3 ? '∞' : num(Math.tan(kin.theta))],
      () => ['lim Δt→0', 'Δs / Δt', fmt(kin.speed) + ' px/s'],
    ];
    const log = (parts: Part[], now: number) => {
      logs.push({ parts, born: now, len: parts.reduce((n, [t]) => n + t.length, 0) });
      if (logs.length > LOG_LINES) logs.shift();
    };
    const calcLine = (now: number) => {
      const [lhs, expr, value] = CALC[turn++ % CALC.length]();
      log(
        [
          ['λ ', MAGENTA],
          [lhs, CYAN],
          [' = ', DIM],
          [expr, WHITE],
          [' = ', DIM],
          [value, PHOS],
        ],
        now,
      );
    };
    // A dragged-over letter: its bits run out beside the pointer, and the log decodes it.
    const emitBits = (ch: string, x: number, y: number, now: number) => {
      const b = bits(ch);
      [...b.replace(/ /g, '')].forEach((bit, i) => mark(x + 12 + i * CW, y + 14, now + i * 16, bit, CYAN));
      const code = ch.codePointAt(0) ?? 0;
      log(
        [
          ['λ ', MAGENTA],
          ['bin', CYAN],
          ['(', DIM],
          [`'${ch}'`, YELLOW],
          [') = ', DIM],
          ['0x' + code.toString(16).toUpperCase(), VIOLET],
          [' = ', DIM],
          [b, PHOS],
        ],
        now,
      );
    };

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const brackets = (l: number, t: number, r: number, b: number, arm: number) => {
      ctx.beginPath();
      ctx.moveTo(l, t + arm);
      ctx.lineTo(l, t);
      ctx.lineTo(l + arm, t);
      ctx.moveTo(r - arm, t);
      ctx.lineTo(r, t);
      ctx.lineTo(r, t + arm);
      ctx.moveTo(r, b - arm);
      ctx.lineTo(r, b);
      ctx.lineTo(r - arm, b);
      ctx.moveTo(l + arm, b);
      ctx.lineTo(l, b);
      ctx.lineTo(l, b - arm);
      ctx.stroke();
    };

    // Trigonometry on a unit circle around the reticle: the heading, its cos and sin, θ, the tangent.
    const drawTrig = (a: number) => {
      const { x, y } = ret;
      const th = Math.atan2(kin.vy, kin.vx); // screen angle (y down)
      const c = Math.cos(th);
      const s = Math.sin(th);
      const px = x + c * UNIT;
      const py = y + s * UNIT;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = `rgba(${WHITE}, ${(0.16 * a).toFixed(3)})`;
      line(x - UNIT - 12, y, x + UNIT + 12, y);
      line(x, y - UNIT - 12, x, y + UNIT + 12);
      ctx.strokeStyle = `rgba(${PHOS}, ${(0.22 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, UNIT, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${WHITE}, ${(0.22 * a).toFixed(3)})`;
      line(x - c * (UNIT + 24), y - s * (UNIT + 24), x + c * (UNIT + 24), y + s * (UNIT + 24)); // the tangent: the path's direction right now
      ctx.strokeStyle = `rgba(${WHITE}, ${(0.35 * a).toFixed(3)})`;
      line(px, py, px, y);
      line(px, py, x, py);
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${GREEN}, ${(0.9 * a).toFixed(3)})`;
      line(x, y, px, y);
      ctx.strokeStyle = `rgba(${MAGENTA}, ${(0.9 * a).toFixed(3)})`;
      line(x, y, x, py);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = `rgba(${CYAN}, ${a.toFixed(3)})`;
      line(x, y, px, py);
      ctx.fillStyle = `rgba(${CYAN}, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${YELLOW}, ${(0.9 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, CLEAR + 5, 0, th, th < 0);
      ctx.stroke();
      ctx.font = `500 9px ${family}`;
      ctx.fillStyle = `rgba(${YELLOW}, ${a.toFixed(3)})`;
      ctx.fillText(`θ ${deg(-th)}`, x + Math.cos(th / 2) * (CLEAR + 12) + 3, y + Math.sin(th / 2) * (CLEAR + 12) - 5);
      ctx.fillStyle = `rgba(${GREEN}, ${a.toFixed(3)})`;
      ctx.fillText(`cos θ ${num(c)}`, c >= 0 ? px + 4 : px - 62, y + 3);
      ctx.fillStyle = `rgba(${MAGENTA}, ${a.toFixed(3)})`;
      ctx.fillText(`sin θ ${num(-s)}`, x + 5, s >= 0 ? py + 2 : py - 11);
    };

    // Calculus: the osculating circle, the circle that best fits the curve here (radius R = 1/κ).
    const drawCurvature = (a: number) => {
      const k = Math.abs(kin.kappa);
      if (k < 1 / 180 || kin.speed < 160) return;
      const R = 1 / k;
      const tx = kin.vx / kin.speed;
      const ty = kin.vy / kin.speed;
      const along = kin.ax * tx + kin.ay * ty;
      const nx = kin.ax - along * tx;
      const ny = kin.ay - along * ty;
      const nl = Math.hypot(nx, ny);
      if (nl < 1) return;
      const cx = ret.x + (nx / nl) * R;
      const cy = ret.y + (ny / nl) * R;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = `rgba(${VIOLET}, ${(0.42 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${VIOLET}, ${(0.3 * a).toFixed(3)})`;
      line(ret.x, ret.y, cx, cy);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${VIOLET}, ${(0.85 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `500 9px ${family}`;
      ctx.fillText(`R = 1/κ = ${fmt(R)} px`, (ret.x + cx) / 2 + 6, (ret.y + cy) / 2);
    };

    // CALC://LIVE: an oscilloscope of |v| (green) and d|v|/dt (cyan), then the log, typed in.
    const drawPanel = (now: number, a: number, ease: (k: number) => number) => {
      const H = 22 + 28 + LOG_LINES * 13 + 8;
      let px = ret.x + UNIT + 34;
      let py = ret.y + UNIT + 18;
      if (px + PANEL_W > w - 8) px = ret.x - UNIT - 34 - PANEL_W;
      if (py + H > h - 8) py = ret.y - UNIT - 18 - H;
      px = Math.max(8, Math.min(px, w - PANEL_W - 8));
      py = Math.max(8, Math.min(py, h - H - 8));
      if (a < 0.05) Object.assign(panel, { x: px, y: py });
      panel.x += (px - panel.x) * ease(0.18);
      panel.y += (py - panel.y) * ease(0.18);
      const { x, y } = panel;

      ctx.fillStyle = `rgba(0, 10, 4, ${(0.8 * a).toFixed(3)})`;
      ctx.fillRect(x, y, PANEL_W, H);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${PHOS}, ${(0.2 * a).toFixed(3)})`;
      ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, H - 1);
      ctx.strokeStyle = `rgba(${PHOS}, ${(0.85 * a).toFixed(3)})`;
      brackets(x, y, x + PANEL_W, y + H, 7);

      ctx.font = `600 9px ${family}`;
      ctx.fillStyle = `rgba(${PHOS}, ${(0.95 * a).toFixed(3)})`;
      ctx.fillText('CALC://LIVE', x + 8, y + 7);
      const info = `t+${((now - t0) / 1000).toFixed(1)}s`;
      ctx.fillStyle = `rgba(${WHITE}, ${(0.45 * a).toFixed(3)})`;
      ctx.fillText(info, x + PANEL_W - 8 - ctx.measureText(info).width, y + 7);

      const sx = x + 8;
      const sy = y + 22;
      const sw = PANEL_W - 16;
      const sh = 24;
      ctx.strokeStyle = `rgba(${PHOS}, ${(0.14 * a).toFixed(3)})`;
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      ctx.setLineDash([2, 3]);
      line(sx, sy + sh / 2, sx + sw, sy + sh / 2);
      ctx.setLineDash([]);
      const vmax = Math.max(900, ...scope.map((s) => s[0]));
      const amax = Math.max(6000, ...scope.map((s) => Math.abs(s[1])));
      const plot = (value: (s: [number, number]) => number, rgb: string) => {
        ctx.strokeStyle = `rgba(${rgb}, ${(0.9 * a).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        scope.forEach((s, i) => {
          const px2 = sx + (i / 119) * sw;
          const py2 = sy + sh / 2 - value(s) * (sh / 2 - 3);
          if (i) ctx.lineTo(px2, py2);
          else ctx.moveTo(px2, py2);
        });
        ctx.stroke();
      };
      plot((s) => (s[0] / vmax) * 2 - 1, GREEN);
      plot((s) => s[1] / amax, CYAN);
      ctx.font = `500 8px ${family}`;
      ctx.fillStyle = `rgba(${GREEN}, ${(0.8 * a).toFixed(3)})`;
      ctx.fillText('|v|', sx + sw - 38, sy + 3);
      ctx.fillStyle = `rgba(${CYAN}, ${(0.8 * a).toFixed(3)})`;
      ctx.fillText("|v|'", sx + sw - 20, sy + 3);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, sy + sh + 4, PANEL_W - 8, LOG_LINES * 13 + 6);
      ctx.clip();
      ctx.font = `500 10px ${family}`;
      logs.forEach((l, i) => {
        const shown = Math.floor((now - l.born) / 7);
        const fade = (0.35 + 0.65 * ((i + 1) / logs.length)) * a;
        let left = shown;
        let cx = x + 8;
        const ly = sy + sh + 8 + i * 13;
        for (const [text, rgb] of l.parts) {
          if (left <= 0) break;
          const part = text.slice(0, left);
          left -= part.length;
          ctx.fillStyle = `rgba(${rgb}, ${fade.toFixed(3)})`;
          ctx.fillText(part, cx, ly);
          cx += ctx.measureText(part).width;
        }
        if (shown < l.len) {
          ctx.fillStyle = `rgba(${WHITE}, ${a.toFixed(3)})`;
          ctx.fillText(pick(GLYPHS), cx, ly);
        }
      });
      ctx.restore();
    };

    const draw = (now: number) => {
      raf = 0;
      const dt = prev ? Math.min(50, now - prev) : 16;
      prev = now;
      const ease = (k: number) => 1 - Math.pow(1 - k, dt / 16.7); // frame-rate independent lerp
      ctx.clearRect(0, 0, w, h);

      // The wake.
      ctx.font = `500 12px ${family}`;
      ctx.textBaseline = 'top';
      for (const [key, c] of cells) {
        const age = now - c.born;
        if (age < 0) continue;
        if (age > LIFE) {
          cells.delete(key);
          continue;
        }
        let glyph = c.glyph;
        let rgb = c.tone;
        let alpha: number;
        if (age < SCRAMBLE) {
          if (now - c.swap > 38) {
            c.glyph = glyph = pick(c.fixed ? '01' : GLYPHS);
            c.swap = now;
          }
          rgb = '234, 255, 240';
          alpha = 1;
        } else if (age < SETTLE) {
          glyph = c.fixed ?? glyph;
          alpha = 0.95 - ((age - SCRAMBLE) / (SETTLE - SCRAMBLE)) * 0.35;
        } else {
          const k = (age - SETTLE) / (LIFE - SETTLE);
          glyph = c.fixed ?? DECAY[Math.min(2, Math.floor(k * 3))];
          alpha = (c.fixed ? 0.6 : 0.32) * (1 - k);
        }
        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.fillText(glyph, c.col * CW + 2, c.row * CH + 3);
      }

      // Hit marker: one ring snaps out while four short strokes kick away from the click.
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        const k = (now - p.born) / CLICK_MS;
        if (k > 1) {
          pings.splice(i, 1);
          continue;
        }
        const out = 1 - Math.pow(1 - k, 3);
        const fade = 1 - k;
        ctx.strokeStyle = `rgba(${PHOS}, ${(0.9 * fade).toFixed(3)})`;
        ctx.lineWidth = 0.6 + 1.6 * fade;
        ctx.beginPath();
        ctx.arc(p.x, p.y, CLEAR + out * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(234, 255, 240, ${fade.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        for (let q = 0; q < 4; q++) {
          const a = Math.PI / 4 + (q * Math.PI) / 2;
          const r1 = CLEAR + 4 + out * 10;
          const r2 = r1 + 2 + 6 * fade;
          line(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1, p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2);
        }
      }

      // The reticle eases after the pointer and fades when it rests.
      const fresh = mouse.inside && !mouse.muted && now - mouse.seen < IDLE_MS;
      if (ret.alpha < 0.02) {
        ret.x = mouse.x;
        ret.y = mouse.y;
      }
      ret.alpha += ((fresh ? 1 : 0) - ret.alpha) * ease(0.12);
      ret.x += (mouse.x - ret.x) * ease(0.28);
      ret.y += (mouse.y - ret.y) * ease(0.28);
      ret.boost *= Math.pow(0.94, dt / 16.7);
      ret.spin += dt * (0.0035 + ret.boost * 0.02);

      // No new samples: the motion winds down, so the maths settles instead of freezing.
      if (now - kin.t > 80) {
        const k = Math.pow(0.86, dt / 16.7);
        kin.vx *= k;
        kin.vy *= k;
        kin.speed *= k;
        kin.ax *= k;
        kin.ay *= k;
        kin.along *= k;
        kin.omega *= k;
      }

      // Lock-on: the frame grows from the reticle to the target, and shrinks back when it leaves.
      let box = { l: ret.x - CLEAR - 6, t: ret.y - CLEAR - 6, r: ret.x + CLEAR + 6, b: ret.y + CLEAR + 6 };
      const locked = fresh && !!target?.isConnected;
      if (locked) {
        const r = target!.getBoundingClientRect();
        compact = r.width > LOCK_MAX_W || r.height > LOCK_MAX_H;
        box = compact
          ? { l: ret.x - CLEAR - 6, t: ret.y - CLEAR - 6, r: ret.x + CLEAR + 6, b: ret.y + CLEAR + 6 }
          : {
              l: Math.max(4, r.left - 4),
              t: Math.max(4, r.top - 4),
              r: Math.min(w - 4, r.right + 4),
              b: Math.min(h - 4, r.bottom + 4),
            };
      }
      if (frame.a < 0.02 && !locked) Object.assign(frame, box);
      const fe = ease(0.24);
      frame.l += (box.l - frame.l) * fe;
      frame.t += (box.t - frame.t) * fe;
      frame.r += (box.r - frame.r) * fe;
      frame.b += (box.b - frame.b) * fe;
      frame.a += ((locked ? 1 : 0) - frame.a) * ease(0.18);

      // The full maths only while dragging; a flick gets a small θ / |v| readout by the reticle instead.
      const live = fresh && mouse.dragging;
      const flick = fresh && !live && now - lastFast < FLICK_HOLD;
      math += ((live ? 1 : 0) - math) * ease(0.1);
      if (math > 0.01) {
        scope.push([kin.speed, kin.along]);
        if (scope.length > 120) scope.shift();
        if (live && now >= nextLog) {
          calcLine(now);
          nextLog = now + LOG_EVERY;
        }
        const trigA = math * ret.alpha * (1 - frame.a) * Math.min(1, 0.25 + kin.speed / 400);
        if (trigA > 0.01) {
          drawCurvature(trigA);
          drawTrig(trigA);
        }
      }

      const ringA = ret.alpha * (1 - frame.a * 0.7);
      // A click squeezes the reticle for a beat, like a trigger pulled.
      const squeeze = 1 - 0.3 * Math.sin(Math.PI * Math.min(1, Math.max(0, (now - clickAt) / 260)));
      if (ringA > 0.01) {
        const { x, y } = ret;
        const R = CLEAR + 8 * squeeze;
        if (ctx.createConicGradient) {
          const g = ctx.createConicGradient(ret.spin, x, y);
          g.addColorStop(0, `rgba(${PHOS}, 0)`);
          g.addColorStop(0.8, `rgba(${PHOS}, 0)`);
          g.addColorStop(1, `rgba(${PHOS}, ${(0.38 * ringA).toFixed(3)})`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, R + 4, 0, Math.PI * 2); // the clean circle is cut out of it below: a sweeping band
          ctx.fill();
        }
        ctx.strokeStyle = `rgba(${PHOS}, ${(0.9 * ringA).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        line(x, y, x + Math.cos(ret.spin) * R, y + Math.sin(ret.spin) * R);
        ctx.strokeStyle = `rgba(${PHOS}, ${(0.55 * ringA).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2;
          ctx.moveTo(x + Math.cos(a) * (R + 3), y + Math.sin(a) * (R + 3));
          ctx.lineTo(x + Math.cos(a) * (R + 8), y + Math.sin(a) * (R + 8));
        }
        ctx.stroke();
        // The readouts step aside while a lock or the drag maths is on screen.
        const readA = ringA * (1 - frame.a) * (1 - 0.9 * math);
        ctx.font = `500 9px ${family}`;
        ctx.fillStyle = `rgba(182, 255, 198, ${(0.6 * readA).toFixed(3)})`;
        ctx.fillText(`x${pad(mouse.x)} y${pad(mouse.y + window.scrollY)}`, x + R + 12, y + 4);
        // The letter the pointer rests on, in binary (not while it just passes over text).
        if (letter && now - letterAtTime < 400 && now - letterSince > DWELL_MS) {
          const code = letter.ch.codePointAt(0) ?? 0;
          ctx.fillStyle = `rgba(${CYAN}, ${(0.85 * readA).toFixed(3)})`;
          ctx.fillText(`'${letter.ch}' 0x${code.toString(16).toUpperCase()} ${bits(letter.ch)}`, x + R + 12, y + 15);
        } else if (flick) {
          ctx.fillStyle = `rgba(${YELLOW}, ${(0.8 * readA).toFixed(3)})`;
          ctx.fillText(`θ ${deg(kin.theta)}  |v| ${fmt(kin.speed)}`, x + R + 12, y + 15);
        }
      }

      if (math > 0.01) {
        const panelA = math * ret.alpha * (1 - frame.a * 0.7);
        if (panelA > 0.01) drawPanel(now, panelA, ease);
      }

      const lockA = frame.a * ret.alpha;
      if (lockA > 0.01) {
        const { l, t, r, b } = frame;
        // Clicking the target flashes it and pulls the brackets in.
        const flash = Math.max(0, 1 - (now - clickAt) / 320);
        const inset = 3 * flash;
        if (flash > 0) {
          ctx.fillStyle = `rgba(${PHOS}, ${(0.16 * flash * lockA).toFixed(3)})`;
          ctx.fillRect(l, t, r - l, b - t);
        }
        ctx.strokeStyle = `rgba(${PHOS}, ${(0.95 * lockA).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        brackets(l + inset, t + inset, r - inset, b - inset, Math.min(8, (r - l) / 3, (b - t) / 3));
        if (!compact) {
          // A faint scan line runs down the target.
          const sy = t + ((now / 900) % 1) * (b - t);
          const sg = ctx.createLinearGradient(l, 0, r, 0);
          sg.addColorStop(0, `rgba(${PHOS}, 0)`);
          sg.addColorStop(0.5, `rgba(${PHOS}, ${(0.22 * lockA).toFixed(3)})`);
          sg.addColorStop(1, `rgba(${PHOS}, 0)`);
          ctx.fillStyle = sg;
          ctx.fillRect(l + 2, sy, r - l - 4, 1);
        }
        // The target's name types itself in.
        const text = `LOCK ▸ ${label}`.slice(0, Math.max(0, Math.floor((now - lockedAt) / 14)));
        if (text) {
          ctx.font = `600 9px ${family}`;
          const tw = ctx.measureText(text).width + 8;
          const lx = Math.max(2, Math.min(compact ? r + 6 : l, w - tw - 2));
          const ly = compact ? t + 5 : t - 16 >= 2 ? t - 16 : b + 17 <= h ? b + 4 : t + 4;
          ctx.fillStyle = `rgba(0, 0, 0, ${(0.78 * lockA).toFixed(3)})`;
          ctx.fillRect(lx, ly, tw, 13);
          ctx.fillStyle = `rgba(${PHOS}, ${lockA.toFixed(3)})`;
          ctx.fillText(text, lx + 4, ly + 2);
        }
      }

      // The clean aperture, centred on the pointer itself (the reticle eases after it): whatever this frame drew is
      // cut out of it, so the thing under the pointer is always plain to see.
      ctx.save();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, CLEAR, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(mouse.x - CLEAR, mouse.y - CLEAR, CLEAR * 2, CLEAR * 2);
      ctx.restore();
      if (ret.alpha > 0.01) {
        ctx.strokeStyle = `rgba(${RED}, ${(0.6 * ret.alpha).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, CLEAR, 0, Math.PI * 2);
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2;
          ctx.moveTo(mouse.x + Math.cos(a) * CLEAR, mouse.y + Math.sin(a) * CLEAR);
          ctx.lineTo(mouse.x + Math.cos(a) * (CLEAR - 4), mouse.y + Math.sin(a) * (CLEAR - 4));
        }
        ctx.stroke();
      }

      if (cells.size || pings.length || ret.alpha > 0.01 || frame.a > 0.01 || math > 0.01 || flick)
        raf = requestAnimationFrame(draw);
      else prev = 0;
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      const el = e.target instanceof Element ? e.target : null;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = now;
      mouse.inside = true;
      mouse.muted = !!el?.closest('[role="dialog"]');
      mouse.dragging =
        (e.buttons & 1) === 1 && !!down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_START;
      if (mouse.muted) {
        last = null;
        letter = null;
      } else {
        trail(e.clientX, e.clientY, now);
        sample(e.clientX, e.clientY, now);
        // The letter under the pointer, looked up at most every 45 ms (it asks the browser for layout).
        if (now - letterAtTime > 45) {
          const found = letterAt(e.clientX, e.clientY);
          if (found?.key !== letter?.key) letterSince = now;
          letter = found;
          if (letter) letterAtTime = now;
        }
        if (mouse.dragging && letter && letter.key !== lastBitsKey) {
          lastBitsKey = letter.key;
          emitBits(letter.ch, e.clientX, e.clientY, now);
        }
      }
      const hit = mouse.muted ? null : el?.closest(LOCKABLE);
      const next = hit && !hit.matches(':disabled') ? hit : null;
      if (next !== target) {
        target = next;
        label = next ? nameOf(next) : '';
        lockedAt = now;
      }
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || mouse.muted) return;
      const now = performance.now();
      down = { x: e.clientX, y: e.clientY };
      clickAt = now;
      lastBitsKey = '';
      pings.push({ x: e.clientX, y: e.clientY, born: now });
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 14 + Math.random() * 18;
        mark(e.clientX + Math.cos(a) * r, e.clientY + Math.sin(a) * r * 0.8, now + Math.random() * 90);
      }
      wake();
    };
    const onUp = () => {
      mouse.dragging = false;
      down = null;
    };
    // Scrolling leaves a streak of data behind the pointer, and spins the sweep faster.
    const onScroll = () => {
      const dy = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (!dy || !mouse.inside || mouse.muted) return;
      const now = performance.now();
      // Smooth scrolling moves a few px per event, so the streak grows with the scroll's momentum instead.
      ret.boost = Math.min(1, ret.boost + Math.abs(dy) / 200);
      const n = Math.max(1, Math.round(ret.boost * 12));
      for (let i = 1; i <= n; i++) {
        const y = mouse.y - Math.sign(dy) * (i + 1) * CH * 0.9;
        mark(mouse.x + (Math.random() - 0.5) * CW * 0.8, y, now - i * 30);
        if (Math.random() < ret.boost * 0.4) mark(mouse.x + (Math.random() < 0.5 ? -CW : CW), y, now - i * 30);
      }
      mouse.seen = now;
      last = null;
      wake();
    };
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      mouse.inside = false;
      last = null;
      wake();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mouseout', onLeave);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mouseout', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] h-full w-full" />;
}
