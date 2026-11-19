// Admin → Premium (admins only). Stripe keys come from Vercel env (STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET); nothing here stores or shows a key.
//   GET  → health checks, the plan, subscribers + stats, promotion codes
//   POST { action: 'package', pkg }            create / update a package (new Stripe price if the money changed)
//   POST { action: 'archivePackage', id }      stop selling a package (subscribers keep it)
//   POST { action: 'promo', code, percentOff | amountOff, currency, duration, months, maxRedemptions, expiresAt }
//   POST { action: 'promoActive', id, active }
//   POST { action: 'cancel', subId, now } | { action: 'resume', subId }
//   POST { action: 'grant', uid, days } | { action: 'revoke', uid } | { action: 'resync', uid }
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { getSecrets, getPlan, stripe, mask, refreshFromStripe, syncSubscription, subUntil, WEBHOOK_URL, WEBHOOK_EVENTS } from '../../../../lib/billing';
import { serviceKey, fsGet, fsSet } from '../../../../lib/gcp';
import { CURRENCIES, INTERVALS, MAX_PACKAGES, cleanPackage } from '../../../../lib/premium';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
const UID = /^[A-Za-z0-9]{10,40}$/;
const SUB = /^sub_\w+$/;

async function guard(req) {
  const token = bearer(req);
  if (!token) return { res: bad('Sign in as an admin.', 401) };
  try { const uid = await adminUid(token); return uid ? { uid } : { res: bad('Admins only.', 403) }; }
  catch { return { res: bad('Couldn’t check your admin access. Try again.', 502) }; }
}

// what's set up and what isn't (shown as a checklist)
async function health(sec) {
  const out = {
    key: sec.secretKey ? { ok: true, mode: sec.mode, masked: mask(sec.secretKey) } : { ok: false, bad: sec.badKey },
    webhookSecret: { ok: !!sec.webhookSecret, bad: sec.badWebhook },
    account: '', webhook: null, portal: null, serviceAccount: null,
  };
  const key = serviceKey();
  if (key) {
    try { await fsSet('billing/health', { at: Date.now() }); out.serviceAccount = { ok: true, email: key.client_email }; }
    catch (e) { out.serviceAccount = { ok: false, email: key.client_email, err: String(e.message || e).slice(0, 120) }; }
  }
  if (!sec.secretKey) return out;
  const [acct, hooks, portal] = await Promise.all([
    stripe('GET', '/account').catch((e) => ({ error: e.message })),
    stripe('GET', '/webhook_endpoints', { limit: 50 }).catch(() => null),
    stripe('GET', '/billing_portal/configurations', { limit: 3, is_default: 'true' }).catch(() => null),
  ]);
  if (acct.error) out.key = { ok: false, mode: sec.mode, masked: mask(sec.secretKey), err: acct.error };
  else out.account = String((acct.settings && acct.settings.dashboard && acct.settings.dashboard.display_name) || (acct.business_profile && acct.business_profile.name) || acct.email || acct.id || '').slice(0, 80);
  if (hooks && hooks.data) {
    const ep = hooks.data.find((w) => w.url === WEBHOOK_URL);
    const events = ep ? ep.enabled_events || [] : [];
    const missing = ep && !events.includes('*') ? WEBHOOK_EVENTS.filter((e) => !events.includes(e)) : [];
    out.webhook = { found: !!ep, enabled: !!ep && ep.status === 'enabled', missing, id: ep ? ep.id : '' };
  }
  if (portal) out.portal = { ok: !!(portal.data && portal.data.length) };
  return out;
}

async function savePlanPart(patch) { await fsSet('config/premium', { ...patch, updatedAt: Date.now() }, { merge: true }); }

