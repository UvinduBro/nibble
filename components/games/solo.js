// Solo mini games. Each is a small canvas game: make(ctx, api) → { update(dt), draw(), key(k, down), point(x, y, kind) }.
// api = { W, H, look, pet(x, y, pose), end(score), sound(name) }. Your own pet (with its look) is the hero.

export const SOLO = [
  { key: 'snack', title: 'Snack Catch', emoji: '🍪', blurb: 'Catch the falling snacks, dodge the bugs.', how: 'Move with the mouse, a finger, or ← →.', pts: (s) => Math.min(60, Math.round(s * 1.2)) },
  { key: 'hop', title: 'Window Hop', emoji: '🪟', blurb: 'Run along the taskbar and jump the clutter.', how: 'Space, ↑ or tap to jump. Tap twice to double jump.', pts: (s) => Math.min(60, s * 2) },
  { key: 'stack', title: 'Scoop Stack', emoji: '🍦', blurb: 'Stack ice cream scoops as high as you can.', how: 'Tap, click or Space to drop each scoop.', pts: (s) => Math.min(60, s * 3) },
  { key: 'bugs', title: 'Bug Bash', emoji: '🐛', blurb: 'Squash bugs popping out of windows. Not your pet!', how: 'Click or tap the bugs. 30 seconds.', pts: (s) => Math.min(60, Math.max(0, s) * 2) },
  { key: 'memory', title: 'Pet Pairs', emoji: '🃏', blurb: 'Find every matching pair of animals.', how: 'Flip two cards at a time. Fewer moves = more points.', pts: (s) => Math.min(50, Math.round(s / 2)) },
  { key: 'dance', title: 'Copy the Dance', emoji: '🕺', blurb: 'Watch the moves, then copy them in order.', how: 'Use ← → ↑ ↓ or tap the buttons.', pts: (s) => Math.min(60, s * 6) },
];

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const EMO_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
function emoji(ctx, e, x, y, size, rot = 0) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.font = `${size}px ${EMO_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, 0, 0);
  ctx.restore();
}
function text(ctx, t, x, y, size = 16, color = '#fff', align = 'center', weight = 800) {
  ctx.save(); ctx.font = `${weight} ${size}px system-ui, "Segoe UI", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,12,24,0.6)'; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); ctx.restore();
}
function hud(ctx, W, left, right) {
  text(ctx, left, 16, 22, 17, '#fff', 'left');
  if (right) text(ctx, right, W - 16, 22, 17, '#ffd166', 'right');
}
function bg(ctx, W, H, top = '#1b2140', bot = '#2a1f45') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function pops(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.t += dt;
    if (p.t > 0.9) { list.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.t / 0.9; text(ctx, p.s, p.x, p.y - p.t * 40, 16, p.c || '#ffd166'); ctx.globalAlpha = 1;
  }
}

