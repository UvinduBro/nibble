'use client';
// Customize: pick an animal, colours, outfits (any colour), hats, makeup, emotes and a special move.
// Locked items can be tried on; unlock them with points (⭐) earned in Games.
import { useEffect, useMemo, useRef, useState } from 'react';
import PetFigure, { useNibble } from '../PetFigure';
import { CHARACTERS } from '../../lib/characters';
import { SPECIES, OUTFITS, ACCS, MAKEUPS, EMOTES, SKILLS, BODY_COLORS, OUTFIT_COLORS, PT, owns, itemId, ITEMS } from '../../lib/shop';
import { niceError } from '../../lib/social/social';

const HEX = /^#[0-9a-fA-F]{6}$/;
const TABS = [['animal', '🐾', 'Animal'], ['crew', '🎭', 'Character'], ['colour', '🎨', 'Colour'], ['outfit', '👕', 'Outfit'], ['hats', '🎩', 'Hats & glasses'], ['face', '😊', 'Face'], ['emotes', '💌', 'Emotes'], ['skills', '⚡', 'Skills']];

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
  const st0 = prof.style || {};
  const [skin, setSkin] = useState(prof.skin || 'mint');
  const [acc, setAcc] = useState(prof.acc || []);
  const [tint, setTint] = useState(prof.tint || '');
  const [makeup, setMakeup] = useState(prof.makeup || '');
  const [sp, setSp] = useState(st0.sp || '');
  const [of, setOf] = useState(st0.of || '');
  const [oc, setOc] = useState(st0.oc || '');
  const [sk, setSk] = useState(st0.sk || '');
  const [tab, setTab] = useState('animal');
  const [cmd, setCmd] = useState(null);
  const [busy, setBusy] = useState(false);
  const style = useMemo(() => ({ sp, of, oc, sk }), [sp, of, oc, sk]);
  const look = { skin, acc, tint, makeup, style };
  const poke = (type) => setCmd({ type, n: Date.now() });

  // everything in the current look that isn't unlocked yet
  const locked = [
    ...(sp && !owns(owned, 'sp', sp) ? [itemId('sp', sp)] : []),
    ...(of && !owns(owned, 'of', of) ? [itemId('of', of)] : []),
    ...acc.filter((a) => !owns(owned, 'acc', a)).map((a) => itemId('acc', a)),
    ...(sk && !owns(owned, 'sk', sk) ? [itemId('sk', sk)] : []),
  ];
  const lockedCost = locked.reduce((t, id) => t + (ITEMS[id] ? ITEMS[id].price : 0), 0);
  const dirty = skin !== (prof.skin || 'mint') || tint !== (prof.tint || '') || makeup !== (prof.makeup || '') || acc.join() !== (prof.acc || []).join()
    || sp !== (st0.sp || '') || of !== (st0.of || '') || oc !== (st0.oc || '') || sk !== (st0.sk || '');

  const buy = async (id) => {
    const it = ITEMS[id];
    setBusy(true);
    try { await social.wallet.buy(id); toast({ text: `${it.emoji} ${it.label} unlocked!` }); poke('happy'); }
    catch (e) { toast({ err: true, text: niceError(e) }); }
    setBusy(false);
  };
  const buyAll = async () => { for (const id of locked) { /* one at a time so each spend is checked */ await buy(id); } };
  const save = async () => {
    if (locked.length) { toast({ err: true, text: 'Unlock the items marked ⭐ first (or take them off).' }); return; }
    setBusy(true);
    try {
      const where = await social.updateProfile({ skin, acc, tint, makeup, style });
      const pets = (local && local.settings.pets) || [];
      if (desktop && pets.length) desktop.setLocal({ pets: pets.map((p, i) => (i === 0 ? { ...p, skin, acc, tint, makeup, style } : p)) });
      toast({ text: where === 'local' ? 'Saved on this PC. Friends will see it once the new Firestore rules are published.' : 'Saved! Friends see your new look ✨' });
      poke('wave');
    } catch (e) { toast({ err: true, text: niceError(e) }); }
    setBusy(false);
  };
  const reset = () => { setSkin(prof.skin || 'mint'); setAcc(prof.acc || []); setTint(prof.tint || ''); setMakeup(prof.makeup || ''); setSp(st0.sp || ''); setOf(st0.of || ''); setOc(st0.oc || ''); setSk(st0.sk || ''); };
  const toggleAcc = (k) => setAcc((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(-6)));
  const fig = (extra, mood = 'idle') => <PetFigure skin={skin} mood={mood} w={84} h={78} size={0.78} acc={extra.acc ?? []} tint={extra.tint ?? tint} makeup={extra.makeup ?? ''} look={{ ...style, ...extra.style }} />;

  return (
    <div className="sa-page wd">
      <div className="sa-head">
        <div>
          <h2>Customize</h2>
          <p className="sa-sub">Dress up your pet. Friends see your look on their desktops too.</p>
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
            {locked.length > 0 && (
              <div className="wd-locked">
                <span>Trying on {locked.length} locked item{locked.length > 1 ? 's' : ''} · {PT} {lockedCost}</span>
                <button className="btn small" disabled={busy || (wallet.points || 0) < lockedCost} onClick={buyAll}>
                  {(wallet.points || 0) < lockedCost ? `Need ${lockedCost - (wallet.points || 0)} more ⭐` : 'Unlock all'}
                </button>
              </div>
            )}
            <div className="wd-save">
              <button className="btn" disabled={busy || !dirty || locked.length > 0} onClick={save}>{dirty ? 'Save look' : 'Saved ✓'}</button>
              {dirty && <button className="btn ghost small" onClick={reset}>Undo changes</button>}
            </div>
            {wallet.error === 'rules' && <p className="wd-warn">Points need the new Firestore rules. Publish <code>firestore.rules</code> in the Firebase console.</p>}
          </div>
        </div>
        <div className="wd-right">
          <div className="wd-tabs" role="tablist">
            {TABS.map(([k, i, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</button>)}
          </div>
          <div className="sa-card wd-panel">
            {typeof window !== 'undefined' && window.SKINS && window.SKINS[skin] && window.SKINS[skin].chibi && !sp && !of && tab !== 'crew' && tab !== 'animal' && tab !== 'emotes' && tab !== 'skills' && (
              <p className="wd-warn" style={{ marginTop: 0, marginBottom: 12 }}>{CHARACTERS.find((c) => c.key === skin)?.name || 'This character'} is hand-drawn with his own outfit, so hats, colours and makeup don’t show on him. Pick an animal (or an outfit) to dress him up, or choose another character.</p>
            )}
            {tab === 'animal' && (
              <>
                <p className="wd-hint">Pick an animal. It keeps your character’s colours, or switch to <b>Natural</b> colours in the Colour tab.</p>
                <div className="wd-tiles">
                  {SPECIES.map((s) => (
                    <Tile key={s.key || 'nibble'} label={s.label} on={sp === s.key} locked={!owns(owned, 'sp', s.key)} price={s.price}
                      onClick={() => { setSp(s.key); if (s.key && !tint) setTint('nat'); if (!s.key && tint === 'nat') setTint(''); }}>
                      {fig({ style: { sp: s.key }, tint: s.key && (tint === 'nat' || !tint) ? 'nat' : tint === 'nat' ? '' : tint }, 'idle')}
                    </Tile>
                  ))}
                </div>
              </>
            )}
            {tab === 'crew' && (
              <>
                <p className="wd-hint">Characters set the colour palette, and the anime crew bring their costume and signature move.</p>
                <div className="wd-tiles">
                  {CHARACTERS.map((c) => (
                    <Tile key={c.key} label={c.name} sub={c.role} on={skin === c.key} price={0} onClick={() => setSkin(c.key)}>
                      <PetFigure skin={c.key} mood="idle" w={84} h={78} size={0.78} />
                    </Tile>
                  ))}
                </div>
              </>
            )}
            {tab === 'colour' && (
              <>
                <div className="sa-coltitle">Body colour</div>
                <div className="wd-swatches">
                  <button className={'wd-sw wd-sw-txt' + (!tint ? ' on' : '')} onClick={() => setTint('')}>Character</button>
                  {sp && <button className={'wd-sw wd-sw-txt' + (tint === 'nat' ? ' on' : '')} onClick={() => setTint('nat')}>Natural</button>}
                  {BODY_COLORS.map((c) => <button key={c} className={'wd-sw' + (tint === c ? ' on' : '')} style={{ background: c }} onClick={() => setTint(c)} aria-label={c} />)}
                  <label className="wd-sw wd-pick" title="Any colour">
                    <input type="color" value={HEX.test(tint) ? tint : '#7ee8c6'} onChange={(e) => setTint(e.target.value)} />🎨
                  </label>
                </div>
                {of && (
                  <>
                    <div className="sa-coltitle">{OUTFITS.find((o) => o.key === of)?.label} colour</div>
                    <div className="wd-swatches">
                      <button className={'wd-sw wd-sw-txt' + (!oc ? ' on' : '')} onClick={() => setOc('')}>Default</button>
                      {OUTFIT_COLORS.map((c) => <button key={c} className={'wd-sw' + (oc === c ? ' on' : '')} style={{ background: c }} onClick={() => setOc(c)} aria-label={c} />)}
                      <label className="wd-sw wd-pick" title="Any colour">
                        <input type="color" value={HEX.test(oc) ? oc : (OUTFITS.find((o) => o.key === of)?.color || '#ff7ab8')} onChange={(e) => setOc(e.target.value)} />🎨
                      </label>
                    </div>
                  </>
                )}
                <p className="wd-hint">Tip: the 🎨 button lets you pick any colour you like.</p>
              </>
            )}
            {tab === 'outfit' && (
              <>
                <div className="wd-tiles">
                  {OUTFITS.map((o) => (
                    <Tile key={o.key || 'none'} label={o.label} on={of === o.key} locked={!owns(owned, 'of', o.key)} price={o.price} onClick={() => setOf(o.key)}>
                      {fig({ style: { of: o.key, oc: of === o.key ? oc : '' } })}
                    </Tile>
                  ))}
                </div>
                {of && (
                  <div className="wd-inline-col">
                    <span>Colour</span>
                    <div className="wd-swatches">
                      <button className={'wd-sw wd-sw-txt' + (!oc ? ' on' : '')} onClick={() => setOc('')}>Default</button>
                      {OUTFIT_COLORS.map((c) => <button key={c} className={'wd-sw' + (oc === c ? ' on' : '')} style={{ background: c }} onClick={() => setOc(c)} aria-label={c} />)}
                      <label className="wd-sw wd-pick" title="Any colour">
                        <input type="color" value={HEX.test(oc) ? oc : (OUTFITS.find((x) => x.key === of)?.color || '#ff7ab8')} onChange={(e) => setOc(e.target.value)} />🎨
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === 'hats' && (
              <>
                <p className="wd-hint">Wear up to 6 at once. Tap again to take one off.</p>
                <div className="wd-tiles">
                  {ACCS.map((a) => (
                    <Tile key={a.key} label={a.label} on={acc.includes(a.key)} locked={!owns(owned, 'acc', a.key)} price={a.price} onClick={() => toggleAcc(a.key)}>
                      {fig({ acc: [a.key] })}
                    </Tile>
                  ))}
                </div>
              </>
            )}
            {tab === 'face' && (
              <div className="wd-tiles">
                {MAKEUPS.map((m) => (
                  <Tile key={m.key || 'none'} label={m.label} on={makeup === m.key} price={0} onClick={() => setMakeup(m.key)}>
                    {fig({ makeup: m.key }, 'happy')}
                  </Tile>
                ))}
              </div>
            )}
            {tab === 'emotes' && (
              <>
                <p className="wd-hint">Actions you can send to friends. Your pet walks over and does it on their desktop. Unlocked ones show up next to each friend.</p>
                <div className="wd-list">
                  {EMOTES.map((e) => {
                    const have = owns(owned, 'em', e.key);
                    return (
                      <div key={e.key} className={'wd-row' + (have ? '' : ' locked')}>
                        <span className="wd-emo">{e.emoji}</span><b>{e.label}</b>
                        {have ? <small className="wd-have">{e.price ? 'Unlocked' : 'Free'}</small>
                          : <button className="btn small" disabled={busy || (wallet.points || 0) < e.price} onClick={() => buy(itemId('em', e.key))}>{PT} {e.price}</button>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {tab === 'skills' && (
              <>
                <p className="wd-hint">Your pet’s special move. It does it on its own now and then, or from the pet menu. Pick one to preview it.</p>
                <div className="wd-list">
                  {SKILLS.map((s) => {
                    const have = owns(owned, 'sk', s.key);
                    return (
                      <div key={s.key || 'own'} className={'wd-row' + (sk === s.key ? ' on' : '') + (have ? '' : ' locked')} onClick={() => { setSk(s.key); setTimeout(() => poke('special'), 60); }}>
                        <span className="wd-emo">{s.emoji}</span>
                        <span className="wd-row-main"><b>{s.label}</b><small>{s.note}</small></span>
                        {have ? <small className="wd-have">{sk === s.key ? 'Selected' : s.price ? 'Unlocked' : 'Free'}</small>
                          : <span className="wd-price">{PT} {s.price}</span>}
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
