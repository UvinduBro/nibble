'use client';
// Tea Room ☕: gossip posts and comments, as yourself or anonymous, in the Everyone feed or a
// group's own feed. Reads are one page at a time (no live listener) to save Firebase quota.
import { useEffect, useMemo, useRef, useState } from 'react';
import PetFigure from '../PetFigure';
import { niceError } from '../../lib/social/social';
import { REACTS, MAX_POST, MAX_COMMENT, PROMPTS, dailyPrompt, teaConfig } from '../../lib/tea';

const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
};
const heat = (p) => Object.values(p.rc || {}).reduce((t, n) => t + Math.max(0, n || 0), 0) + 2 * (p.cc || 0);

// anonymous people get a mystery animal; everyone else their own pet
function Who({ x, size = 40 }) {
  if (x.anon && x.mask) return <span className="tea-mask" style={{ width: size, height: size, '--mc': x.mask.color, fontSize: size * 0.5 }}>{x.mask.emoji}<i>🕶</i></span>;
  return <span className="sa-ava" style={{ width: size, height: size }}><PetFigure skin={x.skin || 'mint'} mood="idle" w={size} h={size} size={size / 92} look={x.look} /></span>;
}
const whoName = (x) => (x.anon && x.mask ? x.mask.name : '@' + (x.name || 'someone'));

// "As me" / "Anonymous" switch
function Identity({ anon, setAnon, allowed, small }) {
  return (
    <div className={'tea-id' + (small ? ' small' : '')} role="radiogroup" aria-label="Post as">
      <button type="button" role="radio" aria-checked={!anon} className={!anon ? 'on' : ''} onClick={() => setAnon(false)}>🙂 {small ? 'Me' : 'As me'}</button>
      {allowed && <button type="button" role="radio" aria-checked={anon} className={anon ? 'on anon' : ''} onClick={() => setAnon(true)}>🕶 Anonymous</button>}
    </div>
  );
}

function Menu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  return (
    <span className="tea-menu" ref={ref}>
      <button type="button" className="tea-dots" aria-label="More" onClick={() => setOpen(!open)}>⋯</button>
      {open && <span className="tea-pop">{items.map(([l, f]) => <button type="button" key={l} onClick={() => { setOpen(false); f(); }}>{l}</button>)}</span>}
    </span>
  );
}

