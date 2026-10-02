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
const tellRadar = (entry, message) =>
  chrome.tabs
    .sendMessage(entry.radarTab, { ...message, matchId: entry.matchId, tailoredId: entry.tailoredId })
    .catch(() => {});
const tellPage = (tabId, message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {});

/** The tabs RADAR opened for this match that are still waiting to be sent. */
async function tabsForMatch(matchId) {
  const all = await chrome.storage.session.get(null);
  return Object.entries(all)
    .filter(([k, v]) => k.startsWith('tab:') && v && v.matchId === matchId && !v.done)
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
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['fill.js'] });
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
  const tab = await chrome.tabs.create({ url: url.href, index: sender.tab.index + 1, openerTabId: sender.tab.id });
  await write(tab.id, {
    packet: msg.packet || null,
    error: null,
    matchId: msg.matchId,
    tailoredId: msg.tailoredId || null,
    radarTab: sender.tab.id,
    armedAt: 0,
    report: null,
    done: false,
  });
  // A fast page can finish loading before the entry above existed; fill it now in that case.
  const now = await chrome.tabs.get(tab.id).catch(() => null);
  if (now && now.status === 'complete') inject(tab.id, 0);
  return { ok: true };
}

// A launch still opening its tab: answers that arrive meanwhile wait for it instead of finding no tab.
const launching = new Map();

const handlers = {
  // From RADAR: open the form now. The packet may come with it, or a moment later through `arm`.
  launch(msg, sender) {
    const opening = openForm(msg, sender);
    launching.set(msg.matchId, opening);
    return opening.finally(() => launching.get(msg.matchId) === opening && launching.delete(msg.matchId));
  },
  // From RADAR: the answers for a form that is already open, or the reason there are none.
  async arm(msg) {
    await launching.get(msg.matchId)?.catch(() => {});
    const tabs = await tabsForMatch(msg.matchId);
    for (const tabId of tabs) {
      const entry = await read(tabId);
      await write(tabId, {
        ...entry,
        packet: msg.packet || entry.packet,
        tailoredId: msg.tailoredId ?? entry.tailoredId,
        error: msg.packet ? null : msg.error || null,
      });
    }
    return tabs.length ? { ok: true } : { ok: false, error: 'the form tab was closed' };
  },
  // From the form page: everything it needs to know about its tab. No packet and no error: still drafting.
  async packet(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry) return null;
    const { packet, error, done, armedAt, report } = entry;
    return { packet, error, done, armedAt, report };
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
  // You pressed the employer's Submit: remembered across the confirmation page load.
  async armed(msg, sender) {
    return { ok: !!(await update(sender.tab.id, { armedAt: Date.now() })) };
  },
  // The employer confirmed, or you pressed "I submitted it": RADAR logs the application once.
  async submitted(msg, sender) {
    const entry = await read(sender.tab.id);
    if (!entry || entry.done) return { ok: !!entry, already: !!entry };
    await write(sender.tab.id, { ...entry, done: true });
    tellRadar(entry, { type: 'applied' });
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

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(key(tabId)));
