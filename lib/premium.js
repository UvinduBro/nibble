// Nibble Premium: the plan shape shared by the app, the admin page and the server.
// Built-in features change how the app works ("key" below); "custom" ones are only listed.

export const BUILTIN = {
  badge: { icon: '⭐', title: 'Premium badge', desc: 'A gold star next to your name for your friends.' },
  bonus: { icon: '🎁', title: 'Double daily bonus', desc: 'Twice the daily ⭐ points, every day.' },
  rooms: { icon: '🎧', title: 'Bigger music rooms', desc: 'Listen together with up to 20 friends instead of 10.' },
};
export const ROOM_MAX_FREE = 10, ROOM_MAX_PREMIUM = 20;
export const CURRENCIES = ['usd', 'eur', 'gbp', 'lkr', 'inr', 'aud', 'cad', 'sgd'];
export const INTERVALS = ['year', 'month', 'week'];
export const MAX_PACKAGES = 6;

// A package = one way to pay (e.g. yearly $5, monthly $0.99). Each has its own Stripe price,
// created by the server when an admin saves it (Stripe prices can't change, so a new amount
// means a new price; the old one is archived and existing subscribers keep theirs).
export const DEFAULT_PACKAGE = { id: 'yearly', name: 'Yearly', amount: 500, currency: 'usd', interval: 'year', trialDays: 0, highlight: 'Best value', active: true, priceId: '' };

export const DEFAULT_PLAN = {
  enabled: false,
  name: 'Nibble Premium',
  productId: '',
  promoCodes: true, // show "Add promotion code" on the Stripe checkout page
  defaultPackage: 'yearly',
  packages: [DEFAULT_PACKAGE],
  features: [
    { id: 'badge', key: 'badge', ...BUILTIN.badge, on: true },
    { id: 'bonus', key: 'bonus', ...BUILTIN.bonus, on: true },
    { id: 'rooms', key: 'rooms', ...BUILTIN.rooms, on: true },
    { id: 'support', key: 'custom', icon: '💖', title: 'Keep Nibble free', desc: 'Help keep Nibble free and ad-free for everyone.', on: true },
  ],
};

const s = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, n);
export function cleanFeature(f, i = 0) {
  const key = BUILTIN[f && f.key] ? f.key : 'custom';
  return {
    id: s(f && f.id, 24).replace(/[^\w-]/g, '') || key + '-' + i,
    key, icon: s(f && f.icon, 4) || '✨', title: s(f && f.title, 40) || (BUILTIN[key] ? BUILTIN[key].title : 'Feature'),
    desc: s(f && f.desc, 140), on: !(f && f.on === false),
  };
}
export function cleanPackage(k, i = 0) {
  const x = k && typeof k === 'object' ? k : {};
  const amount = Number.isInteger(x.amount) && x.amount >= 50 && x.amount <= 10_000_000 ? x.amount : DEFAULT_PACKAGE.amount;
  return {
    id: s(x.id, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'pkg' + i,
    name: s(x.name, 30) || 'Premium',
    amount,
    currency: CURRENCIES.includes(x.currency) ? x.currency : 'usd',
    interval: INTERVALS.includes(x.interval) ? x.interval : 'year',
    trialDays: Number.isInteger(x.trialDays) && x.trialDays >= 0 && x.trialDays <= 90 ? x.trialDays : 0,
    highlight: s(x.highlight, 20),
    active: x.active !== false,
    priceId: /^price_\w+$/.test(x.priceId || '') ? x.priceId : '',
  };
}
export function cleanPlan(p) {
  const d = DEFAULT_PLAN, x = p && typeof p === 'object' ? p : {};
  // older saved plans had one price at the top level: turn it into a "Yearly"/"Monthly" package
  const legacy = !Array.isArray(x.packages) && (x.amount || x.priceId)
    ? [{ ...DEFAULT_PACKAGE, id: x.interval === 'month' ? 'monthly' : 'yearly', name: x.interval === 'month' ? 'Monthly' : 'Yearly', amount: x.amount, currency: x.currency, interval: x.interval, priceId: x.priceId }]
    : null;
  const seen = new Set();
  const packages = (legacy || (Array.isArray(x.packages) ? x.packages : d.packages)).slice(0, MAX_PACKAGES).map(cleanPackage)
    .filter((k) => (seen.has(k.id) ? false : seen.add(k.id)));
  const live = packages.filter((k) => k.active && k.priceId);
  return {
    enabled: x.enabled === true,
    name: s(x.name, 40) || d.name,
    productId: /^prod_\w+$/.test(x.productId || '') ? x.productId : '',
    promoCodes: x.promoCodes !== false,
    defaultPackage: packages.some((k) => k.id === x.defaultPackage) ? x.defaultPackage : (packages[0] ? packages[0].id : ''),
    packages,
    features: (Array.isArray(x.features) ? x.features : d.features).slice(0, 12).map(cleanFeature),
    ready: live.length > 0, // at least one package people can buy
  };
}
// packages people can buy right now (active + in Stripe), default first
export const buyable = (plan) => {
  const list = ((plan && plan.packages) || []).filter((k) => k.active && k.priceId);
  return list.sort((a, b) => (b.id === plan.defaultPackage) - (a.id === plan.defaultPackage));
};

const PER = { year: 'year', month: 'month', week: 'week' };
export const money = (amount, currency) => {
  const n = (amount || 0) / 100;
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: (currency || 'usd').toUpperCase(), minimumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
  catch { return n + ' ' + String(currency || '').toUpperCase(); }
};
// "$5 / year" for a package (or the plan's default package)
export const priceLabel = (p) => {
  const k = p && p.packages ? (buyable(p)[0] || p.packages[0]) : p;
  if (!k) return '';
  return `${money(k.amount, k.currency)} / ${PER[k.interval] || 'year'}`;
};

// premium/{uid} doc → is it on right now
export const premiumActive = (doc, now = Date.now()) => !!(doc && doc.active === true && Number(doc.until) > now);
// is a built-in perk switched on in the plan
export const perkOn = (plan, key) => !!(plan && plan.enabled && (plan.features || []).some((f) => f.key === key && f.on !== false));
