// RADAR · Auto-Fill — runs on the RADAR site only.
// The RADAR page and the extension talk through window.postMessage; this script relays both ways.
// It reads nothing from the page except messages addressed to it ({ radar: 'app' }).

const VERSION = chrome.runtime.getManifest().version;
const toPage = (message) => window.postMessage({ radar: 'ext', ...message }, location.origin);

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (event.source !== window || !msg || msg.radar !== 'app') return;
  if (msg.type === 'ping') return toPage({ type: 'pong', version: VERSION });
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
  // AUTOPILOT's controls: plain relays to the worker.
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
  if (msg && (msg.type === 'filled' || msg.type === 'applied' || msg.type === 'questions' || msg.type === 'autopilot'))
    toPage(msg);
});

toPage({ type: 'pong', version: VERSION });
