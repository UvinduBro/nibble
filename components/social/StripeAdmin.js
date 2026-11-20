'use client';
// Admin → Money → Stripe: payments, people, subscriptions, invoices, disputes, fraud and payouts, without opening
// the Stripe dashboard. All data comes from /api/admin/stripe (server, restricted key). Every money action goes
// through one confirm sheet that asks for a reason and is saved to the audit log.
import { useEffect, useState } from 'react';
import { niceError } from '../../lib/social/social';
import { money } from '../../lib/premium';
import { REFUND_DAYS } from '../../lib/facts';

const COL = { mint: '#7ee8c6', yellow: '#ffd166', coral: '#ff7a7a', cyan: '#5ef2ff', slate: '#8a91b0', violet: '#a78bfa' };
const STATUS = { succeeded: COL.mint, paid: COL.mint, active: COL.mint, trialing: COL.cyan, open: COL.yellow, past_due: COL.yellow, pending: COL.yellow, in_transit: COL.cyan, failed: COL.coral, unpaid: COL.coral, uncollectible: COL.coral, needs_response: COL.coral, warning_needs_response: COL.coral, lost: COL.coral, won: COL.mint, canceled: COL.slate, void: COL.slate, done: COL.mint, processing: COL.yellow };
const RISK = { normal: COL.mint, elevated: COL.yellow, highest: COL.coral };
const TABS = [['overview', '📊 Overview'], ['payments', '💳 Payments'], ['subs', '🔁 Subscriptions'], ['invoices', '🧾 Invoices'], ['disputes', '⚖️ Disputes'], ['fraud', '🛡️ Fraud'], ['activity', '📜 Activity']];
const date = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const when = (t) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const daysLeft = (t) => Math.ceil((t - Date.now()) / 86400_000);
const words = (s) => String(s || '').replace(/_/g, ' ');
const Pill = ({ c, children }) => <span className="sx-pill" style={{ '--c': c || COL.slate }}>{children}</span>;
const St = ({ s }) => <Pill c={STATUS[s]}>{words(s)}</Pill>;

// load one view; `more()` fetches the next page and appends
function useView(social, view, opts, deps) {
  const [st, setSt] = useState({ loading: true });
  const load = (cursor) => {
    if (!cursor) setSt((x) => ({ ...x, loading: true, error: '' }));
    return social.admin.stripe(view, { ...opts, cursor })
      .then((d) => setSt((x) => (cursor ? { ...d, rows: [...(x.rows || []), ...(d.rows || [])], loading: false } : { ...d, loading: false })))
      .catch((e) => setSt({ loading: false, error: niceError(e) }));
  };
  useEffect(() => { load(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...st, reload: () => load(), more: () => st.next && load(st.next) };
}

function Section({ title, sub, right, error, children }) {
  return (
    <div className="sa-card">
      <h3>{title}{sub != null && <small>{sub}</small>}{right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{right}</span>}</h3>
      {error && <p className="sx-warn">⚠️ {error}</p>}
      {children}
    </div>
  );
}
const Empty = ({ children }) => <p className="sa-empty">{children}</p>;
const More = ({ v }) => (<>
  {v.hidden > 0 && <p className="ad-foot">Some rows from other products on this Stripe account are hidden (only Nibble accounts are shown).</p>}
  {v.next ? <button className="btn small ghost" style={{ marginTop: 10 }} onClick={v.more}>Load more</button> : null}
</>);
const Loading = ({ v }) => (v.loading && !v.rows ? <Empty>Loading from Stripe…</Empty> : v.error ? <p className="sx-warn">⚠️ {v.error}</p> : null);

export default function StripeAdmin({ social, state, users, toast, go, setOpenUid }) {
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // submitted search
  const [person, setPerson] = useState(null); // { id } or { q } → customer drawer
  const [dispute, setDispute] = useState('');
  const [sheet, setSheet] = useState(null);
  const [mode, setMode] = useState('');
  const [tick, setTick] = useState(0); // bump to reload lists after an action
  const nameOf = (uid) => ((users || []).find((u) => u.uid === uid) || {}).username || '';
  const who = (r) => (r.uid && nameOf(r.uid) ? '@' + nameOf(r.uid) : r.username ? '@' + r.username : r.email || r.customer || '—');
  const dash = `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}`;
  const plan = state.premiumPlan;
  const ctx = { social, toast, who, nameOf, dash, plan, tick, ask: setSheet, openPerson: (p) => setPerson(p), openUser: (uid) => { go('users'); setOpenUid(uid); }, openDispute: (id) => { setTab('disputes'); setDispute(id); }, setMode };
  const search = (e) => { e.preventDefault(); setQuery(q.trim()); if (tab === 'overview' || tab === 'disputes' || tab === 'fraud' || tab === 'activity') setTab('payments'); };

  return (
    <>
      <div className="sx-top">
        <form className="sx-search" onSubmit={search}>
          <input className="ad-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: @username, email, or a Stripe id (ch_, cus_, sub_, in_, dp_)" aria-label="Search Stripe" />
          <button className="btn small">Search</button>
          {query && <button type="button" className="btn small ghost" onClick={() => { setQ(''); setQuery(''); }}>Clear</button>}
          {q.trim() && <button type="button" className="btn small ghost" onClick={() => setPerson({ q: q.trim() })}>Open person</button>}
        </form>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode && <Pill c={mode === 'live' ? COL.mint : COL.yellow}>{mode === 'live' ? 'LIVE' : 'TEST mode'}</Pill>}
          <a className="btn small ghost" href={dash} target="_blank" rel="noreferrer">Open Stripe ↗</a>
        </span>
      </div>
      <div className="ad-seg sx-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {query && ['payments', 'subs', 'invoices'].includes(tab) && <p className="ad-foot">Showing results for <b>{query}</b>.</p>}

      {tab === 'overview' && <Overview {...ctx} setTab={setTab} />}
      {tab === 'payments' && <Payments {...ctx} query={query} />}
      {tab === 'subs' && <Subs {...ctx} query={query} />}
      {tab === 'invoices' && <Invoices {...ctx} query={query} />}
      {tab === 'disputes' && <Disputes {...ctx} open={dispute} setOpen={setDispute} />}
      {tab === 'fraud' && <Fraud {...ctx} />}
      {tab === 'activity' && <Activity {...ctx} />}

      {person && <Person {...ctx} who={person} onClose={() => setPerson(null)} />}
      {sheet && <Sheet {...ctx} sheet={sheet} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setTick((n) => n + 1); }} />}
    </>
  );
}

