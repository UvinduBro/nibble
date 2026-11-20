// Nibble Premium: Stripe subscriptions. Server only.
//
// Where things live
//   Stripe keys          ONLY in Vercel environment variables (never in the database or the admin page):
//                        STRIPE_SECRET_KEY (a restricted rk_… key is best; sk_… works) and
//                        STRIPE_WEBHOOK_SECRET (whsec_…; two comma-separated secrets while rotating)
//   config/premium       public plan: on/off, packages (each with its Stripe price id), features
//   premium/{uid}        { active, until (ms), since, status, source, action } — who has Premium. Written only
//                        by this server (Stripe webhook / status sync) and by admins; friends can read it
//   billingCustomers/{uid}  { customer, sub, openSession, openPkg, openExp, recent } (server only)
//   billingEvents/{evt}  webhook events we've handled (dedupe + audit, kept 90 days, server only)
//   billingFlags/{uid}   disputes / early fraud warnings / refunds for an account (server only)
//
// Uses Stripe's official SDK (pinned version in package.json → pinned API version). Firestore writes use the
// service account in FIREBASE_ADMIN_KEY or GCP_USAGE_KEY ("Cloud Datastore User" role). See docs/STRIPE_SETUP.md.
import Stripe from 'stripe';
import { fsGet, fsSet, fromValue } from './gcp';
import { firebaseConfig } from './social/config';
import { DEFAULT_PLAN, cleanPlan } from './premium';

export const SITE = 'https://meetnibble.com';
export const WEBHOOK_URL = SITE + '/api/stripe/webhook';
// the API version this SDK release is built for; the webhook endpoint in Stripe should use the same one
export const STRIPE_VERSION = Stripe.API_VERSION;
export const WEBHOOK_EVENTS = [
  'checkout.session.completed', 'checkout.session.expired',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.trial_will_end',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
  'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'radar.early_fraud_warning.created',
];

export const mask = (k) => (k ? k.slice(0, 8) + '…' + k.slice(-4) : '');
const KEY_RE = /^(sk|rk)_(test|live)_\w+$/;
const HOOK_RE = /^whsec_\w+$/;

// ---------- Stripe keys (environment only) ----------
export function getSecrets() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  // two secrets (comma-separated) while rotating the webhook signing secret: new one first, old one after
  const hooks = (process.env.STRIPE_WEBHOOK_SECRET || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    secretKey: KEY_RE.test(secretKey) ? secretKey : '',
    webhookSecrets: hooks.filter((s) => HOOK_RE.test(s)),
    webhookSecret: hooks.find((s) => HOOK_RE.test(s)) || '',
    badKey: !!secretKey && !KEY_RE.test(secretKey),
    badWebhook: hooks.some((s) => !HOOK_RE.test(s)),
    restricted: secretKey.startsWith('rk_'),
    mode: secretKey.includes('_live_') ? 'live' : secretKey ? 'test' : '',
  };
}

let client = null, clientKey = '';
export function getStripe() {
  const sk = getSecrets().secretKey;
  if (!sk) throw Object.assign(new Error('Stripe isn’t connected yet.'), { code: 'not_connected' });
  if (!client || clientKey !== sk) {
    client = new Stripe(sk, {
      apiVersion: STRIPE_VERSION,
      maxNetworkRetries: 2, // the SDK adds an idempotency key to every retried write
      timeout: 20_000,
      appInfo: { name: 'Nibble', url: SITE },
    });
    clientKey = sk;
  }
  return client;
}

