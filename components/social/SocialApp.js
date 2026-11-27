'use client';
import './social.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen, Onboard, SignupQuestions } from './Auth';
import { guessCountry } from '../../lib/signup';
import LiveDesk from './LiveDesk';
import { Music, MusicDock, useRoomPlayer, readDock, saveDock } from './Music';
import PetFigure, { useNibble } from '../PetFigure';
import Emo from '../Emo';
import { byKey, CHARACTERS } from '../../lib/characters';
import { EMOTES, EMOTE_TEXT, MAX_TEXT, niceError, verLess, cleanStyleMap } from '../../lib/social/social';
import { ROLES, INTERESTS, MAX_INTERESTS, cleanAbout } from '../../lib/about';
import { priceLabel, buyable, money as fmtMoney, BUILTIN as PREMIUM_PERKS } from '../../lib/premium';
import { MIN_REVIEW, MAX_REVIEW } from '../../lib/reviews';
import { REFUND_DAYS, SELLER } from '../../lib/facts';
import Wardrobe from './Wardrobe';
import Arcade from './Arcade';
import Leaderboard from './Leaderboard';
import Groups from './Groups';
import TeaRoom from './TeaRoom';
import { teaConfig } from '../../lib/tea';
import { getMobileBridge } from '../../lib/mobileBridge';
import FeedbackForm, { systemName } from './Feedback';
import { ReplyBtn, Quote, ReplyBar } from './Reply';
import { useUserCard, Who } from './UserCard';
import { ChatReact } from './Reactions';
import { EMOTES as SHOP_EMOTES, SPECIES as SHOP_SPECIES, PT, owns } from '../../lib/shop';
import { GAMES } from '../../lib/social/games';

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
const EMOTE_TITLE = { wave: 'Wave', hug: 'Cuddle', kiss: 'Kiss', poke: 'Poke', annoy: 'Tease', icecream: 'Share ice cream', heart: 'Send a heart', highfive: 'High five', tickle: 'Tickle', cheer: 'Cheer them on', snack: 'Share a snack', dance: 'Dance together', boop: 'Boop', flower: 'Give a flower', cake: 'Birthday cake', fistbump: 'Fist bump', pillow: 'Pillow fight', serenade: 'Serenade', gift: 'Gift box', bubbles: 'Bubbles' };
const NAV = [
  ['home', 'Home', 'house'], ['style', 'Customize', 'palette'], ['games', 'Games', 'game'], ['board', 'Leaderboard', 'trophy'], ['friends', 'Friends', 'smile'], ['messages', 'Messages', 'envelope'], ['groups', 'Groups', 'people'], ['tea', 'Tea Room', 'tea'], ['music', 'Music', 'notes'], ['deadlines', 'Reminders', 'alarm'], ['profile', 'Profile', 'bust'], ['feedback', 'Feedback', 'bug'], ['premium', 'Premium', 'gem'], ['settings', 'Settings', 'gear'],
];

// `who` = a profile or friend: their accessories, colour, makeup and wardrobe look show on the avatar
function Avatar({ skin, size = 44, mood = 'idle', who }) {
  return <span className="sa-ava" style={{ width: size, height: size }}><PetFigure skin={skin || 'mint'} mood={mood} w={size} h={size} size={size / 92} acc={who && who.acc} tint={who && who.tint} makeup={who && who.makeup} look={who && who.style} /></span>;
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
  const owned = (social.state.wallet && social.state.wallet.owned) || [];
  const kinds = compact ? ['wave', 'hug', 'kiss', 'icecream'] : SHOP_EMOTES.filter((e) => owns(owned, 'em', e.key)).map((e) => e.key);
  return (
    <div className="sa-acts">
      {kinds.map((k) => <button key={k} title={EMOTE_TITLE[k] || k} onClick={() => act(k)}><Emo e={EMOTES[k]} size={22} /></button>)}
      <button title="Private message" onClick={() => setWhisper('')}><Emo k="speech" size={22} /></button>
      {social.music && <button title="Listen together" onClick={() => {
        const r = social.state.music && social.state.music.room;
        const mine = r && r.host === social.state.user.uid;
        (mine ? social.music.invite(f.uid) : social.music.start([f.uid]))
          .then(() => toast({ text: `🎧 Invited @${f.username} to listen together — open Music to pick a song` }))
          .catch((e) => toast({ err: true, text: niceError(e) }));
      }}><Emo k="headphone" size={22} /></button>}
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
      <Avatar skin={f.skin} who={f} mood={f.online ? (f.typing ? 'work' : 'idle') : 'sleep'} />
      <div className="sa-friend-main">
        <b>@{f.username}{f.premium && <span className="sa-prem" title="Nibble Premium">⭐</span>}</b>
        <small>
          <span className={'sa-dot' + (f.online ? ' on' : '') + (f.dnd ? ' dnd' : '')} />
          {f.typing ? 'thinking…' : f.online ? (f.dnd ? 'busy' : 'online') : f.lastSeen ? 'seen ' + ago(f.lastSeen) : 'offline'}
          {f.petName ? ` · ${f.petName}` : ''}{f.status ? ` · “${f.status}”` : ''}
        </small>
        {f.np && <small className="sa-np">🎧 {f.np.title}{f.np.artist ? ' — ' + f.np.artist : ''}{f.np.app ? ' · ' + f.np.app : ''}</small>}
      </div>
      <div className="sa-visit">
        <button title={`Bring @${f.username}'s pet to ${desktop ? 'your desktop' : 'your desk'}`} onClick={() => { bringHere(desktop, f); toast({ text: `🏠 @${f.username}'s pet is coming over` }); }}><Emo k="house" size={16} /> Bring here</button>
        <button title={`Send your pet to @${f.username}'s desktop`} onClick={() => social.send(f.uid, 'visit').then(() => toast({ text: `🚀 Your pet is visiting @${f.username}` })).catch((e) => toast({ err: true, text: niceError(e) }))}><Emo k="rocket" size={16} /> Visit</button>
      </div>
      <FriendActions social={social} f={f} toast={toast} compact={!full} />
      {full && (confirm
        ? <span className="sa-confirm">Remove? <button onClick={() => social.unfriend(f.uid)}>Yes</button><button onClick={() => setConfirm(false)}>No</button></span>
        : <button className="sa-x" title="Remove friend" onClick={() => setConfirm(true)}>✕</button>)}
    </div>
  );
}

