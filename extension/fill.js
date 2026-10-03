// RADAR · Auto-Fill — fills an application form in a tab RADAR opened (the worker injects it into no other tab).
//
//   1. answers    your profile facts and PDF arrive about a second after the tab opens; the AI's written answers
//                 follow (drafted, then humanized) and fill in as they come.
//   2. the form   on the page, in a frame (Greenhouse embedded in a company site), or appearing later (an Apply
//                 button, a modal); multi-step forms step by step. It never clicks anything to get there.
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

  // Fills one at a time: answers arriving while a pass runs wait for it, so two never type into the page at once.
  let queue = Promise.resolve();
  const exclusive = (job) => (queue = queue.then(job, job));

  // =====================================================================================================
  // Reading the form: every question as one object (its label, kind, options, controls)
  // =====================================================================================================

  const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), textarea, select';
  /** Controls a question can be answered with: fields, and Yes/No style toggle buttons (Ashby). */
  const CONTROL = FIELD + ', button[aria-pressed]';
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
  ];
  const keyOf = (label) => {
    const l = norm(label);
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
    for (const sel of ['legend', '.application-label', '.text']) {
      const head = box && box.querySelector(sel);
      if (head && head.textContent.trim()) return head;
    }
    return blockHead(el, own);
  }

  const groupOf = (el) => (el.name ? [...document.getElementsByName(el.name)] : [el]);
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
      if (el.tagName === 'BUTTON') {
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
      } else if (el.getAttribute('role') === 'combobox') q = { kind: 'combo', el, els: [el] };
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
        (!!head && /required/i.test(String(head.className)));
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
      case 'file':
        return !!(q.el.files && q.el.files.length);
      case 'select':
        return selectAnswered(q.el);
      case 'combo':
        return comboHasValue(q.el) || !!q.el.value.trim();
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
    if (deepAll(document, 'input[type=file]').length) return true;
    if (packet.fields.filter((f) => byNameOrId(f.name)).length >= 2) return true;
    const fields = visibleFields(document);
    if (fields.filter((el) => keyOf(labelText(el))).length >= 3) return true;
    return fields.some((el) => el.tagName === 'TEXTAREA' && NOTE_BOX.test(norm(labelText(el))));
  }

  // A job page whose form opens only behind its own button ("Apply for this job", "I'm interested", Workable's
  // APPLICATION tab). Opening it is not applying; "Apply with LinkedIn / Indeed" is never pressed.
  const OPENER =
    /^(apply( now| here| for this (job|position|role))?|i'?m interested|start (my |your )?application|application)$/i;
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
  async function pickCombo(input, wanted, loose) {
    input.focus({ preventScroll: true });
    clickLike(input);
    setValue(input, wanted);
    const w = norm(wanted);
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      const listId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
      const list = (listId && document.getElementById(listId)) || document;
      const options = [...list.querySelectorAll('[role="option"]')].filter(visible);
      const hit =
        options.find((o) => norm(o.textContent) === w) ||
        options.find((o) => norm(o.textContent).startsWith(w)) ||
        options.find((o) => w.length > 3 && norm(o.textContent).includes(w)) ||
        (loose && i >= 8 && options[0]);
      if (hit) {
        clickLike(hit);
        await sleep(150);
        return true;
      }
    }
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setValue(input, '');
    return false;
  }

  function pickChoices(els, values) {
    let hit = false;
    for (const box of els) {
      const text = norm(choiceText(box));
      if (!values.some((v) => norm(v) === norm(box.value) || norm(v) === text)) continue;
      hit = true;
      if (!box.checked) box.click();
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

  function attach(resume) {
    const input = fileInput();
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
    else if (q.kind === 'combo') {
      const place = /location|city|where.*(based|live|located)/i.test(q.label);
      ok = true;
      for (const v of values) ok = (await pickCombo(q.el, v, place)) && ok;
    } else if (q.kind !== 'file') {
      await typeInto(q.el, values.join(', '));
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
    if (!map.full_name && map.first_name) map.full_name = [map.first_name, map.last_name].filter(Boolean).join(' ');
    return map;
  }

  async function sweep(map, used) {
    let n = 0;
    for (const q of questions()) {
      if (used.has(q.el) || (q.kind !== 'text' && q.kind !== 'combo') || answered(q)) continue;
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
    const id = Date.now();
    const byName = new Map(open.map((q, i) => ['q' + i, q]));
    if (hud) hud.log('AI', `${open.length} more questions on this form: RADAR is answering them…`, 'ai');
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
      if (hud) hud.log('ERR', `${(sent && sent.error) || 'RADAR did not get them'}: these questions are yours`, 'err');
      return null;
    }
    for (let i = 0; i < 300; i++) {
      await sleep(1000);
      const entry = await ask({ type: 'packet' });
      if (!entry || entry.done) return null;
      if (!entry.more || entry.more.id !== id) continue;
      if (entry.more.error) {
        if (hud) hud.log('ERR', 'RADAR could not answer them: ' + entry.more.error, 'err');
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
        return n;
      });
    }
    if (hud) hud.log('ERR', 'RADAR did not answer in time: keep its dashboard tab open', 'err');
    return null;
  }

  // =====================================================================================================
  // Confirmation: a new page (Lever's /thanks) or a thank-you text that was not on the page while you filled it
  // (a job description can say "thank you for your interest", so that phrase is not used at all)
  // =====================================================================================================

  const CONFIRM =
    /thank you for (applying|your application)|application (has been |was )?(submitted|received)|we('ve| have) received your application|successfully submitted/i;
  const pageText = () => (document.body && document.body.innerText.slice(0, 20000)) || '';
  const confirmedPath = () => /\/(thanks|thank-you|confirmation|submitted)(\/|$|\?)/i.test(location.pathname);
  let textBefore = false;
  const confirmed = () => confirmedPath() || (!textBefore && CONFIRM.test(pageText()));

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
        <div class="note">RADAR never presses Submit. Review, then send it yourself.</div></div></div></div>
    </section>`;
    document.documentElement.appendChild(host);
    // Apps that hydrate the whole document (Greenhouse is a Remix app) drop nodes they did not render: put it back.
    setInterval(() => host.isConnected || document.documentElement.appendChild(host), 400);
    const $ = (s) => root.querySelector(s);
    const hud = $('.hud');
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
              '<input placeholder="type here: fills the form, RADAR remembers"><button type="submit">↵</button>';
            const input = box.querySelector('input');
            input.addEventListener('input', () => mirror && mirror(el, input.value));
            let taught = '';
            const commit = () => {
              const value = input.value.trim();
              if (!value || value === taught || !teach) return;
              taught = value;
              teach(label, value, el);
            };
            box.addEventListener('submit', (e) => {
              e.preventDefault();
              commit();
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
      hideSubmitJump: () => (root.querySelector('[data-act="submit"]').hidden = true),
      done(text) {
        api.state('LOGGED', '#00FF41');
        $('.needs').hidden = true;
        $('.row').hidden = true;
        $('.note').textContent = text;
        const big = document.createElement('div');
        big.className = 'done';
        big.textContent = '✓ APPLICATION LOGGED';
        $('.log').appendChild(big);
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

  /** What the form looks like now, to RADAR (toast) and to the panel (lines, NEEDS YOU). */
  function report(hud, lines) {
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
      .filter((f) => visible(f) && f.getBoundingClientRect().height > 10)
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
      resume: input && input.files && input.files.length ? 'attached' : 'none',
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
    textBefore = CONFIRM.test(pageText());
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
        if (n) report(hud, [['AI', `${n} more questions answered`, 'ai']]);
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
      // ZERO-DAY decides once every answer is in (or after 5 minutes without them).
      if (AUTO && !arrived && !newStep && asking === 0 && !packet.partial)
        return exclusive(() => autoFinish(packet, hud));
      if (AUTO && Date.now() - startedAt > 5 * 60_000) return park(hud, ['the answers did not arrive in time']);
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
    hud.onTeach(async (question, value, el) => {
      const q = questionFor(question, el);
      if (q && (q.kind === 'text' || q.kind === 'textarea')) setValue(q.el, value);
      else if (q && !answered(q)) await exclusive(() => answer(q, [value]));
      await ask({ type: 'learn', question, answer: value });
      hud.log('OK', `learned "${question.slice(0, 48)}": RADAR answers it from now on`, 'ok');
      hud.needs(stillEmpty());
    });
    hud.on('sent', async () => {
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
    if (!(await formAppears(entry.packet, inFrame, AUTO ? 90 : 600))) {
      if (fromFrame) return;
      if (AUTO) return park(hud, ['the form did not appear']);
      hud.state('NO FORM', '#FF5555');
      return hud.log('ERR', 'no application form appeared on this page', 'err');
    }
    hud.state('FILLING');
    await session(entry.packet, entry.version, hud);
  }

  (TOP ? runInPage : runInFrame)();
})();
