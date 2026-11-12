// Nibble renderer: world model, main loop, input, particles, speech bubbles, sounds.
(function () {
  const api = window.nibble || null; // null when opened in a plain browser (preview mode)
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const { drawPet, drawShadow } = window.NibbleDraw;
  const { pick, classifyApp } = window.NibbleLines;
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- environment shared with pets ----------
  const env = {
    world: { w: innerWidth, h: innerHeight, left: 0, right: innerWidth, top: 0, floor: innerHeight - 48, scale: 1 },
    settings: { pets: [{ id: 'a', name: 'Nibble', skin: 'mint' }], size: 1, chatty: 'normal', walkOnWindows: true, followCursor: false, reactToApps: true, hideFullscreen: true, breakMinutes: 50, sounds: false },
    skins: window.SKINS,
    platforms: [],
    winsById: new Map(),
    floorSeg: null,
    cursor: null,
    pets: [],
    time: 0,
    lastSpeech: -999,
    idle: 0,
    fg: null,
    fgCat: null,
    fgMood: null,
    emit,
    sound,
    onFirstLanding,
  };
  env.floorSeg = { winId: null, x1: 0, x2: innerWidth, y: env.world.floor };

  let rawWins = [];
  let hidden = false;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  addEventListener('resize', resize);
  resize();

  function setWorld(w) {
    env.world = w;
    env.floorSeg = { winId: null, x1: w.left, x2: w.right, y: w.floor };
    rebuildPlatforms();
  }

  // ---------- window tops → platforms ----------
  function subtract(segs, a, b) {
    const out = [];
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { out.push([s, e]); continue; }
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
    return out;
  }

  function rebuildPlatforms() {
    const w = env.world;
    const u = 1.1 * (env.settings.size || 1);
    const plats = [];
    env.winsById = new Map();
    for (const win of rawWins) env.winsById.set(win.id, win);
    for (let i = 0; i < rawWins.length; i++) {
      const win = rawWins[i];
      if (win.max) continue;
      const y = Math.round(win.y);
      if (y < w.top + 56 * u || y > w.floor - 24) continue;
      let segs = [[win.x + 6, win.x + win.w - 6]];
      // anything above this window in z-order that covers its top edge hides that part
      for (let j = 0; j < i && segs.length; j++) {
        const o = rawWins[j];
        if (o.y <= y + 2 && o.y + o.h > y) segs = subtract(segs, o.x, o.x + o.w);
      }
      for (let [a, b] of segs) {
        a = Math.max(a, w.left + 4);
        b = Math.min(b, w.right - 4);
        if (b - a >= 44 * u) plats.push({ winId: win.id, x1: a, x2: b, y });
      }
    }
    env.platforms = plats;
  }

  // pets interacting with each other (chats, fights, ice cream…) — engine lives in pet.js
  const drama = window.NibbleDrama ? window.NibbleDrama.create() : null;

  // ---------- pets ----------
  function syncPets() {
    const cfgs = env.settings.pets || [];
    const keep = [];
    cfgs.forEach((cfg, i) => {
      let p = env.pets.find((x) => x.id === cfg.id);
      if (!p) {
        p = new window.NibblePet(cfg, env, i);
        if (env.pets.length) p.greeted = true; // only the first pet greets on launch
      }
      p.name = cfg.name || p.name;
      p.skinKey = cfg.skin || p.skinKey;
      p.acc = Array.isArray(cfg.acc) ? cfg.acc : []; p.tint = cfg.tint || ''; p.makeup = cfg.makeup || '';
      p.index = i;
      keep.push(p);
    });
    for (const p of env.pets) if (!keep.includes(p) && !p.friend) emit('dust', p.x, p.y, { n: 10 });
    const friends = env.pets.filter((p) => p.friend);
    friends.forEach((p, k) => { p.index = keep.length + k; });
    env.pets = keep.concat(friends);
  }

  // ---------- particles ----------
  const parts = [];
  function emit(type, x, y, o = {}) {
    if (type === 'dust') {
      for (let i = 0; i < (o.n || 4); i++) parts.push({ type, x, y: y - 2, vx: rand(-90, 90), vy: rand(-40, -10), life: 0, max: rand(0.35, 0.6), r: rand(1.5, 3.5) });
      return;
    }
    const base = { type, x, y, vx: rand(-12, 12), vy: rand(-45, -28), life: -(o.delay || 0), max: 1.6, rot: 0 };
    if (type === 'z') Object.assign(base, { vx: 14, vy: -22, max: 2.4, text: Math.random() < 0.5 ? 'z' : 'Z' });
    if (type === 'note') Object.assign(base, { text: Math.random() < 0.5 ? '♪' : '♫', vx: rand(-30, 30), max: 1.5, color: ['#ff6fb5', '#6fd3ff', '#ffd166', '#9dff8a'][Math.floor(Math.random() * 4)] });
    if (type === 'code') Object.assign(base, { text: ['</>', '{ }', '01', 'fn()', ';', '<div>', 'px', '#fff', '=>', '++'][Math.floor(Math.random() * 10)], max: 1.4, vx: rand(-10, 20) });
    if (type === 'star') Object.assign(base, { vx: rand(-70, 70), vy: rand(-70, -30), max: 0.8 });
    if (type === 'bang') Object.assign(base, { vx: 0, vy: -40, max: 0.9 });
    if (type === 'heart') Object.assign(base, { vx: rand(-25, 25), vy: rand(-60, -40), max: 1.3 });
    parts.push(base);
  }

  function drawHeart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life < 0) continue;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt + (p.type === 'z' ? Math.sin(p.life * 3) * 0.4 : 0);
      p.y += p.vy * dt;
      if (p.type === 'dust') { p.vx *= 0.9; p.vy += 60 * dt; }
    }
  }

  function renderParts(u) {
    for (const p of parts) {
      if (p.life < 0) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * Math.min(1, p.life * 8);
      switch (p.type) {
        case 'heart': ctx.fillStyle = '#ff5d8f'; drawHeart(p.x, p.y, (9 + k * 4) * u); break;
        case 'z':
          ctx.fillStyle = '#7f8aa3';
          ctx.font = `700 ${(10 + k * 8) * u}px "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(p.text, p.x, p.y);
          break;
        case 'note': ctx.fillStyle = p.color; ctx.font = `700 ${15 * u}px "Segoe UI Symbol", "Segoe UI", sans-serif`; ctx.fillText(p.text, p.x, p.y); break;
        case 'code':
          ctx.fillStyle = '#4fd1ff';
          ctx.font = `600 ${10 * u}px Consolas, "Cascadia Code", monospace`;
          ctx.fillText(p.text, p.x, p.y);
          break;
        case 'star': ctx.fillStyle = '#ffd23f'; drawStar(p.x, p.y, 4.5 * u); break;
        case 'bang': ctx.fillStyle = '#ff4d4d'; ctx.font = `900 ${18 * u}px "Segoe UI", sans-serif`; ctx.fillText('!', p.x - 3 * u, p.y); break;
        case 'dust': ctx.fillStyle = 'rgba(160,160,170,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * u, 0, Math.PI * 2); ctx.fill(); break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- speech bubbles ----------
  function wrap(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function renderBubble(pet, u) {
    const b = pet.bubble;
    const fs = 12.5 * Math.max(0.9, Math.min(1.25, u));
    ctx.font = `600 ${fs}px "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`;
    const lines = wrap(b.text, 190 * Math.max(1, u * 0.9));
    const lh = fs * 1.3;
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = tw + 22, bh = lines.length * lh + 14;
    let headY = pet.y - 60 * u;
    let headX = pet.x;
    if (pet.state === 'climb' || pet.state === 'cling') { headY = pet.y - 30 * u; headX = pet.x + (pet.wall === 'left' ? 30 : -30) * u; }
    let bx = Math.max(6, Math.min(env.world.w - bw - 6, headX - bw / 2));
    let by = headY - bh - 10;
    let below = false;
    if (by < 6) { by = pet.y + 10; below = true; }

    const appear = Math.min(1, b.t / 0.14);
    const fade = Math.min(1, (b.dur - b.t) / 0.3);
    const sc = 0.85 + 0.15 * easeOutBack(appear);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(appear, fade));
    const ox = Math.max(bx + 12, Math.min(bx + bw - 12, headX));
    ctx.translate(ox, below ? by : by + bh);
    ctx.scale(sc, sc);
    ctx.translate(-ox, -(below ? by : by + bh));
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 11);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // tail
    ctx.beginPath();
    if (below) { ctx.moveTo(ox - 6, by + 1); ctx.lineTo(ox, by - 7); ctx.lineTo(ox + 6, by + 1); }
    else { ctx.moveTo(ox - 6, by + bh - 1); ctx.lineTo(ox, by + bh + 7); ctx.lineTo(ox + 6, by + bh - 1); }
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,35,50,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 11);
    ctx.stroke();
    ctx.fillStyle = '#1d2230';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 8 + i * lh));
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ---------- sounds (tiny synthesized blips, no audio files) ----------
  let actx = null;
  function sound(name) {
    if (!env.settings.sounds) return;
    try {
      actx = actx || new AudioContext();
      const o = actx.createOscillator();
      const g = actx.createGain();
      const t = actx.currentTime;
      const spec = {
        squeak: ['sine', 700, 1300, 0.09],
        boing: ['triangle', 320, 140, 0.22],
        pop: ['sine', 900, 260, 0.07],
        hop: ['sine', 420, 760, 0.08],
        chime: ['sine', 880, 1480, 0.32],
        nom: ['square', 330, 240, 0.05],
      }[name];
      if (!spec) return;
      o.type = spec[0];
      o.frequency.setValueAtTime(spec[1], t);
      o.frequency.exponentialRampToValueAtTime(spec[2], t + spec[3]);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec[3]);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + spec[3] + 0.02);
    } catch (_) {}
  }

  // ---------- greetings, reminders, app reactions ----------
  function onFirstLanding(pet) {
    if (env.didGreet || pet.index !== 0) return;
    env.didGreet = true;
    setTimeout(() => {
      const h = new Date().getHours();
      const cat = h < 5 ? 'greetNight' : h < 12 ? 'greetMorning' : h < 17 ? 'greetAfternoon' : h < 22 ? 'greetEvening' : 'greetNight';
      if (env.settings.chatty !== 'silent') pet.speak(env, cat, { force: true });
    }, 500);
  }

  let activeSecs = 0;
  let lastLateNight = -1;
  let wasIdle = false;
  let appTimer = null;
  let lastAppReact = -999;

  function nearestPet(x, y) {
    let best = null, bd = Infinity;
    for (const p of env.pets) {
      if (p.friend) continue; // friends' pets don't nag you about breaks
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd && !p.bubble) { bd = d; best = p; }
    }
    return best || env.pets[0];
  }

  function tickHousekeeping(dt) {
    // break reminders
    const mins = env.settings.breakMinutes || 0;
    if (env.idle < 60) activeSecs += dt;
    if (env.idle > 300) activeSecs = 0;
    if (mins && activeSecs >= mins * 60) {
      activeSecs = 0;
      const c = env.cursor || { x: env.world.w / 2, y: env.world.floor };
      const p = nearestPet(c.x, c.y);
      if (p) {
        p.say(pick('breakTime', { mins: String(mins), name: p.name }, env.about), 6);
        if (p.grounded()) { p.dir = Math.sign(c.x - p.x) || 1; p.enter('wave', 2); }
      }
    }
    // welcome back after being away
    if (env.idle > 180) wasIdle = true;
    else if (wasIdle && env.idle < 3) {
      wasIdle = false;
      for (const p of env.pets) if (p.state === 'sleep' && Math.random() < 0.7) p.enter('yawn', 1.2);
      const p = env.pets[0];
      if (p && env.settings.chatty !== 'silent') p.speak(env, 'back', { force: true });
    }
    // late night nudge, once an hour between 00:00–04:59
    const now = new Date();
    if (now.getHours() < 5 && now.getHours() !== lastLateNight && env.idle < 30 && env.time > 30) {
      lastLateNight = now.getHours();
      const p = env.pets[Math.floor(Math.random() * env.pets.length)];
      if (p) p.speak(env, 'lateNight', { kind: 'event' });
    }
  }

  function onForeground(fg) {
    const info = classifyApp(fg);
    const cat = info ? info.cat : null;
    env.fg = fg;
    env.fgMood = env.settings.reactToApps && info ? info.mood : null;
    if (cat === env.fgCat) return;
    env.fgCat = cat;
    clearTimeout(appTimer);
    if (!env.settings.reactToApps || !cat || cat === 'other' || cat === 'browser' || fg.proc === 'nibble') return;
    appTimer = setTimeout(() => {
      if (env.fgCat !== cat || env.time - lastAppReact < 45) return;
      const grounded = env.pets.filter((p) => p.grounded());
      const p = grounded[Math.floor(Math.random() * grounded.length)];
      if (!p) return;
      if (p.speak(env, cat, { kind: 'app' })) lastAppReact = env.time;
      if (info.mood === 'work' && ['idle', 'sit', 'look', 'walk'].includes(p.state) && Math.random() < 0.5) p.enter('work', rand(10, 25));
      if (info.mood === 'dance' && ['idle', 'sit', 'look', 'walk'].includes(p.state) && Math.random() < 0.6) p.enter('dance', rand(4, 8));
    }, 1800);
  }

  // ---------- input ----------
  let press = null; // { pet, x, y }
  let dragging = null;
  let ignoring = true;

  function petAt(x, y) {
    if (hidden) return null;
    for (let i = env.pets.length - 1; i >= 0; i--) if (env.pets[i].hit(x, y)) return env.pets[i];
    return null;
  }

  function updateHover(x, y) {
    const over = !!dragging || !!press || !!petAt(x, y) || social.overComposer(x, y) || !!(drama && !hidden && drama.hit(x, y));
    document.body.classList.toggle('grab', over && !dragging);
    document.body.classList.toggle('grabbing', !!dragging);
    if (api && over === ignoring) {
      ignoring = !over;
      api.setIgnore(ignoring);
    }
  }

  addEventListener('mousemove', (e) => {
    const x = e.clientX, y = e.clientY;
    env.cursor = { x, y, movedAt: env.time };
    if (press && !dragging && Math.hypot(x - press.x, y - press.y) > 5) {
      dragging = press.pet;
      dragging.startDrag(x, y);
    }
    if (dragging) dragging.dragTo(x, y, env);
    updateHover(x, y);
  });

  addEventListener('mousedown', (e) => {
    if (social.overComposer(e.clientX, e.clientY)) return;
    if (e.button === 0 && drama && drama.click(e.clientX, e.clientY, env)) return; // 🍦 "Give them ice cream"
    const p = petAt(e.clientX, e.clientY);
    if (!p) return;
    if (e.button === 0) press = { pet: p, x: e.clientX, y: e.clientY, t0: performance.now() };
  });

  addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (dragging) dragging.release(env);
    else if (press && social.held(press)) social.openComposer(press.pet);
    else if (press) press.pet.petted(env);
    dragging = null;
    press = null;
    updateHover(e.clientX, e.clientY);
  });

  addEventListener('dblclick', (e) => {
    const p = petAt(e.clientX, e.clientY);
    if (p && p.friend) { social.poke(p); return; }
    if (p) { p.backflip(env); p.speak(env, 'flip'); }
  });

  addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = petAt(e.clientX, e.clientY);
    if (p && api) { if (p.friend) api.friendMenu(p.friend.uid); else api.petMenu(p.index); }
  });

  // Draw Nibble's face for the tray icon (so the app needs no image files)
  function sendTrayIcon() {
    if (!api || !api.trayIcon) return;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const skin = env.skins[(env.settings.pets[0] || {}).skin] || env.skins.mint;
    drawPet(g, { x: 33, y: 55, dir: 1, sx: 1, sy: 1, walk: 0, t: 0.4, blink: 1, look: { x: 0, y: 0 }, eyes: 'open', mouth: 'w', arms: 'down', ears: 1, stride: 0, bob: 0, tailWag: 0.01 }, skin, 0.82);
    api.trayIcon(c.toDataURL('image/png'));
  }

  // ---------- IPC ----------
  function applySettings(s) {
    const sizeChanged = s.size !== env.settings.size;
    const skinChanged = (s.pets[0] || {}).skin !== (env.settings.pets[0] || {}).skin;
    env.settings = s;
    syncPets();
    social.sync();
    if (sizeChanged) rebuildPlatforms();
    if (skinChanged) sendTrayIcon();
  }

  if (api) {
    api.onInit((d) => {
      env.skins = d.skins || env.skins;
      env.settings = d.settings;
      setWorld(d.world);
      syncPets();
      sendTrayIcon();
    });
    api.onWorld(setWorld);
    api.onSettings(applySettings);
    api.onCursor((c) => {
      const prev = env.cursor;
      const moved = !prev || Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) > 1;
      env.cursor = { x: c.x, y: c.y, movedAt: moved ? env.time : prev.movedAt };
      if (!dragging) updateHover(c.x, c.y);
    });
    api.onIdle && api.onIdle((s) => { env.idle = s; });
    api.onWindows((d) => {
      rawWins = d.wins || [];
      rebuildPlatforms();
      if (d.fg) onForeground(d.fg);
      const h = !!(env.settings.hideFullscreen && d.fg && d.fg.fullscreen);
      if (h !== hidden) {
        hidden = h;
        document.body.classList.toggle('hidden', hidden);
        if (hidden && api) { ignoring = true; api.setIgnore(true); }
      }
    });
    api.onCommand((cmd) => {
      if (cmd.type === 'drama') { if (drama && !drama.force(env, cmd.kind)) { const p = env.pets[0]; if (p) p.say('I need a buddy nearby for that! 🫂', 3); } return; }
      if (cmd.type === 'compose') { const p = env.pets[cmd.pet || 0]; if (p && !p.friend) social.openComposer(p); return; }
      if (cmd.type === 'whisper') { const p = env.pets.find((q) => q.friend && q.friend.uid === cmd.uid); if (p) social.openComposer(p); return; }
      if (cmd.type === 'bring') { social.bring(cmd.uid); return; }
      if (cmd.type === 'sendhome') { social.sendHome(cmd.uid); return; }
      const targets = cmd.pet != null ? [env.pets[cmd.pet]].filter(Boolean) : env.pets;
      for (const p of targets) p.command(cmd, env);
    });
    api.onWatcherStatus((s) => {
      if (!s.ok && s.reason === 'helper-exit') console.warn('[nibble] window watcher exited', s);
    });
  } else {
    // ---- browser preview mode: fake a few windows you can see ----
    window.__nibbleEnv = env;
    const fake = [
      { id: '1', x: 140, y: 260, w: 520, h: 300 },
      { id: '2', x: 520, y: 150, w: 460, h: 260 },
      { id: '3', x: 900, y: 360, w: 420, h: 240 },
    ];
    const W = innerWidth, H = innerHeight;
    setWorld({ w: W, h: H, left: 0, right: W, top: 0, floor: H - 48, scale: 1 });
    rawWins = fake;
    rebuildPlatforms();
    env.settings.pets = [{ id: 'a', name: 'Nibble', skin: 'mint' }, { id: 'b', name: 'Byte', skin: 'cyber' }, { id: 'c', name: 'Pixel', skin: 'peach' }];
    env.settings.debug = true;
    env.previewWins = fake;
    window.__nibbleSetWins = (w) => { rawWins = w; env.previewWins = w; rebuildPlatforms(); };
    syncPets();
  }


  // ---------- Nibble Social: friends' pets, hold-to-talk, thinking clouds, pokes ----------
  const social = (function () {
    const D = window.NibbleSocialDraw;
    const box = document.getElementById('composer');
    const input = document.getElementById('cin');
    const label = document.getElementById('cto');
    const count = document.getElementById('ccount');
    const picker = document.getElementById('csel'); // who your own pet's message goes to
    const lastTo = () => { try { return localStorage.getItem('nibble-last-to') || ''; } catch (_) { return ''; } };
    const toKey = () => (comp && comp.to) || (picker.value === 'all' ? '' : picker.value);
    const HOLD = 0.5; // seconds to hold a pet before the text box opens
    const MAX_FRIENDS = 6;
    let st = { me: null, friends: [], prefs: {} };
    let comp = null; // { pet, to, toName }
    let typingSent = false;
    const pops = [];
    const visitors = new Map(); // uid -> until: friends' pets that stay even when the friend is offline
    const sentHome = new Map(); // uid -> until: online friends you sent home for a while
    const SAY = { wave: 'hi there! 👋', hug: 'cuddle time! 🤗', kiss: 'mwah! 😘', heart: '❤️ ❤️ ❤️', poke: 'poke! 👉', highfive: 'high five! 🙌', tickle: 'tickle tickle 🤭', cheer: 'you got this! 🎉', snack: 'brought you a cookie 🍪', dance: "let's dance! 🎶" };
    const send = (a) => api && api.socialAction(a);
    const dnd = () => !!(st.prefs && st.prefs.dnd);
    const showFriends = () => env.settings.showFriends !== false && !dnd();
    const mine = () => env.pets.find((p) => !p.friend);

    function sync() {
      const now = Date.now();
      const want = dnd() ? [] : (st.friends || []).filter((f) => (visitors.get(f.uid) || 0) > now ||
        (showFriends() && f.online && !((sentHome.get(f.uid) || 0) > now))).slice(0, MAX_FRIENDS);
      const ids = new Set(want.map((f) => f.uid));
      const own = env.pets.filter((p) => !p.friend);
      const keep = [];
      for (const p of env.pets) {
        if (!p.friend) continue;
        if (ids.has(p.friend.uid)) keep.push(p);
        else { emit('dust', p.x, p.y, { n: 10 }); if (comp && comp.pet === p) close(); }
      }
      for (const f of want) {
        let p = keep.find((q) => q.friend.uid === f.uid);
        if (!p) {
          p = new window.NibblePet({ id: 'f_' + f.uid, name: f.petName || f.username, skin: f.skin }, env, own.length + keep.length);
          p.greeted = true;
          p.speak = () => false; // a friend's pet only says what your friend types
          keep.push(p);
        }
        p.friend = f;
        p.skinKey = env.skins[f.skin] ? f.skin : 'mint';
        p.acc = Array.isArray(f.acc) ? f.acc : []; p.tint = f.tint || ''; p.makeup = f.makeup || '';
        p.name = f.petName || f.username;
      }
      keep.forEach((p, k) => { p.index = own.length + k; });
      env.pets = own.concat(keep);
    }

    function place() {
      if (!comp) return;
      const u = 1.1 * (env.settings.size || 1);
      const w = box.offsetWidth || 290, h = box.offsetHeight || 70;
      const x = Math.max(8, Math.min(env.world.w - w - 8, comp.pet.x - w / 2));
      let y = comp.pet.y - 78 * u - h;
      if (y < 8) y = comp.pet.y + 16 * u;
      box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    function openComposer(pet) {
      if (!st.me) return;
      if (pet.friend && dnd()) return;
      comp = pet.friend ? { pet, to: pet.friend.uid, toName: pet.friend.username } : { pet };
      label.textContent = comp.to ? `🔒 Private to @${comp.toName}` : '';
      label.hidden = !comp.to;
      picker.hidden = !!comp.to;
      if (!comp.to) {
        // private by default: pick a friend (last one you talked to), or "All friends"
        const fr = st.friends || [];
        picker.innerHTML = '';
        for (const f of fr) picker.add(new Option(`🔒 Private to @${f.username}${f.online ? '' : ' (offline)'}`, f.uid));
        picker.add(new Option('📣 All friends', 'all'));
        const want = lastTo();
        picker.value = fr.some((f) => f.uid === want) || want === 'all' ? want : (fr.find((f) => f.online) || fr[0] || { uid: 'all' }).uid;
      }
      input.value = '';
      count.textContent = '80';
      box.hidden = false;
      pet.bubble = null;
      if (pet.grounded && pet.grounded()) pet.enter('sit', 120);
      place();
      if (api) { ignoring = false; api.setIgnore(false); api.setFocus(true); }
      setTimeout(() => input.focus(), 30);
    }

    function close() {
      if (!comp) return;
      if (comp.pet && comp.pet.state === 'sit') comp.pet.enter('idle', 0.5);
      if (comp.pet) comp.pet.typingSelf = false;
      comp = null;
      box.hidden = true;
      if (typingSent) { send({ type: 'typing', on: false }); typingSent = false; }
      if (api) api.setFocus(false);
    }

    function submit() {
      const text = input.value.replace(/\s+/g, ' ').trim().slice(0, 80);
      const c = comp && { ...comp, pickTo: comp.to ? null : picker.value };
      if (c && c.pickTo) { try { localStorage.setItem('nibble-last-to', c.pickTo); } catch (_) {} }
      close();
      if (!text || !c) return;
      const me = mine();
      if (c.to) {
        send({ type: 'send', to: c.to, kind: 'whisper', text });
        if (me) { me.bubble = null; me.say(`🔒 → @${c.toName}: ${text}`, 4); }
      } else if (c.pickTo && c.pickTo !== 'all') {
        // private message from your own pet
        const f = (st.friends || []).find((x) => x.uid === c.pickTo);
        send({ type: 'send', to: c.pickTo, kind: 'whisper', text });
        c.pet.bubble = null;
        c.pet.say(`🔒 @${f ? f.username : 'friend'}: ${text}`, Math.min(9, 3 + text.length * 0.08));
        c.pet.enter('wave', 1.2);
      } else {
        send({ type: 'say', text });
        c.pet.bubble = null;
        c.pet.say(text, Math.min(9, 3 + text.length * 0.08));
        c.pet.enter('wave', 1.2);
      }
    }

    input.addEventListener('input', () => {
      count.textContent = String(80 - input.value.length);
      if (!comp) return;
      const on = input.value.trim().length > 0;
      if (!comp.to) comp.pet.typingSelf = on;
      // the thinking cloud only shows for the friend you're writing to
      const key = on ? 'on:' + toKey() : false;
      if (key !== typingSent) { send({ type: 'typing', on, to: toKey() }); typingSent = key; }
    });
    picker.addEventListener('change', () => { typingSent = false; input.focus(); input.dispatchEvent(new Event('input')); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(() => { if (comp && !box.contains(document.activeElement)) close(); }, 150));
    picker.addEventListener('blur', () => setTimeout(() => { if (comp && !box.contains(document.activeElement)) close(); }, 150));

    function popOn(p, text) { pops.push({ text, x: p.x, y: p.y - 70, t: 0, max: 1.6, size: 26 }); }

    // a friend's pet on this desktop; brings it over (as a visitor) if it isn't here yet
    function petOf(uid, secs) {
      if (secs) { visitors.set(uid, Math.max(visitors.get(uid) || 0, Date.now() + secs * 1000)); sentHome.delete(uid); }
      let p = env.pets.find((q) => q.friend && q.friend.uid === uid);
      if (!p && secs) { sync(); p = env.pets.find((q) => q.friend && q.friend.uid === uid); }
      return p || null;
    }

    function bring(uid) {
      const p = petOf(uid, 30 * 60);
      if (p) { p.bubble = null; p.say('Hi! 👋 I\'ll hang out here for a bit', 4); }
    }
    function sendHome(uid) {
      visitors.delete(uid);
      sentHome.set(uid, Date.now() + 30 * 60 * 1000);
      sync();
    }

    // ---- deadline reminders: your own pet drops in by your cursor and tells you ----
    // If you're away (idle) or a fullscreen app has hidden the pets, it waits until you're back.
    const pendingRem = [];
    function remind(m) {
      if (hidden || env.idle > 90) { if (!pendingRem.some((x) => x.id === m.id)) pendingRem.push(m); return; }
      const me = mine();
      if (!me) return;
      me.command({ type: 'summon' }, env); // falls in right above the cursor (and un-poofs it)
      sound('chime');
      setTimeout(() => {
        me.bubble = null;
        me.say(String(m.text || '').slice(0, 140), 12);
        if (me.grounded && me.grounded()) me.enter('wave', 1.8);
        popOn(me, '⏰');
        for (let i = 0; i < 3; i++) emit('bang', me.x, me.y - 55, { delay: i * 0.15 });
      }, 1100);
    }
    setInterval(() => { if (pendingRem.length && !hidden && env.idle < 5) remind(pendingRem.shift()); }, 2000);

    function onEvent(m) {
      if (m && m.kind === 'reminder') { remind(m); return; } // your own reminders ignore do-not-disturb
      if (!m || m.mine || dnd()) return;
      const me = mine();
      // everything a friend sends is delivered by THEIR pet, so it comes over if it isn't here yet
      const here = env.pets.some((q) => q.friend && q.friend.uid === m.from);
      const from = petOf(m.from, m.kind === 'visit' ? 10 * 60 : here ? 0 : 90);
      if (m.kind === 'say' || m.kind === 'whisper') {
        if (from) {
          from.bubble = null;
          from.say(m.text, Math.min(10, 3.5 + m.text.length * 0.08));
          if (from.grounded()) from.enter('wave', 1);
          if (m.kind === 'whisper') popOn(from, '💬');
        } else if (me) { me.bubble = null; me.say(`@${m.fromName}: ${m.text}`, 6); }
        return;
      }
      if (m.kind === 'visit') {
        if (from) { from.bubble = null; from.say(`Hi! @${m.fromName} sent me to visit 👋`, 5); }
        return;
      }
      if (!me) return;
      const EM = { wave: '👋', hug: '🤗', kiss: '😘', heart: '❤️', poke: '👉', highfive: '🙌', tickle: '🤭', cheer: '🎉', snack: '🍪', dance: '🎶' };
      popOn(me, EM[m.kind] || '✨');
      if (from) { popOn(from, EM[m.kind] || '✨'); from.bubble = null; from.say(SAY[m.kind] || 'hi!', 3.5); }
      me.bubble = null;
      const what = { wave: 'waves at you', hug: 'gave you a big cuddle', kiss: 'sent you a smooch', heart: 'sent you a heart', poke: 'poked you!', highfive: 'wants a high five', tickle: 'is tickling you', cheer: 'is cheering you on', snack: 'shared a snack', dance: 'wants to dance' }[m.kind] || 'says hi';
      if ((m.kind === 'hug' || m.kind === 'kiss') && from && me.grounded()) {
        // the friend's pet pops over to snuggle up next to yours (or drops in right beside it)
        const u = 1.1 * (env.settings.size || 1), side = from.x < me.x ? -1 : 1;
        emit('dust', from.x, from.y, { n: 6 });
        from.x = me.x + side * 44 * u;
        if (from.grounded()) { from.y = me.y; from.support = me.support; from.seg = me.seg; from.enter('happy', 2.2); }
        from.dir = -side; me.dir = side;
      }
      if (!from) me.say(`@${m.fromName} ${what}`, 3.5);
      if (m.kind === 'poke') { me.enter('dizzy', 1.2); sound('boing'); }
      else if (m.kind === 'dance') { me.command({ type: 'dance' }, env); if (from) from.command({ type: 'dance' }, env); }
      else if (m.kind === 'tickle') { me.enter('dizzy', 1); me.say(`hehe @${m.fromName} stoppp 🤭`, 3); }
      else if (m.kind === 'cheer') { me.backflip(env); for (let i = 0; i < 5; i++) emit('star', me.x, me.y - 40, { delay: i * 0.08 }); }
      else if (['heart', 'snack', 'hug', 'kiss'].includes(m.kind)) { me.enter('happy', 2); for (let i = 0; i < 5; i++) emit('heart', me.x + (i - 2) * 6, me.y - 40, { delay: i * 0.12 }); }
      else me.enter('wave', 1.4);
    }

    function poke(p) {
      if (!p.friend) return;
      send({ type: 'send', to: p.friend.uid, kind: 'poke', text: '' });
      popOn(p, '👉');
      p.enter('dizzy', 1);
      sound('pop');
    }

    // click-and-hold a pet (without moving), release → type. Moving turns it into a normal drag.
    const held = (pr) => !!st.me && (performance.now() - pr.t0) / 1000 >= HOLD;

    let expireT = 0;
    function tick(dt) {
      if (comp) place();
      expireT += dt || 0;
      if (expireT > 2) {
        expireT = 0;
        const now = Date.now();
        let changed = false;
        for (const [uid, until] of visitors) if (until < now) { visitors.delete(uid); changed = true; }
        for (const [uid, until] of sentHome) if (until < now) { sentHome.delete(uid); changed = true; }
        if (changed) sync();
      }
    }

    function draw(g, u, sorted) {
      if (!D || hidden) return;
      for (const p of sorted) {
        if (p.friend) {
          D.nameTag(g, p, u, '@' + p.friend.username, !p.friend.online ? '#9aa3c2' : p.friend.dnd ? '#ffd166' : '#7ee8c6');
          if (p.friend.typing && !p.bubble) D.thought(g, p, u, env.time);
        } else if (p.typingSelf && !p.bubble) D.thought(g, p, u, env.time);
      }
      if (press && !dragging && !comp && st.me) {
        const k = ((performance.now() - press.t0) / 1000 - 0.15) / (HOLD - 0.15);
        if (k > 0) D.holdRing(g, press.pet, u, Math.min(1, k));
        if (k >= 1 && !press.ready) { press.ready = true; press.pet.sx = 1.12; press.pet.sy = 0.9; sound('pop'); }
      }
      for (let i = pops.length - 1; i >= 0; i--) if (!D.pop(g, pops[i], 1 / 60)) pops.splice(i, 1);
    }

    function overComposer(x, y) {
      if (!comp) return false;
      const r = box.getBoundingClientRect();
      return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
    }

    if (api && api.onSocial) {
      api.onSocial((s) => { st = s || st; env.about = (st.me && st.me.about) || null; sync(); });
      api.onSocialEvent(onEvent);
    }
    return { sync, tick, draw, poke, openComposer, overComposer, close, held, bring, sendHome };
  })();

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
   try {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    env.time += dt;
    const u = 1.1 * (env.settings.size || 1);

    for (const p of env.pets) { try { p.update(dt, env); } catch (e) { if (window.console) console.warn('[nibble] update', e); } }
    if (drama && !hidden) { try { drama.tick(env, dt); } catch (e) { if (window.console) console.warn('[nibble] drama', e); } }
    social.tick(dt);
    updateParts(dt);
    tickHousekeeping(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    if (env.previewWins) {
      for (const w of env.previewWins.slice().reverse()) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = '#c9ced8';
        ctx.beginPath(); ctx.roundRect(w.x, w.y, w.w, w.h, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#eef0f4'; ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, 30);
      }
      ctx.fillStyle = 'rgba(30,32,40,0.9)'; ctx.fillRect(0, env.world.floor, innerWidth, innerHeight - env.world.floor);
    }
    if (env.settings.debug) {
      ctx.strokeStyle = 'rgba(255,0,120,0.7)';
      ctx.lineWidth = 2;
      for (const p of env.platforms) { ctx.beginPath(); ctx.moveTo(p.x1, p.y); ctx.lineTo(p.x2, p.y); ctx.stroke(); }
    }

    const sorted = env.pets.slice().sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const skin = env.skins[p.skinKey] || env.skins.mint;
      if (!skin.neon && p.skinKey === 'cyber') skin.neon = true;
      if (p.support && p.state !== 'drag') drawShadow(ctx, p.x, p.y, u, 1);
      else if (p.state !== 'climb' && p.state !== 'cling') {
        // shadow on whatever is below
        const k = Math.max(0, 1 - (env.world.floor - p.y) / 500);
        if (k > 0) drawShadow(ctx, p.x, env.world.floor, u, k);
      }
      try { drawPet(ctx, p.pose(), skin, u); } catch (e) { if (window.console) console.warn('[nibble] draw', e); }
    }
    renderParts(u);
    if (drama) { try { drama.draw(ctx, env, u); } catch (e) { if (window.console) console.warn('[nibble] drama draw', e); } }
    for (const p of sorted) if (p.bubble) renderBubble(p, u);
    social.draw(ctx, u, sorted);
   } catch (e) { if (window.console) console.warn('[nibble] frame', e); }
   // Always schedule the next frame — a single bad frame must never kill the whole loop.
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
