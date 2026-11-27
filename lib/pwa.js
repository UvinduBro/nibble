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

// ---------- push notifications ----------
export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function reg() {
  registerSW();
  return navigator.serviceWorker.getRegistration('/app').then((r) => r || navigator.serviceWorker.ready);
}
// 'unsupported' | 'denied' | 'on' | 'off'
export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const r = await reg().catch(() => null);
  const sub = r && (await r.pushManager.getSubscription().catch(() => null));
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
export async function enablePush(social) {
  if (!pushSupported()) throw new Error(isIOS() ? 'On iPhone, add Nibble to your home screen first, then turn notifications on from there.' : 'This browser can’t show notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for meetnibble.com in your browser or phone settings.');
  const r = await reg();
  const key = await social.push.key();
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await social.push.subscribe(sub.toJSON());
  return 'on';
}
export async function disablePush(social) {
  const r = await reg().catch(() => null);
  const sub = r && (await r.pushManager.getSubscription().catch(() => null));
  if (sub) { await social.push.unsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  return 'off';
}
