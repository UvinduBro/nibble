'use client';
import './social.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen } from './Auth';
import PetFigure, { useNibble, PetSnap } from '../PetFigure';
import { ITEMS, SPECIES as SHOP_SPECIES, OUTFITS as SHOP_OUTFITS, SKILLS as SHOP_SKILLS, PT } from '../../lib/shop';
import { SOLO as SOLO_A } from '../games/solo';
import { SOLO2 } from '../games/solo2';
import { SOLO3 } from '../games/solo3';

const SOLO_ALL = [...SOLO3, ...SOLO2, ...SOLO_A];
const lookLabel = (u) => {
  const st = u.style || {};
  const parts = [];
  if (st.sp) parts.push((SHOP_SPECIES.find((x) => x.key === st.sp) || {}).label || st.sp);
  if (st.of) parts.push((SHOP_OUTFITS.find((x) => x.key === st.of) || {}).label || st.of);
  return parts.join(' · ');
};
import { niceError, verLess, LEVELS, ms } from '../../lib/social/social';
import { teaConfig } from '../../lib/tea';
import { SOURCES, USES, countryName, flag } from '../../lib/signup';
import { SEO_PAGES, SEO_LIMITS, SITE as SEO_SITE, mergeSeo } from '../../lib/seo';
import { BUILTIN as PREMIUM_BUILTIN, DEFAULT_PLAN, CURRENCIES, INTERVALS, cleanFeature, money } from '../../lib/premium';
import { TEMPLATES as MAIL_TEMPLATES, TEMPLATE_DEFAULTS, renderEmail, fillForPreview } from '../../lib/emailTemplates';

// ---------- helpers ----------
const DAY = 86_400_000;
const C = { mint: '#7ee8c6', pink: '#ff8fd0', yellow: '#ffd166', cyan: '#5ef2ff', violet: '#a78bfa', coral: '#ff7a7a', slate: '#5a6180' };
const LEVEL = {
  info: { icon: '📣', label: 'Info' },
  update: { icon: '⬆️', label: 'Update' },
  warn: { icon: '⚠️', label: 'Warning' },
  party: { icon: '🎉', label: 'Celebration' },
};
const DURATIONS = [[0, 'Until I clear it'], [1, '1 hour'], [6, '6 hours'], [24, '24 hours'], [72, '3 days'], [168, '7 days']];
const TEMPLATES = [
  { label: '⬆️ New update', level: 'update', title: 'Nibble update is out', text: 'A new version is live — open the tray menu → Update Nibble to get it.', link: '/Nibble-Reinstall-Guide.pdf' },
  { label: '🛠 Maintenance', level: 'warn', title: 'Quick maintenance', text: 'Friends and messages may be patchy for a few minutes. Your pets keep working.', link: '' },
  { label: '🎉 Thank you', level: 'party', title: 'Thank you!', text: 'Thanks for hanging out with Nibble. Go poke a friend today 👉', link: '' },
];

const ago = (t) => {
  if (!t) return 'never';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const skinInfo = (k) => {
  const s = (typeof window !== 'undefined' && window.SKINS && window.SKINS[k]) || null;
  return { label: s ? s.label : k ? k[0].toUpperCase() + k.slice(1) : 'Mint', color: s ? (s.neon ? s.line : s.body) : C.mint };
};
const countBy = (list, key) => {
  const m = new Map();
  for (const x of list) { const k = key(x); if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

function Toast({ note, onDone }) {
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => { if (!note) return; const t = setTimeout(() => done.current(), 3200); return () => clearTimeout(t); }, [note]);
  if (!note) return null;
  return <div className={'sa-toast' + (note.err ? ' err' : '')}>{note.text}</div>;
}

// ---------- charts (plain SVG/HTML, no libraries) ----------
function Trend({ days }) {
  const W = 640, H = 190, P = { l: 30, r: 34, t: 14, b: 26 };
  const n = days.length;
  const maxD = Math.max(1, ...days.map((d) => d.count));
  const maxT = Math.max(1, ...days.map((d) => d.total));
  const bw = (W - P.l - P.r) / n;
  const y = (v, m) => P.t + (H - P.t - P.b) * (1 - v / m);
  const line = days.map((d, i) => `${P.l + bw * i + bw / 2},${y(d.total, maxT)}`).join(' ');
  const area = `${P.l + bw / 2},${H - P.b} ${line} ${P.l + bw * (n - 1) + bw / 2},${H - P.b}`;
  const step = n > 20 ? 5 : n > 10 ? 3 : 1;
  return (
    <svg className="ad-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sign-ups per day">
      <defs>
        <linearGradient id="adArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={C.pink} stopOpacity="0.32" /><stop offset="1" stopColor={C.pink} stopOpacity="0" /></linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => <line key={f} x1={P.l} x2={W - P.r} y1={P.t + (H - P.t - P.b) * f} y2={P.t + (H - P.t - P.b) * f} className="ad-grid" />)}
      <text x={P.l - 6} y={P.t + 4} className="ad-axis" textAnchor="end">{maxD}</text>
      <text x={P.l - 6} y={H - P.b} className="ad-axis" textAnchor="end">0</text>
      <text x={W - P.r + 6} y={P.t + 4} className="ad-axis pink">{maxT}</text>
      {days.map((d, i) => {
        const h = (H - P.t - P.b) * (d.count / maxD);
        return (
          <g key={d.key}>
            <rect x={P.l + bw * i + bw * 0.18} y={H - P.b - h} width={bw * 0.64} height={Math.max(h, d.count ? 2 : 0)} rx="3" fill={C.mint} opacity={d.count ? 0.9 : 0}>
              <title>{`${d.label}: ${d.count} new · ${d.total} total`}</title>
            </rect>
            {i % step === 0 && <text x={P.l + bw * i + bw / 2} y={H - 8} className="ad-axis" textAnchor="middle">{d.short}</text>}
          </g>
        );
      })}
      <polygon points={area} fill="url(#adArea)" />
      <polyline points={line} fill="none" stroke={C.pink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Donut({ parts, center, sub }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 52, L = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="ad-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={sub}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * L;
          const el = (
            <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - 2, 0.5)} ${L}`} strokeDashoffset={-off} transform="rotate(-90 70 70)">
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="ad-donut-n">{center}</text>
        <text x="70" y="86" textAnchor="middle" className="ad-donut-s">{sub}</text>
      </svg>
      <ul className="ad-legend">
        {parts.map((p) => (
          <li key={p.label}><i style={{ background: p.color }} />{p.label}<b>{p.value}</b><em>{pct(p.value, total)}%</em></li>
        ))}
      </ul>
    </div>
  );
}

function HBars({ rows, max, unit = '' }) {
  const m = max || Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="sa-empty">Nothing yet.</p>;
  return (
    <div className="ad-hbars">
      {rows.map((r) => (
        <div key={r.label} className="ad-hbar" title={`${r.label}: ${r.value}${unit}`}>
          <span className="ad-hbar-l">{r.icon && <i className="ad-sw" style={{ background: r.icon }} />}{r.label}{r.tag && <em className={'ad-tag ' + r.tagCls}>{r.tag}</em>}</span>
          <span className="ad-hbar-t"><span style={{ width: `${Math.max(2, (r.value / m) * 100)}%`, background: r.color || C.mint }} /></span>
          <b>{typeof r.value === 'number' ? r.value.toLocaleString() : r.value}{unit}</b>
        </div>
      ))}
    </div>
  );
}

function Kpi({ n, label, sub, color, onClick }) {
  return (
    <button className="ad-kpi" onClick={onClick} disabled={!onClick} style={{ '--k': color }}>
      <b>{n}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </button>
  );
}

// avatar = a still picture of the user's own pet, wearing their saved look
function Ava({ u, size = 38 }) {
  return (
    <span className="ad-ava pet" style={{ width: size, height: size }}>
      <PetSnap skin={u.skin} acc={u.acc} tint={u.tint} makeup={u.makeup} look={u.style} size={size} />
      {u.online && <i className={u.dnd ? 'dnd' : ''} />}
    </span>
  );
}

// ---------- banner preview (same look users get) ----------
export function BannerView({ level = 'info', title, text, link, onClose, children }) {
  const L = LEVEL[level] || LEVEL.info;
  return (
    <div className={'sa-bc lvl-' + (LEVEL[level] ? level : 'info')}>
      <span className="sa-bc-ico">{L.icon}</span>
      <div className="sa-bc-text">{title && <b>{title} </b>}{text}</div>
      {link && <a className="btn small" href={link} target="_blank" rel="noopener">Open</a>}
      {children}
      {onClose && <button className="sa-x" onClick={onClose} title="Dismiss">✕</button>}
    </div>
  );
}

// ---------- tabs ----------
function Overview({ social, users, banned, latest, minVersion, go }) {
  const [range, setRange] = useState(14);
  const now = Date.now();
  const total = users.length;
  const online = users.filter((u) => u.online).length;
  const today = users.filter((u) => u.lastSeen && now - u.lastSeen < DAY).length;
  const week = users.filter((u) => u.lastSeen && now - u.lastSeen < 7 * DAY).length;
  const newWeek = users.filter((u) => u.createdAt && now - u.createdAt < 7 * DAY).length;
  const desk = users.filter((u) => u.client === 'desktop');
  const onLatest = latest ? desk.filter((u) => u.ver && !verLess(u.ver, latest)).length : 0;
  const outdated = desk.filter((u) => u.ver && minVersion && verLess(u.ver, minVersion)).length;

  const days = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const first = start.getTime() - (range - 1) * DAY;
    let total = users.filter((u) => u.createdAt && u.createdAt < first).length;
    return Array.from({ length: range }, (_, i) => {
      const a = first + i * DAY, b = a + DAY;
      const count = users.filter((u) => u.createdAt >= a && u.createdAt < b).length;
      total += count;
      const d = new Date(a);
      return { key: a, count, total, short: d.getDate() + '/' + (d.getMonth() + 1), label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) };
    });
  }, [users, range]);
  const inRange = days.reduce((s, d) => s + d.count, 0);

  const activity = [
    { label: 'Online now', value: online, color: C.mint },
    { label: 'Today', value: Math.max(0, today - online), color: C.cyan },
    { label: 'This week', value: Math.max(0, week - today), color: C.violet },
    { label: 'Earlier', value: users.filter((u) => u.lastSeen && now - u.lastSeen >= 7 * DAY).length, color: C.slate },
    { label: 'Not seen yet', value: users.filter((u) => !u.lastSeen).length, color: '#3a405c' },
  ];
  const platforms = [
    { label: 'Desktop app', value: desk.length, color: C.mint },
    { label: 'Web only', value: users.filter((u) => u.client === 'web').length, color: C.pink },
    { label: 'Not reported yet', value: users.filter((u) => !u.client).length, color: C.slate },
  ];
  const versions = countBy(desk, (u) => u.ver).sort((a, b) => (verLess(a[0], b[0]) ? 1 : -1)).map(([v, n]) => {
    const isLatest = latest && v === latest;
    const old = minVersion && verLess(v, minVersion);
    return { label: 'v' + v, value: n, color: isLatest ? C.mint : old ? C.coral : C.yellow, tag: isLatest ? 'latest' : old ? 'too old' : '', tagCls: isLatest ? 'ok' : 'bad' };
  });
  const skins = countBy(users, (u) => u.skin).map(([k, n]) => { const s = skinInfo(k); return { label: s.label, value: n, color: s.color, icon: s.color }; });
  const withAcc = users.filter((u) => u.acc.length).length;
  const withTint = users.filter((u) => u.tint).length;
  const withMakeup = users.filter((u) => u.makeup).length;
  const accs = countBy(users.flatMap((u) => u.acc.map((a) => ({ a }))), (x) => x.a).slice(0, 8).map(([a, n]) => ({ label: a[0].toUpperCase() + a.slice(1), value: n, color: C.violet }));
  const recent = users.filter((u) => u.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const active = users.filter((u) => u.lastSeen).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 6);

  return (
    <>
      <div className="ad-kpis">
        <Kpi n={total} label="Total users" sub={newWeek ? `+${newWeek} this week` : 'no new this week'} color={C.mint} onClick={() => go('users', 'all')} />
        <Kpi n={online} label="Online now" sub={`${pct(online, total)}% of everyone`} color={C.cyan} onClick={() => go('users', 'online')} />
        <Kpi n={today} label="Active today" sub={`${week} this week`} color={C.violet} />
        <Kpi n={desk.length} label="Desktop installs" sub={latest ? `${onLatest} on v${latest}` : 'reported by the app'} color={C.pink} onClick={() => go('users', 'desktop')} />
        <Kpi n={outdated} label="Need an update" sub={minVersion ? `below v${minVersion}` : 'set a minimum version'} color={outdated ? C.coral : C.slate} onClick={() => go(minVersion ? 'users' : 'settings', 'outdated')} />
        <Kpi n={banned.length} label="Suspended" sub="accounts" color={banned.length ? C.coral : C.slate} onClick={() => go('users', 'banned')} />
      </div>

      <div className="sa-card">
        <h3>Sign-ups <small>+{inRange} in the last {range} days</small>
          <span className="ad-seg small">{[7, 14, 30].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}d</button>)}</span>
        </h3>
        <Trend days={days} />
        <div className="ad-key"><span><i style={{ background: C.mint }} />New per day</span><span><i style={{ background: C.pink }} />Total users</span></div>
      </div>

      <div className="ad-grid2">
        <div className="sa-card"><h3>Activity</h3><Donut parts={activity} center={week} sub="active · 7 days" /></div>
        <div className="sa-card"><h3>Platforms</h3><Donut parts={platforms} center={desk.length} sub="on desktop" /></div>
      </div>

      <div className="ad-grid2">
        <div className="sa-card">
          <h3>Desktop versions {outdated > 0 && <button className="sa-link" onClick={() => go('settings')}>Require update →</button>}</h3>
          {versions.length ? <HBars rows={versions} /> : <p className="sa-empty">No desktop app has reported a version yet — they will after updating to the latest build.</p>}
        </div>
        <div className="sa-card"><h3>Characters</h3><HBars rows={skins} /></div>
      </div>

      <div className="sa-card">
        <h3>Customization</h3>
        <div className="ad-grid3">
          <div className="ad-meter"><b>{pct(withAcc, total)}%</b><span>wear accessories</span><i><u style={{ width: pct(withAcc, total) + '%', background: C.violet }} /></i></div>
          <div className="ad-meter"><b>{pct(withTint, total)}%</b><span>custom colour</span><i><u style={{ width: pct(withTint, total) + '%', background: C.pink }} /></i></div>
          <div className="ad-meter"><b>{pct(withMakeup, total)}%</b><span>makeup</span><i><u style={{ width: pct(withMakeup, total) + '%', background: C.yellow }} /></i></div>
        </div>
        <h4 className="ad-h4">Most-worn accessories</h4>
        <HBars rows={accs} />
      </div>

      <div className="ad-grid2">
        <div className="sa-card">
          <h3>Newest members</h3>
          {recent.map((u) => <div key={u.uid} className="ad-mini" onClick={() => go('users', 'all', u.uid)}><Ava u={u} size={30} /><b>@{u.username}</b><small>{ago(u.createdAt)}</small></div>)}
          {!recent.length && <p className="sa-empty">No sign-ups recorded.</p>}
        </div>
        <div className="sa-card">
          <h3>Recently active</h3>
          {active.map((u) => <div key={u.uid} className="ad-mini" onClick={() => go('users', 'all', u.uid)}><Ava u={u} size={30} /><b>@{u.username}</b><small>{u.online ? 'online' : ago(u.lastSeen)}</small></div>)}
          {!active.length && <p className="sa-empty">Nobody seen yet.</p>}
        </div>
      </div>
      <SignupStats social={social} total={total} />
    </>
  );
}

// where people heard about Nibble + where they're from (signup/{uid}, loaded once)
function SignupStats({ social, total }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { social.admin.signups().then(setList).catch((e) => { setList([]); setErr(niceError(e)); }); }, [social]);
  if (!list) return <div className="sa-card"><h3>📣 How people found Nibble</h3><p className="sa-empty">Loading…</p></div>;
  const by = (f) => { const m = new Map(); for (const x of list) for (const k of [].concat(f(x))) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const src = by((x) => x.source), ctry = by((x) => x.country), uses = by((x) => x.uses || []);
  const label = (k) => (SOURCES.find(([s]) => s === k) || [, k])[1];
  const others = list.filter((x) => x.source === 'other' && x.sourceOther).slice(0, 8);
  return (
    <div className="ad-grid2">
      <div className="sa-card">
        <h3>📣 How people found Nibble <small>{list.length} of {total} answered</small></h3>
        {err && <p className="sa-empty">{err.includes('Not allowed') ? 'Publish the latest Firestore rules to see this.' : err}</p>}
        {!err && !list.length && <p className="sa-empty">No answers yet. New sign-ups are asked, and existing users see a one-time question on Home.</p>}
        <HBars rows={src.map(([k, n]) => ({ label: label(k), value: n, color: C.mint }))} max={src.length ? src[0][1] : 1} />
        {others.length > 0 && <p className="sa-sub" style={{ marginTop: 10 }}>Somewhere else: {others.map((x) => x.sourceOther).join(', ')}</p>}
      </div>
      <div className="sa-card">
        <h3>🌍 Where they're from</h3>
        <HBars rows={ctry.slice(0, 12).map(([k, n]) => ({ label: `${flag(k)} ${countryName(k)}`, value: n, color: C.cyan }))} max={ctry.length ? ctry[0][1] : 1} />
        {uses.length > 0 && <>
          <h3 style={{ marginTop: 16 }}>🎯 What they want it for</h3>
          <HBars rows={uses.map(([k, n]) => ({ label: (USES.find(([u]) => u === k) || [, k])[1], value: n, color: C.violet }))} max={uses[0][1]} />
        </>}
      </div>
    </div>
  );
}

const FILTERS = [
  ['all', 'All'], ['online', 'Online'], ['desktop', 'Desktop'], ['web', 'Web'],
  ['outdated', 'Outdated'], ['custom', 'Customized'], ['new', 'New (7d)'], ['banned', 'Suspended'],
];
const SORTS = [['online', 'Online first'], ['new', 'Newest'], ['seen', 'Last seen'], ['points', 'Most points'], ['name', 'Name A–Z']];

function Users({ users, bannedMap, latest, minVersion, filter, setFilter, openUid, setOpenUid, me }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('online');
  const [limit, setLimit] = useState(50);
  const now = Date.now();
  const tests = {
    all: () => true,
    online: (u) => u.online,
    desktop: (u) => u.client === 'desktop',
    web: (u) => u.client === 'web',
    outdated: (u) => u.client === 'desktop' && u.ver && (minVersion ? verLess(u.ver, minVersion) : latest && verLess(u.ver, latest)),
    custom: (u) => u.acc.length || u.tint || u.makeup || (u.style && (u.style.sp || u.style.of)),
    new: (u) => u.createdAt && now - u.createdAt < 7 * DAY,
    banned: (u) => bannedMap.has(u.uid),
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, users.filter(tests[k]).length]));
  const needle = q.trim().toLowerCase().replace(/^@/, '');
  let shown = users.filter(tests[filter] || tests.all);
  if (needle) shown = shown.filter((u) => u.username.toLowerCase().includes(needle) || u.petName.toLowerCase().includes(needle) || u.uid.toLowerCase().startsWith(needle));
  const cmp = {
    online: (a, b) => (b.online - a.online) || (b.lastSeen - a.lastSeen),
    new: (a, b) => b.createdAt - a.createdAt,
    seen: (a, b) => b.lastSeen - a.lastSeen,
    name: (a, b) => a.username.localeCompare(b.username),
    points: (a, b) => ((b.wallet ? b.wallet.points : -1) - (a.wallet ? a.wallet.points : -1)),
  }[sort];
  shown = [...shown].sort(cmp);

  const exportCsv = () => {
    const head = ['username', 'uid', 'pet_name', 'character', 'animal', 'outfit', 'online', 'last_seen', 'joined', 'platform', 'version', 'accessories', 'colour', 'makeup', 'points', 'items_owned', 'suspended'];
    const iso = (t) => (t ? new Date(t).toISOString() : '');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = shown.map((u) => [u.username, u.uid, u.petName, u.skin, (u.style || {}).sp || '', (u.style || {}).of || '', u.online, iso(u.lastSeen), iso(u.createdAt), u.client, u.ver, u.acc.join(' '), u.tint, u.makeup, u.wallet ? u.wallet.points : '', u.wallet ? u.wallet.owned.length : '', bannedMap.has(u.uid)]);
    const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `nibble-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="sa-card ad-users">
      <div className="ad-toolbar">
        <input className="ad-search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} placeholder="🔍  Search username, pet or UID…" />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn small ghost" onClick={exportCsv} disabled={!shown.length}>⬇ CSV</button>
      </div>
      <div className="ad-chips">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setLimit(50); }}>{l}<em>{counts[k]}</em></button>
        ))}
      </div>
      <div className="ad-thead"><span>User</span><span>Status</span><span>App</span><span>Points</span><span>Joined</span><span>Last seen</span></div>
      {shown.slice(0, limit).map((u) => {
        const ban = bannedMap.get(u.uid);
        const old = u.client === 'desktop' && u.ver && minVersion && verLess(u.ver, minVersion);
        return (
          <div key={u.uid} role="button" tabIndex={0} className={'ad-row' + (ban ? ' banned' : '')} onClick={() => setOpenUid(u.uid)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenUid(u.uid))}>
            <span className="ad-row-user"><Ava u={u} size={42} /><span><b>@{u.username}{u.uid === me && <em className="ad-tag ok">you</em>}</b><small>{u.petName || skinInfo(u.skin).label}{lookLabel(u) ? ` · ${lookLabel(u)}` : ''}{u.status ? ` · “${u.status}”` : ''}</small></span></span>
            <span className="ad-row-st">
              {ban ? <em className="ad-tag bad">suspended</em> : u.online ? <em className={'ad-tag ' + (u.dnd ? 'warn' : 'ok')}>{u.dnd ? 'busy' : 'online'}</em> : <em className="ad-tag">offline</em>}
              {(u.acc.length > 0 || u.tint || u.makeup) && <em className="ad-tag vio" title="Customized">✨</em>}
            </span>
            <span className="ad-row-app">{u.client === 'desktop' ? <>🖥 v{u.ver || '?'}{old && <em className="ad-tag bad">old</em>}</> : u.client === 'web' ? '🌐 web' : '—'}</span>
            <span className="ad-row-pts">{u.wallet ? <>{PT} {u.wallet.points}{u.wallet.owned.length ? <small> · {u.wallet.owned.length} items</small> : null}</> : <small className="dim">—</small>}</span>
            <span className="ad-row-d">{u.createdAt ? fmtDate(u.createdAt) : '—'}</span>
            <span className="ad-row-d">{u.online ? 'now' : ago(u.lastSeen)}</span>
          </div>
        );
      })}
      {shown.length === 0 && <p className="sa-empty" style={{ padding: '18px 0' }}>No users match.</p>}
      {shown.length > limit && <button className="btn small ghost ad-more" onClick={() => setLimit(limit + 50)}>Show {Math.min(50, shown.length - limit)} more</button>}
      <p className="ad-foot">{shown.length} of {users.length} users</p>
    </div>
  );
}

