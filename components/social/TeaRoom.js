'use client';
// Tea Room ☕: short posts and comments as yourself or masked, in the Everyone feed or a group's own
// feed. Posts disappear after 48 hours. Reads are one page at a time (no live listener) to save quota.
import { useEffect, useState } from 'react';
import PetFigure from '../PetFigure';
import { niceError } from '../../lib/social/social';
import { REACTS, MAX_POST, MAX_COMMENT, HIDE_AT, PROMPTS, dailyPrompt, teaConfig, LIMITS } from '../../lib/tea';

const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
};
const left = (exp) => { const h = Math.max(0, (exp - Date.now()) / 3600_000); return h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.floor(h * 60))}m left`; };

function Who({ x, size = 38 }) {
  if (x.anon && x.mask) {
    return <span className="tea-mask" style={{ width: size, height: size, background: x.mask.color, fontSize: size * 0.5 }}>{x.mask.emoji}<i>🕶</i></span>;
  }
  return <span className="sa-ava" style={{ width: size, height: size }}><PetFigure skin={x.skin || 'mint'} mood="idle" w={size} h={size} size={size / 92} look={x.look} /></span>;
}
const whoName = (x) => (x.anon && x.mask ? x.mask.name : '@' + (x.name || 'someone'));

function MaskToggle({ on, set, allowed, why }) {
  if (!allowed) return <span className="tea-anon-off" title={why}>🙂 Posting as yourself</span>;
  return (
    <label className={'tea-anon' + (on ? ' on' : '')} title="Masked: nobody sees it’s you, not even your friends">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{on ? '🕶 Masked' : '🙂 As yourself'}</span>
    </label>
  );
}

function Thread({ social, state, feed, p, canAnon, toast, onCount, canMod }) {
  const [list, setList] = useState(null);
  const [t, setT] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => social.tea.comments(feed, p.id).then(setList, (x) => { setList([]); toast({ err: true, text: niceError(x) }); });
  useEffect(() => { load(); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const report = (c) => {
    const why = window.prompt('What’s wrong with this comment? (optional)', '');
    if (why === null) return;
    social.tea.report(feed, p.id, c.id, why).then((r) => toast({ text: r.already ? 'You already reported this.' : r.hidden ? 'Thanks. It’s hidden now.' : 'Thanks for telling us.' }), (x) => toast({ err: true, text: niceError(x) }));
  };
  return (
    <div className="tea-thread">
      {list === null && <p className="sa-empty">Loading…</p>}
      {list && !list.length && <p className="sa-empty">No comments yet. Spill your side ☕</p>}
      {list && list.map((c) => (
        <div key={c.id} className="tea-c">
          <Who x={c} size={28} />
          <div>
            <small><b>{whoName(c)}</b>{c.op && <em className="tea-chip">poster</em>} · {ago(c.at)}
              {(social.tea.isMine(p.id, c.id) || canMod) ? <button className="gr-mini" title="Delete" onClick={() => remove(c)}>✕</button> : <button className="gr-mini" title="Report" onClick={() => report(c)}>⚑</button>}
            </small>
            <p>{c.text}</p>
          </div>
        </div>
      ))}
      <form className="tea-reply" onSubmit={send}>
        <input value={t} maxLength={MAX_COMMENT} placeholder="Add a comment…" onChange={(e) => setT(e.target.value)} />
        <MaskToggle on={anon} set={setAnon} allowed={canAnon} />
        <button className="btn small" disabled={busy || !t.trim()}>Reply</button>
      </form>
    </div>
  );
}

function Post({ social, state, feed, p, canAnon, toast, onGone, canMod }) {
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
  const report = () => {
    const why = window.prompt('What’s wrong with this post? (optional)', '');
    if (why === null) return;
    social.tea.report(feed, p.id, '', why).then((r) => { toast({ text: r.already ? 'You already reported this.' : r.hidden ? 'Thanks. It’s hidden now.' : 'Thanks for telling us.' }); if (r.hidden) onGone(p.id); }, (x) => toast({ err: true, text: niceError(x) }));
  };
  const remove = () => { if (window.confirm('Delete this post?')) social.tea.remove(feed, p.id).then(() => onGone(p.id), (x) => toast({ err: true, text: niceError(x) })); };
  const prompt = p.prompt >= 0 ? PROMPTS[p.prompt] || '' : '';
  return (
    <article className={'sa-card tea-post' + (p.anon ? ' masked' : '')}>
      <header>
        <Who x={p} />
        <span className="tea-who"><b>{whoName(p)}</b>{p.anon && <em className="tea-chip">masked</em>}<small>{ago(p.at)} · {left(p.exp)}</small></span>
        {(social.tea.isMine(p.id) || canMod) ? <button className="gr-mini" title="Delete" onClick={remove}>✕</button> : <button className="gr-mini" title="Report" onClick={report}>⚑ Report</button>}
      </header>
      {prompt && <p className="tea-prompt-tag">☕ {prompt}</p>}
      <p className="tea-text">{p.text}</p>
      <footer>
        {REACTS.map(([k, e, l]) => (
          <button key={k} className={mine === k ? 'on' : ''} title={l} onClick={() => react(k)}>{e}{rc[k] > 0 && <b>{rc[k]}</b>}</button>
        ))}
        <button className={'tea-ccount' + (open ? ' on' : '')} onClick={() => setOpen(!open)}>💬 {cc > 0 ? cc : ''} {cc === 1 ? 'comment' : 'comments'}</button>
      </footer>
      {open && <Thread social={social} state={state} feed={feed} p={p} canAnon={canAnon} toast={toast} onCount={(d) => setCc((n) => Math.max(0, n + d))} canMod={canMod} />}
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
  const today = dailyPrompt();

  const load = (after) => {
    setErr('');
    if (!after) setPosts(null);
    social.tea.load(feed, after).then((r) => {
      setPosts((cur) => (after ? [...(cur || []), ...r.posts] : r.posts));
      setMore(r.more); setLast(r.last);
    }, (x) => { setPosts([]); setErr(niceError(x)); });
  };
  useEffect(() => { if (feed && cfg.on) load(); }, [feed, cfg.on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (group) social.groups.markSeen(group.id, 'tea'); }, [group && group.id, group && group.teaAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!canAnon) setAnon(false); }, [canAnon]);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await social.tea.post(feed, text, anon, usePrompt ? today.id : -1);
      setPosts((l) => [{ id: r.id, ...r.doc }, ...(l || [])]);
      setText(''); setUsePrompt(false);
      toast({ text: anon ? '🕶 Posted, masked' : '🍵 Posted' });
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };

  if (!cfg.on) {
    return (
      <div className="sa-page"><div className="sa-center"><PetFigure skin="mint" mood="sleep" w={140} h={130} /><h1>The Tea Room is closed</h1><p className="sa-sub">The Nibble team switched it off for a little while. Check back soon!</p></div></div>
    );
  }

  return (
    <div className="sa-page tea">
      <div className="sa-head">
        <div>
          <h2>Tea Room <small className="sa-ttl">☕ posts disappear after 48 h</small></h2>
          <p className="sa-sub">Spill the tea: short posts as yourself or masked. Masked means nobody sees it’s you, not even your friends.</p>
        </div>
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

          <button type="button" className={'tea-prompt' + (usePrompt ? ' on' : '')} onClick={() => setUsePrompt(!usePrompt)}>
            <span>☕ Today’s question</span><b>{today.text}</b><small>{usePrompt ? '✓ your post answers this' : 'Tap to answer it'}</small>
          </button>

          <form className="sa-card tea-compose" onSubmit={post}>
            <textarea rows={3} value={text} maxLength={MAX_POST} placeholder={usePrompt ? today.text : feed === 'all' ? 'What’s the tea? (everyone on Nibble can see this)' : `What’s the tea, ${cur ? cur.name : ''}?`} onChange={(e) => setText(e.target.value)} />
            <div className="tea-compose-row">
              <MaskToggle on={anon} set={setAnon} allowed={canAnon} why={feed === 'all' ? 'Masked posts are only in group Tea Rooms.' : 'Masked posts are switched off right now.'} />
              <em>{MAX_POST - text.length}</em>
              <button className="btn small" disabled={busy || !text.trim()}>{busy ? 'Posting…' : 'Post'}</button>
            </div>
            <small className="tea-rules">
              Be kind: no bullying, no secrets that aren’t yours. {anon ? `Masked posts can’t @mention people or include links (${LIMITS.anon} a day). ` : ''}Posts reported by {HIDE_AT} people are hidden, and the team can see who wrote a reported post.
            </small>
          </form>

          {posts === null && <p className="sa-empty">Brewing…</p>}
          {err && <div className="sa-card"><p className="sa-empty">{/ermission|Not allowed/.test(err) ? 'Can’t open this feed yet. If the Firestore rules were just updated, wait a minute and try again.' : err}</p><button className="btn small ghost" onClick={() => load()}>Try again</button></div>}
          {posts && !err && !posts.length && <div className="sa-card"><p className="sa-empty">No tea here yet. Be the first to spill some ☕</p></div>}
          {posts && posts.map((p) => (
            <Post key={p.id} social={social} state={state} feed={feed} p={p} canAnon={canAnon} toast={toast} canMod={!!(group && group.isOwner)} onGone={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />
          ))}
          <div className="tea-more">
            {more && <button className="btn small ghost" onClick={() => load(last)}>Load more</button>}
            {posts && <button className="btn small ghost" onClick={() => load()}>↻ Refresh</button>}
          </div>
        </>
      )}
    </div>
  );
}
