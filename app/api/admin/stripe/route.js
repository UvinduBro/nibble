// Admin → Stripe (admins only): everyday Stripe work without opening the Stripe dashboard.
//   GET  ?view=overview | payments | customer | subscriptions | invoices | disputes | dispute | fraud | events | audit
//        &q= (@username, email or a Stripe id) &id= &f= (filter) &cursor= (next page)
//   POST { action, reason, … }   every money action needs a reason and is saved to the audit log
//        refund | subCancel | subResume | subPause | subUnpause | subChangePackage | subExtendTrial |
//        invoiceRetry | invoiceVoid | disputeEvidence | disputeAccept | block | unblock | clearFlag | resync
// Everything runs with the restricted key in STRIPE_SECRET_KEY; card numbers are never seen (only brand + last 4).
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { getStripe, getSecrets, getPlan, findCustomer, refreshFromStripe, syncSubscription, subUntil, ACTIVE, UID_RE } from '../../../../lib/billing';
import { fsGet, fsSet, fsQuery } from '../../../../lib/gcp';
import { audit, recentAudit } from '../../../../lib/billingAudit';
import { REFUND_DAYS, SELLER, SITE } from '../../../../lib/facts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
const DAY = 86400_000;
const PAGE = 25;
const ID = (prefix) => new RegExp(`^(${prefix})_[A-Za-z0-9]{6,80}$`);
const CURSOR = /^[a-z]{2,6}_[A-Za-z0-9]{6,80}$/;
// our own Radar block lists (they block payments once the two rules in docs/STRIPE_SETUP.md exist)
const LISTS = { email: { alias: 'nibble_blocked_emails', name: 'Nibble: blocked emails', type: 'email' }, card: { alias: 'nibble_blocked_cards', name: 'Nibble: blocked cards', type: 'card_fingerprint' } };

async function guard(req) {
  const token = bearer(req);
  if (!token) return { res: bad('Sign in as an admin.', 401) };
  try { const uid = await adminUid(token); return uid ? { uid } : { res: bad('Admins only.', 403) }; }
  catch { return { res: bad('Couldn’t check your admin access. Try again.', 502) }; }
}

// a Stripe error → plain words (a missing key permission says which one to add)
const PERMS = {
  balance: 'Balance (Read)', payout: 'Payouts (Read)', event: 'Events (Read)', dispute: 'Payment Disputes (Write)',
  invoice: 'Invoices (Write)', radar: 'Radar value lists (Write)', value_list: 'Radar value lists (Write)', early_fraud: 'Charges and Refunds (Read)',
  payment_method: 'Payment methods (Read)', payment_intent: 'PaymentIntents (Read)', balance_transaction: 'Balance (Read)',
};
function friendly(e) {
  const msg = String((e && e.message) || 'Stripe error');
  if (e && (e.type === 'StripePermissionError' || e.statusCode === 403)) {
    const rak = (msg.match(/'rak_([a-z_]+?)_(read|write)'/) || [])[1] || '';
    const hit = Object.keys(PERMS).find((k) => rak.startsWith(k));
    return 'This needs a Stripe key permission' + (hit ? ': ' + PERMS[hit] : rak ? ': ' + rak.replace(/_/g, ' ') : '') + '. Add it to the restricted key in Stripe → Developers → API keys.';
  }
  return msg.replace(/(sk|rk)_(live|test)_\w+/g, '[key]').slice(0, 240);
}
// one section of a page that may fail on its own (e.g. a missing permission) without breaking the rest
const safe = (p) => p.then((data) => ({ data }), (e) => ({ error: friendly(e) }));

const idOf = (x) => (x && typeof x === 'object' ? x.id : x) || '';
const custInfo = (c) => {
  const m = (c && typeof c === 'object' && !c.deleted && c.metadata) || {};
  const uid = m.nb_uid || m.uid || '';
  return { customer: idOf(c), uid: UID_RE.test(uid) ? uid : '', username: String(m.nb_username || '').replace(/^@/, ''), email: (c && typeof c === 'object' && c.email) || '' };
};
const priceOf = (sub) => { const it = (sub.items && sub.items.data && sub.items.data[0]) || {}; const p = it.price || {}; return { amount: (p.unit_amount || 0) * (it.quantity || 1), currency: p.currency || '', interval: (p.recurring && p.recurring.interval) || '', priceId: p.id || '' }; };
const monthly = (s) => { const p = priceOf(s); return p.interval === 'year' ? p.amount / 12 : p.interval === 'week' ? (p.amount * 52) / 12 : p.amount; };

