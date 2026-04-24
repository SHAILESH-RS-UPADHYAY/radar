'use client';

let audioCtx: AudioContext | null = null;

export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

export type SoundEffect = 'tick' | 'gear' | 'chain' | 'chime' | 'error' | 'scan' | 'hover' | 'click';

// Metallic noise burst — the core of clockwork sound
const metalBurst = (ctx: AudioContext, freq: number, vol: number, dur: number) => {
  const bufSize = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 12;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
  src.start(now); src.stop(now + dur);
};

// Metallic ring tone
const ringTone = (ctx: AudioContext, freq: number, vol: number, dur: number, delay = 0) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime + delay;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + dur);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now); osc.stop(now + dur);
};

export const playSound = (type: SoundEffect) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    switch (type) {
      // Sharp mechanical tick — single gear tooth click
      case 'tick':
      case 'hover':
        metalBurst(ctx, 4500, 0.08, 0.018);
        ringTone(ctx, 2800, 0.015, 0.04);
        break;

      // Double-tick gear click — heavier
      case 'gear':
      case 'click':
        metalBurst(ctx, 3200, 0.12, 0.022);
        ringTone(ctx, 1800, 0.03, 0.06);
        setTimeout(() => {
          metalBurst(ctx, 4800, 0.07, 0.015);
        }, 30);
        break;

      // Chain link rattle — multiple rapid metallic taps
      case 'chain':
        for (let i = 0; i < 4; i++) {
          const delay = i * 0.04;
          setTimeout(() => {
            metalBurst(ctx, 3500 + i * 400, 0.06 - i * 0.01, 0.02);
          }, delay * 1000);
        }
        break;

      // Success chime — bright metallic bell
      case 'chime':
        ringTone(ctx, 1047, 0.08, 0.5);
        ringTone(ctx, 1319, 0.06, 0.4, 0.1);
        ringTone(ctx, 1568, 0.05, 0.35, 0.18);
        metalBurst(ctx, 5000, 0.04, 0.05);
        break;

      // Sonar sweep
      case 'scan': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(480, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.25);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
        metalBurst(ctx, 2000, 0.03, 0.05);
        break;
      }

      case 'error':
        metalBurst(ctx, 200, 0.1, 0.15);
        ringTone(ctx, 150, 0.05, 0.2);
        break;
    }
  } catch(e) { console.warn('Audio err', e); }
};