export async function GET(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  const sec = getSecrets();
  const [plan, chk] = await Promise.all([getPlan(), health(sec)]);
  const out = { health: chk, plan, webhookUrl: WEBHOOK_URL, webhookEvents: WEBHOOK_EVENTS, subscribers: [], stats: null, promos: [] };
  if (sec.secretKey && chk.key.ok) {
    try {
      const [list, promos] = await Promise.all([
        stripe('GET', '/subscriptions', { status: 'all', limit: 100, expand: ['data.customer'] }),
        stripe('GET', '/promotion_codes', { limit: 50, expand: ['data.coupon'] }).catch(() => ({ data: [] })),
      ]);
      const item = (s) => (s.items && s.items.data[0]) || {};
      out.subscribers = (list.data || []).filter((s) => s.metadata && s.metadata.uid).map((s) => ({
        id: s.id, uid: s.metadata.uid, pkg: s.metadata.package || '', email: (s.customer && s.customer.email) || '', status: s.status, until: subUntil(s),
        cancelAtEnd: !!s.cancel_at_period_end, trialEnd: (s.trial_end || 0) * 1000,
        amount: (item(s).price && item(s).price.unit_amount) || 0, currency: (item(s).price && item(s).price.currency) || '',
        interval: (item(s).price && item(s).price.recurring && item(s).price.recurring.interval) || '', created: (s.created || 0) * 1000,
      }));
      const live = out.subscribers.filter((s) => ['active', 'trialing', 'past_due'].includes(s.status));
      const yearly = live.filter((s) => s.status !== 'trialing').reduce((t, s) => t + (s.interval === 'month' ? s.amount * 12 : s.interval === 'week' ? s.amount * 52 : s.amount), 0);
      out.stats = { active: live.length, trialing: live.filter((s) => s.status === 'trialing').length, cancelling: live.filter((s) => s.cancelAtEnd).length, pastDue: live.filter((s) => s.status === 'past_due').length, yearly, currency: (live[0] && live[0].currency) || 'usd', more: !!list.has_more };
      out.promos = (promos.data || []).map((p) => ({
        id: p.id, code: p.code, active: p.active, used: p.times_redeemed || 0, max: p.max_redemptions || 0, expires: (p.expires_at || 0) * 1000,
        off: p.coupon ? (p.coupon.percent_off ? `${p.coupon.percent_off}% off` : `${(p.coupon.amount_off || 0) / 100} ${String(p.coupon.currency || '').toUpperCase()} off`) : '',
        duration: p.coupon ? (p.coupon.duration === 'repeating' ? `for ${p.coupon.duration_in_months} months` : p.coupon.duration === 'forever' ? 'forever' : 'first payment') : '',
      }));
    } catch (e) { out.error = String(e.message || e).slice(0, 200); }
  }
  return Response.json(out, { headers: h });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  let b;
  try { b = await req.json(); } catch { return bad('Bad request.'); }
  const sec = getSecrets();
  const needStripe = !['grant', 'revoke'].includes(b.action);
  if (needStripe && !sec.secretKey) return bad('Add STRIPE_SECRET_KEY in Vercel first (see the set-up guide).', 503);

  try {
    if (b.action === 'package') {
      const plan = await getPlan();
      const raw = b.pkg || {};
      const amount = Math.round(Number(raw.amount));
      if (!Number.isInteger(amount) || amount < 50 || amount > 10_000_000) return bad('Pick a price of at least 0.50.');
      if (!CURRENCIES.includes(raw.currency) || !INTERVALS.includes(raw.interval)) return bad('Pick a currency and a billing period.');
      const pkg = cleanPackage({ ...raw, amount, priceId: '' });
      if (!pkg.id) return bad('Give the package a short ID (letters and numbers).');
      const list = plan.packages.slice();
      const i = list.findIndex((k) => k.id === pkg.id);
      if (i < 0 && list.length >= MAX_PACKAGES) return bad(`Up to ${MAX_PACKAGES} packages.`);
      const prev = i >= 0 ? list[i] : null;
      // one Stripe product for Premium; a new price only when the money, currency or period changed
      let productId = plan.productId;
      if (productId) { try { await stripe('POST', '/products/' + productId, { name: plan.name, active: 'true' }); } catch { productId = ''; } }
      if (!productId) productId = (await stripe('POST', '/products', { name: plan.name, metadata: { app: 'nibble' } })).id;
      let priceId = prev && prev.priceId && prev.amount === pkg.amount && prev.currency === pkg.currency && prev.interval === pkg.interval ? prev.priceId : '';
      if (!priceId) {
        priceId = (await stripe('POST', '/prices', { product: productId, unit_amount: pkg.amount, currency: pkg.currency, recurring: { interval: pkg.interval }, nickname: `${plan.name} · ${pkg.name}`, metadata: { app: 'nibble', package: pkg.id } })).id;
        if (prev && prev.priceId && prev.priceId !== priceId) await stripe('POST', '/prices/' + prev.priceId, { active: 'false' }).catch(() => {});
      }
      const saved = { ...pkg, priceId };
      if (i >= 0) list[i] = saved; else list.push(saved);
      await savePlanPart({ packages: list, productId, ...(list.length === 1 ? { defaultPackage: saved.id } : {}) });
      return Response.json({ ok: true, pkg: saved }, { headers: h });
    }
    if (b.action === 'archivePackage') {
      const plan = await getPlan();
      const k = plan.packages.find((x) => x.id === String(b.id || ''));
      if (!k) return bad('Unknown package.');
      if (k.priceId) await stripe('POST', '/prices/' + k.priceId, { active: 'false' }).catch(() => {});
      const list = plan.packages.filter((x) => x.id !== k.id);
      await savePlanPart({ packages: list, ...(plan.defaultPackage === k.id ? { defaultPackage: list[0] ? list[0].id : '' } : {}) });
      return Response.json({ ok: true }, { headers: h });
    }
    if (b.action === 'promo') {
      const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
      if (code.length < 3) return bad('Use a code of 3–20 letters or numbers.');
      const pct = Number(b.percentOff), amt = Math.round(Number(b.amountOff));
      const coupon = { name: code, duration: ['once', 'repeating', 'forever'].includes(b.duration) ? b.duration : 'once', metadata: { app: 'nibble' } };
      if (pct > 0 && pct <= 100) coupon.percent_off = pct;
      else if (amt >= 1 && CURRENCIES.includes(b.currency)) { coupon.amount_off = amt; coupon.currency = b.currency; }
      else return bad('Set a percentage (1–100) or an amount off.');
      if (coupon.duration === 'repeating') coupon.duration_in_months = Math.max(1, Math.min(36, Math.round(Number(b.months) || 1)));
      const c = await stripe('POST', '/coupons', coupon);
      const exp = b.expiresAt ? Math.floor(Date.parse(b.expiresAt) / 1000) : 0;
      const p = await stripe('POST', '/promotion_codes', { coupon: c.id, code, ...(Number(b.maxRedemptions) > 0 ? { max_redemptions: Math.round(Number(b.maxRedemptions)) } : {}), ...(exp > Date.now() / 1000 ? { expires_at: exp } : {}) });
      return Response.json({ ok: true, id: p.id }, { headers: h });
    }
    if (b.action === 'promoActive') {
      if (!/^promo_\w+$/.test(String(b.id || ''))) return bad('Unknown code.');
      await stripe('POST', '/promotion_codes/' + b.id, { active: b.active ? 'true' : 'false' });
      return Response.json({ ok: true }, { headers: h });
    }
    if (b.action === 'cancel' || b.action === 'resume') {
      const id = String(b.subId || '');
      if (!SUB.test(id)) return bad('Unknown subscription.');
      const sub = b.action === 'cancel' && b.now
        ? await stripe('DELETE', '/subscriptions/' + id)
        : await stripe('POST', '/subscriptions/' + id, { cancel_at_period_end: b.action === 'cancel' ? 'true' : 'false' });
      await syncSubscription(sub).catch(() => {});
      return Response.json({ ok: true }, { headers: h });
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
    return bad('Unknown action.');
  } catch (e) {
    console.error('admin premium failed:', b.action, e && e.message);
    return bad('Stripe said: ' + String((e && e.message) || 'error').slice(0, 180), 502);
  }
}