// ---------- Snack Catch ----------
function snack(ctx, api) {
  const { W, H } = api;
  const floor = H - 30;
  let x = W / 2, vx = 0, tx = null, t = 0, score = 0, lives = 3, spawn = 0.6, over = false, hurt = 0, dir = 1;
  const items = [], fx = [], keys = {};
  const GOOD = ['🍪', '🍩', '🍓', '🍦', '🧁', '🍉', '🍬'];
  return {
    update(dt) {
      if (over) return;
      t += dt; hurt = Math.max(0, hurt - dt);
      const speed = 330;
      if (keys.left) vx = -speed; else if (keys.right) vx = speed; else vx = 0;
      if (tx != null && !keys.left && !keys.right) { const d = tx - x; vx = Math.max(-speed * 1.4, Math.min(speed * 1.4, d * 10)); }
      x = Math.max(30, Math.min(W - 30, x + vx * dt));
      if (Math.abs(vx) > 10) dir = vx > 0 ? 1 : -1;
      spawn -= dt;
      const level = 1 + t / 25;
      if (spawn <= 0) {
        spawn = Math.max(0.28, 0.85 / level) * rand(0.7, 1.2);
        const r = Math.random();
        const kind = r < 0.08 ? 'star' : r < 0.08 + Math.min(0.32, 0.12 + t / 200) ? 'bug' : 'good';
        items.push({ x: rand(24, W - 24), y: -20, vy: rand(120, 170) * level, kind, e: kind === 'star' ? '⭐' : kind === 'bug' ? '🐛' : pickOne(GOOD), rot: rand(-1, 1) });
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy * dt; it.rot += dt;
        if (it.y > floor - 50 && it.y < floor - 5 && Math.abs(it.x - x) < 34) {
          items.splice(i, 1);
          if (it.kind === 'bug') { lives--; hurt = 0.6; fx.push({ s: '-1 ❤️', x, y: floor - 70, t: 0, c: '#ff6b6b' }); api.sound('boing'); if (lives <= 0) { over = true; api.end(score); } }
          else { const g = it.kind === 'star' ? 5 : 1; score += g; fx.push({ s: '+' + g, x: it.x, y: floor - 70, t: 0 }); api.sound('nom'); }
          continue;
        }
        if (it.y > H + 30) items.splice(i, 1);
      }
    },
    draw(dt) {
      bg(ctx, W, H);
      ctx.fillStyle = 'rgba(126,232,198,0.12)'; ctx.fillRect(0, floor, W, H - floor);
      for (const it of items) emoji(ctx, it.e, it.x, it.y, it.kind === 'star' ? 30 : 28, it.kind === 'bug' ? 0 : Math.sin(it.rot) * 0.4);
      api.pet(x, floor, { dir, walk: t * 14, stride: Math.abs(vx) > 10 ? 1.2 : 0, mouth: hurt ? 'o' : 'open', eyes: hurt ? 'x' : 'happy', arms: 'up', ears: 1 });
      pops(ctx, fx, dt);
      hud(ctx, W, `🍪 ${score}`, '❤️'.repeat(Math.max(0, lives)));
    },
    key(k, down) { if (k === 'ArrowLeft' || k === 'a') keys.left = down; if (k === 'ArrowRight' || k === 'd') keys.right = down; },
    point(px, py, kind) { if (kind !== 'up') tx = px; },
  };
}

