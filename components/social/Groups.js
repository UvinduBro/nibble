'use client';
// Groups: a few friends together. Group chat (gone after 24 h), members, a points board, and quick
// group actions: pack walk (everyone's pets come over), poke everyone, listen together, group Tea Room.
import { useEffect, useRef, useState } from 'react';
import PetFigure from '../PetFigure';
import Emo from '../Emo';
import { ChatReact } from './Reactions';
import { ReplyBtn, Quote, ReplyBar } from './Reply';
import { useUserCard, Who } from './UserCard';
import { countReactions } from '../../lib/reactions';
import { niceError } from '../../lib/social/social';
import { GROUP_EMOJIS, MAX_GROUP_MSG, MAX_GROUP_NAME, MAX_MEMBERS, MAX_GROUPS, MENTION_RE } from '../../lib/social/groups';

const ago = (t) => {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};
function Ava({ who, size = 38, mood = 'idle' }) {
  return <span className="sa-ava" style={{ width: size, height: size }}><PetFigure skin={(who && who.skin) || 'mint'} mood={mood} w={size} h={size} size={size / 92} acc={who && who.acc} tint={who && who.tint} makeup={who && who.makeup} look={who && who.style} /></span>;
}

function FriendPicker({ friends, picked, setPicked, max }) {
  if (!friends.length) return <p className="sa-empty">No friends left to invite. Add friends first, then invite them here.</p>;
  return (
    <div className="gr-pick">
      {friends.map((f) => {
        const on = picked.includes(f.uid);
        return (
          <button type="button" key={f.uid} className={on ? 'on' : ''} disabled={!on && picked.length >= max} onClick={() => setPicked(on ? picked.filter((x) => x !== f.uid) : [...picked, f.uid])}>
            <Ava who={f} size={30} /><span>@{f.username}</span>{on && <i>✓</i>}
          </button>
        );
      })}
    </div>
  );
}

function NewGroup({ social, state, toast, onDone }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await social.groups.create(name, emoji, picked);
      toast({ text: `${emoji} ${name.trim()} is ready${r.sent ? ` · invited ${r.sent} friend${r.sent > 1 ? 's' : ''}` : ''}` });
      onDone(r.id);
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  return (
    <form className="sa-card sa-form gr-new" onSubmit={submit}>
      <h3><Emo k="sparkles" size={20} /> New group</h3>
      <label>Name<input autoFocus value={name} maxLength={MAX_GROUP_NAME} placeholder="e.g. Study buddies, The squad" onChange={(e) => setName(e.target.value)} /></label>
      <label>Icon</label>
      <div className="gr-emojis">{GROUP_EMOJIS.map((x) => <button type="button" key={x} className={emoji === x ? 'on' : ''} onClick={() => setEmoji(x)}><Emo e={x} size={24} /></button>)}</div>
      <label>Invite friends <small>(they’ll get an invite to accept)</small></label>
      <FriendPicker friends={state.friends} picked={picked} setPicked={setPicked} max={MAX_MEMBERS - 1} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn small" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create group'}</button>
        <button type="button" className="btn small ghost" onClick={() => onDone('')}>Cancel</button>
      </div>
    </form>
  );
}

