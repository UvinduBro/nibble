// "Get Premium": a Stripe Checkout page for the signed-in person. The price comes from the saved
// plan (never from the browser) and the account comes from the verified Firebase token.
import { bearer } from '../../../../lib/adminAuth';
import { accountOf, getPlan, stripe, findCustomer, syncSubscription, SITE } from '../../../../lib/billing';
import { fsGet, fsSet } from '../../../../lib/gcp';
import { premiumActive } from '../../../../lib/premium';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
const hits = new Map();
function limited(uid) {
  const now = Date.now(), list = (hits.get(uid) || []).filter((t) => now - t < 600_000);
  if (list.length >= 6) return true;
  list.push(now); hits.set(uid, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return false;
}

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return bad('Sign in first.', 401);
  if (limited(me.uid)) return bad('Too many tries. Wait a few minutes.', 429);
  const plan = await getPlan();
  if (!plan.enabled || !plan.priceId) return bad('Premium isn’t available right now.', 503);
  const cur = await fsGet('premium/' + me.uid).catch(() => null);
  if (premiumActive(cur)) return bad('You already have Premium. Use “Manage subscription” to change it.', 409);
  try {
    let customer = await findCustomer(me.uid);
    if (!customer) {
      const c = await stripe('POST', '/customers', { email: me.email || undefined, metadata: { uid: me.uid } }, { idempotency: 'cust-' + me.uid });
      customer = c.id;
      await fsSet('billingCustomers/' + me.uid, { customer, updatedAt: Date.now() }).catch(() => {});
    } else {
      // never sell a second subscription (two tabs, a double click, or Premium not synced yet)
      const subs = await stripe('GET', '/subscriptions', { customer, status: 'all', limit: 10 });
      const live = (subs.data || []).find((x) => ['active', 'trialing', 'past_due'].includes(x.status));
      if (live) {
        await syncSubscription(live).catch(() => {});
        return bad('You already have Premium. Use “Manage subscription” to change it.', 409);
      }
    }
    const s = await stripe('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: me.uid,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      metadata: { uid: me.uid },
      subscription_data: { metadata: { uid: me.uid } },
      allow_promotion_codes: 'true',
      success_url: `${SITE}/app?premium=success`,
      cancel_url: `${SITE}/app?premium=cancel`,
    });
    return Response.json({ url: s.url }, { headers: h });
  } catch (e) {
    console.error('checkout failed:', e && e.message);
    return bad(e && e.code === 'not_connected' ? 'Premium isn’t available right now.' : 'Couldn’t open the payment page. Try again in a minute.', 502);
  }
}
