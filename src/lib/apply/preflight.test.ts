import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// The extension's own file, run as the extension runs it (a classic script that sets globalThis.radarPreflight).
type Snapshot = {
  https: boolean;
  host: string;
  hasForm: boolean;
  needs: string[];
  consents: string[];
  fileInput: boolean;
  resume: 'attached' | 'kept' | 'none';
  captcha: boolean;
  password: boolean;
  submits: number;
  coverage: number | null;
};
type Preflight = {
  preflight: (s: Snapshot) => { submit: boolean; reasons: string[] };
  captchaIn: (x: { frames: { src: string }[]; solved: boolean }) => boolean;
  consentClass: (label: string) => string;
};
let pf: Preflight;
beforeAll(() => {
  new Function(readFileSync(path.resolve(__dirname, '../../../extension/preflight.js'), 'utf8'))();
  pf = (globalThis as unknown as { radarPreflight: Preflight }).radarPreflight;
});

const clean: Snapshot = {
  https: true,
  host: 'job-boards.greenhouse.io',
  hasForm: true,
  needs: [],
  consents: [],
  fileInput: true,
  resume: 'attached',
  captcha: false,
  password: false,
  submits: 1,
  coverage: 1,
};

describe('preflight', () => {
  it('submits a complete, clean form', () => {
    expect(pf.preflight(clean)).toEqual({ submit: true, reasons: [] });
    expect(pf.preflight({ ...clean, resume: 'kept', coverage: null }).submit).toBe(true);
    expect(pf.preflight({ ...clean, fileInput: false, resume: 'none' }).submit).toBe(true);
  });

  it('parks with every reason, never a partial submit', () => {
    const r = pf.preflight({
      ...clean,
      https: false,
      captcha: true,
      password: true,
      needs: ['Are you based in the UK?'],
      consents: ['I agree to the arbitration agreement'],
      resume: 'none',
      submits: 2,
      coverage: 0.5,
    });
    expect(r.submit).toBe(false);
    expect(r.reasons).toEqual([
      'not a secure (https) page',
      'a CAPTCHA is on the form: yours to finish',
      'the site wants an account or a sign-in',
      'an arbitration agreement: yours to decide',
      '1 required question left: "Are you based in the UK?"',
      'no resume PDF attached',
      'more than one Submit button',
      "only 50% of RADAR's answers found their field: is this the right form?",
    ]);
  });

  it('never automates LinkedIn or Indeed, and needs a form and one Submit', () => {
    expect(pf.preflight({ ...clean, host: 'www.linkedin.com' }).reasons).toContain(
      'LinkedIn and Indeed are never automated',
    );
    expect(pf.preflight({ ...clean, host: 'in.indeed.com' }).submit).toBe(false);
    expect(pf.preflight({ ...clean, hasForm: false }).reasons).toContain('no application form found');
    expect(pf.preflight({ ...clean, submits: 0 }).reasons).toContain('no Submit button found');
  });
});

describe('captchaIn', () => {
  const frames = (...src: string[]) => ({ frames: src.map((s) => ({ src: s })), solved: false });
  it('lets an invisible reCAPTCHA through', () => {
    expect(pf.captchaIn(frames('https://www.google.com/recaptcha/api2/anchor?ar=1&k=x&size=invisible'))).toBe(false);
    expect(pf.captchaIn(frames('https://www.recaptcha.net/recaptcha/enterprise/anchor?k=x&size=invisible'))).toBe(
      false,
    );
  });
  it('stops at a visible widget or any challenge', () => {
    expect(pf.captchaIn(frames('https://www.google.com/recaptcha/api2/anchor?ar=1&k=x&size=normal'))).toBe(true);
    expect(pf.captchaIn(frames('https://www.google.com/recaptcha/api2/bframe?k=x'))).toBe(true);
    expect(
      pf.captchaIn(frames('https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=checkbox')),
    ).toBe(true);
    expect(
      pf.captchaIn(frames('https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=challenge')),
    ).toBe(true);
    expect(pf.captchaIn(frames('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/turnstile'))).toBe(true);
    expect(pf.captchaIn(frames('https://client-api.arkoselabs.com/fc/gc/'))).toBe(true);
  });
  it('a CAPTCHA already passed is not a block; other frames are ignored', () => {
    expect(
      pf.captchaIn({ frames: [{ src: 'https://www.google.com/recaptcha/api2/anchor?size=normal' }], solved: true }),
    ).toBe(false);
    expect(
      pf.captchaIn(frames('https://www.youtube.com/embed/x', 'https://job-boards.greenhouse.io/embed/job_app')),
    ).toBe(false);
  });
});

describe('consentClass', () => {
  it('sorts consents into the classes you can pre-approve', () => {
    expect(pf.consentClass('I have read and agree to the Candidate Privacy Notice')).toBe('privacy');
    expect(pf.consentClass('I consent to the processing of my personal data')).toBe('privacy');
    expect(pf.consentClass('I certify that the information above is true and complete')).toBe('accurate');
    expect(pf.consentClass('Keep my information on file for future opportunities')).toBe('talent_pool');
  });
  it('arbitration wins over anything else in the same sentence, and the unknown stays yours', () => {
    expect(pf.consentClass('I agree to the privacy policy and the mutual arbitration agreement')).toBe('arbitration');
    expect(pf.consentClass('I agree to receive SMS')).toBe('other');
  });
});
