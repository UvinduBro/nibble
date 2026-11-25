// Team alerts: a short branded email to hello@meetnibble.com when something worth celebrating happens
// (a new member, a Premium purchase, a Premium renewal). Server only.
//
// - Sent through lib/mail.js (Resend, falls back to SMTP). Each alert is claimed once in teamAlerts/{id}
//   (server-only collection, no client rule = no client access), so Stripe retries or a double click never
//   send it twice.
// - An alert must never break what triggered it: every failure is logged and swallowed.
// - Always sent to hello@meetnibble.com (no settings needed).
import { sendMail, anyMail, addressOf, mailFrom, oneLine } from './mail';
import { teamAlertEmail } from './emailTemplates';
import { fsCreate, fsDelete, fsCount, fsGet } from './gcp';
import { money } from './premium';
import { SOURCES, USES, countryName, flag } from './signup';

const SITE = 'https://meetnibble.com';
const ID_RE = /^[A-Za-z0-9_-]{4,120}$/;
export const TEAM_INBOX = 'hello@meetnibble.com';
export const alertsOn = () => anyMail();

const when = (ms = Date.now()) => new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }) + ' (Sri Lanka)';
const day = (ms) => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium' });
const place = (code, city) => (code ? `${flag(code)} ${[city, countryName(code)].filter(Boolean).join(', ')}` : '');
const sourceLabel = (k, other) => (k === 'other' && other ? '✏️ ' + other : (SOURCES.find(([x]) => x === k) || [, ''])[1]);
const usesLabel = (list) => (list || []).map((u) => (USES.find(([x]) => x === u) || [, ''])[1]).filter(Boolean).join(', ');
const PROVIDER = { 'google.com': 'Google', 'apple.com': 'Apple', password: 'Email + password' };
const per = (interval) => (interval ? ' / ' + interval : '');
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// claim → render → send. If the send fails the claim is removed, so a retry (Stripe) can try again.
async function deliver(id, alert) {
  if (!alertsOn() || !ID_RE.test(id)) return { sent: false, reason: 'off' };
  try {
    if (!(await fsCreate('teamAlerts/' + id, { at: Date.now(), kind: alert.kind }))) return { sent: false, reason: 'duplicate' };
  } catch (e) { console.error('team alert claim failed:', e && e.message); return { sent: false, reason: 'claim' }; }
  try {
    const html = teamAlertEmail(alert);
    const text = [alert.headline, alert.sub, alert.big ? `${alert.big}${alert.bigLabel ? ' (' + alert.bigLabel + ')' : ''}` : '', '',
      ...(alert.rows || []).filter((r) => r[1]).map(([k, v]) => `${k}: ${v}`), '',
      ...(alert.buttons || []).map(([t, u]) => `${t}: ${u}`)].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    const r = await sendMail({
      from: 'Nibble alerts <' + addressOf(mailFrom()) + '>',
      to: [TEAM_INBOX], subject: oneLine(alert.subject).slice(0, 160), text, html,
      ...(alert.replyTo ? { replyTo: alert.replyTo } : {}),
      tags: [{ name: 'type', value: 'alert_' + alert.kind }],
    });
    if (!r.sent) throw new Error(r.reason || 'not sent');
    return r;
  } catch (e) {
    console.error('team alert failed:', alert.kind, e && e.message);
    await fsDelete('teamAlerts/' + id).catch(() => {});
    return { sent: false, reason: 'send' };
  }
}

// ---------- 🎉 new member ----------
// acct = accountOf(token); profile = users/{uid}; answers = cleanSignup(...) from the sign-up form
export async function alertJoined({ acct, profile, answers = {}, ip = {}, client = '' }) {
  const total = await fsCount('users').catch(() => 0);
  const name = profile.username ? '@' + profile.username : 'Someone';
  const src = sourceLabel(answers.source, answers.sourceOther);
  return deliver('joined_' + acct.uid, {
    kind: 'joined',
    subject: `🎉 ${name} just joined Nibble${total ? ` · member #${total}` : ''}`,
    preview: [src && 'Found us via ' + src.replace(/^\S+\s/, ''), answers.country && countryName(answers.country)].filter(Boolean).join(' · ') || 'A new member signed up.',
    badge: '🎉  NEW MEMBER',
    headline: `${name} just joined Nibble`,
    sub: profile.petName ? `Their first pet is called ${profile.petName}.` : '',
    big: total ? ordinal(total) : '',
    bigLabel: total ? 'member so far' : '',
    rows: [
      ['Username', name],
      ['Name', acct.name],
      ['Email', acct.rawEmail + (acct.rawEmail && !acct.emailVerified ? ' (not verified yet)' : '')],
      ['Signed in with', PROVIDER[acct.provider] || acct.provider],
      ['Found Nibble via', src],
      ['Country', answers.country ? `${flag(answers.country)} ${countryName(answers.country)}` : ''],
      ['Connecting from', place(ip.country, ip.city)],
      ['Wants it for', usesLabel(answers.uses)],
      ['Joined on', { web: 'Website', desktop: 'Desktop app', mobile: 'Phone app' }[client] || ''],
      ['When', when(acct.createdAt || Date.now())],
    ],
    buttons: [['Open Users', SITE + '/admin'], ['Say hi by email', acct.rawEmail ? 'mailto:' + acct.rawEmail : '']],
    note: 'Hit Reply to write to them directly.',
    replyTo: acct.emailVerified ? acct.rawEmail : '',
  });
}