// people on the same internet connection (Wi-Fi, office, home) who use Nibble
function NearbyPeople({ social, state, toast }) {
  const lan = state.lan || { on: true, people: [] };
  const [sent, setSent] = useState({});
  const friendIds = new Set(state.friends.map((f) => f.uid));
  const out = new Set(state.outgoing.map((r) => r.to));
  const inc = new Map(state.incoming.map((r) => [r.from, r]));
  const people = (lan.people || []).filter((p) => !friendIds.has(p.uid));
  if (!social.lan) return null;
  const add = (p) => {
    setSent((x) => ({ ...x, [p.uid]: true }));
    social.addFriend(p.username).then((r) => toast({ text: r === 'accepted' ? `You and @${p.username} are now friends 🎉` : `Request sent to @${p.username}` }))
      .catch((e) => { setSent((x) => ({ ...x, [p.uid]: false })); toast({ err: true, text: niceError(e) }); });
  };
  return (
    <div className="sa-card sa-near">
      <h3>📶 On your network <small>{lan.on ? `${people.length} nearby` : 'hidden'}</small>
        <label className="sa-near-tog" title="Others on the same Wi-Fi or office network can find you">
          <input type="checkbox" checked={!!lan.on} onChange={(e) => social.lan.setOn(e.target.checked)} /> Let people on my network find me
        </label>
      </h3>
      {!lan.on ? <p className="sa-empty">You’re hidden. Switch it on to see Nibble users on the same Wi-Fi or office network.</p>
        : people.length === 0 ? <p className="sa-empty">Nobody else on this network is using Nibble right now. People on the same Wi-Fi, home or office connection show up here.</p>
          : (
            <div className="sa-near-list">
              {people.map((p) => {
                const req = inc.get(p.uid);
                const pending = out.has(p.uid) || sent[p.uid];
                return (
                  <div key={p.uid} className="sa-near-p">
                    <Avatar skin={p.skin} who={{ style: p.style, tint: p.style && p.style.sp ? 'nat' : '' }} size={44} />
                    <span><b>@{p.username}</b><small>{p.petName || 'on your network'}</small></span>
                    {req ? <button className="btn small" onClick={() => social.accept(req).then(() => toast({ text: `You and @${p.username} are friends 🎉` })).catch((e) => toast({ err: true, text: niceError(e) }))}>Accept</button>
                      : pending ? <em className="sa-near-sent">Request sent</em>
                        : <button className="btn small" onClick={() => add(p)}>＋ Add friend</button>}
                  </div>
                );
              })}
            </div>
          )}
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
      <NearbyPeople social={social} state={state} toast={toast} />
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
function Messages({ social, state, chatWith, setChatWith, toast, go }) {
  const [openCard, cardEl] = useUserCard({ social, toast, go, setChatWith });
  const box = useRef(null);
  const [t, setT] = useState('');
  const [re, setRe] = useState(null);
  const input = useRef(null);
  const friends = state.friends;
  const sel = chatWith === 'all' ? 'all' : (friends.find((f) => f.uid === chatWith) || friends[0] || {}).uid || 'all';
  const inThread = (m, id) => (id === 'all'
    ? m.kind === 'say'
    : m.kind !== 'say' && (m.mine ? m.to === id : m.from === id));
  const thread = state.messages.filter((m) => inThread(m, sel));
  const lastOf = (id) => { const l = state.messages.filter((m) => inThread(m, id)); return l[l.length - 1]; };
  const friend = friends.find((f) => f.uid === sel);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [thread.length, sel]);
  useEffect(() => { setRe(null); }, [sel]);
  const replyTo = (m) => { setRe({ n: m.mine ? state.profile.username : m.fromName, t: m.text }); if (input.current) input.current.focus(); };
  const send = async (e) => {
    e.preventDefault();
    const v = t.trim();
    if (!v) return;
    setT(''); setRe(null);
    if (sel === 'all') await social.say(v).catch(() => {});
    else await social.send(sel, 'whisper', v, re).catch(() => {});
  };
  const bubble = (m) => {
    const text = m.text || `${EMOTES[m.kind] || ''} ${m.mine ? 'you sent ' + (m.kind === 'hug' ? 'a cuddle' : m.kind) : EMOTE_TEXT[m.kind] || m.kind}`;
    return (
      <div key={m.id} className={'sa-m' + (m.mine ? ' mine' : '') + (m.text ? '' : ' act')}>
        <small>{m.mine ? 'You' : <Who uid={m.from} name={m.fromName} onOpen={openCard} />} · {ago(m.at)}{sel !== 'all' && m.text && <ReplyBtn onClick={() => replyTo(m)} />}</small>
        <p><Quote re={m.re} mine={m.mine} />{text}</p>
        {/* reactions: on messages a friend sent you, and theirs shows on yours */}
        {!m.mine && m.direct && String(m.id).startsWith('i_') && <ChatReact mine={m.myRx || ''} counts={m.myRx ? { [m.myRx]: 1 } : {}} onPick={(k) => social.reactMsg(m.id, k).catch(() => {})} />}
        {m.mine && m.theirRx && <span className="rx-chat right"><ChatReactSummary k={m.theirRx} /></span>}
      </div>
    );
  };
  return (
    <div className="sa-page">
      {cardEl}
      <h2>Messages <small className="sa-ttl">🔒 private · disappear after 30 min</small></h2>
      <div className="sa-chat">
        <div className="sa-threads">
          {friends.map((f) => {
            const l = lastOf(f.uid);
            return (
              <button key={f.uid} className={sel === f.uid ? 'on' : ''} onClick={() => setChatWith(f.uid)}>
                <Avatar skin={f.skin} who={f} size={36} />
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
            <>
            <ReplyBar re={re} onClose={() => setRe(null)} />
            <form className="sa-saybar sa-chatbar" onSubmit={send}>
              <input ref={input} value={t} maxLength={MAX_TEXT} onKeyDown={(e) => { if (e.key === 'Escape') setRe(null); }} placeholder={sel === 'all' ? 'Message all friends' : `Message @${friend ? friend.username : ''}`} onChange={(e) => { setT(e.target.value); social.setTyping(!!e.target.value, sel === 'all' ? '' : sel).catch(() => {}); }} onBlur={() => social.setTyping(false).catch(() => {})} />
              <em>{MAX_TEXT - t.length}</em>
              <button className="btn small" disabled={!t.trim()}>Send</button>
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function ChatReactSummary({ k }) { return <span className="rx-sum"><span><Emo k={k} size={18} /></span></span>; }

// extra desktop pets: an animal (natural colours) or a special character
const localPetValue = (p) => (p.style && p.style.sp ? 'sp:' + p.style.sp : CHARACTERS.some((c) => c.group === 'anime' && c.key === p.skin) ? 'ch:' + p.skin : 'sp:');
const applyLocalPet = (p, v) => {
  const [kind, key] = v.split(':');
  if (kind === 'ch') return { ...p, skin: key, tint: '', style: { sp: '', of: '', oc: '', sk: '' } };
  return { ...p, skin: 'mint', tint: key ? 'nat' : '', style: { sp: key, of: '', oc: '', sk: '' } };
};

function ExtraPets({ state, desktop, local }) {
  const ownedItems = (state.wallet && state.wallet.owned) || [];
  const pets = (local && local.settings.pets) || [];
  const [sel, setSel] = useState(1);
  const extra = pets.slice(1);
  const cur = pets[sel] ? sel : 0;
  return (
    <div className="sa-card">
      <h3>Extra pets on this PC <small>{extra.length} of 7</small></h3>
      <p className="sa-sub">Your own pet is set up in <b>Customize</b> and follows you everywhere. These extra pets only live on this computer.</p>
      <div className="sa-localpets">
        {extra.map((p, j) => (
          <button key={p.id || j} className={'sa-lp' + (cur === j + 1 ? ' on' : '')} onClick={() => setSel(j + 1)}>
            <Avatar skin={p.skin} who={p} size={58} /><span>{p.name}</span>
          </button>
        ))}
        {pets.length < 8 && <button className="sa-lp add" onClick={() => desktop.addPet()}>＋<span>Add pet</span></button>}
      </div>
      {cur > 0 && pets[cur] && (
        <div className="sa-lp-edit">
          <label className="sa-inline">Name <input key={pets[cur].id} defaultValue={pets[cur].name} maxLength={20} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pets[cur].name) desktop.setLocal({ pets: pets.map((p, i) => (i === cur ? { ...p, name: v } : p)) }); }} /></label>
          <select aria-label="Pet" value={localPetValue(pets[cur])} onChange={(e) => desktop.setLocal({ pets: pets.map((p, i) => (i === cur ? applyLocalPet(p, e.target.value) : p)) })}>
            <optgroup label="Animals">{SHOP_SPECIES.filter((x) => owns(ownedItems, 'sp', x.key)).map((x) => <option key={x.key || 'nibble'} value={'sp:' + x.key}>{x.emoji} {x.label}</option>)}</optgroup>
            <optgroup label="Special characters">{CHARACTERS.filter((c) => c.group === 'anime').map((c) => <option key={c.key} value={'ch:' + c.key}>{c.name} · {c.role}</option>)}</optgroup>
          </select>
          <button className="btn small ghost" onClick={() => desktop.command({ type: 'special', pet: cur })}>Special move</button>
          <button className="btn small ghost" onClick={() => { desktop.removePet(cur); setSel(1); }}>Send home</button>
        </div>
      )}
      <h4 className="wd-h" style={{ marginTop: 16 }}>🎭 Make them interact</h4>
      <p className="sa-sub" style={{ marginTop: 0 }}>Needs two pets close together (yours, an extra one, or a friend’s visiting). If they fight, click <b>🍦 Give them ice cream</b>.</p>
      <div className="sa-interact">{INTERACT.map(([k, l]) => <button key={k} className="btn small ghost" onClick={() => desktop.command({ type: 'drama', kind: k })}>{l}</button>)}</div>
    </div>
  );
}

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
function Settings({ social, state, desktop, local, toast, go }) {
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
      <DockSettings />
      {desktop && local && <ExtraPets state={state} desktop={desktop} local={local} />}
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
          <Toggle label={desktop.platform === 'darwin' ? 'Open Nibble when I log in' : 'Start with Windows'} on={s.startWithWindows} onChange={(v) => set({ startWithWindows: v })} />
          <Toggle label="Hide pets" hint={desktop.platform === 'darwin' ? '⌘ + ⌥ + N' : 'Ctrl + Alt + N'} on={s.paused} onChange={(v) => set({ paused: v })} />
        </div>
      )}
      <div className="sa-card">
        <h3>🐛 Something not working?</h3>
        <p className="sa-sub">Report a bug or send an idea. Your version and system are included for you.</p>
        <button className="btn small" onClick={() => go && go('feedback')}>Report a bug or send feedback</button>
      </div>
      <NewsletterCard social={social} toast={toast} />
      <div className="sa-card">
        <h3>Account</h3>
        <p className="sa-sub">@{state.profile.username} · {state.user.email || 'signed in'} · {state.user.provider === 'google.com' ? 'Google' : state.user.provider === 'apple.com' ? 'Apple' : 'Email'}</p>
        <button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button>
      </div>
      <DeleteAccount social={social} state={state} toast={toast} />
      {desktop && local && (
        <div className="sa-card">
          <h3>Nibble {local.version}</h3>
          {local.health && !local.store && (
            <p className="sa-sub">
              {local.health.name === 'fixing' ? '🔧 Giving the app its Nibble name and icon… it restarts by itself in a moment.'
                : local.health.name === 'failed' ? '⚠️ Windows still shows this app as “Electron”. Click Reinstall / update below to fix it.'
                : '✓ App name and icon: Nibble'}
              {local.health.files && local.health.files.startsWith('repaired') ? ' · ✓ Missing pet files were added (outfits and animals show now)' : ''}
            </p>
          )}
          {local.store ? (
            <>
              <p className="sa-sub">Updates come from the {local.store === 'mas' ? 'Mac App Store' : 'Microsoft Store'} and keep your pets and settings.</p>
              <button className="btn small" onClick={() => desktop.update()}>Check for updates</button>
            </>
          ) : (
            <>
              <p className="sa-sub">{local.latest ? `Version ${local.latest} is available.` : 'Updates install over the top and keep your pets and settings.'}</p>
              <button className="btn small" onClick={() => desktop.update()}>{local.latest ? `Update to ${local.latest}` : 'Reinstall / update'}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Settings card: delete your account for good (Apple and Google Play require this inside the app)
function DeleteAccount({ social, state, toast }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const premium = social.premium && social.premium.active() && state.premium && state.premium.source === 'stripe';
  const go = async () => {
    setBusy(true); setErr('');
    try { await social.deleteAccount(); toast({ text: 'Your account was deleted. Bye for now 👋' }); }
    catch (e) { setErr(niceError(e)); }
    setBusy(false);
  };
  return (
    <div className="sa-card">
      <h3>Delete account</h3>
      {!open ? (
        <>
          <p className="sa-sub">Removes your account, profile, friends, messages, points, looks, groups you own and your Tea Room posts. This can’t be undone.</p>
          <button className="btn small ghost danger" onClick={() => setOpen(true)}>Delete my account…</button>
        </>
      ) : (
        <>
          <p className="sa-sub"><b>This deletes @{state.profile.username} for good.</b>{premium ? ' Your Premium subscription is cancelled straight away, with no more charges.' : ''} Type <b>DELETE</b> to confirm.</p>
          <form className="sa-inline" onSubmit={(e) => { e.preventDefault(); if (typed.trim().toUpperCase() === 'DELETE') go(); }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoCapitalize="characters" aria-label="Type DELETE to confirm" />
            <button className="btn small danger" disabled={busy || typed.trim().toUpperCase() !== 'DELETE'}>{busy ? 'Deleting…' : 'Delete for good'}</button>
            <button type="button" className="btn small ghost" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setErr(''); }}>Keep my account</button>
          </form>
          {err && <p className="sa-msg err">{err}</p>}
        </>
      )}
    </div>
  );
}

// ---------- Nibble Premium ----------
// a few harmless facts about this device, sent with a checkout as extra fraud-check context
function deviceInfo() {
  try {
    return { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', lang: (navigator.languages || [navigator.language]).slice(0, 3).join(','), screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}` };
  } catch { return {}; }
}
function PremiumPage({ social, state, toast, desktop, mobile }) {
  const plan = state.premiumPlan;
  const prem = state.premium;
  const active = social.premium.active();
  const [busy, setBusy] = useState('');
  const [waiting, setWaiting] = useState(false);
  const options = plan ? buyable(plan) : [];
  const [pick, setPick] = useState('');
  const chosen = options.find((k) => k.id === pick) || options[0];
  // after paying, Stripe tells our server in a few seconds; check a few times so Premium shows up
  const check = async (quiet, sessionId) => {
    try { await social.premium.refresh(sessionId); } catch (e) { if (!quiet) toast({ err: true, text: niceError(e) }); }
  };
  useEffect(() => {
    const ret = window.__nibblePremiumReturn; window.__nibblePremiumReturn = '';
    const sid = window.__nibblePremiumSession || ''; window.__nibblePremiumSession = '';
    if (ret === 'cancel') toast({ text: 'No problem: nothing was charged.' });
    if (ret === 'success') {
      setWaiting(true);
      let n = 0;
      const t = setInterval(() => { n++; check(true); if (n >= 6) { clearInterval(t); setWaiting(false); } }, 4000);
      check(true, sid);
      return () => clearInterval(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (active && waiting) { setWaiting(false); toast({ text: 'Welcome to Premium ⭐ Thank you!' }); } }, [active, waiting]); // eslint-disable-line react-hooks/exhaustive-deps
  // desktop: you pay in the browser, then come back: re-check when the Hub is shown again
  useEffect(() => {
    if (!desktop || active) return;
    const on = () => { if (!window.__nibbleHidden) check(true); };
    window.addEventListener('nibble-visibility', on);
    return () => window.removeEventListener('nibble-visibility', on);
  }, [desktop, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async (kind) => {
    setBusy(kind);
    try {
      const url = kind === 'buy' ? await social.premium.checkout(chosen && chosen.id, deviceInfo()) : await social.premium.portal();
      if (!/^https:\/\/(checkout|billing)\.stripe\.com\//.test(url)) throw new Error('Unexpected payment link.');
      if (desktop) { window.open(url, '_blank'); toast({ text: 'Finish in your browser, then come back here.' }); }
      else location.href = url;
    } catch (e) { toast({ err: true, text: niceError(e) }); }
    setBusy('');
  };
  const feats = ((plan && plan.features) || []).filter((f) => f.on !== false);
  const until = prem && prem.until ? new Date(prem.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <div className="sa-page">
      <div className="sa-premium-hero">
        <div>
          <h2>✦ {plan ? plan.name : 'Nibble Premium'}</h2>
          <p className="sa-sub">{active ? 'You’re Premium. Thank you for supporting Nibble 💖' : 'A few extra treats for you and your pet, and you help keep Nibble free and ad-free for everyone.'}</p>
        </div>
        {plan && <div className="sa-premium-price"><b>{priceLabel(plan)}</b><small>cancel any time</small></div>}
      </div>
      <div className="sa-premium-grid">
        {feats.map((f) => (
          <div key={f.id} className="sa-premium-feat"><span>{f.icon}</span><b>{f.title}</b><small>{f.desc || (PREMIUM_PERKS[f.key] && PREMIUM_PERKS[f.key].desc)}</small></div>
        ))}
      </div>
      <div className="sa-card">
        {active ? (
          <>
            <h3>⭐ Premium is on</h3>
            {prem.action === 'confirm_payment' && <p className="sa-sub" style={{ color: 'var(--coral, #ff7a7a)' }}>Your bank wants you to confirm the last payment. Open “Manage subscription” to confirm it and keep Premium.</p>}
            <p className="sa-sub">{prem.source === 'admin' ? `Gifted by the Nibble team until ${until}.` : prem.cancelAtEnd ? `Ends on ${until}. You won’t be charged again.` : `Renews on ${until}.`}{prem.status === 'past_due' ? ' Your last payment didn’t go through: update your card to keep Premium.' : ''}</p>
            {prem.source !== 'admin' && !mobile && <button className="btn small" disabled={!!busy} onClick={() => go('manage')}>{busy === 'manage' ? 'Opening…' : 'Manage subscription'}</button>}
          </>
        ) : mobile ? (
          // Apple and Google only allow their own in-app payments, so the phone app sells nothing
          <p className="sa-empty">Premium isn’t available in the app.</p>
        ) : plan && plan.enabled && chosen ? (
          <>
            <h3>Get Premium</h3>
            {options.length > 1 && (
              <div className="sa-pkgs" role="radiogroup" aria-label="Choose a plan">
                {options.map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={chosen.id === k.id} className={'sa-pkg' + (chosen.id === k.id ? ' on' : '')} onClick={() => setPick(k.id)}>
                    {k.highlight && <em>{k.highlight}</em>}
                    <b>{k.name}</b>
                    <span>{fmtMoney(k.amount, k.currency)} <small>/ {k.interval}</small></span>
                    {k.trialDays > 0 && <small>{k.trialDays}-day free trial</small>}
                  </button>
                ))}
              </div>
            )}
            <p className="sa-sub">Secure payment by Stripe. Card, Apple Pay and Google Pay where available.</p>
            <p className="ad-foot sa-disclose">
              {chosen.trialDays > 0 && !prem ? `Free for ${chosen.trialDays} days, then ` : ''}{fmtMoney(chosen.amount, chosen.currency)} every {chosen.interval}. Renews automatically until you cancel; cancel any time here (Manage subscription). Full refund within {REFUND_DAYS} days of any payment. Sold by {SELLER.name}.{' '}
              <a href="/pricing" target="_blank" rel="noreferrer">Pricing</a> · <a href="/refunds" target="_blank" rel="noreferrer">Refund policy</a> · <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
            </p>
            <button className="btn" disabled={!!busy || waiting} onClick={() => go('buy')}>{waiting ? 'Confirming your payment…' : busy === 'buy' ? 'Opening Stripe…' : chosen.trialDays > 0 && !prem ? `Start ${chosen.trialDays}-day free trial` : `Get Premium · ${fmtMoney(chosen.amount, chosen.currency)} / ${chosen.interval}`}</button>
            {(desktop || waiting) && <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={() => check(false)}>I’ve paid: check again</button>}
          </>
        ) : <p className="sa-empty">Premium isn’t available right now. Check back soon!</p>}
        {prem && !active && prem.source === 'stripe' && !mobile && <p className="ad-foot">Your Premium ended{until ? ' on ' + until : ''}. Get it again any time.</p>}
      </div>
    </div>
  );
}

// Settings card: opt in to Nibble news by email (Resend list; unsubscribe link in every email)
function NewsletterCard({ social, toast }) {
  const [st, setSt] = useState(null); // null = loading, { ready, subscribed, email } or { err }
  useEffect(() => {
    let dead = false;
    social.newsletter.status().then((r) => { if (!dead) setSt(r); }).catch(() => { if (!dead) setSt({ err: true }); });
    return () => { dead = true; };
  }, [social]);
  if (!st || st.err || st.ready === false) return null; // hidden until marketing is set up (and in local test mode)
  const flip = async (on) => {
    const prev = st;
    setSt({ ...st, subscribed: on });
    try { await social.newsletter.set(on); toast({ text: on ? 'You’ll get Nibble news by email 💌' : 'No more news emails' }); }
    catch (e) { setSt(prev); toast({ err: true, text: niceError(e) }); }
  };
  return (
    <div className="sa-card">
      <h3>💌 Nibble news</h3>
      <Toggle label="Email me news and updates" hint={`New pets, features and releases, a few times a month at most. Sent to ${st.email}.`} on={!!st.subscribed} onChange={flip} />
    </div>
  );
}

// Settings card: how the music mini player in the corner behaves (saved on this device)
function DockSettings() {
  const [p, setP] = useState({ mode: 'video', games: true });
  useEffect(() => {
    setP(readDock());
    const on = (e) => setP(e.detail || readDock());
    window.addEventListener('nibble-dock', on);
    return () => window.removeEventListener('nibble-dock', on);
  }, []);
  const save = (n) => { setP(n); saveDock(n); };
  return (
    <div className="sa-card">
      <h3>Music mini player</h3>
      <p className="sa-sub">The player in the bottom-right corner while you’re in a music room. Music keeps playing whichever you pick.</p>
      <div className="sa-seg">Show {[['video', 'Video'], ['bar', 'Just controls'], ['tiny', 'Small button']].map(([v, l]) => <button key={v} className={p.mode === v ? 'on' : ''} onClick={() => save({ ...p, mode: v })}>{l}</button>)}</div>
      <Toggle label="Tuck it away during games" hint="Shrinks to a small 🎧 button on the Games tab" on={p.games} onChange={(v) => save({ ...p, games: v })} />
    </div>
  );
}

// ---------- Shared reminders: rings at the time, for you and the friends you add ----------
const REM_QUICK = [
  ['In 30 min', () => Date.now() + 30 * 60_000], ['In 1 hour', () => Date.now() + 3600_000], ['Today 4 PM', () => atDay(0, 16)],
  ['Today 7 PM', () => atDay(0, 19)], ['Today 9 PM', () => atDay(0, 21)], ['Tomorrow 10 AM', () => atDay(1, 10)],
];
function SharedReminders({ social, state, toast }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(atDay(0, 19) > Date.now() + 60_000 ? atDay(0, 19) : atDay(1, 19)));
  const [who, setWho] = useState([]);
  const [busy, setBusy] = useState(false);
  const me = state.user.uid;
  const list = (state.reminders || []).filter((r) => r.at > Date.now() - 30 * 60_000);
  const flip = (uid) => setWho((w) => (w.includes(uid) ? w.filter((x) => x !== uid) : w.length >= 10 ? w : [...w, uid]));
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await social.reminders.add(title, new Date(when).getTime(), who);
      toast({ text: who.length ? `Reminder set for you and ${who.length} friend${who.length > 1 ? 's' : ''} 🔔` : 'Reminder set 🔔' });
      setTitle(''); setWho([]);
    } catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  const nameOf = (r, uid) => (uid === me ? 'you' : '@' + (r.names[uid] || (state.friends.find((f) => f.uid === uid) || {}).username || 'friend'));
  return (
    <>
      <div className="sa-card">
        <h3>🔔 Add a reminder</h3>
        <form className="sa-form" onSubmit={add}>
          <label><span>What’s happening?</span><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner 🍕, Study session, Movie night" /></label>
          <label><span>When?</span><input type="datetime-local" value={when} min={toLocalInput(Date.now() + 60_000)} onChange={(e) => setWhen(e.target.value)} /></label>
          <div className="sa-quick">{REM_QUICK.map(([l, f]) => { const t = f(); return t > Date.now() + 60_000 ? <button type="button" key={l} className={toLocalInput(t) === when ? 'on' : ''} onClick={() => setWhen(toLocalInput(t))}>{l}</button> : null; })}</div>
          <div className="sa-rem-who">
            <span>Remind friends too <small>optional, up to 10</small></span>
            {state.friends.length === 0 ? <small className="sa-sub">Add friends to share reminders with them.</small> : (
              <div className="sa-quick">{state.friends.map((f) => <button type="button" key={f.uid} className={who.includes(f.uid) ? 'on' : ''} onClick={() => flip(f.uid)}>@{f.username}</button>)}</div>
            )}
          </div>
          <button className="btn" disabled={!title.trim() || !when || busy}>{busy ? 'Adding…' : who.length ? `Remind me + ${who.length}` : 'Add reminder'}</button>
        </form>
      </div>
      <div className="sa-card">
        <h3>Upcoming reminders <small>{list.length}</small></h3>
        {list.length === 0 && <p className="sa-empty">No reminders yet.</p>}
        {list.map((r) => {
          const past = r.at <= Date.now();
          return (
            <div key={r.id} className={'sa-dl sa-rem' + (past ? ' done' : '')}>
              <span className="sa-rem-bell" aria-hidden>{past ? '✓' : '🔔'}</span>
              <div className="sa-dl-main">
                <b>{r.title}</b>
                <small>{fmtDue(r.at)} · {past ? 'rang' : dueLeft(r.at).txt}{r.owner !== me ? ` · from @${r.ownerName}` : ''}</small>
                {r.people.length > 1 && <span className="sa-rem-people">{r.people.map((u) => <i key={u}>{nameOf(r, u)}</i>)}</span>}
              </div>
              <button className="sa-x" onClick={() => social.reminders.remove(r.id).catch((x) => toast({ err: true, text: niceError(x) }))} title={r.owner === me ? 'Delete for everyone' : 'Remove from my list'}>✕</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Feedback: report a bug or tell us what you think (reports/{id}) ----------
// Home: after a couple of days with Nibble, ask once (dismissible) for a review
function AskReview({ state, go }) {
  const [gone, setGone] = useState(true);
  useEffect(() => { try { setGone(localStorage.getItem('nibble-ask-review') === '1'); } catch { setGone(false); } }, []);
  const since = state.profile && state.profile.createdAt ? (typeof state.profile.createdAt === 'number' ? state.profile.createdAt : state.profile.createdAt.toMillis ? state.profile.createdAt.toMillis() : 0) : 0;
  if (gone || state.myReview !== null || !since || Date.now() - since < 2 * 86400_000) return null;
  const close = () => { try { localStorage.setItem('nibble-ask-review', '1'); } catch {} setGone(true); };
  return (
    <div className="sa-card sa-tip">
      <span className="sa-tip-ico">⭐</span>
      <div><b>Enjoying Nibble?</b><p className="sa-sub">A quick review helps other people find and trust Nibble.</p></div>
      <button className="btn small" onClick={() => { close(); go('feedback'); }}>Rate Nibble</button>
      <button className="btn small ghost" onClick={close} aria-label="Not now">Not now</button>
    </div>
  );
}

// ---------- Rate Nibble: one review per account, public after an admin approves it ----------
function Stars({ value, onChange, size = 26 }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="sa-stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={(hover || value) >= n ? 'on' : ''} style={{ fontSize: size }} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>★</button>
      ) : <i key={n} className={value >= n ? 'on' : ''} style={{ fontSize: size }}>★</i>)}
    </span>
  );
}
const REVIEW_STATUS = { pending: ['⏳ Waiting for a quick check by the team', 'pending'], approved: ['✓ Live on meetnibble.com', 'ok'], hidden: ['Not shown on the website', 'off'] };
function ReviewCard({ social, state, toast, desktop }) {
  const mine = state.myReview;
  const [edit, setEdit] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const open = () => { setRating(mine ? mine.rating : 0); setText(mine ? mine.text : ''); setShow(mine ? mine.show : true); setEdit(true); };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await social.reviews.save({ rating, text, show }, desktop ? 'desktop' : 'web'); setEdit(false); toast({ text: 'Thank you! 💖 Your review shows up once the team has had a quick look.' }); }
    catch (x) { toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  if (mine === undefined) return null;
  if (mine && !edit) {
    const [label, cls] = REVIEW_STATUS[mine.status] || REVIEW_STATUS.pending;
    return (
      <div className="sa-card sa-review">
        <h3>⭐ Your review <small className={'sa-rv-st ' + cls}>{label}</small></h3>
        <Stars value={mine.rating} size={22} />
        <p className="sa-rv-text">“{mine.text}”</p>
        {mine.reply && <p className="sa-rv-reply"><b>Nibble team:</b> {mine.reply}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn small" onClick={open}>Edit</button>
          <button className="btn small ghost" onClick={async () => { if (window.confirm('Delete your review?')) { try { await social.reviews.remove(); toast({ text: 'Review deleted' }); } catch (x) { toast({ err: true, text: niceError(x) }); } } }}>Delete</button>
        </div>
      </div>
    );
  }
  if (!edit) {
    return (
      <div className="sa-card sa-review">
        <h3>⭐ Enjoying Nibble?</h3>
        <p className="sa-sub">A short review helps other people decide to try Nibble. It takes 30 seconds.</p>
        <button className="btn small" onClick={open}>Write a review</button>
      </div>
    );
  }
  return (
    <form className="sa-card sa-review sa-form" onSubmit={save}>
      <h3>⭐ {mine ? 'Edit your review' : 'Rate Nibble'}</h3>
      <Stars value={rating} onChange={setRating} size={32} />
      <label><span>What do you like (or not)? <small>{text.length}/{MAX_REVIEW}</small></span>
        <textarea rows={4} value={text} maxLength={MAX_REVIEW} onChange={(e) => setText(e.target.value)} placeholder="My pet naps on my code editor and it makes long days better…" /></label>
      <label className="sa-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show it on meetnibble.com with my username @{state.profile.username}</label>
      <p className="ad-foot">The team checks reviews before they go public (no changes to your words). Editing sends it for a quick check again.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy || !rating || text.trim().length < MIN_REVIEW}>{busy ? 'Sending…' : mine ? 'Save' : 'Post review'}</button>
        <button type="button" className="btn ghost" onClick={() => setEdit(false)}>Cancel</button>
      </div>
    </form>
  );
}

function FeedbackPage({ social, state, desktop, local, toast }) {
  const meta = {
    ver: (local && local.version) || '',
    os: systemName(desktop && desktop.platform),
    client: desktop ? 'desktop' : 'web',
  };
  return (
    <div className="sa-page">
      <h2>Feedback</h2>
      <ReviewCard social={social} state={state} toast={toast} desktop={desktop} />
      <p className="sa-sub">Found a bug, or have an idea? It goes straight to the Nibble team. Your Nibble version, system and the time are added for you.</p>
      <div className="sa-card"><FeedbackForm meta={meta} send={(r) => social.report(r)} signedInAs={state.profile.username} /></div>
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
      <h2>Deadlines &amp; reminders</h2>
      <p className="sa-sub sa-dl-intro"><b>Deadline:</b> something you have to finish by a time. Your pet warns you a day before and 3 hours before. <b>Reminder:</b> something happening at a time, like dinner or a study session. It rings right then, for you and any friends you add.</p>
      <SharedReminders social={social} state={state} toast={toast} />
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
        <div className="sa-prof-pet"><PetFigure skin={state.profile.skin} mood="happy" acc={state.profile.acc} tint={state.profile.tint} makeup={state.profile.makeup} look={state.profile.style} w={120} h={116} size={1.05} /></div>
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

// people who joined before the sign-up questions: ask once on Home (dismissable, never again after)
function AskSignup({ social, state, toast }) {
  const key = 'nibble-signup-' + state.user.uid;
  const [show, setShow] = useState(false);
  const [sq, setSq] = useState({ source: '', sourceOther: '', country: '', uses: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let done = false; try { done = !!localStorage.getItem(key); } catch {}
    const created = state.profile && state.profile.createdAt;
    const ms = created ? (created.toMillis ? created.toMillis() : Number(created.seconds ? created.seconds * 1000 : created)) : 0;
    if (!done && (!ms || Date.now() - ms > 10 * 60_000)) { setShow(true); setSq((x) => ({ ...x, country: guessCountry() })); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  const close = () => { try { localStorage.setItem(key, 'skip'); } catch {} setShow(false); };
  const save = async () => {
    setBusy(true);
    try { await social.saveSignup(sq); toast({ text: 'Thanks! 🐾' }); setShow(false); }
    catch (x) { if (x && x.code === 'permission-denied') { try { localStorage.setItem(key, '1'); } catch {} setShow(false); } else toast({ err: true, text: niceError(x) }); }
    setBusy(false);
  };
  return (
    <div className="sa-card sa-ask">
      <button className="sa-x" onClick={close} title="Not now" aria-label="Not now">✕</button>
      <p className="sa-sub" style={{ marginTop: 0 }}>Quick question, then we won't ask again. It helps us know where to share Nibble.</p>
      <SignupQuestions value={sq} onChange={setSq} compact />
      <button className="btn small" disabled={!sq.source || !sq.country || busy} onClick={save}>{busy ? 'Saving…' : 'Send'}</button>
    </div>
  );
}

function Home({ social, state, desktop, local, toast, go, chatWith, setChatWith }) {
  const online = state.friends.filter((f) => f.online);
  const last = state.messages.filter((m) => !m.mine).slice(-3).reverse();
  return (
    <div className="sa-page">
      <h2>Hey {(state.about && state.about.nick) || '@' + state.profile.username} 👋</h2>
      <AskSignup social={social} state={state} toast={toast} />
      <AskReview state={state} go={go} />
      {!state.about && (
        <div className="sa-card sa-tip">
          <span className="sa-tip-ico">💭</span>
          <div><b>New: tell your pet about you</b><p className="sa-sub">What you do, what you're into and what you're working on — your pet's thoughts will fit your day instead of repeating random jokes.</p></div>
          <button className="btn small" onClick={() => go('profile')}>Set up</button>
        </div>
      )}
      <div className="sa-homeq">
        <button className="sa-q q-pts" onClick={() => go('games')}>
          <span className="sa-q-ico">{PT}</span>
          <span><b>{state.wallet && state.wallet.ready ? state.wallet.points : '…'} points</b><small>{state.wallet && state.wallet.canDaily ? '🎁 Daily bonus waiting' : 'Play games to earn more'}</small></span>
        </button>
        <button className="sa-q q-games" onClick={() => go('games')}>
          <span className="sa-q-ico">🎮</span>
          <span><b>{myTurns(state) ? `${myTurns(state)} game${myTurns(state) > 1 ? 's' : ''} waiting` : 'Mini games'}</b><small>{myTurns(state) ? 'A friend is waiting on your move' : '12 solo games + play with friends'}</small></span>
        </button>
        <button className="sa-q q-board" onClick={() => go('board')}>
          <span className="sa-q-ico">🏆</span>
          <span><b>Leaderboard</b><small>{state.wallet && state.wallet.ready ? `${PT} ${(state.wallet.total || 0).toLocaleString()} earned so far` : 'See who earned the most points'}</small></span>
        </button>
        <button className="sa-q q-style" onClick={() => go('style')}>
          <span className="sa-q-ico">✿</span>
          <span><b>Customize</b><small>12 animals, outfits in any colour</small></span>
        </button>
      </div>
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
          <Avatar skin={state.profile.skin} who={state.profile} size={84} mood="wave" />
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
          {state.lan && state.lan.people && state.lan.people.filter((p) => !state.friends.some((f) => f.uid === p.uid)).length > 0 && (
            <button className="sa-link" style={{ display: 'block', margin: '6px 0' }} onClick={() => go('friends')}>📶 {state.lan.people.filter((p) => !state.friends.some((f) => f.uid === p.uid)).length} Nibble user(s) on your network: say hi →</button>
          )}
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
// friend games waiting on you: invites to accept + your turn
// group invites + groups with unread chat
const signedInNow = (state) => !!(state.user && state.profile && !state.banned);
const groupBadge = (state) => (state.groupInvites || []).length + (state.groups || []).filter((g) => g.unreadChat).length;
const myTurns = (state) => (state.matches || []).filter((m) => (m.status === 'invite' && m.players[1] === state.user.uid) || (m.status === 'live' && m.turn === state.user.uid)).length;

function useDesktopBridge(desktop, social, state) {
  const [local, setLocal] = useState(null);
  // The Hub page stays open (hidden) for days, so it would keep running old code after a deploy.
  // Check for a new build every few minutes and reload while the Hub is hidden (or when it's next hidden).
  useEffect(() => {
    if (!desktop) return;
    const mine = process.env.NEXT_PUBLIC_BUILD || 'dev';
    if (mine === 'dev') return;
    let stale = false;
    const check = async () => {
      try {
        if (!stale) {
          const r = await fetch('/api/build', { cache: 'no-store' });
          const j = await r.json();
          stale = !!(j && j.build && j.build !== 'dev' && j.build !== mine);
        }
        // the Hub window reports show/hide (window.__nibbleHidden); never shown yet = hidden
        if (stale && window.__nibbleHidden !== false) location.reload();
      } catch (_) {}
    };
    const t = setInterval(check, 4 * 60_000);
    const vis = () => { if (window.__nibbleHidden) check(); };
    window.addEventListener('nibble-visibility', vis);
    const t0 = setTimeout(check, 20_000);
    return () => { clearInterval(t); clearTimeout(t0); window.removeEventListener('nibble-visibility', vis); };
  }, [desktop]);
  useEffect(() => {
    if (!desktop) return;
    desktop.getLocal().then(setLocal);
    return desktop.onLocal(setLocal);
  }, [desktop]);
  const localRef = useRef(local);
  localRef.current = local;
  // Pet #1 on this PC is you: it always wears your saved look, wherever you changed it
  // (the website, another PC, an admin reset). Sent once per look so a PC that lacks a skin can't loop.
  const lookSent = useRef(''), lookSentAt = useRef(0);
  useEffect(() => {
    const pr = state.profile;
    if (!desktop || !pr || !local || !local.settings || !Array.isArray(local.settings.pets) || !local.settings.pets.length) return;
    const want = { skin: pr.skin || 'mint', acc: Array.isArray(pr.acc) ? pr.acc.slice(0, 6) : [], tint: pr.tint || '', makeup: pr.makeup || '', style: cleanStyleMap(pr.style) };
    const p0 = local.settings.pets[0];
    const have = { skin: p0.skin || 'mint', acc: Array.isArray(p0.acc) ? p0.acc : [], tint: p0.tint || '', makeup: p0.makeup || '', style: cleanStyleMap(p0.style) };
    const w = JSON.stringify(want);
    // fixes drift too (e.g. a tray menu change), but never more than once every 15 s for the same look
    if (w === JSON.stringify(have) || (w === lookSent.current && Date.now() - lookSentAt.current < 15000)) return;
    lookSent.current = w; lookSentAt.current = Date.now();
    desktop.setLocal({ pets: local.settings.pets.map((p, i) => (i === 0 ? { ...p, ...want } : p)) });
  }, [desktop, local, state.profile]);
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
      me: { uid: state.user.uid, username: state.profile.username, skin: state.profile.skin, petName: state.profile.petName, acc: state.profile.acc || [], tint: state.profile.tint || '', makeup: state.profile.makeup || '', style: state.profile.style || null, about: state.about || null },
      prefs: state.prefs,
      // include each friend's look (accessories / colour / makeup) so their pet is dressed up on this desktop too
      friends: state.friends.map((f) => ({ uid: f.uid, username: f.username, skin: f.skin, petName: f.petName, acc: f.acc || [], tint: f.tint || '', makeup: f.makeup || '', style: f.style || null, online: f.online, typing: f.typing, dnd: f.dnd, status: f.status, np: f.np ? f.np.title : '' })),
      requests: state.incoming.length,
      // Listen Together: whose pets wear headphones and dance (you + everyone in your room right now)
      music: { ...(state.music && state.music.room ? { on: true, playing: !!state.music.room.playing && !!state.music.room.track, title: state.music.room.track ? state.music.room.track.title : '', members: state.music.room.present } : { on: false }), invites: ((state.music && state.music.invites) || []).map((i) => ({ host: i.host, name: i.fromName })) },
    } : { me: null, friends: [], prefs: {}, requests: 0 };
    const j = JSON.stringify(payload);
    if (j !== sent.current) { sent.current = j; desktop.sendSocial(payload); }
  }, [desktop, state]);
  // a music invite → Windows notification; clicking it joins the room
  const notifiedInv = useRef(new Set());
  useEffect(() => {
    if (!desktop || !desktop.notify) return;
    for (const i of (state.music && state.music.invites) || []) {
      const k = i.host + ':' + i.at;
      if (notifiedInv.current.has(k)) continue;
      notifiedInv.current.add(k);
      desktop.notify({ title: `@${i.fromName} invited you to listen together 🎧`, body: 'Click to join and hear the same song at the same moment.', tab: 'music', action: { type: 'music', cmd: 'join', host: i.host } });
    }
  }, [desktop, state.music && state.music.invites]);
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
        else if (a.cmd === 'next' && r && r.track) social.music.next(r.track.k, { skip: true }).catch(() => {});
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
  // nav bar: collapse to icons (your choice is remembered; otherwise it follows the window width)
  const [navPref, setNavPref] = useState(null); // null = auto, true = collapsed, false = open
  const [winW, setWinW] = useState(1200);
  useEffect(() => {
    try { const v = localStorage.getItem('nibble-nav-mini'); if (v === '1' || v === '0') setNavPref(v === '1'); } catch {}
    const on = () => setWinW(window.innerWidth);
    on(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const toggleNav = (v) => { setNavPref(v); try { localStorage.setItem('nibble-nav-mini', v ? '1' : '0'); } catch {} };
  const [note, setNote] = useState(null);
  const [desktop, setDesktop] = useState(null);
  // the Nibble phone app (Flutter WebView, lib/mobileBridge.js); null in browsers and on desktop
  const [mobile, setMobile] = useState(null);
  // "Waking up…" for more than 12 s: show what might be wrong
  const [slow, setSlow] = useState(false);
  const waking = !state.ready || (state.user && state.profile === undefined);
  useEffect(() => { if (!waking) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 12_000); return () => clearTimeout(t); }, [waking]);
  const [presetAdd, setPresetAdd] = useState('');
  const [chatWith, setChatWith] = useState('');
  const [teaFeed, setTeaFeed] = useState('');
  const openTea = (feed) => { setTeaFeed(feed); setTab('tea'); };
  useEffect(() => {
    if (window.nibbleDesktop) setDesktop(window.nibbleDesktop);
    const mob = getMobileBridge();
    // /m is only for inside the phone app (the app draws the menu); in a normal browser use /app
    if (!mob && mode === 'mobile') { location.replace('/app' + location.search); return; }
    if (mob) {
      setMobile(mob);
      mob.onTab((t) => { if (typeof t === 'string' && /^[a-z]{2,12}$/.test(t)) setTab(t === 'pets' ? 'settings' : t); });
      // phone app sent to the background → pause the little animated pets (battery)
      mob.onVisible((v) => { window.__nibbleHidden = !v; window.dispatchEvent(new Event('nibble-visibility')); });
    }
    const q = new URLSearchParams(location.search);
    if (q.get('add')) { setPresetAdd(q.get('add')); setTab('friends'); }
    const fixTab = (t) => (t === 'pets' ? 'settings' : t);
    if (q.get('tab')) setTab(fixTab(q.get('tab')));
    // back from Stripe: open the Premium page and tidy the address
    if (q.get('premium')) {
      setTab('premium');
      window.__nibblePremiumReturn = q.get('premium');
      window.__nibblePremiumSession = q.get('session_id') || '';
      try { window.history.replaceState(null, '', location.pathname); } catch {}
    }
    if (window.nibbleDesktop && window.nibbleDesktop.onTab) window.nibbleDesktop.onTab((t) => setTab(fixTab(t)));
    // desktop Hub hidden → pause every little animated pet on the page (saves CPU/GPU, less lag)
    if (window.nibbleDesktop && window.nibbleDesktop.onVisible) window.nibbleDesktop.onVisible((v) => { window.__nibbleHidden = !v; window.dispatchEvent(new Event('nibble-visibility')); });
  }, []);
  const local = useDesktopBridge(desktop, social, state);
  // phones: keep the open page's button visible in the swipeable menu row
  useEffect(() => {
    const t = setTimeout(() => { const b = document.querySelector('.sa.phone .sa-side nav button.on'); if (b && b.scrollIntoView) b.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 120);
    return () => clearTimeout(t);
  }, [tab, state.profile]);
  const toast = useMemo(() => (n) => setNote(n), []);
  const player = useRoomPlayer(social, state, toast);
  const isDesk = mode === 'desktop' || !!desktop;
  const isMob = !!mobile;
  const iosApp = !!(mobile && mobile.platform === 'ios');
  // notifications: the desktop app or the phone app (browsers don't get any)
  const notifier = desktop || mobile;

  // site-wide announcement from an admin: banner for everyone, Windows notification on desktop
  const bcId = state.broadcast && state.broadcast.id;
  const notified = useRef('');
  const [bcDismissed, setBcDismissed] = useState('');
  useEffect(() => { try { setBcDismissed(localStorage.getItem('nibble-bc-seen') || ''); } catch {} }, []);
  const bcLive = !!state.broadcast && !(state.broadcast.expiresAt && Date.now() > state.broadcast.expiresAt);
  useEffect(() => {
    if (!bcId || !bcLive || notified.current === bcId) return;
    notified.current = bcId;
    if (notifier && notifier.notify) notifier.notify({ title: state.broadcast.title || 'Nibble', body: state.broadcast.text });
  }, [bcId, bcLive, notifier]);
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

  // desktop: a notification when someone writes in one of your groups (only while you're not looking at Groups)
  const groupNotified = useRef({});
  useEffect(() => {
    for (const g of state.groups || []) {
      const was = groupNotified.current[g.id];
      groupNotified.current[g.id] = g.chatAt;
      if (was === undefined || !g.unreadChat || g.chatAt <= was) continue;
      if (notifier && notifier.notify && tab !== 'groups') notifier.notify({ title: `${g.emoji} ${g.name}`, body: g.mentionedMe ? `@${g.chatBy} mentioned you` : `@${g.chatBy} wrote in the group chat`, tab: 'groups' });
      if (g.mentionedMe && tab !== 'groups') toast({ text: `💬 @${g.chatBy} mentioned you in ${g.emoji} ${g.name}` });
    }
  }, [state.groups, notifier, tab]);

  // tell admins which app this is (desktop + version, or web)
  useEffect(() => {
    if (!social || !state.profile) return;
    if (isDesk) { if (local && local.version) social.setClient({ client: 'desktop', ver: local.version }); }
    else if (mobile) social.setClient({ client: mobile.platform, ver: mobile.appVersion });
    else social.setClient({ client: 'web' });
  }, [social, state.profile, isDesk, mobile, local && local.version]);

  // admin-set site notice (dismissable per notice text) and "update needed" for old desktop builds
  const cfg = state.config || {};
  const [noticeSeen, setNoticeSeen] = useState('');
  useEffect(() => { try { setNoticeSeen(localStorage.getItem('nibble-notice-seen') || ''); } catch {} }, []);
  const showNotice = !!cfg.notice && cfg.notice !== noticeSeen;
  const dismissNotice = () => { try { localStorage.setItem('nibble-notice-seen', cfg.notice); } catch {} setNoticeSeen(cfg.notice); };
  const [needHidden, setNeedHidden] = useState(false);
  const needUpdate = isDesk && local && local.version && cfg.minVersion && verLess(local.version, cfg.minVersion) && !needHidden;

  // pages in the menu. Phone app: Premium only shows once you have it (it can't be bought in the app:
  // Apple and Google only allow their own in-app payments), and the Tea Room is off on iPhone unless
  // an admin switches it on (anonymous posting is a common App Store rejection).
  const tcfg = teaConfig(cfg);
  const teaVisible = tcfg.on && (!iosApp || tcfg.ios);
  const premVisible = isMob ? social && social.premium && social.premium.active() : (state.premiumPlan && state.premiumPlan.enabled) || (social && social.premium && social.premium.active());
  const navItems = NAV.filter(([k]) => (k !== 'premium' || premVisible) && (k !== 'tea' || teaVisible));

  // phone app: native tab bar + "More" list, red badges, and notifications for new messages / requests
  const tabsKey = signedInNow(state) ? navItems.map(([k]) => k).join(',') : '';
  useEffect(() => {
    if (!mobile) return;
    if (!tabsKey) { mobile.setTabs([]); return; }
    mobile.setTabs(navItems.map(([k, l, i]) => ({ id: k, label: l, icon: i })));
  }, [mobile, tabsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mobile) mobile.setCurrent(tab); }, [mobile, tab]);
  const unreadMsgs = useRef({ seen: 0, n: 0 });
  const msgs = state.messages || [];
  useEffect(() => {
    if (!mobile || !signedInNow(state)) return;
    const theirs = msgs.filter((m) => !m.mine);
    const newest = theirs.length ? Math.max(...theirs.map((m) => m.at || 0)) : 0;
    const u = unreadMsgs.current;
    if (!u.seen) u.seen = newest || Date.now(); // don't notify for what was already there on start
    else if (tab !== 'messages') {
      const fresh = theirs.filter((m) => (m.at || 0) > u.seen);
      if (fresh.length) {
        const m = fresh[fresh.length - 1];
        mobile.notify({ title: '@' + (m.fromName || 'a friend'), body: m.text || (EMOTE_TEXT[m.kind] || 'sent you something'), tab: 'messages' });
        u.n += fresh.length;
      }
    }
    if (newest > u.seen) u.seen = newest;
    if (tab === 'messages') u.n = 0;
    mobile.setBadges({ friends: (state.incoming || []).length, messages: u.n, groups: groupBadge(state), music: state.music ? state.music.invites.length : 0 });
  }, [mobile, signedInNow(state), msgs.length, (state.incoming || []).length, state.groups, state.groupInvites, state.music && state.music.invites.length, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const reqSeen = useRef(-1);
  useEffect(() => {
    if (!mobile || !signedInNow(state)) return;
    const n = (state.incoming || []).length;
    if (reqSeen.current >= 0 && n > reqSeen.current) { const r = (state.incoming || [])[n - 1]; mobile.notify({ title: 'New friend request', body: `@${(r && (r.fromName || r.username)) || 'someone'} wants to be friends`, tab: 'friends' }); }
    reqSeen.current = n;
  }, [mobile, (state.incoming || []).length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mobile && state.ready && !state.user) mobile.signedOut(); }, [mobile, state.ready, state.user]);

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
    // never sit on "Waking up…" forever: after a while (or on an error) say why and offer a retry
    const why = state.loadError === 'resource-exhausted' ? 'Nibble’s server has used up today’s free limit. It resets at midnight Pacific time (about 1:30 PM in Sri Lanka). Your desktop pets keep working offline.'
      : state.loadError === 'permission-denied' ? 'The server didn’t let this account in. Try signing out and in again; if it keeps happening, tell us from the website’s contact form.'
      : state.loadError || slow ? 'This is taking longer than usual. Check your internet connection, or try again. Some work and school networks block Nibble’s server.' : '';
    body = (
      <div className="sa-center">
        <PetFigure skin="mint" mood="sleep" w={140} h={130} />
        <p className="sa-sub">{why || 'Waking up…'}</p>
        {why && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn small" onClick={() => location.reload()}>Try again</button>
            {state.user && <button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button>}
          </div>
        )}
      </div>
    );
  } else if (!state.user) body = <AuthScreen social={social} desktop={desktop || (mobile && { googleSignIn: mobile.googleSignIn, appleSignIn: mobile.appleSignIn, phone: true })} />;
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
    const props = { social, state, desktop, mobile, local, toast, go: setTab, chatWith, setChatWith, teaFeed, setTeaFeed, openTea };
    body = (
      <>
        {tab === 'home' && <Home {...props} />}
        {tab === 'profile' && <Profile {...props} />}
        {tab === 'deadlines' && <Deadlines {...props} />}
        {tab === 'friends' && <Friends {...props} presetAdd={presetAdd} />}
        {tab === 'messages' && <Messages {...props} />}
        {tab === 'groups' && <Groups {...props} />}
        {tab === 'tea' && teaVisible && <TeaRoom {...props} />}
        {tab === 'music' && <Music {...props} player={player} />}
        {tab === 'style' && <Wardrobe {...props} />}
        {tab === 'games' && <Arcade {...props} />}
        {tab === 'board' && <Leaderboard {...props} />}
        {tab === 'premium' && <PremiumPage {...props} />}
        {tab === 'settings' && <Settings {...props} />}
        {tab === 'feedback' && <FeedbackPage {...props} />}
      </>
    );
  }
  const signedIn = state.user && state.profile && !state.banned;

  const phone = !isDesk && winW <= 640;
  const mini = !phone && (navPref !== null ? navPref : winW < 1000);
  return (
    <div className={'sa' + (isDesk ? ' desk' : '') + (isMob ? ' mob' : '') + (signedIn ? '' : ' solo') + (signedIn && mini ? ' mini' : '') + (phone ? ' phone' : '')}>
      {signedIn && (
        <aside className="sa-side">
          <div className="sa-side-top">
            <a className="logo" href={isDesk ? undefined : '/'}><span className="sa-logo"><img src="/logo.svg" alt="" /></span><span className="sa-lt"> Nibble</span></a>
            {!phone && <button className="sa-collapse" onClick={() => toggleNav(!mini)} title={mini ? 'Open the menu' : 'Collapse the menu'} aria-label={mini ? 'Open the menu' : 'Collapse the menu'}>{mini ? '»' : '«'}</button>}
          </div>
          <div className="sa-me">
            <Avatar skin={state.profile.skin} who={state.profile} size={52} mood="happy" />
            <div><b>@{state.profile.username}{social.premium.perk('badge') && <span className="sa-prem" title="Nibble Premium">⭐</span>}</b><small><span className={'sa-dot' + (state.prefs.invisible ? '' : ' on') + (state.prefs.dnd ? ' dnd' : '')} />{state.prefs.invisible ? 'appearing offline' : state.prefs.dnd ? 'do not disturb' : 'online'}</small></div>
          </div>
          <button className="sa-pts" onClick={() => setTab('games')} title="Your points: earn them in Games, spend them in Customize">
            <span><Emo k="star" size={22} /></span><b>{state.wallet && state.wallet.ready ? state.wallet.points : '…'}</b><small>points</small>
            {state.wallet && state.wallet.canDaily && <em>🎁 bonus</em>}
          </button>
          <nav>
            {navItems.map(([k, l, i]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} title={mini ? l : undefined}>
                <span><Emo k={i} size={22} /></span><b className="sa-nl">{l}</b>
                {k === 'friends' && state.incoming.length > 0 && <em className="sa-badge">{state.incoming.length}</em>}
                {k === 'games' && myTurns(state) > 0 && <em className="sa-badge">{myTurns(state)}</em>}
                {k === 'groups' && groupBadge(state) > 0 && <em className="sa-badge">{groupBadge(state)}</em>}
                {k === 'tea' && (state.teaNew || (state.groups || []).some((g) => g.newTea)) && <em className="sa-badge" title="New tea">●</em>}
                {k === 'music' && state.music && state.music.invites.length > 0 && <em className="sa-badge">{state.music.invites.length}</em>}
                {k === 'music' && state.music && state.music.room && state.music.room.playing && <em className="sa-eq" aria-hidden><i /><i /><i /></em>}
              </button>
            ))}
          </nav>
          <div className="sa-side-foot">
            {state.admin && <a href="/admin" style={{ display: 'block', marginBottom: 6 }}>⚙️ Admin panel</a>}
            {isDesk ? `Nibble ${local?.version || ''}` : isMob ? `Nibble app ${mobile ? mobile.appVersion : ''}` : <a href="/download">Get the desktop app →</a>}
          </div>
        </aside>
      )}
      <main className="sa-main">
        {!signedIn && !isDesk && !isMob && <a className="sa-back" href="/">← nibble</a>}
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
        {signedIn && tab !== 'games' && (state.matches || []).filter((m) => m.status === 'invite' && m.players[1] === state.user.uid).slice(0, 1).map((m) => (
          <Banner key={m.id} level="party" title={`@${m.names[m.players[0]] || 'A friend'} challenged you to ${GAMES[m.game].label} ${GAMES[m.game].emoji}`} text="Play live, turn by turn. Winner gets 40 ⭐." onClose={() => social.games.decline(m.id)}>
            <button className="btn small" onClick={() => social.games.accept(m.id).then(() => setTab('games')).catch((e) => toast({ err: true, text: niceError(e) }))}>Play</button>
          </Banner>
        ))}
        {signedIn && tab !== 'groups' && (state.groupInvites || []).slice(0, 1).map((i) => (
          <Banner key={i.id} level="party" title={`@${i.names[i.owner] || 'A friend'} invited you to the group ${i.emoji} ${i.name}`} text="Join to chat together, share tea and walk your pets as a pack." onClose={() => social.groups.decline(i.id).catch(() => {})}>
            <button className="btn small" onClick={() => social.groups.accept(i.id).then(() => setTab('groups'), (e) => toast({ err: true, text: niceError(e) }))}>Join</button>
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
