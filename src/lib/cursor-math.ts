// Small maths for the cursor HUD (components/ui/SignalCursor.tsx), kept pure so it can be checked.

/** An angle difference folded into [−π, π), so a turn across ±180° is not read as a whole circle. */
export function wrapAngle(d: number): number {
  const t = (d + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}

/** Signed curvature of a path with velocity (vx, vy) and acceleration (ax, ay): κ = (ẋÿ − ẏẍ) / |v|³. */
export function curvature(vx: number, vy: number, ax: number, ay: number): number {
  const s = Math.hypot(vx, vy);
  return s < 1e-6 ? 0 : (vx * ay - vy * ax) / (s * s * s);
}

/** A character's code point in binary, in groups of four: 'R' → "0101 0010". */
export function bits(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  return code
    .toString(2)
    .padStart(code > 0xff ? 16 : 8, '0')
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Compact number with a real minus sign: 1234 → "1.2k", −12.3 → "−12", 0.5 → "0.50". */
export function fmt(n: number): string {
  const a = Math.abs(n);
  const s =
    a >= 1e6
      ? (n / 1e6).toFixed(1) + 'M'
      : a >= 1e3
        ? (n / 1e3).toFixed(1) + 'k'
        : a >= 10
          ? n.toFixed(0)
          : n.toFixed(2);
  return s.replace('-', '−');
}
