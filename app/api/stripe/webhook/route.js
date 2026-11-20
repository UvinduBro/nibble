// Stripe → Nibble.
// 1. The signature is checked (SDK, 5-minute tolerance, rotating secrets) before anything is read.
// 2. Each event is claimed once in billingEvents/{id}, so retries and replays never run twice.
// 3. Subscriptions are fetched from Stripe again rather than trusting the event body.
// 4. Disputes and early fraud warnings end Premium at once and flag the account for a person to review
//    (billingFlags/{uid}); an early fraud warning is also refunded, which avoids the dispute and its fee.
import { verifyEvent, getStripe, syncSubscription, uidOfCustomer, ACTIVE, subUid } from '../../../../lib/billing';
import { fsCreate, fsGet, fsSet, fsDelete, fsQuery } from '../../../../lib/gcp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const DAY = 86400_000;
const subOfInvoice = (o) => o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription) || '';
const idOf = (x) => (x && typeof x === 'object' ? x.id : x) || '';

async function syncById(subId, extra) {
  if (!subId || typeof subId !== 'string') return '';
  const sub = await getStripe().subscriptions.retrieve(subId);
  await syncSubscription(sub, extra);
  return subUid(sub);
}

// the Nibble account behind a charge (via its Stripe customer)
async function chargeOwner(chargeId) {
  const charge = await getStripe().charges.retrieve(String(chargeId), { expand: ['customer'] });
  return { charge, uid: await uidOfCustomer(charge.customer), customer: idOf(charge.customer) };
}

// end Premium now: cancel every live subscription of this customer and mark premium/{uid} off
async function revoke(uid, customer, status) {
  const stripe = getStripe();
  let ended = 0;
  if (customer) {
    const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
    for (const s of list.data || []) {
      if (!ACTIVE.includes(s.status) && s.status !== 'paused') continue;
      const done = await stripe.subscriptions.cancel(s.id, {}, { idempotencyKey: 'revoke-' + s.id });
      await syncSubscription(done, { revoke: true, status });
      ended++;
    }
  }
  if (!ended) {
    const prev = await fsGet('premium/' + uid).catch(() => null);
    if (prev && prev.active) await fsSet('premium/' + uid, { ...prev, active: false, until: Date.now(), status, source: 'stripe', updatedAt: Date.now() });
  }
}

async function flag(uid, data) {
  const prev = await fsGet('billingFlags/' + uid).catch(() => null);
  const history = ((prev && Array.isArray(prev.history)) ? prev.history : []).slice(-9);
  await fsSet('billingFlags/' + uid, {
    ...(prev || {}), ...data, uid, at: Date.now(),
    history: [...history, { reason: data.reason, chargeId: data.chargeId || '', at: Date.now() }],
  });
}

