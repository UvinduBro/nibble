// Web push notifications for the web app (/app, mostly when it's added to a phone's home screen).
// Subscriptions live in pushSubs/{uid} (server only: no rule = no browser access), up to 5 devices.
// The VAPID key pair is derived from a secret the server already has (NET_SALT → service-account
// key), so there is no extra environment variable to set and the public key never changes.
import { createECDH, createHash, createHmac } from 'node:crypto';
import * as webpush from 'web-push';
import { fsGet, fsSet, serviceKey } from './gcp';

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let keys = null;
export function vapidKeys() {
  if (keys) return keys;
  let seed = (process.env.PUSH_SALT || process.env.NET_SALT || '').trim();
  if (!seed) { const k = serviceKey(); seed = k ? createHash('sha256').update('nibble-push:' + k.private_key).digest('hex') : ''; }
  if (!seed) return null;
  const priv = createHmac('sha256', seed).update('nibble-vapid-v1').digest();
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(priv);
  keys = { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv) };
  webpush.setVapidDetails('mailto:hello@meetnibble.com', keys.publicKey, keys.privateKey);
  return keys;
}

// only real browser push services (never let a subscription point the server at anything else)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/];
export function cleanSub(s) {
  if (!s || typeof s !== 'object') return null;
  const endpoint = String(s.endpoint || '');
  let u; try { u = new URL(endpoint); } catch { return null; }
  if (u.protocol !== 'https:' || endpoint.length > 800 || !PUSH_HOSTS.some((r) => r.test(u.hostname))) return null;
  const k = s.keys || {};
  const p256dh = String(k.p256dh || ''), auth = String(k.auth || '');
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,40}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export async function getSubs(uid) {
  const d = await fsGet('pushSubs/' + uid).catch(() => null);
  return (d && Array.isArray(d.subs)) ? d.subs : [];
}
export async function addSub(uid, sub, ua) {
  const list = (await getSubs(uid)).filter((x) => x.endpoint !== sub.endpoint);
  list.unshift({ ...sub, ua: String(ua || '').slice(0, 120), at: Date.now() });
  await fsSet('pushSubs/' + uid, { subs: list.slice(0, 5), updatedAt: Date.now() });
}
export async function removeSub(uid, endpoint) {
  const list = await getSubs(uid);
  const next = list.filter((x) => x.endpoint !== endpoint);
  if (next.length !== list.length) await fsSet('pushSubs/' + uid, { subs: next, updatedAt: Date.now() });
}

// people without push are remembered for a few minutes so busy chats don't re-read their empty doc
const none = new Map();
// send one notification to each of these people (every device they turned it on for)
export async function pushTo(uids, payload) {
  if (!vapidKeys()) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(uids.map(async (uid) => {
    const until = none.get(uid);
    if (until && until > Date.now()) return;
    const subs = await getSubs(uid);
    if (!subs.length) { none.set(uid, Date.now() + 5 * 60_000); return; }
    none.delete(uid);
    const dead = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600, urgency: 'high', topic: String(payload.tag || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint); // unsubscribed / expired
      }
    }));
    if (dead.length) await fsSet('pushSubs/' + uid, { subs: subs.filter((s) => !dead.includes(s.endpoint)), updatedAt: Date.now() }).catch(() => {});
  }));
  return sent;
}
export const forgetNoPush = (uid) => none.delete(uid);
