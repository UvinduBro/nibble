'use client';
import './social.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen, Onboard, CharacterGrid } from './Auth';
import LiveDesk from './LiveDesk';
import PetFigure from '../PetFigure';
import { byKey, CHARACTERS } from '../../lib/characters';
import { EMOTES, EMOTE_TEXT, MAX_TEXT, niceError } from '../../lib/social/social';

const ago = (t) => {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};
const NAV = [
  ['home', 'Home', '⌂'], ['friends', 'Friends', '☺'], ['messages', 'Messages', '✉'], ['pets', 'Pets', '✦'], ['settings', 'Settings', '⚙'],
];

function Avatar({ skin, size = 44, mood = 'idle' }) {
  return <span className="sa-ava" style={{ width: size, height: size }}><PetFigure skin={skin || 'mint'} mood={mood} w={size} h={size} size={size / 92} /></span>;
}

function Toggle({ on, onChange, label, hint }) {
  return (
    <label className="sa-toggle">
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

function Notice({ note, onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => { if (!note) return; const t = setTimeout(() => done.current(), 3200); return () => clearTimeout(t); }, [note]);
  if (!note) return null;
  return <div className={'sa-toast' + (note.err ? ' err' : '')}>{note.text}</div>;
}

// Quick message bar (Home): pick who it's for. Private by default; "All friends" is opt-in.
function SayBar({ social, state, to, setTo }) {
  const [t, setT] = useState('');
  const friends = state.friends;
  const target = to === 'all' ? null : friends.find((f) => f.uid === to) || friends[0];
  const toKey = target ? target.uid : 'all';
  const send = async (e) => {
    e.preventDefault();
    const v = t.trim();
    if (!v) return;
    setT('');
    if (toKey === 'all') await social.say(v).catch(() => {});
    else await social.send(toKey, 'whisper', v).catch(() => {});
  };
  return (
    <form className="sa-saybar" onSubmit={send}>
      <select className="sa-to" value={toKey} onChange={(e) => setTo(e.target.value)} aria-label="Send to">
        {friends.map((f) => <option key={f.uid} value={f.uid}>🔒 @{f.username}</option>)}
        <option value="all">📣 All friends</option>
      </select>
      <input value={t} maxLength={MAX_TEXT} placeholder={toKey === 'all' ? 'Say something to all your friends' : `Message @${target ? target.username : ''} (only they see it)`} onChange={(e) => { setT(e.target.value); social.setTyping(!!e.target.value, toKey === 'all' ? '' : toKey).catch(() => {}); }} onBlur={() => social.setTyping(false).catch(() => {})} />
      <em>{MAX_TEXT - t.length}</em>
      <button className="btn small" disabled={!t.trim()}>Send</button>
    </form>
  );
}

function FriendActions({ social, f, toast, compact }) {
  const [whisper, setWhisper] = useState(null);
  const act = (kind, text) => social.send(f.uid, kind, text).then(() => toast({ text: kind === 'whisper' ? `Sent privately to @${f.username}` : `${EMOTES[kind]} sent to @${f.username}` })).catch((e) => toast({ err: true, text: niceError(e) }));
  if (whisper != null) {
    return (
      <form className="sa-whisper" onSubmit={(e) => { e.preventDefault(); if (whisper.trim()) act('whisper', whisper); setWhisper(null); }}>
        <input autoFocus maxLength={MAX_TEXT} value={whisper} onChange={(e) => setWhisper(e.target.value)} placeholder={`Private message to @${f.username}`} onKeyDown={(e) => e.key === 'Escape' && setWhisper(null)} />
        <button className="btn small">Send</button>
      </form>
    );
  }
  const kinds = compact ? ['wave', 'hug', 'poke', 'heart'] : ['wave', 'hug', 'kiss', 'poke', 'heart', 'highfive', 'tickle', 'cheer', 'snack', 'dance'];
  return (
    <div className="sa-acts">
      {kinds.map((k) => <button key={k} title={k} onClick={() => act(k)}>{EMOTES[k]}</button>)}
      <button title="Private message" onClick={() => setWhisper('')}>💬</button>
    </div>
  );
}

// "Bring here": their pet comes to hang out on your desktop (even if they're offline).
// "Visit": your pet pops over to their desktop.
function bringHere(desktop, f) {
  if (desktop) desktop.command({ type: 'bring', uid: f.uid });
  else window.dispatchEvent(new CustomEvent('nibble-bring', { detail: f.uid }));
}

function FriendRow({ social, f, toast, full, desktop }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={'sa-friend' + (f.online ? ' on' : '')}>
      <Avatar skin={f.skin} mood={f.online ? (f.typing ? 'work' : 'idle') : 'sleep'} />
      <div className="sa-friend-main">
        <b>@{f.username}</b>
        <small>
          <span className={'sa-dot' + (f.online ? ' on' : '') + (f.dnd ? ' dnd' : '')} />
          {f.typing ? 'thinking…' : f.online ? (f.dnd ? 'busy' : 'online') : f.lastSeen ? 'seen ' + ago(f.lastSeen) : 'offline'}
          {f.petName ? ` · ${f.petName}` : ''}{f.status ? ` · “${f.status}”` : ''}
        </small>
      </div>
      <div className="sa-visit">
        <button title={`Bring @${f.username}'s pet to ${desktop ? 'your desktop' : 'your desk'}`} onClick={() => { bringHere(desktop, f); toast({ text: `🏠 @${f.username}'s pet is coming over` }); }}>🏠 Bring here</button>
        <button title={`Send your pet to @${f.username}'s desktop`} onClick={() => social.send(f.uid, 'visit').then(() => toast({ text: `🚀 Your pet is visiting @${f.username}` })).catch((e) => toast({ err: true, text: niceError(e) }))}>🚀 Visit</button>
      </div>
      <FriendActions social={social} f={f} toast={toast} compact={!full} />
      {full && (confirm
        ? <span className="sa-confirm">Remove? <button onClick={() => social.unfriend(f.uid)}>Yes</button><button onClick={() => setConfirm(false)}>No</button></span>
        : <button className="sa-x" title="Remove friend" onClick={() => setConfirm(true)}>✕</button>)}
    </div>
  );
}

function Friends({ social, state, toast, presetAdd, desktop }) {
  const [name, setName] = useState(presetAdd || '');
  const [busy, setBusy] = useState(false);
  const link = typeof window !== 'undefined' ? `${location.origin}/app?add=${state.profile.username}` : '';
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await social.addFriend(name);
      toast({ text: r === 'accepted' ? `You and @${name.replace(/^@/, '')} are now friends 🎉` : `Request sent to @${name.replace(/^@/, '')}` });
      setName('');
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  return (
    <div className="sa-page">
      <h2>Friends</h2>
      <div className="sa-card sa-addcard">
        <form onSubmit={add} className="sa-add">
          <span>@</span>
          <input value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, ''))} placeholder="their username" aria-label="Friend's username" />
          <button className="btn small" disabled={busy || !name.trim()}>Add friend</button>
        </form>
        <p className="sa-share">Your username is <b>@{state.profile.username}</b>. Share your link:
          <button className="sa-copy" onClick={() => { navigator.clipboard?.writeText(link); toast({ text: 'Link copied' }); }}>{link.replace(/^https?:\/\//, '')} ⧉</button>
        </p>
      </div>
      {state.incoming.length > 0 && (
        <div className="sa-card">
          <h3>Friend requests <span className="sa-badge">{state.incoming.length}</span></h3>
          {state.incoming.map((r) => (
            <div key={r.id} className="sa-req">
              <b>@{r.fromName}</b><small>{ago(r.at)}</small>
              <button className="btn small" onClick={() => social.accept(r).then(() => toast({ text: `You and @${r.fromName} are friends 🎉` })).catch((e) => toast({ err: true, text: niceError(e) }))}>Accept</button>
              <button className="btn small ghost" onClick={() => social.decline(r)}>Decline</button>
            </div>
          ))}
        </div>
      )}
      <div className="sa-card">
        <h3>Your friends <small>{state.friends.filter((f) => f.online).length} online · {state.friends.length} total</small></h3>
        {state.friends.length === 0 && <p className="sa-empty">No friends yet. Add someone by their username, or send them your link.</p>}
        {state.friends.map((f) => <FriendRow key={f.uid} social={social} f={f} toast={toast} full desktop={desktop} />)}
      </div>
      {state.outgoing.length > 0 && (
        <div className="sa-card">
          <h3>Sent requests</h3>
          {state.outgoing.map((r) => (
            <div key={r.id} className="sa-req"><b>@{r.toName}</b><small>waiting · {ago(r.at)}</small><button className="btn small ghost" onClick={() => social.cancel(r)}>Cancel</button></div>
          ))}
        </div>
      )}
    </div>
  );
}

