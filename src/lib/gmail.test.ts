import { describe, expect, it } from 'vitest';
import { classifyEmail, matchApplication, nextStage, type Application } from './gmail';

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