async function handle(ev) {
  const stripe = getStripe();
  const o = (ev.data && ev.data.object) || {};
  switch (ev.type) {
    case 'checkout.session.completed': {
      if (o.client_reference_id) await fsSet('billingCustomers/' + o.client_reference_id, { openSession: '', openExp: 0, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      return o.mode === 'subscription' ? syncById(idOf(o.subscription)) : '';
    }
    case 'checkout.session.expired': {
      const uid = String(o.client_reference_id || '');
      if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) return '';
      const m = await fsGet('billingCustomers/' + uid).catch(() => null);
      if (m && m.openSession === o.id) await fsSet('billingCustomers/' + uid, { openSession: '', openExp: 0, updatedAt: Date.now() }, { merge: true });
      return uid;
    }
    case 'customer.subscription.created': case 'customer.subscription.updated': case 'customer.subscription.deleted':
    case 'customer.subscription.paused': case 'customer.subscription.resumed': case 'customer.subscription.trial_will_end':
      return syncById(o.id);
    case 'invoice.paid':
      return syncById(subOfInvoice(o), { action: '' });
    case 'invoice.payment_failed':
      return syncById(subOfInvoice(o));
    case 'invoice.payment_action_required': // 3-D Secure on a renewal: the app asks them to confirm
      return syncById(subOfInvoice(o), { action: 'confirm_payment' });
    case 'charge.dispute.created': {
      const { uid, customer } = await chargeOwner(idOf(o.charge));
      if (!uid) return '';
      await revoke(uid, customer, 'disputed');
      await flag(uid, { open: true, reason: 'dispute', chargeId: idOf(o.charge), disputeId: o.id, amount: o.amount || 0, currency: o.currency || '', disputeReason: o.reason || '', disputeStatus: o.status || '', customer });
      return uid;
    }
    case 'charge.dispute.closed': {
      const { uid } = await chargeOwner(idOf(o.charge));
      if (!uid) return '';
      // the flag stays open until an admin clears it; this only records how it ended (won / lost)
      await flag(uid, { reason: 'dispute', disputeId: o.id, disputeStatus: o.status || '', closedAt: Date.now() });
      return uid;
    }
    case 'radar.early_fraud_warning.created': {
      const { charge, uid, customer } = await chargeOwner(idOf(o.charge));
      let refunded = false;
      // refund now (if it's still refundable) so the card holder's bank doesn't turn it into a dispute
      if (o.actionable && !charge.refunded && !charge.disputed) {
        await stripe.refunds.create({ charge: charge.id, reason: 'fraudulent', metadata: { nb_reason: 'early_fraud_warning', nb_efw: o.id } }, { idempotencyKey: 'efw-' + o.id });
        refunded = true;
      }
      if (!uid) return '';
      await revoke(uid, customer, 'fraud_warning');
      await flag(uid, { open: true, reason: 'fraud_warning', chargeId: charge.id, efwId: o.id, fraudType: o.fraud_type || '', amount: charge.amount || 0, currency: charge.currency || '', refunded, customer });
      return uid;
    }
    case 'charge.refunded': {
      if (!o.refunded) return ''; // partial refund: nothing changes
      const { uid, customer } = await chargeOwner(o.id);
      if (!uid) return '';
      // a full refund (e.g. the 14-day refund) ends Premium; it doesn't block buying again later
      await revoke(uid, customer, 'refunded');
      const prev = await fsGet('billingFlags/' + uid).catch(() => null);
      await flag(uid, { open: !!(prev && prev.open), reason: (prev && prev.open && prev.reason) || 'refund', lastRefund: { chargeId: o.id, amount: o.amount_refunded || 0, currency: o.currency || '', at: Date.now() }, customer });
      return uid;
    }
    default:
      return '';
  }
}

// keep billingEvents small: now and then delete a few older than 90 days
async function tidy() {
  if (Math.random() > 0.1) return;
  const old = await fsQuery('billingEvents', { where: [['at', '<', Date.now() - 90 * DAY]], limit: 20 }).catch(() => []);
  await Promise.all(old.map((d) => fsDelete('billingEvents/' + d.id).catch(() => {})));
}

export async function POST(req) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response('too big', { status: 413 });
  const ev = verifyEvent(raw, req.headers.get('stripe-signature'));
  if (!ev) return new Response('bad signature', { status: 400 });
  if (!/^evt_\w+$/.test(String(ev.id || ''))) return new Response('bad event', { status: 400 });
  const path = 'billingEvents/' + ev.id;
  try {
    const fresh = await fsCreate(path, { type: String(ev.type || ''), at: Date.now(), created: (ev.created || 0) * 1000, live: !!ev.livemode, status: 'processing', tries: 1 });
    if (!fresh) {
      const prev = await fsGet(path).catch(() => null);
      if (prev && prev.status === 'done') return Response.json({ received: true, duplicate: true });
      // another delivery is working on it right now: let Stripe try again a bit later
      if (prev && prev.status === 'processing' && Date.now() - (prev.at || 0) < 60_000) return new Response('busy', { status: 409 });
      await fsSet(path, { status: 'processing', at: Date.now(), tries: ((prev && prev.tries) || 1) + 1 }, { merge: true });
    }
  } catch (e) {
    console.error('webhook claim failed:', ev.type, e && e.message);
    return new Response('retry', { status: 500 });
  }
  try {
    const uid = await handle(ev);
    await fsSet(path, { status: 'done', uid: uid || '', doneAt: Date.now(), error: '' }, { merge: true }).catch(() => {});
    await tidy();
    return Response.json({ received: true });
  } catch (e) {
    console.error('webhook failed:', ev.type, e && e.message);
    await fsSet(path, { status: 'failed', error: String((e && e.message) || 'error').slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
    return new Response('retry', { status: 500 }); // Stripe retries with backoff
  }
}
