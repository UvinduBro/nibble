'use client';
// Games: solo mini games that earn points (⭐), the daily bonus, gifting points, and live games with friends.
import { useEffect, useRef, useState } from 'react';
import { useNibble } from '../PetFigure';
import { SOLO, MAKERS } from '../games/solo';
import { GAMES, judge, winLine, WIN_PTS, DRAW_PTS, LOSE_PTS } from '../../lib/social/games';
import { DAY_CAP, GIFT_MAX, SOCIAL_CAP } from '../../lib/social/wallet';
import { PT } from '../../lib/shop';
import { niceError } from '../../lib/social/social';

// tiny synth so games have a bit of sound (muted with the 🔇 button)
let actx = null;
function blip(name) {
  try {
    if (localStorage.getItem('nibble-games-mute') === '1') return;
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const T = { pop: [660, 0.06, 'triangle'], hop: [520, 0.09, 'square'], nom: [440, 0.08, 'sine'], boing: [180, 0.22, 'sawtooth'], chime: [880, 0.25, 'sine'] }[name] || [500, 0.06, 'sine'];
    const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
    o.type = T[2]; o.frequency.setValueAtTime(T[0], now);
    o.frequency.exponentialRampToValueAtTime(name === 'boing' ? 90 : T[0] * 1.6, now + T[1]);
    g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.0001, now + T[1]);
    o.connect(g).connect(actx.destination); o.start(now); o.stop(now + T[1] + 0.02);
  } catch { /* no audio */ }
}

