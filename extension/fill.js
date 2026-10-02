// RADAR · Auto-Fill — fills an application form in a tab RADAR opened (the worker injects it into no other tab).
//
//   1. answers   RADAR opens the form at once and sends the answers a few seconds later (the AI drafts them):
//                the panel shows DRAFTING until they arrive.
//   2. the form  on the page, in a frame (Greenhouse embedded in a company site), or appearing later (a modal, an
//                Apply button that reveals it): it waits for the form and never clicks anything to get there.
//   3. filling   by the form's own field names, then ids, then labels; dropdowns, React selects, radios, checkboxes,
//                the tailored PDF. It never overwrites what is already there.
//   4. submit    it marks the Submit button and never presses it, and never touches a CAPTCHA. When the employer
//                confirms the application (or you press "I submitted it"), RADAR logs it in C2 · OPS.

(() => {
  if (window.__radarFill) return;
  window.__radarFill = true;

  const TOP = window === window.top;
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
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  // =====================================================================================================
  // Fields: where they are and what they ask
  // =====================================================================================================

  const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), textarea, select';
  const isShown = (el) => el.type === 'file' || visible(el);

  // Where the application form is, so a newsletter or search box elsewhere on the page is never filled: the <form>
  // with the upload, the long answers and the most fields; the whole page when the form is not a <form> (Workday).
  let scope = document;
  function formRoot() {
    let best = null;
    let top = 2;
    for (const form of document.querySelectorAll('form')) {
      const n =
        [...form.querySelectorAll(FIELD)].filter(isShown).length +
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

  function labelText(el) {
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) return l.textContent;
    }
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => (document.getElementById(id) || {}).textContent || '')
        .join(' ')
        .trim();
      if (t) return t;
    }
    // Lever writes the question once per card (.application-label); the input's own label may hold helper text.
    const card = el.closest('.application-question');
    const head = card && card.querySelector('.application-label');
    if (head) return head.textContent;
    const wrap = el.closest('label');
    if (wrap) return wrap.textContent;
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  }

  /** The question a radio/checkbox group belongs to (its own label is just the option). */
  function groupLabel(el) {
    const box = el.closest('fieldset, [role=radiogroup], [role=group], li.application-question, .application-question');
    const head = box && box.querySelector('legend, .text, [class*="label"], label');
    return (head && head.textContent) || el.name || '';
  }

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
    for (const el of scope.querySelectorAll(FIELD)) {
      if (!isShown(el)) continue;
      const have = norm(labelText(el));
      if (!have) continue;
      if (have === want || (want.length > 12 && (have.startsWith(want) || want.startsWith(have)))) return el;
      if (!fallback && key && keyOf(have) === key) fallback = el;
    }
    return fallback;
  }

  // =====================================================================================================
  // Values (React-controlled inputs need the native setter, then the events React listens to)
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
      const step = Math.max(2, Math.ceil(text.length / 24));
      for (let i = step; i < text.length; i += step) {
        setValue(el, text.slice(0, i));
        await sleep(14);
      }
    }
    setValue(el, text);
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const clickLike = (el) => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  };

  /** A searchable dropdown (React Select and friends): type the answer, then click the matching option. */
  async function pickCombo(input, wanted) {
    input.focus({ preventScroll: true });
    clickLike(input);
    setValue(input, wanted);
    for (let i = 0; i < 12; i++) {
      await sleep(80);
      const listId = input.getAttribute('aria-controls');
      const list = (listId && document.getElementById(listId)) || document;
      const options = [...list.querySelectorAll('[role="option"]')];
      const hit =
        options.find((o) => norm(o.textContent) === norm(wanted)) ||
        options.find((o) => norm(o.textContent).startsWith(norm(wanted)));
      if (hit) {
        clickLike(hit);
        await sleep(60);
        return true;
      }
    }
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }

  // The chosen value sits beside the input, inside the control (React Select: .select__control > .select__single-value).
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

  const groupOf = (el) => (el.name ? [...document.getElementsByName(el.name)] : [el]);

  function pickChoices(el, values) {
    let hit = false;
    for (const box of groupOf(el)) {
      const text = norm((box.closest('label') || {}).textContent || box.value);
      if (!values.some((v) => norm(v) === norm(box.value) || norm(v) === text)) continue;
      hit = true;
      if (!box.checked) box.click();
    }
    return hit;
  }

  function pickSelect(el, field, values) {
    const option = [...el.options].find(
      (o) =>
        (field.submit && o.value === field.submit) ||
        values.some((v) => o.value === v || norm(o.textContent) === norm(v)),
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

  // =====================================================================================================
  // Filling
  // =====================================================================================================

  /** One answer into the form. Never overwrites what is already there. */
  async function fillField(field) {
    const values = [].concat(field.value).filter(Boolean);
    if (!values.length || field.type === 'file') return { status: 'skip' };
    const el = byNameOrId(field.name) || byLabel(field.label);
    if (!el) return { status: 'missing' };
    const isCombo = el.getAttribute('role') === 'combobox';
    const isChoice = el.type === 'radio' || el.type === 'checkbox';
    const answered = isChoice
      ? groupOf(el).some((b) => b.checked)
      : isCombo
        ? comboHasValue(el)
        : el.tagName === 'SELECT'
          ? el.selectedIndex > 0 && !!el.value // the first option is usually "Select…"
          : !!el.value;
    if (answered) return { status: 'kept', el };
    let ok = true;
    if (isChoice) ok = pickChoices(el, values);
    else if (el.tagName === 'SELECT') ok = pickSelect(el, field, values);
    else if (isCombo) for (const v of values) ok = (await pickCombo(el, v)) && ok;
    else await typeInto(el, values.join(', '));
    if (ok) glow(el);
    return { status: ok ? 'filled' : 'missing', el };
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
    for (const el of scope.querySelectorAll(FIELD)) {
      if (used.has(el) || el.value || !visible(el)) continue;
      if (el.type === 'file' || el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') continue;
      if (el.getAttribute('role') === 'combobox') continue;
      const k = keyOf(labelText(el));
      if (!k || !map[k]) continue;
      await typeInto(el, map[k]);
      glow(el);
      used.add(el);
      n++;
    }
    return n;
  }

  // A form RADAR could not read ahead (a company's own page, YC's Work at a Startup): your "why this role" answer
  // goes into the one box that asks for it.
  const WHY_BOX = /why|interest|excit|motivat|cover|message|founder|about (you|yourself)|anything else|additional|note/;
  async function whyFallback(packet, usedFields, used) {
    const answers = packet.fields.filter(
      (f) => f.type === 'textarea' && [].concat(f.value)[0] && !usedFields.has(f.name),
    );
    if (!answers.length) return 0;
    const best = answers.find((f) => /why|interest|motivat/i.test(f.label)) || answers[0];
    const empty = [...scope.querySelectorAll('textarea')].filter((t) => visible(t) && !t.value && !used.has(t));
    const target = empty.find((t) => WHY_BOX.test(norm(labelText(t)))) || (empty.length === 1 ? empty[0] : null);
    if (!target) return 0;
    await typeInto(target, [].concat(best.value)[0]);
    glow(target);
    used.add(target);
    return 1;
  }

  function fileInput() {
    return (
      scope.querySelector(
        'input[type=file]#resume, input[type=file][name="resume"], input[type=file][id*="resume" i], input[type=file][name*="resume" i], input[type=file][aria-label*="resume" i]',
      ) ||
      [...scope.querySelectorAll('input[type=file]')].find((i) => /resume|\bcv\b/i.test(labelText(i))) ||
      scope.querySelector('input[type=file]')
    );
  }

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
  // Reading the page
  // =====================================================================================================

  const visibleFields = (root = scope) => [...root.querySelectorAll(FIELD)].filter(isShown);
  // An application form, not a search box or a newsletter signup: a file upload, two of the form's own field names,
  // three standard fields (name, email, phone…), or the one "why" box a short form (YC Work at a Startup) asks for.
  function hasForm(packet) {
    if (document.querySelector('input[type=file]')) return true;
    if (packet.fields.filter((f) => byNameOrId(f.name)).length >= 2) return true;
    const fields = visibleFields(document);
    if (fields.filter((el) => keyOf(labelText(el))).length >= 3) return true;
    return fields.some((el) => el.tagName === 'TEXTAREA' && WHY_BOX.test(norm(labelText(el))));
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

  /** Required fields still empty after filling: these are yours. */
  function stillEmpty() {
    const out = [];
    const seen = new Set();
    for (const el of visibleFields()) {
      const text = labelText(el) || '';
      const isChoice = el.type === 'radio' || el.type === 'checkbox';
      const required = el.required || el.getAttribute('aria-required') === 'true' || /\*\s*$/.test(text.trim());
      if (!required && !(isChoice && /\*/.test(groupLabel(el)))) continue;
      const empty =
        el.type === 'file'
          ? !(el.files && el.files.length)
          : isChoice
            ? !groupOf(el).some((b) => b.checked)
            : el.getAttribute('role') === 'combobox'
              ? !comboHasValue(el)
              : !el.value;
      if (!empty) continue;
      const label = (isChoice ? groupLabel(el) : text).replace(/[*✱]/g, '').trim();
      const id = isChoice ? 'g:' + el.name : label;
      if (!label || seen.has(id)) continue; // an unlabeled input is a widget's inner part, not a question
      seen.add(id);
      out.push({ label, el });
    }
    return out;
  }

  const SUBMIT = /submit|apply|send/i;
  // The form's own Submit: after its last field (an "Apply" button above the form only opened it).
  function submitButton() {
    const text = (b) => (b.textContent || b.value || '').trim();
    const fields = visibleFields();
    const last = fields[fields.length - 1];
    const all = [...scope.querySelectorAll('button, input[type=submit]')].filter(
      (b) => visible(b) && SUBMIT.test(text(b)),
    );
    const after = last ? all.filter((b) => last.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) : all;
    const pool = after.length ? after : all;
    return (
      pool.find((b) => /submit application|^submit$/i.test(text(b))) || pool.find((b) => b.type === 'submit') || null
    );
  }

  // A confirmation is a new page (Lever's /thanks) or a thank-you text that was not on the page while you filled it
  // (a job description can say "thank you for your interest", so that phrase is not used at all).
  const CONFIRM =
    /thank you for (applying|your application)|application (has been |was )?(submitted|received)|we('ve| have) received your application|successfully submitted/i;
  const pageText = () => (document.body && document.body.innerText.slice(0, 20000)) || '';
  const confirmedPath = () => /\/(thanks|thank-you|confirmation|submitted)(\/|$|\?)/i.test(location.pathname);
  let textBefore = false;
  const confirmed = () => confirmedPath() || (!textBefore && CONFIRM.test(pageText()));

  // =====================================================================================================
  // The panel (top frame only): shadow DOM, so the page's styles never touch it
  // =====================================================================================================

  function mountHud(job) {
    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial}[hidden]{display:none!important}
      .hud{position:relative;width:340px;max-width:calc(100vw - 32px);background:rgba(3,8,4,.96);border:1px solid rgba(0,255,65,.45);
        color:#d9ffe0;font:12px/1.55 "JetBrains Mono","Cascadia Code",Consolas,ui-monospace,monospace;
        box-shadow:0 0 0 1px rgba(0,0,0,.6),0 18px 60px rgba(0,0,0,.65),0 0 36px rgba(0,255,65,.14);backdrop-filter:blur(6px)}
      .hud:before,.hud:after{content:"";position:absolute;width:10px;height:10px;border:2px solid #00FF41;pointer-events:none}
      .hud:before{top:-2px;left:-2px;border-right:0;border-bottom:0}.hud:after{bottom:-2px;right:-2px;border-left:0;border-top:0}
      header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,255,65,.18);position:relative;overflow:hidden}
      header:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(0,255,65,.10),transparent);
        transform:translateX(-100%);animation:scan 2.6s linear infinite}
      .dot{width:12px;height:12px;border-radius:50%;border:1px solid #00FF41;background:conic-gradient(from 0deg,rgba(0,255,65,.85),transparent 30%);
        animation:spin 1.6s linear infinite;flex:none}
      .title{letter-spacing:.28em;font-size:10px;color:#00FF41}.job{color:#8fae95;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .state{font-size:9px;letter-spacing:.2em;padding:1px 6px;border:1px solid currentColor;color:#FACC15}
      .min{all:unset;cursor:pointer;color:#8fae95;padding:0 4px}
      .body{padding:8px 10px 10px}.log{min-height:60px}
      .line{white-space:pre-wrap;word-break:break-word}.tag{color:#6b8f73}
      .ok{color:#00FF41}.ai{color:#22D3EE}.you{color:#FACC15}.err{color:#FF5555}.dim{color:#6b8f73}
      .needs{margin-top:8px;border-top:1px dashed rgba(250,204,21,.35);padding-top:6px;overflow:hidden}
      .needs b{display:block;font-weight:600;font-size:10px;letter-spacing:.22em;color:#FACC15;margin-bottom:3px}
      .jump{all:unset;display:block;box-sizing:border-box;width:100%;cursor:pointer;color:#f5f0c8;padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .jump:hover{color:#FACC15}
      .row{display:flex;gap:6px;margin-top:10px}
      button.btn{all:unset;flex:1;text-align:center;cursor:pointer;padding:7px 6px;font-size:10px;font-weight:700;letter-spacing:.18em;
        border:1px solid rgba(0,255,65,.5);color:#00FF41}
      button.btn:hover{background:rgba(0,255,65,.1)}
      button.go{background:#00FF41;color:#000;border-color:#00FF41}button.go:hover{background:#33ff66}
      .note{margin-top:7px;color:#6b8f73;font-size:10px}
      .done{font-size:15px;font-weight:800;letter-spacing:.08em;color:#00FF41;text-shadow:0 0 18px rgba(0,255,65,.6);margin:6px 0}
      .closed .body{display:none}
      @keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{to{transform:translateX(100%)}}
      @media (prefers-reduced-motion: reduce){.dot,header:after{animation:none}}
    </style>
    <section class="hud" role="status" aria-live="polite">
      <header><span class="dot"></span><span class="title">RADAR://FILL</span><span class="job"></span>
        <span class="state">ARMED</span><button class="min" title="Minimise" aria-label="Minimise">–</button></header>
      <div class="body"><div class="log"></div><div class="needs" hidden><b>NEEDS YOU</b><div class="list"></div></div>
        <div class="row"><button class="btn" data-act="submit">▼ SUBMIT</button><button class="btn go" data-act="sent">✓ I SUBMITTED IT</button></div>
        <div class="note">RADAR never presses Submit. Review, then send it yourself.</div></div>
    </section>`;
    document.documentElement.appendChild(host);
    // Apps that hydrate the whole document (Greenhouse is a Remix app) drop nodes they did not render: put it back.
    setInterval(() => host.isConnected || document.documentElement.appendChild(host), 400);
    const $ = (s) => root.querySelector(s);
    $('.job').textContent = job;
    $('.min').addEventListener('click', () => $('.hud').classList.toggle('closed'));
    const api = {
      job: (text) => ($('.job').textContent = text),
      async log(tag, text, tone = 'ok') {
        const line = document.createElement('div');
        line.className = 'line';
        line.innerHTML = `<span class="tag">[${tag}]</span> <span class="${tone}"></span>`;
        $('.log').appendChild(line);
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
      needs(list) {
        $('.needs').hidden = !list.length;
        $('.list').replaceChildren(
          ...list.slice(0, 7).map(({ label, el }) => {
            const b = document.createElement('button');
            b.className = 'jump';
            b.textContent = '⤷ ' + label;
            if (el)
              b.addEventListener('click', () => {
                el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
                el.focus({ preventScroll: true });
                glow(el, '250,204,21');
              });
            return b;
          }),
        );
      },
      on(act, fn) {
        root.querySelector(`[data-act="${act}"]`).addEventListener('click', fn);
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

  /** One pass over the form as it is now. Safe to repeat: it never overwrites an answer. */
  async function fillPass(packet) {
    scope = formRoot();
    const used = new Set();
    const usedFields = new Set();
    const pass = { filled: 0, kept: 0, missing: 0, pdf: 'none' };
    for (const field of packet.fields) {
      const { status, el } = await fillField(field);
      if (el) used.add(el);
      if (status === 'filled' || status === 'kept') usedFields.add(field.name);
      if (status in pass) pass[status]++;
      if (status === 'filled' && !still) await sleep(45);
    }
    pass.filled += await sweep(profileMap(packet), used);
    pass.filled += await whyFallback(packet, usedFields, used);
    pass.pdf = attach(packet.resume);
    return pass;
  }

  function markSubmit() {
    const submit = submitButton();
    if (!submit) return;
    submit.style.outline = '2px solid #00FF41';
    submit.style.outlineOffset = '3px';
    submit.style.boxShadow = '0 0 0 6px rgba(0,255,65,.18), 0 0 28px rgba(0,255,65,.55)';
  }

  /** The panel's lines for one fill. */
  function summary(packet, pass, needs) {
    const pdf = {
      attached: [`${packet.resume && packet.resume.name} attached`, 'ok'],
      kept: ['a resume is already attached', 'ok'],
      none: [packet.resume ? 'no upload field found' : 'no tailored resume: attach yours', 'you'],
    }[pass.pdf];
    return [
      ['OK', `${pass.filled} fields filled${pass.kept ? ` · ${pass.kept} already had your answer` : ''}`, 'ok'],
      ...(pass.missing ? [['AI', `${pass.missing} answers had no matching field on this form`, 'ai']] : []),
      ['PDF', ...pdf],
      needs.length
        ? ['YOU', `${needs.length} required left for you`, 'you']
        : ['OK', 'every required field has an answer', 'ok'],
    ];
  }

  /** Fill the form in this document, tell RADAR (and the page's panel), then stay with it until it is sent. */
  async function fillHere(packet, hud) {
    textBefore = CONFIRM.test(pageText());
    const pass = await fillPass(packet);
    await sleep(300);
    const needs = stillEmpty();
    markSubmit();
    const lines = summary(packet, pass, needs);
    ask({
      type: 'filled',
      filled: pass.filled + pass.kept,
      needs: needs.length,
      lines,
      labels: needs.map((n) => n.label),
    });
    if (hud) {
      for (const [tag, text, tone] of lines) await hud.log(tag, text, tone);
      hud.needs(needs);
      hud.state('READY', '#00FF41');
    }
    watchForConfirmation(hud);
    keepFilling(packet, hud);
  }

  // Multi-step forms (Workday, SmartRecruiters…) show their next step without loading a new page: fill each one too.
  function keepFilling(packet, hud) {
    let seen = visibleFields().length;
    let busy = false;
    const until = Date.now() + 30 * 60_000;
    const timer = setInterval(async () => {
      if (Date.now() > until) return clearInterval(timer);
      if (busy || visibleFields().length === seen) return;
      busy = true;
      const pass = await fillPass(packet);
      markSubmit();
      if (hud) {
        if (pass.filled) hud.log('OK', `${pass.filled} more fields filled on this step`, 'ok');
        hud.needs(stillEmpty());
      }
      seen = visibleFields().length;
      busy = false;
    }, 1500);
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

  /**
   * The tab opens before the answers exist: wait for RADAR to draft them and HUMANIZE them (validate → fix rounds,
   * up to a few minutes), or to say why it could not.
   */
  async function waitForAnswers(entry, hud) {
    if (entry.packet || entry.error) return entry;
    if (hud) {
      hud.state('DRAFTING', '#22D3EE');
      await hud.log('AI', 'drafting your answers for this form…', 'ai');
    }
    for (let i = 0; i < 300 && entry && !entry.packet && !entry.error; i++) {
      await sleep(1000);
      entry = await ask({ type: 'packet' });
      if (hud && i === 12)
        hud.log('AI', 'humanizing: a strict reviewer checks each answer for AI tells, then fixes them', 'ai');
    }
    return entry;
  }

  /** A frame (a form embedded from an ATS): fill it quietly; the page's panel shows the result. */
  async function runInFrame() {
    let entry = await ask({ type: 'packet' });
    if (!entry || entry.done) return;
    entry = await waitForAnswers(entry, null);
    if (entry && entry.packet && (await formAppears(entry.packet))) await fillHere(entry.packet, null);
  }

  /** The page: the panel, and the form when it is here. */
  async function runInPage() {
    let hud = null;
    let fromFrame = null; // set when a frame inside this page filled the form
    const showFrame = async (report) => {
      hud.hideSubmitJump(); // its Submit is inside the frame
      for (const [tag, text, tone] of report.lines || []) await hud.log(tag, text, tone);
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
    hud.on('sent', async () => {
      const res = await ask({ type: 'submitted' });
      if (res && res.ok) hud.done(LOGGED);
    });
    hud.on('submit', () => {
      const b = submitButton();
      if (b) b.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    });

    if (entry.done) return hud.done('Already logged in RADAR · C2 · OPS.');
    // Back after pressing the employer's Submit (a new page load): log it if the employer confirmed it.
    if (entry.armedAt && Date.now() - entry.armedAt < 5 * 60_000 && confirmed()) {
      await hud.log('OK', 'employer confirmed the application', 'ok');
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
      await hud.log('ERR', (entry && entry.error) || 'the answers did not arrive. Launch again from RADAR.', 'err');
      return;
    }
    const { packet } = entry;
    hud.job(packet.job);
    if (fromFrame) return;
    hud.state('SCANNING');
    await hud.log('SYS', `${packet.fields.length} answers armed for ${packet.job}`, 'dim');

    // Fill after the page's own app has taken over its inputs, or it may reset them while hydrating.
    for (let i = 0; i < 40 && document.readyState !== 'complete'; i++) await sleep(250);
    await sleep(500);
    const inFrame = () => !!fromFrame;
    // A form embedded in a frame reports within a few seconds: only then say there is none yet.
    if (!(await formAppears(packet, inFrame, 3)) && !fromFrame) {
      hud.state('WAITING');
      await hud.log(
        'SYS',
        entry.report
          ? 'RADAR filled the form on the previous page. Sent it? Press ✓ I SUBMITTED IT.'
          : 'no form here yet: open it (its Apply button) and RADAR fills it as it appears',
        'dim',
      );
    }
    if (!(await formAppears(packet, inFrame))) {
      if (fromFrame) return;
      hud.state('NO FORM', '#FF5555');
      return hud.log('ERR', 'no application form appeared on this page', 'err');
    }
    hud.state('FILLING');
    await fillHere(packet, hud);
  }

  (TOP ? runInPage : runInFrame)();
})();
