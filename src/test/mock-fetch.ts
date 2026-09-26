import { vi } from 'vitest';

/** Replace global fetch with a map of URL substring → response body (JSON unless a string). Unmatched URLs 404. */
export function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) return new Response('not found', { status: 404 });
    const body = hit[1];
    return typeof body === 'string' ? new Response(body) : Response.json(body);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