function UserDrawer({ u, ban, social, me, toast, onClose, minVersion }) {
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!u) return null;
  const self = u.uid === me;
  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy('');
  };
  const custom = u.acc.length || u.tint || u.makeup || (u.style && (u.style.sp || u.style.of || u.style.sk));
  const old = u.client === 'desktop' && u.ver && minVersion && verLess(u.ver, minVersion);
  const row = (k, v) => <div className="ad-kv"><span>{k}</span><b>{v}</b></div>;
  return (
    <div className="ad-drawer-bg" onClick={onClose}>
      <aside className="ad-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="sa-x ad-drawer-x" onClick={onClose} title="Close">✕</button>
        <div className="ad-drawer-pet">
          <PetFigure skin={u.skin} mood={ban ? 'sleep' : u.online ? 'wave' : 'idle'} acc={u.acc} tint={u.tint} makeup={u.makeup} look={u.style} w={170} h={160} size={1.35} />
        </div>
        <h3 className="ad-drawer-name">@{u.username}</h3>
        <p className="ad-drawer-sub">
          {ban ? <em className="ad-tag bad">suspended</em> : u.online ? <em className={'ad-tag ' + (u.dnd ? 'warn' : 'ok')}>{u.dnd ? 'do not disturb' : 'online now'}</em> : <em className="ad-tag">last seen {ago(u.lastSeen)}</em>}
          {self && <em className="ad-tag ok">you</em>}
        </p>
        {ban && <div className="ad-alert">Suspended by @{ban.by || 'admin'} {ago(ban.at)}{ban.reason ? ` — “${ban.reason}”` : ''}</div>}
        <div className="ad-kvs">
          {row('Pet name', u.petName || '—')}
          {row('Character', skinInfo(u.skin).label)}
          {row('Status', u.status ? `“${u.status}”` : '—')}
          {row('Joined', fmtDate(u.createdAt))}
          {row('Last seen', u.online ? 'now' : u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'never')}
          {row('App', u.client === 'desktop' ? <>Desktop v{u.ver || '?'} {old && <em className="ad-tag bad">needs update</em>}</> : u.client === 'web' ? 'Web' : 'Not reported')}
          {row('Animal & outfit', lookLabel(u) || 'Classic')}
          {row('Skill', (u.style && u.style.sk && (SHOP_SKILLS.find((x) => x.key === u.style.sk) || {}).label) || 'Signature move')}
          {row('Hats & colour', (u.acc.length || u.tint || u.makeup) ? [u.acc.join(', '), /^#/.test(u.tint) ? <span key="t" className="ad-sw big" style={{ background: u.tint }} /> : u.tint === 'nat' ? 'natural colours' : '', u.makeup].filter(Boolean).map((x, i) => <span key={i}>{x} </span>) : 'Default')}
          {row('UID', <code className="sa-copy" onClick={() => { navigator.clipboard?.writeText(u.uid); toast({ text: 'UID copied' }); }}>{u.uid.slice(0, 14)}… ⧉</code>)}
        </div>
        <WalletBox u={u} social={social} toast={toast} />
        <div className="ad-actions">
          <button className="btn small ghost" disabled={!custom || !!busy} onClick={() => confirm(`Reset @${u.username}'s look to default?`) && run('look', () => social.admin.resetLook(u.uid), 'Look reset')}>{busy === 'look' ? '…' : '↺ Reset look'}</button>
          {ban
            ? <button className="btn small" disabled={!!busy} onClick={() => run('ban', () => social.admin.unban(u.uid), `@${u.username} can use Nibble again`)}>{busy === 'ban' ? '…' : '✓ Lift suspension'}</button>
            : <button className="btn small ghost warn" disabled={self || !!busy} onClick={() => { const r = prompt(`Suspend @${u.username}? They won't be able to chat, poke or appear online.\n\nReason (optional, they won't see it):`); if (r !== null) run('ban', () => social.admin.ban(u.uid, u.username, r), `@${u.username} suspended`); }}>{busy === 'ban' ? '…' : '⏸ Suspend'}</button>}
          <button className="btn small ghost danger" disabled={self || !!busy} onClick={() => confirm(`Delete @${u.username}'s profile? Their username becomes free again. This can't be undone.`) && run('del', async () => { await social.admin.removeUser(u.uid, u.username); onClose(); }, `Removed @${u.username}`)}>{busy === 'del' ? '…' : '🗑 Remove'}</button>
        </div>
        {self && <p className="ad-foot">You can't suspend or remove your own account.</p>}
      </aside>
    </div>
  );
}

// points, unlocked items and best scores, with admin controls
function WalletBox({ u, social, toast }) {
  const [n, setN] = useState('');
  const [item, setItem] = useState('');
  const [busy, setBusy] = useState(false);
  const w = u.wallet;
  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast({ text: ok }); setN(''); } catch (x) { toast({ err: true, text: niceError(x) }); } setBusy(false); };
  const best = w ? Object.entries(w.best || {}).filter(([, v]) => v > 0) : [];
  const unowned = Object.values(ITEMS).filter((it) => it.price > 0 && !(w && w.owned.includes(it.id)));
  return (
    <div className="ad-wallet">
      <div className="ad-wallet-head"><b>{PT} {w ? w.points : '—'}</b><span>points{w && w.streak ? ` · 🔥 ${w.streak}-day streak` : ''}</span></div>
      {!w && <p className="sa-empty">No wallet yet (they haven’t opened Nibble since points arrived).</p>}
      {w && (
        <>
          <div className="ad-owned">
            {w.owned.length ? w.owned.map((id) => <span key={id} title={ITEMS[id] ? ITEMS[id].label : id}>{ITEMS[id] ? ITEMS[id].emoji : '•'} {ITEMS[id] ? ITEMS[id].label : id}</span>) : <small className="dim">No items unlocked yet</small>}
          </div>
          {best.length > 0 && <div className="ad-best">{best.map(([k, v]) => { const g = SOLO_ALL.find((x) => x.key === k); return <span key={k}>{g ? g.emoji : '🎮'} {g ? g.title : k}: <b>{v}</b></span>; })}</div>}
          <div className="ad-wallet-row">
            <input type="number" value={n} onChange={(e) => setN(e.target.value)} placeholder="e.g. 100" />
            <button className="btn small" disabled={busy || n === ''} onClick={() => run(() => social.admin.setPoints(u.uid, n, 'add'), `${Number(n) >= 0 ? 'Gave' : 'Took'} ${Math.abs(Number(n))} points`)}>＋ Add</button>
            <button className="btn small ghost" disabled={busy || n === ''} onClick={() => run(() => social.admin.setPoints(u.uid, n, 'set'), `Points set to ${n}`)}>Set to</button>
          </div>
          <div className="ad-wallet-row">
            <select value={item} onChange={(e) => setItem(e.target.value)}><option value="">Give an item…</option>{unowned.map((it) => <option key={it.id} value={it.id}>{it.emoji} {it.label} ({it.price} {PT})</option>)}</select>
            <button className="btn small ghost" disabled={busy || !item} onClick={() => run(() => social.admin.grantItem(u.uid, item), 'Item given')}>🎁 Give</button>
            <button className="btn small ghost danger" disabled={busy} onClick={() => confirm(`Reset @${u.username}'s points to 100 and remove their unlocked items?`) && run(() => social.admin.resetWallet(u.uid), 'Wallet reset')}>↺ Reset</button>
          </div>
        </>
      )}
    </div>
  );
}

// games on/off and the points economy (games are single-player)
function GamesTab({ social, state, users, toast, setOpenUid, go }) {
  const cfg = state.config || {};
  const off = Array.isArray(cfg.gamesOff) ? cfg.gamesOff : [];
  const save = async (patch, ok) => { try { await social.admin.setConfig(patch); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const toggleGame = (k) => save({ gamesOff: off.includes(k) ? off.filter((x) => x !== k) : [...off, k] }, off.includes(k) ? 'Game switched on' : 'Game switched off');
  const wallets = users.filter((u) => u.wallet);
  const total = wallets.reduce((t, u) => t + u.wallet.points, 0);
  const today = Math.floor(Date.now() / DAY);
  const earnedToday = wallets.reduce((t, u) => t + (u.wallet.day === today ? u.wallet.earned : 0), 0);
  const sold = countBy(wallets.flatMap((u) => u.wallet.owned), (x) => x).slice(0, 8);
  const rich = [...wallets].sort((a, b) => b.wallet.points - a.wallet.points).slice(0, 8);
  const name = (uid) => (users.find((u) => u.uid === uid) || {}).username || uid.slice(0, 6);
  const Sw = ({ on, onChange }) => <button className={'ad-switch' + (on ? ' on' : '')} onClick={onChange} aria-pressed={on}><i /></button>;
  return (
    <>
      <div className="ad-kpis ad-kpis4">
        <Kpi n={`${PT} ${total.toLocaleString()}`} label="Points held" sub={`${wallets.length} wallets`} color={C.yellow} />
        <Kpi n={earnedToday.toLocaleString()} label="Earned today" sub="by everyone" color={C.mint} />
        <Kpi n={wallets.reduce((t, u) => t + u.wallet.owned.length, 0)} label="Items unlocked" sub="all time" color={C.pink} />
        <Kpi n={SOLO_ALL.length} label="Games" sub="all single-player" color={C.cyan} />
      </div>
      <div className="sa-card">
        <h3>🎮 Switches</h3>
        <div className="ad-switches">
          <label><Sw on={cfg.games !== false} onChange={() => save({ games: cfg.games === false }, cfg.games === false ? 'Games are on for everyone' : 'Games switched off for everyone')} /><span><b>Games</b><small>All mini games</small></span></label>
          <label><Sw on={cfg.shop !== false} onChange={() => save({ shop: cfg.shop === false }, cfg.shop === false ? 'Shop is open' : 'Shop closed (nobody can buy)')} /><span><b>Shop</b><small>Unlocking items with points</small></span></label>
        </div>
        <h3 style={{ marginTop: 18 }}>Each game <small>{cfg.games === false ? 'all games are off right now' : 'switch single games off'}</small></h3>
        <div className="ad-gamelist">
          {SOLO_ALL.map((g) => [g.key, g.emoji, g.title, 'Solo']).map(([k, e, t, kind]) => {
            const best = users.filter((u) => u.wallet && u.wallet.best[k] > 0).sort((a, b) => b.wallet.best[k] - a.wallet.best[k])[0];
            return (
              <div key={k} className={'ad-game' + (off.includes(k) || cfg.games === false ? ' off' : '')}>
                <span className="ad-game-e">{e}</span>
                <span className="ad-game-t"><b>{t}</b><small>{kind}{best ? ` · top: @${best.username} ${best.wallet.best[k]}` : ''}</small></span>
                <Sw on={!off.includes(k)} onChange={() => toggleGame(k)} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="ad-grid2">
        <div className="sa-card">
          <h3>🏆 Most points</h3>
          {rich.length === 0 && <p className="sa-empty">No wallets yet. They appear once people open the new version.</p>}
          {rich.map((u, i) => (
            <div key={u.uid} className="ad-lb-row ad-click" onClick={() => { go('users'); setOpenUid(u.uid); }}>
              <em>{i + 1}</em><Ava u={u} size={34} /><b>@{u.username}</b><span>{PT} {u.wallet.points}</span>
            </div>
          ))}
        </div>
        <div className="sa-card">
          <h3>🛍 Most unlocked</h3>
          <HBars rows={sold.map(([id, n]) => ({ label: ITEMS[id] ? `${ITEMS[id].emoji} ${ITEMS[id].label}` : id, value: n, color: C.pink }))} max={sold.length ? sold[0][1] : 1} />
        </div>
      </div>
    </>
  );
}

function Announce({ social, state, history, toast }) {
  const [level, setLevel] = useState('info');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [hours, setHours] = useState(0);
  const [busy, setBusy] = useState(false);
  const bc = state.broadcast;
  const expired = bc && bc.expiresAt && Date.now() > bc.expiresAt;
  const fill = (t) => { setLevel(t.level || 'info'); setTitle(t.title || ''); setText(t.text || ''); setLink(t.link || ''); };
  const send = async (e) => {
    e.preventDefault();
    if (bc && !expired && !confirm('This replaces the announcement that is live right now. Send?')) return;
    setBusy(true);
    try {
      await social.admin.broadcast({ level, title, text, link, hours });
      toast({ text: 'Announcement is live for everyone' });
      setTitle(''); setText(''); setLink('');
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  const left = bc && bc.expiresAt ? bc.expiresAt - Date.now() : 0;
  return (
    <>
      <div className="sa-card">
        <h3>Live now</h3>
        {bc && !expired ? (
          <>
            <BannerView level={bc.level} title={bc.title} text={bc.text} link={bc.link} />
            <p className="ad-foot">Sent by @{bc.by || 'admin'} · {ago(ms(bc.at))} · {bc.expiresAt ? `ends in ${left > 3600_000 ? Math.round(left / 3600_000) + 'h' : Math.max(1, Math.round(left / 60_000)) + 'm'}` : 'stays until cleared'}</p>
            <button className="btn small ghost" onClick={async () => { await social.admin.clearBroadcast(); toast({ text: 'Announcement cleared' }); }}>Clear it now</button>
          </>
        ) : <p className="sa-empty">Nothing live{expired ? ' (the last one expired)' : ''}. Compose one below.</p>}
      </div>

      <div className="sa-card">
        <h3>📣 New announcement</h3>
        <div className="ad-templates">{TEMPLATES.map((t) => <button key={t.label} onClick={() => fill(t)}>{t.label}</button>)}</div>
        <form className="sa-form" onSubmit={send}>
          <div className="ad-seg">{LEVELS.map((l) => <button type="button" key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{LEVEL[l].icon} {LEVEL[l].label}</button>)}</div>
          <label><span>Title <small>optional</small></span><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Heads up!" /></label>
          <label><span>Message <small>{text.length}/200</small></span><textarea value={text} maxLength={200} rows={3} onChange={(e) => setText(e.target.value)} placeholder="New update is live — open the tray menu → Update Nibble." /></label>
          <div className="ad-two">
            <label><span>Button link <small>optional</small></span><input value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} placeholder="https://… or /Nibble-Reinstall-Guide.pdf" /></label>
            <label><span>Show for</span><select value={hours} onChange={(e) => setHours(Number(e.target.value))}>{DURATIONS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select></label>
          </div>
          <div className="ad-preview"><span>Preview</span><BannerView level={level} title={title.trim()} text={text.trim() || 'Your message appears here.'} link={link.trim()} /></div>
          <button className="btn" disabled={!text.trim() || busy}>{busy ? 'Sending…' : 'Send to everyone'}</button>
          <p className="ad-foot">Shows as a banner in the app for everyone signed in. Desktop users also get a Windows notification.</p>
        </form>
      </div>

      <div className="sa-card">
        <h3>History <small>last {history ? history.length : 0}</small></h3>
        {history === null && <p className="sa-empty">History needs the latest Firestore rules — publish them (Settings shows the status).</p>}
        {history && !history.length && <p className="sa-empty">No announcements sent yet.</p>}
        {history && history.map((h) => (
          <div key={h.hid} className="ad-hist">
            <span className="ad-hist-ico">{(LEVEL[h.level] || LEVEL.info).icon}</span>
            <div><b>{h.title || (LEVEL[h.level] || LEVEL.info).label}</b><p>{h.text}</p><small>@{h.by} · {ago(h.at)}{h.link ? ' · has link' : ''}</small></div>
            <button className="btn small ghost" onClick={() => { fill(h); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Reuse</button>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsTab({ social, state, users, banned, history, latest, toast, setOpenUid, go }) {
  const cfg = state.config || {};
  const [minV, setMinV] = useState(cfg.minVersion || '');
  const [msg, setMsg] = useState(cfg.updateMsg || '');
  const [notice, setNotice] = useState(cfg.notice || '');
  const [nLevel, setNLevel] = useState(cfg.noticeLevel || 'info');
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || !state.config) return;
    synced.current = true;
    setMinV(state.config.minVersion || ''); setMsg(state.config.updateMsg || ''); setNotice(state.config.notice || ''); setNLevel(state.config.noticeLevel || 'info');
  }, [state.config]);
  const save = async (patch, ok) => { try { await social.admin.setConfig(patch); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const desk = users.filter((u) => u.client === 'desktop' && u.ver);
  const affected = /^\d+\.\d+\.\d+$/.test(minV) ? desk.filter((u) => verLess(u.ver, minV)).length : 0;
  const checks = [
    ['Announcement history', history !== null],
    ['Suspensions', banned !== null],
    ['Site config', state.config !== null || history !== null],
  ];
  const rulesOk = checks.every(([, ok]) => ok);

  return (
    <>
      <div className="sa-card">
        <h3>⬆️ Minimum desktop version</h3>
        <p className="sa-sub">Desktop apps older than this show an <b>Update needed</b> banner with an Update button and the reinstall guide. Leave empty to turn it off.</p>
        <div className="ad-two">
          <label className="ad-lbl"><span>Minimum version</span><input value={minV} onChange={(e) => setMinV(e.target.value.trim())} placeholder={latest || '2.0.6'} /></label>
          <label className="ad-lbl"><span>Message <small>optional</small></span><input value={msg} maxLength={160} onChange={(e) => setMsg(e.target.value)} placeholder="This version has bugs we've fixed — please update." /></label>
        </div>
        <div className="sa-inline">
          {latest && <button className="btn small ghost" onClick={() => setMinV(latest)}>Use latest (v{latest})</button>}
          <button className="btn small" onClick={() => save({ minVersion: minV, updateMsg: msg }, minV ? `Desktop apps below v${minV} will be asked to update` : 'Update requirement turned off')}>Save</button>
          <span className="ad-impact">{minV ? `${affected} of ${desk.length} reporting desktop app${desk.length === 1 ? '' : 's'} will see it` : 'Off'}</span>
        </div>
      </div>

      <div className="sa-card">
        <h3>📌 Site notice</h3>
        <p className="sa-sub">A pinned banner that stays until you remove it — for things like maintenance windows. Separate from announcements, so both can show at once.</p>
        <div className="ad-seg" style={{ marginBottom: 10 }}>{LEVELS.map((l) => <button key={l} className={nLevel === l ? 'on' : ''} onClick={() => setNLevel(l)}>{LEVEL[l].icon} {LEVEL[l].label}</button>)}</div>
        <textarea className="ad-ta" value={notice} maxLength={200} rows={2} onChange={(e) => setNotice(e.target.value)} placeholder="Messages may be slow tonight while we upgrade the servers." />
        {notice.trim() && <div className="ad-preview"><span>Preview</span><BannerView level={nLevel} text={notice.trim()} /></div>}
        <div className="sa-inline">
          <button className="btn small" disabled={!notice.trim()} onClick={() => save({ notice, noticeLevel: nLevel }, 'Notice pinned for everyone')}>Pin notice</button>
          {cfg.notice && <button className="btn small ghost" onClick={() => { setNotice(''); save({ notice: '' }, 'Notice removed'); }}>Remove</button>}
          <span className="ad-impact">{cfg.notice ? '● Live now' : 'Not showing'}</span>
        </div>
      </div>

      <div className="sa-card">
        <h3>⏸ Suspended accounts <small>{banned ? banned.length : '—'}</small></h3>
        {banned === null && <p className="sa-empty">Needs the latest Firestore rules.</p>}
        {banned && !banned.length && <p className="sa-empty">No one is suspended. Suspend someone from their profile in Users.</p>}
        {banned && banned.map((b) => (
          <div key={b.uid} className="ad-hist">
            <span className="ad-hist-ico">⏸</span>
            <div><b className="ad-click" onClick={() => { go('users', 'banned'); setOpenUid(b.uid); }}>@{b.username || b.uid.slice(0, 8)}</b><p>{b.reason || 'No reason given'}</p><small>by @{b.by} · {ago(b.at)}</small></div>
            <button className="btn small ghost" onClick={async () => { try { await social.admin.unban(b.uid); toast({ text: 'Suspension lifted' }); } catch (x) { toast({ err: true, text: niceError(x) }); } }}>Lift</button>
          </div>
        ))}
      </div>

      <div className="sa-card">
        <h3>🛡 Rules & access</h3>
        <div className="ad-checks">
          {checks.map(([l, ok]) => <span key={l} className={ok ? 'ok' : 'bad'}>{ok ? '✓' : '!'} {l}</span>)}
        </div>
        <p className="sa-sub">{rulesOk ? 'Your Firestore rules support every admin feature.' : 'Some features need the latest firestore.rules — paste it in Firebase console → Firestore → Rules → Publish.'}</p>
        <p className="sa-sub" style={{ marginBottom: 6 }}>Your admin UID (to add another admin: Firestore → <b>admins</b> collection → new document with their UID as the ID):</p>
        <code className="sa-copy" onClick={() => { navigator.clipboard?.writeText(state.user.uid); toast({ text: 'UID copied' }); }}>{state.user.uid} ⧉</code>
      </div>
    </>
  );
}

// ---------- shell ----------
// ---------- Reports: bug reports + feedback from the Hub and the website ----------
const REPORT_CAT = { like: '💚 Likes', dislike: '😕 Doesn’t like', feature: '✨ Feature request', idea: '💡 Idea', problem: '🧩 Problem', general: '✉️ Contact', support: '🛟 Contact: help', press: '📰 Contact: press', partner: '🤝 Contact: partnership' };
function ReportsTab({ social, users, toast, go, setOpenUid, reply }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [show, setShow] = useState('open');
  const [big, setBig] = useState('');
  const load = () => { setErr(''); social.admin.reports().then(setList).catch((e) => { setList([]); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, ok) => { try { await fn(); if (ok) toast({ text: ok }); load(); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const all = list || [];
  const shown = all.filter((r) => (show === 'open' ? r.status !== 'done' : show === 'bug' ? r.kind === 'bug' : show === 'feedback' ? r.kind === 'feedback' : show === 'contact' ? r.kind === 'contact' : true));
  const n = (f) => all.filter(f).length;
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={n((r) => r.status === 'new')} label="New" sub="not looked at yet" color={C.pink} onClick={() => setShow('open')} />
        <Kpi n={n((r) => r.kind === 'bug' && r.status !== 'done')} label="Open bugs" sub="not done" color={C.coral} onClick={() => setShow('bug')} />
        <Kpi n={n((r) => r.kind === 'feedback')} label="Feedback" sub="likes, ideas, requests" color={C.mint} onClick={() => setShow('feedback')} />
        <Kpi n={n((r) => r.kind === 'contact' && r.status !== 'done')} label="Messages" sub="from the contact form" color={C.violet} onClick={() => setShow('contact')} />
        <Kpi n={all.length} label="Latest" sub="newest 50" color={C.cyan} onClick={() => setShow('all')} />
      </div>
      <div className="sa-card">
        <h3>📬 Reports <small>{shown.length}</small>
          <span className="rp-filter">{[['open', 'Open'], ['bug', 'Bugs'], ['feedback', 'Feedback'], ['contact', 'Contact'], ['all', 'All']].map(([k, l]) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{l}</button>)}</span>
          <button className="btn small ghost" onClick={load}>Refresh</button>
        </h3>
        {list === null && <p className="sa-empty">Loading…</p>}
        {err && <p className="sa-empty">{err.includes('Not allowed') ? 'Publish the latest Firestore rules to see reports.' : err}</p>}
        {list && !err && shown.length === 0 && <p className="sa-empty">Nothing here. 🎉</p>}
        {shown.map((r) => {
          const u = r.uid && users.find((x) => x.uid === r.uid);
          return (
            <article key={r.id} className={'rp rp-' + r.status}>
              <header>
                <span className="rp-kind">{r.kind === 'bug' ? '🐛 Bug' : REPORT_CAT[r.cat] || '💬 Feedback'}</span>
                <b>{r.title || (r.kind === 'bug' ? r.what : r.text).slice(0, 80)}</b>
                <span className={'rp-status rp-s-' + r.status}>{r.status}</span>
              </header>
              <p className="rp-who">
                {u ? <button className="sa-link" onClick={() => { go('users'); setOpenUid(u.uid); }}>@{u.username}</button> : r.username ? '@' + r.username : r.name || 'Website visitor'}
                {r.contact ? <> · reply to: {/@/.test(r.contact) ? <a className="sa-link" href={`mailto:${r.contact}?subject=${encodeURIComponent('Re: ' + (r.title || 'Nibble'))}`}>{r.contact}</a> : r.contact}</> : ''} · {[r.ver && 'v' + r.ver, r.os, r.client].filter(Boolean).join(' · ')} · {ago(r.at)}
              </p>
              {r.kind === 'bug' ? (
                <dl className="rp-body">
                  <dt>What happened</dt><dd>{r.what}</dd>
                  {r.doing && <><dt>Doing</dt><dd>{r.doing}</dd></>}
                  {r.expected && <><dt>Expected</dt><dd>{r.expected}</dd></>}
                  {r.actual && <><dt>Instead</dt><dd>{r.actual}</dd></>}
                </dl>
              ) : <p className="rp-text">{r.text}</p>}
              {r.shot && <button className="rp-shot" onClick={() => setBig(r.shot)} title="Open screenshot"><img src={r.shot} alt="Screenshot" /></button>}
              <footer>
                {r.status !== 'seen' && r.status !== 'done' && <button className="btn small ghost" onClick={() => act(() => social.admin.setReport(r.id, 'seen'))}>Mark seen</button>}
                {r.status !== 'done' ? <button className="btn small" onClick={() => act(() => social.admin.setReport(r.id, 'done'), 'Marked done')}>Done</button>
                  : <button className="btn small ghost" onClick={() => act(() => social.admin.setReport(r.id, 'new'))}>Reopen</button>}
                {/@/.test(r.contact || '') && <button className="btn small ghost" onClick={() => reply({ to: r.contact, subject: 'Re: ' + (r.title || (r.kind === 'bug' ? 'your bug report' : 'your message to Nibble')), message: `Hi${r.name ? ' ' + r.name.split(' ')[0] : ''},\n\n\n\n> ${(r.kind === 'bug' ? r.what : r.text).slice(0, 600).replace(/\n/g, '\n> ')}` })}>✉️ Reply by email</button>}
                <button className="btn small ghost" onClick={() => { if (window.confirm('Delete this report?')) act(() => social.admin.deleteReport(r.id), 'Deleted'); }}>Delete</button>
              </footer>
            </article>
          );
        })}
      </div>
      {big && <div className="rp-big" onClick={() => setBig('')} role="dialog" aria-label="Screenshot"><img src={big} alt="Screenshot, full size" /></div>}
    </>
  );
}

// ---------- Firebase usage: real numbers from Cloud Monitoring + controls that use less ----------
const fmtN = (n) => Math.round(n || 0).toLocaleString();
function Meter({ label, used, limit, color }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 90 ? C.coral : pct >= 70 ? C.yellow : color;
  return (
    <div className="us-meter">
      <div className="us-meter-top"><b>{label}</b><span>{fmtN(used)} <small>/ {fmtN(limit)}</small></span></div>
      <div className="us-bar"><i style={{ width: pct + '%', background: tone }} /></div>
      <small className="us-pct" style={{ color: tone }}>{pct >= 100 ? 'Limit reached: Firebase refuses more until the reset' : `${Math.round(pct)}% of the free daily limit`}</small>
    </div>
  );
}
function HourBars({ hours }) {
  const max = Math.max(1, ...hours.map((h) => h.reads + h.writes));
  return (
    <div className="us-hours" role="img" aria-label="Reads and writes per hour today">
      {hours.map((h) => (
        <div key={h.t} className="us-hour" title={`${new Date(h.t).toLocaleTimeString([], { hour: 'numeric' })}: ${fmtN(h.reads)} reads, ${fmtN(h.writes)} writes`}>
          <i className="r" style={{ height: (h.reads / max) * 100 + '%' }} />
          <i className="w" style={{ height: (h.writes / max) * 100 + '%' }} />
          <small>{new Date(h.t).toLocaleTimeString([], { hour: 'numeric' }).replace(/\s?[AP]M/i, (x) => x.trim()[0].toLowerCase())}</small>
        </div>
      ))}
    </div>
  );
}
function Countdown({ at }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const left = Math.max(0, at - Date.now());
  const h = Math.floor(left / 3600_000), m = Math.floor((left % 3600_000) / 60_000);
  return <>{h}h {m}m <small>({new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} your time)</small></>;
}

function UsageTab({ social, state, users, toast }) {
  const cfg = state.config || {};
  const lim = cfg.limits || {};
  const [u, setU] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ matches: lim.matches || 0, solo: lim.solo || 0 });
  useEffect(() => setForm({ matches: lim.matches || 0, solo: lim.solo || 0 }), [lim.matches, lim.solo]);
  const load = () => { setBusy(true); setErr(''); social.admin.usage().then((d) => { setU(d); if (d.error) setErr(d.error); }).catch((e) => setErr(niceError(e))).finally(() => setBusy(false)); };
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 5 * 60_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (patch, ok) => { try { await social.admin.setConfig(patch); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const saveLimits = (patch, ok) => save({ limits: { matches: lim.matches || 0, solo: lim.solo || 0, music: lim.music !== false, ...patch } }, ok);
  const Sw = ({ on, onChange }) => <button className={'ad-switch' + (on ? ' on' : '')} onClick={onChange} aria-pressed={on}><i /></button>;

  // rough estimate of a day at the current activity (labelled as an estimate in the UI)
  const saver = !!cfg.saver;
  const online = users.filter((x) => x.online);
  const inRooms = online.filter((x) => x.room).length;
  const rooms = new Set(online.map((x) => x.room).filter(Boolean)).size;
  const beat = saver ? 200 : 100, roomBeat = saver ? 110 : 55;
  const presW = online.length * (86400 / beat);
  const roomW = inRooms * (86400 / roomBeat);
  const est = [
    { label: 'Online check-ins', w: presW, r: presW * 3, color: C.mint, hint: `${online.length} online, every ${beat / 60 > 2 ? Math.round(beat / 60) + ' min' : beat + ' s'}` },
    { label: 'Music rooms', w: roomW, r: roomW * Math.max(1, inRooms / Math.max(1, rooms)), color: C.violet, hint: `${inRooms} listening in ${rooms} room${rooms === 1 ? '' : 's'}` },
    { label: 'This dashboard', w: 0, r: presW + users.length * 3, color: C.pink, hint: 'while it stays open' },
  ];
  const estW = est.reduce((t, e) => t + e.w, 0), estR = est.reduce((t, e) => t + e.r, 0);
  const maxE = Math.max(1, ...est.map((e) => e.r + e.w));

  return (
    <>
      {u && u.configured && !u.error && (
        <>
          <div className="us-meters">
            <Meter label="Reads today" used={u.today.reads} limit={u.limits.reads} color={C.mint} />
            <Meter label="Writes today" used={u.today.writes} limit={u.limits.writes} color={C.cyan} />
            <Meter label="Deletes today" used={u.today.deletes} limit={u.limits.deletes} color={C.violet} />
          </div>
          <p className="us-note">Free limits reset in <Countdown at={u.resetAt} />. Google’s numbers run a few minutes behind. Updated {new Date(u.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. <button className="btn small ghost" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Refresh'}</button></p>
          <div className="ad-grid2">
            <div className="sa-card">
              <h3>📈 Today, hour by hour <small><i className="us-key r" /> reads <i className="us-key w" /> writes</small></h3>
              {u.hours.length ? <HourBars hours={u.hours} /> : <p className="sa-empty">Nothing recorded yet today.</p>}
            </div>
            <div className="sa-card">
              <h3>🗓 Last 7 days</h3>
              <HBars rows={u.days.slice().reverse().map((d) => ({ label: new Date(d.day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }), value: d.reads, color: d.reads > u.limits.reads ? C.coral : C.mint }))} max={Math.max(u.limits.reads, ...u.days.map((d) => d.reads))} unit=" reads" />
              <p className="sa-sub" style={{ marginTop: 8 }}>Red days went over the free {fmtN(u.limits.reads)} reads.</p>
            </div>
          </div>
        </>
      )}
      {(!u || !u.configured || u.error) && (
        <div className="sa-card us-setup">
          <h3>📈 Firebase usage {busy && <small>loading…</small>}</h3>
          {err && <p className="sa-sub" style={{ color: C.coral }}>{err}</p>}
          {u && u.local ? <p className="sa-sub">Live numbers show on the real site (not in local test mode).</p> : (
            <>
              <p className="sa-sub">To see real reads and writes here, give the site read-only access to Google’s usage numbers (one time, about 5 minutes):</p>
              <ol className="us-steps">
                <li>Open <a className="sa-link" href="https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=nibblex" target="_blank" rel="noreferrer">Cloud Monitoring API</a> for the <b>nibblex</b> project and click <b>Enable</b> (it’s free).</li>
                <li>Open <a className="sa-link" href="https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=nibblex" target="_blank" rel="noreferrer">Create service account</a>. Name it <code>nibble-usage</code>, click <b>Create and continue</b>, pick the role <b>Monitoring Viewer</b>, then <b>Done</b>.</li>
                <li>Open the new account → <b>Keys</b> → <b>Add key</b> → <b>Create new key</b> → <b>JSON</b>. A .json file downloads.</li>
                <li>In Vercel → project <b>nibble</b> → Settings → Environment Variables, add <code>GCP_USAGE_KEY</code> and paste the whole contents of that file as the value (Production). Then redeploy.</li>
              </ol>
              <p className="sa-sub">The key can only read usage numbers. It can’t see or change anyone’s data.</p>
            </>
          )}
        </div>
      )}

      <div className="sa-card">
        <h3>💡 What uses it right now <small>rough estimate for a full day at this activity</small></h3>
        <p className="sa-sub">About <b>{fmtN(estW)}</b> writes and <b>{fmtN(estR)}</b> reads a day if things stay like this ({fmtN((estW / 20000) * 100)}% / {fmtN((estR / 50000) * 100)}% of the free limits).</p>
        <div className="us-est">
          {est.map((e) => (
            <div key={e.label} className="us-est-row">
              <span><b>{e.label}</b><small>{e.hint}</small></span>
              <div className="us-bar"><i style={{ width: ((e.r + e.w) / maxE) * 100 + '%', background: e.color }} /></div>
              <em>{fmtN(e.w)} w · {fmtN(e.r)} r</em>
            </div>
          ))}
        </div>
      </div>

      <div className="sa-card">
        <h3>🪫 Use less</h3>
        <p className="sa-sub">These apply to everyone within a minute. Limits count per person per day.</p>
        <div className="ad-switches us-switches">
          <label><Sw on={saver} onChange={() => save({ saver: !saver }, saver ? 'Saver mode off' : 'Saver mode on: about half the writes')} /><span><b>Saver mode</b><small>Online check-ins every ~3 min instead of ~2 (dots update slower), slower music sync, friends-only leaderboard</small></span></label>
          <label><Sw on={lim.music !== false} onChange={() => saveLimits({ music: lim.music === false }, lim.music === false ? 'Listen together is back on' : 'Listen together paused (no new rooms)')} /><span><b>Listen together</b><small>Turn off to stop new music rooms</small></span></label>
        </div>
        <form className="us-limits" onSubmit={(e) => { e.preventDefault(); saveLimits({ matches: form.matches, solo: form.solo }, 'Daily limits saved'); }}>
          <label><b>Solo games that earn points per day</b><small>After this, games still play, just without points. 0 = no limit.</small>
            <input type="number" min="0" max="500" value={form.solo} onChange={(e) => setForm({ ...form, solo: e.target.value })} /></label>
          <button className="btn small">Save limits</button>
        </form>
        <p className="sa-sub" style={{ marginTop: 10 }}>Games are single-player, so they only write when points are earned. To switch single games off, use Games &amp; points → Each game.</p>
      </div>
    </>
  );
}

// ---------- Email (Resend, from hello@meetnibble.com) ----------
const EMAIL_TEMPLATES = [
  { label: '👋 Reply to a message', subject: 'Re: your message to Nibble', message: 'Hi there,\n\nThanks for getting in touch!\n\n' },
  { label: '🐛 Bug fixed', subject: 'We fixed the bug you reported', message: 'Hi,\n\nThanks for reporting that bug. It’s fixed in the latest version of Nibble: open the tray menu → Update Nibble (or reinstall from meetnibble.com) to get it.\n\n' },
  { label: '🎉 New release', subject: 'Nibble just got an update', message: 'Hi,\n\nA new version of Nibble is out! Here’s what’s new:\n\n• \n\nOpen the tray menu → Update Nibble to get it.\n\n' },
];
const EMAIL_STATUS = { delivered: C.mint, sent: C.cyan, opened: C.mint, clicked: C.mint, bounced: C.coral, complained: C.coral, failed: C.coral, delivery_delayed: C.yellow, queued: C.slate, scheduled: C.slate };
function EmailTab({ social, toast, draft, setDraft }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => { setErr(''); social.admin.email().then(setInfo).catch((e) => { setInfo({}); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draft) return;
    setTo(draft.to || ''); setSubject(draft.subject || ''); setMessage(draft.message || '');
    setDraft(null);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = to.split(/[\s,;]+/).filter(Boolean).length;
  const send = async (e) => {
    e.preventDefault();
    if (n > 1 && !window.confirm(`Send this to ${n} people? Each gets their own copy.`)) return;
    setBusy(true);
    try {
      const r = await social.admin.email({ to, subject, message });
      toast({ text: r.failed ? `Sent ${r.ok}, ${r.failed} failed` : `Sent ✉️ to ${r.ok} ${r.ok === 1 ? 'person' : 'people'}` });
      setTo(''); setSubject(''); setMessage('');
      setTimeout(load, 1500);
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  const ready = info && (info.resend || info.smtp);
  return (
    <>
      <div className="sa-card">
        <h3>✉️ Email <small>{info ? (info.resend ? 'Resend · meetnibble.com' : info.smtp ? 'SMTP fallback' : 'not set up') : 'checking…'}</small><button className="btn small ghost" onClick={load}>Refresh</button></h3>
        {err && <p className="sa-empty">{err}</p>}
        {info && !err && (ready
          ? <p className="ad-foot" style={{ marginTop: 0 }}>Emails go out from <b>{info.from}</b>. Replies land in the hello@meetnibble.com inbox. Free plan: 100 emails a day, 3,000 a month.</p>
          : <p className="sa-empty">Email isn’t set up yet. Add <b>RESEND_API_KEY</b> in Vercel → Settings → Environment Variables, then redeploy.</p>)}
      </div>

      <div className="sa-card">
        <h3>New email</h3>
        <div className="ad-templates">{EMAIL_TEMPLATES.map((t) => <button key={t.label} onClick={() => { setSubject(t.subject); setMessage(t.message); }}>{t.label}</button>)}</div>
        <form className="sa-form" onSubmit={send}>
          <label><span>To <small>{n > 1 ? `${n} people · each gets their own copy` : 'one or more addresses, separated by commas'}</small></span><input value={to} maxLength={2400} onChange={(e) => setTo(e.target.value)} placeholder="friend@example.com" inputMode="email" autoComplete="off" /></label>
          <label><span>Subject <small>{subject.length}/150</small></span><input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="Thanks for trying Nibble!" /></label>
          <label><span>Message <small>{message.length.toLocaleString()}/20,000</small></span><textarea value={message} maxLength={20000} rows={9} onChange={(e) => setMessage(e.target.value)} placeholder="Write it like a normal email. A “The Nibble team” sign-off is added for you." /></label>
          <button className="btn" disabled={!ready || busy || !to.trim() || !subject.trim() || !message.trim()}>{busy ? 'Sending…' : n > 1 ? `Send to ${n} people` : 'Send email'}</button>
          <p className="ad-foot">Up to 20 people per email and 60 emails an hour. For a message to everyone in the app, use Announcements.</p>
        </form>
      </div>

      <div className="sa-card">
        <h3>Recently sent <small>{info && info.recent ? info.recent.length : 0}</small></h3>
        {info && info.resend && !(info.recent || []).length && <p className="sa-empty">Nothing sent yet.</p>}
        {info && !info.resend && <p className="sa-empty">The list of sent emails shows once Resend is set up.</p>}
        {(info && info.recent || []).map((m) => (
          <div key={m.id} className="ad-hist">
            <span className="ad-hist-ico">✉️</span>
            <div><b>{m.subject || '(no subject)'}</b><p>to {m.to}</p><small><span style={{ color: EMAIL_STATUS[m.status] || C.slate, fontWeight: 700 }}>{(m.status || 'sent').replace('_', ' ')}</span>{m.at ? ' · ' + ago(Date.parse(String(m.at).replace(' ', 'T').replace(/\+00(:00)?$/, 'Z'))) : ''}</small></div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Marketing: contacts (import) + campaigns with designed templates (Resend broadcasts) ----------
const BC_STATUS = { sent: C.mint, queued: C.cyan, scheduled: C.yellow, draft: C.slate, sending: C.cyan, failed: C.coral, canceled: C.slate };
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function csvRows(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return { rows: [], columns: [] };
  const columns = head.map((k, i) => k.trim() || 'col' + (i + 1));
  return { columns, rows: body.slice(0, 5000).map((r) => Object.fromEntries(columns.map((k, i) => [k, (r[i] || '').trim()]))) };
}
function guessCols(columns, rows) {
  const share = (k) => rows.slice(0, 200).filter((r) => MAIL_RE.test(r[k] || '')).length / Math.max(1, Math.min(200, rows.length));
  const email = columns.map((k) => [k, share(k)]).sort((x, y) => y[1] - x[1]).find(([, v]) => v > 0.3);
  const pick = (re) => columns.find((k) => re.test(k.split('.').pop())) || '';
  return { email: email ? email[0] : '', first: pick(/^(first[_ -]?name|firstname|given[_ -]?name|fname)$/i), last: pick(/^(last[_ -]?name|lastname|surname|family[_ -]?name|lname)$/i), name: pick(/^(full[_ -]?name|fullname|name|attendee[_ -]?name|display[_ -]?name)$/i) };
}

function ContactsCard({ social, info, toast, reload }) {
  const [url, setUrl] = useState('');
  const [src, setSrc] = useState(null); // { rows, columns, total }
  const [map, setMap] = useState({ email: '', first: '', last: '', name: '' });
  const [list, setList] = useState('imported');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null); // { done, total, added, existing, failed }
  const load = (d) => { setSrc(d); setMap({ email: '', first: '', last: '', name: '', ...d.guess }); setProg(null); setConsent(false); };
  const readLink = async () => {
    setBusy('read');
    try { const d = await social.admin.marketing({ action: 'source', url }); load(d); toast({ text: `Found ${d.rows.length.toLocaleString()} rows` }); }
    catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy('');
  };
  const readFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || '');
      try {
        const j = JSON.parse(text);
        const find = (v, d = 0) => (Array.isArray(v) ? v : v && typeof v === 'object' && d < 3 ? Object.values(v).map((x) => find(x, d + 1)).find((x) => x && x.length) : null);
        const recs = (find(j) || []).filter((x) => x && typeof x === 'object').slice(0, 5000);
        const rows = recs.map((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => [k, String(v).trim()])));
        const columns = [...new Set(rows.flatMap((x) => Object.keys(x)))];
        load({ rows, columns, total: recs.length, guess: guessCols(columns, rows) });
      } catch {
        const d = csvRows(text);
        load({ ...d, total: d.rows.length, guess: guessCols(d.columns, d.rows) });
      }
    };
    r.readAsText(file);
  };
  // the people to import, cleaned and de-duplicated
  const people = useMemo(() => {
    if (!src || !map.email) return { ok: [], bad: 0, dup: 0 };
    const seen = new Set(); let bad = 0, dup = 0; const ok = [];
    for (const r of src.rows) {
      const email = String(r[map.email] || '').trim().toLowerCase();
      if (!MAIL_RE.test(email)) { bad++; continue; }
      if (seen.has(email)) { dup++; continue; }
      seen.add(email);
      let first = map.first ? r[map.first] : '', last = map.last ? r[map.last] : '';
      if (!first && map.name && r[map.name]) { const parts = String(r[map.name]).trim().split(/\s+/); first = parts[0]; last = last || parts.slice(1).join(' '); }
      ok.push({ email, first: String(first || '').slice(0, 40), last: String(last || '').slice(0, 40) });
    }
    return { ok, bad, dup };
  }, [src, map]);
  const run = async () => {
    if (!window.confirm(`Import ${people.ok.length.toLocaleString()} contacts into “${list === 'imported' ? 'Imported contacts' : 'Subscribers'}”?`)) return;
    setBusy('import');
    const t = { done: 0, total: people.ok.length, added: 0, existing: 0, failed: 0 };
    setProg({ ...t });
    for (let i = 0; i < people.ok.length; i += 25) {
      const chunk = people.ok.slice(i, i + 25);
      try {
        const r = await social.admin.marketing({ action: 'import', list, consent: true, contacts: chunk });
        t.added += r.added || 0; t.existing += r.existing || 0; t.failed += r.failed || 0;
      } catch (x) { t.failed += chunk.length; toast({ err: true, text: niceError(x) }); if (/Admins|Sign in|set up/.test(niceError(x))) break; }
      t.done = Math.min(people.ok.length, i + 25);
      setProg({ ...t });
    }
    setBusy('');
    toast({ text: `Imported: ${t.added} new, ${t.existing} already there${t.failed ? `, ${t.failed} failed` : ''}` });
    reload();
  };
  const cols = (src && src.columns) || [];
  const Sel = ({ k, label, optional }) => (
    <label><span>{label}{optional && <small> optional</small>}</span>
      <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}><option value="">{optional ? '— none —' : 'Pick a column'}</option>{cols.map((c) => <option key={c} value={c}>{c}</option>)}</select>
    </label>
  );
  return (
    <div className="sa-card">
      <h3>👥 Contacts <small>{info && info.lists ? `${(info.lists.subscribers.total || 0).toLocaleString()} subscribers · ${(info.lists.imported.total || 0).toLocaleString()} imported` : ''}</small></h3>
      <p className="ad-foot" style={{ marginTop: 0 }}>Bring in a list you already have: paste a link to a JSON or CSV file (for example your events database), or upload a .csv / .json file. Nothing is saved until you press Import.</p>
      <div className="ad-import-src">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… link to a JSON or CSV list" inputMode="url" />
        <button className="btn small" disabled={!/^https:\/\//.test(url.trim()) || !!busy} onClick={readLink}>{busy === 'read' ? 'Reading…' : 'Read link'}</button>
        <label className="btn small ghost ad-file">Upload file<input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => readFile(e.target.files && e.target.files[0])} /></label>
      </div>
      {src && (
        <>
          <div className="ad-two" style={{ marginTop: 14 }}>
            <Sel k="email" label="Email column" />
            <Sel k="name" label="Full name column" optional />
          </div>
          <div className="ad-two">
            <Sel k="first" label="First name column" optional />
            <Sel k="last" label="Last name column" optional />
          </div>
          <div className="ad-import-stats">
            <span><b>{people.ok.length.toLocaleString()}</b> ready</span>
            <span><b>{people.dup.toLocaleString()}</b> duplicates skipped</span>
            <span><b>{people.bad.toLocaleString()}</b> without a valid email</span>
            <span>of {src.total.toLocaleString()} rows</span>
          </div>
          {people.ok.length > 0 && (
            <table className="ad-mini"><thead><tr><th>Email</th><th>First name</th><th>Last name</th></tr></thead>
              <tbody>{people.ok.slice(0, 5).map((p) => <tr key={p.email}><td>{p.email}</td><td>{p.first || '—'}</td><td>{p.last || '—'}</td></tr>)}</tbody></table>
          )}
          <div className="ad-two" style={{ marginTop: 12 }}>
            <label><span>Add them to</span><select value={list} onChange={(e) => setList(e.target.value)}><option value="imported">Imported contacts (recommended)</option><option value="subscribers">Subscribers (only if they asked for Nibble news)</option></select></label>
          </div>
          <label className="sa-toggle ad-consent"><span><b>These people agreed to get email from us</b><small>For example they signed up at our event or on a form that said they’d hear from Nibble. Don’t import bought or scraped lists: it breaks anti-spam laws and Resend can suspend the account. Everyone can unsubscribe from every email, and anyone who already unsubscribed stays unsubscribed.</small></span><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /></label>
          {prog && <div className="ad-prog"><i style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /><span>{prog.done.toLocaleString()} / {prog.total.toLocaleString()} · {prog.added} new · {prog.existing} already there{prog.failed ? ` · ${prog.failed} failed` : ''}</span></div>}
          <button className="btn" disabled={!consent || !people.ok.length || !!busy} onClick={run}>{busy === 'import' ? 'Importing… keep this tab open' : `Import ${people.ok.length.toLocaleString()} contacts`}</button>
        </>
      )}
    </div>
  );
}

function MarketingTab({ social, state, toast }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [tpl, setTpl] = useState('launch');
  const [fields, setFields] = useState(TEMPLATE_DEFAULTS.launch);
  const [list, setList] = useState('subscribers');
  const [when, setWhen] = useState('');
  const [testTo, setTestTo] = useState(state.user.email || '');
  const [busy, setBusy] = useState('');
  const [device, setDevice] = useState('desk');
  const load = () => { setErr(''); social.admin.marketing().then(setInfo).catch((e) => { setInfo({}); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setFields({ ...fields, [k]: e.target.value });
  const pickTpl = (t) => { setTpl(t); setFields(TEMPLATE_DEFAULTS[t]); };
  // preview loads the email art from this site (so it also works before a deploy reaches meetnibble.com)
  const preview = useMemo(() => fillForPreview(renderEmail(tpl, fields).html, testTo || 'you@example.com').split('https://meetnibble.com/email/').join((typeof location !== 'undefined' ? location.origin : '') + '/email/').split('https://meetnibble.com/mail-btn').join((typeof location !== 'undefined' ? location.origin : '') + '/mail-btn'), [tpl, fields, testTo]);
  const ok = info && info.ready;
  const lists = (info && info.lists) || {};
  const count = lists[list] ? lists[list].total || 0 : 0;
  const test = async () => {
    setBusy('test');
    try { await social.admin.marketing({ action: 'test', to: testTo, template: tpl, fields }); toast({ text: 'Test sent to ' + testTo }); }
    catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy('');
  };
  const send = async () => {
    const at = when ? new Date(when) : null;
    if (!window.confirm(`${at ? 'Schedule' : 'Send'} “${fields.subject}” to ${count.toLocaleString()} ${lists[list] ? lists[list].label.toLowerCase() : 'people'}${at ? ' for ' + at.toLocaleString() : ' now'}? This can’t be undone.`)) return;
    setBusy('send');
    try {
      const r = await social.admin.marketing({ action: 'send', list, template: tpl, fields, ...(at ? { scheduledAt: at.toISOString() } : {}) });
      toast({ text: r.scheduled ? 'Campaign scheduled 📅' : 'Campaign is going out 🚀' });
      setWhen('');
      setTimeout(load, 2000);
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy('');
  };
  const can = ok && fields.subject.trim() && !busy;
  const show = (k) => ({ launch: ['headline', 'sub', 'message'], release: ['version', 'headline', 'message', 'bullets'], letter: ['headline', 'message'], flyer: ['message'] }[tpl] || []).includes(k);
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={ok ? (lists.subscribers ? lists.subscribers.total : 0).toLocaleString() : '–'} label="Subscribers" sub="opted in to Nibble news" color={C.mint} />
        <Kpi n={ok ? (lists.imported ? lists.imported.total : 0).toLocaleString() : '–'} label="Imported" sub="contacts you brought in" color={C.cyan} />
        <Kpi n={ok ? (info.broadcasts || []).filter((x) => x.status === 'sent').length : '–'} label="Campaigns sent" sub="last 20" color={C.violet} />
        <Kpi n={ok ? (info.broadcasts || []).filter((x) => x.status === 'scheduled').length : '–'} label="Scheduled" sub="waiting to go out" color={C.yellow} />
      </div>
      {err && <div className="sa-card"><p className="sa-empty">{err}</p></div>}
      {info && !err && !ok && <div className="sa-card"><p className="sa-empty">Add <b>RESEND_MARKETING_KEY</b> and <b>RESEND_SEGMENT_ID</b> in Vercel → Environment Variables, then redeploy.</p></div>}

      {ok && <ContactsCard social={social} info={info} toast={toast} reload={load} />}

      <div className="sa-card">
        <h3>✉️ New campaign <small>from {info && info.from ? info.from : 'no-reply@meetnibble.com'}</small></h3>
        <div className="ad-tpls">
          {MAIL_TEMPLATES.map((t) => (
            <button key={t.id} className={tpl === t.id ? 'on' : ''} onClick={() => pickTpl(t.id)}>
              <b>{t.name}</b><small>{t.note}</small>
            </button>
          ))}
        </div>
        <div className="ad-grid2 ad-compose">
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); }}>
            <label><span>Send to</span>
              <select value={list} onChange={(e) => setList(e.target.value)}>
                {Object.entries(lists).map(([k, l]) => <option key={k} value={k} disabled={!l.ready}>{l.label} · {(l.total || 0).toLocaleString()}{l.capped ? '+' : ''} people</option>)}
              </select>
            </label>
            <label><span>Subject <small>{fields.subject.length}/150</small></span><input value={fields.subject} maxLength={150} onChange={set('subject')} /></label>
            <label><span>Preview text <small>shown after the subject in the inbox</small></span><input value={fields.preview} maxLength={140} onChange={set('preview')} /></label>
            {show('version') && <label><span>Version</span><input value={fields.version} maxLength={16} onChange={set('version')} placeholder="2.0.23" /></label>}
            {show('headline') && <label><span>Headline</span><input value={fields.headline} maxLength={120} onChange={set('headline')} /></label>}
            {show('sub') && <label><span>Subheading</span><input value={fields.sub} maxLength={200} onChange={set('sub')} /></label>}
            {show('message') && <label><span>Message <small>{'{{{FIRST_NAME|there}}}'} = their first name · blank line = new paragraph</small></span><textarea rows={7} value={fields.message} maxLength={8000} onChange={set('message')} /></label>}
            {show('bullets') && <label><span>What’s new <small>one per line</small></span><textarea rows={4} value={fields.bullets} maxLength={2000} onChange={set('bullets')} /></label>}
            <div className="ad-two">
              <label><span>Button text <small>{tpl === 'letter' ? 'optional' : ''}</small></span><input value={fields.cta} maxLength={40} onChange={set('cta')} /></label>
              <label><span>Button link</span><input value={fields.ctaUrl} maxLength={300} onChange={set('ctaUrl')} placeholder="https://meetnibble.com/#download" /></label>
            </div>
            <div className="ad-two">
              <label><span>Send a test to</span><input value={testTo} onChange={(e) => setTestTo(e.target.value)} inputMode="email" /></label>
              <label><span>Schedule <small>empty = send now</small></span><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost" disabled={!can || !MAIL_RE.test(testTo.trim())} onClick={test}>{busy === 'test' ? 'Sending test…' : 'Send test'}</button>
              <button type="button" className="btn" disabled={!can || !count} onClick={send}>{busy === 'send' ? 'Sending…' : when ? 'Schedule campaign' : `Send to ${count.toLocaleString()} people`}</button>
            </div>
            <p className="ad-foot">Free plan: 3,000 emails a month and 100 a day, so a bigger list needs a paid Resend plan. Every email has an unsubscribe link, and people who unsubscribe are skipped automatically.</p>
          </form>
          <div>
            <div className="ad-prev-k" style={{ display: 'flex', alignItems: 'center' }}>Live preview
              <span className="ad-seg" style={{ marginLeft: 'auto' }}><button className={device === 'desk' ? 'on' : ''} onClick={() => setDevice('desk')}>Desktop</button><button className={device === 'mob' ? 'on' : ''} onClick={() => setDevice('mob')}>Phone</button></span>
            </div>
            <div className={'ad-mailprev ' + device}>
              <div className="ad-mailhead"><b>Nibble</b> &lt;no-reply@meetnibble.com&gt;<br /><span>{fillForPreview(fields.subject)}</span><small>{fields.preview}</small></div>
              <iframe title="Email preview" srcDoc={preview} sandbox="" />
            </div>
          </div>
        </div>
      </div>

      <div className="sa-card">
        <h3>Campaigns <small>{info && info.broadcasts ? info.broadcasts.length : 0}</small></h3>
        {ok && !(info.broadcasts || []).length && <p className="sa-empty">No campaigns yet.</p>}
        {(info && info.broadcasts || []).map((x) => (
          <div key={x.id} className="ad-hist">
            <span className="ad-hist-ico">📢</span>
            <div><b>{x.name || '(untitled)'}</b><small><span style={{ color: BC_STATUS[x.status] || C.slate, fontWeight: 700 }}>{x.status || 'draft'}</span>{x.at ? ' · ' + ago(Date.parse(String(x.at).replace(' ', 'T').replace(/\+00(:00)?$/, 'Z'))) : ''}</small></div>
            <a className="btn small ghost" href={'https://resend.com/broadcasts/' + x.id} target="_blank" rel="noreferrer">Stats</a>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- SEO: titles, descriptions, share images, Search Console ----------
const OG_THEMES = [['mint', '#7ee8c6'], ['pink', '#ff8fd0'], ['violet', '#a78bfa'], ['sun', '#ffd166']];
const SEO_LINKS = [
  ['Google Search Console', 'https://search.google.com/search-console'],
  ['Rich Results Test', 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(SEO_SITE)],
  ['PageSpeed Insights', 'https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(SEO_SITE)],
  ['Facebook Sharing Debugger', 'https://developers.facebook.com/tools/debug/?q=' + encodeURIComponent(SEO_SITE)],
  ['llms.txt (for AI assistants)', SEO_SITE + '/llms.txt'],
  ['LinkedIn Post Inspector', 'https://www.linkedin.com/post-inspector/inspect/' + encodeURIComponent(SEO_SITE)],
  ['Bing Webmaster Tools', 'https://www.bing.com/webmasters'],
];
function Len({ n, good, max }) {
  const c = n === 0 ? C.slate : n > max ? C.coral : n >= good[0] && n <= good[1] ? C.mint : C.yellow;
  return <small style={{ color: c, fontWeight: 700 }}>{n}/{max}{n && (n < good[0] || n > good[1]) && n <= max ? ` · best ${good[0]}–${good[1]}` : ''}</small>;
}
function CopyRow({ label, value, toast }) {
  return (
    <div className="ad-copyrow">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" className="btn small ghost" onClick={() => { try { navigator.clipboard.writeText(value); toast({ text: 'Copied' }); } catch {} }}>Copy</button>
    </div>
  );
}
function SeoTab({ social, toast }) {
  const [f, setF] = useState(null);
  const [page, setPage] = useState('home');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState('mint');
  useEffect(() => { social.admin.seo.get().then((d) => setF(mergeSeo(d))).catch(() => setF(mergeSeo(null))); }, [social]);
  if (!f) return <div className="ad-skel"><i /><i /><i /></div>;
  const setSite = (k, v) => { setF({ ...f, [k]: v }); setDirty(true); };
  const p = f.pages[page];
  const setP = (k, v) => { setF({ ...f, pages: { ...f.pages, [page]: { ...p, [k]: v } } }); setDirty(true); };
  const path = (SEO_PAGES.find(([k]) => k === page) || [])[1] || '/';
  const fullTitle = page === 'home' ? p.title : f.titleTemplate.replace('%s', p.title);
  const img = p.ogImage || f.pages.home.ogImage;
  const imgSrc = img && img.startsWith('/') ? img : img;
  const gen = () => setP('ogImage', `/og?title=${encodeURIComponent(p.ogTitle || p.title)}&sub=${encodeURIComponent((p.ogDescription || p.description).slice(0, 120))}&theme=${theme}`);
  const save = async () => {
    setBusy(true);
    try {
      const r = await social.admin.seo.save(f);
      toast({ text: r && r.ok ? 'SEO saved and live ✓' : 'Saved. The site picks it up within 5 minutes.' });
      setDirty(false);
    } catch (x) { toast({ err: true, text: niceError(x).includes('Not allowed') || niceError(x).includes('permission') ? 'Publish the latest Firestore rules first (they add the seo collection).' : niceError(x) }); }
    setBusy(false);
  };
  return (
    <>
      <div className="sa-card">
        <h3>🔎 Page titles, descriptions and share images
          <button className="btn small" style={{ marginLeft: 'auto' }} disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        </h3>
        <div className="ad-seg" style={{ marginBottom: 14 }}>{SEO_PAGES.map(([k, , l]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}>{l}</button>)}</div>
        <div className="ad-grid2">
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label><span>Title <Len n={p.title.length} good={[30, 60]} max={SEO_LIMITS.title} /></span><input value={p.title} maxLength={SEO_LIMITS.title} onChange={(e) => setP('title', e.target.value)} /></label>
            <label><span>Description <Len n={p.description.length} good={[120, 160]} max={SEO_LIMITS.description} /></span><textarea rows={3} value={p.description} maxLength={SEO_LIMITS.description} onChange={(e) => setP('description', e.target.value)} /></label>
            <label><span>Share title <small>optional · for Facebook, WhatsApp, X, LinkedIn</small></span><input value={p.ogTitle} maxLength={SEO_LIMITS.ogTitle} placeholder={p.title} onChange={(e) => setP('ogTitle', e.target.value)} /></label>
            <label><span>Share description <small>optional</small></span><textarea rows={2} value={p.ogDescription} maxLength={SEO_LIMITS.ogDescription} placeholder={p.description} onChange={(e) => setP('ogDescription', e.target.value)} /></label>
            <label><span>Share image <small>1200 × 630 · a path like /og/home.jpg or an https:// link{page !== 'home' ? ' · empty = the home image' : ''}</small></span><input value={p.ogImage} maxLength={SEO_LIMITS.ogImage} placeholder={page !== 'home' ? f.pages.home.ogImage : '/og/home.jpg'} onChange={(e) => setP('ogImage', e.target.value)} /></label>
            <div className="ad-ogtools">
              <span>Generate one:</span>
              {OG_THEMES.map(([k, c]) => <button type="button" key={k} title={k} className={'ad-swatch' + (theme === k ? ' on' : '')} style={{ background: c }} onClick={() => setTheme(k)} />)}
              <button type="button" className="btn small ghost" onClick={gen}>✨ Generate image</button>
            </div>
            <label><span>Image description <small>alt text, for screen readers</small></span><input value={p.ogAlt} maxLength={SEO_LIMITS.ogAlt} onChange={(e) => setP('ogAlt', e.target.value)} /></label>
          </form>
          <div>
            <div className="ad-prev-k">Google result</div>
            <div className="ad-serp">
              <small>meetnibble.com{path === '/' ? '' : ' › ' + path.slice(1)}</small>
              <b>{fullTitle.length > 62 ? fullTitle.slice(0, 60) + '…' : fullTitle}</b>
              <p>{p.description.length > 158 ? p.description.slice(0, 156) + '…' : p.description}</p>
            </div>
            <div className="ad-prev-k">Share card</div>
            <div className="ad-card">
              {imgSrc ? <img src={imgSrc} alt={p.ogAlt || ''} /> : <div className="ad-card-none">No image</div>}
              <div><small>MEETNIBBLE.COM</small><b>{p.ogTitle || p.title}</b><p>{(p.ogDescription || p.description).slice(0, 110)}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ad-grid2">
        <div className="sa-card">
          <h3>⚙️ Whole site</h3>
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="ad-two">
              <label><span>Site name</span><input value={f.siteName} maxLength={40} onChange={(e) => setSite('siteName', e.target.value)} /></label>
              <label><span>Title pattern <small>%s = page title</small></span><input value={f.titleTemplate} maxLength={60} onChange={(e) => setSite('titleTemplate', e.target.value)} /></label>
            </div>
            <label><span>Keywords <small>comma separated</small></span><textarea rows={3} value={f.keywords} maxLength={600} onChange={(e) => setSite('keywords', e.target.value)} /></label>
            <label><span>X (Twitter) account <small>optional, e.g. @meetnibble</small></span><input value={f.twitter} maxLength={30} onChange={(e) => setSite('twitter', e.target.value)} /></label>
            <label className="sa-toggle"><span><b>Hide the whole site from search engines</b><small>Only for emergencies: Google drops the site while this is on.</small></span><input type="checkbox" checked={f.noindex} onChange={(e) => { if (!e.target.checked || window.confirm('Hide meetnibble.com from Google and other search engines?')) setSite('noindex', e.target.checked); }} /></label>
          </form>
        </div>

        <div className="sa-card">
          <h3>📈 Google Search Console</h3>
          <CopyRow label="Sitemap" value={SEO_SITE + '/sitemap.xml'} toast={toast} />
          <CopyRow label="Robots" value={SEO_SITE + '/robots.txt'} toast={toast} />
          <CopyRow label="Property" value={SEO_SITE + '/'} toast={toast} />
          <form className="sa-form" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label><span>Google verification code <small>the content="…" part of the HTML tag</small></span><input value={f.googleVerify} maxLength={100} placeholder="e.g. AbC123…" onChange={(e) => setSite('googleVerify', e.target.value.replace(/.*content=["']?([^"' >]+).*/, '$1'))} /></label>
            <label><span>Bing verification code <small>optional · msvalidate.01</small></span><input value={f.bingVerify} maxLength={100} onChange={(e) => setSite('bingVerify', e.target.value.replace(/.*content=["']?([^"' >]+).*/, '$1'))} /></label>
          </form>
          <ol className="ad-steps">
            <li>Search Console → <b>Add property</b> → <b>URL prefix</b> → <code>{SEO_SITE}/</code></li>
            <li>Pick <b>HTML tag</b>, paste the whole tag above, <b>Save changes</b>, then click <b>Verify</b>.</li>
            <li><b>Sitemaps</b> → add <code>sitemap.xml</code> → Submit.</li>
            <li><b>URL inspection</b> → paste the home page → <b>Request indexing</b>.</li>
          </ol>
          <div className="ad-links">{SEO_LINKS.map(([l, u]) => <a key={l} className="btn small ghost" href={u} target="_blank" rel="noreferrer">{l} ↗</a>)}</div>
          <h3 style={{ marginTop: 18 }}>🤖 AI assistants &amp; Bing</h3>
          <p className="ad-foot" style={{ marginTop: 0 }}>ChatGPT, Claude, Perplexity, Gemini and Copilot can read <code>/llms.txt</code> and <code>/llms-full.txt</code> (facts about Nibble) and the structured data on every page. Bing’s index also feeds ChatGPT search and Copilot: after a big change, ask it to re-crawl.</p>
          <CopyRow label="llms.txt" value={SEO_SITE + '/llms.txt'} toast={toast} />
          <button className="btn small" style={{ marginTop: 8 }} onClick={async () => { try { const r = await social.admin.indexNow(); toast({ text: `Sent ${r.count} pages to Bing & IndexNow ✓` }); } catch (x) { toast({ err: true, text: niceError(x) }); } }}>Ask Bing &amp; others to re-crawl</button>
        </div>
      </div>
    </>
  );
}

// Sidebar: grouped pages, each with a one-line purpose and a short guide (shown under the title)
// ---------- Premium: Stripe subscriptions (keys live in Vercel env, never here) ----------
const SUB_COLOR = { active: C.mint, trialing: C.cyan, past_due: C.yellow, canceled: C.slate, unpaid: C.coral, incomplete: C.slate, incomplete_expired: C.slate };
const blankPkg = () => ({ id: '', name: '', amount: '', currency: 'usd', interval: 'year', trialDays: 0, highlight: '', active: true });
function Check({ ok, warn, children }) { return <li className={ok ? 'ok' : warn ? 'bad' : ''}>{ok ? '✓ ' : warn ? '⚠️ ' : '○ '}{children}</li>; }
function PremiumTab({ social, state, users, toast, go, setOpenUid }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const plan = state.premiumPlan || cleanPlanUI();
  const [feats, setFeats] = useState(plan.features);
  const [featsDirty, setFeatsDirty] = useState(false);
  const [edit, setEdit] = useState(null); // package being edited
  const [promo, setPromo] = useState({ code: '', kind: 'percent', percentOff: 20, amountOff: '', currency: 'usd', duration: 'once', months: 3, maxRedemptions: '', expiresAt: '' });
  const [gift, setGift] = useState({ who: '', days: 365 });
  const [name, setName] = useState(plan.name);
  const [refundId, setRefundId] = useState('');
  const [showEvents, setShowEvents] = useState(false);
  useEffect(() => { if (!featsDirty) setFeats(plan.features); setName(plan.name); }, [state.premiumPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => { setErr(''); social.admin.premium().then(setInfo).catch((e) => { setInfo({}); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (key, body, ok) => {
    setBusy(key);
    try { const r = await social.admin.premium(body); if (ok) toast({ text: ok }); load(); return r || true; }
    catch (x) { toast({ err: true, text: niceError(x) }); return null; }
    finally { setBusy(''); }
  };
  const savePlan = async (patch, ok) => { try { await social.admin.savePremiumPlan(patch); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const hl = (info && info.health) || {};
  const live = (plan.packages || []).filter((k) => k.active && k.priceId);
  const ready = hl.key && hl.key.ok && hl.webhookSecret && hl.webhookSecret.ok && hl.webhook && hl.webhook.found && hl.serviceAccount && hl.serviceAccount.ok && live.length > 0;
  const toggle = (on) => {
    if (on && !live.length) { toast({ err: true, text: 'Add a package first: that’s what people buy.' }); return; }
    if (on && !window.confirm(`Switch Premium on for everyone?${hl.key && hl.key.mode === 'test' ? ' Stripe is in TEST mode: no real money.' : ''}`)) return;
    savePlan({ enabled: on }, on ? 'Premium is on' : 'Premium is off');
  };
  const savePkg = async (e) => {
    e.preventDefault();
    const amount = Math.round(Number(edit.amount) * 100);
    const old = plan.packages.find((k) => k.id === edit.id);
    if (old && old.amount !== amount && !window.confirm(`Change the price to ${money(amount, edit.currency)}? New subscribers pay this; current ones keep their price.`)) return;
    const r = await act('pkg', { action: 'package', pkg: { ...edit, amount, trialDays: Math.round(Number(edit.trialDays) || 0) } }, 'Package saved in Stripe');
    if (r) setEdit(null);
  };
  const setF = (i, patch) => { setFeats(feats.map((f, j) => (j === i ? { ...f, ...patch } : f))); setFeatsDirty(true); };
  const giftUser = users.find((u) => u.username === gift.who.replace(/^@/, '').trim().toLowerCase() || u.uid === gift.who.trim());
  const stats = info && info.stats;
  const subs = (info && info.subscribers) || [];
  const flags = (info && info.flags) || [];
  const events = (info && info.events) || [];
  const failed = events.filter((ev) => ev.status === 'failed').length;
  const nameOf = (uid) => (users.find((u) => u.uid === uid) || {}).username;
  const dash = `https://dashboard.stripe.com/${hl.key && hl.key.mode === 'test' ? 'test/' : ''}`;
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={stats ? stats.active : '–'} label="Premium members" sub={stats && stats.trialing ? `${stats.trialing} on a free trial` : 'paying or on trial'} color={C.mint} />
        <Kpi n={stats ? money(stats.yearly, stats.currency) : '–'} label="Yearly revenue" sub="from paying members" color={C.violet} />
        <Kpi n={stats ? stats.cancelling : '–'} label="Cancelling" sub="end at the period end" color={C.yellow} />
        <Kpi n={stats ? stats.pastDue : '–'} label="Payment problems" sub="card failed, retrying" color={C.coral} />
      </div>
      {(err || (info && info.error)) && <div className="sa-card"><p className="sa-empty">{err || 'Stripe said: ' + info.error}</p></div>}

      <div className="ad-grid2">
        <div className="sa-card">
          <h3>💎 Premium mode <small>{plan.enabled ? 'on for everyone' : 'off'}</small></h3>
          <label className="sa-toggle"><span><b>Offer Premium in the app</b><small>{ready ? 'Everything is set up.' : 'Finish the Stripe checklist and add a package first.'}{hl.key && hl.key.mode === 'test' ? ' Stripe is in TEST mode: payments aren’t real.' : ''}</small></span><input type="checkbox" checked={!!plan.enabled} onChange={(e) => toggle(e.target.checked)} /></label>
          <label className="sa-toggle"><span><b>Allow promotion codes</b><small>Shows “Add promotion code” on the payment page.</small></span><input type="checkbox" checked={plan.promoCodes !== false} onChange={(e) => savePlan({ promoCodes: e.target.checked }, e.target.checked ? 'Promo codes allowed' : 'Promo codes hidden')} /></label>
          <form className="sa-form" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); savePlan({ name }, 'Name saved'); }}>
            <label><span>Name people see</span><div style={{ display: 'flex', gap: 8 }}><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /><button className="btn small" disabled={name === plan.name}>Save</button></div></label>
          </form>
        </div>

        <div className="sa-card">
          <h3>💳 Stripe set-up <small>{hl.key && hl.key.ok ? (hl.key.mode === 'live' ? 'LIVE' : 'TEST mode') : 'not connected'}</small><button className="btn small ghost" onClick={load}>Re-check</button></h3>
          {!info ? <p className="sa-empty">Checking…</p> : (
            <ul className="ad-checklist">
              <Check ok={hl.key && hl.key.ok} warn={hl.key && (hl.key.bad || hl.key.err)}>Secret key in Vercel (<code>STRIPE_SECRET_KEY</code>){hl.key && hl.key.ok ? ` · ${hl.key.masked}${hl.account ? ' · ' + hl.account : ''}` : hl.key && hl.key.bad ? ': that doesn’t look like a Stripe key' : hl.key && hl.key.err ? ': Stripe refused it' : ''}</Check>
              <Check ok={hl.webhookSecret && hl.webhookSecret.ok} warn={hl.webhookSecret && hl.webhookSecret.bad}>Webhook signing secret in Vercel (<code>STRIPE_WEBHOOK_SECRET</code>)</Check>
              <Check ok={hl.webhook && hl.webhook.found && hl.webhook.enabled && !hl.webhook.missing.length} warn={hl.webhook && hl.webhook.found && (!hl.webhook.enabled || hl.webhook.missing.length)}>Webhook endpoint in Stripe for <code>{info.webhookUrl || 'https://meetnibble.com/api/stripe/webhook'}</code>{hl.webhook && hl.webhook.found && hl.webhook.missing.length ? `: add events ${hl.webhook.missing.join(', ')}` : hl.webhook && hl.webhook.found && !hl.webhook.enabled ? ': it’s disabled' : ''}</Check>
              <Check ok={hl.portal && hl.portal.ok}>Customer portal turned on (Stripe → Settings → Billing → Customer portal)</Check>
              <Check ok={hl.serviceAccount && hl.serviceAccount.ok} warn={hl.serviceAccount && !hl.serviceAccount.ok}>Server can update Firestore{hl.serviceAccount && !hl.serviceAccount.ok ? <>: give <code>{hl.serviceAccount.email}</code> the <b>Cloud Datastore User</b> role</> : ''}</Check>
              <Check ok={live.length > 0}>At least one package below</Check>
              <Check ok={hl.webhook && hl.webhook.found && hl.webhook.versionOk} warn={hl.webhook && hl.webhook.found && !hl.webhook.versionOk}>Webhook API version is the same release as the app (<code>{hl.apiVersion ? '….' + hl.apiVersion.split('.').pop() : '…'}</code>){hl.webhook && hl.webhook.apiVersion ? (hl.webhook.versionOk ? ` · endpoint uses ${hl.webhook.apiVersion}` : `: the endpoint uses ${hl.webhook.apiVersion}, pick a ${hl.apiVersion.split('.').pop()} version (never .preview)`) : ''}</Check>
              <Check ok={hl.terms && hl.terms.ok} warn={hl.terms && !hl.terms.ok}>Terms of service URL set in Stripe (Settings → Public details){hl.terms && !hl.terms.ok ? ': checkout is running without the terms tick-box' : ''}</Check>
              <Check ok={hl.radar && hl.radar.ok} warn={hl.radar && !hl.radar.ok}>Fraud warnings readable (Radar){hl.radar && !hl.radar.ok ? ': give the key Read access to Radar' : ''}</Check>
              <Check ok={hl.restricted} warn={hl.key && hl.key.ok && hl.key.mode === 'live' && !hl.restricted}>Restricted key (<code>rk_…</code>) instead of the full secret key{hl.key && hl.key.ok && !hl.restricted ? ': safer if it ever leaks' : ''}</Check>
            </ul>
          )}
          <p className="ad-foot">Keys are added in Vercel → Settings → Environment Variables, then redeploy. They’re never shown or stored here. <a className="sa-link" href="https://github.com/UvinduBro/nibble/blob/main/docs/STRIPE_SETUP.md" target="_blank" rel="noreferrer">Set-up guide</a>{hl.key && hl.key.ok ? <> · <a className="sa-link" href={dash} target="_blank" rel="noreferrer">Open Stripe ↗</a></> : null}</p>
        </div>
      </div>

      <div className="sa-card">
        <h3>📦 Packages <small>what people can buy</small><button className="btn small" style={{ marginLeft: 'auto' }} disabled={!!edit || (plan.packages || []).length >= 6} onClick={() => setEdit(blankPkg())}>＋ New package</button></h3>
        {!(plan.packages || []).length && !edit && <p className="sa-empty">No packages yet.</p>}
        <div className="ad-pkgs">
          {(plan.packages || []).map((k) => (
            <div key={k.id} className={'ad-pkg' + (k.active ? '' : ' off') + (plan.defaultPackage === k.id ? ' def' : '')}>
              <div><b>{k.name}</b>{k.highlight && <span className="ad-pill">{k.highlight}</span>}{plan.defaultPackage === k.id && <span className="ad-pill dim">default</span>}</div>
              <div className="ad-pkg-price">{money(k.amount, k.currency)} <small>/ {k.interval}</small></div>
              <small>{k.trialDays ? `${k.trialDays}-day free trial · ` : ''}{k.priceId ? (k.active ? 'on sale' : 'hidden') : 'not in Stripe yet'} · id {k.id}</small>
              <div className="ad-pkg-btns">
                <button className="btn small ghost" disabled={!!busy} onClick={() => setEdit({ ...k, amount: (k.amount / 100).toFixed(2) })}>Edit</button>
                {plan.defaultPackage !== k.id && <button className="btn small ghost" onClick={() => savePlan({ defaultPackage: k.id }, 'Default package set')}>Make default</button>}
                <button className="btn small ghost" disabled={!!busy} onClick={() => act('pkg', { action: 'package', pkg: { ...k, active: !k.active } }, k.active ? 'Hidden from the app' : 'On sale again')}>{k.active ? 'Hide' : 'Show'}</button>
                <button className="btn small ghost" disabled={!!busy} onClick={() => { if (window.confirm(`Remove “${k.name}”? People already subscribed keep it.`)) act('pkg', { action: 'archivePackage', id: k.id }, 'Package removed'); }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        {edit && (
          <form className="sa-form ad-pkg-form" onSubmit={savePkg}>
            <div className="ad-two">
              <label><span>Name</span><input value={edit.name} maxLength={30} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Yearly" required /></label>
              <label><span>ID <small>short, can’t change later</small></span><input value={edit.id} maxLength={24} disabled={(plan.packages || []).some((k) => k.id === edit.id && edit.priceId)} onChange={(e) => setEdit({ ...edit, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="yearly" required /></label>
            </div>
            <div className="ad-two">
              <label><span>Price</span><input type="number" min="0.5" step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} placeholder="5.00" required /></label>
              <label><span>Currency</span><select value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label>
            </div>
            <div className="ad-two">
              <label><span>Billed every</span><select value={edit.interval} onChange={(e) => setEdit({ ...edit, interval: e.target.value })}>{INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}</select></label>
              <label><span>Free trial <small>days, 0 = none</small></span><input type="number" min="0" max="90" value={edit.trialDays} onChange={(e) => setEdit({ ...edit, trialDays: e.target.value })} /></label>
            </div>
            <label><span>Label <small>optional, e.g. “Best value”</small></span><input value={edit.highlight} maxLength={20} onChange={(e) => setEdit({ ...edit, highlight: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={busy === 'pkg'}>{busy === 'pkg' ? 'Saving in Stripe…' : 'Save package'}</button>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
            <p className="ad-foot">Saving creates the price in Stripe. Changing the price later makes a new one; people already subscribed keep theirs. Trials are only for people who’ve never had Premium.</p>
          </form>
        )}
      </div>

      <div className="sa-card">
        <h3>✨ Features <small>what people get</small><button className="btn small" style={{ marginLeft: 'auto' }} disabled={!featsDirty} onClick={async () => { await savePlan({ features: feats.map(cleanFeature) }, 'Features saved'); setFeatsDirty(false); }}>{featsDirty ? 'Save features' : 'Saved'}</button></h3>
        <div className="ad-feats">
          {feats.map((f, i) => (
            <div key={f.id + i} className={'ad-feat' + (f.on === false ? ' off' : '')}>
              <input className="ad-feat-icon" value={f.icon} maxLength={4} onChange={(e) => setF(i, { icon: e.target.value })} aria-label="Icon" />
              <div className="ad-feat-main">
                <input value={f.title} maxLength={40} onChange={(e) => setF(i, { title: e.target.value })} aria-label="Title" />
                <input value={f.desc} maxLength={140} onChange={(e) => setF(i, { desc: e.target.value })} placeholder="Short description" aria-label="Description" />
              </div>
              <select value={f.key} onChange={(e) => setF(i, { key: e.target.value })} aria-label="What it does">
                {Object.entries(PREMIUM_BUILTIN).map(([k, x]) => <option key={k} value={k}>Built-in: {x.title}</option>)}
                <option value="custom">Custom (listed only)</option>
              </select>
              <label className="ad-feat-on"><input type="checkbox" checked={f.on !== false} onChange={(e) => setF(i, { on: e.target.checked })} /> on</label>
              <button className="btn small ghost" onClick={() => { setFeats(feats.filter((_, j) => j !== i)); setFeatsDirty(true); }} aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn small ghost" disabled={feats.length >= 12} onClick={() => { setFeats([...feats, { id: 'f' + Date.now().toString(36), key: 'custom', icon: '✨', title: 'New feature', desc: '', on: true }]); setFeatsDirty(true); }}>＋ Add feature</button>
          <button className="btn small ghost" onClick={() => { setFeats(DEFAULT_PLAN.features); setFeatsDirty(true); }}>Reset to defaults</button>
        </div>
      </div>

      <div className="ad-grid2">
        <div className="sa-card">
          <h3>🏷️ Promotion codes</h3>
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); act('promo', { action: 'promo', code: promo.code, ...(promo.kind === 'percent' ? { percentOff: Number(promo.percentOff) } : { amountOff: Math.round(Number(promo.amountOff) * 100), currency: promo.currency }), duration: promo.duration, months: promo.months, maxRedemptions: promo.maxRedemptions, expiresAt: promo.expiresAt }, `Code ${promo.code.toUpperCase()} created`).then((r) => { if (r) setPromo({ ...promo, code: '' }); }); }}>
            <div className="ad-two">
              <label><span>Code</span><input value={promo.code} maxLength={20} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="LAUNCH50" required /></label>
              <label><span>Discount</span><select value={promo.kind} onChange={(e) => setPromo({ ...promo, kind: e.target.value })}><option value="percent">Percent off</option><option value="amount">Amount off</option></select></label>
            </div>
            {promo.kind === 'percent'
              ? <label><span>Percent off</span><input type="number" min="1" max="100" value={promo.percentOff} onChange={(e) => setPromo({ ...promo, percentOff: e.target.value })} /></label>
              : <div className="ad-two"><label><span>Amount off</span><input type="number" min="0.01" step="0.01" value={promo.amountOff} onChange={(e) => setPromo({ ...promo, amountOff: e.target.value })} /></label><label><span>Currency</span><select value={promo.currency} onChange={(e) => setPromo({ ...promo, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label></div>}
            <div className="ad-two">
              <label><span>Applies to</span><select value={promo.duration} onChange={(e) => setPromo({ ...promo, duration: e.target.value })}><option value="once">First payment</option><option value="repeating">Several months</option><option value="forever">Every payment</option></select></label>
              {promo.duration === 'repeating' ? <label><span>Months</span><input type="number" min="1" max="36" value={promo.months} onChange={(e) => setPromo({ ...promo, months: e.target.value })} /></label> : <label><span>Max uses <small>optional</small></span><input type="number" min="1" value={promo.maxRedemptions} onChange={(e) => setPromo({ ...promo, maxRedemptions: e.target.value })} /></label>}
            </div>
            <label><span>Expires <small>optional</small></span><input type="date" value={promo.expiresAt} onChange={(e) => setPromo({ ...promo, expiresAt: e.target.value })} /></label>
            <button className="btn" disabled={!promo.code || busy === 'promo' || !(hl.key && hl.key.ok)}>{busy === 'promo' ? 'Creating…' : 'Create code'}</button>
          </form>
          {((info && info.promos) || []).length > 0 && (
            <table className="ad-mini" style={{ marginTop: 12 }}>
              <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th /></tr></thead>
              <tbody>{info.promos.map((p) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td><b>{p.code}</b>{p.expires ? <><br /><small>until {new Date(p.expires).toLocaleDateString()}</small></> : null}</td>
                  <td>{p.off}<br /><small>{p.duration}</small></td>
                  <td>{p.used}{p.max ? ` / ${p.max}` : ''}</td>
                  <td><button className="btn small ghost" disabled={!!busy} onClick={() => act('promo', { action: 'promoActive', id: p.id, active: !p.active }, p.active ? 'Code turned off' : 'Code turned on')}>{p.active ? 'Turn off' : 'Turn on'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="sa-card">
          <h3>🎁 Gift Premium</h3>
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); if (giftUser) act('gift', { action: 'grant', uid: giftUser.uid, days: Number(gift.days) }, `Premium gifted to @${giftUser.username}`); }}>
            <div className="ad-two">
              <label><span>Username</span><input value={gift.who} onChange={(e) => setGift({ ...gift, who: e.target.value })} placeholder="@username" list="ad-users" /></label>
              <label><span>For</span><select value={gift.days} onChange={(e) => setGift({ ...gift, days: e.target.value })}>{[[30, '1 month'], [90, '3 months'], [365, '1 year'], [3650, '10 years']].map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select></label>
            </div>
            <datalist id="ad-users">{users.slice(0, 500).map((u) => <option key={u.uid} value={'@' + u.username} />)}</datalist>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" disabled={!giftUser || !!busy}>Gift Premium</button>
              <button type="button" className="btn ghost" disabled={!giftUser || !!busy} onClick={() => { if (window.confirm(`Remove Premium from @${giftUser.username}?`)) act('gift', { action: 'revoke', uid: giftUser.uid }, 'Premium removed'); }}>Remove Premium</button>
            </div>
            <p className="ad-foot">{giftUser ? `@${giftUser.username}` : 'Type a username from the list.'} Gifts never charge anyone and add to any time they already have.</p>
          </form>
        </div>
      </div>

      <div className="sa-card">
        <h3>👥 Subscribers <small>{subs.length}{stats && stats.more ? '+' : ''}</small></h3>
        {!subs.length && <p className="sa-empty">{hl.key && hl.key.ok ? 'No subscribers yet.' : 'Add the Stripe keys to see subscribers.'}</p>}
        {subs.length > 0 && (
          <table className="ad-mini">
            <thead><tr><th>Who</th><th>Status</th><th>Renews / ends</th><th>Price</th><th /></tr></thead>
            <tbody>{subs.map((x) => (
              <tr key={x.id}>
                <td>{nameOf(x.uid) ? <button className="sa-link" onClick={() => { go('users'); setOpenUid(x.uid); }}>@{nameOf(x.uid)}</button> : x.uid}<br /><small style={{ color: 'var(--muted)' }}>{x.email}{x.pkg ? ' · ' + x.pkg : ''}</small></td>
                <td><b style={{ color: SUB_COLOR[x.status] || C.slate }}>{x.status.replace('_', ' ')}</b>{x.cancelAtEnd ? <small> · cancelling</small> : null}
                  {x.risk && (x.risk.flags || x.risk.ageDays !== '') ? <><br /><small style={{ color: x.risk.flags && x.risk.flags !== 'none' ? C.coral : 'var(--muted)' }} title="From the checkout: account age, sign-in, request country vs. sign-up country">{x.risk.flags && x.risk.flags !== 'none' ? '⚠️ ' + x.risk.flags.replace(/_/g, ' ') + ' · ' : ''}{x.risk.ageDays !== '' ? `${x.risk.ageDays}d old` : ''}{x.risk.provider ? ' · ' + x.risk.provider.replace('.com', '') : ''}{x.risk.ipCountry ? ' · ' + x.risk.ipCountry : ''}</small></> : null}</td>
                <td>{x.until ? new Date(x.until).toLocaleDateString() : '—'}</td>
                <td>{money(x.amount, x.currency)}/{x.interval}</td>
                <td className="ad-sub-btns">
                  {['active', 'trialing', 'past_due'].includes(x.status) && (x.cancelAtEnd
                    ? <button className="btn small ghost" disabled={!!busy} onClick={() => act('sub', { action: 'resume', subId: x.id }, 'Subscription resumed')}>Resume</button>
                    : <button className="btn small ghost" disabled={!!busy} onClick={() => { if (window.confirm('Cancel at the end of the period they paid for? They keep Premium until then.')) act('sub', { action: 'cancel', subId: x.id }, 'Will cancel at period end'); }}>Cancel</button>)}
                  {['active', 'trialing', 'past_due'].includes(x.status) && <button className="btn small ghost" disabled={!!busy} onClick={() => { if (window.confirm('Cancel NOW? Premium ends immediately. (Refunds are done in Stripe.)')) act('sub', { action: 'cancel', subId: x.id, now: true }, 'Cancelled now'); }}>End now</button>}
                  <button className="btn small ghost" disabled={!!busy} onClick={() => act('sub', { action: 'resync', uid: x.uid }, 'Synced')}>Sync</button>
                  <a className="btn small ghost" href={`${dash}subscriptions/${x.id}`} target="_blank" rel="noreferrer">Stripe ↗</a>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="sa-card">
        <h3>🚩 Disputes & fraud warnings <small>{flags.filter((f) => f.open).length} to review</small></h3>
        <p className="ad-foot" style={{ marginTop: 0 }}>A dispute (chargeback) or a Stripe fraud warning ends Premium straight away and blocks new purchases until you clear it here. Fraud warnings are refunded automatically to avoid the dispute fee. Full refunds also end Premium but don’t block buying again.</p>
        {!flags.length && <p className="sa-empty">Nothing here. 🎉</p>}
        {flags.length > 0 && (
          <table className="ad-mini">
            <thead><tr><th>Who</th><th>What</th><th>Amount</th><th>When</th><th /></tr></thead>
            <tbody>{flags.map((f) => (
              <tr key={f.uid} style={{ opacity: f.open ? 1 : 0.6 }}>
                <td>{nameOf(f.uid) ? <button className="sa-link" onClick={() => { go('users'); setOpenUid(f.uid); }}>@{nameOf(f.uid)}</button> : f.uid}</td>
                <td><b style={{ color: f.open ? C.coral : C.slate }}>{FLAG_LABEL[f.reason] || f.reason}</b>{f.disputeStatus ? <small> · {f.disputeStatus.replace(/_/g, ' ')}</small> : null}{f.refunded ? <small> · refunded</small> : null}{!f.open ? <small> · cleared</small> : null}</td>
                <td>{f.amount ? money(f.amount, f.currency) : f.lastRefund ? money(f.lastRefund.amount, f.lastRefund.currency) : '—'}</td>
                <td>{f.at ? new Date(f.at).toLocaleDateString() : '—'}</td>
                <td className="ad-sub-btns">
                  {f.open && <button className="btn small ghost" disabled={!!busy} onClick={() => { if (window.confirm('You checked this one and they may buy Premium again?')) act('flag', { action: 'clearFlag', uid: f.uid }, 'Flag cleared'); }}>Clear</button>}
                  {f.chargeId && <a className="btn small ghost" href={`${dash}payments/${f.chargeId}`} target="_blank" rel="noreferrer">Stripe ↗</a>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <form className="sa-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); const id = refundId.trim(); if (id && window.confirm(`Refund ${id} in full? This ends their Premium.`)) act('refund', { action: 'refund', chargeId: id }, 'Refunded').then((r) => { if (r) setRefundId(''); }); }}>
          <label><span>Refund a payment <small>14-day refund requests: paste the payment id (ch_… or py_…) from Stripe</small></span>
            <div style={{ display: 'flex', gap: 8 }}><input value={refundId} onChange={(e) => setRefundId(e.target.value)} placeholder="ch_…" /><button className="btn small" disabled={!refundId.trim() || !!busy || !(hl.key && hl.key.ok)}>Refund</button></div></label>
        </form>
      </div>

      <div className="sa-card">
        <h3>📬 Webhook log <small>last {events.length}{failed ? ` · ${failed} failed` : ''}</small></h3>
        {!events.length && <p className="sa-empty">No events yet. They show up after the first purchase.</p>}
        {events.length > 0 && (
          <table className="ad-mini">
            <thead><tr><th>Event</th><th>Result</th><th>When</th></tr></thead>
            <tbody>{events.slice(0, showEvents ? 50 : 10).map((ev) => (
              <tr key={ev.id}>
                <td><code>{ev.type}</code>{ev.uid && nameOf(ev.uid) ? <small> · @{nameOf(ev.uid)}</small> : null}{!ev.live ? <small> · test</small> : null}</td>
                <td><b style={{ color: ev.status === 'done' ? C.mint : ev.status === 'failed' ? C.coral : C.yellow }}>{ev.status}</b>{ev.tries > 1 ? <small> · {ev.tries} tries</small> : null}{ev.error ? <><br /><small style={{ color: C.coral }}>{ev.error}</small></> : null}</td>
                <td>{ev.at ? new Date(ev.at).toLocaleString() : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {events.length > 10 && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setShowEvents(!showEvents)}>{showEvents ? 'Show fewer' : 'Show all'}</button>}
        <p className="ad-foot">Every Stripe event is handled once (repeats are ignored). Failed ones are retried by Stripe for up to 3 days.</p>
      </div>
    </>
  );
}
const FLAG_LABEL = { dispute: '⚖️ Dispute', fraud_warning: '🚨 Fraud warning', refund: '↩️ Refunded' };
// the plan before config/premium loads
function cleanPlanUI() { return { ...DEFAULT_PLAN, packages: DEFAULT_PLAN.packages, features: DEFAULT_PLAN.features }; }

// ---------- Reviews: approve before they go public ----------
const RV_FILTERS = [['pending', 'Waiting'], ['approved', 'Live'], ['hidden', 'Hidden'], ['all', 'All']];
function ReviewsTab({ social, users, toast, go, setOpenUid }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [show, setShow] = useState('pending');
  const [replying, setReplying] = useState('');
  const [reply, setReply] = useState('');
  const load = () => { setErr(''); social.admin.reviews().then(setList).catch((e) => { setList([]); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (id, patch, ok) => { try { await social.admin.setReview(id, patch); if (ok) toast({ text: ok }); load(); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const all = list || [];
  const live = all.filter((r) => r.status === 'approved' && r.show);
  const avg = live.length ? (live.reduce((t, r) => t + r.rating, 0) / live.length).toFixed(1) : '–';
  const shown = all.filter((r) => show === 'all' || r.status === show).sort((a, b) => ((b.status === 'pending') - (a.status === 'pending')) || ((b.updatedAt || b.at) - (a.updatedAt || a.at)));
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={all.filter((r) => r.status === 'pending').length} label="Waiting" sub="need a quick check" color={C.yellow} onClick={() => setShow('pending')} />
        <Kpi n={live.length} label="Live" sub="shown on meetnibble.com" color={C.mint} onClick={() => setShow('approved')} />
        <Kpi n={avg} label="Average" sub="stars, live reviews" color={C.violet} />
        <Kpi n={live.filter((r) => r.featured).length} label="Featured" sub="shown first" color={C.pink} />
      </div>
      <div className="sa-card">
        <h3>⭐ Reviews <small>{shown.length}</small>
          <span className="rp-filter">{RV_FILTERS.map(([k, l]) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{l}</button>)}</span>
          <button className="btn small ghost" onClick={load}>Refresh</button>
        </h3>
        {list === null && <p className="sa-empty">Loading…</p>}
        {err && <p className="sa-empty">{err.includes('ermission') || err.includes('Not allowed') ? 'Publish the latest Firestore rules to see reviews.' : err}</p>}
        {list && !err && !shown.length && <p className="sa-empty">{show === 'pending' ? 'No reviews waiting. 🎉' : 'Nothing here yet.'}</p>}
        {shown.map((r) => {
          const u = users.find((x) => x.uid === r.uid);
          return (
            <article key={r.id} className={'rp rp-' + (r.status === 'approved' ? 'done' : r.status === 'hidden' ? 'seen' : 'new')}>
              <header>
                <span className="rp-kind" style={{ color: '#ffd166', letterSpacing: 1 }}>{'★'.repeat(r.rating)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - r.rating)}</span></span>
                <b>{u ? <button className="sa-link" onClick={() => { go('users'); setOpenUid(u.uid); }}>@{r.username}</button> : '@' + r.username}</b>
                <span className={'rp-status rp-s-' + (r.status === 'approved' ? 'done' : r.status === 'hidden' ? 'seen' : 'new')}>{r.status === 'approved' ? 'live' : r.status}{r.featured ? ' · featured' : ''}</span>
              </header>
              <p className="rp-text">“{r.text}”</p>
              <p className="rp-who">{r.client || 'app'} · {ago(r.updatedAt || r.at)}{!r.show ? ' · asked NOT to be shown publicly' : ''}</p>
              {r.reply && <p className="rp-who">↳ Your reply: {r.reply}</p>}
              {replying === r.id && (
                <form className="sa-form" onSubmit={(e) => { e.preventDefault(); act(r.id, { reply }, 'Reply saved'); setReplying(''); }}>
                  <textarea rows={2} maxLength={300} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thanks so much! …" />
                  <div style={{ display: 'flex', gap: 8 }}><button className="btn small">Save reply</button><button type="button" className="btn small ghost" onClick={() => setReplying('')}>Cancel</button></div>
                </form>
              )}
              <footer>
                {r.status !== 'approved' && <button className="btn small" disabled={!r.show} title={!r.show ? 'They asked not to be shown publicly' : ''} onClick={() => act(r.id, { status: 'approved' }, 'Approved: it’s live')}>Approve</button>}
                {r.status === 'approved' && <button className="btn small ghost" onClick={() => act(r.id, { featured: !r.featured }, r.featured ? 'Unfeatured' : 'Featured')}>{r.featured ? 'Unfeature' : '⭐ Feature'}</button>}
                {r.status !== 'hidden' && <button className="btn small ghost" onClick={() => act(r.id, { status: 'hidden', featured: false }, 'Hidden')}>Hide</button>}
                <button className="btn small ghost" onClick={() => { setReplying(r.id); setReply(r.reply || ''); }}>{r.reply ? 'Edit reply' : 'Reply'}</button>
                <button className="btn small ghost" onClick={() => { if (window.confirm('Delete this review for good?')) social.admin.deleteReview(r.id).then(() => { toast({ text: 'Deleted' }); load(); }, (x) => toast({ err: true, text: niceError(x) })); }}>Delete</button>
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}


// ---------- Tea Room moderation ----------
const TeaSw = ({ on, onChange }) => <button className={'ad-switch' + (on ? ' on' : '')} onClick={onChange} aria-pressed={on}><i /></button>;
function TeaTab({ social, state, users, toast, go, setOpenUid }) {
  const Sw = TeaSw;
  const cfg = teaConfig(state.config);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [words, setWords] = useState(((state.config && state.config.teaWords) || []).join(', '));
  const load = () => { setErr(''); social.tea.admin.list().then(setData, (e) => { setData({ flags: [], recent: [] }); setErr(niceError(e)); }); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (patch, ok) => social.admin.setConfig(patch).then(() => toast({ text: ok || 'Saved' }), (e) => toast({ err: true, text: niceError(e) }));
  const sw = (k, v) => save({ tea: { ...cfg, [k]: v } });
  const act = (x, action, ok) => social.tea.admin.act({ action, feed: x.feed, pid: x.pid || x.id, cid: x.cid || '' }).then(() => { toast({ text: ok }); load(); }, (e) => toast({ err: true, text: niceError(e) }));
  const feedName = (x) => (x.feed === 'all' ? '🌍 Everyone' : '👥 ' + (x.feedName || 'a group'));
  const who = (x) => {
    const u = x.authorUid && users.find((y) => y.uid === x.authorUid);
    const name = x.authorName || (u && u.username) || '';
    return (
      <>
        {x.anon && x.mask ? <>🕶 {x.mask.name} · <span style={{ color: '#ffd166' }}>really</span> </> : ''}
        {u ? <button className="sa-link" onClick={() => { go('users'); setOpenUid(u.uid); }}>@{name}</button> : name ? '@' + name : 'unknown'}
      </>
    );
  };
  const suspend = (x) => {
    if (!x.authorUid) return;
    const r = window.prompt(`Suspend @${x.authorName || 'this person'}? They won’t be able to post anywhere.\n\nReason (optional, they won’t see it):`, 'Tea Room');
    if (r !== null) social.admin.ban(x.authorUid, x.authorName, r).then(() => toast({ text: 'Suspended' }), (e) => toast({ err: true, text: niceError(e) }));
  };
  const flags = (data && data.flags) || [];
  const recent = (data && data.recent) || [];
  return (
    <>
      <div className="ad-kpis">
        <Kpi n={data ? flags.filter((f) => f.hidden).length : '…'} label="Hidden" sub="by reports or by you" color={C.coral} />
        <Kpi n={data ? flags.filter((f) => !f.hidden).length : '…'} label="Reported" sub="still visible" color={C.yellow} />
        <Kpi n={data ? recent.filter((p) => !p.cid).length : '…'} label="Posts" sub="latest, all feeds" color={C.mint} />
        <Kpi n={data ? recent.filter((p) => p.anon).length : '…'} label="Anonymous" sub="posts + comments below" color={C.violet} />
      </div>
      <div className="sa-card">
        <h3>🍵 Switches</h3>
        <div className="ad-switches">
          <label><Sw on={cfg.on} onChange={() => sw('on', !cfg.on)} /><span><b>Tea Room open</b><small>Off hides the Tea Room page for everyone</small></span></label>
          <label><Sw on={cfg.everyone} onChange={() => sw('everyone', !cfg.everyone)} /><span><b>Everyone feed</b><small>One feed for all Nibble users (group feeds always work)</small></span></label>
          <label><Sw on={cfg.anon} onChange={() => sw('anon', !cfg.anon)} /><span><b>Anonymous in groups</b><small>People can post anonymously in their group feeds</small></span></label>
          <label><Sw on={cfg.anonAll} onChange={() => sw('anonAll', !cfg.anonAll)} /><span><b>Anonymous in Everyone</b><small>People can post anonymously in the Everyone feed</small></span></label>
        </div>
        <form className="sa-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); save({ teaWords: words.split(/[,\n]/).map((w) => w.trim()).filter(Boolean) }, 'Blocked words saved'); }}>
          <label>Blocked words and phrases <small>(comma separated, up to 100; whole words; on top of the built-in list)</small>
            <textarea rows={2} value={words} onChange={(e) => setWords(e.target.value)} placeholder="e.g. a slur, a classmate’s full name, a rival school…" />
          </label>
          <div><button className="btn small">Save words</button></div>
        </form>
      </div>
      <div className="sa-card">
        <h3>⚑ Reported and hidden <small>{flags.length}</small><button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={load}>Refresh</button></h3>
        {data === null && <p className="sa-empty">Loading…</p>}
        {err && <p className="sa-empty">{err}</p>}
        {data && !err && !flags.length && <p className="sa-empty">Nothing reported. 🎉</p>}
        {flags.map((f) => (
          <article key={f.id} className={'rp rp-' + (f.hidden ? 'new' : 'seen')}>
            <header>
              <span className="rp-kind">{f.cid ? '💬 comment' : '🍵 post'}</span>
              <b>{who(f)}</b>
              <span className={'rp-status rp-s-' + (f.hidden ? 'new' : 'seen')}>{f.hidden ? 'hidden' : 'visible'} · {f.reports} report{f.reports === 1 ? '' : 's'}</span>
            </header>
            <p className="rp-text">“{f.text || '(no text)'}”</p>
            <p className="rp-who">{feedName(f)} · posted {ago(f.postedAt)} · last report {ago(f.lastAt)}{f.reasons && f.reasons.length ? ' · “' + f.reasons.join('”, “') + '”' : ''}</p>
            <footer>
              {f.hidden ? <button className="btn small" onClick={() => act(f, 'restore', 'Restored: it’s visible again')}>Restore</button> : <button className="btn small" onClick={() => act(f, 'hide', 'Hidden')}>Hide</button>}
              {!f.hidden && <button className="btn small ghost" onClick={() => act(f, 'dismiss', 'Kept: reports cleared')}>Keep (it’s fine)</button>}
              <button className="btn small ghost" onClick={() => { if (window.confirm('Delete it for good?')) act(f, 'delete', 'Deleted'); }}>Delete</button>
              {f.authorUid && <button className="btn small ghost warn" onClick={() => suspend(f)}>⏸ Suspend author</button>}
            </footer>
          </article>
        ))}
      </div>
      <div className="sa-card">
        <h3>🕵️ Who posted what <small>latest {recent.length} posts and comments, every feed</small></h3>
        {data && !recent.length && <p className="sa-empty">No posts in the last 48 hours.</p>}
        {recent.map((p) => (
          <article key={p.id} className={'rp ' + (p.hidden ? 'rp-new' : 'rp-done')}>
            <header>
              <span className="rp-kind">{p.cid ? '💬 comment' : p.anon ? '🕶 anonymous' : '🍵 post'}</span>
              <b>{who(p)}</b>
              <span className="rp-status">{ago(p.at)}{!p.cid ? ` · ${p.cc || 0} comments` : ''}{p.reports ? ` · ${p.reports} reports` : ''}{p.hidden ? ' · hidden' : ''}</span>
            </header>
            <p className="rp-text">“{p.text || '(no text)'}”</p>
            <p className="rp-who">{feedName(p)}{p.cid && p.anon ? ' · anonymous comment' : ''}</p>
            <footer>
              {p.hidden ? <button className="btn small ghost" onClick={() => act(p, 'restore', 'Restored')}>Restore</button> : <button className="btn small ghost" onClick={() => act(p, 'hide', 'Hidden')}>Hide</button>}
              <button className="btn small ghost" onClick={() => { if (window.confirm(p.cid ? 'Delete this comment?' : 'Delete this post and its comments?')) act(p, 'delete', 'Deleted'); }}>Delete</button>
              {p.authorUid && <button className="btn small ghost warn" onClick={() => suspend(p)}>⏸ Suspend author</button>}
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

const NAV = [
  ['Insights', [
    ['overview', 'Overview', '📊', 'How Nibble is doing right now: people online, sign-ups, versions and activity.', ['Click any number to jump to the matching list.', 'Numbers are live while this tab is open; it pauses after 3 minutes in the background to save Firebase reads.']],
    ['users', 'Users', '👥', 'Everyone with an account: look someone up, check their version, reset their look, adjust points or suspend them.', ['Search by username, pet name or UID.', 'Click a person to open their details on the right.', 'Suspending stops them posting anywhere; it doesn’t delete anything.']],
    ['games', 'Games & points', '🎮', 'The points economy and mini games: switch games on or off and set daily limits.', ['Turning a game off hides it for everyone straight away.', 'Points can’t be bought, only earned, so keep daily limits fair.']],
    ['usage', 'Firebase usage', '📈', 'Today’s Firestore reads and writes against the free daily limits, and switches that save quota.', ['Turn on Saver mode when reads pass about 70% of the limit.', 'Limits reset at 1:30 PM Sri Lanka time (midnight Pacific).']],
  ]],
  ['Inbox', [
    ['reviews', 'Reviews', '⭐', 'Reviews people write in the app. Nothing shows on the website until you approve it.', ['Approve honest reviews, good or bad: a mix of ratings looks more trustworthy than only 5 stars.', 'Hide spam or anything rude; you can’t change someone’s words or stars.', 'Feature a few great ones to show them first. Replies show under the review.']],
    ['tea', 'Tea Room', '🍵', 'The Tea Room: switches, blocked words, reported posts, and who really wrote every post and comment (anonymous ones too), in every feed.', ['Anonymous posts are anonymous to users, never to admins: the real @username shows here.', 'A post reported by 3 different people hides itself; restore it if the reports were unfair.', 'Posts disappear after 48 hours.']],
    ['reports', 'Reports', '📬', 'Bug reports, feedback and contact-form messages from the app and the website.', ['Mark a report Seen when you’ve read it and Done when it’s handled.', 'Use ✉️ Reply by email to answer someone; the reply opens in the Email page.']],
  ]],
  ['Communicate', [
    ['announce', 'Announcements', '📣', 'A banner inside the app for everyone signed in (desktop users also get a notification).', ['Keep it short: 200 characters at most.', 'Use “Update” when a new version is out, “Warning” only for real problems.']],
    ['email', 'Email', '✉️', 'Send a one-off email to one person or a few (up to 20), from no-reply@meetnibble.com.', ['Replies go to hello@meetnibble.com.', 'For news to everyone who subscribed, use Marketing instead.']],
    ['marketing', 'Marketing', '📢', 'Bulk email: import contacts, pick a designed template, preview it, test it and send it to a list.', ['Import only people who agreed to hear from you; keep them in “Imported contacts”.', 'Always send yourself a test first, and check the phone preview.', 'Free plan: 3,000 emails a month, 100 a day. Bigger lists need a paid Resend plan.', 'Every email gets an unsubscribe link automatically.']],
  ]],
  ['Money', [
    ['premium', 'Premium', '💎', 'Nibble Premium: switch it on or off, manage packages, prices, free trials, promo codes and features, check the Stripe set-up, manage subscribers, and review disputes, fraud warnings and refunds.', ['Refund requests within 14 days are always granted (our refund policy): paste the payment id under Disputes & fraud warnings.', 'A flagged account can’t buy again until you clear it. Look at the payment in Stripe first.', 'Stripe keys go in Vercel environment variables (see the set-up guide); this page never shows them.', 'Test with a sk_test_ key and card 4242 4242 4242 4242 before switching to live keys.', 'A new price only applies to new subscribers; people already subscribed keep theirs.', 'Built-in features change the app (badge, double bonus, bigger rooms); custom ones are just listed.']],
  ]],
  ['Grow', [
    ['seo', 'SEO', '🔎', 'How Nibble looks on Google and when shared: page titles, descriptions and share images.', ['Titles: 30–60 characters. Descriptions: 120–160.', 'After big changes, ask Google to re-crawl from Search Console → URL inspection.', 'Use Facebook’s Sharing Debugger to refresh old share previews.']],
  ]],
  ['System', [
    ['settings', 'Settings', '⚙️', 'App-wide switches: minimum desktop version, pinned notice, shop and the state of the Firestore rules.', ['Raising the minimum version asks everyone older to update.', 'If something here says “publish the rules”, paste firestore.rules into Firebase and click Publish.']],
  ]],
];
const TABS = NAV.flatMap(([, items]) => items);

function Dashboard({ social, state }) {
  useNibble(); // loads the character palettes used for avatars and charts
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [openUid, setOpenUid] = useState('');
  const [users, setUsers] = useState(undefined); // undefined = loading, null = couldn't load
  const [banned, setBanned] = useState([]);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState('');
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState(null); // an email to open in the Email tab (e.g. a reply to a report)
  const toast = (n) => setNote(n);

  // the live lists read every change from every user; pause them after 3 minutes in the background
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    let t = null;
    const f = () => { clearTimeout(t); if (document.hidden) t = setTimeout(() => setAwake(false), 3 * 60_000); else setAwake(true); };
    document.addEventListener('visibilitychange', f);
    return () => { document.removeEventListener('visibilitychange', f); clearTimeout(t); };
  }, []);
  useEffect(() => (awake ? social.admin.watchUsers(setUsers) : undefined), [social, awake]);
  useEffect(() => social.admin.watchBanned(setBanned), [social]);
  useEffect(() => social.admin.watchHistory(setHistory), [social]);
  useEffect(() => { fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => setLatest(v.version || '')).catch(() => {}); }, []);

  const go = (t, f, uid) => {
    setTab(t); setMenu(false);
    if (f) setFilter(f);
    if (uid) setOpenUid(uid);
    try { window.history.replaceState(null, '', '#' + t); } catch {}
    window.scrollTo({ top: 0 });
  };
  // open the page in the address (#seo, #reports…) so a refresh or a shared link lands there
  useEffect(() => { const h = (location.hash || '').slice(1); if (TABS.some(([k]) => k === h)) setTab(h); }, []);
  const [menu, setMenu] = useState(false);
  const [guide, setGuide] = useState(() => { try { return localStorage.getItem('nibble-admin-tips') !== '0'; } catch { return true; } });
  const toggleGuide = () => { const v = !guide; setGuide(v); try { localStorage.setItem('nibble-admin-tips', v ? '1' : '0'); } catch {} };
  const info = TABS.find(([k]) => k === tab) || TABS[0];
  const bannedMap = useMemo(() => new Map((banned || []).map((b) => [b.uid, b])), [banned]);
  const list = users || [];
  const minVersion = (state.config && state.config.minVersion) || '';
  const open = openUid && list.find((u) => u.uid === openUid);
  const online = list.filter((u) => u.online).length;

  return (
    <div className={'ad-wrap' + (menu ? ' menu-open' : '')}>
      <aside className="ad-side" aria-label="Admin pages">
        <div className="ad-side-top">
          <a className="ad-brand" href="/"><span className="sa-logo"><img src="/logo.svg" alt="" /></span> Nibble <em>Admin</em></a>
          <button className="ad-close" onClick={() => setMenu(false)} aria-label="Close menu">✕</button>
        </div>
        <nav className="ad-nav">
          {NAV.map(([group, items]) => (
            <div key={group} className="ad-nav-group">
              <div className="ad-nav-k">{group}</div>
              {items.map(([k, l, i]) => (
                <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
                  <span className="ad-nav-i">{i}</span><span className="ad-nav-l">{l}</span>
                  {k === 'users' && users ? <b className="ad-nav-n">{online}</b> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="ad-side-foot">
          <span className="ad-live"><i />{online} online now</span>
          <div className="ad-who"><Ava u={{ ...state.profile, uid: state.user.uid }} size={30} /><div><b>@{state.profile.username}</b><small>Admin</small></div></div>
          <div className="ad-side-btns">
            <a className="btn small ghost" href="/app">Open app</a>
            <button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button>
          </div>
        </div>
      </aside>
      <div className="ad-scrim" onClick={() => setMenu(false)} />

      <div className="ad-body">
      <header className="ad-mtop">
        <button className="ad-burger" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
        <b>{info[2]} {info[1]}</b>
        <span className="ad-live"><i />{online}</span>
      </header>
      <main className="ad-main">
        <div className="ad-head">
          <div className="ad-crumb">{(NAV.find(([, items]) => items.some(([k]) => k === tab)) || [''])[0]}</div>
          <h2>{info[2]} {info[1]}</h2>
          <p className="ad-desc">{info[3]}</p>
          <span className="ad-sub">{users ? `${list.length} users · live` : 'Loading…'}{latest && ` · latest release v${latest}`}</span>
          <button className={'ad-guide-btn' + (guide ? ' on' : '')} onClick={() => toggleGuide()}>{guide ? 'Hide tips' : '💡 Tips'}</button>
        </div>
        {guide && (
          <div className="ad-guide">
            <b>How to use this page</b>
            <ul>{info[4].map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
        {!users && (users === null ? <div className="sa-card"><p className="sa-empty">Couldn't load users — check the Firestore rules are published.</p></div> : <div className="ad-skel"><i /><i /><i /></div>)}
        {users && tab === 'overview' && <Overview social={social} users={list} banned={banned || []} latest={latest} minVersion={minVersion} go={go} />}
        {users && tab === 'users' && <Users users={list} bannedMap={bannedMap} latest={latest} minVersion={minVersion} filter={filter} setFilter={setFilter} openUid={openUid} setOpenUid={setOpenUid} me={state.user.uid} />}
        {users && tab === 'games' && <GamesTab social={social} state={state} users={list} toast={toast} setOpenUid={setOpenUid} go={go} />}
        {users && tab === 'tea' && <TeaTab social={social} state={state} users={list} toast={toast} go={go} setOpenUid={setOpenUid} />}
        {users && tab === 'reviews' && <ReviewsTab social={social} users={list} toast={toast} go={go} setOpenUid={setOpenUid} />}
        {users && tab === 'reports' && <ReportsTab social={social} users={list} toast={toast} go={go} setOpenUid={setOpenUid} reply={(d) => { setDraft(d); go('email'); }} />}
        {tab === 'email' && <EmailTab social={social} toast={toast} draft={draft} setDraft={setDraft} />}
        {tab === 'marketing' && <MarketingTab social={social} state={state} toast={toast} />}
        {tab === 'seo' && <SeoTab social={social} toast={toast} />}
        {users && tab === 'premium' && <PremiumTab social={social} state={state} users={list} toast={toast} go={go} setOpenUid={setOpenUid} />}
        {users && tab === 'usage' && <UsageTab social={social} state={state} users={list} toast={toast} />}
        {tab === 'announce' && <Announce social={social} state={state} history={history} toast={toast} />}
        {users && tab === 'settings' && <SettingsTab social={social} state={state} users={list} banned={banned} history={history} latest={latest} toast={toast} setOpenUid={setOpenUid} go={go} />}
      </main>
      </div>

      {open && <UserDrawer u={open} ban={bannedMap.get(open.uid)} social={social} me={state.user.uid} toast={toast} onClose={() => setOpenUid('')} minVersion={minVersion} />}
      <Toast note={note} onDone={() => setNote(null)} />
    </div>
  );
}

export default function AdminApp() {
  const { social, state, missing } = useSocial();
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12_000); return () => clearTimeout(t); }, []);
  const center = (title, sub, extra) => <div className="sa solo"><div className="sa-center"><h1>{title}</h1><p className="sa-sub">{sub}</p>{extra}</div></div>;
  const out = <p className="sa-sub" style={{ marginTop: 10 }}><a className="sa-link" href="/app">Open the Nibble app</a> · <button className="sa-link" onClick={() => social.signOut()}>Sign out</button></p>;
  if (missing) return center('Nibble Admin', 'The backend isn’t configured yet.');
  if (!social || !state.ready) return center('Nibble Admin', slow ? 'Still loading. Check your connection and refresh the page.' : 'Loading…');
  if (!state.user) {
    return <div className="sa solo"><div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Sign in with your team account.</p><div style={{ maxWidth: 380, width: '100%' }}><AuthScreen social={social} /></div></div></div>;
  }
  // still loading this account (profile or admin check): never flash "not an admin" / "finish set-up"
  if (state.profile === undefined || state.admin === null || state.admin === undefined) {
    const why = state.loadError === 'resource-exhausted' ? 'Firebase’s free daily limit is used up, so the dashboard can’t load until it resets (midnight Pacific, about 1:30 PM in Sri Lanka).' : state.loadError || slow ? 'This is taking longer than usual. Check your connection and refresh.' : 'Checking your access…';
    return center('Nibble Admin', why, (state.loadError || slow) ? <p className="sa-sub"><button className="btn small" onClick={() => location.reload()}>Try again</button></p> : null);
  }
  if (!state.admin) {
    return center('This page is for the Nibble team', `You’re signed in as ${state.profile ? '@' + state.profile.username : state.user.email || 'a Nibble user'}, which isn’t a team account. Looking for your pets and friends? Open the Nibble app.`, <>
      {out}
      <details className="sa-sub" style={{ marginTop: 18, fontSize: 13 }}><summary style={{ cursor: 'pointer' }}>I’m on the team</summary>
        <p>Ask an admin to add your account. They’ll need this ID:</p>
        <code className="sa-copy" style={{ userSelect: 'all' }}>{state.user.uid}</code>
      </details>
    </>);
  }
  // an admin whose account isn't set up yet (no username): the dashboard needs one for its records
  if (!state.profile) return center('Almost there', 'Your admin account needs a username first. Open the Nibble app, pick a username, then come back here.', out);
  return <div className="sa solo ad"><Dashboard social={social} state={state} /></div>;
}
