import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { HudPanel } from '@/components/hud/Hud';
import { DataTable, DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { CATALOG, SOURCE_NAMES } from '@/lib/scraper/catalog';

export const metadata: Metadata = {
  title: 'Architecture',
  description: 'The serverless pipeline behind RADAR: Vercel, Supabase Postgres, Pinecone and Clerk.',
};

const TOC = [
  { id: 'topology', label: 'TOPOLOGY' },
  { id: 'run', label: 'ANATOMY_OF_A_RUN' },
  { id: 'data', label: 'DATA_MODEL' },
  { id: 'stack', label: 'STACK' },
  { id: 'reliability', label: 'RELIABILITY' },
  { id: 'security', label: 'SECURITY' },
];

function Node({ title, sub, tone = 'text-phosphor' }: { title: string; sub: ReactNode; tone?: string }) {
  return (
    <div className="border border-phosphor/20 bg-black/70 p-4">
      <p className={'font-mono text-xs font-bold tracking-[0.2em] ' + tone}>{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-dim">{sub}</p>
    </div>
  );
}

/** Connector between diagram columns: a flowing line on wide screens, an arrow when stacked. */
function Flow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden="true">
      <div className="flex flex-col items-center gap-1.5 font-mono text-[9px] tracking-[0.3em] text-phosphor/60">
        <span className="hud-flow hidden h-px w-12 lg:block" />
        <span className="text-phosphor lg:hidden">▼</span>
        {label}
      </div>
    </div>
  );
}

const PIPELINE: [string, string][] = [
  ['01 DISCOVER', 'StartupMap every 48h + your imports → ATS boards'],
  ['02 SCRAPE', `${CATALOG.sources} adapters, least recently scraped first`],
  ['03 EMBED', 'new or changed jobs → Pinecone'],
  ['04 CLOSE', 'missing postings → inactive, vectors deleted'],
  ['05 MATCH', 'every user with a resume → match_scores'],
  ['06 VERIFY', 'board postings opened before the Vault'],
  ['07 VAULT', 'score ≥ your bar (80 by default) → saved'],
  ['08 AUTOPILOT', 'Vault re-check · Gmail replies · auto-OVERCLOCK'],
];

