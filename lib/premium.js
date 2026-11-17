// Nibble Premium: the plan shape shared by the app, the admin page and the server.
// Built-in features change how the app works ("key" below); "custom" ones are only listed.

export const BUILTIN = {
  badge: { icon: '⭐', title: 'Premium badge', desc: 'A gold star next to your name for your friends.' },
  bonus: { icon: '🎁', title: 'Double daily bonus', desc: 'Twice the daily ⭐ points, every day.' },
  rooms: { icon: '🎧', title: 'Bigger music rooms', desc: 'Listen together with up to 20 friends instead of 10.' },
};
export const ROOM_MAX_FREE = 10, ROOM_MAX_PREMIUM = 20;
export const CURRENCIES = ['usd', 'eur', 'gbp', 'lkr', 'inr', 'aud', 'cad', 'sgd'];
export const INTERVALS = ['year', 'month'];

export const DEFAULT_PLAN = {
  enabled: false,
  name: 'Nibble Premium',
  amount: 500, // smallest currency unit (cents)
  currency: 'usd',
  interval: 'year',
  priceId: '', productId: '',
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
export function cleanPlan(p) {
  const d = DEFAULT_PLAN, x = p && typeof p === 'object' ? p : {};
  const amount = Number.isInteger(x.amount) && x.amount >= 50 && x.amount <= 100_000_00 ? x.amount : d.amount;
  return {
    enabled: x.enabled === true,
    name: s(x.name, 40) || d.name,
    amount,
    currency: CURRENCIES.includes(x.currency) ? x.currency : d.currency,
    interval: INTERVALS.includes(x.interval) ? x.interval : d.interval,
    priceId: /^price_\w+$/.test(x.priceId || '') ? x.priceId : '',
    productId: /^prod_\w+$/.test(x.productId || '') ? x.productId : '',
    features: (Array.isArray(x.features) ? x.features : d.features).slice(0, 12).map(cleanFeature),
  };
}

export const priceLabel = (p) => {
  const n = (p.amount || 0) / 100;
  let money;
  try { money = new Intl.NumberFormat('en', { style: 'currency', currency: (p.currency || 'usd').toUpperCase(), minimumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
  catch { money = n + ' ' + String(p.currency || '').toUpperCase(); }
  return `${money} / ${p.interval === 'month' ? 'month' : 'year'}`;
};

// premium/{uid} doc → is it on right now
export const premiumActive = (doc, now = Date.now()) => !!(doc && doc.active === true && Number(doc.until) > now);
// is a built-in perk switched on in the plan
export const perkOn = (plan, key) => !!(plan && plan.enabled && (plan.features || []).some((f) => f.key === key && f.on !== false));
