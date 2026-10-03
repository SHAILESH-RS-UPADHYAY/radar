// RADAR · Auto-Fill — runs on the RADAR site only.
// The RADAR page and the extension talk through window.postMessage; this script relays both ways.
// It reads nothing from the page except messages addressed to it ({ radar: 'app' }).

// Re-injected by the worker after an update: one live copy per page.
if (globalThis.__radarBridge) throw new Error('RADAR bridge already running');
globalThis.__radarBridge = true;

const VERSION = chrome.runtime.getManifest().version;
const toPage = (message) => window.postMessage({ radar: 'ext', ...message }, location.origin);

// After the extension is reloaded or updated, this copy in an already-open RADAR tab is cut off from it
// (chrome.runtime.id is gone and every call throws): say so instead of failing silently. A page reload fixes it.
const STALE = 'the RADAR extension was updated: reload this page (F5) and click again';
const alive = () => !!(chrome.runtime && chrome.runtime.id);

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (event.source !== window || !msg || msg.radar !== 'app') return;
  if (msg.type === 'ping') return toPage({ type: 'pong', version: VERSION });
  if (!alive()) {
    if (msg.type === 'launch') toPage({ type: 'launched', matchId: msg.matchId, ok: false, error: STALE });
    return;
  }
  if (msg.type === 'arm')
    return chrome.runtime.sendMessage(
      {
        type: 'arm',
        matchId: msg.matchId,
        packet: msg.packet,
        more: msg.more,
        tailoredId: msg.tailoredId,
        error: msg.error,
      },
      () => void chrome.runtime.lastError,
    );
  if (msg.type === 'resume')
    return chrome.runtime.sendMessage(
      { type: 'resume', name: msg.name, data: msg.data },
      () => void chrome.runtime.lastError,
    );
  // ZERO-DAY's controls: plain relays to the worker.
  if (['switch', 'focus', 'close', 'badge', 'schedule'].includes(msg.type))
    return chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  if (msg.type === 'launch')
    chrome.runtime.sendMessage(
      {
        type: 'launch',
        url: msg.url,
        packet: msg.packet,
        matchId: msg.matchId,
        tailoredId: msg.tailoredId,
        auto: msg.auto,
      },
      (res) => {
        void chrome.runtime.lastError;
        toPage({ type: 'launched', matchId: msg.matchId, ok: !!(res && res.ok), error: res && res.error });
      },
    );
});

chrome.runtime.onMessage.addListener((msg) => {
  if (
    msg &&
    (msg.type === 'filled' ||
      msg.type === 'applied' ||
      msg.type === 'questions' ||
      msg.type === 'autopilot' ||
      msg.type === 'learn')
  )
    toPage(msg);
});

toPage({ type: 'pong', version: VERSION });
