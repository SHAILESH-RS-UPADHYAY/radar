import { describe, expect, it } from 'vitest';
import { ownsAlert } from './alert-owner';

describe('ownsAlert: job alerts belong to the inbox they came from', () => {
  const owners = new Map([
    ['first', new Set(['a'])],
    ['second', new Set(['b'])],
  ]);
  const linked = ['first', 'second'];

  it('gives an account with no Gmail linked nothing', () => {
    const owns = ownsAlert('stranger', linked, owners);
    expect(['a', 'b', 'old'].map(owns)).toEqual([false, false, false]);
  });

  it('gives each linked account only its own', () => {
    expect(['a', 'b', 'old'].map(ownsAlert('second', linked, owners))).toEqual([false, true, false]);
  });

  it('gives jobs from before owners were recorded to the first inbox linked', () => {
    expect(['a', 'b', 'old'].map(ownsAlert('first', linked, owners))).toEqual([true, false, true]);
  });
});
