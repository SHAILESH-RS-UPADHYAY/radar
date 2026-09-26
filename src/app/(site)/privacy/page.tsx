import type { Metadata } from 'next';
import { DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What RADAR stores about you, why, who processes it, and how to delete it.',
};

const UPDATED = '26 September 2026';

const TOC = [
  { id: 'collect', label: 'WHAT_WE_STORE' },
  { id: 'use', label: 'HOW_IT_IS_USED' },
  { id: 'processors', label: 'PROCESSORS' },
  { id: 'retention', label: 'RETENTION' },
  { id: 'security', label: 'SECURITY' },
  { id: 'choices', label: 'YOUR_CONTROLS' },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        command="cat /etc/radar/privacy"
        title="PRIVACY"
        lead="RADAR needs your resume to find jobs that fit you. This page says exactly what is stored, what it is used for, and how to remove it. No ads, no selling, no sharing with employers."
        meta={[
          ['UPDATED', '26.09.2026'],
          ['ADS', 'NONE'],
          ['DATA SOLD', 'NEVER'],
          ['DELETE', 'ANY TIME'],
        ]}
      />
      <DocLayout toc={TOC}>
        <DocSection id="collect" index="01" kicker="WHAT_WE_STORE" title="What RADAR stores">
          <Points
            items={[
              ['ACCOUNT', 'Your email, name and, if you add one, phone number, provided through sign-in.'],
              [
                'RESUME',
                'The text extracted from the PDF you upload. The PDF file itself is not kept. A numeric vector of that text is stored for matching.',
              ],
              [
                'PREFERENCES',
                'Target roles, skills, cities, experience, dream companies and your auto-vault settings.',
              ],
              ['ACTIVITY', 'Match scores and what you saved, applied to or dismissed.'],
            ]}
          />
          <p>RADAR does not collect payment details, and it sets no analytics or advertising cookies.</p>
        </DocSection>

        <DocSection id="use" index="02" kicker="HOW_IT_IS_USED" title="What it is used for">
          <p>
            Only to score open jobs against your profile and show you the results. RADAR never contacts employers, never
            applies on your behalf and never shares your profile with anyone to recruit you.
          </p>
        </DocSection>

        <DocSection id="processors" index="03" kicker="PROCESSORS" title="Who processes it">
          <Points
            items={[
              ['CLERK', 'Sign-in and sessions.'],
              ['SUPABASE', 'The database that holds your profile and matches.'],
              [
                'PINECONE',
                'Turns resume and job text into vectors for similarity search; your resume text is sent to it for that.',
              ],
              ['VERCEL', 'Hosts the app and runs the scheduled scans.'],
            ]}
          />
        </DocSection>

        <DocSection id="retention" index="04" kicker="RETENTION" title="How long it is kept">
          <p>
            For as long as your account exists. Deleting your account (user menu → Manage account → Delete account)
            removes your profile, resume, preferences and matches.
          </p>
        </DocSection>

        <DocSection id="security" index="05" kicker="SECURITY" title="How it is protected">
          <Points
            items={[
              ['IN TRANSIT', 'Every connection is encrypted over HTTPS.'],
              ['ACCESS', 'The database is reachable only from RADAR’s server, never directly from a browser.'],
              ['RESUME', 'After upload, the resume text stays on the server and is not sent back to your browser.'],
            ]}
          />
        </DocSection>

        <DocSection id="choices" index="06" kicker="YOUR_CONTROLS" title="What you control">
          <p>
            Edit or remove any preference, replace your resume or switch off auto-vault in Preferences at any time, or
            delete your account to remove everything.
            {CONTACT_EMAIL && (
              <>
                {' '}
                Questions:{' '}
                <a className="text-phosphor underline-offset-4 hover:underline" href={'mailto:' + CONTACT_EMAIL}>
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            )}
          </p>
          <p className="font-mono text-[11px] tracking-[0.2em] text-dim">LAST UPDATED {UPDATED.toUpperCase()}</p>
        </DocSection>
      </DocLayout>
    </>
  );
}
