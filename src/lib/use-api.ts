'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

const TOKEN_MS = 6_000;
const GET_MS = 30_000;

const within = <T>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/**
 * fetch() for our own API routes that always carries a fresh Clerk session token.
 * The session cookie is short-lived and refreshed in the background; a request sent while it
 * is stale (e.g. after sitting in a file picker) would otherwise come back 401.
 * A token that never arrives (Clerk still booting) or a GET that never answers (cold function) used to
 * leave the dashboard loading forever: both are timed out, and a timed-out GET is tried once more.
 */
export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (input: string, init: RequestInit = {}) => {
      const isGet = !init.method || init.method.toUpperCase() === 'GET';
      const send = async (skipCache: boolean) => {
        const token = await within(
          getToken({ skipCache }).catch(() => null),
          TOKEN_MS,
          null,
        );
        const headers = new Headers(init.headers);
        if (token) headers.set('authorization', 'Bearer ' + token);
        // Only plain GETs get a deadline: POSTs (drafting answers, scans) may run for minutes on purpose.
        const signal = isGet && !init.signal ? AbortSignal.timeout(GET_MS) : init.signal;
        return fetch(input, { ...init, headers, signal });
      };
      const once = async () => {
        const res = await send(false);
        return res.status === 401 ? send(true) : res;
      };
      if (!isGet) return once();
      try {
        return await once();
      } catch (err) {
        if ((err as Error)?.name !== 'TimeoutError') throw err;
        return once();
      }
    },
    [getToken],
  );
}
