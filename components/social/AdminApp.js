'use client';
import './social.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen } from './Auth';
import PetFigure, { useNibble, PetSnap } from '../PetFigure';
import { ITEMS, SPECIES as SHOP_SPECIES, OUTFITS as SHOP_OUTFITS, SKILLS as SHOP_SKILLS, PT } from '../../lib/shop';
import { SOLO as SOLO_A } from '../games/solo';
import { SOLO2 } from '../games/solo2';
import { GAMES as LIVE_GAMES } from '../../lib/social/games';

const SOLO_ALL = [...SOLO2, ...SOLO_A];
const lookLabel = (u) => {
  const st = u.style || {};
  const parts = [];
  if (st.sp) parts.push((SHOP_SPECIES.find((x) => x.key === st.sp) || {}).label || st.sp);
  if (st.of) parts.push((SHOP_OUTFITS.find((x) => x.key === st.of) || {}).label || st.of);
  return parts.join(' · ');
};
import { niceError, verLess, LEVELS, ms } from '../../lib/social/social';

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
          <b>{r.value}{unit}</b>
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
function Overview({ users, banned, latest, minVersion, go }) {
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
    </>
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

// games on/off, points economy and live matches
function GamesTab({ social, state, users, toast, setOpenUid, go }) {
  const cfg = state.config || {};
  const off = Array.isArray(cfg.gamesOff) ? cfg.gamesOff : [];
  const [matches, setMatches] = useState([]);
  useEffect(() => social.admin.watchMatches(setMatches), [social]);
  const save = async (patch, ok) => { try { await social.admin.setConfig(patch); toast({ text: ok }); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const toggleGame = (k) => save({ gamesOff: off.includes(k) ? off.filter((x) => x !== k) : [...off, k] }, off.includes(k) ? 'Game switched on' : 'Game switched off');
  const wallets = users.filter((u) => u.wallet);
  const total = wallets.reduce((t, u) => t + u.wallet.points, 0);
  const today = Math.floor(Date.now() / DAY);
  const earnedToday = wallets.reduce((t, u) => t + (u.wallet.day === today ? u.wallet.earned : 0), 0);
  const sold = countBy(wallets.flatMap((u) => u.wallet.owned), (x) => x).slice(0, 8);
  const rich = [...wallets].sort((a, b) => b.wallet.points - a.wallet.points).slice(0, 8);
  const live = (matches || []).filter((m) => m.status !== 'done');
  const name = (uid) => (users.find((u) => u.uid === uid) || {}).username || uid.slice(0, 6);
  const Sw = ({ on, onChange }) => <button className={'ad-switch' + (on ? ' on' : '')} onClick={onChange} aria-pressed={on}><i /></button>;
  return (
    <>
      <div className="ad-kpis ad-kpis4">
        <Kpi n={`${PT} ${total.toLocaleString()}`} label="Points held" sub={`${wallets.length} wallets`} color={C.yellow} />
        <Kpi n={earnedToday.toLocaleString()} label="Earned today" sub="by everyone" color={C.mint} />
        <Kpi n={wallets.reduce((t, u) => t + u.wallet.owned.length, 0)} label="Items unlocked" sub="all time" color={C.pink} />
        <Kpi n={live.length} label="Live friend games" sub={`${(matches || []).length} total`} color={C.cyan} />
      </div>
      <div className="sa-card">
        <h3>🎮 Switches</h3>
        <div className="ad-switches">
          <label><Sw on={cfg.games !== false} onChange={() => save({ games: cfg.games === false }, cfg.games === false ? 'Games are on for everyone' : 'Games switched off for everyone')} /><span><b>Games</b><small>All mini games and friend games</small></span></label>
          <label><Sw on={cfg.shop !== false} onChange={() => save({ shop: cfg.shop === false }, cfg.shop === false ? 'Shop is open' : 'Shop closed (nobody can buy)')} /><span><b>Shop</b><small>Unlocking items with points</small></span></label>
        </div>
        <h3 style={{ marginTop: 18 }}>Each game <small>{cfg.games === false ? 'all games are off right now' : 'switch single games off'}</small></h3>
        <div className="ad-gamelist">
          {[...SOLO_ALL.map((g) => [g.key, g.emoji, g.title, 'Solo']), ...Object.entries(LIVE_GAMES).map(([k, g]) => [k, g.emoji, g.label, 'With friends'])].map(([k, e, t, kind]) => {
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
      <div className="sa-card">
        <h3>⚔️ Friend games right now <small>{live.length}</small></h3>
        {matches === null && <p className="sa-empty">Needs the latest Firestore rules.</p>}
        {live.length === 0 && matches !== null && <p className="sa-empty">No games in progress.</p>}
        {live.map((m) => (
          <div key={m.id} className="ad-hist">
            <span className="ad-hist-ico">{(LIVE_GAMES[m.game] || {}).emoji || '🎮'}</span>
            <div><b>@{name(m.players[0])} vs @{name(m.players[1])}</b><p>{(LIVE_GAMES[m.game] || {}).label} · {m.status === 'invite' ? 'waiting to accept' : `${m.moves || 0} moves, @${name(m.turn)}’s turn`}</p><small>{ago(m.at)}</small></div>
            <button className="btn small ghost" onClick={async () => { try { await social.admin.endMatch(m.id); toast({ text: 'Game ended' }); } catch (x) { toast({ err: true, text: niceError(x) }); } }}>End</button>
          </div>
        ))}
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
const TABS = [['overview', 'Overview', '📊'], ['users', 'Users', '👥'], ['games', 'Games & points', '🎮'], ['announce', 'Announcements', '📣'], ['settings', 'Settings', '⚙️']];

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
  const toast = (n) => setNote(n);

  useEffect(() => social.admin.watchUsers(setUsers), [social]);
  useEffect(() => social.admin.watchBanned(setBanned), [social]);
  useEffect(() => social.admin.watchHistory(setHistory), [social]);
  useEffect(() => { fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => setLatest(v.version || '')).catch(() => {}); }, []);

  const go = (t, f, uid) => { setTab(t); if (f) setFilter(f); if (uid) setOpenUid(uid); window.scrollTo({ top: 0 }); };
  const bannedMap = useMemo(() => new Map((banned || []).map((b) => [b.uid, b])), [banned]);
  const list = users || [];
  const minVersion = (state.config && state.config.minVersion) || '';
  const open = openUid && list.find((u) => u.uid === openUid);
  const online = list.filter((u) => u.online).length;

  return (
    <div className="ad-wrap">
      <header className="ad-top">
        <a className="ad-brand" href="/"><span className="sa-logo">◕‿◕</span> Nibble <em>Admin</em></a>
        <nav className="ad-tabs">
          {TABS.map(([k, l, i]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><span>{i}</span>{l}</button>)}
        </nav>
        <div className="ad-me">
          <span className="ad-live"><i />{online} online</span>
          <a className="btn small ghost" href="/app">Open app</a>
          <button className="btn small ghost" onClick={() => social.signOut()} title={'Signed in as @' + state.profile.username}>Sign out</button>
        </div>
      </header>

      <main className="ad-main">
        <div className="ad-head">
          <h2>{TABS.find(([k]) => k === tab)[2]} {TABS.find(([k]) => k === tab)[1]}</h2>
          <span className="ad-sub">{users ? `${list.length} users · live` : 'Loading…'}{latest && ` · latest release v${latest}`}</span>
        </div>
        {!users && (users === null ? <div className="sa-card"><p className="sa-empty">Couldn't load users — check the Firestore rules are published.</p></div> : <div className="ad-skel"><i /><i /><i /></div>)}
        {users && tab === 'overview' && <Overview users={list} banned={banned || []} latest={latest} minVersion={minVersion} go={go} />}
        {users && tab === 'users' && <Users users={list} bannedMap={bannedMap} latest={latest} minVersion={minVersion} filter={filter} setFilter={setFilter} openUid={openUid} setOpenUid={setOpenUid} me={state.user.uid} />}
        {users && tab === 'games' && <GamesTab social={social} state={state} users={list} toast={toast} setOpenUid={setOpenUid} go={go} />}
        {tab === 'announce' && <Announce social={social} state={state} history={history} toast={toast} />}
        {users && tab === 'settings' && <SettingsTab social={social} state={state} users={list} banned={banned} history={history} latest={latest} toast={toast} setOpenUid={setOpenUid} go={go} />}
      </main>

      {open && <UserDrawer u={open} ban={bannedMap.get(open.uid)} social={social} me={state.user.uid} toast={toast} onClose={() => setOpenUid('')} minVersion={minVersion} />}
      <Toast note={note} onDone={() => setNote(null)} />
    </div>
  );
}

export default function AdminApp() {
  const { social, state, missing } = useSocial();
  if (missing) return <div className="sa solo"><div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">The backend isn’t configured yet.</p></div></div>;
  if (!social || !state.ready) return <div className="sa solo"><div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Loading…</p></div></div>;

  let inner;
  if (!state.user) inner = <div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Sign in to continue.</p><div style={{ maxWidth: 380, width: '100%' }}><AuthScreen social={social} /></div></div>;
  else if (!state.profile) inner = <div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Finish setting up your account in the <a className="sa-link" href="/app">Nibble app</a> first.</p></div>;
  else if (!state.admin) inner = (
    <div className="sa-center">
      <h1>Not an admin</h1>
      <p className="sa-sub">Your account isn’t an admin yet. To become one, add a document in Firestore:<br />collection <b>admins</b> → document ID = your UID below → any field.</p>
      <code className="sa-copy" style={{ userSelect: 'all' }}>{state.user.uid}</code>
      <p className="sa-sub" style={{ marginTop: 10 }}><button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button></p>
    </div>
  );
  else return <div className="sa solo ad"><Dashboard social={social} state={state} /></div>;

  return <div className="sa solo">{inner}</div>;
}
