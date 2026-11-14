// The dial's ratchet, synthesised (no audio files): each look clicks like a pawl dropping into a tooth, and the
// teeth between looks whirr quietly like a freewheeling bike chain. Faster turns click brighter and louder.
// Only starts after a touch or click (browsers allow sound only then).

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (!ctx) {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a pointer or key event so the browser lets the dial make sound. */
export const wakeSound = () => void audio();

function burst(at: number, freq: number, q: number, peak: number, len: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(band).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + len + 0.01);
}

/** `speed` 0 (slow) to 1 (fast). `major`: a look clicks into place; otherwise a chain tooth goes by. */
export function tick(speed: number, major: boolean) {
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  const s = Math.min(1, Math.max(0, speed));
  if (major) {
    burst(t, 2200 + s * 2200, 5, 0.32 + s * 0.3, 0.03); // the pawl
    burst(t + 0.006, 900, 2, 0.12 + s * 0.1, 0.02); // its body against the case
  } else {
    burst(t, 4200 + s * 1800, 8, 0.05 + s * 0.09, 0.012);
  }
}
