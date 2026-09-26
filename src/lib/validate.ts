// Input rules shared by API routes and the browser. No server-only imports, so pages can use it too.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Why a file cannot be used as a resume, or null when it can. */
export function resumeProblem(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return 'The file is empty.';
  if (file.size > MAX_RESUME_BYTES) return 'Resume must be under 5 MB.';
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return 'Only PDF resumes are supported.';
  return null;
}
