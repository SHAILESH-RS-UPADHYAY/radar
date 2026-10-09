// RADAR · Auto-Fill — service worker.
//
// One click in RADAR opens the job's form at once; the answers follow a few seconds later (the AI drafts them while
// the page loads). This worker keeps one entry per tab RADAR opened, in session storage (memory only, gone when the
// browser closes), and puts fill.js into that tab only: every page load and every form frame inside it, on any site.
// It never touches a tab RADAR did not open, except one you hand it by clicking the extension's icon (or Alt+Shift+R)
// on a careers page: RADAR then adopts that tab and fills it the same way.

const key = (tabId) => 'tab:' + tabId;
const read = async (tabId) => (await chrome.storage.session.get(key(tabId)))[key(tabId)] || null;
const write = (tabId, value) => chrome.storage.session.set({ [key(tabId)]: value });
const update = async (tabId, change) => {
  const entry = await read(tabId);
  if (entry) await write(tabId, { ...entry, ...change });
  return entry;
};
// Answers arrive in steps (your facts first, the AI's answers later): each packet adds to what the tab has.
const merge = (had, next) =>
  had
    ? {
        ...had,
        ...next,
        fields: [...had.fields.filter((f) => !next.fields.some((n) => n.name === f.name)), ...next.fields],
        resume: next.resume || had.resume,
        asked: next.asked || had.asked,
        partial: next.partial, // only the newest packet knows whether more is coming
      }
    : next;
const tellRadar = (entry, message) =>
  chrome.tabs
    .sendMessage(entry.radarTab, { ...message, matchId: entry.matchId, tailoredId: entry.tailoredId })
    .catch(() => {});
const tellPage = (tabId, message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {});

/** The tabs RADAR opened for this match that are still waiting to be sent. */
async function tabsForMatch(matchId, includeDone = false) {
  const all = await chrome.storage.session.get(null);
  return Object.entries(all)
    .filter(([k, v]) => k.startsWith('tab:') && v && v.matchId === matchId && (includeDone || !v.done))
    .map(([k]) => Number(k.slice(4)));
}

// Frames worth filling inside a page: application forms embedded from an ATS. The page itself is always filled.
const FORM_FRAME =
  /greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|recruitee\.com|personio\.|breezy\.hr|teamtailor\.com|bamboohr\.com|jobvite\.com|icims\.com|myworkdayjobs\.com|rippling\.com|dover\.com|applytojob\.com|workatastartup\.com|ycombinator\.com/i;

// Sites whose terms forbid automating them: RADAR opens their links but never fills them.
const NEVER = /^https:\/\/([^/]+\.)?(linkedin\.com|indeed\.[a-z.]+)\//i;

// Job boards whose page is a listing, not the form (Adzuna's /details/, Jooble): follow their Apply link in the same
// tab, so the employer's form loads in a tab RADAR already tracks. Their own search forms are never filled.
const AGGREGATOR = /^https:\/\/([^/]+\.)?(adzuna\.[a-z.]+|jooble\.org)\//i;

/** The Apply link on a board's listing page (runs in the page). */
function boardApplyLink() {
  const links = [...document.querySelectorAll('a[href]')];
  const a =
    links.find((l) => l.dataset.js === 'apply') ||
    links.find((l) => /^\s*apply( for this job| now)?\s*$/i.test(l.textContent || '') && l.offsetParent);
  return a ? a.href : null;
}

async function inject(tabId, frameId) {
  try {
    const [frame] = await chrome.webNavigation
      .getAllFrames({ tabId })
      .then((all) => all.filter((f) => f.frameId === frameId));
    if (frame && NEVER.test(frame.url)) return;
    if (frameId === 0 && frame && AGGREGATOR.test(frame.url)) {
      const [{ result: href }] = await chrome.scripting.executeScript({ target: { tabId }, func: boardApplyLink });
      if (href && /^https:/.test(href) && href !== frame.url) {
        // Where the board's link ends up is told to RADAR on arrival (see onCompleted), so next time it opens there.
        await update(tabId, { fromBoard: true });
        await chrome.tabs.update(tabId, { url: href });
      }
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ['preflight.js', 'fill.js'],
    });
  } catch {
    // A page the browser keeps scripts out of (chrome://, the Web Store): nothing to fill there.
  }
}

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  const entry = /^https?:/.test(url) ? await read(tabId) : null;
  if (!entry) return;
  // Arrived from a job board's link (the redirects in between never complete): the employer's page, for RADAR.
  if (frameId === 0 && entry.fromBoard && !AGGREGATOR.test(url)) {
    await update(tabId, { fromBoard: false });
    if (entry.matchId && entry.radarTab) tellRadar(entry, { type: 'landed', url });
  }
  if (frameId === 0 || FORM_FRAME.test(url)) inject(tabId, frameId);
});