function Thread({ social, feed, p, canAnon, toast, onCount, canMod }) {
  const [list, setList] = useState(null);
  const [t, setT] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { social.tea.comments(feed, p.id).then(setList, (x) => { setList([]); toast({ err: true, text: niceError(x) }); }); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    setBusy(true);
    try {
      const r = await social.tea.comment(feed, p.id, t, anon);
      setT('');
      setList((l) => [...(l || []), { id: r.id, ...r.doc }]);
      onCount(1);
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  const remove = (c) => social.tea.remove(feed, p.id, c.id).then(() => { setList((l) => l.filter((x) => x.id !== c.id)); onCount(-1); }, (x) => toast({ err: true, text: niceError(x) }));
  const report = (c) => social.tea.report(feed, p.id, c.id, '').then((r) => toast({ text: r.already ? 'You already reported this.' : 'Reported. Thanks!' }), (x) => toast({ err: true, text: niceError(x) }));
  return (
    <div className="tea-thread">
      {list === null && <p className="sa-empty">Loading…</p>}
      {list && list.map((c) => (
        <div key={c.id} className={'tea-c' + (c.anon ? ' anon' : '')}>
          <Who x={c} size={30} />
          <div className="tea-bubble">
            <small><b>{whoName(c)}</b>{c.op && <em className="tea-chip op">poster</em>}<span>{ago(c.at)}</span></small>
            <p>{c.text}</p>
          </div>
          <Menu items={social.tea.isMine(p.id, c.id) || canMod ? [['🗑 Delete', () => remove(c)]] : [['⚑ Report', () => report(c)]]} />
        </div>
      ))}
      <form className="tea-reply" onSubmit={send}>
        <input value={t} maxLength={MAX_COMMENT} placeholder={list && !list.length ? 'Be the first to reply…' : 'Reply…'} onChange={(e) => setT(e.target.value)} />
        <Identity anon={anon} setAnon={setAnon} allowed={canAnon} small />
        <button className="btn small" disabled={busy || !t.trim()}>Send</button>
      </form>
    </div>
  );
}

function Post({ social, feed, p, canAnon, toast, onGone, canMod }) {
  const [rc, setRc] = useState(p.rc || {});
  const [mine, setMine] = useState(social.tea.myReact(p.id));
  const [open, setOpen] = useState(false);
  const [cc, setCc] = useState(p.cc || 0);
  const react = async (k) => {
    const next = mine === k ? '' : k;
    const before = { rc, mine };
    const n = { ...rc };
    if (mine) n[mine] = Math.max(0, (n[mine] || 0) - 1);
    if (next) n[next] = (n[next] || 0) + 1;
    setRc(n); setMine(next);
    try { await social.tea.react(feed, p.id, next); } catch (x) { setRc(before.rc); setMine(before.mine); toast({ err: true, text: niceError(x) }); }
  };
  const report = () => social.tea.report(feed, p.id, '', '').then((r) => { toast({ text: r.already ? 'You already reported this.' : 'Reported. Thanks!' }); if (r.hidden) onGone(p.id); }, (x) => toast({ err: true, text: niceError(x) }));
  const remove = () => { if (window.confirm('Delete this post?')) social.tea.remove(feed, p.id).then(() => onGone(p.id), (x) => toast({ err: true, text: niceError(x) })); };
  const prompt = p.prompt >= 0 ? PROMPTS[p.prompt] || '' : '';
  const hot = heat({ rc, cc }) >= 8;
  return (
    <article className={'tea-post' + (p.anon ? ' anon' : '')}>
      <header>
        <Who x={p} />
        <span className="tea-who">
          <b>{whoName(p)}</b>
          {p.anon && <em className="tea-chip">anonymous</em>}
          {hot && <em className="tea-chip hot">🔥 hot</em>}
          <small>{ago(p.at)}</small>
        </span>
        <Menu items={social.tea.isMine(p.id) || canMod ? [['🗑 Delete', remove]] : [['⚑ Report', report]]} />
      </header>
      {prompt && <p className="tea-q">☕ {prompt}</p>}
      <p className="tea-text">{p.text}</p>
      <footer>
        <span className="tea-reacts">
          {REACTS.map(([k, e, l]) => (
            <button key={k} type="button" className={(mine === k ? 'on ' : '') + (rc[k] > 0 ? 'has' : '')} title={l} onClick={() => react(k)}>{e}{rc[k] > 0 && <b>{rc[k]}</b>}</button>
          ))}
        </span>
        <button type="button" className={'tea-ccount' + (open ? ' on' : '')} onClick={() => setOpen(!open)}>💬 {cc > 0 ? cc : 'Reply'}</button>
      </footer>
      {open && <Thread social={social} feed={feed} p={p} canAnon={canAnon} toast={toast} onCount={(d) => setCc((n) => Math.max(0, n + d))} canMod={canMod} />}
    </article>
  );
}

export default function TeaRoom({ social, state, toast, go, teaFeed, setTeaFeed }) {
  const cfg = teaConfig(state.config);
  const feeds = social.tea.feeds();
  const feed = feeds.find((f) => f.id === teaFeed) ? teaFeed : (feeds[0] && feeds[0].id) || '';
  const cur = feeds.find((f) => f.id === feed);
  const group = cur && cur.group ? (state.groups || []).find((g) => g.id === feed) : null;
  const canAnon = feed === 'all' ? cfg.anonAll : cfg.anon;
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(false);
  const [last, setLast] = useState(0);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [usePrompt, setUsePrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('new');
  const today = dailyPrompt();
  const me = state.profile || {};

  const load = (after) => {
    setErr('');
    if (!after) setPosts(null);
    social.tea.load(feed, after).then((r) => {
      setPosts((l) => (after ? [...(l || []), ...r.posts] : r.posts));
      setMore(r.more); setLast(r.last);
    }, (x) => { setPosts([]); setErr(niceError(x)); });
  };
  useEffect(() => { if (feed && cfg.on) load(); }, [feed, cfg.on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (group) social.groups.markSeen(group.id, 'tea'); }, [group && group.id, group && group.teaAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!canAnon) setAnon(false); }, [canAnon]);
  const shown = useMemo(() => (posts && sort === 'hot' ? [...posts].sort((a, b) => heat(b) - heat(a) || b.at - a.at) : posts), [posts, sort]);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await social.tea.post(feed, text, anon, usePrompt ? today.id : -1);
      setPosts((l) => [{ id: r.id, ...r.doc }, ...(l || [])]);
      setText(''); setUsePrompt(false);
      toast({ text: anon ? '🕶 Posted anonymously' : '🍵 Posted' });
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };

  if (!cfg.on) {
    return <div className="sa-page"><div className="sa-center"><PetFigure skin="mint" mood="sleep" w={140} h={130} /><h1>The Tea Room is closed</h1><p className="sa-sub">It’s taking a little break. Check back soon!</p></div></div>;
  }

  return (
    <div className="sa-page tea">
      <div className="tea-hero">
        <div>
          <h2>Tea Room <span>☕</span></h2>
          <p>Spill it. As you, or anonymously.</p>
        </div>
        <PetFigure skin={me.skin || 'mint'} mood="dance" w={96} h={88} size={0.8} acc={me.acc} tint={me.tint} makeup={me.makeup} look={me.style} />
      </div>

      {!feeds.length ? (
        <div className="sa-card gr-empty">
          <PetFigure skin="mint" mood="happy" w={110} h={100} />
          <div><h3>Tea is better with friends</h3><p className="sa-sub">Each group has its own Tea Room. Make a group to start one.</p><button className="btn small" onClick={() => go('groups')}>Go to Groups</button></div>
        </div>
      ) : (
        <>
          <div className="tea-feeds">
            {feeds.map((f) => {
              const g = f.group && (state.groups || []).find((x) => x.id === f.id);
              const dot = f.id === 'all' ? state.teaNew : g && g.newTea;
              return <button key={f.id} className={f.id === feed ? 'on' : ''} onClick={() => setTeaFeed(f.id)}>{f.emoji} {f.name}{dot && f.id !== feed && <i className="gr-new-dot" />}</button>;
            })}
          </div>

          <form className={'tea-compose' + (anon ? ' anon' : '')} onSubmit={post}>
            <div className="tea-compose-top">
              {anon ? <span className="tea-mask" style={{ width: 40, height: 40, '--mc': '#9b5de5', fontSize: 20 }}>❔<i>🕶</i></span> : <Who x={{ skin: me.skin, look: me.style }} />}
              <span className="tea-as">{anon ? <><b>Anonymous</b><small>A mystery animal. Nobody sees it’s you.</small></> : <><b>@{me.username}</b><small>Posting as yourself</small></>}</span>
              <Identity anon={anon} setAnon={setAnon} allowed={canAnon} />
            </div>
            <textarea rows={3} value={text} maxLength={MAX_POST} placeholder={usePrompt ? today.text : feed === 'all' ? 'What’s the tea? ☕' : `What’s the tea in ${cur ? cur.name : 'the group'}?`} onChange={(e) => setText(e.target.value)} />
            <div className="tea-compose-row">
              <button type="button" className={'tea-qbtn' + (usePrompt ? ' on' : '')} onClick={() => setUsePrompt(!usePrompt)} title="Answer today’s question">☕ {today.text}</button>
              <em className={MAX_POST - text.length < 30 ? 'low' : ''}>{MAX_POST - text.length}</em>
              <button className="btn small" disabled={busy || !text.trim()}>{busy ? 'Posting…' : anon ? 'Post anonymously' : 'Post'}</button>
            </div>
          </form>

          <div className="tea-bar">
            <div className="lb-tabs" role="tablist">
              <button role="tab" aria-selected={sort === 'new'} className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>🆕 New</button>
              <button role="tab" aria-selected={sort === 'hot'} className={sort === 'hot' ? 'on' : ''} onClick={() => setSort('hot')}>🔥 Hot</button>
            </div>
            <button className="sa-link" onClick={() => load()}>↻ Refresh</button>
          </div>

          {posts === null && <p className="sa-empty">Brewing…</p>}
          {err && <div className="sa-card"><p className="sa-empty">{/ermission|Not allowed/.test(err) ? 'Can’t open this feed yet. Try again in a minute.' : err}</p><button className="btn small ghost" onClick={() => load()}>Try again</button></div>}
          {shown && !err && !shown.length && (
            <div className="tea-empty"><PetFigure skin="mint" mood="happy" w={100} h={92} /><b>No tea yet</b><span>Be the first to spill some ☕</span></div>
          )}
          {shown && shown.map((p) => (
            <Post key={p.id} social={social} feed={feed} p={p} canAnon={canAnon} toast={toast} canMod={!!(group && group.isOwner)} onGone={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
          ))}
          {more && <div className="tea-more"><button className="btn small ghost" onClick={() => load(last)}>Load more</button></div>}
        </>
      )}
    </div>
  );
}
