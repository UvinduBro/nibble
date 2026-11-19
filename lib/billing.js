// Nibble Premium: Stripe subscriptions. Server only.
//
// Where things live
//   Stripe keys          ONLY in Vercel environment variables (never in the database or the admin page):
//                        STRIPE_SECRET_KEY (sk_live_… / sk_test_… or a restricted rk_… key) and
//                        STRIPE_WEBHOOK_SECRET (whsec_…, from the webhook endpoint in the Stripe dashboard)
//   config/premium       public plan: on/off, packages (each with its Stripe price id), features
//   premium/{uid}        { active, until (ms), since, status, source } — who has Premium. Written only
//                        by this server (Stripe webhook / status sync) and by admins; friends can read it
//   billingCustomers/{uid}  { customer } the Stripe customer for a Nibble account (server only)
//
// Firestore writes use the service account in FIREBASE_ADMIN_KEY or GCP_USAGE_KEY
// ("Cloud Datastore User" role). See docs/STRIPE_SETUP.md.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fsGet, fsSet, fromValue } from './gcp';
import { firebaseConfig } from './social/config';
import { DEFAULT_PLAN, cleanPlan } from './premium';

export const SITE = 'https://meetnibble.com';
export const WEBHOOK_URL = SITE + '/api/stripe/webhook';
export const STRIPE_VERSION = '2024-06-20'; // pinned: classic subscription fields (current_period_end)
export const WEBHOOK_EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'];

export const mask = (k) => (k ? k.slice(0, 8) + '…' + k.slice(-4) : '');

// ---------- Stripe keys (environment only) ----------
export function getSecrets() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  return {
    secretKey: /^(sk|rk)_(test|live)_\w+$/.test(secretKey) ? secretKey : '',
    webhookSecret: /^whsec_\w+$/.test(webhookSecret) ? webhookSecret : '',
    badKey: !!secretKey && !/^(sk|rk)_(test|live)_\w+$/.test(secretKey),
    badWebhook: !!webhookSecret && !/^whsec_\w+$/.test(webhookSecret),
    mode: secretKey.includes('_live_') ? 'live' : secretKey ? 'test' : '',
  };
}

// ---------- the public plan ----------
export async function getPlan() {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/premium?key=${firebaseConfig.apiKey}`, { cache: 'no-store' });
    if (r.status === 404) return cleanPlan(DEFAULT_PLAN);
    if (!r.ok) throw new Error('plan ' + r.status);
    return cleanPlan(fromValue({ mapValue: { fields: (await r.json()).fields || {} } }));
  } catch {
    return cleanPlan(DEFAULT_PLAN);
  }
}

// ---------- Stripe API (form-encoded, no SDK) ----------
function form(obj, pre = '', out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === 'object' ? form(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === 'object') form(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}
export async function stripe(method, path, params, { key, idempotency } = {}) {
  const sk = key || getSecrets().secretKey;
  if (!sk) throw Object.assign(new Error('Stripe isn’t connected yet.'), { code: 'not_connected' });
  const qs = method === 'GET' && params ? '?' + form(params).join('&') : '';
  const r = await fetch('https://api.stripe.com/v1' + path + qs, {
    method,
    headers: {
      authorization: 'Bearer ' + sk, 'stripe-version': STRIPE_VERSION,
      ...(method !== 'GET' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotency ? { 'idempotency-key': idempotency } : {}),
    },
    ...(method !== 'GET' && params ? { body: form(params).join('&') } : {}),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || 'Stripe error ' + r.status), { status: r.status, stripe: j.error });
  return j;
}

// ---------- webhook signature (Stripe-Signature: t=…,v1=…) ----------
export function verifyStripeSignature(raw, header, secret, toleranceSec = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header).split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`, 'utf8').digest();
  return sigs.some((s) => { try { const b = Buffer.from(s, 'hex'); return b.length === expected.length && timingSafeEqual(b, expected); } catch { return false; } });
}

// ---------- Premium status ----------
const ACTIVE = ['active', 'trialing', 'past_due']; // past_due keeps Premium until the period ends (Stripe retries)
export function subUntil(sub) {
  const end = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || 0;
  return end * 1000;
}

// write premium/{uid} from a Stripe subscription
export async function syncSubscription(sub) {
  const uid = sub && sub.metadata && sub.metadata.uid;
  if (!uid || !/^[A-Za-z0-9]{10,40}$/.test(uid)) return null;
  const until = subUntil(sub);
  const active = ACTIVE.includes(sub.status) && until > Date.now();
  const prev = await fsGet('premium/' + uid).catch(() => null);
  // an admin gift that lasts longer than the subscription is never cut short by it
  const gift = prev && prev.source === 'admin' && prev.active && prev.until > Date.now() ? prev.until : 0;
  if (gift > until) return prev;
  const doc = { active, until, since: (prev && prev.since) || Date.now(), status: String(sub.status || ''), source: 'stripe', cancelAtEnd: !!sub.cancel_at_period_end, updatedAt: Date.now() };
  await fsSet('premium/' + uid, doc);
  if (sub.customer) await fsSet('billingCustomers/' + uid, { customer: String(sub.customer), sub: String(sub.id), updatedAt: Date.now() }).catch(() => {});
  return doc;
}

// the Stripe customer for a Nibble account (saved mapping, else search by metadata)
export async function findCustomer(uid) {
  const m = await fsGet('billingCustomers/' + uid).catch(() => null);
  if (m && m.customer) return m.customer;
  try {
    const s = await stripe('GET', '/customers/search', { query: `metadata['uid']:'${uid}'`, limit: 1 });
    if (s.data && s.data[0]) { await fsSet('billingCustomers/' + uid, { customer: s.data[0].id, updatedAt: Date.now() }).catch(() => {}); return s.data[0].id; }
  } catch {}
  return '';
}

// re-read a person's subscriptions from Stripe (after checkout, or if a webhook was missed)
export async function refreshFromStripe(uid) {
  const customer = await findCustomer(uid);
  if (!customer) return fsGet('premium/' + uid).catch(() => null);
  const list = await stripe('GET', '/subscriptions', { customer, status: 'all', limit: 10 });
  const subs = (list.data || []).filter((s) => s.metadata && s.metadata.uid === uid);
  const best = subs.sort((a, b) => (ACTIVE.includes(b.status) - ACTIVE.includes(a.status)) || subUntil(b) - subUntil(a))[0];
  if (best) return syncSubscription(best);
  return fsGet('premium/' + uid).catch(() => null);
}

// a signed-in caller → { uid, email } (Firebase verifies the token)
export async function accountOf(token) {
  if (!token || token.length > 4096) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }), cache: 'no-store',
  });
  if (!r.ok) return null;
  const u = ((await r.json().catch(() => ({}))).users || [])[0];
  if (!u || !u.localId || u.disabled) return null;
  return { uid: u.localId, email: u.emailVerified ? String(u.email || '') : '', name: String(u.displayName || '') };
}
