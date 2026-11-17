// Admin → Premium (admins only).
//   GET  → Stripe connection, set-up checks, the plan, and the current subscribers
//   POST { action: 'connect', secretKey }      save the key (encrypted), create the webhook + price
//   POST { action: 'price', amount, currency, interval, name }   new Stripe price (old one archived)
//   POST { action: 'grant', uid, days } | { action: 'revoke', uid } | { action: 'resync', uid }
//   POST { action: 'disconnect' }
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { getSecrets, forgetSecrets, getPlan, stripe, encrypt, canEncrypt, mask, refreshFromStripe, subUntil, SITE, STRIPE_VERSION, WEBHOOK_EVENTS } from '../../../../lib/billing';
import { serviceKey, fsGet, fsSet } from '../../../../lib/gcp';
import { CURRENCIES, INTERVALS } from '../../../../lib/premium';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
const UID = /^[A-Za-z0-9]{10,40}$/;

async function guard(req) {
  const token = bearer(req);
  if (!token) return { res: bad('Sign in as an admin.', 401) };
  try { const uid = await adminUid(token); return uid ? { uid } : { res: bad('Admins only.', 403) }; }
  catch { return { res: bad('Couldn’t check your admin access. Try again.', 502) }; }
}

async function checks() {
  const key = serviceKey();
  let canWrite = false, err = '';
  if (key) {
    try { await fsSet('billing/health', { at: Date.now() }); canWrite = true; }
    catch (e) { err = String(e.message || e).slice(0, 160); }
  }
  return { encryption: canEncrypt(), serviceAccount: key ? { email: key.client_email, env: key.env, canWrite, err } : null };
}

// product + price for the plan; archives the previous price
async function makePrice(plan, { amount, currency, interval, name }) {
  let productId = plan.productId;
  if (productId) { try { await stripe('POST', '/products/' + productId, { name, active: 'true' }); } catch { productId = ''; } }
  if (!productId) productId = (await stripe('POST', '/products', { name, metadata: { app: 'nibble' } })).id;
  const price = await stripe('POST', '/prices', { product: productId, unit_amount: amount, currency, recurring: { interval }, nickname: `${name} (${interval}ly)`, metadata: { app: 'nibble' } });
  await stripe('POST', '/products/' + productId, { default_price: price.id }).catch(() => {});
  if (plan.priceId && plan.priceId !== price.id) await stripe('POST', '/prices/' + plan.priceId, { active: 'false' }).catch(() => {});
  await fsSet('config/premium', { amount, currency, interval, name, priceId: price.id, productId, updatedAt: Date.now() }, { merge: true });
  return price.id;
}