/** Open the form next to the RADAR tab and remember the tab as RADAR's (or fill the tab you adopted). */
async function openForm(msg, sender) {
  if (msg.tabId) {
    const entry = await read(msg.tabId);
    if (!entry) return { ok: false, error: 'that tab was closed' };
    await write(msg.tabId, {
      ...entry,
      matchId: msg.matchId,
      tailoredId: msg.tailoredId || null,
      radarTab: sender.tab.id,
    });
    return { ok: true };
  }
  let url;
  try {
    url = new URL(msg.url);
  } catch {
    return { ok: false, error: 'not a valid link' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'only https forms are opened' };
  if (msg.packet && msg.packet.radar !== 1) return { ok: false, error: 'not a RADAR fill packet' };
  // ZERO-DAY opens forms in the background, so they never steal your screen.
  const tab = await chrome.tabs.create({
    url: url.href,
    index: sender.tab.index + 1,
    openerTabId: sender.tab.id,
    active: !msg.auto,
  });
  await write(tab.id, {
    packet: msg.packet || null,
    version: msg.packet ? 1 : 0,
    error: null,
    note: null,
    more: null,
    matchId: msg.matchId,
    tailoredId: msg.tailoredId || null,
    radarTab: sender.tab.id,
    armedAt: 0,
    report: null,
    done: false,
    // ZERO-DAY: { dryRun, consents }. Absent for ↯ HACK and INFILTRATE (you submit).
    auto: msg.auto || null,
  });
  // A fast page can finish loading before the entry above existed; fill it now in that case.
  const now = await chrome.tabs.get(tab.id).catch(() => null);
  if (now && now.status === 'complete') inject(tab.id, 0);
  return { ok: true };
}

// A launch still opening its tab: answers that arrive meanwhile wait for it instead of finding no tab.
const launching = new Map();

// RADAR's own pages (the bridge runs only there): the only senders whose resume the extension keeps.
const RADAR_PAGE = /^(http:\/\/localhost:(3000|3100)|https:\/\/radar-neon-theta\.vercel\.app)\//;

// After an install, reload or update, RADAR tabs that were already open still hold the old bridge, which is cut
// off from this worker: ↯ HACK would do nothing until you reloaded the page. Give them a fresh one now.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getManifest().content_scripts[0].matches });
  for (const tab of tabs)
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['radar-bridge.js'] }).catch(() => {});
});