// ---------- Window Hop ----------
function hop(ctx, api) {
  const { W, H } = api;
  const floor = H - 40, px = 90;
  let y = floor, vy = 0, jumps = 0, t = 0, dist = 0, score = 0, speed = 260, next = 1.2, over = false;
  const obs = [], clouds = [], fx = [];
  for (let i = 0; i < 4; i++) clouds.push({ x: rand(0, W), y: rand(30, H / 2), s: rand(0.6, 1.2) });
  const OBS = [{ e: '📁', w: 30, h: 30 }, { e: '🐛', w: 30, h: 26 }, { e: '☕', w: 28, h: 30 }, { e: '📦', w: 34, h: 34 }, { e: '🌵', w: 30, h: 40 }];
  const jump = () => { if (over) return; if (jumps < 2) { vy = jumps ? -560 : -640; jumps++; api.sound('hop'); } };
  return {
    update(dt) {
      if (over) return;
      t += dt; speed = 260 + t * 9; dist += speed * dt;
      vy += 1900 * dt; y += vy * dt;
      if (y >= floor) { y = floor; vy = 0; jumps = 0; }
      next -= dt;
      if (next <= 0) {
        const o = pickOne(OBS);
        obs.push({ ...o, x: W + 30, passed: false, fly: t > 20 && Math.random() < 0.25 });
        next = rand(0.75, 1.5) * Math.max(0.55, 1 - t / 120);
      }
      for (let i = obs.length - 1; i >= 0; i--) {
        const o = obs[i];
        o.x -= speed * dt;
        const oy = o.fly ? floor - 64 : floor - o.h / 2;
        if (!o.passed && o.x < px - 20) { o.passed = true; score++; fx.push({ s: '+1', x: px, y: y - 70, t: 0 }); }
        if (Math.abs(o.x - px) < (o.w / 2 + 12) && Math.abs(oy - (y - 22)) < (o.h / 2 + 16)) { over = true; api.sound('boing'); api.end(score); }
        if (o.x < -40) obs.splice(i, 1);
      }
      for (const c of clouds) { c.x -= speed * 0.15 * c.s * dt; if (c.x < -60) { c.x = W + 60; c.y = rand(30, H / 2); } }
    },
    draw(dt) {
      bg(ctx, W, H, '#16304a', '#2a3e66');
      ctx.globalAlpha = 0.5; for (const c of clouds) emoji(ctx, '☁️', c.x, c.y, 36 * c.s); ctx.globalAlpha = 1;
      ctx.fillStyle = '#20263d'; ctx.fillRect(0, floor, W, H - floor);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 12; i++) { const xx = ((i * 90 - dist * 0.6) % (W + 90) + W + 90) % (W + 90) - 45; ctx.fillRect(xx, floor + 12, 40, 6); }
      for (const o of obs) emoji(ctx, o.e, o.x, o.fly ? floor - 64 : floor - o.h / 2, o.h);
      api.pet(px, y, { dir: 1, walk: t * 20, stride: y >= floor ? 1.4 : 0, eyes: over ? 'x' : y < floor ? 'happy' : 'open', mouth: y < floor ? 'open' : 'smile', arms: y < floor ? 'up' : 'down', ears: y < floor ? 1 : -0.3, speed: y >= floor, rot: y < floor ? Math.min(0.3, -vy / 2400) : 0 });
      pops(ctx, fx, dt);
      hud(ctx, W, `🪟 ${score}`, `${Math.floor(dist / 100)} m`);
    },
    key(k, down) { if (down && (k === ' ' || k === 'ArrowUp' || k === 'w')) jump(); },
    point(x, y2, kind) { if (kind === 'down') jump(); },
  };
}

// ---------- Scoop Stack ----------
function stack(ctx, api) {
  const { W, H } = api;
  const COLS = ['#ffb3c7', '#fff1c1', '#a7f3d0', '#c4b5fd', '#ffd6a5', '#bde0fe', '#ffadad'];
  const SH = 22;
  const base = { x: W / 2 - 50, w: 100 };
  const layers = [];
  let cur = { x: 0, w: 100, dir: 1 }, speed = 170, score = 0, over = false, camY = 0, t = 0, drop = null;
  const fx = [];
  const topOf = () => (layers.length ? layers[layers.length - 1] : base);
  const place = () => {
    if (over || drop) return;
    const top = topOf();
    const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
    const w = r - l;
    if (w <= 4) { over = true; drop = { x: cur.x, w: cur.w, y: 0, vy: 0, c: COLS[layers.length % COLS.length] }; api.sound('boing'); api.end(score); return; }
    const perfect = Math.abs(cur.x - top.x) < 4;
    const nl = perfect ? { x: top.x, w: top.w } : { x: l, w };
    layers.push({ ...nl, c: COLS[layers.length % COLS.length] });
    score++;
    fx.push({ s: perfect ? 'Perfect! +1' : '+1', x: nl.x + nl.w / 2, y: H - 90 - layers.length * SH + camY, t: 0, c: perfect ? '#7ee8c6' : '#ffd166' });
    if (perfect) { score++; api.sound('chime'); } else api.sound('pop');
    cur = { x: Math.random() < 0.5 ? -nl.w : W, w: nl.w, dir: 1 };
    cur.dir = cur.x < 0 ? 1 : -1;
    speed = Math.min(420, 170 + layers.length * 10);
  };
  return {
    update(dt) {
      t += dt;
      const target = Math.max(0, layers.length * SH - (H - 220));
      camY += (target - camY) * Math.min(1, dt * 4);
      if (drop) { drop.vy += 900 * dt; drop.y += drop.vy * dt; }
      if (over) return;
      cur.x += cur.dir * speed * dt;
      if (cur.x > W - cur.w * 0.2) cur.dir = -1;
      if (cur.x < -cur.w * 0.8) cur.dir = 1;
    },
    draw(dt) {
      bg(ctx, W, H, '#2b1d3f', '#45305e');
      const by = H - 70 + camY;
      // cone
      ctx.fillStyle = '#e0a458';
      ctx.beginPath(); ctx.moveTo(base.x, by); ctx.lineTo(base.x + base.w, by); ctx.lineTo(base.x + base.w / 2, by + 90); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,30,0.5)'; ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(base.x + i * 20, by); ctx.lineTo(base.x + base.w / 2, by + 90); ctx.stroke(); }
      const scoop = (x, w, y, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y - SH, w, SH, Math.min(11, w / 2)); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 6, y - SH + 4, Math.max(0, w - 12) * 0.35, 3); };
      layers.forEach((l, i) => scoop(l.x, l.w, by - i * SH, l.c));
      const y = by - layers.length * SH;
      if (!over) scoop(cur.x, cur.w, y - 40, COLS[layers.length % COLS.length]);
      if (drop) scoop(drop.x, drop.w, y - 40 + drop.y, drop.c);
      if (layers.length) emoji(ctx, '🍒', topOf().x + topOf().w / 2, y - 8, 18);
      api.pet(W - 60, H - 20, { dir: -1, eyes: over ? 'x' : 'happy', mouth: 'open', arms: 'up', ears: 1, bob: Math.abs(Math.sin(t * 6)) * 3 }, 0.75);
      pops(ctx, fx, dt);
      hud(ctx, W, `🍦 ${score}`, '');
    },
    key(k, down) { if (down && (k === ' ' || k === 'ArrowDown' || k === 'Enter')) place(); },
    point(x, y, kind) { if (kind === 'down') place(); },
  };
}