// ---------- overview ----------
function Spark({ days, currency }) {
  const vals = days.map(([, v]) => v), max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 300},${58 - (v / max) * 52}`).join(' ');
  return (
    <svg viewBox="0 0 300 60" className="sx-spark" role="img" aria-label={`Payments per day for the last 30 days, highest ${money(max, currency)}`}>
      <polyline points={`0,60 ${pts} 300,60`} fill="rgba(126,232,198,.12)" stroke="none" />
      <polyline points={pts} fill="none" stroke={COL.mint} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function Overview({ social, tick, setMode, setTab, openPerson, openDispute, nameOf }) {
  const v = useView(social, 'overview', {}, [tick]);
  useEffect(() => { if (v.mode) setMode(v.mode); }, [v.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  if (v.loading && !v.balance && !v.subs) return <Loading v={{ ...v, rows: null }} />;
  if (v.error) return <p className="sx-warn">⚠️ {v.error}</p>;
  const sec = v.sections || {};
  const bal = (list) => (list && list.length ? list.map((b) => money(b.amount, b.currency)).join(' + ') : '–');
  const m = v.money30, s = v.subs;
  const needs = v.needs || [];
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={bal(v.balance && v.balance.available)} label="Available" sub="ready to pay out" color={COL.mint} />
        <Kpi n={bal(v.balance && v.balance.pending)} label="Pending" sub="on its way to available" color={COL.cyan} />
        <Kpi n={m ? money(m.net, m.currency) : '–'} label="Net, 30 days" sub={m ? `${money(m.gross, m.currency)} in, ${money(m.fees, m.currency)} fees` : ''} color={COL.violet} />
        <Kpi n={s ? money(s.mrr, s.currency) : '–'} label="Monthly revenue" sub="MRR from paying members" color={COL.mint} />
        <Kpi n={s ? s.active + s.trialing : '–'} label="Members" sub={s ? `${s.trialing} on trial · +${s.new30} / −${s.cancelled30} in 30 days` : ''} color={COL.cyan} />
        <Kpi n={s ? s.pastDue : '–'} label="Payment problems" sub={s ? `${s.cancelling} cancelling` : ''} color={COL.yellow} />
      </div>
      {['balance', 'subs', 'money30'].filter((k) => sec[k]).map((k) => <p key={k} className="sx-warn">⚠️ {sec[k]}</p>)}
      {v.accountWide && <p className="ad-foot" style={{ marginTop: -6 }}>Balance, payouts and the 30-day money are for the whole Stripe account; members, MRR and “Needs you” are Nibble only.</p>}
      <div className="ad-grid2">
        <Section title="🙋 Needs you" sub={needs.length ? `${needs.length}` : 'all clear'}>
          {['disputes', 'fraud', 'invoices'].filter((k) => sec[k]).map((k) => <p key={k} className="sx-warn">⚠️ {sec[k]}</p>)}
          {!needs.length && <Empty>Nothing waiting. 🎉</Empty>}
          <ul className="sx-needs">
            {needs.map((n) => (
              <li key={n.kind + n.id}>
                {n.kind === 'dispute' && <><span>⚖️ Dispute {money(n.amount, n.currency)} · <b style={{ color: daysLeft(n.dueBy) <= 3 ? COL.coral : undefined }}>{n.dueBy ? `${daysLeft(n.dueBy)} days to answer` : 'answer soon'}</b></span><button className="btn small" onClick={() => openDispute(n.id)}>Answer</button></>}
                {n.kind === 'efw' && <><span>🚨 Fraud warning on {n.charge}</span><button className="btn small ghost" onClick={() => setTab('fraud')}>Look</button></>}
                {n.kind === 'invoice' && <><span>🧾 Failed renewal {money(n.amount, n.currency)} · {n.attempts} tries</span><button className="btn small ghost" onClick={() => openPerson({ q: n.id })}>Open</button></>}
                {n.kind === 'flag' && <><span>🚩 {nameOf(n.uid) ? '@' + nameOf(n.uid) : n.uid} is flagged ({words(n.reason)})</span><button className="btn small ghost" onClick={() => openPerson({ q: nameOf(n.uid) ? '@' + nameOf(n.uid) : n.uid })}>Open</button></>}
                {n.kind === 'webhook' && <><span>📬 Webhook failed: <code>{n.type}</code></span><button className="btn small ghost" onClick={() => setTab('activity')}>Log</button></>}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="📈 Last 30 days" sub={m ? `${money(m.gross, m.currency)} paid` : ''}>
          {m ? <>
            <Spark days={m.days} currency={m.currency} />
            <p className="ad-foot">Refunds {money(m.refunds, m.currency)} · disputes {money(m.disputes, m.currency)} · Stripe fees {money(m.fees, m.currency)} · net {money(m.net, m.currency)}</p>
          </> : <Empty>No data.</Empty>}
        </Section>
      </div>
      <Section title="🏦 Payouts to your bank" sub={v.payouts ? `last ${v.payouts.length}` : ''} error={sec.payouts}>
        {v.payouts && !v.payouts.length && <Empty>No payouts yet. Stripe pays out on its own schedule (set in Stripe → Settings → Payouts).</Empty>}
        {v.payouts && v.payouts.length > 0 && (
          <table className="sx-table"><thead><tr><th>Amount</th><th>Status</th><th>Arrives</th></tr></thead>
            <tbody>{v.payouts.map((p) => <tr key={p.id}><td data-l="Amount"><b>{money(p.amount, p.currency)}</b></td><td data-l="Status"><St s={p.status} /></td><td data-l="Arrives">{date(p.arrival)}</td></tr>)}</tbody>
          </table>
        )}
      </Section>
    </>
  );
}
function Kpi({ n, label, sub, color }) {
  return <div className="ad-kpi" style={{ '--k': color }}><b>{n}</b><span>{label}</span>{sub && <small>{sub}</small>}</div>;
}

// ---------- payments ----------
function ChargeRows({ rows, who, dash, ask, openPerson, compact }) {
  return (
    <table className="sx-table">
      <thead><tr><th>Payment</th>{!compact && <th>Who</th>}<th>Card</th><th>Risk</th><th>When</th><th /></tr></thead>
      <tbody>{rows.map((c) => {
        const left = c.amount - c.refunded;
        return (
          <tr key={c.id}>
            <td data-l="Payment"><b>{money(c.amount, c.currency)}</b> <St s={c.fullyRefunded ? 'refunded' : c.status} />{c.refunded > 0 && !c.fullyRefunded && <small> · {money(c.refunded, c.currency)} refunded</small>}{c.disputed && <Pill c={COL.coral}>disputed</Pill>}</td>
            {!compact && <td data-l="Who">{c.customer ? <button className="sa-link" onClick={() => openPerson({ id: c.customer })}>{who(c)}</button> : who(c)}</td>}
            <td data-l="Card">{c.brand ? `${c.brand} •••• ${c.last4}` : '—'}{c.country && <small> · {c.country}</small>}{(c.cvc === 'fail' || c.zip === 'fail') && <Pill c={COL.coral}>{c.cvc === 'fail' ? 'CVC failed' : 'ZIP failed'}</Pill>}</td>
            <td data-l="Risk">{c.risk ? <Pill c={RISK[c.risk]}>{c.risk}{c.score != null ? ` ${c.score}` : ''}</Pill> : '—'}</td>
            <td data-l="When">{when(c.created)}</td>
            <td className="sx-btns">
              {c.paid && left > 0 && <button className="btn small ghost" onClick={() => ask({ kind: 'refund', title: 'Refund a payment', what: `${money(c.amount, c.currency)} paid with ${c.brand} •••• ${c.last4} by ${who(c)}`, charge: c })}>Refund</button>}
              {c.fingerprint && <button className="btn small ghost" onClick={() => ask({ kind: 'plain', title: 'Block this card', what: `Radar will refuse every future payment from ${c.brand} •••• ${c.last4}.`, body: { action: 'block', kind: 'card', value: c.id } })}>Block card</button>}
              {c.receipt && <a className="btn small ghost" href={c.receipt} target="_blank" rel="noreferrer">Receipt</a>}
              <a className="btn small ghost" href={`${dash}payments/${c.intent || c.id}`} target="_blank" rel="noreferrer">↗</a>
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
function Payments(p) {
  const v = useView(p.social, 'payments', { q: p.query }, [p.query, p.tick]);
  return (
    <Section title="💳 Payments" sub={v.rows ? v.rows.length + (v.next ? '+' : '') : ''} right={<button className="btn small ghost" onClick={v.reload}>Refresh</button>}>
      <Loading v={v} />
      {v.note && <Empty>{v.note}</Empty>}
      {v.rows && !v.rows.length && !v.note && <Empty>No payments yet.</Empty>}
      {v.rows && v.rows.length > 0 && <ChargeRows rows={v.rows} {...p} />}
      <More v={v} />
      <p className="ad-foot">Risk comes from Stripe Radar (0–100; elevated and highest deserve a look). Refunds within {REFUND_DAYS} days are always granted under our refund policy.</p>
    </Section>
  );
}

// ---------- subscriptions ----------
function SubButtons({ s, ask, who }) {
  const live = ['active', 'trialing', 'past_due'].includes(s.status);
  const label = `${who(s)}'s ${money(s.amount, s.currency)} / ${s.interval} subscription`;
  const plain = (title, what, body) => ask({ kind: 'plain', title, what, body: { subId: s.id, ...body } });
  return (
    <>
      {live && !s.cancelAtEnd && <button className="btn small ghost" onClick={() => plain('Cancel at period end', `${label} stops renewing. They keep Premium until ${date(s.until)}.`, { action: 'subCancel' })}>Cancel</button>}
      {live && s.cancelAtEnd && <button className="btn small ghost" onClick={() => plain('Resume', `${label} renews again on ${date(s.until)}.`, { action: 'subResume' })}>Resume</button>}
      {live && <button className="btn small ghost" onClick={() => plain('End now', `${label} ends immediately and Premium stops now. No refund is made (refund the payment separately if needed).`, { action: 'subCancel', now: true })}>End now</button>}
      {live && !s.paused && <button className="btn small ghost" onClick={() => plain('Pause payments', `${label} stops charging. They keep Premium for free until you unpause it.`, { action: 'subPause' })}>Pause</button>}
      {s.paused && <button className="btn small ghost" onClick={() => plain('Unpause', `${label} starts charging again from the next renewal.`, { action: 'subUnpause' })}>Unpause</button>}
      {live && <button className="btn small ghost" onClick={() => ask({ kind: 'package', title: 'Change package', what: label, sub: s })}>Package</button>}
      {live && <button className="btn small ghost" onClick={() => ask({ kind: 'trial', title: 'Give free days', what: `${label}: no charge until the free days end.`, sub: s })}>Free days</button>}
    </>
  );
}
function Subs(p) {
  const [f, setF] = useState('all');
  const v = useView(p.social, 'subscriptions', { q: p.query, f }, [p.query, f, p.tick]);
  return (
    <Section title="🔁 Subscriptions" sub={v.rows ? v.rows.length + (v.next ? '+' : '') : ''} right={<button className="btn small ghost" onClick={v.reload}>Refresh</button>}>
      <div className="ad-chips">{[['all', 'All'], ['active', 'Active'], ['trialing', 'Trial'], ['past_due', 'Past due'], ['cancelling', 'Cancelling'], ['canceled', 'Ended']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      <Loading v={v} />
      {v.note && <Empty>{v.note}</Empty>}
      {v.rows && !v.rows.length && !v.note && <Empty>None here.</Empty>}
      {v.rows && v.rows.length > 0 && (
        <table className="sx-table">
          <thead><tr><th>Who</th><th>Status</th><th>Price</th><th>Renews / ends</th><th /></tr></thead>
          <tbody>{v.rows.map((s) => (
            <tr key={s.id}>
              <td data-l="Who">{s.customer ? <button className="sa-link" onClick={() => p.openPerson({ id: s.customer })}>{p.who(s)}</button> : p.who(s)}{s.pkg && <small> · {s.pkg}</small>}</td>
              <td data-l="Status"><St s={s.status} />{s.cancelAtEnd && <Pill c={COL.yellow}>cancelling</Pill>}{s.paused && <Pill c={COL.cyan}>paused</Pill>}</td>
              <td data-l="Price">{money(s.amount, s.currency)} / {s.interval}</td>
              <td data-l="Renews">{s.status === 'trialing' ? `trial ends ${date(s.trialEnd)}` : s.status === 'canceled' ? `ended ${date(s.canceledAt)}` : date(s.until)}</td>
              <td className="sx-btns"><SubButtons s={s} ask={p.ask} who={p.who} /><a className="btn small ghost" href={`${p.dash}subscriptions/${s.id}`} target="_blank" rel="noreferrer">↗</a></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <More v={v} />
    </Section>
  );
}

// ---------- invoices ----------
function InvoiceRows({ rows, ask, who, openPerson, dash, compact }) {
  return (
    <table className="sx-table">
      <thead><tr><th>Invoice</th>{!compact && <th>Who</th>}<th>Status</th><th>Date</th><th /></tr></thead>
      <tbody>{rows.map((i) => (
        <tr key={i.id}>
          <td data-l="Invoice"><b>{money(i.status === 'paid' ? i.paid : i.due, i.currency)}</b>{i.number && <small> · {i.number}</small>}</td>
          {!compact && <td data-l="Who">{i.customer ? <button className="sa-link" onClick={() => openPerson({ id: i.customer })}>{who(i)}</button> : who(i)}</td>}
          <td data-l="Status"><St s={i.status} />{i.attempts > 0 && i.status === 'open' && <small> · {i.attempts} tries{i.nextAttempt ? `, next ${date(i.nextAttempt)}` : ''}</small>}</td>
          <td data-l="Date">{date(i.created)}</td>
          <td className="sx-btns">
            {i.status === 'open' && <button className="btn small ghost" onClick={() => ask({ kind: 'plain', title: 'Retry payment', what: `Charge ${money(i.remaining, i.currency)} to ${who(i)}'s saved card now.`, body: { action: 'invoiceRetry', invoiceId: i.id } })}>Retry</button>}
            {i.status === 'open' && <button className="btn small ghost" onClick={() => ask({ kind: 'plain', title: 'Void invoice', what: `${who(i)} won't be asked to pay ${money(i.remaining, i.currency)}. This can't be undone.`, body: { action: 'invoiceVoid', invoiceId: i.id } })}>Void</button>}
            {i.url && <a className="btn small ghost" href={i.url} target="_blank" rel="noreferrer">View</a>}
            {i.pdf && <a className="btn small ghost" href={i.pdf} target="_blank" rel="noreferrer">PDF</a>}
            <a className="btn small ghost" href={`${dash}invoices/${i.id}`} target="_blank" rel="noreferrer">↗</a>
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}
function Invoices(p) {
  const [f, setF] = useState('open');
  const v = useView(p.social, 'invoices', { q: p.query, f: f === 'all' ? '' : f }, [p.query, f, p.tick]);
  return (
    <Section title="🧾 Invoices" sub={v.rows ? v.rows.length + (v.next ? '+' : '') : ''} right={<button className="btn small ghost" onClick={v.reload}>Refresh</button>}>
      <div className="ad-chips">{[['open', 'Unpaid'], ['paid', 'Paid'], ['uncollectible', 'Uncollectible'], ['void', 'Void'], ['all', 'All']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      <Loading v={v} />
      {v.note && <Empty>{v.note}</Empty>}
      {v.rows && !v.rows.length && !v.note && <Empty>{f === 'open' ? 'No unpaid invoices. 🎉' : 'None here.'}</Empty>}
      {v.rows && v.rows.length > 0 && <InvoiceRows rows={v.rows} {...p} />}
      <More v={v} />
      <p className="ad-foot">Stripe retries failed renewals on its own (Smart Retries). “Retry” charges the saved card right now.</p>
    </Section>
  );
}

// ---------- disputes ----------
const EV_LABEL = [
  ['product_description', 'What they bought'], ['access_activity_log', 'Proof they used it (account activity)'], ['customer_name', 'Customer name'],
  ['customer_email_address', 'Customer email'], ['billing_address', 'Billing address'], ['service_date', 'Date of purchase (YYYY-MM-DD)'],
  ['refund_policy_disclosure', 'Refund policy'], ['cancellation_policy_disclosure', 'Cancellation policy'], ['cancellation_rebuttal', 'Why the cancellation claim is wrong (if any)'],
  ['refund_refusal_explanation', 'Why no refund was given (if any)'], ['uncategorized_text', 'Anything else'],
];
function DisputeEditor({ social, id, ask, onClose, who }) {
  const [d, setD] = useState(null);
  const [ev, setEv] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    social.admin.stripe('dispute', { id }).then((x) => {
      if (x.none) { setErr(x.none); return; }
      setD(x);
      setEv(Object.fromEntries(EV_LABEL.map(([k]) => [k, (x.evidence && x.evidence[k]) || (x.prefill && x.prefill[k]) || ''])));
    }).catch((e) => setErr(niceError(e)));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Section title="⚖️ Dispute" right={<button className="btn small ghost" onClick={onClose}>Close</button>}><p className="sx-warn">⚠️ {err}</p></Section>;
  if (!d) return <Section title="⚖️ Dispute"><Empty>Loading…</Empty></Section>;
  const open = ['needs_response', 'warning_needs_response'].includes(d.status);
  return (
    <Section title={`⚖️ Dispute · ${money(d.amount, d.currency)}`} sub={`${words(d.reason)} · ${who(d)}`} right={<button className="btn small ghost" onClick={onClose}>Close</button>}>
      <p className="sa-sub"><St s={d.status} /> {open && d.dueBy ? <b style={{ color: daysLeft(d.dueBy) <= 3 ? COL.coral : undefined }}>Answer by {date(d.dueBy)} ({daysLeft(d.dueBy)} days)</b> : null}{d.submissions ? ` · submitted ${d.submissions}×` : ''}</p>
      {open ? <>
        <p className="ad-foot">We filled this in from what Nibble knows about the account. Check it, add anything useful, then <b>Save draft</b> (you can come back) or <b>Submit</b> (final: Stripe sends it to the bank, and you can’t change it after).</p>
        <form className="sa-form" onSubmit={(e) => e.preventDefault()}>
          {EV_LABEL.map(([k, l]) => (
            <label key={k}><span>{l}</span>
              {['product_description', 'access_activity_log', 'refund_policy_disclosure', 'cancellation_policy_disclosure', 'cancellation_rebuttal', 'refund_refusal_explanation', 'uncategorized_text'].includes(k)
                ? <textarea rows={k === 'access_activity_log' ? 6 : 3} maxLength={4000} value={ev[k] || ''} onChange={(e) => setEv({ ...ev, [k]: e.target.value })} />
                : <input maxLength={400} value={ev[k] || ''} onChange={(e) => setEv({ ...ev, [k]: e.target.value })} />}
            </label>
          ))}
          <div className="sx-btns">
            <button className="btn small ghost" onClick={() => ask({ kind: 'plain', title: 'Save evidence as a draft', what: 'Stripe keeps it; nothing is sent to the bank yet.', body: { action: 'disputeEvidence', disputeId: d.id, evidence: ev, submit: false } })}>Save draft</button>
            <button className="btn small" onClick={() => ask({ kind: 'plain', title: 'Submit evidence', what: `Send this evidence to the bank for the ${money(d.amount, d.currency)} dispute. This is final.`, body: { action: 'disputeEvidence', disputeId: d.id, evidence: ev, submit: true } })}>Submit</button>
            <button className="btn small ghost warn" onClick={() => ask({ kind: 'plain', title: 'Accept the dispute', what: `Give up the ${money(d.amount, d.currency)} (plus Stripe’s dispute fee). The money stays with the card holder. This is final.`, body: { action: 'disputeAccept', disputeId: d.id } })}>Accept (don’t fight)</button>
          </div>
        </form>
      </> : <p className="ad-foot">This dispute is {words(d.status)}; there’s nothing more to do here.</p>}
    </Section>
  );
}
function Disputes(p) {
  const v = useView(p.social, 'disputes', {}, [p.tick]);
  return (
    <>
      {p.open && <DisputeEditor {...p} id={p.open} onClose={() => p.setOpen('')} />}
      <Section title="⚖️ Disputes" sub={v.rows ? v.rows.filter((d) => ['needs_response', 'warning_needs_response'].includes(d.status)).length + ' open' : ''} right={<button className="btn small ghost" onClick={v.reload}>Refresh</button>}>
        <Loading v={v} />
        {v.rows && !v.rows.length && <Empty>No disputes. 🎉</Empty>}
        {v.rows && v.rows.length > 0 && (
          <table className="sx-table">
            <thead><tr><th>Amount</th><th>Who</th><th>Reason</th><th>Status</th><th>Answer by</th><th /></tr></thead>
            <tbody>{v.rows.map((d) => {
              const open = ['needs_response', 'warning_needs_response'].includes(d.status);
              return (
                <tr key={d.id}>
                  <td data-l="Amount"><b>{money(d.amount, d.currency)}</b></td>
                  <td data-l="Who">{d.customer ? <button className="sa-link" onClick={() => p.openPerson({ id: d.customer })}>{p.who(d)}</button> : '—'}</td>
                  <td data-l="Reason">{words(d.reason)}</td>
                  <td data-l="Status"><St s={d.status} /></td>
                  <td data-l="Answer by">{open && d.dueBy ? <b style={{ color: daysLeft(d.dueBy) <= 3 ? COL.coral : undefined }}>{date(d.dueBy)} ({daysLeft(d.dueBy)}d)</b> : '—'}</td>
                  <td className="sx-btns"><button className="btn small ghost" onClick={() => p.setOpen(d.id)}>{open ? 'Answer' : 'View'}</button><a className="btn small ghost" href={`${p.dash}disputes/${d.id}`} target="_blank" rel="noreferrer">↗</a></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <More v={v} />
        <p className="ad-foot">A dispute ends the person’s Premium and blocks new purchases until you clear the flag. Answer before the deadline or the bank decides for the card holder.</p>
      </Section>
    </>
  );
}

// ---------- fraud ----------
function Fraud(p) {
  const v = useView(p.social, 'fraud', {}, [p.tick]);
  const [email, setEmail] = useState('');
  const sec = v.sections || {};
  return (
    <>
      <Section title="🚨 Early fraud warnings" sub={v.warnings ? v.warnings.length : ''} error={sec.warnings} right={<button className="btn small ghost" onClick={v.reload}>Refresh</button>}>
        {v.loading && !v.warnings && <Empty>Loading…</Empty>}
        {v.error && <p className="sx-warn">⚠️ {v.error}</p>}
        {v.warnings && !v.warnings.length && <Empty>No fraud warnings. 🎉</Empty>}
        {v.warnings && v.warnings.length > 0 && <ChargeRows rows={v.warnings.map((w) => w.charge).filter((c) => c.amount != null)} {...p} />}
        <p className="ad-foot">When a card’s bank reports fraud, Nibble refunds the payment automatically (it avoids the dispute fee), ends Premium and flags the account. Block the card so it can’t pay again.</p>
      </Section>
      <Section title="⛔ Block lists" error={sec.lists}>
        {v.lists && (
          <div className="ad-grid2">
            <div>
              <h4>Emails</h4>
              <form className="sx-search" onSubmit={(e) => { e.preventDefault(); if (email.trim()) p.ask({ kind: 'plain', title: 'Block an email', what: `Radar will refuse payments from ${email.trim()}.`, body: { action: 'block', kind: 'email', value: email.trim() } }); }}>
                <input className="ad-search" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" /><button className="btn small">Block</button>
              </form>
              <BlockItems items={v.lists.email.items} ask={p.ask} />
            </div>
            <div>
              <h4>Cards</h4>
              <p className="ad-foot" style={{ marginTop: 0 }}>Block a card from its payment (Payments → Block card). Stripe stores a card fingerprint, never the number.</p>
              <BlockItems items={v.lists.card.items} ask={p.ask} card />
            </div>
          </div>
        )}
        <p className="ad-foot">Blocks only work once these two rules exist in Stripe → Radar → Rules (one-time set-up): <code>Block if :email: in @nibble_blocked_emails</code> and <code>Block if :card_fingerprint: in @nibble_blocked_cards</code>. <a className="sa-link" href={`${p.dash}radar/rules`} target="_blank" rel="noreferrer">Open Radar rules ↗</a></p>
      </Section>
    </>
  );
}
function BlockItems({ items, ask, card }) {
  if (!items.length) return <Empty>Nothing blocked.</Empty>;
  return (
    <ul className="sx-needs">{items.map((i) => (
      <li key={i.id}><span><code>{card ? i.value.slice(0, 8) + '…' : i.value}</code> <small>{date(i.at)}</small></span>
        <button className="btn small ghost" onClick={() => ask({ kind: 'plain', title: 'Unblock', what: `${card ? 'This card' : i.value} can pay again.`, body: { action: 'unblock', itemId: i.id } })}>Unblock</button></li>
    ))}</ul>
  );
}

// ---------- activity ----------
function Activity(p) {
  const [f, setF] = useState('audit');
  const audit = useView(p.social, 'audit', {}, [p.tick, f === 'audit']);
  const ev = useView(p.social, 'events', {}, [p.tick, f !== 'audit']);
  return (
    <Section title="📜 Activity" right={<button className="btn small ghost" onClick={() => (f === 'audit' ? audit.reload() : ev.reload())}>Refresh</button>}>
      <div className="ad-chips">{[['audit', 'Admin actions'], ['ours', 'Webhook log'], ['stripe', 'Stripe events (3 days)']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      {f === 'audit' && <>
        <Loading v={audit} />
        {audit.rows && !audit.rows.length && <Empty>No admin actions yet.</Empty>}
        {audit.rows && audit.rows.length > 0 && (
          <table className="sx-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Why</th></tr></thead>
            <tbody>{audit.rows.map((a) => (
              <tr key={a.id}>
                <td data-l="When">{when(a.at)}</td>
                <td data-l="Who">@{a.byName || p.nameOf(a.by) || a.by}</td>
                <td data-l="What"><b style={{ color: a.ok ? undefined : COL.coral }}>{words(a.action)}</b> <code>{a.target}</code>{a.amount ? ` · ${money(a.amount, a.currency)}` : ''}{a.detail && <small> · {a.detail}</small>}{!a.ok && <><br /><small style={{ color: COL.coral }}>{a.error}</small></>}</td>
                <td data-l="Why">{a.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </>}
      {f !== 'audit' && <>
        {ev.loading && !ev.ours && <Empty>Loading…</Empty>}
        {ev.error && <p className="sx-warn">⚠️ {ev.error}</p>}
        {f === 'ours' && ev.ours && (ev.ours.length ? (
          <table className="sx-table"><thead><tr><th>Event</th><th>Result</th><th>When</th></tr></thead>
            <tbody>{ev.ours.map((e) => (
              <tr key={e.id}><td data-l="Event"><code>{e.type}</code>{e.uid && p.nameOf(e.uid) && <small> · @{p.nameOf(e.uid)}</small>}{!e.live && <small> · test</small>}</td>
                <td data-l="Result"><St s={e.status} />{e.tries > 1 && <small> · {e.tries} tries</small>}{e.error && <><br /><small style={{ color: COL.coral }}>{e.error}</small></>}</td>
                <td data-l="When">{when(e.at)}</td></tr>
            ))}</tbody></table>
        ) : <Empty>No webhook events yet.</Empty>)}
        {f === 'stripe' && <>
          {ev.sections && ev.sections.stripe && <p className="sx-warn">⚠️ {ev.sections.stripe}</p>}
          {ev.stripe && (ev.stripe.length ? (
            <table className="sx-table"><thead><tr><th>Event</th><th>Delivery</th><th>When</th></tr></thead>
              <tbody>{ev.stripe.map((e) => <tr key={e.id}><td data-l="Event"><code>{e.type}</code></td><td data-l="Delivery">{e.pending ? <Pill c={COL.yellow}>{e.pending} not delivered yet</Pill> : <Pill c={COL.mint}>delivered</Pill>}</td><td data-l="When">{when(e.at)}</td></tr>)}</tbody></table>
          ) : <Empty>No Stripe events in the last 3 days.</Empty>)}
        </>}
      </>}
      <p className="ad-foot">Every refund, cancel, dispute answer and block made here is saved with who did it and why. Stripe also shows “nb_by” and “nb_reason” on refunds.</p>
    </Section>
  );
}

// ---------- one person ----------
function Person(p) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => p.social.admin.stripe('customer', p.who.id ? { id: p.who.id } : { q: p.who.q })
    .then((x) => (x.none ? setErr(x.none) : setD(x))).catch((e) => setErr(niceError(e)));
  useEffect(() => { load(); }, [p.who, p.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = d && d.customer;
  const sec = (d && d.sections) || {};
  const meta = (c && c.meta) || {};
  return (
    <div className="ad-drawer-bg" onClick={p.onClose}>
      <aside className="ad-drawer sx-drawer" onClick={(e) => e.stopPropagation()} aria-label="Customer">
        <button className="btn small ghost ad-drawer-x" onClick={p.onClose} aria-label="Close">✕</button>
        {err && <p className="sx-warn">⚠️ {err}</p>}
        {!d && !err && <Empty>Loading from Stripe…</Empty>}
        {c && <>
          <h3 className="sx-name">{c.username ? '@' + c.username : c.email || c.id}</h3>
          <p className="ad-foot" style={{ marginTop: 0 }}>{c.email}{c.country ? ' · ' + c.country : ''} · customer since {date(c.created)}</p>
          <div className="sx-btns" style={{ margin: '8px 0 14px' }}>
            {c.uid && <button className="btn small ghost" onClick={() => p.openUser(c.uid)}>Nibble profile</button>}
            {c.uid && <button className="btn small ghost" onClick={() => p.ask({ kind: 'plain', title: 'Sync from Stripe', what: 'Re-read their subscription from Stripe and fix their Premium status.', body: { action: 'resync', uid: c.uid } })}>Sync Premium</button>}
            <a className="btn small ghost" href={`${p.dash}customers/${c.id}`} target="_blank" rel="noreferrer">Stripe ↗</a>
          </div>
          <div className="sx-facts">
            <span>Premium: <b>{d.premium ? (d.premium.active ? `on until ${date(d.premium.until)}` : `off (${words(d.premium.status)})`) : 'never'}</b></span>
            {meta.nb_risk_flags && <span>Risk flags: <b style={{ color: meta.nb_risk_flags !== 'none' ? COL.coral : undefined }}>{words(meta.nb_risk_flags)}</b></span>}
            {meta.nb_acct_age_days && <span>Account age at checkout: <b>{meta.nb_acct_age_days} days</b></span>}
            {meta.nb_auth_provider && <span>Sign-in: <b>{meta.nb_auth_provider}</b></span>}
            {(meta.nb_signup_country || meta.nb_ip_country) && <span>Country: <b>sign-up {meta.nb_signup_country || '?'} · paid from {meta.nb_ip_country || '?'}</b></span>}
            {meta.nb_checkouts_24h && <span>Checkout tries (24 h): <b>{meta.nb_checkouts_24h}</b></span>}
          </div>
          {d.flag && (
            <div className={'sx-flag' + (d.flag.open ? ' open' : '')}>
              <b>🚩 {d.flag.open ? 'Flagged' : 'Flag cleared'}: {words(d.flag.reason)}</b>{d.flag.disputeStatus && <small> · dispute {words(d.flag.disputeStatus)}</small>}
              {d.flag.open && <button className="btn small" onClick={() => p.ask({ kind: 'plain', title: 'Clear the flag', what: 'You checked this account and they may buy Premium again.', body: { action: 'clearFlag', uid: c.uid } })}>Clear flag</button>}
            </div>
          )}
          <h4>Subscriptions</h4>
          {sec.subs && <p className="sx-warn">⚠️ {sec.subs}</p>}
          {!d.subs.length && <Empty>None.</Empty>}
          {d.subs.map((s) => (
            <div key={s.id} className="sx-box">
              <div><b>{money(s.amount, s.currency)} / {s.interval}</b> <St s={s.status} />{s.cancelAtEnd && <Pill c={COL.yellow}>cancelling</Pill>}{s.paused && <Pill c={COL.cyan}>paused</Pill>}</div>
              <small>{s.status === 'trialing' ? `Trial ends ${date(s.trialEnd)}` : s.status === 'canceled' ? `Ended ${date(s.canceledAt)}` : `${s.cancelAtEnd ? 'Ends' : 'Renews'} ${date(s.until)}`}{s.pkg ? ` · ${s.pkg}` : ''}</small>
              <div className="sx-btns"><SubButtons s={s} ask={p.ask} who={() => (c.username ? '@' + c.username : c.email)} /></div>
            </div>
          ))}
          <h4>Cards</h4>
          {sec.cards && <p className="sx-warn">⚠️ {sec.cards}</p>}
          {!d.cards.length && !sec.cards && <Empty>No saved card.</Empty>}
          {d.cards.map((k) => <p key={k.id} className="sa-sub">{k.brand} •••• {k.last4} · expires {k.exp}{k.country ? ' · ' + k.country : ''}</p>)}
          <h4>Payments</h4>
          {sec.charges && <p className="sx-warn">⚠️ {sec.charges}</p>}
          {d.charges.length ? <ChargeRows rows={d.charges} {...p} compact /> : <Empty>No payments.</Empty>}
          <h4>Invoices</h4>
          {sec.invoices && <p className="sx-warn">⚠️ {sec.invoices}</p>}
          {d.invoices.length ? <InvoiceRows rows={d.invoices} {...p} compact /> : <Empty>No invoices.</Empty>}
          {c.email && <div className="sx-btns" style={{ marginTop: 14 }}><button className="btn small ghost warn" onClick={() => p.ask({ kind: 'plain', title: 'Block this email', what: `Radar will refuse payments from ${c.email}.`, body: { action: 'block', kind: 'email', value: c.email } })}>Block email</button></div>}
        </>}
      </aside>
    </div>
  );
}

// ---------- the confirm sheet (every money action) ----------
const REASONS = [['requested_by_customer', 'Asked by the customer'], ['duplicate', 'Charged twice'], ['fraudulent', 'Fraud']];
function Sheet({ social, toast, sheet, onClose, onDone, plan }) {
  const ch = sheet.charge;
  const left = ch ? ch.amount - ch.refunded : 0;
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(ch ? (left / 100).toFixed(2) : '');
  const [stripeReason, setStripeReason] = useState('requested_by_customer');
  const [endPremium, setEndPremium] = useState(false);
  const [pkg, setPkg] = useState('');
  const [prorate, setProrate] = useState(false);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const pkgs = ((plan && plan.packages) || []).filter((k) => k.priceId && (!sheet.sub || k.priceId !== sheet.sub.priceId));
  const cents = Math.round(Number(amount) * 100);
  const partial = ch && cents > 0 && cents < left;
  const body = () => {
    if (sheet.kind === 'refund') return { action: 'refund', chargeId: ch.id, amount: cents, stripeReason, endPremium: partial && endPremium };
    if (sheet.kind === 'package') return { action: 'subChangePackage', subId: sheet.sub.id, packageId: pkg, prorate };
    if (sheet.kind === 'trial') return { action: 'subExtendTrial', subId: sheet.sub.id, days: Number(days) };
    return sheet.body;
  };
  const okExtra = sheet.kind === 'refund' ? cents >= 1 && cents <= left : sheet.kind === 'package' ? !!pkg : sheet.kind === 'trial' ? days >= 1 && days <= 90 : true;
  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await social.admin.stripe(null, { ...body(), reason: reason.trim() });
      toast({ text: `${sheet.title}: done${r.detail ? ' (' + r.detail + ')' : ''}` });
      onDone();
    } catch (x) { toast({ err: true, text: niceError(x) }); setBusy(false); }
  };
  return (
    <div className="ad-drawer-bg sx-sheet-bg" onClick={onClose}>
      <form className="sx-sheet sa-form" onClick={(e) => e.stopPropagation()} onSubmit={run}>
        <h3>{sheet.title}</h3>
        <p className="sa-sub">{sheet.what}</p>
        {sheet.kind === 'refund' && <>
          <div className="ad-two">
            <label><span>Amount ({String(ch.currency).toUpperCase()}) <small>up to {(left / 100).toFixed(2)}</small></span><input type="number" step="0.01" min="0.01" max={(left / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label><span>Reason for Stripe</span><select value={stripeReason} onChange={(e) => setStripeReason(e.target.value)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          {partial ? <label className="sa-toggle"><span><b>Also end their Premium now</b><small>A full refund of the latest payment ends Premium; a partial one only if you tick this.</small></span><input type="checkbox" checked={endPremium} onChange={(e) => setEndPremium(e.target.checked)} /></label>
            : <p className="ad-foot">A full refund of their latest payment ends their Premium (an older payment doesn’t).</p>}
        </>}
        {sheet.kind === 'package' && <>
          <label><span>New package</span><select value={pkg} onChange={(e) => setPkg(e.target.value)}><option value="">Pick one…</option>{pkgs.map((k) => <option key={k.id} value={k.id}>{k.name}: {money(k.amount, k.currency)} / {k.interval}</option>)}</select></label>
          <label className="sa-toggle"><span><b>Charge or credit the difference now</b><small>Off: the new price starts at the next renewal.</small></span><input type="checkbox" checked={prorate} onChange={(e) => setProrate(e.target.checked)} /></label>
        </>}
        {sheet.kind === 'trial' && <label><span>Free days <small>1–90, from today</small></span><input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} /></label>}
        <label><span>Why? <small>saved in the audit log</small></span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Asked by email within 14 days" autoFocus /></label>
        <div className="sx-btns">
          <button className="btn" disabled={busy || reason.trim().length < 3 || !okExtra}>{busy ? 'Working…' : 'Confirm'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
