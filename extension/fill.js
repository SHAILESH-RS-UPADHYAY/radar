// RADAR · Auto-Fill — fills an application form in a tab RADAR opened (the worker injects it into no other tab).
//
//   1. answers    your profile facts and PDF arrive about a second after the tab opens; the AI's written answers
//                 follow (drafted, then humanized) and fill in as they come.
//   2. the form   on the page, in a frame (Greenhouse embedded in a company site), or appearing later (an Apply
//                 button, a modal); multi-step forms step by step. It presses only what opens the form (Apply, and on
//                 Workday its "how do you want to apply" choice and Save and Continue between steps).
//   3. questions  anything RADAR could not read ahead (Ashby keeps its form behind a robots-disallowed /api/; company
//                 sites) is read here, in your browser, answered by RADAR the same way, and filled: text, dropdowns,
//                 search-and-pick boxes, Yes/No buttons, radios, checkboxes. It never overwrites an answer.
//   4. submit     marked, never pressed; never a CAPTCHA. When the employer confirms the application (or you press
//                 "I submitted it"), RADAR logs it in C2 · OPS.

(() => {
  if (window.__radarFill) return;
  window.__radarFill = true;

  const TOP = window === window.top;
  // ZERO-DAY's settings for this tab ({ dryRun, consents }), or null: then you press Submit, as always.
  let AUTO = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ask = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          void chrome.runtime.lastError;
          resolve(res || null);
        });
      } catch {
        resolve(null); // the extension was reloaded: this page's script is orphaned
      }
    });
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const WORKDAY = /\.myworkday(jobs|site)\.com$/.test(location.hostname);
  const byAuto = (id) => deepAll(document, `[data-automation-id="${id}"]`).find(visible) || null;

  // Fills one at a time: answers arriving while a pass runs wait for it, so two never type into the page at once.
  let queue = Promise.resolve();
  const exclusive = (job) => (queue = queue.then(job, job));

  // =====================================================================================================
  // Reading the form: every question as one object (its label, kind, options, controls)
  // =====================================================================================================

  const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), textarea, select';
  /** Controls a question can be answered with: fields, and Yes/No style toggle buttons (Ashby). */
  const CONTROL = FIELD + ', button[aria-pressed], button[aria-haspopup="listbox"]';
  const isShown = (el) => el.type === 'file' || visible(el);

  // Forms built from web components (SmartRecruiters) keep their inputs inside shadow roots: search those too.
  function deepAll(root, selector) {
    const out = [...root.querySelectorAll(selector)];
    for (const host of root.querySelectorAll('*')) if (host.shadowRoot) out.push(...deepAll(host.shadowRoot, selector));
    return out;
  }
  /** The name a web component gives its inner input (<spl-input label="First name">). */
  const hostLabel = (el) => {
    const host = el.getRootNode().host;
    return (host && (host.getAttribute('label') || host.getAttribute('aria-label'))) || '';
  };

  // Where the application form is, so a newsletter or search box elsewhere on the page is never filled: the <form>
  // with the upload, the long answers and the most fields; the whole page when the form is not a <form> (Workday).
  let scope = document;
  function formRoot() {
    let best = null;
    let top = 2;
    for (const form of document.querySelectorAll('form')) {
      const n =
        deepAll(form, CONTROL).filter(isShown).length +
        (form.querySelector('input[type=file]') ? 10 : 0) +
        (form.querySelector('textarea') ? 3 : 0);
      if (n > top) [best, top] = [form, n];
    }
    return best || document;
  }

  // Standard fields have many spellings across forms; one key for each.
  const KEYS = [
    ['first_name', /^(legal |preferred )?first name|^given name/],
    ['last_name', /^(legal )?(last|family) name|^surname/],
    ['full_name', /^(full |your )?name$|^full name|^legal name/],
    ['email', /\be ?mail\b/],
    ['phone', /\bphone\b|\bmobile\b/],
    ['linkedin', /linkedin/],
    ['github', /github/],
    ['portfolio', /portfolio|personal (site|website)|^website/],
    ['location', /^(current )?location\b|^city\b|where are you (based|located)/],
    ['company', /^current (company|employer)|^company$|^organi[sz]ation/],
    ['country', /^country( of residence| territory)?\b/],
  ];
  const keyOf = (label) => {
    const l = norm(label);
    // A long question or one about someone else ("referred by… their email") is not your standard field.
    if (l.split(' ').length > 7 || /\brefer|recruiter|manager|reference|emergency\b/.test(l)) return null;
    for (const [k, re] of KEYS) if (re.test(l)) return k;
    return null;
  };

  // A label lives in the same document (or shadow root) as its input.
  const labelOf = (id, near = document) =>
    id && (near.getRootNode ? near.getRootNode() : document).querySelector('label[for="' + CSS.escape(id) + '"]');

  /** The title of the smallest block around a control that holds no other question (Ashby, most custom forms). */
  function blockHead(el, own) {
    const mine = new Set(own);
    const inOwnLabel = (h) => own.some((c) => (c.closest('label') || c).contains(h));
    let node = (el.closest('label') || el).parentElement;
    for (let i = 0; node && node !== document.body && i < 6; node = node.parentElement, i++) {
      if ([...node.querySelectorAll(CONTROL)].some((c) => !mine.has(c) && isShown(c))) return null;
      const head = [
        ...node.querySelectorAll('label, legend, [class*="title" i], [class*="label" i], [class*="question" i]'),
      ].find(
        (h) => !mine.has(h) && !h.contains(el) && !inOwnLabel(h) && !h.querySelector(CONTROL) && h.textContent.trim(),
      );
      if (head) return head;
    }
    return null;
  }

  /** The element that names a control: <label for>, aria-labelledby, Lever's card title, a wrapping label, its block. */
  function labelFor(el) {
    const forIt = labelOf(el.id, el);
    if (forIt && forIt.textContent.trim()) return forIt;
    const by = el.getAttribute('aria-labelledby');
    const named =
      by &&
      by
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .find((n) => n && n.textContent.trim());
    if (named) return named;
    // Lever writes the question once per card (.application-label); the input's own label may hold helper text.
    const card = el.closest('.application-question');
    const head = card && card.querySelector('.application-label');
    if (head) return head;
    return el.closest('label') || blockHead(el, [el]);
  }
  const labelText = (el) => {
    const l = labelFor(el);
    return (
      (l && l.textContent) ||
      el.getAttribute('aria-label') ||
      hostLabel(el) ||
      el.getAttribute('placeholder') ||
      ''
    ).trim();
  };

  /** The question a radio/checkbox group asks (each box's own label is just an option). */
  function groupHead(el, own) {
    const box = el.closest('fieldset, [role=radiogroup], [role=group], .application-question');
    for (const sel of ['legend', '.application-label', '[class*="question-title"]', ':scope > label', '.text']) {
      const head = box && box.querySelector(sel);
      if (head && head.textContent.trim()) return head;
    }
    return blockHead(el, own);
  }

  // A choice group is its fieldset when there is one: Ashby names each checkbox by its option ("Yes", "No"), so the
  // name alone would join every "Yes" on the form into one question.
  const groupOf = (el) => {
    const box = el.closest('fieldset, [role=radiogroup], [role=group]');
    const inBox = box ? [...box.querySelectorAll(`input[type=${el.type}]`)] : [];
    if (inBox.length > 1) return inBox;
    return el.name ? [...document.getElementsByName(el.name)].filter((b) => b.type === el.type) : [el];
  };
  const choiceText = (box) => ((box.closest('label') || labelOf(box.id) || {}).textContent || box.value || '').trim();
  const PLACEHOLDER = /^(select|choose|please|pick|--|—)/i;
  const selectAnswered = (el) =>
    !!el.value && !PLACEHOLDER.test(((el.selectedOptions && el.selectedOptions[0]) || {}).textContent?.trim() || '');
  // A search-and-pick box shows its choice beside the input (React Select: .select__control > .select__single-value).
  const comboHasValue = (input) => {
    const box =
      input.closest('[class*="control"]') || input.closest('[class*="value-container"]') || input.parentElement;
    return !!(
      box &&
      box.querySelector(
        '[class*="single-value"], [class*="singleValue"], [class*="multi-value"], [class*="multiValue"]',
      )
    );
  };

  /** Every question in the form, in order. */
  function questions() {
    const out = [];
    const seen = new Set();
    for (const el of deepAll(scope, CONTROL)) {
      if (seen.has(el)) continue;
      let q;
      if (el.matches('button[aria-haspopup="listbox"]')) {
        if (!visible(el)) continue;
        q = { kind: 'listbox', el, els: [el] };
      } else if (el.tagName === 'BUTTON') {
        const els = [...el.parentElement.querySelectorAll('button[aria-pressed]')];
        q = { kind: 'buttons', el, els, hidden: [...el.parentElement.querySelectorAll('input')] };
        q.options = els.map((b) => b.textContent.trim());
      } else if (el.type === 'radio' || el.type === 'checkbox') {
        const els = groupOf(el);
        els.forEach((b) => seen.add(b));
        if (!els.some((b) => visible(b) || visible(b.closest('label') || labelOf(b.id)))) continue; // behind buttons
        const kind = el.type === 'radio' ? 'radio' : els.length > 1 ? 'checkboxes' : 'checkbox';
        q = { kind, el, els, options: els.map(choiceText) };
      } else if (!isShown(el)) continue;
      else if (el.type === 'file') q = { kind: 'file', el, els: [el] };
      else if (el.tagName === 'SELECT') {
        q = { kind: 'select', el, els: [el] };
        q.options = [...el.options].map((o) => o.textContent.trim()).filter((t) => t && !PLACEHOLDER.test(t));
      } else if (el.getAttribute('role') === 'combobox' || el.closest('[data-automation-id="multiSelectContainer"]'))
        q = { kind: 'combo', el, els: [el] };
      else q = { kind: el.tagName === 'TEXTAREA' ? 'textarea' : 'text', el, els: [el] };
      [...q.els, ...(q.hidden || [])].forEach((e) => seen.add(e));
      const head = ['buttons', 'radio', 'checkboxes'].includes(q.kind) ? groupHead(el, q.els) : labelFor(el);
      const text =
        (head && head.textContent) ||
        el.getAttribute('aria-label') ||
        hostLabel(el) ||
        el.getAttribute('placeholder') ||
        '';
      q.label = text.replace(/[*✱]/g, '').replace(/\s+/g, ' ').trim();
      q.required =
        [...q.els, ...(q.hidden || [])].some((e) => e.required || e.getAttribute('aria-required') === 'true') ||
        /\*\s*$/.test(text.trim()) ||
        (!!head && /required/i.test(String(head.className))) ||
        // Ashby marks the block's title, not a lone checkbox's own label ("Privacy Notice*" → "Acknowledge").
        !!el.closest('[class*="fieldEntry"]')?.querySelector(':scope > label[class*="required" i]');
      // A disabled field (End date while "Current role" is ticked) cannot be answered, so it is never owed.
      if (q.els.every((e) => e.disabled || e.getAttribute('aria-disabled') === 'true')) q.required = false;
      out.push(q);
    }
    return out;
  }

  function answered(q) {
    switch (q.kind) {
      case 'buttons':
        return q.els.some((b) => b.getAttribute('aria-pressed') === 'true');
      case 'radio':
      case 'checkboxes':
      case 'checkbox':
        return q.els.some((b) => b.checked);
      case 'file': {
        if (q.el.files && q.el.files.length) return true;
        // Ashby/Greenhouse clear the input after uploading and show the file's name with Replace/Remove instead.
        const block = q.el.closest('[class*="fieldEntry"], .field, fieldset, [class*="upload"]') || q.el.parentElement;
        return (
          !!block &&
          /\.(pdf|docx?|rtf|txt)/i.test(block.textContent || '') &&
          /replace|remove|delete/i.test(block.textContent || '')
        );
      }
      case 'select':
        return selectAnswered(q.el);
      case 'combo':
        return comboHasValue(q.el) || !!q.el.value.trim();
      case 'listbox':
        return !PLACEHOLDER.test(q.el.textContent.trim()) && !!q.el.textContent.trim();
      default:
        return !!q.el.value.trim();
    }
  }

  const questionOf = (el) => questions().find((q) => q.els.includes(el) || (q.hidden || []).includes(el));

  function byNameOrId(name) {
    const el = document.getElementById(name);
    if (el && scope.contains(el)) {
      if (el.matches(FIELD)) return el;
      const inner = el.querySelector(FIELD);
      if (inner) return inner;
    }
    return [...document.getElementsByName(name)].find((e) => scope.contains(e)) || null;
  }

  function byLabel(label) {
    const want = norm(label);
    const key = keyOf(label);
    let fallback = null;
    for (const el of deepAll(scope, FIELD)) {
      if (!isShown(el)) continue;
      const have = norm(labelText(el));
      if (!have) continue;
      if (have === want || (want.length > 12 && (have.startsWith(want) || want.startsWith(have)))) return el;
      if (!fallback && key && keyOf(have) === key) fallback = el;
    }
    return fallback;
  }

  const visibleFields = (root = scope) => deepAll(root, FIELD).filter(isShown);
  // A form that asks only for a note (YC Work at a Startup: "a short note to the founders").
  const NOTE_BOX = /why|interest|excit|motivat|cover|message|founder|note/;

  // An application form, not a search box or a newsletter signup: a file upload, two of the form's own field names,
  // three standard fields (name, email, phone…), or the one note box a short form asks for.
  function hasForm(packet) {
    if (accountWall()) return false;
    if (WORKDAY && byAuto('pageFooterNextButton')) return true; // inside the application, on any of its steps
    if (deepAll(document, 'input[type=file]').length) return true;
    if (packet.fields.filter((f) => byNameOrId(f.name)).length >= 2) return true;
    const fields = visibleFields(document);
    if (fields.filter((el) => keyOf(labelText(el))).length >= 3) return true;
    return fields.some((el) => el.tagName === 'TEXTAREA' && NOTE_BOX.test(norm(labelText(el))));
  }

  /** A sign-in or create-account page (Workday asks for one per employer). Passwords are yours: RADAR waits here. */
  const accountWall = () =>
    deepAll(document, 'input[type=password]').some(visible) && visibleFields(document).length <= 6;

  /** The posting is gone: an error page, or the ATS sent the link back to its board with ?error=true. */
  function postingGone() {
    if (/[?&]error=true\b/.test(location.search)) return true;
    const heads = [
      document.title,
      ...[...document.querySelectorAll('h1, h2, h3, [role=alert]')].slice(0, 8).map((h) => h.textContent),
    ];
    return heads.some((t) =>
      /page not found|^\s*404\b|(job|position|posting|vacancy) (is |has )?(not found|no longer|closed|expired|been (filled|closed|removed))|(this|the) job has expired|no longer (available|accepting|listed|open)|doesn.t exist|couldn.t find this|sorry, this job/i.test(
        t || '',
      ),
    );
  }

  /**
   * Workday's way in: Apply opens a choice. A saved application carries your answers, your resume fills the experience
   * pages by itself, and typing it all by hand is the last resort. Resolves once a choice was pressed or there was none.
   */
  async function enterWorkday(packet, hud) {
    let applied = false;
    for (let i = 0; i < 24; i++) {
      if (accountWall() || hasForm(packet) || /\/apply\//.test(location.pathname)) return;
      const choice = ['useMyLastApplication', 'autofillWithResume', 'applyManually'].map(byAuto).find(Boolean);
      if (choice) {
        hud.log('SYS', `Workday: ${choice.textContent.trim()}`, 'dim');
        return pressSafely(choice);
      }
      const apply = !applied && byAuto('adventureButton');
      if (apply) {
        pressSafely(apply);
        applied = true;
      }
      await sleep(500);
    }
  }

  // Workday's steps, pressed for you only when this step has nothing left empty and showed no error. "Submit" (the same
  // button on the Review step) never matches, and each step is pressed once: if it comes back, it is yours.
  const workdayPressed = new Set();
  function workdayNext() {
    const next = byAuto('pageFooterNextButton');
    if (!next || next.disabled || !/^(save and continue|continue|next)$/i.test(next.textContent.trim())) return false;
    if (byAuto('errorBanner') || stillEmpty().length) return false;
    const step = (byAuto('progressBarActiveStep') || document.querySelector('h2') || {}).textContent || location.href;
    if (workdayPressed.has(step)) return false;
    workdayPressed.add(step);
    pressSafely(next);
    return true;
  }

  // A job page whose form opens only behind its own button ("Apply for this job", "I'm interested", Workable's
  // APPLICATION tab). Opening it is not applying; "Apply with LinkedIn / Indeed" is never pressed.
  const OPENER =
    /^(apply( now| here| for this (job|position|role))?|i['’]?m interested|easy apply|start (my |your )?application|application)$/i;
  function openForm() {
    const button = deepAll(document, 'button, a, [role="button"], [role="tab"]').find(
      (b) => visible(b) && !b.closest('form') && OPENER.test((b.textContent || '').replace(/\s+/g, ' ').trim()),
    );
    if (!button) return false;
    pressSafely(button);
    return true;
  }

  /** Wait for the form (by default 10 minutes: you may open it with the page's own Apply button). */
  async function formAppears(packet, stop = () => false, seconds = 600) {
    for (let i = 0; i < seconds; i++) {
      if (stop()) return false;
      if (hasForm(packet)) return true;
      await sleep(1000);
    }
    return false;
  }

  const SUBMIT = /submit|apply|send/i;
  // The form's own Submit: after its last field (an "Apply" button above the form only opened it).
  function submitButton() {
    const text = (b) => (b.textContent || b.value || '').trim();
    const fields = visibleFields();
    const last = fields[fields.length - 1];
    const all = deepAll(scope, 'button, input[type=submit]').filter((b) => visible(b) && SUBMIT.test(text(b)));
    const after = last ? all.filter((b) => last.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) : all;
    const pool = after.length ? after : all;
    return (
      pool.find((b) => /submit application|^submit$/i.test(text(b))) || pool.find((b) => b.type === 'submit') || null
    );
  }

  function fileInput() {
    return (
      scope.querySelector(
        'input[type=file]#resume, input[type=file][name="resume"], input[type=file][id*="resume" i], input[type=file][name*="resume" i], input[type=file][aria-label*="resume" i]',
      ) ||
      deepAll(scope, 'input[type=file]').find((i) => /resume|\bcv\b/i.test(labelText(i))) ||
      deepAll(scope, 'input[type=file]')[0]
    );
  }

  // =====================================================================================================
  // Writing (React-controlled inputs need the native setter, then the events React listens to)
  // =====================================================================================================

  function setValue(el, value) {
    let proto = el;
    let desc;
    while ((proto = Object.getPrototypeOf(proto)) && !(desc = Object.getOwnPropertyDescriptor(proto, 'value')));
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function typeInto(el, text) {
    el.focus({ preventScroll: true });
    if (!still && text.length > 24) {
      const step = Math.max(3, Math.ceil(text.length / 16));
      for (let i = step; i < text.length; i += step) {
        setValue(el, text.slice(0, i));
        await sleep(10);
      }
    }
    setValue(el, text);
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const clickLike = (el) => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  };

  // A Yes/No button can be a submit button of the form (Ashby's are): its click must never submit the application.
  function pressSafely(button) {
    const block = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('submit', block, true);
    try {
      button.click();
    } finally {
      setTimeout(() => window.removeEventListener('submit', block, true), 100);
    }
  }

  /**
   * A search-and-pick box (React Select, Ashby's Location): type the answer, wait for the suggestions (they may come
   * from the network), click the one that matches. `loose` (a place) takes the first suggestion. Nothing picked: the
   * typed text is cleared, so the question shows up as yours.
   */
  // React Select (Greenhouse boards and their embeds) gives options no role, only ids/classes like these.
  const OPTION_SEL =
    '[role="option"], [data-automation-id="promptLeafNode"], [id^="react-select-"][id*="-option-"], [class*="select__option"]';

  async function pickCombo(input, wanted, loose) {
    const w = norm(wanted);
    // Whole words only: "india" must not pick "Indianapolis" (or "Indiana").
    // norm() leaves only [a-z0-9 ], so w needs no escaping.
    const word = new RegExp('(^|[^a-z0-9])' + w + '($|[^a-z0-9])');
    const tokens = w.split(' ').filter((t) => t.length > 2);
    const optionsNow = () => {
      const listId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
      const list = (listId && document.getElementById(listId)) || document;
      return [...list.querySelectorAll(OPTION_SEL)].filter(visible);
    };
    // Best option by meaning: exact, then whole word, then most of the answer's words ("Yes, I am authorized" ~ "Yes").
    const best = (options, i) => {
      const t = (o) => norm(o.textContent);
      const exact = options.find((o) => t(o) === w) || options.find((o) => word.test(t(o)));
      if (exact) return exact;
      const yesNo = /^(yes|no)( |$)/.exec(w);
      if (yesNo) {
        const yn = options.find((o) => t(o) === yesNo[1] || t(o).startsWith(yesNo[1] + ' '));
        if (yn) return yn;
      }
      let top = null;
      let score = 0;
      for (const o of options) {
        const s = tokens.filter((k) => t(o).split(' ').includes(k)).length / Math.max(tokens.length, 1);
        if (s > score) [top, score] = [o, s];
      }
      if (top && score >= 0.5) return top;
      // A place with no word match: the first suggestion only if it does not merely share a prefix with it.
      return loose && i >= 8 ? options.find((o) => !t(o).startsWith(w.slice(0, 4))) : null;
    };
    const choose = async (hit) => {
      hit.scrollIntoView({ block: 'nearest' });
      clickLike(hit);
      await sleep(200);
      return true;
    };

    // 1. Open the dropdown as a person would and read its options; pick from the full list when it is short.
    input.focus({ preventScroll: true });
    clickLike(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
    for (let i = 0; i < 8; i++) {
      await sleep(100);
      const options = optionsNow();
      if (options.length && options.length <= 60) {
        const hit = best(options, 0);
        if (hit) return choose(hit);
        break;
      }
    }
    // 2. A long or searched list: type to narrow it, then pick the matching suggestion.
    setValue(input, wanted);
    // Workday searches on Enter, not as you type.
    if (WORKDAY) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      const hit = best(optionsNow(), i);
      if (hit) return choose(hit);
    }
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setValue(input, '');
    return false;
  }

  /** A dropdown that is a button and a pop-up list (Workday): open it, then read or pick. */
  async function openListbox(button) {
    clickLike(button);
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      const options = [...document.querySelectorAll(OPTION_SEL)].filter(visible);
      if (options.length) return options;
    }
    return [];
  }
  const closeListbox = (button) =>
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

  async function pickListbox(button, values) {
    const options = await openListbox(button);
    const wanted = values.map(norm);
    const hit =
      options.find((o) => wanted.includes(norm(o.textContent))) ||
      options.find((o) => wanted.some((w) => w.length > 3 && norm(o.textContent).startsWith(w)));
    if (!hit) {
      closeListbox(button);
      return false;
    }
    clickLike(hit);
    await sleep(200);
    return true;
  }

  async function listboxOptions(button) {
    const options = (await openListbox(button)).map((o) => o.textContent.trim());
    closeListbox(button);
    await sleep(100);
    return options.filter((t) => t && !PLACEHOLDER.test(t));
  }

  /** The option closest in meaning to an answer: exact, Yes/No, whole word, then most shared words (≥ half). */
  function closest(options, answer) {
    const w = norm(answer);
    const exact = options.find((o) => o.t === w);
    if (exact) return exact;
    const yn = /^(yes|no)( |$)/.exec(w);
    if (yn) return options.find((o) => o.t === yn[1] || o.t.startsWith(yn[1] + ' ')) || null;
    const word = options.find((o) => new RegExp('(^| )' + w + '( |$)').test(o.t));
    if (word) return word;
    const tokens = w.split(' ').filter((k) => k.length > 2);
    let top = null;
    let score = 0;
    for (const o of options) {
      const s = tokens.filter((k) => o.t.split(' ').includes(k)).length / Math.max(tokens.length, 1);
      if (s > score) [top, score] = [o, s];
    }
    return score >= 0.5 ? top : null;
  }

  function pickChoices(els, values) {
    let hit = false;
    for (const box of els) {
      const text = norm(choiceText(box));
      if (!values.some((v) => norm(v) === norm(box.value) || norm(v) === text)) continue;
      hit = true;
      if (!box.checked) box.click();
    }
    // No exact option (a taught "Y Combinator job board" vs "Job Board (Indeed, …)"): one radio by meaning.
    if (!hit && els[0] && els[0].type === 'radio') {
      const pick = closest(
        els.map((b) => ({ b, t: norm(choiceText(b)) })),
        values[0] || '',
      );
      if (pick) {
        if (!pick.b.checked) pick.b.click();
        hit = true;
      }
    }
    return hit;
  }

  function pickSelect(el, submit, values) {
    const option = [...el.options].find(
      (o) => (submit && o.value === submit) || values.some((v) => o.value === v || norm(o.textContent) === norm(v)),
    );
    if (!option) return false;
    setValue(el, option.value);
    return true;
  }

  function glow(el, color = '0,255,65') {
    const target = el.type === 'file' ? el.closest('div') || el : el;
    const before = target.style.boxShadow;
    target.style.transition = 'box-shadow .35s ease';
    target.style.boxShadow = `0 0 0 2px rgba(${color},.95), 0 0 18px rgba(${color},.5)`;
    setTimeout(() => (target.style.boxShadow = before), 1800);
  }

  // The resume PDF the extension keeps (uploaded in RADAR → Settings → RESUME), asked for once per page.
  let keptPdf;
  const keptResume = async () => (keptPdf === undefined ? (keptPdf = await ask({ type: 'resume-file' })) : keptPdf);

  // Greenhouse takes the file and empties its input: remember it, or the next pass uploads it again and pre-flight
  // says "no resume attached" about a form that shows your PDF.
  let attachedHere = false;
  function attach(resume) {
    const input = fileInput();
    if (attachedHere) return 'kept';
    if (!input || !resume) return 'none';
    if (input.files && input.files.length) return 'kept';
    const bin = atob(resume.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], resume.name, { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    glow(input);
    attachedHere = true;
    return 'attached';
  }

  // =====================================================================================================
  // Filling
  // =====================================================================================================

  /** One answer into one question, whatever its kind. */
  async function answer(q, values, submit) {
    let ok = false;
    if (q.kind === 'buttons') {
      const button = q.els.find((b) => values.some((v) => norm(v) === norm(b.textContent)));
      if (button && button.getAttribute('aria-pressed') !== 'true') pressSafely(button);
      ok = !!button;
    } else if (q.kind === 'radio' || q.kind === 'checkboxes' || q.kind === 'checkbox') ok = pickChoices(q.els, values);
    else if (q.kind === 'select') ok = pickSelect(q.el, submit, values);
    else if (q.kind === 'listbox') ok = await pickListbox(q.el, values);
    else if (q.kind === 'combo') {
      const place = /location|city|where.*(based|live|located)/i.test(q.label);
      ok = true;
      for (const v of values) ok = (await pickCombo(q.el, v, place)) && ok;
    } else if (q.kind !== 'file') {
      let text = values.join(', ');
      // A number box takes only the number: "4.5 LPA" → 4.5, "USD 120k" → 120000.
      if (q.el.type === 'number') {
        const m = /(\d+(?:[.,]\d+)?)\s*(k)?/i.exec(text.replace(/,(?=\d{3})/g, ''));
        if (!m) return false;
        text = String(Number(m[1].replace(',', '.')) * (m[2] ? 1000 : 1));
      }
      await typeInto(q.el, text);
      ok = true;
    }
    if (ok) glow(q.kind === 'buttons' ? q.el.parentElement : q.el);
    return ok;
  }

  /** One packet answer, found by the form's own name or id, else by its label. Never overwrites an answer. */
  async function fillField(field) {
    const values = [].concat(field.value).filter(Boolean);
    if (!values.length || field.type === 'file') return { status: 'skip' };
    const el = byNameOrId(field.name) || byLabel(field.label);
    const q = el && questionOf(el);
    if (!q) return { status: 'missing' };
    if (answered(q)) return { status: 'kept', q };
    // The packet's field landed on the wrong control: a phone number or an email never answers a written question.
    if (q.kind === 'textarea' && values.length === 1 && /^(\+?[\d\s()-]{7,}|\S+@\S+\.\S+)$/.test(values[0].trim()))
      return { status: 'missing', q };
    return { status: (await answer(q, values, field.submit)) ? 'filled' : 'missing', q };
  }

  /** Standard fields the packet names differently (first + last vs full name): filled by their meaning. */
  function profileMap(packet) {
    const map = {};
    for (const f of packet.fields) {
      const k = keyOf(f.label) || keyOf(f.name.replace(/[_[\]]+/g, ' '));
      const v = [].concat(f.value)[0];
      if (k && v && !map[k]) map[k] = v;
    }
    if (map.full_name) {
      const [first, ...rest] = map.full_name.split(/\s+/);
      if (!map.first_name) map.first_name = first;
      if (!map.last_name) map.last_name = rest.join(' ');
    }
    // Forms ask for the country on their own line; your phone's code says it. The AI still answers it elsewhere.
    if (!map.country && /^\+?91\b/.test(String(map.phone || ''))) map.country = 'India';
    if (!map.full_name && map.first_name) map.full_name = [map.first_name, map.last_name].filter(Boolean).join(' ');
    return map;
  }

  async function sweep(map, used) {
    let n = 0;
    for (const q of questions()) {
      if (used.has(q.el) || !['text', 'combo', 'listbox'].includes(q.kind) || answered(q)) continue;
      const k = keyOf(q.label);
      if (k && map[k] && (await answer(q, [map[k]]))) n++;
    }
    return n;
  }

  /** One pass over the form as it is now. Safe to repeat: it never overwrites an answer. */
  async function fillPass(packet) {
    scope = formRoot();
    const used = new Set();
    const pass = { filled: 0, kept: 0, pdf: 'none' };
    for (const field of packet.fields) {
      const { status, q } = await fillField(field);
      if (q) used.add(q.el);
      if (status === 'filled' || status === 'kept') pass[status]++;
    }
    pass.filled += await sweep(profileMap(packet), used);
    pass.pdf = attach(packet.resume || (await keptResume()));
    return pass;
  }

  /** Required questions still empty: these are yours. */
  function stillEmpty() {
    const seen = new Set();
    return questions()
      .filter((q) => q.required && q.label && !answered(q) && !seen.has(q.label) && seen.add(q.label))
      .map((q) => ({ label: q.label, el: q.el }));
  }

  function markSubmit() {
    const submit = submitButton();
    if (!submit) return;
    submit.style.outline = '2px solid #00FF41';
    submit.style.outlineOffset = '3px';
    submit.style.boxShadow = '0 0 0 6px rgba(0,255,65,.18), 0 0 28px rgba(0,255,65,.55)';
  }

  // =====================================================================================================
  // Questions RADAR could not read ahead: read here, answered by RADAR (profile, AI, HUMANIZE), filled
  // =====================================================================================================

  const TYPE = {
    text: 'text',
    textarea: 'textarea',
    combo: 'text',
    select: 'select',
    listbox: 'select',
    radio: 'select',
    buttons: 'select',
    checkboxes: 'multiselect',
  };
  const sentToRadar = new Set(); // labels already asked in this tab: never twice

  /** Ask RADAR about the open questions it has not seen; fill its answers. Returns how many were filled. */
  async function askRadar(packet, hud) {
    const known = (packet.asked || []).map(norm);
    const isKnown = (l) =>
      known.some((a) => a === l || (Math.min(a.length, l.length) > 12 && (a.startsWith(l) || l.startsWith(a))));
    const open = questions().filter(
      (q) => TYPE[q.kind] && q.label && !answered(q) && !isKnown(norm(q.label)) && !sentToRadar.has(norm(q.label)),
    );
    if (!open.length) return null;
    open.forEach((q) => sentToRadar.add(norm(q.label)));
    // A pop-up list shows its options only while it is open.
    await exclusive(async () => {
      for (const q of open) if (q.kind === 'listbox') q.options = await listboxOptions(q.el);
    });
    const id = Date.now();
    const byName = new Map(open.map((q, i) => ['q' + i, q]));
    const status = hud
      ? hud.live('AI', `${open.length} more questions on this form: RADAR is answering them…`)
      : () => {};
    const started = Date.now();
    const tick = setInterval(
      () => status(`${open.length} more questions: RADAR is answering… ${Math.round((Date.now() - started) / 1000)}s`),
      1000,
    );
    try {
      return await waitAnswers();
    } finally {
      clearInterval(tick);
    }
    async function waitAnswers() {
      const sent = await ask({
        type: 'questions',
        id,
        fields: [...byName].map(([name, q]) => ({
          name,
          label: q.label.slice(0, 600),
          type: q.kind === 'text' && ['email', 'tel', 'url'].includes(q.el.type) ? q.el.type : TYPE[q.kind],
          required: q.required,
          ...(q.options && q.options.length ? { options: q.options.slice(0, 200).map((o) => o.slice(0, 300)) } : {}),
        })),
      });
      if (!sent || !sent.ok) {
        status(`${(sent && sent.error) || 'RADAR did not get them'}: these questions are yours`, 'err');
        return null;
      }
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        const entry = await ask({ type: 'packet' });
        if (!entry || entry.done) return null;
        if (!entry.more || entry.more.id !== id) continue;
        if (entry.more.error) {
          status('RADAR could not answer them: ' + entry.more.error, 'err');
          return null;
        }
        return exclusive(async () => {
          let n = 0;
          for (const f of (entry.more.packet && entry.more.packet.fields) || []) {
            const asked = byName.get(f.name);
            // The page may have redrawn the question meanwhile: find it again by its label.
            const q = asked && (asked.el.isConnected ? asked : questions().find((x) => x.label === asked.label));
            if (q && !answered(q) && (await answer(q, [].concat(f.value).filter(Boolean), f.submit))) n++;
          }
          const left = open.length - n;
          status(
            `${open.length} questions: ${n} answered by RADAR` +
              (left ? ` · ${left} left for you (NEEDS YOU)` : ' · all done'),
            left ? 'you' : 'ok',
          );
          return n;
        });
      }
      status('RADAR did not answer in time: keep its tab open, then reload this page', 'err');
      return null;
    }
  }

  // =====================================================================================================
  // Confirmation: a new page (Lever's /thanks) or a thank-you text that was not on the page while you filled it
  // (a job description can say "thank you for your interest", so that phrase is not used at all)
  // =====================================================================================================

  const CONFIRM =
    /thanks? (you )?for (applying|your application|submitting)|application (has been |was |is )?(submitted|received|sent|complete)|we('ve| have) (received|got) your application|successfully (submitted|applied)|you('ve| have) (successfully )?applied|application submitted/gi;
  const confirmations = () => (pageText().match(CONFIRM) || []).length;
  const pageText = () => (document.body && document.body.innerText.slice(0, 20000)) || '';
  const confirmedPath = () => /\/(thanks|thank-you|confirmation|submitted)(\/|$|\?)/i.test(location.pathname);
  // How many confirmation phrases the page had while you filled it: only a new one counts.
  let textBefore = 0;
  let fieldsBefore = 0;
  // Single-page forms (Ashby, Workable) swap the form for a message without a new page: the form is gone and no
  // field is marked invalid.
  const formGone = () =>
    fieldsBefore >= 3 && visibleFields().length === 0 && !deepAll(document, '[aria-invalid="true"]').some(visible);
  const confirmed = () => confirmedPath() || confirmations() > textBefore || formGone();

  // =====================================================================================================
  // The panel (top frame only): shadow DOM, so the page's styles never touch it. Drag it by its header; ─ or a
  // double-click folds it. Each NEEDS YOU question has ✎: type the answer, RADAR fills it and remembers it.
  // =====================================================================================================

  const POS_KEY = 'radar-hud-pos';

  function mountHud(job) {
    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial}[hidden]{display:none!important}
      .hud{position:relative;width:350px;max-width:calc(100vw - 32px);background:rgba(2,7,3,.95);border:1px solid rgba(0,255,65,.45);
        color:#d9ffe0;font:12px/1.55 "JetBrains Mono","Cascadia Code",Consolas,ui-monospace,monospace;overflow:hidden;
        box-shadow:0 0 0 1px rgba(0,0,0,.6),0 22px 70px rgba(0,0,0,.7),0 0 42px rgba(0,255,65,.16);backdrop-filter:blur(8px);
        transition:box-shadow .3s ease;animation:boot .7s steps(7) both,edge 3s ease-in-out .7s infinite}
      .hud.dragging{box-shadow:0 0 0 1px rgba(0,255,65,.7),0 28px 80px rgba(0,0,0,.75),0 0 60px rgba(0,255,65,.3);
        animation:jolt .18s steps(2) infinite}
      .hud:after{content:"";position:absolute;left:0;right:0;height:38px;top:-40px;pointer-events:none;z-index:2;
        background:linear-gradient(180deg,transparent,rgba(0,255,65,.09),transparent);animation:beam 3.4s linear infinite}
      .dragging:after{animation-duration:.7s}
      .dragging .title{animation:glitch .25s steps(1) infinite}
      .dragging .corner{border-color:#22D3EE}
      .trace{position:absolute;right:10px;bottom:4px;z-index:4;font-size:9px;letter-spacing:.14em;color:#22D3EE;opacity:0;transition:opacity .2s}
      .dragging .trace{opacity:1}
      .hex{height:12px;overflow:hidden;font-size:9px;letter-spacing:.1em;color:rgba(0,255,65,.4);padding:0 10px;white-space:nowrap;
        border-bottom:1px solid rgba(0,255,65,.1)}
      .dragging .hex{color:#22D3EE}
      .hud:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;
        background:repeating-linear-gradient(0deg,rgba(0,255,65,.035) 0 1px,transparent 1px 3px)}
      .corner{position:absolute;width:10px;height:10px;border:2px solid #00FF41;pointer-events:none;z-index:3}
      .c1{top:-1px;left:-1px;border-right:0;border-bottom:0}.c2{top:-1px;right:-1px;border-left:0;border-bottom:0}
      .c3{bottom:-1px;left:-1px;border-right:0;border-top:0}.c4{bottom:-1px;right:-1px;border-left:0;border-top:0}
      header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,255,65,.18);position:relative;
        cursor:grab;user-select:none;touch-action:none}
      .dragging header{cursor:grabbing}
      header:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(0,255,65,.10),transparent);
        transform:translateX(-100%);animation:scan 2.6s linear infinite;pointer-events:none}
      .dot{width:12px;height:12px;border-radius:50%;border:1px solid #00FF41;background:conic-gradient(from 0deg,rgba(0,255,65,.85),transparent 30%);
        animation:spin 1.6s linear infinite;flex:none}
      .title{letter-spacing:.28em;font-size:10px;color:#00FF41;animation:glitch 4s steps(1) infinite}
      .job{color:#8fae95;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .sig{display:flex;gap:2px;align-items:flex-end;height:10px}.sig i{width:2px;background:#00FF41;animation:sig 1.2s ease-in-out infinite}
      .sig i:nth-child(1){height:3px}.sig i:nth-child(2){height:6px;animation-delay:.15s}.sig i:nth-child(3){height:9px;animation-delay:.3s}
      .state{font-size:9px;letter-spacing:.2em;padding:1px 6px;border:1px solid currentColor;color:#FACC15;white-space:nowrap}
      .min{all:unset;cursor:pointer;color:#8fae95;padding:0 4px;font-size:14px;line-height:1;transition:transform .35s ease,color .2s}
      .min:hover{color:#00FF41}.closed .min{transform:rotate(180deg)}
      .fold{display:grid;grid-template-rows:1fr;transition:grid-template-rows .38s cubic-bezier(.2,.8,.2,1),opacity .3s ease}
      .closed .fold{grid-template-rows:0fr;opacity:0}
      .fold>div{overflow:hidden;min-height:0}
      .body{padding:8px 10px 10px;position:relative}.log{min-height:60px;max-height:200px;overflow:auto;scrollbar-width:thin}
      .line{white-space:pre-wrap;word-break:break-word;animation:in .25s ease}.tag{color:#6b8f73}
      .ok{color:#00FF41}.ai{color:#22D3EE}.you{color:#FACC15}.err{color:#FF5555}.dim{color:#6b8f73}
      .needs{margin-top:8px;border-top:1px dashed rgba(250,204,21,.35);padding-top:6px}
      .needs b{display:block;font-weight:600;font-size:10px;letter-spacing:.22em;color:#FACC15;margin-bottom:3px}
      .need{display:flex;align-items:center;gap:6px}
      .jump{all:unset;flex:1;min-width:0;box-sizing:border-box;cursor:pointer;color:#f5f0c8;padding:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .jump:hover{color:#FACC15}
      .answer input:focus{border-color:#FACC15;box-shadow:0 0 12px rgba(250,204,21,.35)}
      .answer{display:flex;gap:6px;margin:4px 0 6px;animation:in .2s ease}
      .answer input{all:unset;flex:1;min-width:0;border:1px solid rgba(250,204,21,.5);padding:4px 6px;color:#fff8d6;background:rgba(250,204,21,.05)}
      .answer button{all:unset;cursor:pointer;background:#FACC15;color:#000;font-weight:700;padding:0 8px;font-size:10px;letter-spacing:.12em}
      .row{display:flex;gap:6px;margin-top:10px}
      button.btn{all:unset;flex:1;text-align:center;cursor:pointer;padding:7px 6px;font-size:10px;font-weight:700;letter-spacing:.18em;
        border:1px solid rgba(0,255,65,.5);color:#00FF41;transition:background .2s}
      button.btn:hover{background:rgba(0,255,65,.1)}
      button.go{background:#00FF41;color:#000;border-color:#00FF41}button.go:hover{background:#33ff66}
      .note{margin-top:7px;color:#6b8f73;font-size:10px}
      .done{font-size:15px;font-weight:800;letter-spacing:.08em;color:#00FF41;text-shadow:0 0 18px rgba(0,255,65,.6);margin:6px 0}
      @keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{to{transform:translateX(100%)}}
      @keyframes sig{50%{opacity:.25}}@keyframes in{from{opacity:0;transform:translateY(3px)}}
      @keyframes boot{0%{clip-path:inset(0 0 100% 0);filter:brightness(3)}60%{clip-path:inset(0 0 30% 0)}100%{clip-path:inset(0);filter:none}}
      @keyframes edge{50%{border-color:rgba(0,255,65,.85)}}@keyframes beam{to{top:100%}}
      @keyframes jolt{0%{transform:translate(1px,0);filter:drop-shadow(-2px 0 rgba(255,42,109,.5))}
        100%{transform:translate(-1px,0);filter:drop-shadow(2px 0 rgba(34,211,238,.5))}}
      @keyframes glitch{0%,96%{text-shadow:none}97%{text-shadow:-2px 0 #FF2A6D,2px 0 #22D3EE}98%{text-shadow:2px 0 #FF2A6D,-2px 0 #22D3EE}}
      .arm{position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);animation:in .2s ease}
      .arm>div{position:relative;width:330px;max-width:calc(100vw - 32px);border:1px solid #FF2A6D;background:rgba(10,2,5,.96);padding:18px;
        text-align:center;box-shadow:0 0 60px rgba(255,42,109,.35);animation:boot .5s steps(5) both}
      .arm b{display:block;font-size:10px;letter-spacing:.32em;color:#FF2A6D;animation:glitch 1s steps(1) infinite}
      .arm .t{font-size:58px;font-weight:800;line-height:1.1;margin:8px 0 2px;color:#fff;text-shadow:0 0 24px rgba(255,42,109,.8)}
      .arm .bar{height:3px;background:#FF2A6D;margin:10px 0 14px;transform-origin:left;animation:drain 5s linear forwards}
      .arm .j{font-size:10px;color:#c9a3ae;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .arm .row{margin-top:0}.arm button.go{background:#FF2A6D;border-color:#FF2A6D;color:#000}
      @keyframes drain{to{transform:scaleX(0)}}
      .fuse{margin:10px 0 4px;padding:10px 10px 8px;border:1px solid rgba(255,176,0,.35);background:
        linear-gradient(90deg,rgba(255,176,0,.06),transparent 60%),repeating-linear-gradient(135deg,transparent 0 6px,rgba(255,176,0,.035) 6px 7px);animation:in .25s ease}
      .fuse .top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
      .fuse b{font-size:9px;letter-spacing:.3em;color:#FFB000}
      .fuse .clock{font-size:30px;font-weight:800;color:#FFE7A8;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(255,140,0,.6)}
      .fuse .clock small{font-size:11px;color:#a8874a;margin-left:2px}
      .fuse .wire{position:relative;height:14px;margin:6px 0 8px}
      .fuse .wire:before{content:"";position:absolute;left:0;right:0;top:6px;height:2px;
        background:repeating-linear-gradient(90deg,#6b4b12 0 5px,#3a2806 5px 8px)}
      .fuse .ash{position:absolute;right:0;top:6px;height:2px;background:#1a1408;width:0}
      .fuse .spark{position:absolute;top:1px;width:12px;height:12px;margin-left:-6px;border-radius:50%;
        background:radial-gradient(circle,#fff 0 18%,#FFD54A 30%,#FF7A00 55%,transparent 70%);
        box-shadow:0 0 14px 4px rgba(255,140,0,.55);animation:spark .14s steps(2) infinite}
      .fuse.held .spark{animation:none;filter:grayscale(1) brightness(.6);box-shadow:none}
      .fuse.held .clock{color:#8a7a5a;text-shadow:none}
      .fuse .why{font-size:10px;color:#a8874a;min-height:15px}
      .fuse .row{margin-top:6px}.fuse button.go{background:#FFB000;border-color:#FFB000;color:#000}
      @keyframes spark{50%{transform:scale(.7) rotate(40deg);opacity:.75}}
      @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
    </style>
    <section class="hud" role="status" aria-live="polite">
      <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>
      <header title="Drag to move · double-click to fold"><span class="dot"></span><span class="title">RADAR://FILL</span>
        <span class="job"></span><span class="sig" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="state">ARMED</span><button class="min" title="Fold / unfold" aria-label="Fold or unfold">▾</button></header>
      <div class="hex" aria-hidden="true"></div><span class="trace" aria-hidden="true"></span>
      <div class="fold"><div><div class="body"><div class="log"></div>
        <div class="needs" hidden><b>NEEDS YOU · TYPE HERE, RADAR LEARNS</b><div class="list"></div></div>
        <div class="row"><button class="btn" data-act="submit">▼ SUBMIT</button><button class="btn go" data-act="sent">✓ I SUBMITTED IT</button></div>
        <div class="note">Once every field is filled, a 60 s fuse sends it. Hold it any time to review.</div></div></div></div>
    </section>`;
    document.documentElement.appendChild(host);
    // Apps that hydrate the whole document (Greenhouse is a Remix app) drop nodes they did not render: put it back.
    setInterval(() => host.isConnected || document.documentElement.appendChild(host), 400);
    const $ = (s) => root.querySelector(s);
    const hud = $('.hud');
    let stopFuse = null;
    $('.job').textContent = job;
    // A running packet stream under the header; it races while the panel is dragged.
    const hexLine = () =>
      Array.from({ length: 24 }, () => ((Math.random() * 256) | 0).toString(16).padStart(2, '0')).join(' ');
    let tick = 0;
    setInterval(() => {
      if (hud.classList.contains('dragging') || ++tick % 4 === 0) $('.hex').textContent = hexLine();
    }, 90);

    // Fold and unfold, smoothly (the body's row height animates to 0).
    const fold = () => hud.classList.toggle('closed');
    $('.min').addEventListener('click', (e) => {
      e.stopPropagation();
      fold();
    });
    $('header').addEventListener('dblclick', fold);

    // Drag by the header; the spot is remembered for this site and kept on screen.
    const place = (left, top) => {
      const r = hud.getBoundingClientRect();
      const x = Math.min(Math.max(8, left), innerWidth - r.width - 8);
      const y = Math.min(Math.max(8, top), innerHeight - 48);
      Object.assign(host.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
      return { x, y };
    };
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (saved) requestAnimationFrame(() => place(saved.x, saved.y));
    } catch {
      // no storage on this page: the default corner
    }
    $('header').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = host.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      hud.classList.add('dragging');
      $('header').setPointerCapture(e.pointerId);
      let last = null;
      const move = (m) => {
        last = place(m.clientX - dx, m.clientY - dy);
        $('.trace').textContent = `TRACE ${last.x | 0}:${last.y | 0}`;
      };
      const up = () => {
        hud.classList.remove('dragging');
        $('header').removeEventListener('pointermove', move);
        if (last)
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(last));
          } catch {
            // not remembered: fine
          }
      };
      $('header').addEventListener('pointermove', move);
      $('header').addEventListener('pointerup', up, { once: true });
    });

    let teach = null; // set by the run: (question, answer, el) => void
    let mirror = null; // set by the run: (el, text) => void, each keystroke
    let pendingNeeds = null;
    const api = {
      job: (text) => ($('.job').textContent = text),
      async log(tag, text, tone = 'ok') {
        const line = document.createElement('div');
        line.className = 'line';
        line.innerHTML = `<span class="tag">[${tag}]</span> <span class="${tone}"></span>`;
        $('.log').appendChild(line);
        $('.log').scrollTop = $('.log').scrollHeight;
        const out = line.lastElementChild;
        if (!still)
          for (let i = 0; i < text.length; i += 3) {
            out.textContent = text.slice(0, i);
            await sleep(9);
          }
        out.textContent = text;
      },
      /** A status line that changes in place (no stale "answering…" left behind): returns set(text, tone). */
      live(tag, text, tone = 'ai') {
        const line = document.createElement('div');
        line.className = 'line';
        line.innerHTML = `<span class="tag">[${tag}]</span> <span></span>`;
        $('.log').appendChild(line);
        $('.log').scrollTop = $('.log').scrollHeight;
        const set = (t, k = tone) => {
          line.lastElementChild.className = k;
          line.lastElementChild.textContent = t;
        };
        set(text);
        return set;
      },
      state(label, color = '#FACC15') {
        $('.state').textContent = label;
        $('.state').style.color = color;
      },
      onTeach: (fn) => (teach = fn),
      onMirror: (fn) => (mirror = fn),
      // Every question you owe gets its own box: what you type goes straight into the form's field (text fields
      // live, as you type), and Enter or leaving the box teaches RADAR the answer for every later form.
      needs(list) {
        // Not while you are typing in a box: the list waits until you leave it.
        if (root.activeElement && root.activeElement.closest('.list')) return (pendingNeeds = list);
        pendingNeeds = null;
        $('.needs').hidden = !list.length;
        $('.list').replaceChildren(
          ...list.slice(0, 7).map(({ label, el }) => {
            const item = document.createElement('div');
            const jump = document.createElement('button');
            jump.className = 'jump';
            jump.textContent = '⤷ ' + label;
            jump.title = 'Go to this question in the form';
            if (el)
              jump.addEventListener('click', () => {
                el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
                glow(el, '250,204,21');
              });
            const box = document.createElement('form');
            box.className = 'answer';
            box.innerHTML =
              '<input autocomplete="off" name="radar-teach" placeholder="type here: fills the form, RADAR remembers"><button type="submit">↵</button>';
            const input = box.querySelector('input');
            // Only what you typed is learned: browser autofill must never teach RADAR ("RADAR" once became an answer).
            let typed = false;
            input.addEventListener('keydown', (e) => (typed = typed || (e.isTrusted && e.key.length === 1)));
            input.addEventListener('paste', () => (typed = true));
            input.addEventListener('input', () => mirror && mirror(el, input.value));
            let taught = '';
            const commit = () => {
              const value = input.value.trim();
              if (!typed || !value || value === taught || !teach) return;
              taught = value;
              teach(label, value, el);
            };
            box.addEventListener('submit', (e) => {
              e.preventDefault();
              commit();
              input.blur(); // focus leaving the list lets it redraw at once
            });
            input.addEventListener('blur', () => {
              commit();
              setTimeout(() => pendingNeeds && api.needs(pendingNeeds), 0);
            });
            item.append(jump, box);
            return item;
          }),
        );
      },
      on(act, fn) {
        root.querySelector(`[data-act="${act}"]`).addEventListener('click', fn);
      },
      note: (text) => ($('.note').textContent = text),
      /** Before ZERO-DAY presses Submit: a 5 s countdown; resolves 'go' (time up or EXECUTE) or 'hold' (FREEZE). */
      countdown(sec, label) {
        return new Promise((resolve) => {
          const box = document.createElement('div');
          box.className = 'arm';
          box.innerHTML = `<div><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>
            <b>// PAYLOAD ARMED · SUBMIT IN</b><div class="t"></div><div class="j"></div><div class="bar"></div>
            <div class="row"><button class="btn" data-k="hold">⏸ FREEZE · REVIEW</button>
            <button class="btn go" data-k="go">⚡ EXECUTE NOW</button></div></div>`;
          box.querySelector('.j').textContent = label;
          box.querySelector('.bar').style.animationDuration = sec + 's';
          root.appendChild(box);
          let left = sec;
          const t = box.querySelector('.t');
          const end = (how) => {
            clearInterval(timer);
            box.remove();
            resolve(how);
          };
          t.textContent = left;
          const timer = setInterval(() => (--left <= 0 ? end('go') : (t.textContent = left)), 1000);
          box.addEventListener('click', (e) => {
            const k = e.target.closest('button')?.dataset.k;
            if (k) end(k);
          });
        });
      },
      /**
       * HACK's auto-send: a burning fuse for `sec` seconds. HOLD pauses it (so does typing in the form), SEND NOW skips
       * the wait, ABORT leaves Submit to you. Resolves 'go' or 'abort'.
       */
      fuse(sec) {
        return new Promise((resolve) => {
          const box = document.createElement('div');
          box.className = 'fuse';
          box.innerHTML = `<div class="top"><b>// FUSE LIT · AUTO-SEND</b><span class="clock"></span></div>
            <div class="wire"><i class="ash"></i><i class="spark"></i></div><div class="why"></div>
            <div class="row"><button class="btn" data-k="hold">❚❚ HOLD</button><button class="btn" data-k="abort">✕ ABORT</button>
            <button class="btn go" data-k="go">⚡ SEND NOW</button></div>`;
          $('.body').insertBefore(box, $('.row'));
          const [clock, ash, spark, why, hold] = ['.clock', '.ash', '.spark', '.why', '[data-k="hold"]'].map((s) =>
            box.querySelector(s),
          );
          let left = sec * 10; // tenths
          let held = false;
          const paint = () => {
            const burnt = 100 * (1 - left / (sec * 10));
            ash.style.width = burnt + '%';
            spark.style.left = 100 - burnt + '%';
            clock.innerHTML = Math.ceil(left / 10) + '<small>s</small>';
          };
          const setHeld = (on, reason) => {
            held = on;
            box.classList.toggle('held', on);
            hold.textContent = on ? '▶ RESUME' : '❚❚ HOLD';
            why.textContent = on ? reason : 'every field is filled · it sends itself unless you hold it';
          };
          const end = (how) => {
            clearInterval(timer);
            document.removeEventListener('input', typed, true);
            box.remove();
            stopFuse = null;
            resolve(how);
          };
          // The application was logged another way (you pressed Submit yourself): the fuse stops for good.
          stopFuse = () => end('abort');
          // You are editing the form: the fuse waits for you.
          // Only your own typing holds it: RADAR's fills (and answers taught in the panel) fire synthetic events.
          const typed = (e) =>
            e.isTrusted && !held && !host.contains(e.target) && setHeld(true, 'held: you are editing the form');
          document.addEventListener('input', typed, true);
          setHeld(false);
          paint();
          const timer = setInterval(() => {
            if (held) return;
            left--;
            paint();
            if (left <= 0) end('go');
          }, 100);
          box.addEventListener('click', (e) => {
            const k = e.target.closest('button')?.dataset.k;
            if (k === 'hold') setHeld(!held, 'held: review it, then RESUME or SEND NOW');
            else if (k) end(k);
          });
        });
      },
      hideSubmitJump: () => (root.querySelector('[data-act="submit"]').hidden = true),
      done(text) {
        if (stopFuse) stopFuse();
        if (root.querySelector('.done')) return; // the watcher and the fuse can both see the confirmation
        api.state('LOGGED', '#00FF41');
        $('.needs').hidden = true;
        $('.row').hidden = true;
        $('.note').textContent = text;
        const big = document.createElement('div');
        big.className = 'done';
        big.textContent = '✓ APPLICATION LOGGED';
        // Pinned above the log, panel unfolded, so it is seen the moment it happens (not buried under old lines).
        $('.body').prepend(big);
        hud.classList.remove('closed');
        $('.log').scrollTop = $('.log').scrollHeight;
      },
    };
    return api;
  }

  // =====================================================================================================
  // Run
  // =====================================================================================================

  const LOGGED = 'Logged in RADAR · C2 · OPS. RADAR now watches for the reply.';
  const PDF = {
    attached: (p) => [`${(p.resume || keptPdf).name} attached`, 'ok'],
    kept: () => ['a resume is already attached', 'ok'],
    none: (p) => [
      p.resume || keptPdf ? 'no upload field found' : 'no resume PDF: upload yours once in RADAR → Settings → RESUME',
      'you',
    ],
  };

  // Questions RADAR left empty on any pass. What you type into them yourself is learned when you press Submit, so the
  // next form that asks gets your words. Never secrets: passwords, OTPs, card or ID numbers are skipped.
  const leftForYou = new Set();
  const LEARNABLE = new Set(['text', 'textarea', 'select', 'radio', 'buttons']);
  const SECRET =
    /password|passcode|otp|one[- ]time|captcha|cvv|card number|aadhaa?r|\bpan\b|ssn|social security|passport/i;
  const noteLeft = () => {
    for (const q of questions()) if (q.label && LEARNABLE.has(q.kind) && !answered(q)) leftForYou.add(q.label);
  };
  function answerText(q) {
    if (q.kind === 'select') return [...q.el.selectedOptions].map((o) => o.textContent.trim()).join(', ');
    if (q.kind === 'radio') return choiceText(q.els.find((b) => b.checked));
    if (q.kind === 'buttons')
      return (q.els.find((b) => b.getAttribute('aria-pressed') === 'true') || {}).textContent || '';
    return q.el.value;
  }
  function learnYours() {
    for (const q of questions()) {
      if (!leftForYou.has(q.label) || !answered(q) || q.el.type === 'password' || SECRET.test(q.label)) continue;
      const value = String(answerText(q) || '').trim();
      if (value && value.length <= 2000) ask({ type: 'learn', question: q.label, answer: value });
      leftForYou.delete(q.label);
    }
  }

  /** What the form looks like now, to RADAR (toast) and to the panel (lines, NEEDS YOU). */
  function report(hud, lines) {
    noteLeft();
    const needs = stillEmpty();
    markSubmit();
    const filled = questions().filter(answered).length;
    ask({ type: 'filled', filled, needs: needs.length, lines, labels: needs.map((n) => n.label) });
    if (hud) {
      for (const [tag, text, tone] of lines) hud.log(tag, text, tone);
      hud.needs(needs);
    }
  }

  /** After you press the employer's Submit: log the application when the employer confirms it. */
  function watchForConfirmation(hud) {
    let armedAt = 0;
    const arm = () => {
      if (!armedAt) learnYours();
      armedAt = Date.now();
      ask({ type: 'armed' });
    };
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target instanceof Element && e.target.closest('button, input[type=submit]');
        if (b && SUBMIT.test(b.textContent || b.value || '')) arm();
      },
      true,
    );
    document.addEventListener('submit', arm, true);
    const watch = setInterval(async () => {
      if (!armedAt || Date.now() - armedAt > 5 * 60_000 || !confirmed()) return;
      clearInterval(watch);
      const res = await ask({ type: 'submitted' });
      if (hud && res && res.ok) hud.done(LOGGED);
    }, 900);
  }

  // =====================================================================================================
  // ZERO-DAY: pre-flight, then (unless DRY RUN) the form's own Submit, then the employer's confirmation
  // =====================================================================================================

  function captchaNow() {
    const frames = [...document.querySelectorAll('iframe')]
      // Invisible reCAPTCHA preloads its challenge frame hidden (visibility: hidden): only a frame you can see counts.
      .filter((f) => {
        if (!visible(f) || f.getBoundingClientRect().height <= 10) return false;
        for (let n = f; n && n.nodeType === 1; n = n.parentElement) {
          const st = getComputedStyle(n);
          if (st.visibility === 'hidden' || st.opacity === '0') return false;
        }
        return true;
      })
      .map((f) => ({ src: f.src || '' }));
    const solved = [
      ...document.querySelectorAll(
        '[name="g-recaptcha-response"], [name="h-captcha-response"], [name="cf-turnstile-response"]',
      ),
    ].some((t) => t.value);
    return radarPreflight.captchaIn({ frames, solved });
  }

  const SUBMIT_TEXT = /^(submit( (my )?application)?|send( application)?|apply( now)?)$/i;
  function submitCandidates() {
    const named = deepAll(scope, 'button, input[type=submit]').filter(
      (b) => visible(b) && SUBMIT_TEXT.test((b.textContent || b.value || '').trim()),
    );
    if (named.length) return named;
    const b = submitButton();
    return b ? [b] : [];
  }

  /** What pre-flight sees: the form as it is now. */
  function snapshot(packet) {
    const open = questions().filter((q) => q.required && q.label && !answered(q));
    const fields = packet.fields.filter((f) => f.type !== 'file' && [].concat(f.value).filter(Boolean).length);
    const found = fields.filter((f) => {
      const el = byNameOrId(f.name) || byLabel(f.label);
      const q = el && questionOf(el);
      return q && answered(q);
    }).length;
    const input = fileInput();
    return {
      https: location.protocol === 'https:',
      host: location.hostname,
      hasForm: hasForm(packet),
      needs: open.filter((q) => q.kind !== 'checkbox' && q.kind !== 'file').map((q) => q.label),
      consents: open.filter((q) => q.kind === 'checkbox').map((q) => q.label),
      fileInput: !!input,
      resume: attachedHere || (input && input.files && input.files.length) ? 'attached' : 'none',
      captcha: captchaNow(),
      password: deepAll(document, 'input[type=password]').some(visible),
      submits: submitCandidates().length,
      // Only measurable on a form RADAR read ahead (its own field names): is this the form the answers are for?
      coverage: packet.asked && packet.asked.length && fields.length ? found / fields.length : null,
    };
  }

  function park(hud, reasons) {
    ask({ type: 'autopilot', state: 'parked', reasons });
    if (!hud) return;
    hud.state('NEEDS YOU', '#FACC15');
    for (const r of reasons) hud.log('YOU', r, 'you');
    hud.note('ZERO-DAY left this one to you. Fix what is listed, then press Submit; RADAR logs it.');
  }

  const FUSE_SECONDS = 60;
  let fuseLit = false;
  let fuseWhy = '';
  let fuseWhyLine = null;
  /** The fuse burned down: press the form's Submit and log it when the employer confirms. */
  async function sendNow(hud) {
    if (captchaNow()) return park(hud, ['a CAPTCHA is on the form: finish it, then press Submit']);
    const button = submitCandidates()[0];
    if (!button) return park(hud, ['no Submit button found: press it yourself']);
    hud.log('SYS', "fuse burned down: pressing the form's Submit", 'dim');
    await ask({ type: 'armed' });
    button.click();
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      if (confirmed()) {
        const text = (pageText().match(CONFIRM) || [''])[0];
        const res = await ask({ type: 'submitted', confirmation: { url: location.href, text } });
        if (res && res.ok) hud.done(LOGGED);
        return;
      }
      // Greenhouse may email a one-time code before it accepts: that code is yours to type.
      if (deepAll(document, '[id^="security-input"]').some(visible))
        return park(hud, ['the employer emailed you a security code: type it here, then press Submit (RADAR logs it)']);
      // Some forms (Ashby) take the first click to run their invisible check: press once more.
      if (i === 4 && !confirmed() && submitCandidates()[0]) submitCandidates()[0].click();
      if (captchaNow()) return park(hud, ['a CAPTCHA appeared after Submit: finish it in this tab']);
      if (deepAll(scope, '[aria-invalid="true"]').some(visible))
        return park(hud, ['the form showed an error after Submit: check this tab']);
    }
    park(hud, ['no confirmation 60 s after Submit: check this tab']);
  }

  async function autoFinish(packet, hud) {
    // Only the consent classes you pre-approved are ticked; arbitration and anything else never are.
    for (const q of questions()) {
      const pre = AUTO.consents.includes(radarPreflight.consentClass(q.label));
      if (q.kind === 'checkbox' && q.required && !answered(q) && pre) q.el.click();
    }
    await sleep(600);
    const verdict = radarPreflight.preflight(snapshot(packet));
    if (!verdict.submit) return park(hud, verdict.reasons);
    if (AUTO.dryRun) {
      ask({ type: 'autopilot', state: 'ready' });
      if (hud) {
        hud.state('DRY RUN ✓', '#00FF41');
        hud.log('OK', 'every check passed: ZERO-DAY would press Submit now (DRY RUN is on)', 'ok');
      }
      return;
    }
    const go = await ask({ type: 'may-submit' });
    if (!go || !go.ok) return park(hud, ['ZERO-DAY was stopped before Submit']);
    // Last word is yours: the tab comes to the front with a 5 s countdown. FREEZE keeps it here for you to review.
    if (hud) {
      await ask({ type: 'front' });
      hud.state('ARMED', '#FF2A6D');
      if ((await hud.countdown(5, document.title)) === 'hold')
        return park(hud, ['you froze it to review: press Submit yourself when it looks right']);
      const again = await ask({ type: 'may-submit' }); // KILL during the countdown wins
      if (!again || !again.ok) return park(hud, ['ZERO-DAY was stopped before Submit']);
    }
    ask({ type: 'autopilot', state: 'submitting' });
    await ask({ type: 'armed' });
    if (hud) hud.log('SYS', "every check passed: pressing the form's Submit", 'dim');
    submitCandidates()[0].click();
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      if (confirmed()) {
        const text = (pageText().match(CONFIRM) || [''])[0];
        const res = await ask({ type: 'submitted', confirmation: { url: location.href, text } });
        if (hud && res && res.ok) hud.done(LOGGED);
        return;
      }
      if (captchaNow()) return park(hud, ['a CAPTCHA appeared after Submit: finish it in this tab']);
      if (deepAll(scope, '[aria-invalid="true"]').some(visible))
        return park(hud, ['the form showed an error after Submit: check this tab']);
    }
    park(hud, ['no confirmation 60 s after Submit: check this tab']);
  }

  /**
   * Fill the form with what has arrived, ask RADAR about the questions it has not seen, then stay with the form for
   * 30 minutes: answers that arrive later (the AI's) and new steps of a multi-step form are filled as they come.
   */
  async function session(packet, version, hud) {
    textBefore = confirmations();
    fieldsBefore = visibleFields().length;
    let asking = 0;
    const settle = () => {
      if (!hud) return;
      const busy = asking > 0 || packet.partial;
      hud.state(busy ? 'ANSWERING' : 'READY', busy ? '#22D3EE' : '#00FF41');
    };
    const askMore = async () => {
      asking++;
      settle();
      try {
        const n = await askRadar(packet, hud);
        if (n)
          report(hud, []); // the live status line already says how many
        else if (n === 0) report(hud, []); // none answerable from your materials: NEEDS YOU lists them
      } finally {
        asking--;
        settle();
      }
    };

    const first = await exclusive(() => fillPass(packet));
    report(hud, [
      ['OK', `${first.filled} fields filled${first.kept ? ` · ${first.kept} already had your answer` : ''}`, 'ok'],
      ['PDF', ...PDF[first.pdf](packet)],
    ]);
    if (hud && packet.partial) hud.log('AI', 'your written answers are on the way: drafted, then humanized…', 'ai');
    settle();
    watchForConfirmation(hud);
    void askMore();

    let fields = visibleFields().length;
    const startedAt = Date.now();
    for (const until = Date.now() + 30 * 60_000; Date.now() < until;) {
      await sleep(1200);
      const entry = await ask({ type: 'packet' });
      if (!entry || entry.done) return;
      const arrived = entry.version !== version && entry.packet;
      const newStep = visibleFields().length !== fields;
      // Heartbeat for debugging a form that waits: what the loop sees on each tick.
      document.documentElement.dataset.radarTick = JSON.stringify({
        t: Date.now(),
        arrived: !!arrived,
        newStep,
        fields,
        now: visibleFields().length,
        asking,
        partial: !!packet.partial,
        fuseLit,
        done: !!entry.done,
      });
      if (WORKDAY && !arrived && !newStep && asking === 0 && !packet.partial && workdayNext()) {
        if (hud) hud.log('SYS', 'step complete: Save and Continue', 'dim');
        await sleep(2500);
        fields = -1; // the next step gets its own pass, even if it happens to have as many fields
        continue;
      }
      // ZERO-DAY decides once every answer is in (or after 5 minutes without them).
      if (AUTO && !arrived && !newStep && asking === 0 && !packet.partial)
        return exclusive(() => autoFinish(packet, hud));
      if (AUTO && Date.now() - startedAt > 5 * 60_000) return park(hud, ['the answers did not arrive in time']);
      // HACK: once every answer is in and pre-flight is clean, light the fuse (once per tab).
      if (!AUTO && hud && !fuseLit && !arrived && !newStep && asking === 0 && !packet.partial) {
        let verdict;
        try {
          verdict = radarPreflight.preflight(snapshot(packet));
        } catch (err) {
          // Never die silently: say what broke and keep watching the form.
          const msg = 'fuse check failed: ' + String((err && err.message) || err).slice(0, 120);
          if (msg !== fuseWhy) (fuseWhyLine ||= hud.live('ERR', ''))((fuseWhy = msg), 'err');
          continue;
        }
        if (!verdict.submit) {
          // Say once, in place, why it will not send itself, so nothing waits silently.
          const why = verdict.reasons.join(' · ');
          if (why !== fuseWhy) (fuseWhyLine ||= hud.live('YOU', ''))('fuse waits: ' + (fuseWhy = why), 'you');
        } else {
          if (fuseWhyLine) fuseWhyLine('fuse: every check passes now', 'ok');
          fuseLit = true;
          if ((await hud.fuse(FUSE_SECONDS)) === 'go') return exclusive(() => sendNow(hud));
          const after = await ask({ type: 'packet' });
          if (!after || after.done) return; // already logged: nothing left to do here
          hud.note('Auto-send aborted. Review, then press Submit yourself; RADAR logs it.');
        }
      }
      if (!arrived && !newStep) continue;
      if (arrived) [packet, version] = [entry.packet, entry.version];
      const pass = await exclusive(() => fillPass(packet));
      const lines = [];
      if (arrived) lines.push(['AI', `answers arrived · ${pass.filled} more filled`, 'ai']);
      else if (pass.filled) lines.push(['OK', `${pass.filled} more fields filled on this step`, 'ok']);
      if (pass.pdf === 'attached') lines.push(['PDF', ...PDF.attached(packet)]);
      if (arrived && entry.note) lines.push(['ERR', entry.note, 'err']);
      report(hud, lines);
      settle();
      void askMore();
      fields = visibleFields().length;
    }
  }

  /** A bug must never look like a quiet form: show it in the panel. */
  function crashed(hud, err) {
    console.error('[RADAR]', err);
    if (hud) {
      hud.state('ERROR', '#FF5555');
      hud.log('ERR', 'RADAR hit a bug on this form: ' + String((err && err.message) || err).slice(0, 160), 'err');
    }
  }

  /** The tab opens before the answers exist: wait for RADAR (your facts take about a second), or for why it could not. */
  async function waitForAnswers(entry, hud) {
    if (entry.packet || entry.error) return entry;
    if (hud) {
      hud.state('PREPARING', '#22D3EE');
      hud.log('AI', 'reading the form and your profile…', 'ai');
    }
    for (let i = 0; i < 300 && entry && !entry.packet && !entry.error; i++) {
      await sleep(i < 20 ? 250 : 1000);
      entry = await ask({ type: 'packet' });
    }
    return entry;
  }

  /** A frame (a form embedded from an ATS): fill it quietly; the page's panel shows the result. */
  async function runInFrame() {
    // An answer typed in the panel for a question in this frame (Greenhouse's embed): fill it here.
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'teach') return;
      const q = questions().find((x) => x.label === msg.question);
      if (q && !answered(q)) void exclusive(() => answer(q, [msg.value]));
    });
    let entry = await ask({ type: 'packet' });
    if (!entry || entry.done) return;
    AUTO = entry.auto;
    entry = await waitForAnswers(entry, null);
    if (entry && entry.packet && (await formAppears(entry.packet, () => false, AUTO ? 90 : 600)))
      await session(entry.packet, entry.version, null);
  }

  /** The page: the panel, and the form when it is here. */
  async function runInPage() {
    let hud = null;
    let fromFrame = null; // set when a frame inside this page filled the form
    const showFrame = (report) => {
      hud.hideSubmitJump(); // its Submit is inside the frame
      for (const [tag, text, tone] of report.lines || []) hud.log(tag, text, tone);
      hud.needs((report.labels || []).map((label) => ({ label })));
      hud.state('READY', '#00FF41');
    };
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'frame-report') return;
      if (msg.done) return hud && hud.done(LOGGED);
      fromFrame = msg;
      if (hud) showFrame(msg);
    });

    let entry = await ask({ type: 'packet' });
    if (!entry) return; // the worker only injects into tabs RADAR opened; stay silent if that entry is gone
    hud = mountHud(entry.packet ? entry.packet.job : 'RADAR');
    // NEEDS YOU boxes: text fields follow your typing; on Enter (or leaving the box) the answer goes into the form
    // (choices are picked then) and to RADAR, which gives it to every later form that asks.
    const questionFor = (question, el) => (el && questionOf(el)) || questions().find((x) => x.label === question);
    hud.onMirror((el, text) => {
      const q = el && questionOf(el);
      if (q && (q.kind === 'text' || q.kind === 'textarea')) setValue(q.el, text);
    });
    // The form may live in a frame: then its list is the frame's, minus what you just taught.
    const taughtHere = new Set();
    const refreshNeeds2 = () =>
      fromFrame
        ? hud.needs((fromFrame.labels || []).filter((l) => !taughtHere.has(l)).map((label) => ({ label })))
        : hud.needs(stillEmpty());
    // You answered a question in the form itself: it leaves NEEDS YOU right away, not at the next report.
    let redraw = 0;
    const refreshNeeds = (e) => {
      if (!e.isTrusted) return;
      clearTimeout(redraw);
      redraw = setTimeout(refreshNeeds2, 350);
    };
    document.addEventListener('input', refreshNeeds, true);
    document.addEventListener('change', refreshNeeds, true);
    hud.onTeach(async (question, value, el) => {
      const q = questionFor(question, el);
      if (q && (q.kind === 'text' || q.kind === 'textarea')) setValue(q.el, value);
      else if (q && !answered(q)) await exclusive(() => answer(q, [value]));
      else if (!q) await ask({ type: 'teach-frames', question, value }); // it lives in an embedded form
      await ask({ type: 'learn', question, answer: value });
      hud.log('OK', `learned "${question.slice(0, 48)}": RADAR answers it from now on`, 'ok');
      taughtHere.add(question);
      refreshNeeds2();
    });
    hud.on('sent', async () => {
      learnYours();
      const res = await ask({ type: 'submitted' });
      if (res && res.ok) hud.done(LOGGED);
    });
    hud.on('submit', () => {
      const b = submitButton();
      if (b) b.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    });

    AUTO = entry.auto;
    if (AUTO) {
      hud.state('ZERO-DAY', '#22D3EE');
      hud.note(
        AUTO.dryRun
          ? 'ZERO-DAY · DRY RUN: fills and checks everything, never presses Submit.'
          : "ZERO-DAY presses the form's Submit only when every pre-flight check passes; otherwise it leaves it to you.",
      );
    }
    if (entry.done) return hud.done('Already logged in RADAR · C2 · OPS.');
    if (entry.note) hud.note(entry.note);
    // Back after pressing the employer's Submit (a new page load): log it if the employer confirmed it.
    if (entry.armedAt && Date.now() - entry.armedAt < 5 * 60_000 && confirmed()) {
      hud.log('OK', 'employer confirmed the application', 'ok');
      const res = await ask({ type: 'submitted' });
      if (res && res.ok) hud.done(LOGGED);
      return;
    }
    // A frame filled the form before this page finished loading.
    if (!fromFrame && entry.report && entry.report.frameId !== 0) {
      fromFrame = entry.report;
      showFrame(fromFrame);
    }

    entry = await waitForAnswers(entry, hud);
    if (!entry || !entry.packet) {
      hud.state('NO ANSWERS', '#FF5555');
      hud.log('ERR', (entry && entry.error) || 'the answers did not arrive. Launch again from RADAR.', 'err');
      if (AUTO) park(null, [(entry && entry.error) || 'the answers did not arrive']);
      return;
    }
    hud.job(entry.packet.job);
    if (fromFrame) return;
    hud.state('SCANNING');

    // Fill after the page's own app has taken over its inputs, or it may reset them while hydrating.
    for (let i = 0; i < 40 && document.readyState !== 'complete'; i++) await sleep(250);
    await sleep(400);
    if (postingGone()) {
      hud.state('POSTING GONE', '#FF5555');
      hud.log('ERR', 'this posting no longer exists: the employer took it down', 'err');
      hud.log('SYS', 'reported to RADAR: it leaves your lists, and this tab closes', 'dim');
      ask({ type: 'gone' });
      return;
    }
    if (WORKDAY) await enterWorkday(entry.packet, hud);
    // A sign-in page, however late it draws: the wait below watches for it too.
    let toldWall = false;
    const tellWall = () => {
      if (toldWall) return;
      toldWall = true;
      hud.state('SIGN IN', '#FFB000');
      hud.log(
        'SYS',
        `${location.hostname.split('.')[0]} asks for its own account: sign in or create one on this page. The password stays yours. RADAR fills the form the moment you are in.`,
        'dim',
      );
    };
    if (WORKDAY) for (let i = 0; i < 12 && !accountWall() && !hasForm(entry.packet); i++) await sleep(500);
    if (accountWall()) {
      if (AUTO) return park(hud, ['this site needs you to sign in']);
      tellWall();
      if (!(await formAppears(entry.packet, () => false, 1800))) return;
      hud.state('FILLING');
      return session(entry.packet, entry.version, hud).catch((e) => crashed(hud, e));
    }
    const inFrame = () => !!fromFrame;
    // A form embedded in a frame reports within a few seconds: only then say there is none yet.
    // No form yet: press the page's own Apply / I'm interested button once, and give the form a moment to open.
    if (!hasForm(entry.packet) && !fromFrame && openForm()) {
      hud.log('SYS', "opened the form with the page's own Apply button", 'dim');
      await formAppears(entry.packet, inFrame, 6);
    }
    if (!(await formAppears(entry.packet, inFrame, 3)) && !fromFrame) {
      hud.state('WAITING');
      hud.log(
        'SYS',
        entry.report
          ? 'RADAR filled the form on the previous page. Sent it? Press ✓ I SUBMITTED IT.'
          : 'no form here yet: open it (its Apply button) and RADAR fills it as it appears',
        'dim',
      );
    }
    const watchWall = AUTO ? null : setInterval(() => accountWall() && tellWall(), 1000);
    const appeared = await formAppears(entry.packet, inFrame, AUTO ? 90 : WORKDAY ? 1800 : 600);
    clearInterval(watchWall);
    if (!appeared) {
      if (fromFrame) return;
      if (AUTO) return park(hud, ['the form did not appear']);
      hud.state('NO FORM', '#FF5555');
      return hud.log('ERR', 'no application form appeared on this page', 'err');
    }
    hud.state('FILLING');
    await session(entry.packet, entry.version, hud).catch((e) => crashed(hud, e));
  }

  (TOP ? runInPage : runInFrame)();
})();
