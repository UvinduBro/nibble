// Nibble web app service worker (scope /app). Pages always come from the network so updates show
// up right away; if the phone is offline we show a friendly page instead of the browser's error.
const CACHE = 'nibble-shell-v2';
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

// ---------- push notifications (new messages, group chat, mentions) ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Nibble', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // the app is open and on screen: it already shows the message, so stay quiet
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.focused && w.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'Nibble', {
      body: d.body || '',
      icon: '/icons/app-192.png',
      badge: '/icons/badge-96.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || '/app' },
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/app', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).pathname.startsWith('/app'));
    if (w) { await w.focus(); if (w.navigate) return w.navigate(url); return; }
    return self.clients.openWindow(url);
  })());
});
