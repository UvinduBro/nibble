// Stripe → Nibble.
// 1. The signature is checked (SDK, 5-minute tolerance, rotating secrets) before anything is read.
// 2. Each event is claimed once in billingEvents/{id}, so retries and replays never run twice.
// 3. Subscriptions are fetched from Stripe again rather than trusting the event body.
// 4. Disputes and early fraud warnings end Premium at once and flag the account for a person to review
//    (billingFlags/{uid}); an early fraud warning is also refunded, which avoids the dispute and its fee.
// 5. Only Nibble's own customers and checkouts are touched (the Stripe account may also sell other things), and
//    events from the other mode (test vs. live) are ignored.
// 6. Two subscriptions for one person (paid in two tabs at once): the newer one is cancelled and refunded.
import { verifyEvent, getStripe, syncSubscription, uidOfCustomer, subOfCharge, isLive, ACTIVE, subUid, UID_RE } from '../../../../lib/billing';
import { fsCreate, fsGet, fsSet, fsDelete, fsQuery } from '../../../../lib/gcp';
import { alertPremium, alertRenewal } from '../../../../lib/teamAlerts';

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
    if (prev && prev.active) await fsSet('premium/' + uid, { ...prev, active: false, until: Date.now(), status: 'ended', source: 'stripe', updatedAt: Date.now() });
  }
}

// one person, one subscription: keep the oldest live one, cancel the others and refund what they charged
async function dropDuplicates(uid, customer) {
  const stripe = getStripe();
  const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
  const live = list.data.filter((x) => subUid(x) === uid && ACTIVE.includes(x.status)).sort((a, b) => a.created - b.created);
  for (const dup of live.slice(1)) {
    const done = await stripe.subscriptions.cancel(dup.id, {}, { idempotencyKey: 'dup-' + dup.id });
    const inv = idOf(done.latest_invoice);
    if (inv) {
      const pays = await stripe.invoicePayments.list({ invoice: inv, status: 'paid', limit: 5 });
      for (const ip of pays.data) {
        const pay = ip.payment || {};
        const target = pay.payment_intent ? { payment_intent: idOf(pay.payment_intent) } : pay.charge ? { charge: idOf(pay.charge) } : null;
        if (target) await stripe.refunds.create({ ...target, reason: 'duplicate', metadata: { nb_reason: 'duplicate_subscription', nb_sub: dup.id } }, { idempotencyKey: 'dup-refund-' + ip.id });
      }
    }
    console.error('webhook: cancelled + refunded duplicate subscription', dup.id, 'for', uid);
  }
  if (live.length > 1) await syncSubscription(live[0], { noFallback: true });
  return live.length - 1;
}

async function flag(uid, data) {
  const prev = await fsGet('billingFlags/' + uid).catch(() => null);
  const history = ((prev && Array.isArray(prev.history)) ? prev.history : []).slice(-9);
  await fsSet('billingFlags/' + uid, {
    ...(prev || {}), ...data, uid, at: Date.now(),
    history: [...history, { reason: data.reason, chargeId: data.chargeId || '', at: Date.now() }],
  });
}

// the Nibble account behind a Checkout Session ('' for sessions made by anything else on this Stripe account)
function nibbleSession(o) {
  const uid = String(o.client_reference_id || '');
  const m = o.metadata || {};
  return UID_RE.test(uid) && (m.uid === uid || m.nb_uid === uid) ? uid : '';
}

