'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import PetFigure, { useNibble } from './PetFigure';
import { createStage } from '../lib/stage';
import { CHARACTERS } from '../lib/characters';
import release from '../public/version.json';

const TASKBAR = 46; // must match lib/stage.js

const APPS = {
  code: { name: 'Visual Studio Code', title: 'pet.js — nibble — Visual Studio Code', proc: 'code', glyph: '</>' },
  figma: { name: 'Figma', title: 'Poster v3 – Figma', proc: 'figma', glyph: '◆' },
  spotify: { name: 'Spotify', title: 'Spotify — lo-fi beats to design to', proc: 'spotify', glyph: '♫' },
  term: { name: 'Terminal', title: 'Windows PowerShell', proc: 'windowsterminal', glyph: '›_' },
  notes: { name: 'Notepad', title: 'todo.txt – Notepad', proc: 'notepad', glyph: '≡' },
};
const PINNED = ['code', 'figma', 'spotify', 'term', 'notes', 'nibble', 'get'];
const PIN_LABEL = { nibble: 'Nibble', get: 'Get Nibble' };

function layout(w, h) {
  const H = h - TASKBAR;
  if (w < 640) return [
    { id: 'code', x: w * 0.3, y: H * 0.14, w: w * 0.66, h: H * 0.3 },
    { id: 'figma', x: w * 0.05, y: H * 0.38, w: w * 0.62, h: H * 0.3 },
    { id: 'spotify', x: w * 0.28, y: H * 0.68, w: w * 0.66, h: H * 0.22 },
  ];
  const s = Math.min(1, w / 1150);
  return [
    { id: 'code', x: w * 0.13, y: H * 0.34, w: 450 * s, h: 250 * s + 20 },
    { id: 'figma', x: w * 0.38, y: H * 0.14, w: 430 * s, h: 250 * s + 10 },
    { id: 'spotify', x: w * 0.67, y: H * 0.46, w: 320 * s, h: 160 * s + 20 },
    { id: 'term', x: w * 0.55, y: H * 0.7, w: 300 * s, h: 110 },
  ];
}

export function AppIcon({ id, size = 'md' }) {
  return <span className={`ai ai-${id} ai-${size}`} aria-hidden="true">{id === 'nibble' ? <Paw /> : id === 'get' ? '⬇' : APPS[id]?.glyph}</span>;
}

function Paw() {
  return (
    <svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor"><ellipse cx="12" cy="15.5" rx="5.2" ry="4.4" /><circle cx="6" cy="9.5" r="2.2" /><circle cx="10" cy="6.2" r="2.2" /><circle cx="14" cy="6.2" r="2.2" /><circle cx="18" cy="9.5" r="2.2" /></svg>
  );
}

function WinBody({ id }) {
  if (id === 'code') return (
    <div className="vsc">
      <div className="vsc-side"><i /><i /><i /><i /></div>
      <pre className="code">
        <span className="ln">1</span><span className="c">{'// Nibble walks on this title bar'}</span>{'\n'}
        <span className="ln">2</span><span className="k">class</span> <span className="t">Pet</span> {'{'}{'\n'}
        <span className="ln">3</span>{'  '}<span className="f">special</span>() {'{'}{'\n'}
        <span className="ln">4</span>{'    '}<span className="k">this</span>.<span className="f">say</span>(<span className="s">'Shadow step!'</span>);{'\n'}
        <span className="ln">5</span>{'    '}<span className="k">return</span> <span className="n">true</span>;{'\n'}
        <span className="ln">6</span>{'  }'}{'\n'}
        <span className="ln">7</span>{'}'}
      </pre>
    </div>
  );
  if (id === 'figma') return (
    <div className="figma">
      <div className="fg-side"><i /><i /><i /><i /><i /></div>
      <div className="fg-canvas"><div className="fg-frame"><b>SUMMER</b><span>SALE</span><em /></div></div>
    </div>
  );
  if (id === 'spotify') return (
    <div className="spot">
      <div className="art" />
      <div className="spot-meta"><b>Coffee & Kerning</b><span>lo-fi designer</span><div className="bar"><i /></div><div className="ctrls">⏮ ⏯ ⏭</div></div>
    </div>
  );
  if (id === 'notes') return <pre className="notes">{'- ship nibble v1.3 ✓\n- feed the pets\n- kern the poster\n- touch grass (optional)'}</pre>;
  return <pre className="code term">PS C:\Users\uvi&gt; npm run dev{'\n'}<span className="g">✓ Ready in 1.2s</span>{'\n'}PS C:\Users\uvi&gt; <span className="cur">_</span></pre>;
}