// ---------- Bug Bash ----------
function bugs(ctx, api) {
  const { W, H } = api;
  const cols = 3, rows = 3, pad = 16, top = 46;
  const cw = (W - pad * (cols + 1)) / cols, ch = (H - top - pad * (rows + 1)) / rows;
  const holes = Array.from({ length: 9 }, (_, i) => ({ x: pad + (i % cols) * (cw + pad), y: top + pad + Math.floor(i / cols) * (ch + pad), who: null, t: 0, up: 0, hit: 0 }));
  let time = 30, score = 0, spawn = 0.5, over = false, t = 0;
  const fx = [];
  return {
    update(dt) {
      if (over) return;
      t += dt; time -= dt;
      if (time <= 0) { time = 0; over = true; api.end(score); return; }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.35, 0.8 - t / 60) * rand(0.6, 1.2);
        const free = holes.filter((h) => !h.who);
        if (free.length) { const h = pickOne(free); const r = Math.random(); h.who = r < 0.12 ? 'pet' : r < 0.22 ? 'gold' : 'bug'; h.t = 0; h.up = rand(0.7, 1.15) - Math.min(0.35, t / 80); h.hit = 0; }
      }
      for (const h of holes) if (h.who) { h.t += dt; if (h.hit) { h.hit -= dt; if (h.hit <= 0) h.who = null; } else if (h.t > h.up) h.who = null; }
    },
    draw(dt) {
      bg(ctx, W, H, '#14213d', '#1f2f55');
      for (const h of holes) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(h.x, h.y, cw, ch, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(h.x + 1, h.y + 1, cw - 2, 16);
        for (const [i, c] of ['#ff6b6b', '#ffd166', '#7ee8c6'].entries()) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(h.x + 12 + i * 11, h.y + 9, 3.2, 0, Math.PI * 2); ctx.fill(); }
        if (!h.who) continue;
        const k = h.hit ? 1 : Math.min(1, h.t / 0.12) * Math.min(1, (h.up - h.t) / 0.12 + 0.2);
        const cx = h.x + cw / 2, cy = h.y + ch / 2 + 14 + (1 - k) * 20;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, k));
        if (h.who === 'pet') api.pet(cx, cy + 26, { eyes: h.hit ? 'x' : 'happy', mouth: h.hit ? 'o' : 'smile', arms: 'wave', ears: 1 }, Math.min(0.9, ch / 90));
        else emoji(ctx, h.hit ? '💥' : h.who === 'gold' ? '🐞' : '🐛', cx, cy, Math.min(cw, ch) * 0.48);
        ctx.restore();
      }
      pops(ctx, fx, dt);
      hud(ctx, W, `🐛 ${score}`, `⏱ ${Math.ceil(time)}s`);
    },
    key() {},
    point(px, py, kind) {
      if (kind !== 'down' || over) return;
      for (const h of holes) {
        if (!h.who || h.hit || px < h.x || px > h.x + cw || py < h.y || py > h.y + ch) continue;
        if (h.who === 'pet') { score -= 3; fx.push({ s: 'ouch! -3', x: px, y: py, t: 0, c: '#ff6b6b' }); api.sound('boing'); }
        else { const g = h.who === 'gold' ? 3 : 1; score += g; fx.push({ s: '+' + g, x: px, y: py, t: 0 }); api.sound('pop'); }
        h.hit = 0.25;
      }
    },
  };
}

