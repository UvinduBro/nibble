'use client';
// Customize: pick an animal, colours, outfits (any colour), hats, makeup, emotes and a special move.
// Locked items can be tried on; unlock them with points (⭐) earned in Games.
import { useEffect, useMemo, useRef, useState } from 'react';
import PetFigure, { useNibble } from '../PetFigure';
import { CHARACTERS } from '../../lib/characters';
import { SPECIES, OUTFITS, ACCS, MAKEUPS, EMOTES, SKILLS, BODY_COLORS, OUTFIT_COLORS, PT, owns, itemId, ITEMS } from '../../lib/shop';
import { niceError, verLess } from '../../lib/social/social';

const HEX = /^#[0-9a-fA-F]{6}$/;
const TABS = [['pet', '🐾', 'Pet'], ['colour', '🎨', 'Colours'], ['outfit', '👕', 'Outfit'], ['hats', '🎩', 'Hats & face'], ['moves', '⚡', 'Moves']];
// colour themes = the classic Nibble palettes
const PALETTES = ['mint', 'midnight', 'peach', 'lavender', 'cyber', 'goldie', 'ghost', 'lava', 'ocean'];

// A live little room running the real engine: the pet wanders, and buttons trigger moves.
export function PetStage({ look, cmd, height = 300 }) {
  const ready = useNibble();
  const wrap = useRef(null), cv = useRef(null), petRef = useRef(null), lookRef = useRef(look);
  lookRef.current = look;
  useEffect(() => {
    if (!ready) return;
    const c = cv.current, ctx = c.getContext('2d');
    let W = 360, H = height, dpr = 1, raf = 0, last = performance.now(), dead = false;
    const env = {
      world: { w: W, h: H, left: 0, right: W, top: 0, floor: H - 36 }, settings: { size: 1.25, chatty: 'normal', walkOnWindows: true, pets: [] },
      skins: window.SKINS, platforms: [], winsById: new Map(), floorSeg: null, cursor: null, pets: [], time: 0, lastSpeech: -999,
      emit() {}, sound() {}, onFirstLanding() {}, greeted: true,
    };
    const fit = () => {
      const r = wrap.current.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1; W = Math.max(200, r.width); H = height;
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
      env.world = { w: W, h: H, left: 0, right: W, top: 0, floor: H - 36 };
      env.floorSeg = { winId: null, x1: 0, x2: W, y: H - 36 };
      env.platforms = [env.floorSeg];
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap.current);
    const L = lookRef.current;
    const p = new window.NibblePet({ id: 'stage', name: 'You', skin: L.skin, acc: L.acc, tint: L.tint, makeup: L.makeup, style: L.style }, env, 0);
    p._u = 1.1 * env.settings.size; p.greeted = true;
    p.x = W / 2; p.y = env.world.floor; p.standOn(env.floorSeg, env); p.enter('wave', 1.4);
    env.pets = [p]; petRef.current = p;
    const loop = (now) => {
      if (dead) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      env.time += dt;
      const lk = lookRef.current;
      p.skinKey = lk.skin; p.acc = lk.acc; p.tint = lk.tint; p.makeup = lk.makeup; p.setStyle(lk.style);
      p.update(dt, env);
      if (p.state === 'climb' || p.state === 'cling') { p.y = env.world.floor; p.standOn(env.floorSeg, env); p.enter('idle', 1); }
      // keep it on stage
      if (p.x < 40) p.x = 40; if (p.x > W - 40) p.x = W - 40;
      if (p.y > env.world.floor + 2 && p.state !== 'drag') { p.y = env.world.floor; p.standOn(env.floorSeg, env); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, H - 36, 0, H);
      g.addColorStop(0, 'rgba(126,232,198,0.16)'); g.addColorStop(1, 'rgba(126,232,198,0)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 36, W, 36);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H - 36, W, 1);
      const sk = { ...(window.SKINS[lk.skin] || window.SKINS.mint), neon: lk.skin === 'cyber' };
      const u = p.u;
      window.NibbleDraw.drawShadow(ctx, p.x, env.world.floor, u, p.grounded() ? 1 : 0.5);
      window.NibbleDraw.drawPet(ctx, p.pose(), sk, u);
      if (p.bubble && p.bubble.text) {
        ctx.font = '600 13px system-ui, sans-serif';
        const tw = Math.min(W - 20, ctx.measureText(p.bubble.text).width + 20);
        const bx = Math.max(10, Math.min(W - tw - 10, p.x - tw / 2)), by = p.y - 96 * u / 1.1;
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.roundRect(bx, by - 26, tw, 28, 12); ctx.fill();
        ctx.fillStyle = '#1b1f2e'; ctx.fillText(p.bubble.text, bx + 10, by - 7, tw - 20);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); petRef.current = null; };
  }, [ready, height]);
  useEffect(() => {
    const p = petRef.current;
    if (!p || !cmd || !cmd.type) return;
    const env = p.env;
    if (cmd.type === 'special') { if (p.state === 'special') return; if (!p.grounded()) return; if (!p.special(env)) p.backflip(env); }
    else if (cmd.type === 'dance') p.enter('dance', 4);
    else if (cmd.type === 'wave') p.enter('wave', 2);
    else if (cmd.type === 'happy') p.enter('happy', 1.6);
  }, [cmd]);
  return <div ref={wrap} className="wd-stage"><canvas ref={cv} /></div>;
}

function Tile({ on, locked, price, onClick, children, label, sub }) {
  return (
    <button className={'wd-tile' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={onClick} title={label}>
      <span className="wd-tile-art">{children}</span>
      <span className="wd-tile-label">{label}</span>
      {sub && <span className="wd-tile-sub">{sub}</span>}
      {locked ? <span className="wd-price">{PT} {price}</span> : price > 0 ? <span className="wd-owned">✓</span> : null}
    </button>
  );
}

export default function Wardrobe({ social, state, desktop, local, toast, go }) {
  const prof = state.profile;
  const wallet = state.wallet || {};
  const owned = wallet.owned || [];
  const saved = useMemo(() => ({ skin: prof.skin || 'mint', acc: prof.acc || [], tint: prof.tint || '', makeup: prof.makeup || '', style: { sp: '', of: '', oc: '', sk: '', ...(prof.style || {}) } }), [prof]);
  const [skin, setSkin] = useState(saved.skin);
  const [acc, setAcc] = useState(saved.acc);
  const [tint, setTint] = useState(saved.tint);
  const [makeup, setMakeup] = useState(saved.makeup);
  const [sp, setSp] = useState(saved.style.sp);
  const [of, setOf] = useState(saved.style.of);
  const [oc, setOc] = useState(saved.style.oc);
  const [sk, setSk] = useState(saved.style.sk);
  const [tab, setTab] = useState('pet');
  const [cmd, setCmd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); // '' | 'saving' | 'saved' | 'local'
  const style = useMemo(() => ({ sp, of, oc, sk }), [sp, of, oc, sk]);
  const look = { skin, acc, tint, makeup, style };
  const poke = (type) => setCmd({ type, n: Date.now() });
  const shopOff = state.config && state.config.shop === false;
  const SK = typeof window !== 'undefined' && window.SKINS ? window.SKINS : {};
  const special = (k) => !!(SK[k] && (SK[k].kit || SK[k].chibi)); // anime crew: own costume + move
  const crew = CHARACTERS.filter((c) => c.group === 'anime');

  // everything in the current look that isn't unlocked yet
  const lockedList = [
    ...(sp && !owns(owned, 'sp', sp) ? [['sp', sp]] : []),
    ...(of && !owns(owned, 'of', of) ? [['of', of]] : []),
    ...acc.filter((a) => !owns(owned, 'acc', a)).map((a) => ['acc', a]),
    ...(sk && !owns(owned, 'sk', sk) ? [['sk', sk]] : []),
  ];
  const locked = lockedList.map(([c, k]) => itemId(c, k));
  const lockedCost = locked.reduce((t, id) => t + (ITEMS[id] ? ITEMS[id].price : 0), 0);
  const sig = JSON.stringify([skin, acc, tint, makeup, sp, of, oc, sk]);
  const savedSig = JSON.stringify([saved.skin, saved.acc, saved.tint, saved.makeup, saved.style.sp, saved.style.of, saved.style.oc, saved.style.sk]);

  // changes save on their own (on Nibble's servers and on this PC's pets) — unless something is still locked
  const timer = useRef(null);
  useEffect(() => {
    if (sig === savedSig || locked.length) return;
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(async () => {
      try {
        const pets = (local && local.settings.pets) || [];
        if (desktop && pets.length) desktop.setLocal({ pets: pets.map((p, i) => (i === 0 ? { ...p, skin, acc, tint, makeup, style } : p)) });
        const where = await social.updateProfile({ skin, acc, tint, makeup, style });
        setStatus(where === 'local' ? 'local' : 'saved');
      } catch (e) { setStatus(''); toast({ err: true, text: niceError(e) }); }
    }, 650);
    return () => clearTimeout(timer.current);
  }, [sig, locked.length]); // only your own changes save (a look changed elsewhere isn't overwritten) // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (id) => {
    const it = ITEMS[id];
    if (shopOff) { toast({ err: true, text: 'The shop is closed for now. Try again later!' }); return false; }
    setBusy(true);
    try { await social.wallet.buy(id); toast({ text: `${it.emoji} ${it.label} unlocked!` }); poke('happy'); setBusy(false); return true; }
    catch (e) { toast({ err: true, text: niceError(e) }); setBusy(false); return false; }
  };
  const buyAll = async () => { for (const id of locked) if (!(await buy(id))) break; };
  // take the locked things off again (back to what's saved)
  const takeOff = () => {
    for (const [c, k] of lockedList) {
      if (c === 'sp') setSp(saved.style.sp);
      if (c === 'of') setOf(saved.style.of);
      if (c === 'sk') setSk(saved.style.sk);
      if (c === 'acc') setAcc((cur) => cur.filter((a) => a !== k));
    }
  };
  const toggleAcc = (k) => setAcc((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(-6)));
  // one simple choice: an animal (any colours) or a special character (own costume + move)
  const pickAnimal = (k) => {
    setSp(k);
    if (special(skin)) setSkin('mint');
    if (k) { if (!/^#/.test(tint)) setTint('nat'); } else if (tint === 'nat') setTint('');
    poke('wave');
  };
  const pickCharacter = (k) => { setSkin(k); setSp(''); setTint(''); poke('special'); };
  const fig = (extra, mood = 'idle') => <PetFigure skin={extra.skin || skin} mood={mood} w={84} h={78} size={0.78} acc={extra.acc ?? []} tint={extra.tint ?? tint} makeup={extra.makeup ?? ''} look={{ ...style, ...extra.style }} />;
  const charSel = special(skin);
  const statusText = locked.length ? '' : status === 'saving' || sig !== savedSig ? 'Saving…' : status === 'local' ? 'Saved on this PC (friends see it once the new rules are published)' : 'Saved ✓ · friends see this look';
  const price = (cat, it) => (owns(owned, cat, it.key) ? 0 : it.price);

  return (
    <div className="sa-page wd">
      <div className="sa-head">
        <div>
          <h2>Customize</h2>
          <p className="sa-sub">Pick a pet, then dress it up. Changes save by themselves and show on your desktop and your friends’.</p>
        </div>
        <button className="wd-wallet" onClick={() => go('games')} title="Earn more in Games">
          <b>{PT} {wallet.ready ? wallet.points : '…'}</b><small>points · earn more</small>
        </button>
      </div>
      <div className="wd-grid">
        <div className="wd-left">
          <div className="sa-card wd-preview">
            <PetStage look={look} cmd={cmd} />
            <div className="wd-try">
              <button className="btn small ghost" onClick={() => poke('special')}>⚡ Special move</button>
              <button className="btn small ghost" onClick={() => poke('dance')}>🕺 Dance</button>
              <button className="btn small ghost" onClick={() => poke('wave')}>👋 Wave</button>
            </div>
            {locked.length > 0 ? (
              <div className="wd-locked">
                <div><b>Trying on:</b> {locked.map((id) => ITEMS[id] ? `${ITEMS[id].emoji} ${ITEMS[id].label}` : id).join(', ')}<br /><small>Unlock to keep {locked.length > 1 ? 'them' : 'it'} · {PT} {lockedCost}</small></div>
                <div className="wd-locked-btns">
                  <button className="btn small" disabled={busy || shopOff || (wallet.points || 0) < lockedCost} onClick={buyAll}>
                    {shopOff ? 'Shop closed' : (wallet.points || 0) < lockedCost ? `Need ${lockedCost - (wallet.points || 0)} more ${PT}` : `Unlock · ${PT} ${lockedCost}`}
                  </button>
                  <button className="btn small ghost" onClick={takeOff}>Take off</button>
                </div>
              </div>
            ) : <p className={'wd-status' + (status === 'local' ? ' warn' : '')}>{statusText}</p>}
            {wallet.error === 'rules' && <p className="wd-warn">Points need the new Firestore rules. Publish <code>firestore.rules</code> in the Firebase console.</p>}
            {desktop && local && local.version && verLess(local.version, '2.0.13') && <p className="wd-warn">Your desktop app (v{local.version}) can’t show animals and outfits yet. Reinstall the latest Nibble to see them on your desktop.</p>}
          </div>
        </div>
        <div className="wd-right">
          <div className="wd-tabs" role="tablist">
            {TABS.map(([k, i, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</button>)}
          </div>
          <div className="sa-card wd-panel">
            {tab === 'pet' && (
              <>
                <h4 className="wd-h">Animals <small>dress them any way you like</small></h4>
                <div className="wd-tiles">
                  {SPECIES.map((s) => (
                    <Tile key={s.key || 'nibble'} label={s.label} on={!charSel && sp === s.key} locked={!owns(owned, 'sp', s.key)} price={price('sp', s)} onClick={() => pickAnimal(s.key)}>
                      {fig({ skin: charSel ? 'mint' : skin, style: { sp: s.key }, tint: s.key ? (/^#/.test(tint) ? tint : 'nat') : (tint === 'nat' ? '' : tint) })}
                    </Tile>
                  ))}
                </div>
                <h4 className="wd-h">Special characters <small>come with their own costume and special move</small></h4>
                <div className="wd-tiles">
                  {crew.map((c) => (
                    <Tile key={c.key} label={c.name} sub={c.role} on={charSel && skin === c.key} price={0} onClick={() => pickCharacter(c.key)}>
                      <PetFigure skin={c.key} mood="idle" w={84} h={78} size={0.78} />
                    </Tile>
                  ))}
                </div>
              </>
            )}
            {tab === 'colour' && (
              <>
                {charSel ? <p className="wd-hint">{CHARACTERS.find((c) => c.key === skin)?.name} keeps their own colours. Pick an animal in <b>Pet</b> to recolour it.</p> : (
                  <>
                    <h4 className="wd-h">Body colour</h4>
                    <div className="wd-swatches">
                      {sp && <button className={'wd-sw wd-sw-txt' + (tint === 'nat' ? ' on' : '')} onClick={() => setTint('nat')}>🌿 Natural</button>}
                      {BODY_COLORS.map((c) => <button key={c} className={'wd-sw' + (tint === c ? ' on' : '')} style={{ background: c }} onClick={() => setTint(c)} aria-label={c} />)}
                      <label className="wd-sw wd-pick" title="Any colour">
                        <input type="color" value={HEX.test(tint) ? tint : '#7ee8c6'} onChange={(e) => setTint(e.target.value)} />🎨
                      </label>
                    </div>
                    <h4 className="wd-h">Colour themes <small>body, ears, eyes and glow together</small></h4>
                    <div className="wd-tiles small">
                      {PALETTES.map((k) => (
                        <Tile key={k} label={(SK[k] && SK[k].label) || k} on={!tint && skin === k} price={0} onClick={() => { setSkin(k); setTint(''); }}>
                          {fig({ skin: k, tint: '' })}
                        </Tile>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {tab === 'outfit' && (
              <>
                <div className="wd-tiles">
                  {OUTFITS.map((o) => (
                    <Tile key={o.key || 'none'} label={o.label} on={of === o.key} locked={!owns(owned, 'of', o.key)} price={price('of', o)} onClick={() => setOf(o.key)}>
                      {fig({ style: { of: o.key, oc: of === o.key ? oc : '' } })}
                    </Tile>
                  ))}
                </div>
                {of && (
                  <>
                    <h4 className="wd-h">{OUTFITS.find((o) => o.key === of)?.label} colour</h4>
                    <div className="wd-swatches">
                      <button className={'wd-sw wd-sw-txt' + (!oc ? ' on' : '')} onClick={() => setOc('')}>Default</button>
                      {OUTFIT_COLORS.map((c) => <button key={c} className={'wd-sw' + (oc === c ? ' on' : '')} style={{ background: c }} onClick={() => setOc(c)} aria-label={c} />)}
                      <label className="wd-sw wd-pick" title="Any colour">
                        <input type="color" value={HEX.test(oc) ? oc : (OUTFITS.find((x) => x.key === of)?.color || '#ff7ab8')} onChange={(e) => setOc(e.target.value)} />🎨
                      </label>
                    </div>
                  </>
                )}
              </>
            )}
            {tab === 'hats' && (
              <>
                <h4 className="wd-h">Hats & glasses <small>wear up to 6 · tap again to take off</small></h4>
                <div className="wd-tiles">
                  {ACCS.map((a) => (
                    <Tile key={a.key} label={a.label} on={acc.includes(a.key)} locked={!owns(owned, 'acc', a.key)} price={price('acc', a)} onClick={() => toggleAcc(a.key)}>
                      {fig({ acc: [a.key] })}
                    </Tile>
                  ))}
                </div>
                <h4 className="wd-h">Face</h4>
                <div className="wd-tiles small">
                  {MAKEUPS.map((m) => (
                    <Tile key={m.key || 'none'} label={m.label} on={makeup === m.key} price={0} onClick={() => setMakeup(m.key)}>
                      {fig({ makeup: m.key }, 'happy')}
                    </Tile>
                  ))}
                </div>
              </>
            )}
            {tab === 'moves' && (
              <>
                <h4 className="wd-h">Special move <small>your pet does it now and then. Tap one to preview</small></h4>
                <div className="wd-list">
                  {SKILLS.map((s) => {
                    const have = owns(owned, 'sk', s.key);
                    return (
                      <div key={s.key || 'own'} className={'wd-row' + (sk === s.key ? ' on' : '') + (have ? '' : ' locked')} onClick={() => { setSk(s.key); setTimeout(() => poke('special'), 60); }}>
                        <span className="wd-emo">{s.emoji}</span>
                        <span className="wd-row-main"><b>{s.label}</b><small>{s.note}</small></span>
                        {have ? <small className="wd-have">{sk === s.key ? 'Selected' : s.price ? 'Unlocked' : 'Free'}</small> : <span className="wd-price">{PT} {s.price}</span>}
                      </div>
                    );
                  })}
                </div>
                <h4 className="wd-h">Friend emotes <small>things you can send friends. Unlocked ones show next to each friend</small></h4>
                <div className="wd-list">
                  {EMOTES.filter((e) => e.price > 0).map((e) => {
                    const have = owns(owned, 'em', e.key);
                    return (
                      <div key={e.key} className={'wd-row' + (have ? '' : ' locked')}>
                        <span className="wd-emo">{e.emoji}</span><b>{e.label}</b>
                        {have ? <small className="wd-have">Unlocked</small>
                          : <button className="btn small" disabled={busy || shopOff || (wallet.points || 0) < e.price} onClick={() => buy(itemId('em', e.key))}>{PT} {e.price}</button>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
