// Nibble Premium: checks before a Stripe checkout link is made, and the fraud-prevention metadata we
// attach to it. Server only.
//
// Stripe's hosted Checkout already sees the buyer's IP, device and card for Radar. What it can't see is
// the Nibble account behind the payment, so we add that: account age, sign-in method, self-reported
// country vs. the country the request came from, a hashed network id, how often they've tried, etc.
// Never put a raw IP address or the full email in metadata (the email is on the Stripe customer already).
import { createHmac } from 'node:crypto';
import MailChecker from 'mailchecker';
import { fsGet } from './gcp';
import { EMAIL } from './facts';

// domains MailChecker's list may miss (temp-mail sites change names often); add more here
const EXTRA_BLOCKED = [
  'tempmail.plus', 'mailto.plus', 'temp-mail.io', 'fexpost.com', 'fexbox.org', 'mail.tm', 'dropmail.me',
  'mailnesia.com', 'tmpmail.org', 'tmpmail.net', 'byom.de', 'emailnax.com',
];
let blocked = null;
function blockSet() {
  if (!blocked) {
    blocked = new Set(EXTRA_BLOCKED);
    try { for (const d of MailChecker.blacklist()) blocked.add(String(d).toLowerCase()); } catch {}
  }
  return blocked;
}
export const emailDomain = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';
// true for throwaway / temp-mail addresses, including their subdomains (x.mailinator.com)
export function isDisposable(email) {
  const e = String(email || '').trim().toLowerCase();
  const d = emailDomain(e);
  if (!d || !d.includes('.')) return true;
  const set = blockSet();
  const parts = d.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (set.has(parts.slice(i).join('.'))) return true;
  try { if (!MailChecker.isValid(e)) return true; } catch {}
  return false;
}

const fail = (friendly, status = 403) => Object.assign(new Error(friendly), { friendly, status });

// → { banned, flag } or throws a friendly error. 2 doc reads.
export async function preCheck(me) {
  if (!me.emailVerified || !me.email) throw fail('Verify your email address first (check your inbox for the link from Nibble), then try again.');
  if (isDisposable(me.email)) throw fail(`Payments need a regular email address, not a temporary one. Write to ${EMAIL} if this is a mistake.`);
  const [banned, flag] = await Promise.all([
    fsGet('banned/' + me.uid).catch(() => null),
    fsGet('billingFlags/' + me.uid).catch(() => null),
  ]);
  if (banned) throw fail('This account can’t buy Premium right now.');
  if (flag && flag.open) throw fail(`This account can’t buy Premium right now. Write to ${EMAIL} and we’ll take a look.`);
  return { flag };
}

// ---------- request facts the server can see ----------
export function clientIp(req) {
  const h = req.headers;
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
}
// the same one-way network id as /api/netid (IPv6 → its /64), so payments from one network line up
function netPrefix(ip) {
  if (!ip) return '';
  if (ip.includes(':') && !/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split('%')[0].split(':');
    const i = parts.indexOf('');
    const full = i >= 0 ? [...parts.slice(0, i), ...Array(Math.max(0, 8 - parts.filter(Boolean).length)).fill('0'), ...parts.slice(i + 1).filter(Boolean)] : parts;
    return 'v6:' + full.slice(0, 4).map((x) => (x || '0').toLowerCase()).join(':');
  }
  return 'v4:' + ip.replace(/^::ffff:/, '');
}
export function ipHash(ip) {
  const salt = process.env.NET_SALT || (process.env.VERCEL_ENV === 'production' ? '' : 'nibble-lan-dev');
  const p = netPrefix(ip);
  return salt && p ? createHmac('sha256', salt).update(p).digest('hex').slice(0, 24) : '';
}
const decode = (v) => { try { return decodeURIComponent(v || ''); } catch { return String(v || ''); } };

// what the browser says about itself (untrusted: only used as extra context, always prefixed c_)
export function cleanClient(c) {
  const o = c && typeof c === 'object' ? c : {};
  const w = (v, n, re = /[^\w .:/+-]/g) => String(v == null ? '' : v).replace(re, '').slice(0, n);
  return {
    client: o.client === 'desktop' ? 'desktop' : 'web',
    ver: w(o.ver, 16, /[^\w.-]/g),
    tz: w(o.tz, 40, /[^\w/+-]/g),
    lang: w(o.lang, 24, /[^\w,-]/g),
    screen: w(o.screen, 16, /[^\dx@.]/g),
  };
}

