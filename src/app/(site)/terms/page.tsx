import type { Metadata } from 'next';
import { DocLayout, DocSection, PageHero, Points } from '@/components/site/Doc';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using RADAR: what the service is, what it is not, and fair use.',
};

const UPDATED = '26 September 2026';

const TOC = [
  { id: 'service', label: 'THE_SERVICE' },
  { id: 'jobs', label: 'JOB_DATA' },
  { id: 'use', label: 'FAIR_USE' },
  { id: 'content', label: 'YOUR_CONTENT' },
  { id: 'warranty', label: 'NO_GUARANTEES' },
  { id: 'changes', label: 'CHANGES' },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        command="cat /etc/radar/terms"
        title="TERMS"
        lead="Plain-language terms for using RADAR. By creating an account you agree to them."
        meta={[
          ['UPDATED', '26.09.2026'],
          ['PRICE', 'FREE'],
          ['ACCOUNTS', '1 PER PERSON'],
          ['CANCEL', 'ANY TIME'],
        ]}
      />
      <DocLayout toc={TOC}>
        <DocSection id="service" index="01" kicker="THE_SERVICE" title="What RADAR is">
          <p>
            RADAR is a job-discovery tool. It collects openings from public company feeds and job boards, scores them
            against your profile and keeps a shortlist for you. Features may change as the product evolves.
          </p>
        </DocSection>

        <DocSection id="jobs" index="02" kicker="JOB_DATA" title="Job data comes from others">
          <Points
            items={[
              [
                'ACCURACY',
                'Postings are shown as their sources publish them. RADAR cannot promise a job is accurate or still open; always confirm on the employer’s site.',
              ],
              [
                'NO AFFILIATION',
                'RADAR is not affiliated with the companies it lists. Their names and marks belong to them.',
              ],
              ['SCORES', 'Match scores are estimates to help you prioritise, not predictions of any hiring decision.'],
            ]}
          />
        </DocSection>

        <DocSection id="use" index="03" kicker="FAIR_USE" title="Fair use">
          <Points
            items={[
              ['ONE PERSON', 'An account is for one person and you are responsible for activity on it.'],
              [
                'NO ABUSE',
                'Do not scrape RADAR, overload its API, or try to access anyone else’s data. Accounts that do may be suspended.',
              ],
              ['YOUR RESUME', 'Upload only a resume that is yours to share.'],
            ]}
          />
        </DocSection>

        <DocSection id="content" index="04" kicker="YOUR_CONTENT" title="Your content stays yours">
          <p>
            You own your resume and preferences. You allow RADAR to process them only to provide matches to you, as
            described in the privacy policy. Delete your account at any time to remove them.
          </p>
        </DocSection>

        <DocSection id="warranty" index="05" kicker="NO_GUARANTEES" title="No guarantees">
          <p>
            RADAR is provided as is, without warranties of any kind. To the extent the law allows, RADAR is not liable
            for indirect or consequential losses, including missed opportunities, arising from using the service.
          </p>
        </DocSection>

        <DocSection id="changes" index="06" kicker="CHANGES" title="Changes to these terms">
          <p>
            These terms may be updated; the date below changes when they do. Continuing to use RADAR after an update
            means you accept it.
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
