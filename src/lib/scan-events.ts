// What a scan reports while it runs (POST /api/match?stream=1 sends one JSON event per line).
// Shared by the match pipeline and the SCAN://LIVE console, so no server-only imports here.

export interface ScanTop {
  company: string;
  title: string;
  score: number;
}

export type ScanEvent =
  | { stage: 'retire'; closed: number }
  | { stage: 'profile'; skills: number; roles: number; cities: number }
  | { stage: 'vector'; cached: boolean; dims: number }
  /** The closest jobs by meaning; `sims` is a sample (best first) the console plots as blips. */
  | { stage: 'search'; candidates: number; min: number; max: number; sims: number[] }
  | { stage: 'load'; jobs: number; dream: number }
  /** `scores` line up with the `sims` sample; bands are 80+, 50–79, below 50. */
  | { stage: 'score'; scored: number; bar: number; bands: [number, number, number]; scores: number[]; top: ScanTop[] }
  | { stage: 'gate'; strong: number; waiting: number; closed: number }
  | { stage: 'vault'; vaulted: number }
  | { stage: 'done'; total: number; vaulted: number; retired: number; message?: string }
  | { stage: 'error'; error: string; status: number };

export type ScanStage = Exclude<ScanEvent['stage'], 'done' | 'error'>;

/** The pipeline as the console draws it, in order. */
export const SCAN_STAGES: { stage: ScanStage; label: string; call: string }[] = [
  { stage: 'retire', label: 'RETIRE://CLOSED', call: 'supabase.match_scores ⟵ jobs.is_active = false' },
  { stage: 'profile', label: 'PROFILE://LOAD', call: 'supabase.user_profiles.select(skills, roles, cities)' },
  { stage: 'vector', label: 'VECTOR://RESUME', call: 'pinecone.inference.embed(llama-text-embed-v2)' },
  { stage: 'search', label: 'PGVECTOR://TOP-K', call: 'rpc(match_jobs, resume, topK)' },
  { stage: 'load', label: 'SUPABASE://JOBS', call: 'jobs.select(…).in(ids).eq(is_active, true)' },
  { stage: 'score', label: 'SCORE://MATRIX', call: '0.6·meaning + 0.4·skills ± role, seniority, place, freshness' },
  { stage: 'gate', label: 'GATE://VERIFY', call: 'open the apply links of board jobs before they enter' },
  { stage: 'vault', label: 'VAULT://COMMIT', call: "match_scores.status ⟵ 'saved'" },
];