// ---------- 💎 Premium bought (checkout.session.completed) ----------
// session = the Checkout Session from the event; sub = the subscription, fetched from Stripe
export async function alertPremium({ session: o, sub, uid }) {
  const m = o.metadata || {};
  const user = await fsGet('users/' + uid).catch(() => null);
  const name = '@' + ((user && user.username) || m.nb_username || 'someone');
  const cur = o.currency || m.nb_currency;
  const interval = (sub && sub.items && sub.items.data[0] && sub.items.data[0].price.recurring && sub.items.data[0].price.recurring.interval) || m.nb_interval || '';
  const trial = sub && sub.status === 'trialing' && sub.trial_end;
  const paid = o.amount_total || 0;
  const discount = (o.total_details && o.total_details.amount_discount) || 0;
  const list = Number(m.nb_amount) || 0;
  const members = await fsCount('premium', [['active', '==', true]]).catch(() => 0);
  const d = o.customer_details || {};
  const test = !o.livemode;
  const dash = `https://dashboard.stripe.com/${test ? 'test/' : ''}`;
  return deliver('premium_' + o.id, {
    kind: 'premium', test,
    subject: `${test ? '[TEST] ' : ''}💎 ${name} ${trial ? 'started a Premium trial' : `bought Premium · ${money(paid, cur)}`}`,
    preview: trial ? `Free until ${day(trial * 1000)}, then ${money(list, cur)}${per(interval)}.` : `${money(paid, cur)}${per(interval)} · ${cap(m.nb_package) || 'Premium'}`,
    badge: trial ? '✨  NEW TRIAL' : '💎  NEW PREMIUM',
    headline: trial ? `${name} started a Premium trial` : `${name} bought Premium`,
    sub: trial ? `Their first payment of ${money(list, cur)} is due on ${day(trial * 1000)}.` : members > 1 ? `That makes ${members} Premium members.` : members === 1 ? 'Your first Premium member! 🥳' : '',
    big: trial ? 'Free trial' : money(paid, cur) + per(interval),
    bigLabel: trial ? `then ${money(list, cur)}${per(interval)}` : discount ? `after ${money(discount, cur)} off` : 'paid today',
    rows: [
      ['Username', name],
      ['Email', d.email || ''],
      ['Package', cap(m.nb_package)],
      ['Price', list ? money(list, cur) + per(interval) : ''],
      ['Discount', discount ? '−' + money(discount, cur) : ''],
      ['Billing country', place(d.address && d.address.country)],
      ['Connecting from', place(m.nb_ip_country, m.nb_ip_city)],
      ['Account age', m.nb_acct_age_days !== undefined && m.nb_acct_age_days !== '' ? m.nb_acct_age_days + ' days' : ''],
      ['Risk notes', m.nb_risk_flags && m.nb_risk_flags !== 'none' ? m.nb_risk_flags : ''],
      ['Renews', sub && sub.items && sub.items.data[0] && sub.items.data[0].current_period_end ? day(sub.items.data[0].current_period_end * 1000) : ''],
      ['When', when((o.created || 0) * 1000 || Date.now())],
    ],
    buttons: [['Open in admin', SITE + '/admin'], ['Stripe customer', o.customer ? dash + 'customers/' + (typeof o.customer === 'object' ? o.customer.id : o.customer) : ''], ['Subscription', sub ? dash + 'subscriptions/' + sub.id : '']],
    note: test ? 'This was a test-mode payment: no real money moved.' : 'Payments arrive in Stripe; payouts follow your Stripe schedule.',
  });
}

// ---------- 🔁 Premium renewed (invoice.paid for a renewal, incl. the first charge after a trial) ----------
export async function alertRenewal({ invoice: inv, sub, uid }) {
  if (!(inv.amount_paid > 0)) return { sent: false, reason: 'free' };
  const user = await fsGet('users/' + uid).catch(() => null);
  const m = (sub && sub.metadata) || {};
  const name = '@' + ((user && user.username) || m.nb_username || 'someone');
  const interval = (sub && sub.items && sub.items.data[0] && sub.items.data[0].price.recurring && sub.items.data[0].price.recurring.interval) || '';
  const afterTrial = sub && sub.trial_end && Math.abs(sub.trial_end - (inv.period_start || inv.created || 0)) < 3 * 86400;
  const test = !inv.livemode;
  const dash = `https://dashboard.stripe.com/${test ? 'test/' : ''}`;
  return deliver('renewal_' + inv.id, {
    kind: 'renewal', test,
    subject: `${test ? '[TEST] ' : ''}🔁 ${name} ${afterTrial ? 'stayed after the trial' : 'renewed Premium'} · ${money(inv.amount_paid, inv.currency)}`,
    preview: `${money(inv.amount_paid, inv.currency)}${per(interval)} · ${cap(m.package) || 'Premium'}`,
    badge: afterTrial ? '✨  TRIAL → PAID' : '🔁  RENEWAL',
    headline: afterTrial ? `${name} kept Premium after the trial` : `${name} renewed Premium`,
    big: money(inv.amount_paid, inv.currency) + per(interval),
    bigLabel: 'paid',
    rows: [
      ['Username', name],
      ['Email', inv.customer_email || ''],
      ['Package', cap(m.package)],
      ['Next renewal', sub && sub.items && sub.items.data[0] && sub.items.data[0].current_period_end ? day(sub.items.data[0].current_period_end * 1000) : ''],
      ['When', when((inv.created || 0) * 1000 || Date.now())],
    ],
    buttons: [['Open in admin', SITE + '/admin'], ['Invoice', dash + 'invoices/' + inv.id]],
    note: test ? 'This was a test-mode payment: no real money moved.' : '',
  });
}
