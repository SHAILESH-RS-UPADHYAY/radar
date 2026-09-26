import type { Metadata } from 'next';
import Link from 'next/link';
import { HudPanel, StatusLight } from '@/components/hud/Hud';
import { CodeBlock, DataTable, DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { CATALOG, SOURCE_NAMES, sourceName } from '@/lib/scraper/catalog';
import { COMPANY_SEEDS } from '@/lib/scraper/companies';
import { BOARD_PROVIDERS } from '@/lib/scraper/boards';
import type { Provider } from '@/types';

export const metadata: Metadata = {
  title: 'System',
  description: 'How RADAR works: dream company tracking, AI semantic matching, the automated scan loop and the Vault.',
};

const TOC = [
  { id: 'dream-tracking', label: 'DREAM_TRACK' },
  { id: 'semantic-matching', label: 'SEMANTIC_MATCH' },
  { id: 'scan-loop', label: 'SCAN_LOOP' },
  { id: 'vault', label: 'THE_VAULT' },
  { id: 'sources', label: 'SOURCES' },
  { id: 'companies', label: 'COMPANY_INDEX' },
];

const feeds = CATALOG.tracked + CATALOG.boards.length;
const perProvider = (p: Provider) => COMPANY_SEEDS.filter((c) => c.ats_provider === p).length;
const boards = new Set<string>(BOARD_PROVIDERS);
const ATS = (Object.keys(SOURCE_NAMES) as Exclude<Provider, 'custom'>[]).filter((p) => !boards.has(p));

const LOOP_LOG = `[cron]   trigger=github-actions   budget=285s
[scrape] 4 companies in parallel · least recently scraped first
[upsert] jobs keyed by (company, external_id)
[embed]  changed only · sha1(title, location, url, description)
[close]  postings missing from this run → inactive · vectors deleted
[match]  every user with a resume → match_scores
[vault]  score ≥ your threshold → saved (auto)`;

const STEPS: [string, string][] = [
  ['EMBED', 'Your resume and every job become 1024-dimension vectors (multilingual-e5-large on Pinecone).'],
  ['RETRIEVE', 'Pinecone returns the 400 jobs whose vectors sit closest to yours, by cosine similarity.'],
  ['SCORE', 'Each one gets a 0-100 score: meaning and skills first, then target role, seniority and location.'],
  ['EXPLAIN', 'Every card shows why: matched and missing skills, how well it aligns, and any penalty applied.'],
];

export default function SystemPage() {
  return (
    <>
      <PageHero
        command="man radar"
        title="SYSTEM"
        lead="RADAR is a personal job-intelligence engine. It watches the careers pages of the companies you care about, reads every opening, scores each one against your profile and saves the strong ones to your Vault, every six hours, on its own."
        meta={[
          ['SOURCES', String(CATALOG.sources)],
          ['COMPANIES', String(CATALOG.companies)],
          ['LIVE FEEDS', String(feeds)],
          ['CYCLE', '6H'],
        ]}
      />

      <DocLayout toc={TOC}>
        <DocSection id="dream-tracking" index="01" kicker="MODULE://A · DREAM_TRACK" title="Dream company tracking">
          <p>
            You pick the companies you actually want to work at, up to 20, during onboarding or any time in Preferences.
            RADAR treats them differently from everything else:
          </p>
          <Points
            items={[
              [
                'ALWAYS SCORED',
                'Semantic search returns the 400 jobs closest to your resume. Every open role at a dream company is scored on top of that, so nothing there slips through.',
              ],
              ['OWN LANE', 'Their jobs appear under DREAM in Discovery, apart from Recommended and Startups.'],
              [
                'CITY-AWARE',
                'The picker only offers companies that really hire in your cities: live job evidence plus a hand-checked list of offices.',
              ],
              [
                'FRESH ON DAY 1',
                'Finishing onboarding starts a background scrape of your dream companies, so the first scan runs on fresh data.',
              ],
            ]}
          />
          <p>
            Companies without a public feed can still be picked; they are marked <em>selectable</em> below and are
            scraped as soon as a feed is wired up.
          </p>
        </DocSection>

        <DocSection id="semantic-matching" index="02" kicker="MODULE://B · SEMANTIC_MATCH" title="AI semantic matching">
          <p>
            Keyword search misses a Backend Engineer posting that asks for exactly what you have done, just in other
            words. RADAR compares meaning instead.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map(([title, body], i) => (
              <HudPanel key={title} bodyClassName="p-5">
                <p className="font-mono text-[10px] tracking-[0.3em] text-phosphor">
                  STEP {String(i + 1).padStart(2, '0')} · {title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-dim">{body}</p>
              </HudPanel>
            ))}
          </div>
          <p>
            Exact weights and thresholds are in the{' '}
            <Link href="/protocol#scoring" className="text-phosphor underline-offset-4 hover:underline">
              protocol spec
            </Link>
            .
          </p>
        </DocSection>

        <DocSection id="scan-loop" index="03" kicker="MODULE://C · SCAN_LOOP" title="Automated scan loop">
          <p>
            Every six hours a GitHub Actions schedule, backed by a daily Vercel Cron, calls the pipeline. One run does
            everything:
          </p>
          <CodeBlock label="/var/log/radar/cron.log" status="TAIL -F">
            {LOOP_LOG}
          </CodeBlock>
          <p>
            Runs are time-boxed. A run that reaches its limit stops cleanly, and the next one starts with the companies
            it skipped.
          </p>
        </DocSection>

        <DocSection id="vault" index="04" kicker="THE_VAULT" title="The Vault">
          <p>
            The Vault is your shortlist. Matches at or above your threshold (70% by default, adjustable in Preferences)
            are saved automatically after every scan, tagged <span className="text-phosphor">AUTO-MATCHED</span>. You
            can also save anything from Discovery yourself.
          </p>
          <div className="grid gap-3 font-mono text-xs sm:grid-cols-4">
            {[
              ['DISCOVERY', 'new matches', 'ok'],
              ['VAULT', 'saved / auto', 'ok'],
              ['BATTLEFIELD', 'applied', 'info'],
              ['DISMISSED', 'never returns', 'alert'],
            ].map(([name, sub, tone]) => (
              <div key={name} className="border border-phosphor/20 bg-black/60 p-4">
                <StatusLight tone={tone as 'ok' | 'info' | 'alert'} pulse={false}>
                  {name}
                </StatusLight>
                <p className="mt-2 text-dim">{sub}</p>
              </div>
            ))}
          </div>
          <p>Removing a job from the Vault dismisses it, and a dismissed job is never shown or auto-saved again.</p>
        </DocSection>

        <DocSection id="sources" index="05" kicker="SOURCES" title={`${CATALOG.sources} sources, read at the origin`}>
          <p>
            RADAR reads the same public feeds a company&apos;s own careers page is built on, so jobs arrive the moment
            they are posted, with the real apply link.
          </p>
          <DataTable
            label="COMPANY ATS FEEDS"
            head={['ADAPTER', 'COMPANIES', 'READS']}
            rows={ATS.map((p) => [SOURCE_NAMES[p], String(perProvider(p)), 'Public job-board API of each company'])}
          />
          <DataTable
            label="JOB BOARDS"
            head={['BOARD', 'REGION', 'READS']}
            rows={CATALOG.boards.map((b) => [
              b.name,
              b.country,
              b.ats_provider === 'hackernews' ? 'Latest "Who is hiring" thread' : 'Tech listings, remote-first',
            ])}
          />
        </DocSection>

        <DocSection id="companies" index="06" kicker="COMPANY_INDEX" title={`${CATALOG.companies} companies indexed`}>
          <p>
            <span className="text-phosphor">{CATALOG.tracked}</span> are scraped every cycle; the rest are selectable as
            dream companies.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {CATALOG.byCategory.map(({ category, companies }) => (
              <HudPanel
                key={category}
                label={category.toUpperCase()}
                status={String(companies.length)}
                tone="idle"
                bodyClassName="p-0"
              >
                <ul className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {companies.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center justify-between gap-3 border-b border-phosphor/10 px-4 py-2.5 last:border-b-0"
                    >
                      <span className={'text-sm ' + (c.ats_provider === 'custom' ? 'text-dim' : 'text-ink')}>
                        {c.name}
                      </span>
                      <span
                        className={
                          'font-mono text-[10px] tracking-wider ' +
                          (c.ats_provider === 'custom' ? 'text-dim/60' : 'text-phosphor/70')
                        }
                      >
                        {sourceName(c.ats_provider)}
                      </span>
                    </li>
                  ))}
                </ul>
              </HudPanel>
            ))}
          </div>
        </DocSection>
      </DocLayout>
    </>
  );
}
