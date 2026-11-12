// Runs the real Nibble engine (public/nibble/engine/*) on a fake desktop inside the page.
const TASKBAR = 46;
const rand = (a, b) => a + Math.random() * (b - a);
let uid = 0;

export function createStage({ canvas, getWins, hooks = {} }) {
  const { drawPet, drawShadow } = window.NibbleDraw;
  const { pick, classifyApp } = window.NibbleLines;
  const ctx = canvas.getContext('2d');
  const FONT = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'; // canvas can't read CSS vars
  let dpr = 1, raf = 0, last = performance.now(), lastInput = performance.now();
  const parts = [];
  // pets interacting with each other (chats, fights, ice cream…) — lives in engine/pet.js
  const drama = window.NibbleDrama ? window.NibbleDrama.create() : null;

  const env = {
    world: { w: 800, h: 500, left: 0, right: 800, top: 0, floor: 454 },
    settings: { pets: [], size: 1, chatty: 'chatty', walkOnWindows: true, followCursor: false, reactToApps: true, sounds: false, debug: false },
    skins: window.SKINS, platforms: [], winsById: new Map(), floorSeg: null, cursor: null, pets: [],
    time: 0, lastSpeech: -999, idle: 0, fgMood: null, fgCat: null,
    emit, sound() {},
    onFirstLanding(p) {
      if (env.greeted || p.index !== 0) return;
      env.greeted = true;
      setTimeout(() => p.say('Hi! Drag me around. Then drag a window with me on it 🪟', 5), 400);
    },
  };

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    env.world = { w: r.width, h: r.height, left: 0, right: r.width, top: 0, floor: r.height - TASKBAR };
    env.floorSeg = { winId: null, x1: 0, x2: r.width, y: env.world.floor };
    rebuild();
  }

  function subtract(segs, a, b) {
    const out = [];
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { out.push([s, e]); continue; }
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
    return out;
  }

  // window tops → one-way platforms, minus parts hidden by windows stacked above
  function rebuild() {
    const wins = getWins(), w = env.world, u = 1.1 * env.settings.size, plats = [];
    env.winsById = new Map(wins.map((x) => [x.id, x]));
    wins.forEach((win, i) => {
      const y = Math.round(win.y);
      if (y < w.top + 56 * u || y > w.floor - 24) return;
      let segs = [[win.x + 6, win.x + win.w - 6]];
      for (let j = 0; j < i && segs.length; j++) {
        const o = wins[j];
        if (o.y <= y + 2 && o.y + o.h > y) segs = subtract(segs, o.x, o.x + o.w);
      }
      for (let [a, b] of segs) {
        a = Math.max(a, 4); b = Math.min(b, w.right - 4);
        if (b - a >= 44 * u) plats.push({ winId: win.id, x1: a, x2: b, y });
      }
    });
    env.platforms = plats;
  }

  function addPet(skin, name, extra) {
    const cfg = { id: 'p' + ++uid, name: name || ['Nibble', 'Byte', 'Pixel', 'Mochi', 'Glitch', 'Kilo', 'Cache', 'Sprite', 'Pico'][env.pets.length % 9], skin };
    env.settings.pets.push(cfg);
    const p = new window.NibblePet(cfg, env, env.pets.length);
    if (extra) Object.assign(p, extra);
    p.x = Math.min(env.world.w - 40, Math.max(40, rand(env.world.w * 0.2, env.world.w * 0.8)));
    if (env.pets.length) p.greeted = true;
    env.pets.push(p);
    return p;
  }

  function removePet() {
    if (env.pets.length <= 1) return;
    const p = env.pets.pop();
    env.settings.pets.pop();
    emit('dust', p.x, p.y, { n: 10 });
  }

  function removePetObj(p) {
    const i = env.pets.indexOf(p);
    if (i < 0) return;
    env.pets.splice(i, 1);
    env.settings.pets = env.settings.pets.filter((c) => c.id !== p.id);
    env.pets.forEach((q, k) => { q.index = k; });
    emit('dust', p.x, p.y, { n: 10 });
  }

  function setForeground(proc, title) {
    const fg = { proc, title };
    const info = classifyApp(fg);
    env.fgMood = info ? info.mood : null;
    if (!info || info.cat === env.fgCat) return;
    env.fgCat = info.cat;
    const grounded = env.pets.filter((p) => p.grounded());
    const p = grounded[Math.floor(Math.random() * grounded.length)];
    if (!p) return;
    p.speak(env, info.cat, { force: true });
    if (info.mood === 'work') p.enter('work', rand(8, 14));
    if (info.mood === 'dance') p.enter('dance', rand(4, 7));
  }

  // ---------- particles ----------
  function emit(type, x, y, o = {}) {
    if (type === 'dust') {
      for (let i = 0; i < (o.n || 4); i++) parts.push({ type, x, y: y - 2, vx: rand(-90, 90), vy: rand(-40, -10), life: 0, max: rand(0.35, 0.6), r: rand(1.5, 3.5) });
      return;
    }
    const b = { type, x, y, vx: rand(-12, 12), vy: rand(-45, -28), life: -(o.delay || 0), max: 1.6 };
    if (type === 'z') Object.assign(b, { vx: 14, vy: -22, max: 2.4, text: Math.random() < 0.5 ? 'z' : 'Z' });
    if (type === 'note') Object.assign(b, { text: Math.random() < 0.5 ? '♪' : '♫', vx: rand(-30, 30), max: 1.5, color: ['#ff6fb5', '#6fd3ff', '#ffd166', '#9dff8a'][Math.floor(Math.random() * 4)] });
    if (type === 'code') Object.assign(b, { text: ['</>', '{ }', '01', 'fn()', ';', '<div>', 'px', '#fff', '=>'][Math.floor(Math.random() * 9)], max: 1.4 });
    if (type === 'star') Object.assign(b, { vx: rand(-70, 70), vy: rand(-70, -30), max: 0.8 });
    if (type === 'bang') Object.assign(b, { vx: 0, vy: -40, max: 0.9 });
    if (type === 'heart') Object.assign(b, { vx: rand(-25, 25), vy: rand(-60, -40), max: 1.3 });
    parts.push(b);
  }

  function heart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }

  function renderParts(dt, u) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life < 0) continue;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'dust') { p.vx *= 0.9; p.vy += 60 * dt; }
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * Math.min(1, p.life * 8);
      if (p.type === 'heart') { ctx.fillStyle = '#ff5d8f'; heart(p.x, p.y, (9 + k * 4) * u); }
      else if (p.type === 'dust') { ctx.fillStyle = 'rgba(170,175,190,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * u, 0, 7); ctx.fill(); }
      else if (p.type === 'star') { ctx.fillStyle = '#ffd23f'; ctx.font = `${12 * u}px sans-serif`; ctx.fillText('★', p.x, p.y); }
      else if (p.type === 'bang') { ctx.fillStyle = '#ff4d4d'; ctx.font = `900 ${18 * u}px sans-serif`; ctx.fillText('!', p.x, p.y); }
      else {
        ctx.fillStyle = p.type === 'z' ? '#9aa3bd' : p.type === 'code' ? '#4fd1ff' : p.color;
        ctx.font = p.type === 'code' ? `600 ${10 * u}px ui-monospace, monospace` : `700 ${(p.type === 'z' ? 10 + k * 8 : 15) * u}px sans-serif`;
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- speech bubbles ----------
  function bubble(pet, u) {
    const b = pet.bubble, fs = 13;
    ctx.font = `600 ${fs}px ${FONT}`;
    const words = b.text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > 200 && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    const lh = fs * 1.3, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22, bh = lines.length * lh + 14;
    let hx = pet.x, hy = pet.y - 60 * u;
    if (pet.state === 'climb' || pet.state === 'cling') { hy = pet.y - 30 * u; hx = pet.x + (pet.wall === 'left' ? 30 : -30) * u; }
    const bx = Math.max(6, Math.min(env.world.w - bw - 6, hx - bw / 2));
    let by = hy - bh - 10, below = false;
    if (by < 6) { by = pet.y + 10; below = true; }
    const a = Math.max(0, Math.min(1, b.t / 0.14, (b.dur - b.t) / 0.3));
    const ox = Math.max(bx + 12, Math.min(bx + bw - 12, hx));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 11); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    if (below) { ctx.moveTo(ox - 6, by + 1); ctx.lineTo(ox, by - 7); ctx.lineTo(ox + 6, by + 1); }
    else { ctx.moveTo(ox - 6, by + bh - 1); ctx.lineTo(ox, by + bh + 7); ctx.lineTo(ox + 6, by + bh - 1); }
    ctx.fill();
    ctx.fillStyle = '#161a27'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 8 + i * lh));
    ctx.restore();
  }

  // ---------- loop ----------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    env.time += dt;
    env.idle = (now - lastInput) / 1000;
    const u = 1.1 * env.settings.size;
    for (const p of env.pets) p.update(dt, env);
    if (drama) { try { drama.tick(env, dt); } catch (e) { console.warn('[nibble] drama', e); } }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, env.world.w, env.world.h);
    if (env.settings.debug) {
      ctx.strokeStyle = 'rgba(255,60,170,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      for (const p of env.platforms) { ctx.beginPath(); ctx.moveTo(p.x1, p.y); ctx.lineTo(p.x2, p.y); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    const sorted = env.pets.slice().sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const skin = env.skins[p.skinKey] || env.skins.mint;
      if (p.skinKey === 'cyber') skin.neon = true;
      if (p.support && p.state !== 'drag') drawShadow(ctx, p.x, p.y, u, 1);
      drawPet(ctx, p.pose(), skin, u);
    }
    renderParts(dt, u);
    if (drama) { try { drama.draw(ctx, env, u); } catch (e) { console.warn('[nibble] drama draw', e); } }
    for (const p of sorted) if (p.bubble) bubble(p, u);
    if (hooks.decorate) hooks.decorate(ctx, u, sorted, env, press && !dragging ? { p: press.p, k: (performance.now() - press.t0 - 150) / 330 } : null);
    raf = requestAnimationFrame(frame);
  }

  // ---------- pointer ----------
  let press = null, dragging = null;
  const petAt = (x, y) => { for (let i = env.pets.length - 1; i >= 0; i--) if (env.pets[i].hit(x, y)) return env.pets[i]; return null; };
  const api = {
    env, rebuild, addPet, removePet, removePetObj, setForeground, ctx, emit,
    resize,
    over: (x, y) => !!dragging || !!petAt(x, y) || !!(drama && drama.hit(x, y)),
    interact: (type) => !!(drama && drama.force(env, type)),
    down(x, y) {
      lastInput = performance.now();
      if (drama && drama.click(x, y, env)) return true; // 🍦 "Give them ice cream"
      const p = petAt(x, y);
      if (!p) return false;
      press = { p, x, y, t0: performance.now() };
      return true;
    },
    move(x, y) {
      lastInput = performance.now();
      env.cursor = { x, y, movedAt: env.time };
      if (press && !dragging && Math.hypot(x - press.x, y - press.y) > 5) { dragging = press.p; dragging.startDrag(x, y); }
      if (dragging) dragging.dragTo(x, y, env);
    },
    up() {
      if (dragging) dragging.release(env);
      else if (press && hooks.onHold && performance.now() - press.t0 >= 480) hooks.onHold(press.p);
      else if (press) press.p.petted(env);
      const had = !!press;
      press = dragging = null;
      return had;
    },
    leave() { env.cursor = null; },
    dbl(x, y) { const p = petAt(x, y); if (p && hooks.onDbl && hooks.onDbl(p)) return; if (p) { p.backflip(env); p.speak(env, 'flip', { force: true }); } },
    command(type) {
      if (type === 'say') {
        const p = env.pets[Math.floor(Math.random() * env.pets.length)];
        p.bubble = null; p.say(pick('random', { name: p.name }));
        return;
      }
      for (const p of env.pets) p.command({ type }, env);
    },
    destroy() { cancelAnimationFrame(raf); },
  };
  resize();
  raf = requestAnimationFrame(frame);
  return api;
}
