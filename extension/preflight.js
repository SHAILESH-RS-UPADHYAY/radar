// RADAR · Auto-Fill — the pre-flight checks PHANTOM runs before it may press a form's Submit.
//
// Pure functions over a snapshot of the form that fill.js takes: they say "submit", or "park" with every reason, and
// touch nothing. Loaded into the page before fill.js; the repo's tests load this same file and run the same checks.

(() => {
  // CAPTCHAs are never solved, bypassed or worked around: a visible one (or a challenge) parks the job for you.
  // An invisible reCAPTCHA (size=invisible) or one already passed is not a challenge, and does not.
  const CHALLENGE =
    /recaptcha\/api2\/bframe|recaptcha\/enterprise\/bframe|hcaptcha\.com\/.*frame=challenge|arkoselabs|funcaptcha|captcha-delivery\.com/i;
  const WIDGET =
    /recaptcha\/(api2|enterprise)\/anchor(?!.*size=invisible)|hcaptcha\.com\/.*frame=checkbox|challenges\.cloudflare\.com/i;

  /** frames: the page's visible iframes ({ src }); solved: a CAPTCHA token is already there. */
  function captchaIn({ frames, solved }) {
    if (solved) return false;
    return frames.some((f) => CHALLENGE.test(f.src) || WIDGET.test(f.src));
  }

  // Consents you can pre-approve, one class at a time; arbitration and anything unknown always stay yours.
  const CONSENT = [
    ['arbitration', /arbitrat/i],
    [
      'talent_pool',
      /talent (pool|community|network)|future (opportunit|roles|openings)|keep (my|your) (data|information|application) on file/i,
    ],
    ['accurate', /accurate|true(,)? (and )?(correct|complete)|certify|attest/i],
    ['privacy', /privacy|data (processing|protection)|personal (data|information)|gdpr|candidate notice/i],
  ];
  function consentClass(label) {
    const hit = CONSENT.find(([, re]) => re.test(label || ''));
    return hit ? hit[0] : 'other';
  }

  const short = (s) => (s.length > 60 ? s.slice(0, 57) + '…' : s);

  /**
   * The decision. snapshot: { https, host, hasForm, needs: [label], consents: [label], fileInput, resume
   * ('attached' | 'kept' | 'none'), captcha, password, submits, coverage (0–1, or null when RADAR could not read the
   * form ahead) }. Returns { submit, reasons }.
   */
  function preflight(s) {
    const reasons = [];
    if (!s.https) reasons.push('not a secure (https) page');
    if (/(^|\.)(linkedin\.com|indeed\.)/i.test(s.host || '')) reasons.push('LinkedIn and Indeed are never automated');
    if (!s.hasForm) reasons.push('no application form found');
    if (s.captcha) reasons.push('a CAPTCHA is on the form: yours to finish');
    if (s.password) reasons.push('the site wants an account or a sign-in');
    for (const label of s.consents)
      reasons.push(
        consentClass(label) === 'arbitration'
          ? 'an arbitration agreement: yours to decide'
          : `a consent you have not pre-approved: "${short(label)}"`,
      );
    if (s.needs.length)
      reasons.push(`${s.needs.length} required question${s.needs.length > 1 ? 's' : ''} left: "${short(s.needs[0])}"`);
    if (s.fileInput && s.resume === 'none') reasons.push('no resume PDF attached');
    if (s.submits !== 1) reasons.push(s.submits ? 'more than one Submit button' : 'no Submit button found');
    if (s.coverage !== null && s.coverage < 0.9)
      reasons.push(
        `only ${Math.round(s.coverage * 100)}% of RADAR's answers found their field: is this the right form?`,
      );
    return { submit: reasons.length === 0, reasons };
  }

  globalThis.radarPreflight = { preflight, captchaIn, consentClass };
})();