export default function Desktop() {
  const ready = useNibble();
  const screenEl = useRef(null);
  const canvasEl = useRef(null);
  const stage = useRef(null);
  const wins = useRef([]); // top-most first
  const winDrag = useRef(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);
  const [fly, setFly] = useState(null); // 'start' | 'nibble' | null
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState({ follow: false, debug: false, size: 1 });
  const [count, setCount] = useState(0);
  const [now, setNow] = useState(null);

  const getWins = useCallback(() => wins.current.filter((w) => w.open && !w.min).map(({ id, x, y, w, h }) => ({ id, x, y, w, h })), []);

  useEffect(() => {
    if (!ready) return;
    const el = screenEl.current;
    const r = el.getBoundingClientRect();
    wins.current = layout(r.width, r.height).map((w) => ({ ...w, open: true, min: false, max: false }));
    rerender();
    const s = createStage({ canvas: canvasEl.current, getWins });
    stage.current = s;
    s.addPet('mojo');
    setTimeout(() => { s.addPet('kumo'); setCount(s.env.pets.length); }, 700);
    setTimeout(() => { s.addPet('mint'); setCount(s.env.pets.length); }, 1400);
    setCount(1);
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(el);
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 15000);
    const onAdd = (e) => {
      if (s.env.pets.length >= 10) s.removePet();
      const p = s.addPet(e.detail);
      p.x = s.env.world.w / 2;
      setCount(s.env.pets.length);
    };
    window.addEventListener('nibble:add', onAdd);
    return () => { s.destroy(); ro.disconnect(); clearInterval(t); window.removeEventListener('nibble:add', onAdd); };
  }, [ready, getWins, rerender]);

  const local = (e) => {
    const r = screenEl.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const focusWin = (id) => {
    const list = wins.current;
    const i = list.findIndex((w) => w.id === id);
    if (i < 0) {
      const r = screenEl.current.getBoundingClientRect();
      list.unshift({ id, x: r.width * 0.3, y: (r.height - TASKBAR) * 0.25, w: Math.min(360, r.width * 0.6), h: 190, open: true, min: false, max: false });
    } else {
      const [w] = list.splice(i, 1);
      w.open = true;
      w.min = false;
      list.unshift(w);
    }
    stage.current?.rebuild();
    stage.current?.setForeground(APPS[id].proc, APPS[id].title);
    rerender();
  };

  const minimize = (id) => {
    const w = wins.current.find((x) => x.id === id);
    if (w) w.min = true;
    stage.current?.rebuild();
    rerender();
  };

  const close = (id) => {
    const w = wins.current.find((x) => x.id === id);
    if (w) { w.open = false; w.min = false; }
    stage.current?.rebuild();
    rerender();
  };

  const toggleMax = (id) => {
    const w = wins.current.find((x) => x.id === id);
    if (!w) return;
    const r = screenEl.current.getBoundingClientRect();
    if (w.max) Object.assign(w, w.prev, { max: false });
    else { w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }; Object.assign(w, { x: 0, y: 0, w: r.width, h: r.height - TASKBAR, max: true }); }
    focusWin(id);
  };

  const taskbarClick = (id) => {
    const w = wins.current.find((x) => x.id === id);
    if (w && w.open && !w.min && wins.current.find((x) => x.open && !x.min) === w) minimize(id);
    else focusWin(id);
  };

  const onDownCapture = (e) => {
    const s = stage.current;
    if (!s) return;
    const [x, y] = local(e);
    if (s.down(x, y)) {
      e.stopPropagation();
      e.preventDefault();
      screenEl.current.setPointerCapture(e.pointerId);
    }
  };

  const onMove = (e) => {
    const s = stage.current;
    if (!s) return;
    const [x, y] = local(e);
    s.move(x, y);
    const d = winDrag.current;
    if (d) {
      const R = screenEl.current.getBoundingClientRect();
      if (d.win.max) { Object.assign(d.win, d.win.prev, { max: false }); d.dx = Math.min(d.dx, d.win.w - 60); }
      d.win.x = Math.max(-d.win.w + 80, Math.min(R.width - 80, x - d.dx));
      d.win.y = Math.max(0, Math.min(R.height - TASKBAR - 34, y - d.dy));
      s.rebuild();
      rerender();
    }
    screenEl.current.style.cursor = s.over(x, y) ? 'grab' : '';
  };

  const onUp = () => { stage.current?.up(); winDrag.current = null; };

  const startWinDrag = (e, win) => {
    if (e.target.closest('button')) return;
    const [x, y] = local(e);
    focusWin(win.id);
    winDrag.current = { win, dx: x - win.x, dy: y - win.y };
    screenEl.current.setPointerCapture(e.pointerId);
  };

  const cmd = (type) => { stage.current?.command(type); };
  const add = (skin) => {
    const s = stage.current;
    if (!s) return;
    if (s.env.pets.length >= 10) return;
    s.addPet(skin);
    setCount(s.env.pets.length);
  };
  const setAll = (skin) => {
    const s = stage.current;
    if (!s) return;
    s.env.pets.forEach((p) => { p.skinKey = skin; p.sp = null; p.alpha = 1; });
  };
  const toggle = (k) => setOpts((o) => {
    const n = { ...o, [k]: !o[k] };
    if (stage.current) { stage.current.env.settings.followCursor = n.follow; stage.current.env.settings.debug = n.debug; }
    return n;
  });
  const setSize = (v) => {
    setOpts((o) => ({ ...o, size: v }));
    if (stage.current) { stage.current.env.settings.size = v; stage.current.rebuild(); }
  };

  const pin = (id) => {
    setFly(null);
    if (id === 'nibble') setTimeout(() => setFly('nibble'), 0);
    else if (id === 'get') document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
    else focusWin(id);
  };

  // stable DOM order (moving nodes mid-click swallows the click); stacking via z-index
  const ordered = wins.current.slice().sort((a, b) => a.id.localeCompare(b.id));
  const zOf = (w) => 30 - wins.current.indexOf(w);
  const topOpen = wins.current.find((x) => x.open && !x.min);
  const skins = ready && typeof window !== 'undefined' ? window.SKINS : null;
  const pinned = PINNED.filter((id) => (APPS[id]?.name || PIN_LABEL[id]).toLowerCase().includes(q.toLowerCase()));
  const time = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const date = now ? now.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  return (
    <div className="pc">
      <div className="monitor">
        <div className="bezel">
          <span className="cam" />
          <div
            className="screen"
            ref={screenEl}
            onPointerDownCapture={onDownCapture}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => stage.current?.leave()}
            onDoubleClick={(e) => { const [x, y] = local(e); stage.current?.dbl(x, y); }}
          >
            <div className="wall" onPointerDown={() => setFly(null)} />

            <div className="icons" onPointerDown={() => setFly(null)}>
              <button className="dicon" onDoubleClick={() => cmd('summon')} title="Double-click: call the pets"><AppIcon id="nibble" size="lg" /><span>Nibble</span></button>
              <button className="dicon" onDoubleClick={() => focusWin('notes')}><AppIcon id="notes" size="lg" /><span>todo.txt</span></button>
              <a className="dicon" href="/install.cmd" download="Install Nibble.cmd"><AppIcon id="get" size="lg" /><span>Install Nibble.cmd</span></a>
            </div>

            {ordered.filter((w) => w.open && !w.min).map((w) => {
              const a = APPS[w.id];
              return (
                <div key={w.id} className={'win' + (topOpen === w ? ' active' : '') + (w.max ? ' max' : '')} style={{ left: w.x, top: w.y, width: w.w, height: w.h, zIndex: zOf(w) }} onPointerDown={() => { setFly(null); if (topOpen !== w) focusWin(w.id); }}>
                  <div className="win-title" onPointerDown={(e) => startWinDrag(e, w)} onDoubleClick={() => toggleMax(w.id)}>
                    <AppIcon id={w.id} size="sm" />
                    <span className="win-name">{a.title}</span>
                    <span className="win-btns">
                      <button aria-label="Minimise" onClick={() => minimize(w.id)}>─</button>
                      <button aria-label="Maximise" onClick={() => toggleMax(w.id)}>{w.max ? '❐' : '☐'}</button>
                      <button aria-label="Close" className="x" onClick={() => close(w.id)}>✕</button>
                    </span>
                  </div>
                  <div className="win-body"><WinBody id={w.id} /></div>
                </div>
              );
            })}

            <canvas ref={canvasEl} className="pg-canvas" />

            {fly === 'start' && (
              <div className="fly start" onPointerDown={(e) => e.stopPropagation()}>
                <input className="st-search" placeholder="Search for apps, settings and pets" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                <div className="st-h">Pinned</div>
                <div className="st-grid">
                  {pinned.map((id) => (
                    <button key={id} onClick={() => pin(id)}><AppIcon id={id} size="lg" /><span>{APPS[id]?.name || PIN_LABEL[id]}</span></button>
                  ))}
                  {!pinned.length && <p className="st-empty">No matches. Nibble looked everywhere 🐾</p>}
                </div>
                <div className="st-h">Recommended</div>
                <ul className="st-rec">
                  <li onClick={() => pin('figma')}><AppIcon id="figma" size="sm" /><span>poster_final_v3.fig<small>2m ago</small></span></li>
                  <li onClick={() => pin('code')}><AppIcon id="code" size="sm" /><span>pet.js<small>12m ago</small></span></li>
                  <li onClick={() => pin('notes')}><AppIcon id="notes" size="sm" /><span>todo.txt<small>Yesterday</small></span></li>
                  <li onClick={() => pin('spotify')}><AppIcon id="spotify" size="sm" /><span>Coffee & Kerning<small>Playlist</small></span></li>
                </ul>
                <div className="st-foot">
                  <span className="avatar">U</span><b>Uvi</b>
                  <button className="power" title="Nap time for all pets" onClick={() => { cmd('sleep'); setFly(null); }}>⏻</button>
                </div>
              </div>
            )}

            {fly === 'nibble' && (
              <div className="fly nibm" onPointerDown={(e) => e.stopPropagation()}>
                <div className="nib-head"><AppIcon id="nibble" size="md" /><div><b>Nibble</b><span>{count} pet{count === 1 ? '' : 's'} · v{release.version}</span></div></div>
                <div className="nib-grid">
                  <button onClick={() => cmd('special')}>✨ Special moves</button>
                  <button onClick={() => cmd('dance')}>🎵 Dance</button>
                  <button onClick={() => cmd('summon')}>☁️ Drop from sky</button>
                  <button onClick={() => cmd('say')}>💬 Say something</button>
                  <button onClick={() => cmd('sleep')}>😴 Nap time</button>
                  <button onClick={() => cmd('wake')}>⏰ Wake up</button>
                </div>
                <div className="nib-h">Add a pet <small>({count}/10)</small></div>
                <div className="swatches big">
                  {skins && CHARACTERS.map((c) => (
                    <button key={c.key} title={`${c.name} · ${c.role}`} onClick={() => add(c.key)} style={{ background: skins[c.key].body, borderColor: skins[c.key].kit ? skins[c.key].glow : 'rgba(255,255,255,.25)' }} />
                  ))}
                </div>
                <div className="nib-h">Character for everyone</div>
                <div className="swatches">
                  {skins && CHARACTERS.map((c) => (
                    <button key={c.key} title={c.name} onClick={() => setAll(c.key)} style={{ background: skins[c.key].body }} />
                  ))}
                </div>
                <div className="nib-row">
                  <label><input type="checkbox" checked={opts.follow} onChange={() => toggle('follow')} /> Follow my cursor</label>
                  <label><input type="checkbox" checked={opts.debug} onChange={() => toggle('debug')} /> Show platforms</label>
                </div>
                <div className="nib-row">
                  <label className="grow">Size <input type="range" min="0.65" max="1.65" step="0.05" value={opts.size} onChange={(e) => setSize(+e.target.value)} /></label>
                  <button className="ghost" onClick={() => { stage.current?.removePet(); setCount(stage.current?.env.pets.length || 0); }} disabled={count <= 1}>Remove one</button>
                </div>
              </div>
            )}

            <div className="taskbar">
              <div className="tb-mid">
                <button className={'tb-btn start-btn' + (fly === 'start' ? ' on' : '')} onClick={() => setFly(fly === 'start' ? null : 'start')} aria-label="Start"><span className="winlogo"><i /><i /><i /><i /></span></button>
                <button className="tb-search" onClick={() => setFly('start')}>🔍 <span>Search</span></button>
                {Object.keys(APPS).map((id) => {
                  const w = wins.current.find((x) => x.id === id && x.open);
                  return (
                    <button key={id} className={'tb-btn' + (w ? ' open' : '') + (w && topOpen === w ? ' active' : '')} onClick={() => taskbarClick(id)} title={APPS[id].name}>
                      <AppIcon id={id} size="md" />
                    </button>
                  );
                })}
              </div>
              <div className="tb-tray">
                <span className="tray-chev">⌃</span>
                <button className={'tray-nib' + (fly === 'nibble' ? ' on' : '')} onClick={() => setFly(fly === 'nibble' ? null : 'nibble')} title="Nibble">
                  <AppIcon id="nibble" size="sm" />
                  {fly !== 'nibble' && <span className="ping" />}
                </button>
                <span className="tray-sys" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" fill="currentColor" /></svg>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
                  <svg viewBox="0 0 28 24" width="18" height="15" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="21" height="12" rx="3" /><rect x="5" y="9" width="13" height="6" rx="1" fill="currentColor" stroke="none" /><path d="M25 10v4" strokeLinecap="round" /></svg>
                </span>
                <span className="tray-clock"><b>{time}</b><small>{date}</small></span>
              </div>
            </div>
            {!ready && <div className="pg-loading">Booting Windows… waking Nibble…</div>}
          </div>
        </div>
        <div className="chin"><span>nibble</span></div>
      </div>
      <div className="stand"><i /></div>
      <div className="pc-hints">
        <span><kbd>Drag</kbd> &amp; <kbd>throw</kbd> pets</span>
        <span><kbd>Double-click</kbd> backflip</span>
        <span>Click the <b>paw</b> in the tray for the Nibble menu</span>
        <span>Open <b>Start</b>, maximise a window under a pet, or focus <b>VS Code</b> / <b>Spotify</b></span>
      </div>
    </div>
  );
}