const handlers = {
  // From a RADAR page that just loaded: a page you adopted while no RADAR tab was open. Also remembers which RADAR
  // address you use, so the next adopt opens that one.
  async 'pending-adopt'(msg, sender) {
    if (!RADAR_PAGE.test(sender.url || '')) return null;
    await chrome.storage.local.set({ radarOrigin: new URL(sender.url).origin });
    const { pendingAdopt } = await chrome.storage.session.get('pendingAdopt');
    if (!pendingAdopt || !/\/dashboard/.test(sender.url)) return null;
    await chrome.storage.session.remove('pendingAdopt');
    return pendingAdopt;
  },
  // From RADAR: open the form now. The packet may come with it, or a moment later through `arm`.
  launch(msg, sender) {
    const opening = openForm(msg, sender);
    launching.set(msg.matchId, opening);
    return opening.finally(() => launching.get(msg.matchId) === opening && launching.delete(msg.matchId));
  },
  // From RADAR: answers for a form that is already open (added to what it has), answers to the questions the tab
  // asked (`more`), or why there are none (`error`: before any answers it stops the tab, after them it is a note).
  async arm(msg) {
    await launching.get(msg.matchId)?.catch(() => {});
    const tabs = await tabsForMatch(msg.matchId);
    for (const tabId of tabs) {
      const entry = await read(tabId);
      const next = { ...entry, tailoredId: msg.tailoredId ?? entry.tailoredId };
      if (msg.more) next.more = msg.more;
      else if (msg.packet) Object.assign(next, { packet: merge(entry.packet, msg.packet), version: entry.version + 1 });
      else if (msg.error && entry.packet)
        Object.assign(next, {
          note: msg.error,
          packet: { ...entry.packet, partial: false },
          version: entry.version + 1,
        });
      else if (msg.error) next.error = msg.error;
      await write(tabId, next);
    }
    return tabs.length ? { ok: true } : { ok: false, error: 'the form tab was closed' };
  },
  // From the form page: everything it needs to know about its tab. No packet and no error: still preparing.
  async packet(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry) return null;
    const { packet, version, error, note, more, done, armedAt, report, auto } = entry;
    return { packet, version, error, note, more, done, armedAt, report, auto };
  },
  // From the form page: questions RADAR could not read ahead. RADAR's tab answers them (arm with `more`).
  async questions(msg, sender) {
    const entry = await update(sender.tab.id, { more: null });
    if (!entry) return { ok: false, error: 'not a RADAR tab' };
    try {
      await chrome.tabs.sendMessage(entry.radarTab, {
        type: 'questions',
        id: msg.id,
        fields: msg.fields,
        matchId: entry.matchId,
        tailoredId: entry.tailoredId,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'the RADAR tab was closed' };
    }
  },
  // A frame filled the form: RADAR hears it, and the page's panel shows it (also a panel that loads after it).
  async filled(msg, sender) {
    const report = { frameId: sender.frameId, lines: msg.lines, labels: msg.labels };
    const entry = await update(sender.tab.id, { report });
    if (!entry) return { ok: false };
    tellRadar(entry, { type: 'filled', filled: msg.filled, needs: msg.needs });
    if (sender.frameId !== 0) tellPage(sender.tab.id, { type: 'frame-report', ...report });
    return { ok: true };
  },
  // From RADAR: your resume PDF, kept on this computer (storage.local) so every form gets it, whichever RADAR
  // address you use. A new upload replaces it.
  async resume(msg, sender) {
    if (!RADAR_PAGE.test(sender.url || '') || typeof msg.data !== 'string' || !msg.data) return { ok: false };
    await chrome.storage.local.set({
      resume: { name: String(msg.name || 'Resume.pdf').slice(0, 200), data: msg.data },
    });
    return { ok: true };
  },
  // From a form tab RADAR opened that got no PDF with its answers: the resume kept here.
  async 'resume-file'(msg, sender) {
    if (!(await read(sender.tab.id))) return null;
    return (await chrome.storage.local.get('resume')).resume || null;
  },
  // From a ZERO-DAY form tab: ready (checks passed), submitting, or parked with the reasons. Relayed to RADAR.
  async autopilot(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || !entry.auto) return { ok: false };
    tellRadar(entry, { type: 'autopilot', state: msg.state, reasons: msg.reasons || [] });
    return { ok: true };
  },
  // From a ZERO-DAY form tab, right before it presses Submit: only while the run is on (the kill switch).
  async 'may-submit'(msg, sender) {
    const entry = await read(sender.tab.id);
    const { autopilotOn } = await chrome.storage.session.get('autopilotOn');
    return { ok: !!(entry && entry.auto && !entry.auto.dryRun && autopilotOn) };
  },
  // From a ZERO-DAY form tab about to submit: show it, so you see its countdown.
  async front(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || !entry.auto) return { ok: false };
    await chrome.tabs.update(sender.tab.id, { active: true });
    await chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
    return { ok: true };
  },
  // From a form tab: an answer you typed in the panel, for RADAR to remember (relayed to the RADAR tab, which saves it).
  async learn(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || !msg.question || !msg.answer) return { ok: false };
    tellRadar(entry, {
      type: 'learn',
      question: String(msg.question).slice(0, 600),
      answer: String(msg.answer).slice(0, 2000),
    });
    return { ok: true };
  },
  // From RADAR: START (on) or PAUSE / KILL SWITCH (off). Off stops every Submit at once.
  async switch(msg) {
    await chrome.storage.session.set({ autopilotOn: !!msg.on });
    return { ok: true };
  },
  // From RADAR: bring a job's tab to the front (JUMP TO TAB), or close it (done, or skipped).
  async focus(msg) {
    const [tabId] = await tabsForMatch(msg.matchId, true);
    if (tabId === undefined) return { ok: false, error: 'that tab was closed' };
    const tab = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { ok: true };
  },
  async close(msg) {
    for (const tabId of await tabsForMatch(msg.matchId, true)) await chrome.tabs.remove(tabId).catch(() => {});
    return { ok: true };
  },
  // From RADAR: how many jobs need you, on the extension's icon.
  async badge(msg) {
    await chrome.action.setBadgeBackgroundColor({ color: '#FACC15' });
    await chrome.action.setBadgeText({ text: msg.count ? String(msg.count) : '' });
    return { ok: true };
  },
  // From RADAR: the daily ZERO-DAY alarm (your local time), or none.
  async schedule(msg, sender) {
    await chrome.alarms.clear('autopilot');
    if (!msg.enabled || !RADAR_PAGE.test(sender.url || '')) return { ok: true };
    const [h, m] = String(msg.time || '10:00')
      .split(':')
      .map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    chrome.alarms.create('autopilot', { when: at.getTime(), periodInMinutes: 24 * 60 });
    await chrome.storage.local.set({ autopilotUrl: new URL('/zero-day?autostart=1', sender.url).href });
    return { ok: true };
  },
  // You pressed the employer's Submit: remembered across the confirmation page load.
  async armed(msg, sender) {
    return { ok: !!(await update(sender.tab.id, { armedAt: Date.now() })) };
  },
  // The employer confirmed, or you pressed "I submitted it": RADAR logs the application once.
  async submitted(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || entry.done) return { ok: !!entry, already: !!entry };
    await write(sender.tab.id, { ...entry, done: true });
    tellRadar(entry, { type: 'applied', confirmation: msg.confirmation || null });
    if (sender.frameId !== 0) tellPage(sender.tab.id, { type: 'frame-report', done: true });
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = msg && sender.tab && handlers[msg.type];
  if (!handler) return false;
  handler(msg, sender).then(reply, (err) => reply({ ok: false, error: String((err && err.message) || err) }));
  return true; // the reply is async
});