// ---------- Pet Pairs (memory) ----------
function memory(ctx, api) {
  const { W, H } = api;
  const FACES = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐸', '🐧'];
  const deck = [...FACES, ...FACES].map((e) => ({ e, open: false, done: false, flip: 0 })).sort(() => Math.random() - 0.5);
  const cols = 4, rows = 4, pad = 10, top = 44;
  const size = Math.min((W - pad * (cols + 1)) / cols, (H - top - pad * (rows + 1)) / rows);
  const ox = (W - (size * cols + pad * (cols - 1))) / 2;
  let sel = [], moves = 0, t = 0, wait = 0, over = false, found = 0;
  const fx = [];
  return {
    update(dt) {
      if (over) return;
      t += dt;
      for (const c of deck) c.flip += ((c.open || c.done ? 1 : 0) - c.flip) * Math.min(1, dt * 14);
      if (wait > 0) { wait -= dt; if (wait <= 0) { for (const c of sel) c.open = false; sel = []; } }
    },
    draw(dt) {
      bg(ctx, W, H, '#1e1b3a', '#3a2350');
      deck.forEach((c, i) => {
        const x = ox + (i % cols) * (size + pad), y = top + Math.floor(i / cols) * (size + pad);
        const k = Math.abs(Math.cos(c.flip * Math.PI)); const face = c.flip > 0.5;
        ctx.save(); ctx.translate(x + size / 2, y + size / 2); ctx.scale(Math.max(0.05, k), 1);
        ctx.fillStyle = face ? (c.done ? 'rgba(126,232,198,0.28)' : 'rgba(255,255,255,0.92)') : '#7c6cff';
        ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, 12); ctx.fill();
        if (face) emoji(ctx, c.e, 0, 2, size * 0.58); else { ctx.fillStyle = 'rgba(255,255,255,0.25)'; emoji(ctx, '🐾', 0, 2, size * 0.4); }
        ctx.restore();
      });
      pops(ctx, fx, dt);
      hud(ctx, W, `🃏 ${found}/8`, `${moves} moves · ${Math.floor(t)}s`);
    },
    key() {},
    point(px, py, kind) {
      if (kind !== 'down' || over || wait > 0) return;
      const i = deck.findIndex((c, j) => { const x = ox + (j % cols) * (size + pad), y = top + Math.floor(j / cols) * (size + pad); return px >= x && px <= x + size && py >= y && py <= y + size; });
      if (i < 0) return;
      const c = deck[i];
      if (c.open || c.done) return;
      c.open = true; sel.push(c); api.sound('pop');
      if (sel.length === 2) {
        moves++;
        if (sel[0].e === sel[1].e) {
          for (const s of sel) { s.done = true; s.open = false; }
          sel = []; found++; api.sound('chime');
          fx.push({ s: 'Pair!', x: px, y: py, t: 0, c: '#7ee8c6' });
          if (found === 8) { over = true; api.end(Math.max(10, Math.round(140 - moves * 4 - t))); }
        } else wait = 0.7;
      }
    },
  };
}

