// RADAR · Auto-Fill — service worker.
//
// One click in RADAR opens the job's form at once; the answers follow a few seconds later (the AI drafts them while
// the page loads). This worker keeps one entry per tab RADAR opened, in session storage (memory only, gone when the
// browser closes), and puts fill.js into that tab only: every page load and every form frame inside it, on any site.
// It never touches a tab RADAR did not open.

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

async function inject(tabId, frameId) {
  try {
    const [frame] = await chrome.webNavigation
      .getAllFrames({ tabId })
      .then((all) => all.filter((f) => f.frameId === frameId));
    if (frame && NEVER.test(frame.url)) return;
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ['preflight.js', 'fill.js'],
    });
  } catch {
    // A page the browser keeps scripts out of (chrome://, the Web Store): nothing to fill there.
  }
}

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (!/^https?:/.test(url) || !(await read(tabId))) return;
  if (frameId === 0 || FORM_FRAME.test(url)) inject(tabId, frameId);
});

/** Open the form next to the RADAR tab and remember the tab as RADAR's. */
async function openForm(msg, sender) {
  let url;
  try {
    url = new URL(msg.url);
  } catch {
    return { ok: false, error: 'not a valid link' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'only https forms are opened' };
  if (msg.packet && msg.packet.radar !== 1) return { ok: false, error: 'not a RADAR fill packet' };
  // PHANTOM opens forms in the background, so they never steal your screen.
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
    // PHANTOM: { dryRun, consents }. Absent for ↯ HACK and INFILTRATE (you submit).
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

const handlers = {
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
  // From an PHANTOM form tab: ready (checks passed), submitting, or parked with the reasons. Relayed to RADAR.
  async autopilot(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || !entry.auto) return { ok: false };
    tellRadar(entry, { type: 'autopilot', state: msg.state, reasons: msg.reasons || [] });
    return { ok: true };
  },
  // From an PHANTOM form tab, right before it presses Submit: only while the run is on (the kill switch).
  async 'may-submit'(msg, sender) {
    const entry = await read(sender.tab.id);
    const { autopilotOn } = await chrome.storage.session.get('autopilotOn');
    return { ok: !!(entry && entry.auto && !entry.auto.dryRun && autopilotOn) };
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
  // From RADAR: the daily PHANTOM alarm (your local time), or none.
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
    await chrome.storage.local.set({ autopilotUrl: new URL('/phantom?autostart=1', sender.url).href });
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