// The daily alarm opens (or brings back) the /autopilot tab; the page starts the run itself.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autopilot') return;
  const { autopilotUrl } = await chrome.storage.local.get('autopilotUrl');
  if (!autopilotUrl) return;
  const [open] = await chrome.tabs.query({ url: autopilotUrl.split('?')[0] + '*' });
  if (open) await chrome.tabs.update(open.id, { active: true, url: autopilotUrl });
  else await chrome.tabs.create({ url: autopilotUrl, pinned: true });
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(key(tabId)));

// An Apply button that opens the employer's form in a new tab: that tab is RADAR's too, with the same answers.
chrome.webNavigation.onCreatedNavigationTarget.addListener(async ({ sourceTabId, tabId }) => {
  const entry = await read(sourceTabId);
  if (entry && !entry.done) await write(tabId, { ...entry, report: null, armedAt: 0 });
});

// ---- Adopt: the icon on any careers page ----

const PROD = 'https://radar-neon-theta.vercel.app';
const flash = (tabId, text, color) => {
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text, tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }).catch(() => {}), 4000);
};

/** What RADAR needs to know about the page: read in the page, nothing else is taken. */
function readPage() {
  const meta = (p) => (document.querySelector(`meta[property="${p}"]`) || {}).content || '';
  const h1 = document.querySelector('h1');
  return {
    url: location.href,
    title: document.title || '',
    heading: (h1 && h1.innerText.trim().slice(0, 300)) || '',
    siteName: meta('og:site_name').slice(0, 150),
    text: (document.body ? document.body.innerText : '').replace(/[ \t]+/g, ' ').slice(0, 15000),
  };
}

async function adopt(tab) {
  if (!tab || !/^https:/.test(tab.url || '')) return flash(tab && tab.id, 'https', '#FF5555');
  if (NEVER.test(tab.url)) return flash(tab.id, 'NO', '#FF5555'); // their terms forbid automation
  if (await read(tab.id)) return flash(tab.id, 'ON', '#00FF41'); // already RADAR's
  let page;
  try {
    [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
  } catch {
    return flash(tab.id, 'ERR', '#FF5555');
  }
  // The tab is RADAR's from here: fill.js shows PREPARING until the answers come.
  await write(tab.id, {
    packet: null,
    version: 0,
    error: null,
    note: null,
    more: null,
    matchId: null,
    tailoredId: null,
    radarTab: null,
    armedAt: 0,
    report: null,
    done: false,
    auto: null,
  });
  inject(tab.id, 0);
  for (const f of await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => []))
    if (f.frameId && FORM_FRAME.test(f.url)) inject(tab.id, f.frameId);
  flash(tab.id, '↯', '#22D3EE');

  // A RADAR dashboard tab does the work (it holds your session): an open one, else one opened in the background.
  const matches = chrome.runtime.getManifest().content_scripts[0].matches;
  const radar = (await chrome.tabs.query({ url: matches })).find((t) => /\/dashboard/.test(t.url || ''));
  const message = { type: 'adopt', tabId: tab.id, page };
  if (
    radar &&
    (await chrome.tabs.sendMessage(radar.id, message).then(
      () => true,
      () => false,
    ))
  )
    return;
  await chrome.storage.session.set({ pendingAdopt: message });
  const { radarOrigin } = await chrome.storage.local.get('radarOrigin');
  await chrome.tabs.create({ url: (radarOrigin || PROD) + '/dashboard', active: false, index: tab.index + 1 });
}

chrome.action.onClicked.addListener(adopt);
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'adopt') adopt(tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
});