// Private chats: one thread per friend (only the two of you see it) + an opt-in "All friends" room.
function Messages({ social, state, chatWith, setChatWith }) {
  const box = useRef(null);
  const [t, setT] = useState('');
  const friends = state.friends;
  const sel = chatWith === 'all' ? 'all' : (friends.find((f) => f.uid === chatWith) || friends[0] || {}).uid || 'all';
  const inThread = (m, id) => (id === 'all'
    ? m.kind === 'say'
    : m.kind !== 'say' && (m.mine ? m.to === id : m.from === id));
  const thread = state.messages.filter((m) => inThread(m, sel));
  const lastOf = (id) => { const l = state.messages.filter((m) => inThread(m, id)); return l[l.length - 1]; };
  const friend = friends.find((f) => f.uid === sel);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [thread.length, sel]);
  const send = async (e) => {
    e.preventDefault();
    const v = t.trim();
    if (!v) return;
    setT('');
    if (sel === 'all') await social.say(v).catch(() => {});
    else await social.send(sel, 'whisper', v).catch(() => {});
  };
  const bubble = (m) => {
    const text = m.text || `${EMOTES[m.kind] || ''} ${m.mine ? 'you sent ' + (m.kind === 'hug' ? 'a cuddle' : m.kind) : EMOTE_TEXT[m.kind] || m.kind}`;
    return (
      <div key={m.id} className={'sa-m' + (m.mine ? ' mine' : '') + (m.text ? '' : ' act')}>
        <small>{m.mine ? 'You' : '@' + m.fromName} · {ago(m.at)}</small>
        <p>{text}</p>
      </div>
    );
  };
  return (
    <div className="sa-page">
      <h2>Messages <small className="sa-ttl">🔒 private · disappear after 30 min</small></h2>
      <div className="sa-chat">
        <div className="sa-threads">
          {friends.map((f) => {
            const l = lastOf(f.uid);
            return (
              <button key={f.uid} className={sel === f.uid ? 'on' : ''} onClick={() => setChatWith(f.uid)}>
                <Avatar skin={f.skin} size={36} />
                <span><b>@{f.username}</b><small>{f.typing ? 'typing…' : l ? (l.mine ? 'You: ' : '') + (l.text || EMOTES[l.kind] || '') : f.online ? 'online' : 'offline'}</small></span>
                <i className={'sa-dot' + (f.online ? ' on' : '')} />
              </button>
            );
          })}
          <button className={sel === 'all' ? 'on' : ''} onClick={() => setChatWith('all')}>
            <span className="sa-allico">📣</span>
            <span><b>All friends</b><small>everyone sees these</small></span>
          </button>
        </div>
        <div className="sa-thread">
          <div className="sa-thread-head">{sel === 'all' ? '📣 All friends: every friend sees these' : <>🔒 Only you and <b>@{friend ? friend.username : ''}</b> see this chat</>}</div>
          <div className="sa-msgs" ref={box}>
            {thread.length === 0 && <p className="sa-empty">{friends.length ? 'No messages in the last 30 minutes. Say hi!' : 'Add a friend first, then chat here.'}</p>}
            {thread.map(bubble)}
            {friend && friend.typing && <div className="sa-m"><p className="sa-typing"><i /><i /><i /></p></div>}
          </div>
          {(friends.length > 0) && (
            <form className="sa-saybar sa-chatbar" onSubmit={send}>
              <input value={t} maxLength={MAX_TEXT} placeholder={sel === 'all' ? 'Message all friends' : `Message @${friend ? friend.username : ''}`} onChange={(e) => { setT(e.target.value); social.setTyping(!!e.target.value, sel === 'all' ? '' : sel).catch(() => {}); }} onBlur={() => social.setTyping(false).catch(() => {})} />
              <em>{MAX_TEXT - t.length}</em>
              <button className="btn small" disabled={!t.trim()}>Send</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const ACCS = [['cap', '🧢 Cap'], ['tophat', '🎩 Top hat'], ['party', '🥳 Party hat'], ['crown', '👑 Crown'], ['bow', '🎀 Bow'], ['flower', '🌸 Flower'], ['sunglasses', '🕶 Shades'], ['glasses', '👓 Glasses'], ['headphones', '🎧 Headphones']];
const TINTS = ['#7ee8c6', '#ff8fab', '#ffd166', '#b9a3ff', '#4cc9f0', '#ff6b3d', '#a3ff12', '#f4f6fb'];
const MAKEUPS = [['', 'None'], ['blush', '😊 Blush'], ['freckles', '🙂 Freckles'], ['star', '⭐ Star'], ['all', '✨ Full glam']];

function Pets({ social, state, desktop, local, toast }) {
  const [petName, setPetName] = useState(state.profile.petName || '');
  const save = (patch) => social.updateProfile(patch).then(() => toast({ text: 'Saved — friends see the update' })).catch((e) => toast({ err: true, text: niceError(e) }));
  const pets = (local && local.settings.pets) || [];
  const [sel, setSel] = useState(0);
  const [acc, setAcc] = useState(state.profile.acc || []);
  const [tint, setTint] = useState(state.profile.tint || '');
  const [makeup, setMakeup] = useState(state.profile.makeup || '');
  const toggleAcc = (k) => setAcc((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(0, 6)));
  const saveLook = () => {
    save({ acc, tint, makeup });
    if (desktop && pets.length) desktop.setLocal({ pets: pets.map((p) => ({ ...p, acc, tint, makeup })) });
  };
  return (
    <div className="sa-page">
      <h2>Pets</h2>
      <div className="sa-card sa-profile">
        <Avatar skin={state.profile.skin} size={96} mood="happy" />
        <div>
          <h3>What your friends see</h3>
          <p className="sa-sub">This pet visits your friends’ desktops when you’re online.</p>
          <form className="sa-inline" onSubmit={(e) => { e.preventDefault(); save({ petName }); }}>
            Pet name <input value={petName} maxLength={20} onChange={(e) => setPetName(e.target.value)} /> <button className="btn small">Save</button>
          </form>
        </div>
      </div>
      <CharacterGrid value={state.profile.skin} onPick={(k) => { save({ skin: k }); if (desktop && pets.length) desktop.setLocal({ pets: pets.map((p, i) => (i === 0 ? { ...p, skin: k } : p)) }); }} compact />
      <div className="sa-card">
        <h3>Customize <small>hats, glasses, colour &amp; makeup — friends see it too</small></h3>
        <div className="sa-custom">
          <div className="sa-custom-prev"><PetFigure skin={state.profile.skin} mood="wave" acc={acc} tint={tint} makeup={makeup} w={132} h={132} size={1.15} /></div>
          <div className="sa-custom-opts">
            <div className="sa-coltitle">Accessories <small>up to 6</small></div>
            <div className="sa-chips">{ACCS.map(([k, label]) => <button key={k} className={'sa-chip' + (acc.includes(k) ? ' on' : '')} onClick={() => toggleAcc(k)}>{label}</button>)}</div>
            <div className="sa-coltitle">Colour</div>
            <div className="sa-swatches">
              <button className={'sa-sw sa-sw-none' + (!tint ? ' on' : '')} onClick={() => setTint('')} title="Original colour">∅</button>
              {TINTS.map((c) => <button key={c} className={'sa-sw' + (tint === c ? ' on' : '')} style={{ background: c }} onClick={() => setTint(c)} title={c} />)}
            </div>
            <div className="sa-coltitle">Makeup</div>
            <div className="sa-chips">{MAKEUPS.map(([k, label]) => <button key={k || 'none'} className={'sa-chip' + (makeup === k ? ' on' : '')} onClick={() => setMakeup(k)}>{label}</button>)}</div>
            <button className="btn small" onClick={saveLook} style={{ marginTop: 10 }}>Save look</button>
          </div>
        </div>
      </div>
      {desktop && local && (
        <div className="sa-card">
          <h3>Pets on this PC <small>{pets.length} of 8</small></h3>
          <div className="sa-localpets">
            {pets.map((p, i) => (
              <button key={p.id || i} className={'sa-lp' + (sel === i ? ' on' : '')} onClick={() => setSel(i)}>
                <Avatar skin={p.skin} size={58} /><span>{p.name}</span>
              </button>
            ))}
            {pets.length < 8 && <button className="sa-lp add" onClick={() => desktop.addPet()}>＋<span>Add pet</span></button>}
          </div>
          {pets[sel] && (
            <div className="sa-lp-edit">
              <label className="sa-inline">Name <input key={pets[sel].id} defaultValue={pets[sel].name} maxLength={20} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pets[sel].name) desktop.setLocal({ pets: pets.map((p, i) => (i === sel ? { ...p, name: v } : p)) }); }} /></label>
              <select value={pets[sel].skin} onChange={(e) => desktop.setLocal({ pets: pets.map((p, i) => (i === sel ? { ...p, skin: e.target.value } : p)) })}>
                {CHARACTERS.map((c) => <option key={c.key} value={c.key}>{c.name} · {c.role}</option>)}
              </select>
              <button className="btn small ghost" onClick={() => desktop.command({ type: 'special', pet: sel })}>Special move</button>
              <button className="btn small ghost" onClick={() => desktop.command({ type: 'dance', pet: sel })}>Dance</button>
              <button className="btn small ghost" disabled={pets.length < 2} onClick={() => { desktop.removePet(sel); setSel(0); }}>Send home</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shows exactly what is (and isn't) getting through, so problems are easy to spot.
function ConnectionCheck({ state, local, desktop }) {
  const d = state.diag || { feeds: {} };
  const good = (v) => v === 'ok';
  const row = (label, value, ok) => (
    <div className="sa-diag" key={label}><span className={'sa-dot' + (ok ? ' on' : '')} />{label}<b>{value}</b></div>
  );
  return (
    <div className="sa-card">
      <h3>Connection check</h3>
      {row('Your online status', d.write === 'ok' ? 'sending · ' + ago(d.writeAt) : d.write ? 'blocked: ' + d.write : 'waiting…', good(d.write))}
      {row('Live updates', d.listen ? 'retrying: ' + d.listen : 'connected', !d.listen)}
      {row('Clock difference', Math.abs(Math.round((d.skew || 0) / 1000)) + 's (handled)', true)}
      {state.friends.map((f) => row(`@${f.username}`, (d.feeds[f.uid] === 'ok' ? (f.online ? 'online' : 'offline · seen ' + (ago(f.lastSeen) || 'never')) : (d.feeds[f.uid] || 'connecting…')), d.feeds[f.uid] === 'ok' && f.online))}
      {desktop && local && row('Friends’ pets on desktop', local.settings.showFriends === false ? 'turned off' : state.prefs.dnd ? 'hidden (do not disturb)' : 'on', local.settings.showFriends !== false && !state.prefs.dnd)}
      <p className="sa-sub">If a friend shows “permission-denied”, re-publish the latest Firestore rules. “offline” means their Nibble app or /app page isn’t open right now.</p>
    </div>
  );
}

const SIZES = [['Tiny', 0.65], ['Small', 0.82], ['Normal', 1], ['Big', 1.3], ['Chonky', 1.65]];
function Settings({ social, state, desktop, local, toast }) {
  const s = (local && local.settings) || {};
  const set = (patch) => desktop.setLocal(patch);
  const [status, setStatus] = useState(state.prefs.status || '');
  return (
    <div className="sa-page">
      <h2>Settings</h2>
      <ConnectionCheck state={state} local={local} desktop={desktop} />
      <div className="sa-card">
        <h3>Social</h3>
        <form className="sa-inline" onSubmit={(e) => { e.preventDefault(); social.setPrefs({ status }); toast({ text: 'Status updated' }); }}>
          Status <input value={status} maxLength={40} placeholder="shipping a landing page…" onChange={(e) => setStatus(e.target.value)} /> <button className="btn small">Set</button>
        </form>
        <Toggle label="Do not disturb" hint="Hide friends’ pets and messages for now. Friends see you as busy." on={state.prefs.dnd} onChange={(v) => social.setPrefs({ dnd: v })} />
        <Toggle label="Appear offline" hint="Your pet stops visiting friends. You still see theirs." on={state.prefs.invisible} onChange={(v) => social.setPrefs({ invisible: v })} />
        {desktop && <Toggle label="Friends’ pets visit my desktop" hint="Online friends’ pets walk around on your screen." on={s.showFriends !== false} onChange={(v) => set({ showFriends: v })} />}
      </div>
      {desktop && local && (
        <div className="sa-card">
          <h3>Pet behaviour</h3>
          <div className="sa-seg">Size {SIZES.map(([l, v]) => <button key={l} className={s.size === v ? 'on' : ''} onClick={() => set({ size: v })}>{l}</button>)}</div>
          <div className="sa-seg">Chattiness {['silent', 'quiet', 'normal', 'chatty'].map((v) => <button key={v} className={s.chatty === v ? 'on' : ''} onClick={() => set({ chatty: v })}>{v}</button>)}</div>
          <div className="sa-seg">Break reminders {[[0, 'Off'], [30, '30m'], [50, '50m'], [60, '60m'], [90, '90m']].map(([v, l]) => <button key={v} className={s.breakMinutes === v ? 'on' : ''} onClick={() => set({ breakMinutes: v })}>{l}</button>)}</div>
          <Toggle label="Walk on windows" on={s.walkOnWindows} onChange={(v) => set({ walkOnWindows: v })} />
          <Toggle label="Follow my cursor" on={s.followCursor} onChange={(v) => set({ followCursor: v })} />
          <Toggle label="React to apps I use" on={s.reactToApps} onChange={(v) => set({ reactToApps: v })} />
          <Toggle label="Hide during fullscreen" on={s.hideFullscreen} onChange={(v) => set({ hideFullscreen: v })} />
          <Toggle label="Little sounds" on={s.sounds} onChange={(v) => set({ sounds: v })} />
          <Toggle label="Start with Windows" on={s.startWithWindows} onChange={(v) => set({ startWithWindows: v })} />
          <Toggle label="Hide pets" hint="Ctrl + Alt + N" on={s.paused} onChange={(v) => set({ paused: v })} />
        </div>
      )}
      <div className="sa-card">
        <h3>Account</h3>
        <p className="sa-sub">@{state.profile.username} · {state.user.email || 'signed in'} · {state.user.provider === 'google.com' ? 'Google' : 'Email'}</p>
        <button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button>
      </div>
      {desktop && local && (
        <div className="sa-card">
          <h3>Nibble {local.version}</h3>
          <p className="sa-sub">{local.latest ? `Version ${local.latest} is available.` : 'Updates install over the top and keep your pets and settings.'}</p>
          <button className="btn small" onClick={() => desktop.update()}>{local.latest ? `Update to ${local.latest}` : 'Reinstall / update'}</button>
        </div>
      )}
    </div>
  );
}

function Home({ social, state, desktop, local, toast, go, chatWith, setChatWith }) {
  const online = state.friends.filter((f) => f.online);
  const last = state.messages.filter((m) => !m.mine).slice(-3).reverse();
  return (
    <div className="sa-page">
      <h2>Hey @{state.profile.username} 👋</h2>
      {!desktop && <LiveDesk social={social} state={state} />}
      {desktop && (
        <div className="sa-card sa-hero">
          <Avatar skin={state.profile.skin} size={84} mood="wave" />
          <div>
            <h3>{local && local.settings.paused ? 'Your pets are hidden' : 'Your pets are on your desktop'}</h3>
            <p className="sa-sub"><b>Click and hold</b> your pet, then let go, pick a friend and type. Only that friend sees it (or choose All friends). <b>Hold a friend’s pet</b> to message them, <b>double-click</b> it to poke.</p>
          </div>
        </div>
      )}
      <SayBar social={social} state={state} to={chatWith} setTo={setChatWith} />
      <div className="sa-grid2">
        <div className="sa-card">
          <h3>Online now <small>{online.length}</small></h3>
          {online.length === 0 && <p className="sa-empty">Nobody’s around. <button className="sa-link" onClick={() => go('friends')}>Add friends</button></p>}
          {online.map((f) => <FriendRow key={f.uid} social={social} f={f} toast={toast} desktop={desktop} />)}
          {online.length === 0 && state.friends.length > 0 && state.friends.slice(0, 3).map((f) => <FriendRow key={f.uid} social={social} f={f} toast={toast} desktop={desktop} />)}
        </div>
        <div className="sa-card">
          <h3>Latest <button className="sa-link" onClick={() => go('messages')}>all messages</button></h3>
          {last.length === 0 && <p className="sa-empty">Messages from friends land here.</p>}
          {last.map((m) => (
            <div key={m.id} className="sa-m" onClick={() => { setChatWith(m.kind === 'say' ? 'all' : m.from); go('messages'); }}><small>@{m.fromName} · {m.kind === 'say' ? 'to everyone' : '🔒 to you'} · {ago(m.at)}</small><p>{m.text || `${EMOTES[m.kind] || ''} ${EMOTE_TEXT[m.kind] || m.kind}`}</p></div>
          ))}
          {state.incoming.length > 0 && <button className="btn small" onClick={() => go('friends')}>{state.incoming.length} friend request{state.incoming.length > 1 ? 's' : ''} →</button>}
        </div>
      </div>
    </div>
  );
}

// ---------- desktop bridge (only inside the Nibble app's Hub window) ----------
function useDesktopBridge(desktop, social, state) {
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (!desktop) return;
    desktop.getLocal().then(setLocal);
    return desktop.onLocal(setLocal);
  }, [desktop]);
  const sent = useRef('');
  useEffect(() => {
    if (!desktop) return;
    const payload = state.profile && state.user ? {
      me: { uid: state.user.uid, username: state.profile.username, skin: state.profile.skin, petName: state.profile.petName },
      prefs: state.prefs,
      friends: state.friends.map((f) => ({ uid: f.uid, username: f.username, skin: f.skin, petName: f.petName, online: f.online, typing: f.typing, dnd: f.dnd, status: f.status })),
      requests: state.incoming.length,
    } : { me: null, friends: [], prefs: {}, requests: 0 };
    const j = JSON.stringify(payload);
    if (j !== sent.current) { sent.current = j; desktop.sendSocial(payload); }
  }, [desktop, state]);
  useEffect(() => {
    if (!desktop || !social) return;
    const off1 = social.onMessage((m) => desktop.sendEvent(m));
    const off2 = desktop.onAction((a) => {
      if (!a || typeof a !== 'object') return;
      if (a.type === 'say') social.say(a.text).catch(() => {});
      else if (a.type === 'typing') social.setTyping(!!a.on, a.to || '').catch(() => {});
      else if (a.type === 'send') social.send(a.to, a.kind, a.text).catch(() => {});
    });
    return () => { off1(); off2 && off2(); };
  }, [desktop, social]);
  return local;
}

export default function SocialApp({ mode = 'web' }) {
  const { social, state, missing } = useSocial();
  const [tab, setTab] = useState('home');
  const [note, setNote] = useState(null);
  const [desktop, setDesktop] = useState(null);
  const [presetAdd, setPresetAdd] = useState('');
  const [chatWith, setChatWith] = useState('');
  useEffect(() => {
    if (window.nibbleDesktop) setDesktop(window.nibbleDesktop);
    const q = new URLSearchParams(location.search);
    if (q.get('add')) { setPresetAdd(q.get('add')); setTab('friends'); }
    if (q.get('tab')) setTab(q.get('tab'));
    if (window.nibbleDesktop && window.nibbleDesktop.onTab) window.nibbleDesktop.onTab((t) => setTab(t));
  }, []);
  const local = useDesktopBridge(desktop, social, state);
  const toast = useMemo(() => (n) => setNote(n), []);
  const isDesk = mode === 'desktop' || !!desktop;

  let body;
  if (missing) {
    body = (
      <div className="sa-center">
        <PetFigure skin="mojo" mood="work" w={160} h={150} />
        <h1>Nibble Social is getting wired up</h1>
        <p className="sa-sub">Accounts and friends turn on as soon as the backend goes live. Your pets work offline in the meantime.</p>
      </div>
    );
  } else if (!state.ready || (state.user && state.profile === undefined)) {
    body = <div className="sa-center"><PetFigure skin="mint" mood="sleep" w={140} h={130} /><p className="sa-sub">Waking up…</p></div>;
  } else if (!state.user) body = <AuthScreen social={social} desktop={desktop} />;
  else if (!state.profile) body = <Onboard social={social} state={state} initialSkin={local?.settings?.pets?.[0]?.skin} />;
  else {
    const props = { social, state, desktop, local, toast, go: setTab, chatWith, setChatWith };
    body = (
      <>
        {tab === 'home' && <Home {...props} />}
        {tab === 'friends' && <Friends {...props} presetAdd={presetAdd} />}
        {tab === 'messages' && <Messages {...props} />}
        {tab === 'pets' && <Pets {...props} />}
        {tab === 'settings' && <Settings {...props} />}
      </>
    );
  }
  const signedIn = state.user && state.profile;

  return (
    <div className={'sa' + (isDesk ? ' desk' : '') + (signedIn ? '' : ' solo')}>
      {signedIn && (
        <aside className="sa-side">
          <a className="logo" href={isDesk ? undefined : '/'}><span className="sa-logo">◕‿◕</span> Nibble</a>
          <div className="sa-me">
            <Avatar skin={state.profile.skin} size={52} mood="happy" />
            <div><b>@{state.profile.username}</b><small><span className={'sa-dot' + (state.prefs.invisible ? '' : ' on') + (state.prefs.dnd ? ' dnd' : '')} />{state.prefs.invisible ? 'appearing offline' : state.prefs.dnd ? 'do not disturb' : 'online'}</small></div>
          </div>
          <nav>
            {NAV.map(([k, l, i]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                <span>{i}</span>{l}
                {k === 'friends' && state.incoming.length > 0 && <em className="sa-badge">{state.incoming.length}</em>}
              </button>
            ))}
          </nav>
          <div className="sa-side-foot">{isDesk ? `Nibble ${local?.version || ''}` : <a href="/#download">Get the desktop app →</a>}</div>
        </aside>
      )}
      <main className="sa-main">
        {!signedIn && !isDesk && <a className="sa-back" href="/">← nibble</a>}
        {body}
      </main>
      <Notice note={note} onDone={() => setNote(null)} />
    </div>
  );
}
