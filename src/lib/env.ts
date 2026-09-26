// ============================
// RADAR — Environment access
// ============================
// Every server-side secret is read through here so a missing key fails with one clear
// message (what is missing and where to get it) instead of a vague error deep in a request.

const WHERE: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase → Project Settings → API',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase → Project Settings → API Keys (publishable key)',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase → Project Settings → API Keys (secret key)',
  PINECONE_API_KEY: 'app.pinecone.io → API Keys',
};

export class MissingEnvError extends Error {
  constructor(public readonly names: string[]) {
    super(
      'Missing environment variable' +
        (names.length > 1 ? 's' : '') +
        ': ' +
        names.map((n) => n + (WHERE[n] ? ' (' + WHERE[n] + ')' : '')).join(', ') +
        '. Add to .env.local and restart the dev server.',
    );
    this.name = 'MissingEnvError';
  }
}

/** Trimmed, and without the quotes a dashboard paste sometimes keeps ("pcsk_…" in quotes is not a valid key). */
const clean = (value: string) =>
  value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();

/** An optional server variable, cleaned the same way; null when unset. */
export const readEnv = (name: string): string | null => clean(process.env[name] || '') || null;

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new MissingEnvError([name]);
  return clean(value);
}

// NEXT_PUBLIC_* must be referenced literally so Next can inline them into client bundles.
export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceKey: () => required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  pineconeApiKey: () => required('PINECONE_API_KEY', process.env.PINECONE_API_KEY),
  pineconeIndex: () => clean(process.env.PINECONE_INDEX_NAME || '') || 'radar-jobs',
  cronSecret: () => clean(process.env.CRON_SECRET || '') || null,
};

/** Names of server keys that are not set — for health checks and startup logs. */
export function missingServerEnv(): string[] {
  return ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PINECONE_API_KEY'].filter(
    (n) => !process.env[n]?.trim(),
  );
}