const chargeRow = (c) => {
  const card = (c.payment_method_details && c.payment_method_details.card) || {};
  const o = c.outcome || {};
  return {
    id: c.id, created: c.created * 1000, amount: c.amount, refunded: c.amount_refunded, currency: c.currency, status: c.status,
    paid: c.paid, fullyRefunded: c.refunded, disputed: c.disputed, description: c.description || '',
    risk: o.risk_level || '', score: o.risk_score != null ? o.risk_score : null, outcome: o.seller_message || '', network: o.network_status || '',
    brand: card.brand || '', last4: card.last4 || '', country: card.country || '', fingerprint: card.fingerprint || '',
    cvc: (card.checks && card.checks.cvc_check) || '', zip: (card.checks && card.checks.address_postal_code_check) || '',
    receipt: c.receipt_url || '', billingEmail: (c.billing_details && c.billing_details.email) || '', invoice: idOf(c.invoice), intent: idOf(c.payment_intent),
    ...custInfo(c.customer),
  };
};
const subRow = (s) => ({
  id: s.id, status: s.status, cancelAtEnd: !!s.cancel_at_period_end, paused: !!s.pause_collection, until: subUntil(s), trialEnd: (s.trial_end || 0) * 1000,
  created: s.created * 1000, canceledAt: (s.canceled_at || 0) * 1000, pkg: (s.metadata && s.metadata.package) || '', ...priceOf(s), ...custInfo(s.customer),
});
const invRow = (i) => ({
  id: i.id, number: i.number || '', status: i.status, due: i.amount_due, paid: i.amount_paid, remaining: i.amount_remaining, currency: i.currency,
  created: i.created * 1000, dueDate: (i.due_date || 0) * 1000, attempts: i.attempt_count || 0, nextAttempt: (i.next_payment_attempt || 0) * 1000,
  url: i.hosted_invoice_url || '', pdf: i.invoice_pdf || '', reason: i.billing_reason || '', ...custInfo(i.customer),
});
const EVIDENCE = ['product_description', 'access_activity_log', 'customer_name', 'customer_email_address', 'billing_address', 'service_date', 'refund_policy_disclosure', 'cancellation_policy_disclosure', 'cancellation_rebuttal', 'refund_refusal_explanation', 'uncategorized_text'];
const dispRow = (d) => {
  const ch = typeof d.charge === 'object' ? d.charge : null;
  const ev = d.evidence || {};
  return {
    id: d.id, amount: d.amount, currency: d.currency, status: d.status, reason: d.reason, created: d.created * 1000,
    dueBy: ((d.evidence_details && d.evidence_details.due_by) || 0) * 1000, submissions: (d.evidence_details && d.evidence_details.submission_count) || 0,
    hasEvidence: !!(d.evidence_details && d.evidence_details.has_evidence), refundable: !!d.is_charge_refundable, charge: idOf(d.charge),
    evidence: Object.fromEntries(EVIDENCE.map((k) => [k, typeof ev[k] === 'string' ? ev[k] : ''])),
    ...(ch ? custInfo(ch.customer) : {}),
  };
};
const page = (list, map) => ({ rows: (list.data || []).map(map), next: list.has_more && list.data.length ? list.data[list.data.length - 1].id : '' });

