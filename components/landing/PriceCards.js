import { buyable, money } from '../../lib/premium';

// The plan cards (free + each Premium package), shared by /pricing and the home page.
// `plan` = getPlan() from lib/billing (config/premium). Before Premium is switched on, the planned
// packages still show, marked "Launching soon".
const FREE = ['Every pet, animal and character', 'Friends, messages, pokes and hugs', 'Groups and the Tea Room', 'Listen Together music rooms (up to 10 friends)', 'All mini games and points', 'Deadlines and shared reminders', 'No ads, ever'];
const EVERY = { year: 'year', month: 'month', week: 'week' };

export function planView(plan) {
  const onSale = plan.enabled ? buyable(plan) : [];
  const shown = onSale.length ? onSale : plan.packages.filter((k) => k.active);
  return { shown, live: onSale.length > 0, feats: (plan.features || []).filter((f) => f.on !== false) };
}

export default function PriceCards({ plan, freeCta = '/#download', buyCta = '/app?tab=premium' }) {
  const { shown, live, feats } = planView(plan);
  return (
    <div className="lp-price-grid">
      <div className="lp-price">
        <h3>Nibble</h3>
        <div className="lp-amt">Free <small>forever</small></div>
        <ul>{FREE.map((t) => <li key={t}>{t}</li>)}</ul>
        <a className="lp-btn sm" href={freeCta}>Download Nibble</a>
      </div>
      {shown.map((k) => (
        <div key={k.id} className={'lp-price' + (k.id === plan.defaultPackage ? ' hi' : '')}>
          {k.highlight && <span className="lp-tag">{k.highlight}</span>}
          <h3>{plan.name} · {k.name}</h3>
          <div className="lp-amt">{money(k.amount, k.currency)} <small>/ {EVERY[k.interval] || k.interval}</small></div>
          {k.trialDays > 0 && <p className="lp-fine">{k.trialDays}-day free trial for first-time members (a card is needed; cancel before it ends and you pay nothing).</p>}
          <ul>
            <li>Everything in the free version</li>
            {feats.map((f) => <li key={f.id}>{f.icon} {f.title}{f.desc ? `: ${f.desc}` : ''}</li>)}
          </ul>
          {live ? <a className="lp-btn sm" href={buyCta}>Get Premium in the app</a> : <span className="lp-soon">Launching soon</span>}
        </div>
      ))}
    </div>
  );
}
