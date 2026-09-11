import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function createBrowserClient() {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey());
}

/** Service-role client. Server only: bypasses row-level security. */
export function createServerClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), { auth: { persistSession: false } });
}
