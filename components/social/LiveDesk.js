'use client';
import { useEffect, useRef, useState } from 'react';
import { createStage } from '../../lib/stage';
import { loadNibble } from '../PetFigure';
import { EMOTES, EMOTE_SAY, MAX_TEXT } from '../../lib/social/social';

// The web version of your desktop: your pet + every online friend's pet, live.
// Hold your pet to talk to everyone, hold a friend's pet to whisper, double-click a friend to poke.
export default function LiveDesk({ social, state }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const stage = useRef(null);
  const pops = useRef([]);
  const live = useRef({ state, social });
  live.current = { state, social };
  const [compose, setCompose] = useState(null); // { pet, to, toName, x, y }
  const [text, setText] = useState('');
  const [pick, setPick] = useState(''); // who your own pet's message goes to: friend uid or 'all'
  const [ready, setReady] = useState(false);
  const visitors = useRef(new Map()); // uid -> until (ms): friends' pets that stay even when offline
  const [vtick, setVtick] = useState(0);
  const visit = (uid, secs) => { visitors.current.set(uid, Math.max(visitors.current.get(uid) || 0, Date.now() + secs * 1000)); setVtick((n) => n + 1); };

  useEffect(() => {
    let s, ro, dead = false;
    loadNibble().then(() => {
      if (dead) return;
      s = createStage({
        canvas: canvas.current,
        getWins: () => [],
        hooks: {
          onHold(p) {
            const r = wrap.current.getBoundingClientRect();
            const x = Math.max(150, Math.min(r.width - 150, p.x)), y = Math.max(70, p.y - 95 * 1.1 * s.env.settings.size);
            setText('');
            setCompose(p.friend ? { pet: p, to: p.friend.uid, toName: p.friend.username, x, y } : { pet: p, x, y });
          },
          onDbl(p) {
            if (!p.friend) return false;
            live.current.social.send(p.friend.uid, 'poke').catch(() => {});
            pops.current.push({ text: EMOTES.poke, x: p.x, y: p.y - 70, t: 0, max: 1.4, size: 24 });
            p.enter && p.enter('dizzy', 1.2);
            return true;
          },
          decorate(ctx, u, pets, env, hold) {
            const D = window.NibbleSocialDraw;
            if (!D) return;
            if (hold && hold.k > 0) D.holdRing(ctx, hold.p, u, Math.min(1, hold.k));
            for (const p of pets) {
              if (p.friend) {
                D.nameTag(ctx, p, u, '@' + p.friend.username, p.friend.dnd ? '#ffd166' : '#7ee8c6');
                if (p.friend.typing && !p.bubble) D.thought(ctx, p, u, env.time);
              } else if (p.mine) {
                D.nameTag(ctx, p, u, 'you', '#ff8fd0');
                if (p.typingSelf && !p.bubble) D.thought(ctx, p, u, env.time);
              }
            }
            const list = pops.current;
            for (let i = list.length - 1; i >= 0; i--) if (!D.pop(ctx, list[i], 1 / 60)) list.splice(i, 1);
          },
        },
      });
      s.env.settings.chatty = 'quiet';
      stage.current = s;
      ro = new ResizeObserver(() => s.resize());
      ro.observe(wrap.current);
      setReady(true);
    });
    return () => { dead = true; ro && ro.disconnect(); s && s.destroy(); stage.current = null; };
  }, []);

  // a friend's pet on the desk (spawns it if it isn't here yet)
  const petOf = (uid) => {
    const s = stage.current;
    if (!s) return null;
    let p = s.env.pets.find((q) => q.friend && q.friend.uid === uid);
    if (p) return p;
    const f = live.current.state.friends.find((x) => x.uid === uid);
    if (!f) return null;
    p = s.addPet(f.skin, f.petName || f.username, { friend: f });
    p.greeted = true;
    p.speak = () => false;
    return p;
  };

  useEffect(() => {
    const onBring = (e) => visit(e.detail, 30 * 60);
    window.addEventListener('nibble-bring', onBring);
    const t = setInterval(() => { for (const [uid, until] of visitors.current) if (until < Date.now()) { visitors.current.delete(uid); setVtick((n) => n + 1); } }, 5000);
    return () => { window.removeEventListener('nibble-bring', onBring); clearInterval(t); };
  }, []);

  // keep pets in sync with your profile + online friends (+ visitors)
  useEffect(() => {
    const s = stage.current;
    if (!s || !state.profile) return;
    const env = s.env;
    let mine = env.pets.find((p) => p.mine);
    if (!mine) {
      mine = s.addPet(state.profile.skin || 'mint', state.profile.petName || 'Nibble', { mine: true });
      mine.greeted = true;
    }
    mine.skinKey = state.profile.skin || 'mint';
    mine.name = state.profile.petName || 'Nibble';
    mine.acc = state.profile.acc || []; mine.tint = state.profile.tint || ''; mine.makeup = state.profile.makeup || '';
    const show = state.prefs.dnd ? [] : state.friends.filter((f) => f.online || (visitors.current.get(f.uid) || 0) > Date.now());
    const ids = new Set(show.map((f) => f.uid));
    for (const p of env.pets.slice()) if (p.friend && !ids.has(p.friend.uid)) s.removePetObj(p);
    for (const f of show) {
      let p = env.pets.find((q) => q.friend && q.friend.uid === f.uid);
      if (!p) {
        p = s.addPet(f.skin, f.petName || f.username, { friend: f });
        p.greeted = true;
        p.speak = () => false; // friends' pets only say what your friend types
      }
      p.friend = f;
      p.skinKey = f.skin;
      p.acc = f.acc || []; p.tint = f.tint || ''; p.makeup = f.makeup || '';
    }
  }, [ready, state.profile, state.friends, state.prefs, vtick]);

  // incoming messages → bubbles & reactions
  useEffect(() => {
    if (!social) return;
    return social.onMessage((m) => {
      const s = stage.current;
      if (!s || live.current.state.prefs.dnd) return;
      const env = s.env;
      const mine = env.pets.find((p) => p.mine);
      // whatever a friend sends is said by THEIR pet, so bring it over if it isn't here
      if (m.mine) return;
      if (!env.pets.some((q) => q.friend && q.friend.uid === m.from)) visit(m.from, m.kind === 'visit' ? 10 * 60 : 90);
      const from = petOf(m.from);
      if (m.kind === 'say' || m.kind === 'whisper') {
        if (from) { from.bubble = null; from.say(m.text, Math.min(10, 3.5 + m.text.length * 0.08)); }
        return;
      }
      if (m.kind === 'visit') {
        if (from) { from.bubble = null; from.say(`Hi! @${m.fromName} sent me to visit 👋`, 5); }
        return;
      }
      if (!mine) return;
      {
        pops.current.push({ text: EMOTES[m.kind] || '✨', x: mine.x, y: mine.y - 70, t: 0, max: 1.6, size: 26 });
        if (from) {
          pops.current.push({ text: EMOTES[m.kind] || '✨', x: from.x, y: from.y - 70, t: 0, max: 1.6, size: 26 });
          from.bubble = null;
          from.say(EMOTE_SAY[m.kind] || 'hi!', 3.5);
        }
        if ((m.kind === 'hug' || m.kind === 'kiss') && from && mine.grounded()) {
          // the friend's pet hops over next to yours (or drops in right beside it)
          const side = from.x < mine.x ? -1 : 1;
          from.x = mine.x + side * 46; if (from.grounded()) from.y = mine.y; from.dir = -side; mine.dir = side;
          from.enter('happy', 2); s.emit('dust', from.x, from.y, { n: 6 });
        }
        if (m.kind === 'dance') mine.command({ type: 'dance' }, env);
        else if (m.kind === 'poke' || m.kind === 'tickle') mine.enter('dizzy', 1.2);
        else mine.enter('happy', 1.6);
        if (m.kind === 'hug' || m.kind === 'kiss' || m.kind === 'heart') for (let i = 0; i < 5; i++) s.emit('heart', mine.x + (i - 2) * 6, mine.y - 40, { delay: i * 0.12 });
      }
    });
  }, [social]);

  const close = () => {
    if (compose && compose.pet) compose.pet.typingSelf = false;
    setCompose(null);
    setText('');
    social.setTyping(false).catch(() => {});
  };
  const ownTo = () => (pick === 'all' ? 'all' : (state.friends.find((f) => f.uid === pick) || state.friends[0] || {}).uid || 'all');
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return close();
    let c = compose;
    if (!c.to && ownTo() !== 'all') {
      const f = state.friends.find((x) => x.uid === ownTo());
      c = { ...c, to: f.uid, toName: f.username, fromMine: true };
    }
    close();
    if (c.fromMine) {
      await social.send(c.to, 'whisper', t).catch(() => {});
      c.pet.bubble = null;
      c.pet.say(`🔒 @${c.toName}: ${t}`, Math.min(9, 3 + t.length * 0.08));
    } else if (c.to) {
      await social.send(c.to, 'whisper', t).catch(() => {});
      const mine = stage.current?.env.pets.find((p) => p.mine);
      if (mine) { mine.bubble = null; mine.say(`→ @${c.toName}: ${t}`, 4); }
    } else {
      await social.say(t).catch(() => {});
      c.pet.bubble = null;
      c.pet.say(t, Math.min(9, 3 + t.length * 0.08));
    }
  };
  const onType = (v) => {
    setText(v);
    const to = compose.to || (ownTo() === 'all' ? '' : ownTo());
    if (!compose.to) compose.pet.typingSelf = !!v;
    social.setTyping(!!v, to).catch(() => {});
  };

  const pt = (e) => { const r = canvas.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const online = state.friends.filter((f) => f.online).length;

  return (
    <div className="sa-desk" ref={wrap}>
      <div className="sa-taskbar"><span>⊞</span><span className="sa-clock">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      <canvas
        ref={canvas}
        onPointerDown={(e) => { const [x, y] = pt(e); if (stage.current?.down(x, y)) e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const [x, y] = pt(e); stage.current?.move(x, y); e.currentTarget.style.cursor = stage.current?.over(x, y) ? 'grab' : 'default'; }}
        onPointerUp={() => stage.current?.up()}
        onPointerCancel={() => stage.current?.up()}
        onPointerLeave={() => stage.current?.leave()}
        onDoubleClick={(e) => { const [x, y] = pt(e); stage.current?.dbl(x, y); }}
      />
      <div className="sa-desk-hud">
        <span className="sa-dot on" /> {online ? `${online} friend${online > 1 ? 's' : ''} here` : 'No friends online yet'}
        <span className="sa-hint">Hold your pet, let go, pick a friend and type · hold a friend's pet to message them · double-click to poke · shake your pet to poof it away</span>
      </div>
      {compose && (
        <form className="sa-compose" style={{ left: compose.x, top: compose.y }} onSubmit={send}>
          {compose.to
            ? <span className="sa-compose-to">🔒 Private to @{compose.toName}</span>
            : (
              <select className="sa-compose-sel" value={ownTo()} onChange={(e) => setPick(e.target.value)} onMouseDown={(e) => e.stopPropagation()}>
                {state.friends.map((f) => <option key={f.uid} value={f.uid}>🔒 Private to @{f.username}</option>)}
                <option value="all">📣 All friends</option>
              </select>
            )}
          <input autoFocus value={text} maxLength={MAX_TEXT} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && close()} onBlur={(e) => { if (!e.relatedTarget || !e.currentTarget.form.contains(e.relatedTarget)) setTimeout(close, 150); }} placeholder="Type something short…" />
          <em>{MAX_TEXT - text.length}</em>
        </form>
      )}
    </div>
  );
}
