'use client';
// Click a username (or an @mention) in a chat → a small profile card pops up next to it.
// No page change: pet, name, online/offline, points, and Message / Poke / Add friend.
import { useEffect, useRef, useState } from 'react';
import PetFigure from '../PetFigure';
import { niceError } from '../../lib/social/social';

export function useUserCard({ social, toast, go, setChatWith }) {
  const [card, setCard] = useState(null); // { uid, name, x, y, below }
  const open = (e, uid, name) => {
    if (!uid) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const below = r.top < 260;
    setCard({ uid, name, x: Math.max(12, Math.min(r.left, window.innerWidth - 272)), y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const el = card ? <UserCard key={card.uid + card.x + card.y} card={card} social={social} toast={toast} go={go} setChatWith={setChatWith} onClose={() => setCard(null)} /> : null;
  return [open, el];
}

// a clickable @name
export function Who({ uid, name, onOpen, className = '' }) {
  if (!uid) return <>@{name}</>;
  return <button type="button" className={'uc-who ' + className} onClick={(e) => onOpen(e, uid, name)}>@{name}</button>;
}

function UserCard({ card, social, toast, go, setChatWith, onClose }) {
  const [p, setP] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => { let on = true; social.profileOf(card.uid).then((x) => on && setP(x), () => on && setP(null)); return () => { on = false; }; }, [card.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const out = (e) => { if (box.current && !box.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => { document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc); }, 0);
    window.addEventListener('scroll', onClose, true);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', onClose, true); };
  }, [onClose]);
  const act = (fn, ok) => { setBusy(true); fn().then((r) => { if (ok) toast({ text: typeof ok === 'function' ? ok(r) : ok }); onClose(); }, (x) => { setBusy(false); toast({ err: true, text: niceError(x) }); }); };
  const style = { left: card.x, top: card.y, transform: card.below ? 'none' : 'translateY(-100%)' };
  return (
    <div className="uc" ref={box} style={style} role="dialog" aria-label={`@${card.name}`}>
      {p === undefined && <p className="uc-load">Loading @{card.name}…</p>}
      {p === null && <p className="uc-load">Couldn’t load @{card.name}.</p>}
      {p && (
        <>
          <div className="uc-top">
            <span className="uc-pet"><PetFigure skin={p.skin || 'mint'} mood={p.online === false ? 'sleep' : 'idle'} w={64} h={64} size={0.7} acc={p.acc} tint={p.tint} makeup={p.makeup} look={p.style} /></span>
            <div>
              <b>@{p.username}</b>
              {p.petName && <small>{p.petName}</small>}
              <span className={'uc-on' + (p.online ? ' on' : '')}>{p.me ? 'This is you' : p.friend ? (p.online ? 'Online' : 'Offline') : 'Not friends yet'}</span>
            </div>
          </div>
          {p.status && <p className="uc-status">“{p.status}”</p>}
          {p.total > 0 && <p className="uc-pts">⭐ {p.total.toLocaleString()} points earned</p>}
          {!p.me && (
            <div className="uc-acts">
              {p.friend ? (
                <>
                  <button className="btn small" disabled={busy} onClick={() => { setChatWith(p.uid); go('messages'); onClose(); }}>Message</button>
                  <button className="btn small ghost" disabled={busy} onClick={() => act(() => social.send(p.uid, 'poke'), `👉 Poked @${p.username}`)}>👉 Poke</button>
                  <button className="btn small ghost" disabled={busy} onClick={() => act(() => social.send(p.uid, 'hug'), `🤗 Sent @${p.username} a cuddle`)}>🤗</button>
                </>
              ) : p.requested ? (
                <button className="btn small ghost" disabled>Request sent</button>
              ) : (
                <button className="btn small" disabled={busy} onClick={() => act(() => social.addFriend(p.username), (r) => (r === 'accepted' ? `You and @${p.username} are friends now` : `Friend request sent to @${p.username}`))}>＋ Add friend</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