export default function ArchitecturePage() {
  return (
    <>
      <PageHero
        command="radar --graph"
        title="ARCHITECTURE"
        lead="A serverless pipeline on Vercel. Scheduled runs scrape the sources, Pinecone turns jobs into vectors, Postgres keeps the state, and the dashboard reads it back through authenticated API routes."
        meta={[
          ['RUNTIME', 'VERCEL'],
          ['DATABASE', 'POSTGRES'],
          ['VECTORS', 'PINECONE'],
          ['AUTH', 'CLERK'],
        ]}
      />

      <DocLayout toc={TOC}>
        <DocSection id="topology" index="01" kicker="TOPOLOGY" title="How the pieces connect">
          <HudPanel label="WRITE PATH · /api/cron/*" status="SCHEDULED" bodyClassName="p-4 sm:p-6">
            <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1.35fr_auto_1fr] lg:gap-4">
              <div className="space-y-3">
                <p className="font-mono text-[10px] tracking-[0.3em] text-dim">TRIGGERS</p>
                <Node title="GITHUB ACTIONS" sub="every 6h · 15 */6 * * *" />
                <Node title="VERCEL CRON" sub="daily · discover 01:30 · pipeline 02:30 · autopilot 03:30" />
              </div>
              <Flow label="BEARER" />
              <div>
                <p className="mb-3 font-mono text-[10px] tracking-[0.3em] text-dim">PIPELINE · NEXT.JS ROUTE · 300s</p>
                <ol className="border border-phosphor/30 bg-phosphor/[0.03]">
                  {PIPELINE.map(([step, sub]) => (
                    <li
                      key={step}
                      className="flex flex-col gap-0.5 border-b border-phosphor/15 px-4 py-2.5 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4"
                    >
                      <span className="font-mono text-xs font-bold tracking-[0.2em] text-phosphor">{step}</span>
                      <span className="text-xs text-dim">{sub}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <Flow label="SERVICE ROLE" />
              <div className="space-y-3">
                <p className="font-mono text-[10px] tracking-[0.3em] text-dim">STATE</p>
                <Node
                  title="SUPABASE POSTGRES"
                  sub="companies · jobs · match_scores · discovery queue · ops events"
                  tone="text-hud-cyan"
                />
                <Node title="PINECONE" sub="e5-large inference · 1024-d cosine index" tone="text-hud-cyan" />
              </div>
            </div>
            <div className="mt-6 border-t border-dashed border-phosphor/15 pt-5">
              <p className="font-mono text-[10px] tracking-[0.3em] text-dim">UPSTREAM SOURCES</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.values(SOURCE_NAMES).map((name) => (
                  <span
                    key={name}
                    className="border border-phosphor/20 px-2.5 py-1 font-mono text-[10px] tracking-wider text-phosphor/75"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </HudPanel>

          <HudPanel label="READ PATH · DASHBOARD" status="ON DEMAND" tone="info" bodyClassName="p-4 sm:p-6">
            <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1.35fr_auto_1fr] lg:gap-4">
              <Node title="BROWSER" sub="Discovery · Vault · Battlefield · Preferences" tone="text-hud-amber" />
              <Flow label="CLERK JWT" />
              <Node
                title="API ROUTES"
                sub="/api/dashboard · /api/jobs/:id · /api/vault · /api/match · /api/overclock · /api/gmail · /api/settings"
              />
              <Flow label="SERVER ONLY" />
              <Node
                title="POSTGRES + PINECONE"
                sub="read matches · write status · rescore on demand"
                tone="text-hud-cyan"
              />
            </div>
          </HudPanel>
        </DocSection>

        <DocSection id="run" index="02" kicker="ANATOMY_OF_A_RUN" title="Anatomy of a run">
          <DataTable
            label="TIMELINE"
            head={['WHEN', 'WHAT HAPPENS']}
            rows={[
              ['t+0s', 'A pipeline_runs row records the trigger (GitHub Actions, Vercel Cron or manual).'],
              [
                '0-215s',
                'Scrape: 4 companies in parallel, least recently scraped first. No new company starts in the last 25s.',
              ],
              [
                'per company',
                'Fetch (big employers capped at 150 roles) → upsert by (company, external_id) → embed changed jobs → close missing ones → scrape_logs row.',
              ],
              ['until 285s', 'Match: users least recently matched first, stopping 15s before the deadline.'],
              ['end', 'pipeline_runs is updated with counts and any per-company failures.'],
              [
                'before',
                '/api/cron/discover reads StartupMap (robots.txt obeyed, 1 request / 1.5s) and your imports, and adds each company whose ATS board it can verify.',
              ],
              [
                'after',
                '/api/cron/autopilot re-checks Vault postings, reads linked Gmail inboxes and runs auto-OVERCLOCK within its daily cap.',
              ],
            ]}
          />
        </DocSection>

        <DocSection id="data" index="03" kicker="DATA_MODEL" title="Where everything lives">
          <DataTable
            label="POSTGRES · SUPABASE"
            head={['TABLE', 'HOLDS', 'KEY']}
            rows={[
              ['companies', 'Seeded from the source list; ATS provider and token', 'name'],
              ['jobs', 'Every posting, its skills, content hash and open/closed state', '(company_id, external_id)'],
              [
                'user_profiles',
                'Resume text and vector, skills, target roles, cities, vault settings',
                'Clerk user id',
              ],
              ['user_dream_companies', 'Your picked companies', '(user_id, company_id)'],
              ['match_scores', 'Score, reasons and Vault status per user and job', '(user_id, job_id)'],
              ['scrape_logs', 'One row per company per run', 'id'],
              ['pipeline_runs', 'One row per pipeline run, with counts and failures', 'id'],
              [
                'discovered_companies',
                'Startups from StartupMap or your imports, waiting for their ATS feed',
                '(source, source_ref)',
              ],
              ['source_state', 'Per-directory crawl state: last sync, resume cursor, pause', 'source'],
              ['tailored_resumes', 'OVERCLOCK: one tailored resume per user and job', '(user_id, job_id)'],
              ['gmail_links', 'Read-only Gmail link, refresh token encrypted', 'user_id'],
              ['ops_events', 'What RADAR learned about each application, and from where', '(user_id, external_id)'],
            ]}
          />
          <p>
            Pinecone holds one vector per open job in the <span className="font-mono text-phosphor">radar-jobs</span>{' '}
            index (1024 dimensions, cosine), keyed by the job id, so a search hit maps straight back to Postgres.
          </p>
        </DocSection>

        <DocSection id="stack" index="04" kicker="STACK" title="Built with">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['NEXT.JS 16', 'App Router pages and route handlers; after() for background work'],
              ['REACT 19', 'Client islands for the dashboard, settings and hero'],
              ['CLERK', 'Sign-in, sessions and a fresh JWT on every API call'],
              ['SUPABASE', 'Managed Postgres for all state'],
              ['PINECONE', 'Serverless vector index and e5-large embeddings'],
              ['VERCEL', 'Hosting, functions and the daily cron'],
              ['GITHUB ACTIONS', '6-hourly pipeline trigger and CI'],
              ['TAILWIND 4 · MOTION', 'HUD design tokens and animation'],
              [
                'GROQ · GEMINI · ANTHROPIC · GROK',
                'OVERCLOCK and form answers; AI_PROVIDER picks, the others fall back',
              ],
              ['GMAIL API', 'Read-only recruiter replies for C2 · OPS'],
              ['VITEST', 'Unit tests for scoring, parsing, discovery and adapters'],
            ].map(([name, what]) => (
              <Node key={name} title={name} sub={what} />
            ))}
          </div>
        </DocSection>

        <DocSection id="reliability" index="05" kicker="RELIABILITY" title="Built to keep running">
          <Points
            items={[
              ['RESUMABLE', 'A run that hits its time limit stops cleanly; the next one starts with what it skipped.'],
              [
                'ISOLATED FAILURES',
                'A broken source is logged and its timestamp still advances, so it can never block the queue.',
              ],
              [
                'CONFIRMED WRITES',
                'A job keeps an empty content hash until Pinecone confirms its vector, so a failed embed retries next run.',
              ],
              ['NON-BLOCKING', 'The sign-up scrape runs after the response, so a slow ATS cannot fail onboarding.'],
              ['CI', 'Every push runs typecheck, lint, tests and a production build.'],
            ]}
          />
        </DocSection>

        <DocSection id="security" index="06" kicker="SECURITY" title="Locked down by default">
          <Points
            items={[
              ['SECRETS', 'The Supabase service-role key never leaves the server; the browser has no database access.'],
              ['SESSIONS', 'Every API call carries a fresh Clerk token, retried once with a new one if it expires.'],
              ['CRON', 'Every /api/cron/* endpoint requires a Bearer CRON_SECRET in production.'],
              [
                'CRAWLING',
                'Directories are read only where robots.txt allows, with an honest bot name and a pause at the first "slow down". No evasion, ever.',
              ],
              [
                'GMAIL',
                'Read-only scope, CSRF-checked OAuth, refresh token sealed with AES-256-GCM, revoked on disconnect.',
              ],
              [
                'INPUT',
                'Validated at the edge: ids must be UUIDs, resumes must be PDFs under 4 MB, list fields are capped.',
              ],
            ]}
          />
        </DocSection>
      </DocLayout>
    </>
  );
}
