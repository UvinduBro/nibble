'use client';
// Installing the web app (PWA): catch the browser's install prompt early, register the small
// service worker, and tell whether we're already running as an installed app.
let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('nibble-installed', '1'); } catch {} subs.forEach((f) => f()); });
}
export const onInstallChange = (f) => { subs.add(f); return () => subs.delete(f); };
export const canPrompt = () => !!deferred;
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred; deferred = null; subs.forEach((f) => f());
  e.prompt();
  try { const r = await e.userChoice; return r && r.outcome; } catch { return 'dismissed'; }
}
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function registerSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // only the /app pages: the desktop Hub (/hub) and the phone app (/m) must never be cached
  navigator.serviceWorker.register('/sw.js', { scope: '/app' }).catch(() => {});
}