// "@name", an email or a Stripe id → what it points at
async function resolve(stripe, q) {
  q = String(q || '').trim();
  if (!q) return {};
  // "@name", or a bare 3–20 letter word that isn't a Stripe id, is a Nibble username
  if (q.startsWith('@') || (/^[a-z0-9_]{3,20}$/i.test(q) && !/^(ch|py|pi|cus|in|sub|dp|du|rsli)_/i.test(q))) {
    const name = q.replace(/^@/, '').toLowerCase();
    const hit = await fsGet('usernames/' + name).catch(() => null);
    if (hit && hit.uid) { const customer = await findCustomer(hit.uid); return { customer, uid: hit.uid, none: !customer && `@${name} has never paid.` }; }
    if (q.startsWith('@')) return { none: `No one called @${name}.` };
  }
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(q)) {
    const list = await stripe.customers.list({ email: q.toLowerCase(), limit: 1 });
    return list.data[0] ? { customer: list.data[0].id } : { none: 'No Stripe customer with that email.' };
  }
  if (ID('cus').test(q)) return { customer: q };
  if (ID('ch|py').test(q)) return { charge: q };
  if (ID('pi').test(q)) { const pi = await stripe.paymentIntents.retrieve(q); return { charge: idOf(pi.latest_charge), customer: idOf(pi.customer) }; }
  if (ID('in').test(q)) { const i = await stripe.invoices.retrieve(q); return { customer: idOf(i.customer), invoice: q }; }
  if (ID('sub').test(q)) { const s = await stripe.subscriptions.retrieve(q); return { customer: idOf(s.customer), sub: q }; }
  if (ID('dp|du').test(q)) { const d = await stripe.disputes.retrieve(q, { expand: ['charge'] }); return { charge: idOf(d.charge), dispute: q }; }
  return { none: 'Type an @username, an email, or a Stripe id (ch_, pi_, cus_, sub_, in_, dp_).' };
}

async function overview(stripe) {
  const since = Math.floor((Date.now() - 30 * DAY) / 1000);
  const [balance, payouts, txns, subs, disputes, efw, invoices, flags, failed] = await Promise.all([
    safe(stripe.balance.retrieve()),
    safe(stripe.payouts.list({ limit: 10 })),
    safe(stripe.balanceTransactions.list({ created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 1000 })),
    safe(stripe.subscriptions.list({ status: 'all', limit: 100 }).autoPagingToArray({ limit: 1000 })),
    safe(stripe.disputes.list({ limit: 30 })),
    safe(stripe.radar.earlyFraudWarnings.list({ limit: 20 })),
    safe(stripe.invoices.list({ status: 'open', limit: 30 })),
    fsQuery('billingFlags', { where: [['open', '==', true]], limit: 20 }).catch(() => []),
    fsQuery('billingEvents', { where: [['status', '==', 'failed']], limit: 10 }).catch(() => []),
  ]);
  const out = { sections: {} };
  if (balance.data) out.balance = { available: balance.data.available.map((b) => ({ amount: b.amount, currency: b.currency })), pending: balance.data.pending.map((b) => ({ amount: b.amount, currency: b.currency })) };
  else out.sections.balance = balance.error;
  if (payouts.data) out.payouts = payouts.data.data.map((p) => ({ id: p.id, amount: p.amount, currency: p.currency, status: p.status, arrival: p.arrival_date * 1000, method: p.method }));
  else out.sections.payouts = payouts.error;
  if (txns.data) {
    const t = { gross: 0, fees: 0, net: 0, refunds: 0, disputes: 0, currency: '' }, days = {};
    for (const x of txns.data) {
      t.currency = t.currency || x.currency;
      if (x.type === 'charge' || x.type === 'payment') { t.gross += x.amount; const d = new Date(x.created * 1000).toISOString().slice(0, 10); days[d] = (days[d] || 0) + x.amount; }
      if (x.type === 'refund' || x.type === 'payment_refund') t.refunds += -x.amount;
      if (x.type === 'adjustment' && /dispute/i.test(x.description || '')) t.disputes += -x.amount;
      if (x.type !== 'payout') { t.fees += x.fee; t.net += x.net; }
    }
    out.money30 = { ...t, days: Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10); return [d, days[d] || 0]; }) };
  } else out.sections.money30 = txns.error;
  if (subs.data) {
    const live = subs.data.filter((s) => ACTIVE.includes(s.status));
    const cut = Date.now() - 30 * DAY;
    out.subs = {
      active: live.filter((s) => s.status === 'active').length, trialing: live.filter((s) => s.status === 'trialing').length,
      pastDue: live.filter((s) => s.status === 'past_due').length, cancelling: live.filter((s) => s.cancel_at_period_end).length,
      mrr: Math.round(live.filter((s) => s.status !== 'trialing' && !s.pause_collection).reduce((t, s) => t + monthly(s), 0)),
      currency: (live[0] && priceOf(live[0]).currency) || 'usd',
      new30: subs.data.filter((s) => s.created * 1000 >= cut).length, cancelled30: subs.data.filter((s) => (s.canceled_at || 0) * 1000 >= cut).length,
      more: subs.data.length >= 1000,
    };
  } else out.sections.subs = subs.error;
  const needs = [];
  if (disputes.data) for (const d of disputes.data.data) if (['needs_response', 'warning_needs_response'].includes(d.status)) needs.push({ kind: 'dispute', id: d.id, amount: d.amount, currency: d.currency, dueBy: ((d.evidence_details && d.evidence_details.due_by) || 0) * 1000 });
  if (efw.data) for (const w of efw.data.data) if (w.actionable) needs.push({ kind: 'efw', id: w.id, charge: idOf(w.charge), at: w.created * 1000 });
  if (invoices.data) for (const i of invoices.data.data) if (i.attempt_count > 0) needs.push({ kind: 'invoice', id: i.id, amount: i.amount_remaining, currency: i.currency, attempts: i.attempt_count });
  for (const f of flags) needs.push({ kind: 'flag', id: f.id, uid: f.id, reason: f.data.reason || '' });
  for (const e of failed) needs.push({ kind: 'webhook', id: e.id, type: e.data.type || '', error: e.data.error || '' });
  out.needs = needs;
  for (const [k, r] of [['disputes', disputes], ['fraud', efw], ['invoices', invoices]]) if (r.error) out.sections[k] = r.error;
  return out;
}

