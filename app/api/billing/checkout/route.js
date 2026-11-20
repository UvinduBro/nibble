// "Get Premium": a Stripe Checkout page for the signed-in person.
// - The account comes from the verified Firebase token; the price comes from the saved plan (never the browser).
// - Before a link is made: verified email, no temp-mail address, not suspended, no open fraud flag.
// - Every session carries fraud-prevention metadata (lib/billingRisk.js); the same fields are refreshed on the
//   Stripe customer so Radar rules can use them. An open session for the same package is reused (double clicks).
import { bearer } from '../../../../lib/adminAuth';
import { accountOf, getPlan, getStripe, findCustomer, syncSubscription, ACTIVE, SITE } from '../../../../lib/billing';
import { preCheck, riskMetadata, subMetadata, limitMeta } from '../../../../lib/billingRisk';
import { fsGet, fsSet } from '../../../../lib/gcp';
import { premiumActive, buyable } from '../../../../lib/premium';
import { SELLER, REFUND_DAYS } from '../../../../lib/facts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
const hits = new Map(); // a quick per-server brake on top of the checks below
function limited(uid) {
  const now = Date.now(), list = (hits.get(uid) || []).filter((t) => now - t < 600_000);
  if (list.length >= 6) return true;
  list.push(now); hits.set(uid, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return false;
}
const SESSION_MIN = 31 * 60; // Stripe allows 30 min – 24 h

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return bad('Sign in first.', 401);
  if (limited(me.uid)) return bad('Too many tries. Wait a few minutes.', 429);
  let checked;
  try { checked = await preCheck(me); } catch (e) { return bad(e.friendly || 'Not allowed.', e.status || 403); }
  const plan = await getPlan();
  const options = buyable(plan);
  if (!plan.enabled || !options.length) return bad('Premium isn’t available right now.', 503);
  let body = {};
  try { body = JSON.parse((await req.text()).slice(0, 4000) || '{}'); } catch {}
  // the package comes from the saved plan; the browser only says which one (default if unknown)
  const pkg = options.find((k) => k.id === String(body.packageId || '')) || options[0];
  const [cur, profile, signup, wallet, map] = await Promise.all([
    fsGet('premium/' + me.uid).catch(() => null),
    fsGet('users/' + me.uid).catch(() => null),
    fsGet('signup/' + me.uid).catch(() => null),
    fsGet('wallets/' + me.uid).catch(() => null),
    fsGet('billingCustomers/' + me.uid).catch(() => null),
  ]);
  if (!profile || !profile.username) return bad('Finish setting up your account first.', 403);
  if (premiumActive(cur)) return bad('You already have Premium. Use “Manage subscription” to change it.', 409);
  const stripe = (() => { try { return getStripe(); } catch { return null; } })();
  if (!stripe) return bad('Premium isn’t available right now.', 503);

  try {
    const now = Date.now();
    const recent = ((map && Array.isArray(map.recent)) ? map.recent : []).filter((t) => now - Number(t) < 86400_000).slice(-20);
    // still have an open payment page for this package? send them back to it instead of making another
    if (map && map.openSession && map.openPkg === pkg.id && Number(map.openExp) > now + 5 * 60_000) {
      const open = await stripe.checkout.sessions.retrieve(map.openSession).catch(() => null);
      if (open && open.status === 'open' && open.url && open.client_reference_id === me.uid) return Response.json({ url: open.url }, { headers: h });
    }
    let customer = (map && map.customer) || await findCustomer(me.uid);
    if (customer) {
      // never sell a second subscription (two tabs, a double click, or Premium not synced yet)
      const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
      const live = (subs.data || []).find((x) => ACTIVE.includes(x.status));
      if (live) {
        await syncSubscription(live).catch(() => {});
        return bad('You already have Premium. Use “Manage subscription” to change it.', 409);
      }
    }
    // free trial only for people who've never had Premium (no trial hopping)
    const hadPremium = !!cur;
    const trial = pkg.trialDays > 0 && !hadPremium ? pkg.trialDays : 0;
    const meta = riskMetadata({ me, req, profile, signup, wallet, pkg, trialDays: trial, promoCodes: plan.promoCodes, client: body.client, history: { recent, hadPremium, flag: checked.flag } });
    const custMeta = limitMeta({ ...meta, nb_last_checkout: new Date(now).toISOString() });
    if (!customer) {
      const c = await stripe.customers.create({
        email: me.email, name: '@' + profile.username, preferred_locales: ['en'], metadata: custMeta,
        description: 'Nibble account @' + profile.username,
      }, { idempotencyKey: 'cust-' + me.uid }).catch(async (e) => {
        // same key, different details (made earlier today but our mapping was lost): find that customer instead
        if (!(e && e.type === 'StripeIdempotencyError')) throw e;
        const found = await stripe.customers.search({ query: `metadata['uid']:'${me.uid}'`, limit: 1 });
        if (!found.data[0]) throw e;
        return found.data[0];
      });
      customer = c.id;
      await fsSet('billingCustomers/' + me.uid, { customer, updatedAt: now }, { merge: true }).catch(() => {});
    } else {
      // the latest picture of the account, where Radar rules can read it (::customer:nb_…::)
      await stripe.customers.update(customer, { email: me.email, metadata: custMeta }).catch((e) => console.error('customer update failed:', e && e.message));
    }

    const params = {
      mode: 'subscription',
      customer,
      client_reference_id: me.uid,
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      locale: 'auto',
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      payment_method_collection: 'always', // a card even for free trials (stops trial abuse)
      expires_at: Math.floor(now / 1000) + SESSION_MIN,
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: { message: `I agree to the [Terms of use](${SITE}/terms) and the [Refund policy](${SITE}/refunds), and I understand Premium renews automatically until I cancel.` },
        submit: { message: `Sold by ${SELLER.name}. Renews automatically, cancel any time in the Nibble app. Full refund within ${REFUND_DAYS} days of any payment.` },
      },
      metadata: meta,
      subscription_data: {
        description: `${plan.name} (${pkg.name}) for @${profile.username}`,
        metadata: subMetadata(meta),
        ...(trial ? { trial_period_days: trial } : {}),
      },
      ...(plan.promoCodes ? { allow_promotion_codes: true } : {}),
      success_url: `${SITE}/app?premium=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/app?premium=cancel`,
    };
    // double submits reuse the open session above; network retries are made safe by the SDK's own idempotency keys
    let s;
    try {
      s = await stripe.checkout.sessions.create(params);
    } catch (e) {
      // the terms tick-box needs a Terms URL in Stripe (Settings → Public details). Don't block sales if it's
      // missing; the admin health check shows it as a warning until it's set.
      if (!/terms of service/i.test(String(e && e.message))) throw e;
      console.error('checkout: terms URL not set in Stripe, creating the session without the terms tick-box');
      fsSet('billing/terms', { missing: true, at: now }).catch(() => {});
      delete params.consent_collection;
      delete params.custom_text.terms_of_service_acceptance;
      s = await stripe.checkout.sessions.create(params);
    }
    await fsSet('billingCustomers/' + me.uid, {
      customer, openSession: s.id, openPkg: pkg.id, openExp: (s.expires_at || 0) * 1000, recent: [...recent, now], updatedAt: now,
    }, { merge: true }).catch(() => {});
    return Response.json({ url: s.url }, { headers: h });
  } catch (e) {
    console.error('checkout failed:', e && e.message);
    return bad(e && e.code === 'not_connected' ? 'Premium isn’t available right now.' : 'Couldn’t open the payment page. Try again in a minute.', 502);
  }
}