export async function GET(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  const [sec, plan, chk] = await Promise.all([getSecrets(), getPlan(), checks()]);
  const out = { stripe: { connected: !!sec.secretKey, mode: sec.secretKey.includes('_live_') ? 'live' : sec.secretKey ? 'test' : '', account: sec.account, key: mask(sec.secretKey), webhook: !!sec.webhookSecret, fromEnv: sec.fromEnv }, checks: chk, plan, subscribers: [], stats: null, webhookUrl: SITE + '/api/stripe/webhook' };
  if (sec.secretKey) {
    try {
      const list = await stripe('GET', '/subscriptions', { status: 'all', limit: 100, expand: ['data.customer'] });
      const subs = (list.data || []).filter((s) => s.metadata && s.metadata.uid);
      out.subscribers = subs.map((s) => ({
        id: s.id, uid: s.metadata.uid, email: (s.customer && s.customer.email) || '', status: s.status, until: subUntil(s),
        cancelAtEnd: !!s.cancel_at_period_end, amount: (s.items && s.items.data[0] && s.items.data[0].price && s.items.data[0].price.unit_amount) || 0,
        currency: (s.items && s.items.data[0] && s.items.data[0].price && s.items.data[0].price.currency) || '', interval: (s.items && s.items.data[0] && s.items.data[0].price && s.items.data[0].price.recurring && s.items.data[0].price.recurring.interval) || '',
        created: (s.created || 0) * 1000,
      }));
      const live = out.subscribers.filter((s) => ['active', 'trialing', 'past_due'].includes(s.status));
      const yearly = live.reduce((t, s) => t + (s.interval === 'month' ? s.amount * 12 : s.amount), 0);
      out.stats = { active: live.length, cancelling: live.filter((s) => s.cancelAtEnd).length, pastDue: live.filter((s) => s.status === 'past_due').length, yearly, currency: (live[0] && live[0].currency) || plan.currency, more: !!list.has_more };
    } catch (e) { out.stripe.error = String(e.message || e).slice(0, 200); }
  }
  return Response.json(out, { headers: h });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  let b;
  try { b = await req.json(); } catch { return bad('Bad request.'); }

  try {
    if (b.action === 'connect') {
      const sk = String(b.secretKey || '').trim();
      if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{20,}$/.test(sk)) return bad('Paste a Stripe secret key (sk_live_… or sk_test_…) or a restricted key (rk_…).');
      if (!canEncrypt()) return bad('BILLING_KEY isn’t set on the server, so keys can’t be saved safely.', 503);
      const acct = await stripe('GET', '/account', null, { key: sk }).catch((e) => { throw Object.assign(new Error('Stripe didn’t accept that key: ' + e.message), { friendly: true }); });
      const account = String((acct.settings && acct.settings.dashboard && acct.settings.dashboard.display_name) || acct.business_profile && acct.business_profile.name || acct.email || acct.id || '').slice(0, 80);
      // a fresh webhook for this key's account (the old one, if any, is removed)
      const prev = await fsGet('billing/secrets').catch(() => null);
      if (prev && prev.webhookId) await stripe('DELETE', '/webhook_endpoints/' + prev.webhookId, null, { key: sk }).catch(() => {});
      const wh = await stripe('POST', '/webhook_endpoints', { url: SITE + '/api/stripe/webhook', enabled_events: WEBHOOK_EVENTS, api_version: STRIPE_VERSION, description: 'Nibble Premium' }, { key: sk });
      await fsSet('billing/secrets', { sk: encrypt(sk), whsec: encrypt(wh.secret), webhookId: wh.id, account, mode: sk.includes('_live_') ? 'live' : 'test', updatedAt: Date.now(), by: g.uid });
      forgetSecrets();
      const plan = await getPlan();
      const priceId = await makePrice({ ...plan, priceId: '', productId: '' }, plan);
      return Response.json({ ok: true, account, priceId }, { headers: h });
    }
    if (b.action === 'price') {
      const amount = Math.round(Number(b.amount));
      const currency = String(b.currency || '').toLowerCase(), interval = String(b.interval || '');
      const name = String(b.name || 'Nibble Premium').replace(/[\r\n]+/g, ' ').trim().slice(0, 40) || 'Nibble Premium';
      if (!Number.isInteger(amount) || amount < 50 || amount > 10_000_000) return bad('Pick a price of at least 0.50.');
      if (!CURRENCIES.includes(currency) || !INTERVALS.includes(interval)) return bad('Pick a currency and a billing period.');
      const priceId = await makePrice(await getPlan(), { amount, currency, interval, name });
      return Response.json({ ok: true, priceId }, { headers: h });
    }
    if (b.action === 'grant' || b.action === 'revoke') {
      const uid = String(b.uid || '');
      if (!UID.test(uid)) return bad('Unknown user.');
      const days = Math.max(1, Math.min(3650, Math.round(Number(b.days) || 365)));
      const prev = await fsGet('premium/' + uid).catch(() => null);
      const doc = b.action === 'grant'
        ? { active: true, until: Math.max(Date.now(), (prev && prev.active && prev.until) || 0) + days * 86400_000, since: (prev && prev.since) || Date.now(), status: 'granted', source: 'admin', cancelAtEnd: false, updatedAt: Date.now() }
        : { active: false, until: Date.now(), since: (prev && prev.since) || Date.now(), status: 'revoked', source: 'admin', cancelAtEnd: false, updatedAt: Date.now() };
      await fsSet('premium/' + uid, doc);
      return Response.json({ ok: true, premium: doc }, { headers: h });
    }
    if (b.action === 'resync') {
      const uid = String(b.uid || '');
      if (!UID.test(uid)) return bad('Unknown user.');
      return Response.json({ ok: true, premium: await refreshFromStripe(uid) }, { headers: h });
    }
    if (b.action === 'disconnect') {
      const sec = await getSecrets();
      if (sec.webhookId) await stripe('DELETE', '/webhook_endpoints/' + sec.webhookId).catch(() => {});
      await fsSet('billing/secrets', { sk: '', whsec: '', webhookId: '', account: '', mode: '', updatedAt: Date.now(), by: g.uid });
      await fsSet('config/premium', { enabled: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      forgetSecrets();
      return Response.json({ ok: true }, { headers: h });
    }
    return bad('Unknown action.');
  } catch (e) {
    console.error('admin premium failed:', b.action, e && e.message);
    return bad(e && e.friendly ? e.message : 'That didn’t work: ' + String((e && e.message) || 'error').slice(0, 180), 502);
  }
}