// ---------- Stripe metadata (max 50 keys, key ≤ 40 chars, value ≤ 500 chars, strings only) ----------
export function limitMeta(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Object.keys(out).length >= 50) break;
    if (v === undefined || v === null || v === '') continue;
    out[String(k).slice(0, 40)] = String(v).replace(/[\r\n]+/g, ' ').slice(0, 500);
  }
  return out;
}

const DAY = 86400_000;
// the full set for the checkout session (and refreshed on the Stripe customer, where Radar rules can read
// them as ::customer:nb_…::). `history` = { recent: [times], hadPremium, flag }.
export function riskMetadata({ me, req, profile, signup, wallet, pkg, trialDays, promoCodes, client, history }) {
  const h = req.headers;
  const ipCountry = (h.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2);
  const signupCountry = String((signup && signup.country) || '').toUpperCase().slice(0, 2);
  const created = me.createdAt || 0;
  const c = cleanClient(client);
  const flags = [];
  if (ipCountry && signupCountry && ipCountry !== signupCountry) flags.push('country_mismatch');
  if (created && Date.now() - created < DAY) flags.push('new_account');
  if (history.recent.length >= 3) flags.push('many_checkouts');
  if (history.flag) flags.push('past_flag');
  return limitMeta({
    uid: me.uid, // kept without prefix: findCustomer + subscriptions look it up by this key
    nb_uid: me.uid,
    nb_username: profile && profile.username ? '@' + profile.username : '',
    nb_acct_created: created ? new Date(created).toISOString() : '',
    nb_acct_age_days: created ? Math.floor((Date.now() - created) / DAY) : '',
    nb_auth_provider: me.provider,
    nb_email_verified: me.emailVerified ? 'true' : 'false',
    nb_email_domain: emailDomain(me.email),
    nb_disposable_checked: 'true',
    nb_signup_country: signupCountry,
    nb_signup_source: (signup && signup.source) || '',
    nb_pts_total: wallet ? Math.floor(Number(wallet.total) || 0) : '',
    nb_streak: wallet ? Math.floor(Number(wallet.streak) || 0) : '',
    nb_had_premium: history.hadPremium ? 'true' : 'false',
    nb_trial_eligible: history.hadPremium ? 'false' : 'true',
    nb_checkouts_24h: history.recent.length,
    nb_prior_flags: history.flag ? String(history.flag.reason || 'yes') : 'none',
    nb_ip_country: ipCountry,
    nb_ip_region: decode(h.get('x-vercel-ip-country-region')).slice(0, 40),
    nb_ip_city: decode(h.get('x-vercel-ip-city')).slice(0, 60),
    nb_ip_hash: ipHash(clientIp(req)),
    nb_country_mismatch: ipCountry && signupCountry ? String(ipCountry !== signupCountry) : 'unknown',
    nb_risk_flags: flags.join(',') || 'none',
    nb_ua: (h.get('user-agent') || '').slice(0, 200),
    nb_accept_lang: (h.get('accept-language') || '').slice(0, 60),
    c_client: c.client,
    c_app_ver: c.ver,
    c_tz: c.tz,
    c_lang: c.lang,
    c_screen: c.screen,
    nb_package: pkg.id,
    nb_price_id: pkg.priceId,
    nb_amount: pkg.amount,
    nb_currency: pkg.currency,
    nb_interval: pkg.interval,
    nb_trial_days: trialDays,
    nb_promo_allowed: promoCodes ? 'true' : 'false',
    nb_env: process.env.VERCEL_ENV || 'development',
    nb_build: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 12),
    nb_host: (h.get('host') || '').slice(0, 60),
    nb_flow: 'checkout_v2',
  });
}

// the small, stable part that lives on the subscription (shown on every invoice/charge view in Stripe)
export const subMetadata = (meta) => limitMeta({
  uid: meta.uid, nb_uid: meta.nb_uid, nb_username: meta.nb_username, package: meta.nb_package,
  nb_acct_created: meta.nb_acct_created, nb_signup_country: meta.nb_signup_country, nb_ip_country: meta.nb_ip_country,
  nb_auth_provider: meta.nb_auth_provider, nb_flow: meta.nb_flow,
});
