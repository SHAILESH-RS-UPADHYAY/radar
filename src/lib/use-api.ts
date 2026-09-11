'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

/**
 * fetch() for our own API routes that always carries a fresh Clerk session token.
 * The session cookie is short-lived and refreshed in the background; a request sent while it
 * is stale (e.g. after sitting in a file picker) would otherwise come back 401.
 */
export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (input: string, init: RequestInit = {}) => {
      const send = async (skipCache: boolean) => {
        const token = await getToken({ skipCache }).catch(() => null);
        const headers = new Headers(init.headers);
        if (token) headers.set('authorization', 'Bearer ' + token);
        return fetch(input, { ...init, headers });
      };
      const res = await send(false);
      return res.status === 401 ? send(true) : res;
    },
    [getToken],
  );
}