// Generic call for the admin page (keeps its many small calls short). Typed SDK methods are used
// for checkout, the portal, the webhook and subscriptions.
// Stripe's form encoding for query strings (rawRequest only takes params on POST)
function query(obj, pre = '', out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === 'object' ? query(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === 'object') query(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}
export async function stripe(method, path, params, { idempotency } = {}) {
  const post = String(method).toUpperCase() === 'POST';
  const qs = !post && params ? query(params).join('&') : '';
  try {
    return await getStripe().rawRequest(method, '/v1' + path + (qs ? '?' + qs : ''), post ? params || {} : undefined, idempotency ? { idempotencyKey: idempotency } : undefined);
  } catch (e) {
    if (e && e.code === 'not_connected') throw e;
    throw Object.assign(new Error((e && e.message) || 'Stripe error'), { status: e && e.statusCode, stripe: e && e.raw });
  }
}

// ---------- the public plan ----------
// `revalidate` (seconds) lets public pages cache it; server routes always read it fresh
export async function getPlan({ revalidate } = {}) {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/premium?key=${firebaseConfig.apiKey}`,
      revalidate ? { next: { revalidate } } : { cache: 'no-store' });
    if (r.status === 404) return cleanPlan(DEFAULT_PLAN);
    if (!r.ok) throw new Error('plan ' + r.status);
    return cleanPlan(fromValue({ mapValue: { fields: (await r.json()).fields || {} } }));
  } catch {
    return cleanPlan(DEFAULT_PLAN);
  }
}

// ---------- webhook signature ----------
// → the verified event, or null. Tries each configured secret (rotation), 5-minute tolerance.
export function verifyEvent(raw, header) {
  const { webhookSecrets } = getSecrets();
  if (!header || !webhookSecrets.length) return null;
  // constructEvent only needs the webhooks helper, which works without an API key
  const wh = (client || new Stripe('sk_test_unused', { apiVersion: STRIPE_VERSION })).webhooks;
  for (const secret of webhookSecrets) {
    try { return wh.constructEvent(raw, header, secret, 300); } catch {}
  }
  return null;
}

// ---------- Premium status ----------
export const ACTIVE = ['active', 'trialing', 'past_due']; // past_due keeps Premium until the period ends (Stripe retries)
export function subUntil(sub) {
  const items = (sub && sub.items && sub.items.data) || [];
  const end = sub.current_period_end || Math.max(0, ...items.map((i) => i.current_period_end || 0));
  return end * 1000;
}
export const UID_RE = /^[A-Za-z0-9]{10,40}$/;
export const subUid = (sub) => {
  const u = sub && sub.metadata && sub.metadata.uid;
  return u && UID_RE.test(u) ? u : '';
};

// write premium/{uid} from a Stripe subscription
export async function syncSubscription(sub, extra = {}) {
  const uid = subUid(sub);
  if (!uid) return null;
  const until = subUntil(sub);
  const active = ACTIVE.includes(sub.status) && until > Date.now() && !extra.revoke;
  const prev = await fsGet('premium/' + uid).catch(() => null);
  // an admin gift that lasts longer than the subscription is never cut short by it
  const gift = prev && prev.source === 'admin' && prev.active && prev.until > Date.now() ? prev.until : 0;
  if (gift > until && !extra.revoke) return prev;
  const doc = {
    active, until: active ? until : Math.min(until, Date.now()), since: (prev && prev.since) || Date.now(),
    status: String(extra.status || sub.status || ''), source: 'stripe', cancelAtEnd: !!sub.cancel_at_period_end,
    // "confirm your payment" (3-D Secure on a renewal) stays until the subscription is fine again
    action: extra.action !== undefined ? extra.action : (sub.status === 'active' || sub.status === 'trialing' ? '' : (prev && prev.action) || ''),
    updatedAt: Date.now(),
  };
  await fsSet('premium/' + uid, doc);
  if (sub.customer) await fsSet('billingCustomers/' + uid, { customer: String(sub.customer.id || sub.customer), sub: String(sub.id), updatedAt: Date.now() }, { merge: true }).catch(() => {});
  return doc;
}

// the Stripe customer for a Nibble account (saved mapping, else search by metadata)
export async function findCustomer(uid) {
  const m = await fsGet('billingCustomers/' + uid).catch(() => null);
  if (m && m.customer) return m.customer;
  try {
    const s = await getStripe().customers.search({ query: `metadata['uid']:'${uid}'`, limit: 1 });
    if (s.data && s.data[0]) { await fsSet('billingCustomers/' + uid, { customer: s.data[0].id, updatedAt: Date.now() }, { merge: true }).catch(() => {}); return s.data[0].id; }
  } catch {}
  return '';
}

// the Nibble account behind a Stripe customer (customer metadata, set when we create it)
export async function uidOfCustomer(customer) {
  if (!customer) return '';
  const c = typeof customer === 'object' ? customer : await getStripe().customers.retrieve(String(customer)).catch(() => null);
  const uid = c && !c.deleted && c.metadata ? (c.metadata.uid || c.metadata.nb_uid || '') : '';
  return UID_RE.test(uid) ? uid : '';
}

// re-read a person's subscriptions from Stripe (after checkout, or if a webhook was missed)
export async function refreshFromStripe(uid) {
  const customer = await findCustomer(uid);
  if (!customer) return fsGet('premium/' + uid).catch(() => null);
  const list = await getStripe().subscriptions.list({ customer, status: 'all', limit: 10 });
  const subs = (list.data || []).filter((s) => subUid(s) === uid);
  const best = subs.sort((a, b) => (ACTIVE.includes(b.status) - ACTIVE.includes(a.status)) || subUntil(b) - subUntil(a))[0];
  if (best) return syncSubscription(best);
  return fsGet('premium/' + uid).catch(() => null);
}

// a signed-in caller → { uid, email, emailVerified, name, createdAt, provider } (Firebase verifies the token)
export async function accountOf(token) {
  if (!token || token.length > 4096) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }), cache: 'no-store',
  });
  if (!r.ok) return null;
  const u = ((await r.json().catch(() => ({}))).users || [])[0];
  if (!u || !u.localId || u.disabled) return null;
  const providers = (u.providerUserInfo || []).map((p) => p.providerId).filter(Boolean);
  return {
    uid: u.localId,
    email: u.emailVerified ? String(u.email || '') : '',
    rawEmail: String(u.email || ''),
    emailVerified: !!u.emailVerified,
    name: String(u.displayName || ''),
    createdAt: Number(u.createdAt) || 0,
    provider: providers.includes('google.com') ? 'google.com' : providers[0] || 'password',
  };
}
