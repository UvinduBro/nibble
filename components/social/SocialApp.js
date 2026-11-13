'use client';
import './social.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen, Onboard, CharacterGrid } from './Auth';
import LiveDesk from './LiveDesk';
import { Music, MusicDock, useRoomPlayer } from './Music';
import PetFigure, { useNibble } from '../PetFigure';
import { byKey, CHARACTERS } from '../../lib/characters';
import { EMOTES, EMOTE_TEXT, MAX_TEXT, niceError, verLess } from '../../lib/social/social';
import { ROLES, INTERESTS, MAX_INTERESTS, cleanAbout } from '../../lib/about';

// announcement / notice banner. level: info | update | warn | party | need
const BANNER_ICON = { info: '📣', update: '⬆️', warn: '⚠️', party: '🎉', need: '⬆️' };
function Banner({ level = 'info', title, text, link, linkLabel = 'Open', onClose, children }) {
  const lv = BANNER_ICON[level] ? level : 'info';
  return (
    <div className={'sa-bc lvl-' + lv}>
      <span className="sa-bc-ico">{BANNER_ICON[lv]}</span>
      <div className="sa-bc-text">{title && <b>{title} </b>}{text}</div>
      {children}
      {link && <a className="btn small" href={link} target="_blank" rel="noopener">{linkLabel}</a>}
      {onClose && <button className="sa-x" onClick={onClose} title="Dismiss">✕</button>}
    </div>
  );
}

