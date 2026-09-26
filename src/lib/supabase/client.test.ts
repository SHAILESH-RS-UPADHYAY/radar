import { describe, expect, it } from 'vitest';
import { resilientFetch } from './client';

const connectTimeout = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
const reset = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });

/** A fake fetch that plays back a script of outcomes and counts calls. */
function scripted(outcomes: (Response | Error)[]) {
  let calls = 0;
  const fn = (async () => {
    const next = outcomes[Math.min(calls++, outcomes.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fn, calls: () => calls };
}

describe('resilientFetch', () => {
  it('retries a write whose connection never opened', async () => {
    const s = scripted([connectTimeout(), new Response('ok')]);
    const res = await resilientFetch(s.fn, [0, 0])('https://db/rest', { method: 'POST', body: '{}' });
    expect(await res.text()).toBe('ok');
    expect(s.calls()).toBe(2);
  });

  it('never repeats a write that may have reached the server', async () => {
    const s = scripted([reset(), new Response('ok')]);
    await expect(resilientFetch(s.fn, [0, 0])('https://db/rest', { method: 'PATCH' })).rejects.toThrow('fetch failed');
    expect(s.calls()).toBe(1);
    const gateway = scripted([new Response('', { status: 503 }), new Response('ok')]);
    expect((await resilientFetch(gateway.fn, [0, 0])('https://db/rest', { method: 'POST' })).status).toBe(503);
  });

  it('retries reads on gateway errors and dropped connections, then gives up', async () => {
    const s = scripted([new Response('', { status: 503 }), reset(), new Response('ok')]);
    expect(await (await resilientFetch(s.fn, [0, 0])('https://db/rest')).text()).toBe('ok');
    expect(s.calls()).toBe(3);
    const down = scripted([reset()]);
    await expect(resilientFetch(down.fn, [0, 0])('https://db/rest')).rejects.toThrow('fetch failed');
    expect(down.calls()).toBe(3);
  });
});