// message text with @mentions highlighted (yours stand out)
function Rich({ text, myName, uidOf, onOpen }) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(MENTION_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const n = m[1].toLowerCase();
    const cls = 'gr-at' + (n === 'everyone' || n === myName ? ' me' : '');
    const uid = uidOf && uidOf(n);
    out.push(uid ? <Who key={m.index} uid={uid} name={m[1]} onOpen={onOpen} className={cls} /> : <span key={m.index} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Chat({ social, state, g, toast, go, setChatWith }) {
  const [openCard, cardEl] = useUserCard({ social, toast, go, setChatWith });
  const uidOf = (n) => Object.keys(g.names || {}).find((u) => String(g.names[u]).toLowerCase() === n && g.members.includes(u));
  const [msgs, setMsgs] = useState(undefined);
  const [t, setT] = useState('');
  const [re, setRe] = useState(null);
  const box = useRef(null);
  const input = useRef(null);
  // @mention picker: opens while you type "@" + the start of a name
  const [caret, setCaret] = useState(0);
  const [pickI, setPickI] = useState(0);
  const [closed, setClosed] = useState(false);
  const myName = String((state.profile && state.profile.username) || '').toLowerCase();
  const people = [...g.members.filter((u) => u !== state.user.uid).map((u) => ({ uid: u, name: g.names[u] || '' })).filter((p) => p.name),
    ...(g.members.length > 2 ? [{ uid: '*', name: 'everyone', hint: 'everyone in the group' }] : [])];
  const at = /(^|\s)@([a-z0-9_]{0,20})$/i.exec(t.slice(0, caret));
  const picks = at && !closed ? people.filter((p) => p.name.toLowerCase().startsWith(at[2].toLowerCase())).slice(0, 6) : [];
  const pick = (p) => {
    const start = caret - at[2].length;
    const next = t.slice(0, start) + p.name + ' ' + t.slice(caret);
    const pos = start + p.name.length + 1;
    setT(next); setCaret(pos); setPickI(0);
    requestAnimationFrame(() => { if (input.current) { input.current.focus(); input.current.setSelectionRange(pos, pos); } });
  };
  const addAt = () => {
    const el = input.current;
    const c = el ? el.selectionStart : t.length;
    const pre = t.slice(0, c);
    const ins = (pre && !/\s$/.test(pre) ? ' ' : '') + '@';
    const next = pre + ins + t.slice(c);
    setT(next); setCaret(c + ins.length); setClosed(false); setPickI(0);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(c + ins.length, c + ins.length); } });
  };
  const onKey = (e) => {
    if (picks.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPickI((pickI + 1) % picks.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPickI((pickI - 1 + picks.length) % picks.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(picks[Math.min(pickI, picks.length - 1)]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setClosed(true); return; }
    }
    if (e.key === 'Escape') setRe(null);
  };
  useEffect(() => {
    setMsgs(undefined); setRe(null);
    return social.groups.watchChat(g.id, (m) => setMsgs(m));
  }, [g.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { social.groups.markSeen(g.id, 'chat'); }, [g.id, g.chatAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs && msgs.length]);
  const send = async (e) => {
    e.preventDefault();
    const v = t.trim(); if (!v) return;
    const r = re;
    setT(''); setRe(null);
    try { await social.groups.send(g.id, v, r); } catch (x) { setT(v); setRe(r); toast({ err: true, text: niceError(x) }); }
  };
  const replyTo = (m) => { setRe({ n: m.fromName, t: m.text }); if (input.current) input.current.focus(); };
  const report = (m) => {
    if (!window.confirm(`Report this message from @${m.fromName} to the Nibble team?`)) return;
    social.report({ kind: 'feedback', cat: 'problem', title: 'Group chat report', text: `Group "${g.name}" (${g.id}) · message from @${m.fromName} (${m.from}): “${m.text}”` })
      .then(() => toast({ text: 'Thanks. The team will take a look.' }), (x) => toast({ err: true, text: niceError(x) }));
  };
  const me = state.user.uid;
  return (
    <div className="gr-chat">
      {cardEl}
      <div className="sa-msgs" ref={box}>
        {msgs === undefined && <p className="sa-empty">Loading…</p>}
        {msgs === null && <p className="sa-empty">Couldn’t load the chat. If the Firestore rules were just updated, give it a minute.</p>}
        {msgs && !msgs.length && <p className="sa-empty">No messages in the last 24 hours. Say hi to the group! 👋</p>}
        {msgs && msgs.map((m) => (
          <div key={m.id} className={'sa-m' + (m.from === me ? ' mine' : '') + ((m.to || []).includes(me) ? ' at-me' : '')}>
            <small>{m.from === me ? 'You' : <Who uid={m.from} name={m.fromName} onOpen={openCard} />} · {ago(m.at)}
              <ReplyBtn onClick={() => replyTo(m)} />
              {m.from === me || g.isOwner
                ? <button className="gr-mini" title="Delete" onClick={() => social.groups.deleteMsg(g.id, m.id).catch((x) => toast({ err: true, text: niceError(x) }))}>✕</button>
                : <button className="gr-mini" title="Report" onClick={() => report(m)}>⚑</button>}
            </small>
            <p><Quote re={m.re} mine={m.from === me} /><Rich text={m.text} myName={myName} uidOf={uidOf} onOpen={openCard} /></p>
            <ChatReact align={m.from === me ? 'right' : 'left'} mine={(m.rx || {})[me] || ''} counts={countReactions(m.rx)}
              onPick={(k) => social.groups.react(g.id, m.id, k).catch((x) => toast({ err: true, text: niceError(x) }))} />
          </div>
        ))}
      </div>
      <ReplyBar re={re} onClose={() => setRe(null)} />
      <form className="sa-saybar sa-chatbar" onSubmit={send}>
        {picks.length > 0 && (
          <ul className="gr-picks" role="listbox" aria-label="Mention someone">
            {picks.map((p, i) => (
              <li key={p.uid} role="option" aria-selected={i === pickI} className={i === pickI ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setPickI(i)}>
                <b>@{p.name}</b>{p.hint && <small>{p.hint}</small>}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="gr-atbtn" title="Mention someone" aria-label="Mention someone" onClick={addAt}>@</button>
        <input ref={input} value={t} maxLength={MAX_GROUP_MSG} onKeyDown={onKey}
          onSelect={(e) => setCaret(e.target.selectionStart || 0)} placeholder={`Message ${g.emoji} ${g.name} · type @ to mention`} onChange={(e) => { setT(e.target.value); setCaret(e.target.selectionStart || 0); setClosed(false); setPickI(0); }} />
        <em>{MAX_GROUP_MSG - t.length}</em>
        <button className="btn small" disabled={!t.trim()}>Send</button>
      </form>
    </div>
  );
}

function Members({ social, state, g, toast, go }) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const friendOf = (uid) => state.friends.find((f) => f.uid === uid);
  const me = state.user.uid;
  const canAdd = state.friends.filter((f) => !g.members.includes(f.uid) && !g.invited.includes(f.uid));
  const invite = async () => {
    let n = 0;
    for (const uid of picked) { try { await social.groups.invite(g.id, uid); n++; } catch (x) { toast({ err: true, text: niceError(x) }); } }
    if (n) toast({ text: `Invited ${n} friend${n > 1 ? 's' : ''}` });
    setPicked([]); setAdding(false);
  };
  const row = (uid, pending) => {
    const f = friendOf(uid);
    const isMe = uid === me;
    const who = isMe ? state.profile : f;
    return (
      <div key={uid} className="gr-mem">
        <Ava who={who} size={36} mood={f && !f.online ? 'sleep' : 'idle'} />
        <span className="gr-mem-name">
          <b>@{g.names[uid] || (f && f.username) || 'someone'}{isMe ? ' (you)' : ''}</b>
          <small>{uid === g.owner ? <><Emo k="crown" size={14} /> made this group</> : pending ? <><Emo k="envelope" size={14} /> invited</> : f ? <><span className={'sa-dot' + (f.online ? ' on' : '')} /> {f.online ? 'online' : 'offline'}</> : isMe ? 'member' : 'not your friend yet'}</small>
        </span>
        {!isMe && !f && !pending && <button className="btn small ghost" onClick={() => social.addFriend(g.names[uid] || '').then((r) => toast({ text: r === 'accepted' ? 'You’re friends now!' : 'Friend request sent' }), (x) => toast({ err: true, text: niceError(x) }))}>Add friend</button>}
        {g.isOwner && !isMe && <button className="sa-x" title={pending ? 'Cancel invite' : 'Remove from group'} onClick={() => { if (window.confirm(pending ? 'Cancel this invite?' : `Remove @${g.names[uid] || 'them'} from the group?`)) social.groups.kick(g.id, uid).catch((x) => toast({ err: true, text: niceError(x) })); }}>✕</button>}
      </div>
    );
  };
  return (
    <div className="gr-members">
      {g.members.map((u) => row(u, false))}
      {g.invited.map((u) => row(u, true))}
      {adding ? (
        <div className="gr-invite">
          <FriendPicker friends={canAdd} picked={picked} setPicked={setPicked} max={MAX_MEMBERS - g.members.length - g.invited.length} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn small" disabled={!picked.length} onClick={invite}>Invite {picked.length || ''}</button>
            <button className="btn small ghost" onClick={() => { setAdding(false); setPicked([]); }}>Cancel</button>
          </div>
        </div>
      ) : g.members.length + g.invited.length < MAX_MEMBERS && (
        <button className="btn small ghost" onClick={() => setAdding(true)}>＋ Invite friends</button>
      )}
      {!state.friends.length && <p className="sa-empty">Only friends can be invited. <button className="sa-link" onClick={() => go('friends')}>Add friends →</button></p>}
    </div>
  );
}

function Points({ social, state, g }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); social.groups.points(g.id).then(setRows, () => setRows([])); }, [g.id, g.members.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <p className="sa-empty">Counting stars…</p>;
  const medal = ['medal1', 'medal2', 'medal3'];
  return (
    <ol className="gr-points">
      {rows.map((r, i) => (
        <li key={r.uid} className={r.uid === state.user.uid ? 'me' : ''}>
          <span>{medal[i] ? <Emo k={medal[i]} size={22} /> : i + 1}</span><b>@{r.username}</b><em><Emo k="star" size={16} /> {r.total.toLocaleString()}</em>
        </li>
      ))}
    </ol>
  );
}

function Settings({ social, g, toast, close }) {
  const [name, setName] = useState(g.name);
  const [emoji, setEmoji] = useState(g.emoji);
  return (
    <div className="gr-settings">
      {g.isOwner ? (
        <>
          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); social.groups.rename(g.id, name, emoji).then(() => toast({ text: 'Saved' }), (x) => toast({ err: true, text: niceError(x) })); }}>
            <label>Name<input value={name} maxLength={MAX_GROUP_NAME} onChange={(e) => setName(e.target.value)} /></label>
            <div className="gr-emojis">{GROUP_EMOJIS.map((x) => <button type="button" key={x} className={emoji === x ? 'on' : ''} onClick={() => setEmoji(x)}><Emo e={x} size={24} /></button>)}</div>
            <div><button className="btn small" disabled={!name.trim()}>Save</button></div>
          </form>
          <p className="sa-sub">Deleting the group removes it and its chat for everyone.</p>
          <button className="btn small ghost danger" onClick={() => { if (window.confirm(`Delete ${g.emoji} ${g.name} for everyone?`)) social.groups.remove(g.id).then(() => { toast({ text: 'Group deleted' }); close(); }, (x) => toast({ err: true, text: niceError(x) })); }}>Delete group</button>
        </>
      ) : (
        <>
          <p className="sa-sub">Leaving takes you out of the chat and the group’s Tea Room. Someone can invite you again later.</p>
          <button className="btn small ghost danger" onClick={() => { if (window.confirm(`Leave ${g.emoji} ${g.name}?`)) social.groups.leave(g.id).then(() => { toast({ text: 'You left the group' }); close(); }, (x) => toast({ err: true, text: niceError(x) })); }}>Leave group</button>
        </>
      )}
    </div>
  );
}

export default function Groups({ social, state, toast, go, desktop, openTea, setChatWith }) {
  const groups = state.groups || [];
  const invites = state.groupInvites || [];
  const [sel, setSel] = useState('');
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState('chat');
  const g = groups.find((x) => x.id === sel) || (!creating && groups[0]) || null;
  useEffect(() => { if (g && g.id !== sel) setSel(g.id); }, [g && g.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setView('chat'); }, [sel]);
  const friendMembers = g ? state.friends.filter((f) => g.members.includes(f.uid)) : [];

  // everyone's pets come over to your desktop (or your desk on Home) and dance together
  const packWalk = () => {
    if (!friendMembers.length) { toast({ text: 'Only friends’ pets can visit. Add the group as friends first.' }); return; }
    if (desktop) {
      friendMembers.forEach((f, i) => setTimeout(() => desktop.command({ type: 'bring', uid: f.uid }), i * 400));
      setTimeout(() => desktop.command({ type: 'drama', kind: 'play' }), friendMembers.length * 400 + 4000);
    } else {
      go('home');
      friendMembers.forEach((f, i) => setTimeout(() => window.dispatchEvent(new CustomEvent('nibble-bring', { detail: f.uid })), 600 + i * 400));
    }
    toast({ text: `🐾 The ${g.name} pack is on its way (${friendMembers.length} pet${friendMembers.length > 1 ? 's' : ''})` });
  };
  const pokeAll = async () => {
    if (!friendMembers.length) { toast({ text: 'Pokes go to friends. Add the group as friends first.' }); return; }
    let n = 0;
    for (const f of friendMembers) { try { await social.send(f.uid, 'wave'); n++; } catch {} }
    toast({ text: `👋 Waved at ${n} friend${n === 1 ? '' : 's'} in ${g.name}` });
  };
  const listen = () => {
    if (!friendMembers.length) { toast({ text: 'Listening rooms are for friends. Add the group as friends first.' }); return; }
    const r = state.music && state.music.room;
    const mine = r && r.host === state.user.uid;
    const p = mine ? Promise.all(friendMembers.map((f) => social.music.invite(f.uid).catch(() => {}))) : social.music.start(friendMembers.map((f) => f.uid));
    p.then(() => { toast({ text: '🎧 Invited the group. Pick a song!' }); go('music'); }, (x) => toast({ err: true, text: niceError(x) }));
  };

  return (
    <div className="sa-page gr">
      <div className="sa-head">
        <div>
          <h2>Groups</h2>
          <p className="sa-sub">Your crews: a group chat that clears after 24 hours, a group Tea Room, and pets that walk together.</p>
        </div>
        {!creating && <button className="btn small" disabled={groups.length >= MAX_GROUPS} title={groups.length >= MAX_GROUPS ? `Up to ${MAX_GROUPS} groups` : ''} onClick={() => setCreating(true)}>＋ New group</button>}
      </div>

      {invites.map((i) => (
        <div key={i.id} className="sa-card gr-inv">
          <span className="gr-emo"><Emo e={i.emoji} size={24} /></span>
          <span><b>{i.name}</b><small>@{i.names[i.owner] || 'a friend'} invited you · {i.members.length} member{i.members.length > 1 ? 's' : ''}</small></span>
          <button className="btn small" onClick={() => social.groups.accept(i.id).then(() => { setSel(i.id); toast({ text: `Welcome to ${i.emoji} ${i.name}!` }); }, (x) => toast({ err: true, text: niceError(x) }))}>Join</button>
          <button className="btn small ghost" onClick={() => social.groups.decline(i.id).catch((x) => toast({ err: true, text: niceError(x) }))}>No thanks</button>
        </div>
      ))}

      {creating && <NewGroup social={social} state={state} toast={toast} onDone={(id) => { setCreating(false); if (id) setSel(id); }} />}

      {!creating && !groups.length && (
        <div className="sa-card gr-empty">
          <PetFigure skin="mint" mood="happy" w={110} h={100} />
          <div>
            <h3>Start your first group</h3>
            <p className="sa-sub">Put a few friends together: chat as a group, share tea, bring the whole pack to your desktop at once.</p>
            <button className="btn small" onClick={() => setCreating(true)}>＋ New group</button>
          </div>
        </div>
      )}

      {!creating && g && (
        <div className="sa-chat gr-wrap">
          <div className="sa-threads">
            {groups.map((x) => (
              <button key={x.id} className={x.id === g.id ? 'on' : ''} onClick={() => setSel(x.id)}>
                <span className="gr-emo"><Emo e={x.emoji} size={24} /></span>
                <span><b>{x.name}</b><small>{x.members.length} member{x.members.length > 1 ? 's' : ''}{x.chatBy && x.chatAt ? ` · @${x.chatBy} ${ago(x.chatAt)}` : ''}</small></span>
                {x.mentionedMe ? <i className="gr-at-dot" title="You were mentioned">@</i> : (x.unreadChat || x.newTea) && <i className="gr-new-dot" title="Something new" />}
              </button>
            ))}
          </div>
          <div className="sa-thread gr-panel">
            <div className="gr-top">
              <span className="gr-emo big"><Emo e={g.emoji} size={32} /></span>
              <div><b>{g.name}</b><small>{g.members.length} member{g.members.length > 1 ? 's' : ''}{g.invited.length ? ` · ${g.invited.length} invited` : ''}</small></div>
            </div>
            <div className="gr-acts">
              <button onClick={packWalk} title="Everyone’s pets come over and dance"><Emo k="paw" size={18} /> Pack walk</button>
              <button onClick={pokeAll} title="Wave at everyone in the group"><Emo k="wave" size={18} /> Wave at all</button>
              <button onClick={listen} title="Start a Listen Together room with the group"><Emo k="headphone" size={18} /> Listen</button>
              <button onClick={() => openTea(g.id)} title="The group’s own Tea Room"><Emo k="tea" size={18} /> Tea{g.newTea && <i className="gr-new-dot" />}</button>
            </div>
            <div className="lb-tabs gr-tabs" role="tablist">
              {[['chat', 'Chat', 'speech'], ['members', 'Members', 'people'], ['points', 'Points', 'trophy'], ['settings', 'Group', 'gear']].map(([k, l, ic]) => (
                <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}><Emo k={ic} size={16} /> {l}{k === 'chat' && g.unreadChat && view !== 'chat' && <i className="gr-new-dot" />}</button>
              ))}
            </div>
            {view === 'chat' && <Chat social={social} state={state} g={g} toast={toast} go={go} setChatWith={setChatWith} />}
            {view === 'members' && <Members social={social} state={state} g={g} toast={toast} go={go} />}
            {view === 'points' && <Points social={social} state={state} g={g} />}
            {view === 'settings' && <Settings social={social} g={g} toast={toast} close={() => setSel('')} />}
          </div>
        </div>
      )}
    </div>
  );
}