const ago = (t) => {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};
const EMOTE_TITLE = { wave: 'Wave', hug: 'Cuddle', kiss: 'Kiss', poke: 'Poke', annoy: 'Tease', icecream: 'Share ice cream', heart: 'Send a heart', highfive: 'High five', tickle: 'Tickle', cheer: 'Cheer them on', snack: 'Share a snack', dance: 'Dance together' };
const NAV = [
  ['home', 'Home', '⌂'], ['profile', 'Profile', '☻'], ['deadlines', 'Deadlines', '⏰'], ['friends', 'Friends', '☺'], ['messages', 'Messages', '✉'], ['music', 'Music', '♫'], ['pets', 'Pets', '✦'], ['settings', 'Settings', '⚙'],
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
  const kinds = compact ? ['wave', 'hug', 'kiss', 'icecream'] : ['wave', 'hug', 'kiss', 'poke', 'annoy', 'icecream', 'heart', 'highfive', 'tickle', 'cheer', 'snack', 'dance'];
  return (
    <div className="sa-acts">
      {kinds.map((k) => <button key={k} title={EMOTE_TITLE[k] || k} onClick={() => act(k)}>{EMOTES[k]}</button>)}
      <button title="Private message" onClick={() => setWhisper('')}>💬</button>
      {social.music && <button title="Listen together" onClick={() => {
        const r = social.state.music && social.state.music.room;
        const mine = r && r.host === social.state.user.uid;
        (mine ? social.music.invite(f.uid) : social.music.start([f.uid]))
          .then(() => toast({ text: `🎧 Invited @${f.username} to listen together — open Music to pick a song` }))
          .catch((e) => toast({ err: true, text: niceError(e) }));
      }}>🎧</button>}
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
        {f.np && <small className="sa-np">🎧 {f.np.title}{f.np.artist ? ' — ' + f.np.artist : ''}{f.np.app ? ' · ' + f.np.app : ''}</small>}
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
      {desktop && (
        <div className="sa-card">
          <h3>🎭 Make them interact</h3>
          <p className="sa-sub">Pets on the same window or the taskbar chat, play and squabble on their own. Start one now — needs two pets close together (yours or a friend's visiting). If they fight, click <b>🍦 Give them ice cream</b> under them to make them friends again.</p>
          <div className="sa-interact">{INTERACT.map(([k, l]) => <button key={k} className="btn small ghost" onClick={() => desktop.command({ type: 'drama', kind: k })}>{l}</button>)}</div>
        </div>
      )}
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
          <Toggle label="Pet sounds" hint="Soft little noises when pets talk, eat, snore, cheer or grumble" on={s.sounds} onChange={(v) => set({ sounds: v })} />
          <Toggle label="Pets interact with each other" hint="Chats, dance-offs, cuddles… and the odd squabble you can fix with ice cream 🍦" on={s.drama !== false} onChange={(v) => set({ drama: v })} />
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

const INTERACT = [['chat', '💬 Chat'], ['play', '🕺 Dance-off'], ['snuggle', '🤗 Cuddle'], ['annoy', '😜 Tease'], ['argue', '😤 Squabble']];

// ---------- Deadlines: your pet reminds you 1 day and 3 hours before ----------
const pad2 = (n) => String(n).padStart(2, '0');
const toLocalInput = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const atDay = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.getTime(); };
const nextWeekday = (wd, h) => { const d = new Date(); d.setDate(d.getDate() + (((wd - d.getDay() + 7) % 7) || 7)); d.setHours(h, 0, 0, 0); return d.getTime(); };
const QUICK = [
  ['Today 5 PM', () => atDay(0, 17)], ['Tonight 9 PM', () => atDay(0, 21)], ['Tomorrow 9 AM', () => atDay(1, 9)],
  ['Tomorrow 5 PM', () => atDay(1, 17)], ['In 3 days', () => atDay(3, 17)], ['Next Monday', () => nextWeekday(1, 9)],
];
export const fmtDue = (t) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export function dueLeft(t) {
  const ms = t - Date.now();
  if (ms <= 0) return { txt: 'overdue', cls: 'bad' };
  const m = Math.round(ms / 60_000), h = Math.round(ms / 3600_000), d = Math.round(ms / 86400_000);
  const txt = m < 60 ? `in ${m} min` : h < 36 ? `in ${h} hour${h === 1 ? '' : 's'}` : `in ${d} days`;
  return { txt, cls: ms <= 3 * 3600_000 ? 'bad' : ms <= 86400_000 ? 'warn' : 'ok' };
}

function Deadlines({ social, state, desktop, local, toast }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(atDay(1, 17)));
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const items = state.deadlines || [];
  const open = items.filter((d) => !d.done).sort((a, b) => a.due - b.due);
  const done = items.filter((d) => d.done).sort((a, b) => b.due - a.due);
  const saved = (r, msg) => toast({ text: r === 'local' ? msg + ' — saved on this device (publish the latest rules to sync)' : msg });
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) saved(r, msg); } catch (x) { toast({ err: true, text: niceError(x) }); } };
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    const due = new Date(when).getTime();
    const ms = due - Date.now();
    const plan = ms > 86400_000 ? '1 day before and 3 hours before' : ms > 3 * 3600_000 ? '3 hours before' : 'right away';
    await run(() => social.deadlines.add(title, due), `Added — your pet will remind you ${plan} ⏰`);
    setTitle('');
    setBusy(false);
  };
  const newPets = !desktop || (local && local.version && !verLess(local.version, '2.0.8'));
  const minIn = toLocalInput(Date.now() + 5 * 60_000);

  return (
    <div className="sa-page">
      <h2>Deadlines</h2>
      <div className="sa-card">
        <h3>⏰ Add a deadline</h3>
        <p className="sa-sub">Your pet reminds you <b>1 day before</b> and again <b>3 hours before</b>. It drops in right next to your cursor and tells you. If you're away from your PC, it waits until you're back.</p>
        <form className="sa-form" onSubmit={add}>
          <label><span>What's due?</span><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final project submission" /></label>
          <label><span>When?</span><input type="datetime-local" value={when} min={minIn} onChange={(e) => setWhen(e.target.value)} /></label>
          <div className="sa-quick">{QUICK.map(([l, f]) => <button type="button" key={l} className={toLocalInput(f()) === when ? 'on' : ''} onClick={() => setWhen(toLocalInput(f()))}>{l}</button>)}</div>
          <button className="btn" disabled={!title.trim() || !when || busy}>{busy ? 'Adding…' : 'Add deadline'}</button>
        </form>
      </div>

      <div className="sa-card">
        <h3>Coming up <small>{open.length}</small><button className="sa-link" onClick={() => { social.deadlines.test(); toast({ text: desktop ? 'Watch your desktop 👀' : 'Look at your pet on Home 👀' }); }}>▶ Test a reminder</button></h3>
        {open.length === 0 && <p className="sa-empty">Nothing due. Enjoy it 🌴</p>}
        {open.map((d) => {
          const l = dueLeft(d.due);
          return (
            <div key={d.id} className={'sa-dl ' + l.cls}>
              <button className="sa-dl-check" onClick={() => run(() => social.deadlines.toggle(d.id), 'Done! Nice work 🎉')} title="Mark as done" aria-label="Mark as done" />
              <div className="sa-dl-main">
                <b>{d.title}</b>
                <small>{fmtDue(d.due)} · <span className={'sa-dl-left ' + l.cls}>{l.txt}</span></small>
                {d.due > Date.now() ? (
                  <span className="sa-dl-bells">
                    {(!d.createdAt || d.due - d.createdAt > 86400_000) && <i className={d.r1 ? 'on' : ''} title={d.r1 ? 'Reminded' : 'Not yet'}>{d.r1 ? '✓' : '🔔'} 1 day before</i>}
                    <i className={d.r2 ? 'on' : ''} title={d.r2 ? 'Reminded' : 'Not yet'}>{d.r2 ? '✓' : '🔔'} 3 hours before</i>
                  </span>
                ) : null}
              </div>
              <button className="sa-x" onClick={() => run(() => social.deadlines.remove(d.id))} title="Delete">✕</button>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="sa-card">
          <h3>Done <small>{done.length}</small><button className="sa-link" onClick={() => run(() => social.deadlines.clearDone(), 'Cleared')}>Clear all</button></h3>
          {done.map((d) => (
            <div key={d.id} className="sa-dl done">
              <button className="sa-dl-check on" onClick={() => run(() => social.deadlines.toggle(d.id))} title="Not done yet" aria-label="Mark as not done">✓</button>
              <div className="sa-dl-main"><b>{d.title}</b><small>{fmtDue(d.due)}</small></div>
              <button className="sa-x" onClick={() => run(() => social.deadlines.remove(d.id))} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
      {!newPets && <p className="sa-sub">⬆️ On your desktop app (v{local.version}) reminders arrive as Windows notifications. Update to <b>Nibble 2.0.8</b> and your pet will deliver them itself.</p>}
    </div>
  );
}

// ---------- Profile: "About me" shapes what your own pet thinks about ----------
const sameAbout = (a, b) => JSON.stringify(cleanAbout(a || {})) === JSON.stringify(cleanAbout(b || {}));

function Profile({ social, state, desktop, local, toast }) {
  const engine = useNibble();
  const saved = state.about || {};
  const [nick, setNick] = useState(saved.nick || '');
  const [role, setRole] = useState(saved.role || '');
  const [ints, setInts] = useState(saved.interests || []);
  const [focus, setFocus] = useState(saved.focus || '');
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  // the saved About me can arrive a moment after the tab opens — fill the form once when it does
  const filled = useRef(!!state.about);
  useEffect(() => {
    if (filled.current || !state.about) return;
    filled.current = true;
    setNick(state.about.nick || ''); setRole(state.about.role || ''); setInts(state.about.interests || []); setFocus(state.about.focus || '');
  }, [state.about]);

  const about = { nick, role, interests: ints, focus };
  const dirty = !sameAbout(about, saved);
  const samples = useMemo(
    () => (engine && window.NibbleLines && window.NibbleLines.sample ? window.NibbleLines.sample(cleanAbout(about), 6) : []),
    [engine, seed, nick, role, ints.join(','), focus] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toggle = (k) => setInts(ints.includes(k) ? ints.filter((x) => x !== k) : ints.length >= MAX_INTERESTS ? ints : [...ints, k]);
  const save = async (next = about, msg) => {
    setBusy(true);
    try {
      const r = await social.setAbout(next);
      toast({ text: msg || (r === 'local' ? 'Saved on this device — sync turns on once the latest rules are published' : 'Saved — your pet has new things to think about ✨') });
    } catch (e) { toast({ err: true, text: niceError(e) }); }
    setBusy(false);
  };
  const clear = () => { setNick(''); setRole(''); setInts([]); setFocus(''); save({}, 'About me cleared'); };
  const roleInfo = ROLES.find(([k]) => k === saved.role);
  const oldDesk = desktop && local && local.version && verLess(local.version, '2.0.7');

  return (
    <div className="sa-page">
      <h2>Profile</h2>
      <div className="sa-card sa-prof">
        <div className="sa-prof-pet"><PetFigure skin={state.profile.skin} mood="happy" acc={state.profile.acc} tint={state.profile.tint} makeup={state.profile.makeup} w={120} h={116} size={1.05} /></div>
        <div className="sa-prof-main">
          <b>{saved.nick || '@' + state.profile.username}</b>
          <small>@{state.profile.username}{state.profile.petName ? ` · pet: ${state.profile.petName}` : ''}</small>
          <div className="sa-prof-tags">
            {roleInfo && roleInfo[0] !== 'other' && <span>{roleInfo[2]} {roleInfo[1]}</span>}
            {(saved.interests || []).map((k) => { const i = INTERESTS.find(([x]) => x === k); return i ? <span key={k}>{i[2]} {i[1]}</span> : null; })}
            {saved.focus && <span>🎯 {saved.focus}</span>}
            {!state.about && <span className="dim">Nothing about you yet</span>}
          </div>
        </div>
      </div>

      <div className="sa-card">
        <h3>💭 About me <small>🔒 private · only you can see this</small></h3>
        <p className="sa-sub">Tell your pet a little about you. Its thoughts will be about your work, your hobbies and what you're up to, so they don't keep repeating random jokes.</p>

        <label className="sa-field"><span>What should your pet call you?</span>
          <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder={state.profile.username} />
        </label>

        <div className="sa-field"><span>What do you do?</span>
          <div className="sa-chips">
            {ROLES.map(([k, l, i]) => <button key={k} type="button" className={role === k ? 'on' : ''} onClick={() => setRole(role === k ? '' : k)}>{i} {l}</button>)}
          </div>
        </div>

        <div className="sa-field"><span>What are you into? <small>{ints.length}/{MAX_INTERESTS}</small></span>
          <div className="sa-chips">
            {INTERESTS.map(([k, l, i]) => <button key={k} type="button" className={ints.includes(k) ? 'on' : ''} disabled={!ints.includes(k) && ints.length >= MAX_INTERESTS} onClick={() => toggle(k)}>{i} {l}</button>)}
          </div>
        </div>

        <label className="sa-field"><span>What are you working on right now? <small>optional · {focus.length}/40</small></span>
          <input value={focus} maxLength={40} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. my final project, a café logo, learning guitar" />
        </label>

        <div className="sa-think">
          <div className="sa-think-h"><span>Your pet might think… {engine && window.NibbleLines && window.NibbleLines.countFor && <em className="sa-think-n">{window.NibbleLines.countFor(cleanAbout(about))} thoughts fit you</em>}</span><button type="button" onClick={() => setSeed(seed + 1)} title="Show other examples">🔀 Shuffle</button></div>
          {samples.length
            ? samples.map((t) => <div key={t} className="sa-thought">{t}</div>)
            : <p className="sa-empty">{engine ? 'Pick a few things above to see examples.' : 'Loading…'}</p>}
        </div>

        <div className="sa-inline" style={{ marginBottom: 0 }}>
          <button className="btn" disabled={!dirty || busy} onClick={() => save()}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved ✓'}</button>
          {state.about && <button className="btn small ghost" disabled={busy} onClick={clear}>Clear all</button>}
        </div>
        {oldDesk && <p className="sa-sub" style={{ marginTop: 12 }}>⬆️ Your desktop pets pick up these thoughts from <b>Nibble 2.0.7</b> — update from the tray menu (you're on v{local.version}).</p>}
      </div>
    </div>
  );
}

function Home({ social, state, desktop, local, toast, go, chatWith, setChatWith }) {
  const online = state.friends.filter((f) => f.online);
  const last = state.messages.filter((m) => !m.mine).slice(-3).reverse();
  return (
    <div className="sa-page">
      <h2>Hey {(state.about && state.about.nick) || '@' + state.profile.username} 👋</h2>
      {!state.about && (
        <div className="sa-card sa-tip">
          <span className="sa-tip-ico">💭</span>
          <div><b>New: tell your pet about you</b><p className="sa-sub">What you do, what you're into and what you're working on — your pet's thoughts will fit your day instead of repeating random jokes.</p></div>
          <button className="btn small" onClick={() => go('profile')}>Set up</button>
        </div>
      )}
      {(() => {
        const next = (state.deadlines || []).filter((d) => !d.done && d.due > Date.now()).sort((a, b) => a.due - b.due)[0];
        if (!next) return null;
        const l = dueLeft(next.due);
        return (
          <button className={'sa-card sa-next ' + l.cls} onClick={() => go('deadlines')}>
            <span className="sa-tip-ico">⏰</span>
            <span><b>Next up: {next.title}</b><small>{fmtDue(next.due)} · {l.txt}</small></span>
            <em>All deadlines →</em>
          </button>
        );
      })()}
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
  const localRef = useRef(local);
  localRef.current = local;
  useEffect(() => {
    if (!desktop || !social || !social.onReminder) return;
    return social.onReminder((r) => {
      const l = localRef.current;
      const petsCanTell = l && l.version && !verLess(l.version, '2.0.8');
      if (petsCanTell) desktop.sendEvent(r); // pets deliver it (hub.js falls back to a notification when pets are hidden)
      else if (desktop.notify) desktop.notify({ title: 'Nibble reminder ⏰', body: r.text });
    });
  }, [desktop, social]);
  const sent = useRef('');
  useEffect(() => {
    if (!desktop) return;
    const payload = state.profile && state.user ? {
      me: { uid: state.user.uid, username: state.profile.username, skin: state.profile.skin, petName: state.profile.petName, acc: state.profile.acc || [], tint: state.profile.tint || '', makeup: state.profile.makeup || '', about: state.about || null },
      prefs: state.prefs,
      // include each friend's look (accessories / colour / makeup) so their pet is dressed up on this desktop too
      friends: state.friends.map((f) => ({ uid: f.uid, username: f.username, skin: f.skin, petName: f.petName, acc: f.acc || [], tint: f.tint || '', makeup: f.makeup || '', online: f.online, typing: f.typing, dnd: f.dnd, status: f.status, np: f.np ? f.np.title : '' })),
      requests: state.incoming.length,
      // Listen Together: whose pets wear headphones and dance (you + everyone in your room right now)
      music: state.music && state.music.room ? { on: true, playing: !!state.music.room.playing && !!state.music.room.track, title: state.music.room.track ? state.music.room.track.title : '', members: state.music.room.present } : { on: false },
    } : { me: null, friends: [], prefs: {}, requests: 0 };
    const j = JSON.stringify(payload);
    if (j !== sent.current) { sent.current = j; desktop.sendSocial(payload); }
  }, [desktop, state]);
  // only read the Windows media controls while you've chosen to share what you play
  const share = !!(state.music && state.music.share && state.user);
  useEffect(() => {
    if (desktop && desktop.watchNowPlaying) desktop.watchNowPlaying(share);
    if (!share && social && social.music) social.music.setDeviceNp(null);
  }, [desktop, share]);
  useEffect(() => {
    if (!desktop || !social) return;
    const off1 = social.onMessage((m) => desktop.sendEvent(m));
    // things you send (wave, hug, kiss…) play on your own desktop too, not just your friend's
    const off3 = social.onSent ? social.onSent((m) => { if (m.kind !== 'whisper' && m.kind !== 'poke') desktop.sendEvent({ ...m, echo: true }); }) : null;
    // Spotify / YouTube / … playing on this PC (main.js reads the Windows media controls)
    const off4 = desktop.onNowPlaying ? desktop.onNowPlaying((np) => social.music && social.music.setDeviceNp(np)) : null;
    const off2 = desktop.onAction((a) => {
      if (!a || typeof a !== 'object') return;
      if (a.type === 'say') social.say(a.text).catch(() => {});
      else if (a.type === 'typing') social.setTyping(!!a.on, a.to || '').catch(() => {});
      else if (a.type === 'send') social.send(a.to, a.kind, a.text).catch(() => {});
      else if (a.type === 'music' && social.music) { // pet menu → music controls
        const r = social.state.music && social.state.music.room;
        if (a.cmd === 'toggle' && r) social.music.toggle().catch(() => {});
        else if (a.cmd === 'next' && r && r.track) social.music.next(r.track.k).catch(() => {});
        else if (a.cmd === 'join' && a.host) social.music.join(a.host).catch(() => {});
      }
    });
    return () => { off1(); off2 && off2(); off3 && off3(); off4 && off4(); };
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
    // desktop Hub hidden → pause every little animated pet on the page (saves CPU/GPU, less lag)
    if (window.nibbleDesktop && window.nibbleDesktop.onVisible) window.nibbleDesktop.onVisible((v) => { window.__nibbleHidden = !v; window.dispatchEvent(new Event('nibble-visibility')); });
  }, []);
  const local = useDesktopBridge(desktop, social, state);
  const toast = useMemo(() => (n) => setNote(n), []);
  const player = useRoomPlayer(social, state, toast);
  const isDesk = mode === 'desktop' || !!desktop;

  // site-wide announcement from an admin: banner for everyone, Windows notification on desktop
  const bcId = state.broadcast && state.broadcast.id;
  const notified = useRef('');
  const [bcDismissed, setBcDismissed] = useState('');
  useEffect(() => { try { setBcDismissed(localStorage.getItem('nibble-bc-seen') || ''); } catch {} }, []);
  const bcLive = !!state.broadcast && !(state.broadcast.expiresAt && Date.now() > state.broadcast.expiresAt);
  useEffect(() => {
    if (!bcId || !bcLive || notified.current === bcId) return;
    notified.current = bcId;
    if (desktop && desktop.notify) desktop.notify({ title: state.broadcast.title || 'Nibble', body: state.broadcast.text });
  }, [bcId, bcLive, desktop]);
  const showBc = bcLive && bcId !== bcDismissed;
  const dismissBc = () => { try { localStorage.setItem('nibble-bc-seen', bcId); } catch {} setBcDismissed(bcId); };

  // deadline reminders: a banner in the app, and on the web your desk pet says it too
  const [rem, setRem] = useState(null);
  useEffect(() => {
    if (!social || !social.onReminder) return;
    return social.onReminder((r) => {
      setRem(r);
      if (!desktop) {
        // the desk pet only lives on Home: if it isn't on screen, it says this when you get there
        window.__nibbleRem = { r, at: Date.now() };
        window.dispatchEvent(new CustomEvent('nibble-remind', { detail: r }));
      }
    });
  }, [social, desktop]);

  // tell admins which app this is (desktop + version, or web)
  useEffect(() => {
    if (!social || !state.profile) return;
    if (isDesk) { if (local && local.version) social.setClient({ client: 'desktop', ver: local.version }); }
    else social.setClient({ client: 'web' });
  }, [social, state.profile, isDesk, local && local.version]);

  // admin-set site notice (dismissable per notice text) and "update needed" for old desktop builds
  const cfg = state.config || {};
  const [noticeSeen, setNoticeSeen] = useState('');
  useEffect(() => { try { setNoticeSeen(localStorage.getItem('nibble-notice-seen') || ''); } catch {} }, []);
  const showNotice = !!cfg.notice && cfg.notice !== noticeSeen;
  const dismissNotice = () => { try { localStorage.setItem('nibble-notice-seen', cfg.notice); } catch {} setNoticeSeen(cfg.notice); };
  const [needHidden, setNeedHidden] = useState(false);
  const needUpdate = isDesk && local && local.version && cfg.minVersion && verLess(local.version, cfg.minVersion) && !needHidden;

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
  else if (state.banned) {
    body = (
      <div className="sa-center sa-suspended">
        <PetFigure skin={(state.profile && state.profile.skin) || 'mint'} mood="sleep" w={150} h={140} />
        <h1>Account paused</h1>
        <p className="sa-sub">This account has been suspended by the Nibble team, so friends, messages and pokes are switched off for now. Your desktop pets still work offline. If you think this is a mistake, reach out to the Nibble team.</p>
        <button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button>
      </div>
    );
  }
  else if (!state.profile) body = <Onboard social={social} state={state} initialSkin={local?.settings?.pets?.[0]?.skin} />;
  else {
    const props = { social, state, desktop, local, toast, go: setTab, chatWith, setChatWith };
    body = (
      <>
        {tab === 'home' && <Home {...props} />}
        {tab === 'profile' && <Profile {...props} />}
        {tab === 'deadlines' && <Deadlines {...props} />}
        {tab === 'friends' && <Friends {...props} presetAdd={presetAdd} />}
        {tab === 'messages' && <Messages {...props} />}
        {tab === 'music' && <Music {...props} player={player} />}
        {tab === 'pets' && <Pets {...props} />}
        {tab === 'settings' && <Settings {...props} />}
      </>
    );
  }
  const signedIn = state.user && state.profile && !state.banned;

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
                {k === 'music' && state.music && state.music.invites.length > 0 && <em className="sa-badge">{state.music.invites.length}</em>}
                {k === 'music' && state.music && state.music.room && state.music.room.playing && <em className="sa-eq" aria-hidden><i /><i /><i /></em>}
              </button>
            ))}
          </nav>
          <div className="sa-side-foot">
            {state.admin && <a href="/admin" style={{ display: 'block', marginBottom: 6 }}>⚙️ Admin panel</a>}
            {isDesk ? `Nibble ${local?.version || ''}` : <a href="/#download">Get the desktop app →</a>}
          </div>
        </aside>
      )}
      <main className="sa-main">
        {!signedIn && !isDesk && <a className="sa-back" href="/">← nibble</a>}
        {signedIn && needUpdate && (
          <Banner level="need" title={`Update needed — you're on v${local.version}, v${cfg.minVersion}+ is required.`} text={cfg.updateMsg || 'Some features may not work until you update.'} link="/Nibble-Reinstall-Guide.pdf" linkLabel="How to" onClose={() => setNeedHidden(true)}>
            {desktop && desktop.update && <button className="btn small" onClick={() => desktop.update()}>Update now</button>}
          </Banner>
        )}
        {signedIn && rem && <Banner level="warn" text={rem.text} onClose={() => setRem(null)}>{!rem.test && <button className="btn small" onClick={() => { setTab('deadlines'); setRem(null); }}>View</button>}</Banner>}
        {signedIn && tab !== 'music' && state.music && state.music.invites.slice(0, 1).map((i) => (
          <Banner key={i.host} level="party" title={`@${i.fromName} invited you to listen together 🎧`} text="Join to hear the same song at the same moment." onClose={() => social.music.dismissInvite(i.host)}>
            <button className="btn small" onClick={() => { social.music.join(i.host).then(() => { player.unlock(); setTab('music'); }).catch((e) => toast({ err: true, text: niceError(e) })); }}>Join</button>
          </Banner>
        ))}
        {signedIn && showNotice && <Banner level={cfg.noticeLevel} text={cfg.notice} onClose={dismissNotice} />}
        {signedIn && showBc && <Banner level={state.broadcast.level} title={state.broadcast.title} text={state.broadcast.text} link={state.broadcast.link} onClose={dismissBc} />}
        {body}
      </main>
      {signedIn && social && social.music && <MusicDock social={social} state={state} player={player} go={setTab} tab={tab} />}
      <Notice note={note} onDone={() => setNote(null)} />
    </div>
  );
}
