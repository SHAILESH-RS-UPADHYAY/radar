import { describe, expect, it } from 'vitest';
import {
  classifyEmail,
  employerFromMail,
  isRecruitingMail,
  matchApplication,
  messageBodies,
  nextStage,
  roleFromMail,
  type Application,
} from './gmail';

describe('classifyEmail', () => {
  it('reads the common recruiter replies', () => {
    expect(classifyEmail('Your application to Stripe', 'Thank you for applying to the Backend Engineer role.')).toBe(
      'received',
    );
    expect(
      classifyEmail(
        'Update on your application',
        'Unfortunately, we have decided to move forward with other candidates.',
      ),
    ).toBe('rejection');
    expect(classifyEmail('Next steps', 'We would love to schedule a call. Please share your availability.')).toBe(
      'interview',
    );
    expect(classifyEmail('Coding challenge', 'Please complete this HackerRank assessment within 5 days.')).toBe(
      'assessment',
    );
    expect(classifyEmail('Offer letter', 'We are pleased to offer you the position.')).toBe('offer');
  });

  it('treats a rejection that mentions interviews as a rejection, and ignores unrelated mail', () => {
    expect(classifyEmail('Interview update', 'We will not be moving forward to the interview stage.')).toBe(
      'rejection',
    );
    expect(classifyEmail('Update', "We won't be proceeding with your application.")).toBe('rejection');
    expect(classifyEmail('Next steps', 'We are excited to move forward with your application!')).toBe('interview');
    expect(classifyEmail('Your order has shipped', 'Track your package.')).toBeNull();
  });

  it('finds a rejection below the thanks, but not a stray "unfortunately" in a confirmation footer', () => {
    const thanks = 'Thank you for your interest in Cohere and the Forward Deployed Engineer role.';
    expect(
      classifyEmail(
        'Your application to Cohere',
        thanks,
        thanks + ' After careful review we have decided to move forward with other candidates.',
      ),
    ).toBe('rejection');
    expect(
      classifyEmail(
        'Application received',
        'Thank you for applying!',
        'Unfortunately we cannot reply to every applicant.',
      ),
    ).toBe('received');
  });
});

describe('matchApplication', () => {
  const apps: Application[] = [
    { id: 'w', stage: 'applied', title: 'Data Engineer', company: 'Wise', applied_at: '2026-09-01' },
    { id: 's1', stage: 'applied', title: 'Backend Engineer', company: 'Stripe', applied_at: '2026-09-10' },
    { id: 's2', stage: 'applied', title: 'AI Engineer', company: 'Stripe', applied_at: '2026-09-20' },
  ];

  it('needs the company as a whole word', () => {
    expect(matchApplication('Otherwise we will be in touch', apps)).toBeNull();
    expect(matchApplication('Wise Recruiting <no-reply@wise.com>', apps)?.id).toBe('w');
  });

  it('prefers the role named in the email, else the latest application', () => {
    expect(matchApplication('Stripe: your Backend Engineer application', apps)?.id).toBe('s1');
    expect(matchApplication('Stripe <jobs@stripe.com> thanks for applying', apps)?.id).toBe('s2');
  });
  it('files mail about a role none of your applications has as a new application, not under the latest one', () => {
    expect(matchApplication('Stripe <jobs@stripe.com> about your application', apps, 'Data Scientist')).toBeNull();
    expect(matchApplication('Stripe <jobs@stripe.com> about your application', apps, 'backend engineer')?.id).toBe(
      's1',
    );
  });
});

describe('mail from an application RADAR never saw', () => {
  it('reads the employer from the subject, the sender name, or the sender domain', () => {
    expect(employerFromMail('no-reply@us.greenhouse-mail.io', 'Thank you for applying to Cohere!')).toBe('Cohere');
    expect(employerFromMail('Cohere Talent <no-reply@ashbyhq.com>', 'Thank you for your interest')).toBe('Cohere');
    expect(employerFromMail('LinkedIn <jobs-noreply@linkedin.com>', 'Your application was sent to Cohere')).toBe(
      'Cohere',
    );
    expect(employerFromMail('Stripe Recruiting Team <careers@stripe.com>', 'Update')).toBe('Stripe');
    expect(employerFromMail('careers@scale.com', 'Update on your application')).toBe('Scale');
    expect(employerFromMail('Greenhouse <no-reply@greenhouse.io>', 'Update on your application')).toBeNull();
  });

  it('reads the role when the email names it', () => {
    expect(
      roleFromMail('Thank you', 'We received your application for the Forward Deployed Engineer position at Cohere.'),
    ).toBe('Forward Deployed Engineer');
    expect(roleFromMail('Your application for Backend Engineer, Payments', '')).toBe('Backend Engineer');
    expect(roleFromMail('Thank you for applying', 'We will review it soon.')).toBeNull();
  });

  it('opens an application only from recruiting mail, never from a newsletter', () => {
    expect(isRecruitingMail('Cohere Talent <no-reply@ashbyhq.com>', 'Thank you for your interest')).toBe(true);
    expect(isRecruitingMail('Acme <news@acme.com>', 'Your application was received')).toBe(true);
    expect(isRecruitingMail('Acme <news@acme.com>', 'Thank you for your interest in our webinar')).toBe(false);
  });
});

describe('messageBodies', () => {
  const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64url');
  it('finds the HTML and plain-text parts at any depth, and a bare single-part body', () => {
    const nested = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64('Hello — plain') } },
            { mimeType: 'text/html', body: { data: b64('<p>Hello</p>') } },
          ],
        },
      ],
    };
    expect(messageBodies(nested)).toEqual({ html: '<p>Hello</p>', text: 'Hello — plain' });
    expect(messageBodies({ body: { data: b64('<div>only html</div>') } })).toEqual({
      html: '<div>only html</div>',
      text: '',
    });
    expect(messageBodies(undefined)).toEqual({ html: '', text: '' });
  });
});

describe('nextStage', () => {
  it('only moves applications forward, and a rejection closes any open one', () => {
    expect(nextStage('interview', 'applied')).toBe('interview');
    expect(nextStage('assessment', 'interview')).toBeNull();
    expect(nextStage('rejection', 'interview')).toBe('rejected');
    expect(nextStage('received', 'applied')).toBeNull();
    expect(nextStage('interview', 'offer')).toBeNull();
    expect(nextStage('offer', 'rejected')).toBeNull();
  });
});
