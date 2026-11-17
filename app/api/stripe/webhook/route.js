// Stripe → Nibble. Every request is checked against the webhook signing secret (and must be fresh)
// before anything is read from it; then the subscription is fetched from Stripe again rather than
// trusting the event body, and premium/{uid} is updated.
import { getSecrets, verifyStripeSignature, stripe, syncSubscription } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response('too big', { status: 413 });
  const { webhookSecret } = await getSecrets();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), webhookSecret)) return new Response('bad signature', { status: 400 });
  let ev;
  try { ev = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  const o = (ev.data && ev.data.object) || {};
  try {
    let subId = '';
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') subId = o.subscription;
    else if (ev.type && ev.type.startsWith('customer.subscription.')) subId = o.id;
    else if (ev.type === 'invoice.paid' || ev.type === 'invoice.payment_failed') subId = o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
    if (subId && typeof subId === 'string') {
      const sub = await stripe('GET', '/subscriptions/' + encodeURIComponent(subId));
      await syncSubscription(sub);
    }
    return Response.json({ received: true });
  } catch (e) {
    console.error('webhook failed:', ev.type, e && e.message);
    return new Response('retry', { status: 500 }); // Stripe retries with backoff
  }
}