// ---------- Copy the Dance (Simon) ----------
function dance(ctx, api) {
  const { W, H } = api;
  const MOVES = [
    { k: 'ArrowLeft', e: '⬅️', c: '#4cc9f0', pose: { dir: -1, arms: 'wave', walk: 0 } },
    { k: 'ArrowUp', e: '⬆️', c: '#7ee8c6', pose: { arms: 'up', eyes: 'happy', mouth: 'open', jump: true } },
    { k: 'ArrowRight', e: '➡️', c: '#ffd166', pose: { dir: 1, arms: 'wave' } },
    { k: 'ArrowDown', e: '⬇️', c: '#ff7ab8', pose: { sit: true, eyes: 'happy', mouth: 'smile' } },
  ];
  const seq = [];
  let mode = 'show', i = 0, t = 0, step = 0, input = 0, round = 0, over = false, flash = null, msg = 'Watch…';
  const btn = (j) => { const bw = (W - 50) / 4; return { x: 10 + j * (bw + 10), y: H - 66, w: bw, h: 54 }; };
  const nextRound = () => { seq.push(Math.floor(Math.random() * 4)); mode = 'show'; i = 0; step = -0.6; input = 0; msg = 'Watch…'; };
  nextRound();
  const press = (j) => {
    if (over || mode !== 'play') return;
    flash = { j, t: 0.3 };
    if (seq[input] === j) {
      input++; api.sound('hop');
      if (input === seq.length) { round++; msg = 'Nice! 🎉'; api.sound('chime'); mode = 'wait'; step = 0; }
    } else { over = true; msg = 'Oops!'; api.sound('boing'); api.end(round); }
  };
  return {
    update(dt) {
      t += dt;
      if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
      if (over) return;
      if (mode === 'show') {
        step += dt;
        const per = Math.max(0.42, 0.75 - round * 0.03);
        if (step >= per) { step = 0; if (i < seq.length) { flash = { j: seq[i], t: per * 0.8 }; api.sound('pop'); i++; } else { mode = 'play'; msg = 'Your turn!'; } }
      } else if (mode === 'wait') { step += dt; if (step > 0.9) nextRound(); }
    },
    draw() {
      bg(ctx, W, H, '#25163d', '#3d1f4f');
      for (let k = 0; k < 7; k++) { ctx.fillStyle = `hsla(${(t * 60 + k * 50) % 360},80%,65%,0.12)`; ctx.beginPath(); ctx.arc((k + 0.5) * W / 7, 60 + Math.sin(t * 2 + k) * 10, 18, 0, Math.PI * 2); ctx.fill(); }
      const cur = flash ? MOVES[flash.j] : null;
      const p = cur ? cur.pose : {};
      api.pet(W / 2, H - 92 - (p.jump ? 26 : 0), { dir: p.dir || 1, arms: p.arms || 'dance', eyes: p.eyes || (over ? 'x' : 'open'), mouth: p.mouth || 'smile', sit: p.sit, ears: 1, bob: cur ? 0 : Math.abs(Math.sin(t * 5)) * 3, tailWag: 10 }, 1.25);
      MOVES.forEach((m, j) => {
        const b = btn(j);
        ctx.fillStyle = flash && flash.j === j ? m.c : 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
        emoji(ctx, m.e, b.x + b.w / 2, b.y + b.h / 2, 26);
      });
      text(ctx, msg, W / 2, 70, 20, '#fff');
      hud(ctx, W, `🕺 ${round}`, `${seq.length} moves`);
    },
    key(k, down) { if (!down) return; const j = MOVES.findIndex((m) => m.k === k); if (j >= 0) press(j); },
    point(px, py, kind) { if (kind !== 'down') return; for (let j = 0; j < 4; j++) { const b = btn(j); if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) press(j); } },
  };
}

export const MAKERS = { snack, hop, stack, bugs, memory, dance };
