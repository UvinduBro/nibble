// Nibble web app service worker (scope /app). Pages always come from the network so updates show
// up right away; if the phone is offline we show a friendly page instead of the browser's error.
const CACHE = 'nibble-shell-v1';
const SHELL = ['/offline.html', '/icons/app-192.png', '/logo.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return; // only page loads; everything else goes straight to the network
  e.respondWith(fetch(r).catch(() => caches.match('/offline.html')));
});
