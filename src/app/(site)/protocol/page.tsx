import type { Metadata } from 'next';
import { CodeBlock, DataTable, DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { SIM_CEIL, SIM_FLOOR } from '@/lib/ai/matcher';
import { SKILL_ALIASES } from '@/lib/scraper/utils';

export const metadata: Metadata = {
  title: 'Protocol',
  description: 'How RADAR scores a job, when a match enters your Vault, and how the data stays fresh.',
};

const TOC = [
  { id: 'scoring', label: 'SCORING' },
  { id: 'signals', label: 'SIGNALS' },
  { id: 'lifecycle', label: 'LIFECYCLE' },
  { id: 'auto-vault', label: 'AUTO_VAULT' },
  { id: 'freshness', label: 'FRESHNESS' },
  { id: 'privacy', label: 'PRIVACY' },
];

const SCORE = `similarity = cos(resume, job)                  # multilingual-e5-large · 1024-d
meaning    = clamp((similarity - ${SIM_FLOOR}) / ${(SIM_CEIL - SIM_FLOOR).toFixed(2)}) x 100
skills     = |yours ∩ job's| / |job's| x 100

score  = 0.6 x meaning + 0.4 x skills
         # meaning alone when the job or your profile lists no skills
score += 10   title contains one of your target roles
score -= 30   role asks 5+ years and you have fewer than 4
score -= 15   role asks 3-5 years and you have fewer than 2
score +=  5   entry-level role and you have 2 years or less
score +=  5   in one of your cities   |  +3 remote, and you want remote
score -= 10   remote you did not ask for   |  -25 anywhere else
score +=  5   posted in the last 4 days   |  -5 after 45 days  |  -10 after 90
score  = round(clamp(score, 0, 100))`;

const LIFECYCLE = `  NEW ──save / auto-vault──▶ SAVED ──apply──▶ APPLIED
   │                          │                 │
   └──── not for me ──────────┴──── remove ──▶ DISMISSED

  APPLIED ──back to vault──▶ SAVED        DISMISSED is final`;

export default function ProtocolPage() {
  const skills = Object.keys(SKILL_ALIASES).length;
  return (
    <>
      <PageHero
        command="cat /etc/radar/protocol.rfc"
        title="PROTOCOL"
        lead="The rules RADAR follows to decide what is worth your time: how a job is scored, when it moves into your Vault, and how the data stays fresh. Everything here mirrors the code that runs it."
        meta={[
          ['SPEC', 'RFC-0001'],
          ['SCALE', '0-100'],
          ['VAULT BAR', '80%'],
          ['SKILLS', String(skills)],
        ]}
      />

      <DocLayout toc={TOC}>
        <DocSection id="scoring" index="01" kicker="SCORING" title="One number, zero guesswork">
          <p>
            Every open job is scored against your profile on a 0-100 scale. The base is a blend of meaning and skills;
            role, seniority and location then move it up or down.
          </p>
          <CodeBlock label="src/lib/ai/matcher.ts" status="SPEC">
            {SCORE}
          </CodeBlock>
          <p>
            Why stretch the similarity? e5 packs its scores into a narrow band: unrelated text still lands near{' '}
            {SIM_FLOOR}, strong matches around {SIM_CEIL}. Stretching that band onto 0-100 makes the difference visible.
          </p>
        </DocSection>

        <DocSection id="signals" index="02" kicker="SIGNALS" title="What RADAR looks at">
          <DataTable
            label="SIGNAL MATRIX"
            head={['SIGNAL', 'READ FROM', 'EFFECT']}
            rows={[
              ['meaning', 'Resume vs job description embeddings', '60% of the base'],
              [
                'skills',
                `${skills} canonical skills, alias-aware (ReactJS = React, k8s = Kubernetes)`,
                '40% of the base',
              ],
              ['target role', 'Preferences → Target roles', '+10'],
              ['seniority', 'Job title first, then "N+ years" in the description', '-30 to +5'],
              ['location', 'Your cities vs the job location, with aliases (Bengaluru = Bangalore)', '-25 to +5'],
              ['freshness', 'When the posting went up: early applicants get read', '-10 to +5'],
            ]}
          />
          <p>
            Until you confirm your own skills in Preferences, the skills found in your resume are used. A job that lists
            no recognisable skills is judged on meaning alone, so it can never outrank a real match just by being vague.
          </p>
        </DocSection>

        <DocSection id="lifecycle" index="03" kicker="LIFECYCLE" title="Where a match can go">
          <CodeBlock label="match_scores.status" status="STATE MACHINE">
            {LIFECYCLE}
          </CodeBlock>
          <Points
            items={[
              ['NEW', 'Shown in Discovery, sorted by score, split into Dream, Recommended and Startups.'],
              ['SAVED', 'In your Vault, saved by you or by auto-vault.'],
              ['APPLIED', 'On the Battlefield. Opening the apply link moves it here.'],
              ['DISMISSED', 'Hidden for good. Rescoring never brings it back.'],
            ]}
          />
        </DocSection>

        <DocSection id="auto-vault" index="04" kicker="AUTO_VAULT" title="When a match saves itself">
          <Points
            items={[
              ['RULE', 'After a scan, every match still NEW with a score at or above your threshold becomes SAVED.'],
              ['THRESHOLD', '80 by default; anything from 40 to 95 in Preferences. Auto-vault can be switched off.'],
              [
                'VERIFIED',
                'A job-board posting has its apply link opened first; a closed one never enters the Vault. Company ATS feeds only list open roles.',
              ],
              [
                'OVERCLOCK',
                'Optional: the AI tailors your resume for 50-79% matches (a daily cap you set); a projection at or above your bar moves the job into the Vault with that CV attached.',
              ],
              [
                'RESPECT',
                'Only NEW matches are promoted. Rescoring updates the score and the reasons, never a status you set.',
              ],
            ]}
          />
        </DocSection>

        <DocSection id="freshness" index="05" kicker="FRESHNESS" title="Keeping the feed honest">
          <Points
            items={[
              [
                'CADENCE',
                'Every 6 hours through GitHub Actions (discover → scrape and match → autopilot), plus daily through Vercel Cron at 01:30, 02:30 and 03:30 UTC. Startup directories are re-read every 48h.',
              ],
              [
                'CHANGE DETECTION',
                'A sha1 hash of title, location, apply link and description (whitespace ignored). Unchanged jobs are not re-embedded.',
              ],
              [
                'TAKEDOWNS',
                'A posting missing from a successful scrape of its company is closed and its vector deleted, so dead jobs cannot crowd your results.',
              ],
              [
                'RE-CHECKED',
                'Every job-board posting in your Vault is opened again each day; one that has closed leaves the Vault on the next scan.',
              ],
              ['BUDGET', 'About 285 seconds per run; big employers are capped at 150 roles each.'],
            ]}
          />
        </DocSection>

        <DocSection id="privacy" index="06" kicker="PRIVACY" title="What happens to your data">
          <Points
            items={[
              ['RESUME', 'Parsed on the server. Its text is used for matching and is never sent back to the browser.'],
              [
                'ACCESS',
                'The database is only reached from the server. Your browser talks to RADAR’s own API, authenticated by Clerk on every call.',
              ],
              [
                'CONTROL',
                'Edit skills, roles, cities, companies or your resume in Preferences; the next scan uses them.',
              ],
              [
                'GMAIL',
                'Optional and read-only. RADAR reads the subject, sender and preview of recruiter replies, stores only the verdict, keeps the token encrypted (AES-256-GCM) and revokes it when you disconnect.',
              ],
            ]}
          />
        </DocSection>
      </DocLayout>
    </>
  );
}
