// RADAR service worker: only an offline page. Every request goes to the network as usual (jobs must be live);
// when a page cannot load at all, the installed app shows a small offline screen instead of the browser's error.
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('radar-offline-v1').then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