function GameRunner({ game, look, onEnd, onQuit }) {
  const ready = useNibble();
  const wrap = useRef(null), cv = useRef(null);
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);
  const endRef = useRef(onEnd); endRef.current = onEnd;
  useEffect(() => {
    if (!ready) return;
    setResult(null);
    const c = cv.current, ctx = c.getContext('2d');
    const W = Math.min(640, wrap.current.getBoundingClientRect().width || 640), H = 430;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    const skin = { ...(window.SKINS[look.skin] || window.SKINS.mint), neon: look.skin === 'cyber' };
    let t = 0, ended = false;
    const api = {
      W, H, look,
      pet(x, y, pose = {}, scale = 1) {
        window.NibbleDraw.drawPet(ctx, { x, y, dir: 1, sx: 1, sy: 1, walk: 0, t, blink: Math.sin(t * 1.7) > 0.97 ? 0.1 : 1, look: { x: 0, y: 0 }, eyes: 'open', mouth: 'w', arms: 'down', ears: 0, stride: 0, bob: 0, tailWag: 6, acc: look.acc, tint: look.tint, makeup: look.makeup, style: look.style, ...pose }, skin, 1.15 * scale);
      },
      end(score) { if (ended) return; ended = true; setTimeout(() => { const r = endRef.current(score); setResult({ score, ...r }); }, 650); },
      sound: blip,
    };
    const g = MAKERS[game.key](ctx, api);
    let raf = 0, last = performance.now(), dead = false;
    const loop = (now) => {
      if (dead) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      if (document.hidden) return;
      t += dt;
      g.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.draw(dt);
    };
    raf = requestAnimationFrame(loop);
    const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'a', 'd', 'w']);
    const kd = (e) => { if (KEYS.has(e.key) && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); g.key(e.key, true); } };
    const ku = (e) => { if (KEYS.has(e.key)) g.key(e.key, false); };
    const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
    const pd = (e) => { e.preventDefault(); c.setPointerCapture && c.setPointerCapture(e.pointerId); g.point(...pos(e), 'down'); };
    const pm = (e) => g.point(...pos(e), 'move');
    const pu = (e) => g.point(...pos(e), 'up');
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    c.addEventListener('pointerdown', pd); c.addEventListener('pointermove', pm); c.addEventListener('pointerup', pu);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); c.removeEventListener('pointerdown', pd); c.removeEventListener('pointermove', pm); c.removeEventListener('pointerup', pu); };
  }, [ready, game.key, run]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ar-runner">
      <div className="ar-runner-head">
        <button className="btn small ghost" onClick={onQuit}>← All games</button>
        <b>{game.emoji} {game.title}</b>
        <small>{game.how}</small>
      </div>
      <div ref={wrap} className="ar-canvas">
        <canvas ref={cv} />
        {result && (
          <div className="ar-result">
            <div className="ar-result-card">
              <span className="ar-big">{game.emoji}</span>
              <h3>Score {result.score}</h3>
              {result.best && <p className="ar-best">New personal best! 🏆</p>}
              <p className="ar-earned">{result.got > 0 ? `+${result.got} ${PT}` : result.capped ? 'Daily points limit reached — come back tomorrow!' : 'No points this time'}</p>
              <div className="ar-result-btns">
                <button className="btn" autoFocus onClick={() => setRun((n) => n + 1)}>Play again</button>
                <button className="btn ghost" onClick={onQuit}>Back</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Board({ m, me, social, toast }) {
  const g = GAMES[m.game];
  const idx = m.players.indexOf(me);
  const other = m.players[1 - idx];
  const myTurn = m.status !== 'done' && m.turn === me && !(m.status === 'invite');
  const line = m.status === 'done' ? winLine(m.game, m.board) : [];
  const mark = (c) => (c === '0' ? (m.game === 'ttt' ? '❌' : '🔴') : c === '1' ? (m.game === 'ttt' ? '⭕' : '🟡') : '');
  const move = (i) => { if (!myTurn) return; social.games.move(m.id, i).catch((e) => toast({ err: true, text: niceError(e) })); };
  const result = m.status === 'done' ? (m.winner === 'draw' ? `It’s a draw · +${DRAW_PTS} ${PT}` : m.winner === me ? `You won! · +${WIN_PTS} ${PT}` : `@${m.names[other]} won · +${LOSE_PTS} ${PT} for playing`) : '';
  return (
    <div className="ar-board-wrap">
      <div className={'ar-board ' + m.game} style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)` }}>
        {m.board.split('').map((c, i) => (
          <button key={i} className={'ar-cell' + (line.includes(i) ? ' win' : '') + (m.last === i ? ' last' : '')} disabled={!myTurn || (m.game === 'ttt' && c !== '.')} onClick={() => move(i)}>
            <span>{mark(c)}</span>
          </button>
        ))}
      </div>
      <p className="ar-turn">
        {m.status === 'invite' ? (m.players[0] === me ? `Waiting for @${m.names[other]} to accept…` : `@${m.names[other]} challenged you!`)
          : m.status === 'done' ? result : myTurn ? `Your turn ${mark(String(idx))}` : `@${m.names[other]}’s turn…`}
      </p>
    </div>
  );
}

function FriendGames({ social, state, toast }) {
  const me = state.user.uid;
  const [fr, setFr] = useState('');
  const [game, setGame] = useState('ttt');
  const [open, setOpen] = useState(null);
  const matches = state.matches || [];
  const friends = state.friends;
  useEffect(() => { if (!fr && friends.length) setFr(friends[0].uid); }, [friends, fr]);
  const cur = matches.find((m) => m.id === open) || null;
  const challenge = () => social.games.challenge(fr, game).then((id) => { setOpen(id); toast({ text: '🎮 Challenge sent!' }); }).catch((e) => toast({ err: true, text: niceError(e) }));
  const label = (m) => {
    const other = m.players.find((p) => p !== me);
    const name = '@' + (m.names[other] || 'friend');
    if (m.status === 'invite') return m.players[0] === me ? `${name} · waiting` : `${name} challenged you`;
    if (m.status === 'done') return `${name} · ${m.winner === 'draw' ? 'draw' : m.winner === me ? 'you won' : 'they won'}`;
    return `${name} · ${m.turn === me ? 'your turn' : 'their turn'}`;
  };
  return (
    <div className="sa-card ar-friends">
      <h3>Play with friends <small>live, turn by turn · win {WIN_PTS} {PT}</small></h3>
      {!friends.length ? <p className="sa-sub">Add a friend first, then challenge them here.</p> : (
        <div className="ar-challenge">
          <select value={fr} onChange={(e) => setFr(e.target.value)}>{friends.map((f) => <option key={f.uid} value={f.uid}>@{f.username}{f.online ? ' · online' : ''}</option>)}</select>
          <div className="ar-gpick">{Object.entries(GAMES).map(([k, g]) => <button key={k} className={game === k ? 'on' : ''} onClick={() => setGame(k)}>{g.emoji} {g.label}</button>)}</div>
          <button className="btn small" onClick={challenge}>Challenge</button>
        </div>
      )}
      {matches.length > 0 && (
        <div className="ar-matches">
          {matches.map((m) => {
            const mine = m.status !== 'done' && m.turn === me && m.status === 'live';
            const invited = m.status === 'invite' && m.players[1] === me;
            return (
              <div key={m.id} className={'ar-match' + (open === m.id ? ' on' : '') + (mine || invited ? ' hot' : '')}>
                <button className="ar-match-main" onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <span>{GAMES[m.game].emoji}</span><b>{GAMES[m.game].label}</b><small>{label(m)}</small>
                </button>
                {invited && <>
                  <button className="btn small" onClick={() => social.games.accept(m.id).then(() => setOpen(m.id)).catch((e) => toast({ err: true, text: niceError(e) }))}>Accept</button>
                  <button className="btn small ghost" onClick={() => social.games.decline(m.id)}>No thanks</button>
                </>}
                {m.status === 'done' && <button className="btn small ghost" onClick={() => social.games.rematch(m.id).then((id) => setOpen(id)).catch((e) => toast({ err: true, text: niceError(e) }))}>Rematch</button>}
                {m.status === 'live' && <button className="sa-x" title="Resign" onClick={() => social.games.resign(m.id)}>🏳</button>}
                {m.status === 'done' && <button className="sa-x" title="Close" onClick={() => social.games.decline(m.id)}>✕</button>}
              </div>
            );
          })}
        </div>
      )}
      {cur && <Board m={cur} me={me} social={social} toast={toast} />}
    </div>
  );
}

export default function Arcade({ social, state, toast }) {
  const w = state.wallet || {};
  const prof = state.profile;
  const look = { skin: prof.skin || 'mint', acc: prof.acc || [], tint: prof.tint || '', makeup: prof.makeup || '', style: prof.style || null };
  const [playing, setPlaying] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [gift, setGift] = useState({ to: '', amount: 20 });
  const [board, setBoard] = useState([]);
  const [mute, setMute] = useState(false);
  useEffect(() => { try { setMute(localStorage.getItem('nibble-games-mute') === '1'); } catch {} }, []);
  useEffect(() => { social.wallet.friendsBest().then(setBoard).catch(() => {}); }, [social, state.friends.length, playing]);
  useEffect(() => { if (!gift.to && state.friends.length) setGift((g) => ({ ...g, to: state.friends[0].uid })); }, [state.friends, gift.to]);

  const finish = (game) => (score) => {
    const pts = game.pts(score);
    const got = social.wallet.earn(pts, game.key);
    const prev = (w.best || {})[game.key] || 0;
    social.wallet.best(game.key, score).catch(() => {});
    return { got, best: score > prev && score > 0, capped: pts > 0 && !got };
  };
  const claim = async () => {
    setClaiming(true);
    try { const b = await social.wallet.claimDaily(); toast({ text: `🎁 Daily bonus: +${b} ${PT}` }); }
    catch (e) { toast({ err: true, text: niceError(e) }); }
    setClaiming(false);
  };
  const sendGift = (e) => {
    e.preventDefault();
    const f = state.friends.find((x) => x.uid === gift.to);
    social.wallet.gift(gift.to, gift.amount).then((n) => toast({ text: `${PT} Sent ${n} points to @${f ? f.username : 'friend'}` })).catch((er) => toast({ err: true, text: niceError(er) }));
  };
  const toggleMute = () => { const v = !mute; setMute(v); try { localStorage.setItem('nibble-games-mute', v ? '1' : '0'); } catch {} };

  if (playing) {
    return (
      <div className="sa-page ar">
        <GameRunner game={playing} look={look} onEnd={finish(playing)} onQuit={() => setPlaying(null)} />
      </div>
    );
  }
  const top = (key) => [...board.map((b) => ({ name: b.username, s: Number(b.best[key]) || 0 })), { name: 'you', s: Number((w.best || {})[key]) || 0, me: true }].filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  return (
    <div className="sa-page ar">
      <div className="sa-head">
        <div>
          <h2>Games</h2>
          <p className="sa-sub">Play, earn {PT} points, and spend them on new animals, outfits, emotes and skills.</p>
        </div>
        <button className="sa-mute" onClick={toggleMute} title={mute ? 'Sound off' : 'Sound on'}>{mute ? '🔇' : '🔊'}</button>
      </div>
      {w.error === 'rules' && <div className="sa-card wd-warn">Points can’t be saved yet: publish the new <code>firestore.rules</code> in the Firebase console.</div>}
      <div className="ar-top">
        <div className="sa-card ar-wallet">
          <small>Your points</small>
          <b>{PT} {w.ready ? w.points : '…'}</b>
          <span className="ar-meter"><i style={{ width: Math.min(100, ((w.earnedToday || 0) / DAY_CAP) * 100) + '%' }} /></span>
          <small>{w.earnedToday || 0} / {DAY_CAP} earned today{w.pending ? ` · +${w.pending} saving…` : ''}</small>
        </div>
        <div className="sa-card ar-daily">
          <small>Daily bonus {w.streak ? `· 🔥 ${w.streak}-day streak` : ''}</small>
          {w.canDaily
            ? <button className="btn" disabled={claiming || !w.ready} onClick={claim}>{claiming ? 'Opening…' : `🎁 Claim +${w.nextBonus || 30} ${PT}`}</button>
            : <p className="ar-done">✓ Claimed today. Come back tomorrow for a bigger streak bonus.</p>}
          <small className="ar-mini">Also: +3 {PT} for each action you send a friend (up to {SOCIAL_CAP} a day).</small>
        </div>
        <form className="sa-card ar-gift" onSubmit={sendGift}>
          <small>Send points to a friend</small>
          {state.friends.length ? (
            <div className="ar-gift-row">
              <select value={gift.to} onChange={(e) => setGift({ ...gift, to: e.target.value })}>{state.friends.map((f) => <option key={f.uid} value={f.uid}>@{f.username}</option>)}</select>
              <input type="number" min={1} max={GIFT_MAX} value={gift.amount} onChange={(e) => setGift({ ...gift, amount: e.target.value })} />
              <button className="btn small" disabled={!w.ready}>Send</button>
            </div>
          ) : <p className="sa-sub">Add friends to send them points.</p>}
        </form>
      </div>
      <h3 className="ar-h">Solo games</h3>
      <div className="ar-games">
        {SOLO.map((g) => {
          const lb = top(g.key);
          return (
            <button key={g.key} className="ar-game" onClick={() => setPlaying(g)}>
              <span className="ar-emoji">{g.emoji}</span>
              <b>{g.title}</b>
              <small>{g.blurb}</small>
              <span className="ar-game-foot">
                <em>Best {(w.best || {})[g.key] || 0}</em>
                {lb.length > 0 && <span className="ar-lb">{lb.map((x, i) => <i key={i} className={x.me ? 'me' : ''}>{['🥇', '🥈', '🥉'][i]} {x.me ? 'you' : '@' + x.name} {x.s}</i>)}</span>}
              </span>
              <span className="ar-play">Play ▶</span>
            </button>
          );
        })}
      </div>
      <FriendGames social={social} state={state} toast={toast} />
    </div>
  );
}
