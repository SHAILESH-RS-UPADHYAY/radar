import { describe, expect, it } from 'vitest';
import { bits, curvature, fmt, wrapAngle } from './cursor-math';

describe('cursor maths', () => {
  it('folds angle differences across ±180°', () => {
    expect(wrapAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.25)).toBeCloseTo(0.25);
  });

  it('gives 1/R for motion on a circle of radius R', () => {
    // On a circle of radius 200 at speed 500: v ⟂ r, |a| = v²/R, pointing to the centre.
    const R = 200;
    const v = 500;
    for (const phi of [0, 0.7, 2.1, 4]) {
      const vx = -v * Math.sin(phi);
      const vy = v * Math.cos(phi);
      const ax = (-v * v * Math.cos(phi)) / R;
      const ay = (-v * v * Math.sin(phi)) / R;
      expect(Math.abs(curvature(vx, vy, ax, ay))).toBeCloseTo(1 / R);
    }
    expect(curvature(0, 0, 5, 5)).toBe(0);
  });

  it('writes letters in binary and numbers compactly', () => {
    expect(bits('R')).toBe('0101 0010');
    expect(bits('é')).toBe('1110 1001');
    expect(bits('ह')).toBe('0000 1001 0011 1001');
    expect(fmt(1234)).toBe('1.2k');
    expect(fmt(-12.3)).toBe('−12');
    expect(fmt(0.5)).toBe('0.50');
  });
});
