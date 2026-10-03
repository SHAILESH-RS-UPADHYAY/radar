import { describe, expect, it } from 'vitest';
import { applicationFormUrl, parseGreenhouseForm, parseLeverForm } from './form';
import { answerForm, fillFromProfile, YOUR_CALL, type Candidate } from './answers';
import { fillPacket } from './bridge';

// Shapes copied from live postings (Greenhouse ?questions=true, a Lever apply page), cut down.
const greenhouse = {
  questions: [
    { label: 'First Name', required: true, fields: [{ name: 'first_name', type: 'input_text', values: [] }] },
    { label: 'Email', required: true, fields: [{ name: 'email', type: 'input_text', values: [] }] },
    {
      label: 'Resume/CV',
      required: true,
      fields: [
        { name: 'resume', type: 'input_file', values: [] },
        { name: 'resume_text', type: 'textarea', values: [] },
      ],
    },
    {
      label: 'Will you now or will you in the future require employment visa sponsorship?',
      required: true,
      fields: [
        {
          name: 'question_1',
          type: 'multi_value_single_select',
          values: [
            { label: 'Yes', value: 1 },
            { label: 'No', value: 0 },
          ],
        },
      ],
    },
    { label: 'Why Anthropic?', required: true, fields: [{ name: 'question_2', type: 'textarea', values: [] }] },
  ],
  compliance: [
    {
      questions: [
        {
          label: 'Gender',
          required: false,
          fields: [
            {
              name: 'gender',
              type: 'multi_value_single_select',
              values: [
                { label: 'Decline To Self Identify', value: 3 },
                { label: 'Female', value: 2 },
                { label: 'Male', value: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const card = (id: string, json: object) =>
  `<input type="hidden" value="${JSON.stringify(json).replace(/"/g, '&quot;')}" name="cards[${id}][baseTemplate]">`;
const lever =
  '<input name="name" required><input name="email" type="email"><input name="resume" type="file">' +
  '<input type="text" name="urls[LinkedIn]">' +
  card('c1', {
    text: 'Work Authorization',
    fields: [
      {
        type: 'multiple-choice',
        text: 'Will you require sponsorship?',
        required: true,
        options: [{ text: 'Yes' }, { text: 'No' }],
      },
      { type: 'textarea', text: 'Why do you want to work at Palantir?', required: false },
    ],
  }) +
  '<textarea name="comments"></textarea>';

const me: Candidate = {
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  city: 'Bengaluru',
  linkedin: 'https://linkedin.com/in/asha',
  github: 'https://github.com/asha',
  portfolio: 'https://asha.dev/',
  website: '',
  currentCompany: 'Northwind',
  currentTitle: 'AI Engineer',
  noticePeriod: '30 days',
  currentCtc: '24 LPA',
  expectedCtc: '32 LPA',
  currency: 'INR',
  workAuthorization: 'Authorized to work in India',
  needsSponsorship: 'no',
  willingToRelocate: '',
  gender: '',
  pronouns: '',
  veteranStatus: '',
  disabilityStatus: '',
  voiceNotes: '',
  experienceYears: 3,
  skills: ['python'],
  targetRoles: ['AI Engineer'],
  projects: [],
};

describe('parseGreenhouseForm', () => {
  it('turns questions into fields: the resume file (not the paste box), options with their values, EEO', () => {
    const fields = parseGreenhouseForm(greenhouse);
    expect(fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ['first_name', 'text', true],
      ['email', 'email', true],
      ['resume', 'file', true],
      ['question_1', 'select', true],
      ['question_2', 'textarea', true],
      ['gender', 'select', false],
    ]);
    expect(fields[3]).toMatchObject({ options: ['Yes', 'No'], values: ['1', '0'] });
  });
});

describe('parseLeverForm', () => {
  it('reads the standard inputs, the links and every custom card', () => {
    expect(parseLeverForm(lever).map((f) => [f.name, f.type, f.label])).toEqual([
      ['name', 'text', 'Full name'],
      ['email', 'email', 'Email'],
      ['resume', 'file', 'Resume/CV'],
      ['urls[LinkedIn]', 'url', 'LinkedIn URL'],
      ['cards[c1][field0]', 'select', 'Will you require sponsorship?'],
      ['cards[c1][field1]', 'textarea', 'Why do you want to work at Palantir?'],
      ['comments', 'textarea', 'Additional information'],
    ]);
  });
});

describe('fillFromProfile', () => {
  const field = (name: string, label: string, type = 'text', options?: string[]) =>
    ({ name, label, type, required: false, ...(options ? { options } : {}) }) as Parameters<typeof fillFromProfile>[0];
  it('fills exact facts from the profile and the Application Kit', () => {
    expect(fillFromProfile(field('first_name', 'First Name'), me, '')?.value).toBe('Asha');
    expect(fillFromProfile(field('last_name', 'Last Name'), me, '')?.value).toBe('Rao');
    expect(fillFromProfile(field('q', 'LinkedIn Profile'), me, '')?.value).toBe('https://linkedin.com/in/asha');
    expect(fillFromProfile(field('q', 'When is the earliest you would want to start?'), me, '')?.value).toBe('30 days');
    expect(fillFromProfile(field('q', 'Expected CTC'), me, '')?.value).toBe('32 LPA INR');
    expect(
      fillFromProfile(field('q', 'Will you require visa sponsorship?', 'select', ['Yes', 'No']), me, '')?.value,
    ).toBe('No');
  });
  it('declines EEO questions unless the kit says otherwise, and finds a school from the resume', () => {
    expect(
      fillFromProfile(field('gender', 'Gender', 'select', ['Male', 'Female', 'Decline To Self Identify']), me, '')
        ?.value,
    ).toBe('Decline To Self Identify');
    const schools = Array.from({ length: 80 }, (_, i) => 'University ' + i).concat('IIT Madras');
    expect(
      fillFromProfile(field('q', 'Which university?', 'select', schools), me, 'B.Tech, IIT Madras, 2021')?.value,
    ).toBe('IIT Madras');
  });
  it('leaves what the profile does not say, and never answers legal consents', () => {
    expect(fillFromProfile(field('q', 'Why Anthropic?', 'textarea'), me, '')).toBeNull();
    expect(YOUR_CALL.test('I understand and agree to the terms of the Agreement to Arbitrate')).toBe(true);
    expect(YOUR_CALL.test('Why do you want to work here?')).toBe(false);
    expect(YOUR_CALL.test('Please double-check the information above and confirm it is accurate')).toBe(true);
    expect(fillFromProfile(field('location', 'Current location'), me, '')?.value).toBe('Bengaluru');
    expect(fillFromProfile(field('q', 'What is your preferred work location?'), me, '')).toBeNull();
  });
});

describe('applicationFormUrl', () => {
  const job = (provider: string, applyUrl: string, identifier = 'acme') => ({
    provider,
    identifier,
    externalId: '123',
    applyUrl,
  });
  it('opens the form itself on each ATS', () => {
    expect(applicationFormUrl(job('greenhouse', 'https://stripe.com/jobs/search?gh_jid=123', 'stripe'))).toBe(
      'https://job-boards.greenhouse.io/embed/job_app?for=stripe&token=123',
    );
    expect(applicationFormUrl(job('greenhouse', 'https://job-boards.eu.greenhouse.io/groww/jobs/123', 'groww'))).toBe(
      'https://job-boards.eu.greenhouse.io/embed/job_app?for=groww&token=123',
    );
    expect(applicationFormUrl(job('lever', 'https://jobs.lever.co/acme/186b763a-2a61-4563-8813-ff6b40c9c8a7'))).toBe(
      'https://jobs.lever.co/acme/186b763a-2a61-4563-8813-ff6b40c9c8a7/apply',
    );
    expect(applicationFormUrl(job('ashby', 'https://jobs.ashbyhq.com/acme/13cdde35-6d8c-49a0-9f22-b9771c95f715'))).toBe(
      'https://jobs.ashbyhq.com/acme/13cdde35-6d8c-49a0-9f22-b9771c95f715/application',
    );
    expect(applicationFormUrl(job('workday', 'https://x.wd5.myworkdayjobs.com/a/job/1'))).toBe(
      'https://x.wd5.myworkdayjobs.com/a/job/1',
    );
  });
});

describe('answerForm without drafting (the instant first fill)', () => {
  it('returns profile facts only and never calls the AI', async () => {
    const r = await answerForm(
      [
        { name: 'q0', label: 'Location', type: 'text', required: true },
        { name: 'q1', label: 'Why do you want to work here?', type: 'textarea', required: false },
      ],
      me,
      {
        job: { title: 'x', company: 'y', location: null, description: '' },
        resumeText: '',
        tailoredText: null,
        deadline: 0,
        draft: false,
      },
    );
    expect(r.fields.map((f) => [f.by, f.value])).toEqual([
      ['profile', 'Bengaluru'],
      ['you', ''],
    ]);
    expect(r.model).toBeNull();
  });
});

describe('fillPacket', () => {
  it('carries the questions RADAR read and whether more answers follow', () => {
    const p = fillPacket(
      'Acme',
      [{ name: 'email', label: 'Email', type: 'email', required: true, value: 'a@b.c', by: 'profile' }],
      undefined,
      {
        asked: ['Email', 'Why us?'],
        partial: true,
      },
    );
    expect(p).toMatchObject({
      asked: ['Email', 'Why us?'],
      partial: true,
      fields: [{ name: 'email', value: 'a@b.c' }],
    });
  });
});