async function handle(ev) {
  const stripe = getStripe();
  const o = (ev.data && ev.data.object) || {};
  switch (ev.type) {
    case 'checkout.session.completed': {
      const uid = nibbleSession(o);
      if (!uid) return '';
      const m = await fsGet('billingCustomers/' + uid).catch(() => null);
      if (m && m.openSession === o.id) await fsSet('billingCustomers/' + uid, { openSession: '', openExp: 0, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      if (o.mode !== 'subscription') return uid;
      await syncById(idOf(o.subscription));
      if (o.customer) await dropDuplicates(uid, idOf(o.customer));
      await tellTeam(async () => {
        // a duplicate that was just cancelled + refunded isn't a sale
        const sub = await stripe.subscriptions.retrieve(idOf(o.subscription));
        if (ACTIVE.includes(sub.status)) await alertPremium({ session: o, sub, uid });
      });
      return uid;
    }
    case 'checkout.session.expired': {
      const uid = nibbleSession(o);
      if (!uid) return '';
      const m = await fsGet('billingCustomers/' + uid).catch(() => null);
      if (m && m.openSession === o.id) await fsSet('billingCustomers/' + uid, { openSession: '', openExp: 0, updatedAt: Date.now() }, { merge: true });
      return uid;
    }
    case 'customer.subscription.created': case 'customer.subscription.updated': case 'customer.subscription.deleted':
    case 'customer.subscription.paused': case 'customer.subscription.resumed': case 'customer.subscription.trial_will_end':
      return syncById(o.id);
    case 'invoice.paid': {
      const uid = await syncById(subOfInvoice(o), { action: '' });
      // renewals only (the first payment is announced by checkout.session.completed)
      if (uid && o.billing_reason === 'subscription_cycle') {
        await tellTeam(async () => alertRenewal({ invoice: o, sub: await stripe.subscriptions.retrieve(subOfInvoice(o)), uid }));
      }
      return uid;
    }
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
      if (!uid) return ''; // not a Nibble payment: leave it to whoever sells it
      let refunded = false;
      // refund now (if it's still refundable) so the card holder's bank doesn't turn it into a dispute
      if (o.actionable && !charge.refunded && !charge.disputed) {
        await stripe.refunds.create({ charge: charge.id, reason: 'fraudulent', metadata: { nb_reason: 'early_fraud_warning', nb_efw: o.id } }, { idempotencyKey: 'efw-' + o.id });
        refunded = true;
      }
      await revoke(uid, customer, 'fraud_warning');
      await flag(uid, { open: true, reason: 'fraud_warning', chargeId: charge.id, efwId: o.id, fraudType: o.fraud_type || '', amount: charge.amount || 0, currency: charge.currency || '', refunded, customer });
      return uid;
    }
    case 'charge.refunded': {
      if (!o.refunded) return ''; // partial refund: nothing changes
      const { uid, customer } = await chargeOwner(o.id);
      if (!uid) return '';
      // a full refund (e.g. the 14-day refund) ends the subscription it paid for, but only if it paid for the
      // period they're in now: refunding last year's renewal doesn't take away this year's Premium.
      // It never blocks buying again later.
      const paid = await subOfCharge(o).catch(() => null);
      if (paid && paid.sub) {
        const sub = await stripe.subscriptions.retrieve(paid.sub);
        if (ACTIVE.includes(sub.status) && idOf(sub.latest_invoice) === paid.invoice) {
          const done = await stripe.subscriptions.cancel(sub.id, {}, { idempotencyKey: 'refund-' + sub.id });
          await syncSubscription(done, { revoke: true });
        }
      }
      const prev = await fsGet('billingFlags/' + uid).catch(() => null);
      await flag(uid, { open: !!(prev && prev.open), reason: (prev && prev.open && prev.reason) || 'refund', lastRefund: { chargeId: o.id, amount: o.amount_refunded || 0, currency: o.currency || '', at: Date.now() }, customer });
      return uid;
    }
    default:
      return '';
  }
}

// email the team (lib/teamAlerts.js); never lets an alert fail the webhook
async function tellTeam(fn) {
  try { await fn(); } catch (e) { console.error('team alert skipped:', e && e.message); }
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
  // a test event while running live (or the other way round) would be looked up with the wrong key and fail forever
  if (!!ev.livemode !== isLive()) return Response.json({ received: true, ignored: 'other mode' });
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