async function view(stripe, v, p) {
  const cursor = CURSOR.test(p.get('cursor') || '') ? p.get('cursor') : undefined;
  const q = p.get('q') || '';
  const f = p.get('f') || '';
  if (v === 'overview') return overview(stripe);
  if (v === 'payments') {
    const r = q ? await resolve(stripe, q) : {};
    if (r.none) return { rows: [], next: '', note: r.none };
    if (r.charge) return { rows: [chargeRow(await stripe.charges.retrieve(r.charge, { expand: ['customer'] }))], next: '' };
    return page(await stripe.charges.list({ limit: PAGE, ...(r.customer ? { customer: r.customer } : {}), ...(cursor ? { starting_after: cursor } : {}), expand: ['data.customer'] }), chargeRow);
  }
  if (v === 'customer') {
    let id = p.get('id') || '';
    if (!ID('cus').test(id)) { const r = await resolve(stripe, q); if (r.none || !r.customer) return { none: r.none || 'Nothing found.' }; id = r.customer; }
    const [c, subs, invs, charges, pms] = await Promise.all([
      stripe.customers.retrieve(id),
      safe(stripe.subscriptions.list({ customer: id, status: 'all', limit: 10 })),
      safe(stripe.invoices.list({ customer: id, limit: 20 })),
      safe(stripe.charges.list({ customer: id, limit: 20 })),
      safe(stripe.paymentMethods.list({ customer: id, type: 'card', limit: 5 })),
    ]);
    if (c.deleted) return { none: 'That customer was deleted in Stripe.' };
    const info = custInfo(c);
    const [flag, premium, user] = info.uid ? await Promise.all([fsGet('billingFlags/' + info.uid).catch(() => null), fsGet('premium/' + info.uid).catch(() => null), fsGet('users/' + info.uid).catch(() => null)]) : [null, null, null];
    const meta = Object.fromEntries(Object.entries(c.metadata || {}).filter(([k]) => k.startsWith('nb_') || k.startsWith('c_')));
    return {
      customer: { id: c.id, email: c.email || '', name: c.name || '', created: c.created * 1000, country: (c.address && c.address.country) || '', ...info, username: (user && user.username) || info.username, meta },
      subs: subs.data ? subs.data.data.map(subRow) : [], invoices: invs.data ? invs.data.data.map(invRow) : [], charges: charges.data ? charges.data.data.map(chargeRow) : [],
      cards: pms.data ? pms.data.data.map((m) => ({ id: m.id, brand: m.card.brand, last4: m.card.last4, exp: `${m.card.exp_month}/${String(m.card.exp_year).slice(-2)}`, country: m.card.country, fingerprint: m.card.fingerprint })) : [],
      flag: flag || null, premium: premium || null,
      sections: Object.fromEntries([['subs', subs], ['invoices', invs], ['charges', charges], ['cards', pms]].filter(([, r]) => r.error).map(([k, r]) => [k, r.error])),
    };
  }
  if (v === 'subscriptions') {
    const status = ['active', 'trialing', 'past_due', 'canceled', 'paused'].includes(f) ? f : f === 'cancelling' ? 'active' : 'all';
    const r = q ? await resolve(stripe, q) : {};
    if (r.none) return { rows: [], next: '', note: r.none };
    const res = page(await stripe.subscriptions.list({ status, limit: PAGE, ...(r.customer ? { customer: r.customer } : {}), ...(cursor ? { starting_after: cursor } : {}), expand: ['data.customer'] }), subRow);
    if (f === 'cancelling') res.rows = res.rows.filter((s) => s.cancelAtEnd);
    return res;
  }
  if (v === 'invoices') {
    const status = ['open', 'paid', 'uncollectible', 'void', 'draft'].includes(f) ? f : undefined;
    const r = q ? await resolve(stripe, q) : {};
    if (r.none) return { rows: [], next: '', note: r.none };
    return page(await stripe.invoices.list({ limit: PAGE, ...(status ? { status } : {}), ...(r.customer ? { customer: r.customer } : {}), ...(cursor ? { starting_after: cursor } : {}), expand: ['data.customer'] }), invRow);
  }
  if (v === 'disputes') return page(await stripe.disputes.list({ limit: PAGE, ...(cursor ? { starting_after: cursor } : {}), expand: ['data.charge.customer'] }), dispRow);
  if (v === 'dispute') {
    const id = p.get('id') || '';
    if (!ID('dp|du').test(id)) return { none: 'Unknown dispute.' };
    const d = await stripe.disputes.retrieve(id, { expand: ['charge.customer'] });
    const row = dispRow(d);
    // a starting point for the evidence, built from what Nibble knows about the account (one-off reads)
    const [user, premium, presence, signup] = row.uid ? await Promise.all(['users/', 'premium/', 'presence/', 'signup/'].map((pre) => fsGet(pre + row.uid).catch(() => null))) : [null, null, null, null];
    const ch = typeof d.charge === 'object' ? d.charge : {};
    const fmt = (t) => (t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown');
    const cm = (ch.customer && ch.customer.metadata) || {};
    row.prefill = {
      product_description: `Nibble Premium: an optional subscription with extra features (Premium badge, double daily bonus, bigger music rooms) inside the Nibble desktop pet app (${SITE}). Sold by ${SELLER.name}. Delivered digitally to the buyer's Nibble account @${(user && user.username) || row.username || '?'} immediately after payment.`,
      customer_name: (ch.billing_details && ch.billing_details.name) || '',
      customer_email_address: (ch.billing_details && ch.billing_details.email) || row.email || '',
      billing_address: ch.billing_details && ch.billing_details.address ? [ch.billing_details.address.line1, ch.billing_details.address.city, ch.billing_details.address.postal_code, ch.billing_details.address.country].filter(Boolean).join(', ') : '',
      service_date: ch.created ? new Date(ch.created * 1000).toISOString().slice(0, 10) : '',
      access_activity_log: [
        `Nibble account @${(user && user.username) || row.username || '?'} (id ${row.uid || '?'})`,
        `Account created: ${fmt(user && user.createdAt)}; sign-in method: ${cm.nb_auth_provider || 'unknown'}; email verified: ${cm.nb_email_verified || 'unknown'}`,
        `Sign-up country: ${(signup && signup.country) || cm.nb_signup_country || 'unknown'}; country of the checkout request: ${cm.nb_ip_country || 'unknown'}`,
        `Premium since: ${fmt(premium && premium.since)}; Premium status now: ${(premium && premium.status) || 'unknown'}`,
        `Last seen online in the app: ${fmt(presence && presence.lastSeen)}`,
        `Terms and refund policy accepted at checkout (${SITE}/terms, ${SITE}/refunds).`,
      ].join('\n'),
      refund_policy_disclosure: `Full refund within ${REFUND_DAYS} days of any payment, on request by email (${SITE}/refunds). The buyer ticked "I agree to the Terms of use and the Refund policy" on the Stripe checkout page before paying.`,
      cancellation_policy_disclosure: `Cancel any time in the app (Premium → Manage subscription); Premium stays until the end of the paid period and no further charges are made (${SITE}/terms).`,
    };
    return row;
  }
  if (v === 'fraud') {
    const [efw, lists] = await Promise.all([
      safe(stripe.radar.earlyFraudWarnings.list({ limit: 25, expand: ['data.charge'] })),
      safe(Promise.all(Object.entries(LISTS).map(async ([k, l]) => {
        const found = await stripe.radar.valueLists.list({ alias: l.alias, limit: 1 });
        const vl = found.data[0];
        if (!vl) return [k, { alias: l.alias, items: [] }];
        const items = await stripe.radar.valueListItems.list({ value_list: vl.id, limit: 100 });
        return [k, { id: vl.id, alias: l.alias, items: items.data.map((i) => ({ id: i.id, value: i.value, at: i.created * 1000, by: i.created_by || '' })) }];
      }))),
    ]);
    return {
      warnings: efw.data ? efw.data.data.map((w) => ({ id: w.id, at: w.created * 1000, actionable: w.actionable, type: w.fraud_type, charge: typeof w.charge === 'object' ? chargeRow(w.charge) : { id: idOf(w.charge) } })) : [],
      lists: lists.data ? Object.fromEntries(lists.data) : null,
      sections: { ...(efw.error ? { warnings: efw.error } : {}), ...(lists.error ? { lists: lists.error } : {}) },
    };
  }
  if (v === 'events') {
    const [ours, theirs] = await Promise.all([
      fsQuery('billingEvents', { order: ['at', 'desc'], limit: 50 }).catch(() => []),
      safe(stripe.events.list({ limit: 50, created: { gte: Math.floor((Date.now() - 3 * DAY) / 1000) } })),
    ]);
    return {
      ours: ours.map((d) => ({ id: d.id, type: d.data.type || '', status: d.data.status || '', uid: d.data.uid || '', at: d.data.at || 0, tries: d.data.tries || 1, error: d.data.error || '', live: !!d.data.live })),
      stripe: theirs.data ? theirs.data.data.map((e) => ({ id: e.id, type: e.type, at: e.created * 1000, pending: e.pending_webhooks || 0 })) : [],
      sections: theirs.error ? { stripe: theirs.error } : {},
    };
  }
  if (v === 'audit') return { rows: await recentAudit(100) };
  return { error: 'Unknown view.' };
}

export async function GET(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  const sec = getSecrets();
  if (!sec.secretKey) return bad('Add STRIPE_SECRET_KEY in Vercel first (see the set-up guide).', 503);
  const p = new URL(req.url).searchParams;
  const v = p.get('view') || 'overview';
  try {
    const out = await view(getStripe(), v, p);
    return Response.json({ mode: sec.mode, ...out }, { headers: h });
  } catch (e) {
    console.error('admin stripe view failed:', v, e && e.message);
    return bad(friendly(e), 502);
  }
}

// ---------- actions ----------
const STRIPE_REASONS = ['requested_by_customer', 'duplicate', 'fraudulent'];
async function blockList(stripe, kind) {
  const l = LISTS[kind];
  const found = await stripe.radar.valueLists.list({ alias: l.alias, limit: 1 });
  return found.data[0] || stripe.radar.valueLists.create({ alias: l.alias, name: l.name, item_type: l.type, metadata: { app: 'nibble' } });
}

async function act(stripe, b, by) {
  const reason = String(b.reason || '').replace(/\s+/g, ' ').trim();
  const meta = { nb_by: by, nb_reason: reason.slice(0, 200) };
  const minute = Math.floor(Date.now() / 60_000);
  const key = (...parts) => ['adm', b.action, ...parts, minute].join('-');
  const syncSub = (s) => syncSubscription(s).catch(() => null);
  switch (b.action) {
    case 'refund': {
      if (!ID('ch|py').test(b.chargeId || '')) throw fail('Unknown payment.');
      const ch = await stripe.charges.retrieve(b.chargeId);
      const left = ch.amount - ch.amount_refunded;
      if (left <= 0) throw fail('This payment is already fully refunded.');
      const amount = b.amount == null || b.amount === '' ? left : Math.round(Number(b.amount));
      if (!Number.isInteger(amount) || amount < 1 || amount > left) throw fail(`Pick an amount between 0.01 and ${(left / 100).toFixed(2)}.`);
      const r = await stripe.refunds.create({ charge: ch.id, amount, reason: STRIPE_REASONS.includes(b.stripeReason) ? b.stripeReason : 'requested_by_customer', metadata: meta }, { idempotencyKey: key(ch.id, amount) });
      // a full refund ends Premium through the webhook; a partial one only if asked
      if (amount < left && b.endPremium && ch.customer) {
        const subs = await stripe.subscriptions.list({ customer: idOf(ch.customer), status: 'all', limit: 10 });
        for (const s of subs.data) if (ACTIVE.includes(s.status)) await syncSub(await stripe.subscriptions.cancel(s.id, {}, { idempotencyKey: key('cancel', s.id) }));
      }
      return { target: ch.id, amount, currency: ch.currency, detail: `${r.id} ${r.status}${amount < left ? ' (partial)' : ''}` };
    }
    case 'subCancel': case 'subResume': case 'subPause': case 'subUnpause': case 'subChangePackage': case 'subExtendTrial': {
      if (!ID('sub').test(b.subId || '')) throw fail('Unknown subscription.');
      let s;
      if (b.action === 'subCancel') s = b.now ? await stripe.subscriptions.cancel(b.subId, {}, { idempotencyKey: key(b.subId, 'now') }) : await stripe.subscriptions.update(b.subId, { cancel_at_period_end: true });
      if (b.action === 'subResume') s = await stripe.subscriptions.update(b.subId, { cancel_at_period_end: false });
      // pause = stop charging, they keep Premium for free until unpaused
      if (b.action === 'subPause') s = await stripe.subscriptions.update(b.subId, { pause_collection: { behavior: 'void' } });
      if (b.action === 'subUnpause') s = await stripe.subscriptions.update(b.subId, { pause_collection: '' });
      if (b.action === 'subChangePackage') {
        const plan = await getPlan();
        const pkg = plan.packages.find((k) => k.id === String(b.packageId || '') && k.priceId);
        if (!pkg) throw fail('Pick a package that’s saved in Stripe.');
        const cur = await stripe.subscriptions.retrieve(b.subId);
        const item = cur.items.data[0];
        s = await stripe.subscriptions.update(b.subId, { items: [{ id: item.id, price: pkg.priceId }], proration_behavior: b.prorate ? 'create_prorations' : 'none', metadata: { ...cur.metadata, package: pkg.id } });
      }
      if (b.action === 'subExtendTrial') {
        const days = Math.round(Number(b.days));
        if (!(days >= 1 && days <= 90)) throw fail('Pick 1 to 90 free days.');
        s = await stripe.subscriptions.update(b.subId, { trial_end: Math.floor(Date.now() / 1000) + days * 86400, proration_behavior: 'none' });
      }
      await syncSub(s);
      return { target: b.subId, detail: `${s.status}${s.cancel_at_period_end ? ', cancels at period end' : ''}${s.pause_collection ? ', paused' : ''}${b.packageId ? ', package ' + b.packageId : ''}${b.days ? `, +${b.days} free days` : ''}` };
    }
    case 'invoiceRetry': case 'invoiceVoid': {
      if (!ID('in').test(b.invoiceId || '')) throw fail('Unknown invoice.');
      const i = b.action === 'invoiceRetry' ? await stripe.invoices.pay(b.invoiceId, {}, { idempotencyKey: key(b.invoiceId) }) : await stripe.invoices.voidInvoice(b.invoiceId);
      if (i.parent && i.parent.subscription_details && i.parent.subscription_details.subscription) await syncSub(await stripe.subscriptions.retrieve(String(i.parent.subscription_details.subscription)));
      return { target: i.id, amount: i.amount_paid || i.amount_due, currency: i.currency, detail: i.status };
    }
    case 'disputeEvidence': case 'disputeAccept': {
      if (!ID('dp|du').test(b.disputeId || '')) throw fail('Unknown dispute.');
      if (b.action === 'disputeAccept') {
        const d = await stripe.disputes.close(b.disputeId);
        return { target: d.id, amount: d.amount, currency: d.currency, detail: 'accepted (lost)' };
      }
      const ev = {};
      for (const k of EVIDENCE) if (typeof (b.evidence || {})[k] === 'string' && b.evidence[k].trim()) ev[k] = b.evidence[k].trim().slice(0, 4000);
      const d = await stripe.disputes.update(b.disputeId, { evidence: ev, submit: !!b.submit, metadata: meta });
      return { target: d.id, amount: d.amount, currency: d.currency, detail: b.submit ? 'evidence submitted' : 'evidence saved as draft' };
    }
    case 'block': {
      const kind = b.kind === 'card' ? 'card' : b.kind === 'email' ? 'email' : '';
      if (!kind) throw fail('Pick what to block.');
      let value = String(b.value || '').trim();
      if (kind === 'email') { value = value.toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(value)) throw fail('That isn’t an email address.'); }
      if (kind === 'card') {
        if (ID('ch|py').test(value)) { const ch = await stripe.charges.retrieve(value); value = (ch.payment_method_details && ch.payment_method_details.card && ch.payment_method_details.card.fingerprint) || ''; }
        if (!/^[A-Za-z0-9]{8,40}$/.test(value)) throw fail('Block a card from one of its payments.');
      }
      const vl = await blockList(stripe, kind);
      const item = await stripe.radar.valueListItems.create({ value_list: vl.id, value });
      return { target: `${kind}:${kind === 'email' ? value : value.slice(0, 6) + '…'}`, detail: item.id };
    }
    case 'unblock': {
      if (!ID('rsli').test(b.itemId || '')) throw fail('Unknown block.');
      await stripe.radar.valueListItems.del(b.itemId);
      return { target: b.itemId, detail: 'unblocked' };
    }
    case 'clearFlag': {
      if (!UID_RE.test(b.uid || '')) throw fail('Unknown user.');
      if (!(await fsGet('billingFlags/' + b.uid).catch(() => null))) throw fail('No flag for this account.');
      await fsSet('billingFlags/' + b.uid, { open: false, clearedBy: by, clearedAt: Date.now() }, { merge: true });
      return { target: 'uid:' + b.uid, detail: 'may buy again' };
    }
    case 'resync': {
      if (!UID_RE.test(b.uid || '')) throw fail('Unknown user.');
      const p = await refreshFromStripe(b.uid);
      return { target: 'uid:' + b.uid, detail: p ? `active=${!!p.active}` : 'no subscription' };
    }
    default: throw fail('Unknown action.');
  }
}
const fail = (friendlyText) => Object.assign(new Error(friendlyText), { friendlyText });

export async function POST(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  if (!getSecrets().secretKey) return bad('Add STRIPE_SECRET_KEY in Vercel first (see the set-up guide).', 503);
  let b;
  try { b = JSON.parse((await req.text()).slice(0, 40_000) || '{}'); } catch { return bad('Bad request.'); }
  const reason = String(b.reason || '').replace(/\s+/g, ' ').trim();
  if (reason.length < 3 || reason.length > 200) return bad('Write a short reason (3–200 characters). It goes in the audit log.');
  try {
    const r = await act(getStripe(), b, g.uid);
    await audit({ by: g.uid, action: b.action, reason, ok: true, ...r });
    return Response.json({ ok: true, ...r }, { headers: h });
  } catch (e) {
    const msg = e.friendlyText || friendly(e);
    await audit({ by: g.uid, action: String(b.action || ''), target: String(b.chargeId || b.subId || b.invoiceId || b.disputeId || b.itemId || b.uid || b.value || '').slice(0, 80), reason, ok: false, error: msg });
    if (!e.friendlyText) console.error('admin stripe action failed:', b.action, e && e.message);
    return bad(msg, e.friendlyText ? 400 : 502);
  }
}
