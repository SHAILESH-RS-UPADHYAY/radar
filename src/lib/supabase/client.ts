import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const TIMEOUT_MS = 25_000;
const RETRY_DELAYS_MS = [300, 1000];
// Raised before the request reaches the server, so retrying can never apply a write twice.
const CONNECT_ERRORS = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);
const RETRY_STATUSES = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errorCode = (err: unknown) =>
  (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code ?? '';

/**
 * fetch with a per-request timeout and retries for transient failures:
 * connection failures for any method; gateway errors and dropped connections for reads only,
 * since repeating a write that may have reached the server is not safe.
 */
export function resilientFetch(base: typeof fetch = fetch, delays: number[] = RETRY_DELAYS_MS): typeof fetch {
  return async (input, init = {}) => {
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD';
    for (let attempt = 0; ; attempt++) {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      try {
        const res = await base(input, { ...init, signal });
        if (isRead && RETRY_STATUSES.has(res.status) && attempt < delays.length) {
          await sleep(delays[attempt]);
          continue;
        }
        return res;
      } catch (err) {
        if (init.signal?.aborted) throw err; // the caller cancelled
        const retryable = CONNECT_ERRORS.has(errorCode(err)) || isRead;
        if (!retryable || attempt >= delays.length) throw err;
        await sleep(delays[attempt]);
      }
    }
  };
}

/** Service-role client. Server only: bypasses row-level security. */
export function createServerClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false },
    global: { fetch: resilientFetch() },
  });
}
