// More solo games (2.0.14): Block Blast, Fruit Merge, 2048 Pets, Flappy Pet, Pet Wordle, Snack Snake.
// Same contract as solo.js: make(ctx, api) → { update(dt), draw(dt), key(k, down), point(x, y, kind) }.

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
function bg(ctx, W, H, top, bot) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function pops(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.t += dt;
    if (p.t > 0.9) { list.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.t / 0.9; text(ctx, p.s, p.x, p.y - p.t * 40, p.size || 16, p.c || '#ffd166'); ctx.globalAlpha = 1;
  }
}

// ---------- Block Blast: drop shapes on an 8×8 board, fill rows or columns to clear them ----------
const SHAPES = [
  [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
];
const BLOCK_COLS = ['#ff7ab8', '#7ee8c6', '#ffd166', '#7aa2ff', '#b9a3ff', '#ff8f6b', '#4cc9f0'];
function blast(ctx, api) {
  const { W, H } = api;
  const N = 8, cs = Math.min(42, Math.floor((H - 70) / N)), gx = 22, gy = 52;
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const trayX = gx + N * cs + 26, slotH = (H - 70) / 3;
  let tray = [], drag = null, score = 0, combo = 0, over = false, t = 0, flash = [];
  const fx = [];
  const newTray = () => { tray = [0, 1, 2].map(() => ({ s: pickOne(SHAPES), c: pickOne(BLOCK_COLS) })); };
  const fits = (s, cx, cy) => s.every(([x, y]) => cx + x >= 0 && cy + y >= 0 && cx + x < N && cy + y < N && !grid[cy + y][cx + x]);
  const anyFit = () => tray.some((p) => p && (() => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fits(p.s, x, y)) return true; return false; })());
  const size = (s) => [Math.max(...s.map((c) => c[0])) + 1, Math.max(...s.map((c) => c[1])) + 1];
  newTray();
  const cellAt = (px, py, p) => { const [w, h] = size(p.s); return [Math.round((px - gx) / cs - w / 2), Math.round((py - gy) / cs - h / 2 - 1.2)]; };
  const place = (i, cx, cy) => {
    const p = tray[i];
    if (!fits(p.s, cx, cy)) return false;
    for (const [x, y] of p.s) grid[cy + y][cx + x] = p.c;
    score += p.s.length;
    const rows = [], cols = [];
    for (let k = 0; k < N; k++) { if (grid[k].every(Boolean)) rows.push(k); if (grid.every((r) => r[k])) cols.push(k); }
    const lines = rows.length + cols.length;
    if (lines) {
      combo++;
      const pts = lines * 10 * lines * Math.min(4, combo);
      score += pts;
      for (const r of rows) for (let x = 0; x < N; x++) { flash.push({ x, y: r, t: 0, c: grid[r][x] }); grid[r][x] = null; }
      for (const c of cols) for (let y = 0; y < N; y++) { if (grid[y][c]) flash.push({ x: c, y, t: 0, c: grid[y][c] }); grid[y][c] = null; }
      fx.push({ s: (lines > 1 ? `${lines} lines! ` : '') + `+${pts}` + (combo > 1 ? ` combo ×${combo}` : ''), x: gx + N * cs / 2, y: gy + N * cs / 2, t: 0, size: 20, c: '#7ee8c6' });
      api.sound('chime');
    } else { combo = 0; api.sound('pop'); }
    tray[i] = null;
    if (tray.every((x) => !x)) newTray();
    if (!anyFit()) { over = true; api.sound('boing'); api.end(score); }
    return true;
  };
  return {
    update(dt) { t += dt; for (let i = flash.length - 1; i >= 0; i--) { flash[i].t += dt; if (flash[i].t > 0.4) flash.splice(i, 1); } },
    draw(dt) {
      bg(ctx, W, H, '#1a1f45', '#2b1d4a');
      rr(ctx, gx - 6, gy - 6, N * cs + 12, N * cs + 12, 14); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      let ghost = null;
      if (drag) { const [cx, cy] = cellAt(drag.x, drag.y, tray[drag.i]); if (fits(tray[drag.i].s, cx, cy)) ghost = { cx, cy, p: tray[drag.i] }; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = grid[y][x];
        rr(ctx, gx + x * cs + 2, gy + y * cs + 2, cs - 4, cs - 4, 7);
        ctx.fillStyle = c || 'rgba(255,255,255,0.06)'; ctx.fill();
        if (c) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(gx + x * cs + 6, gy + y * cs + 6, cs - 16, 4); }
      }
      if (ghost) for (const [x, y] of ghost.p.s) { rr(ctx, gx + (ghost.cx + x) * cs + 2, gy + (ghost.cy + y) * cs + 2, cs - 4, cs - 4, 7); ctx.fillStyle = ghost.p.c + '66'; ctx.fill(); }
      for (const f of flash) { const k = 1 - f.t / 0.4; rr(ctx, gx + f.x * cs + 2 - k * 3, gy + f.y * cs + 2 - k * 3, cs - 4 + k * 6, cs - 4 + k * 6, 7); ctx.fillStyle = `rgba(255,255,255,${k * 0.8})`; ctx.fill(); }
      tray.forEach((p, i) => {
        if (!p || (drag && drag.i === i)) return;
        const [w, h] = size(p.s), s = Math.min(26, (slotH - 20) / Math.max(w, h));
        const ox = trayX + (W - trayX - 16 - w * s) / 2, oy = 52 + i * slotH + (slotH - h * s) / 2;
        for (const [x, y] of p.s) { rr(ctx, ox + x * s + 1, oy + y * s + 1, s - 2, s - 2, 5); ctx.fillStyle = p.c; ctx.fill(); }
      });
      if (drag) {
        const p = tray[drag.i], [w, h] = size(p.s);
        for (const [x, y] of p.s) { rr(ctx, drag.x - w * cs / 2 + x * cs + 2, drag.y - h * cs / 2 - cs * 1.2 + y * cs + 2, cs - 4, cs - 4, 7); ctx.fillStyle = p.c; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; }
      }
      api.pet(W - 44, 40, { dir: -1, eyes: over ? 'x' : combo > 1 ? 'happy' : 'open', mouth: combo > 1 ? 'open' : 'smile', arms: combo > 1 ? 'up' : 'down', ears: 1, bob: combo > 1 ? Math.abs(Math.sin(t * 8)) * 4 : 0 }, 0.5);
      pops(ctx, fx, dt);
      text(ctx, `🧱 ${score}`, 16, 24, 18, '#fff', 'left');
      if (combo > 1) text(ctx, `combo ×${combo}`, gx + N * cs, 24, 15, '#7ee8c6', 'right');
    },
    key() {},
    point(px, py, kind) {
      if (over) return;
      if (kind === 'down') {
        for (let i = 0; i < 3; i++) if (tray[i] && px > trayX - 10 && py > 52 + i * slotH && py < 52 + (i + 1) * slotH) { drag = { i, x: px, y: py }; api.sound('hop'); }
      } else if (kind === 'move' && drag) { drag.x = px; drag.y = py; }
      else if (kind === 'up' && drag) {
        const [cx, cy] = cellAt(px, py, tray[drag.i]);
        const i = drag.i; drag = null;
        place(i, cx, cy);
      }
    },
  };
}

// ---------- Fruit Merge (Suika-style): drop fruit, two of the same merge into the next one ----------
const FRUITS = [
  { e: '🫐', r: 13, c: '#5b6cff' }, { e: '🍒', r: 17, c: '#ff4d6d' }, { e: '🍓', r: 22, c: '#ff5e7e' }, { e: '🍇', r: 27, c: '#a970ff' },
  { e: '🍊', r: 32, c: '#ff9f43' }, { e: '🍎', r: 38, c: '#ff3b3b' }, { e: '🍐', r: 44, c: '#c5e063' }, { e: '🍑', r: 51, c: '#ffb38a' },
  { e: '🍍', r: 58, c: '#ffd23f' }, { e: '🍈', r: 66, c: '#9be15d' }, { e: '🍉', r: 76, c: '#2ec27e' },
];
function merge(ctx, api) {
  const { W, H } = api;
  const bw = Math.min(330, W - 140), bx = (W - bw) / 2, top = 70, floor = H - 14, line = top + 26;
  const fruits = [];
  let next = Math.floor(Math.random() * 4), hold = Math.floor(Math.random() * 3), aim = W / 2, cool = 0, score = 0, over = false, danger = 0, t = 0;
  const fx = [];
  const drop = () => {
    if (over || cool > 0) return;
    const r = FRUITS[next].r;
    fruits.push({ x: Math.max(bx + r, Math.min(bx + bw - r, aim)), y: top, vx: 0, vy: 0, k: next, born: t });
    next = hold; hold = Math.floor(Math.random() * 4); cool = 0.45; api.sound('pop');
  };
  return {
    update(dt) {
      t += dt; cool -= dt;
      if (over) return;
      const steps = 4, h = Math.min(dt, 0.033) / steps;
      for (let s = 0; s < steps; s++) {
        for (const f of fruits) { f.vy += 1400 * h; f.x += f.vx * h; f.y += f.vy * h; f.vx *= 0.995; }
        for (const f of fruits) {
          const r = FRUITS[f.k].r;
          if (f.y + r > floor) { f.y = floor - r; f.vy *= -0.15; f.vx *= 0.92; }
          if (f.x - r < bx) { f.x = bx + r; f.vx = Math.abs(f.vx) * 0.3; }
          if (f.x + r > bx + bw) { f.x = bx + bw - r; f.vx = -Math.abs(f.vx) * 0.3; }
        }
        for (let i = 0; i < fruits.length; i++) for (let j = i + 1; j < fruits.length; j++) {
          const a = fruits[i], b = fruits[j];
          if (a.dead || b.dead) continue;
          const ra = FRUITS[a.k].r, rb = FRUITS[b.k].r, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, ov = ra + rb - d;
          if (ov <= 0) continue;
          if (a.k === b.k && a.k < FRUITS.length - 1) {
            a.dead = b.dead = true;
            const k = a.k + 1;
            fruits.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: 0, vy: -60, k, born: t });
            const pts = (k + 1) * (k + 2) / 2; score += pts;
            fx.push({ s: '+' + pts, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20, t: 0 });
            api.sound(k > 6 ? 'chime' : 'nom');
            continue;
          }
          const nx = dx / d, ny = dy / d, ma = ra * ra, mb = rb * rb, tot = ma + mb;
          a.x -= nx * ov * (mb / tot); a.y -= ny * ov * (mb / tot); b.x += nx * ov * (ma / tot); b.y += ny * ov * (ma / tot);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { const imp = -1.2 * rv / (1 / ma + 1 / mb); a.vx -= imp * nx / ma; a.vy -= imp * ny / ma; b.vx += imp * nx / mb; b.vy += imp * ny / mb; }
        }
        for (let i = fruits.length - 1; i >= 0; i--) if (fruits[i].dead) fruits.splice(i, 1);
      }
      // game over when fruit sits above the line for a while
      const high = fruits.some((f) => t - f.born > 1.2 && f.y - FRUITS[f.k].r < line && Math.abs(f.vy) < 60);
      danger = high ? danger + dt : Math.max(0, danger - dt);
      if (danger > 2) { over = true; api.sound('boing'); api.end(score); }
    },
    draw(dt) {
      bg(ctx, W, H, '#2a1b3d', '#3d2b55');
      rr(ctx, bx - 8, top - 10, bw + 16, floor - top + 18, 18); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      ctx.strokeStyle = danger > 0 ? `rgba(255,90,90,${0.4 + Math.sin(t * 12) * 0.3})` : 'rgba(255,255,255,0.18)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, line); ctx.lineTo(bx + bw, line); ctx.stroke(); ctx.setLineDash([]);
      for (const f of fruits) {
        const F = FRUITS[f.k];
        ctx.beginPath(); ctx.arc(f.x, f.y, F.r, 0, Math.PI * 2); ctx.fillStyle = F.c + '55'; ctx.fill();
        emoji(ctx, F.e, f.x, f.y + F.r * 0.06, F.r * 1.7);
      }
      if (!over) {
        const F = FRUITS[next];
        const ax = Math.max(bx + F.r, Math.min(bx + bw - F.r, aim));
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(ax, top + F.r); ctx.lineTo(ax, floor); ctx.stroke();
        ctx.globalAlpha = cool > 0 ? 0.4 : 1; emoji(ctx, F.e, ax, top - 18, F.r * 1.7); ctx.globalAlpha = 1;
      }
      api.pet(bx - 40, floor, { dir: 1, eyes: over ? 'x' : 'happy', mouth: 'open', arms: 'up', ears: 1, bob: Math.abs(Math.sin(t * 5)) * 2 }, 0.7);
      text(ctx, 'next', bx + bw + 40, top + 6, 13, '#9aa3c2'); emoji(ctx, FRUITS[hold].e, bx + bw + 40, top + 36, 30);
      text(ctx, '🍉 big goal', bx + bw + 40, floor - 10, 12, '#9aa3c2');
      pops(ctx, fx, dt);
      text(ctx, `🍒 ${score}`, 16, 24, 18, '#fff', 'left');
    },
    key(k, down) { if (!down) return; if (k === 'ArrowLeft' || k === 'a') aim -= 24; if (k === 'ArrowRight' || k === 'd') aim += 24; if (k === ' ' || k === 'ArrowDown' || k === 'Enter') drop(); },
    point(px, py, kind) { aim = px; if (kind === 'up') drop(); },
  };
}

// ---------- 2048 Pets ----------
const TILE = { 2: '🐭', 4: '🐹', 8: '🐰', 16: '🐱', 32: '🐶', 64: '🦊', 128: '🐼', 256: '🐨', 512: '🦁', 1024: '🐯', 2048: '🐲', 4096: '🦄' };
const TILE_C = { 2: '#3b3f6b', 4: '#46407a', 8: '#5b3f86', 16: '#7a3f86', 32: '#943f7a', 64: '#b0456a', 128: '#c9644d', 256: '#d68a3a', 512: '#d9b13a', 1024: '#7cc46a', 2048: '#3fbf9f', 4096: '#3f8fd6' };
function p2048(ctx, api) {
  const { W, H } = api;
  const N = 4, size = Math.min(H - 70, 360), cs = size / N, ox = (W - size) / 2 + 60, oy = 52;
  let g = Array.from({ length: N }, () => Array(N).fill(0)), score = 0, over = false, best = 0, sw = null, t = 0, anim = 0, newAt = null;
  const fx = [];
  const add = () => { const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) free.push([x, y]); if (!free.length) return; const [x, y] = pickOne(free); g[y][x] = Math.random() < 0.9 ? 2 : 4; newAt = { x, y, t: 0 }; };
  add(); add();
  const canMove = () => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (!g[y][x]) return true; if (x < N - 1 && g[y][x] === g[y][x + 1]) return true; if (y < N - 1 && g[y][x] === g[y + 1][x]) return true; } return false; };
  const move = (dir) => {
    if (over) return;
    let moved = false, gained = 0;
    const line = (arr) => { const a = arr.filter(Boolean); for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; gained += a[i]; best = Math.max(best, a[i]); a.splice(i + 1, 1); } while (a.length < N) a.push(0); return a; };
    for (let k = 0; k < N; k++) {
      let cells;
      if (dir === 'L') cells = g[k].slice(); else if (dir === 'R') cells = g[k].slice().reverse();
      else if (dir === 'U') cells = g.map((r) => r[k]); else cells = g.map((r) => r[k]).reverse();
      const out = line(cells);
      if (dir === 'R' || dir === 'D') out.reverse();
      for (let i = 0; i < N; i++) {
        const [x, y] = dir === 'L' || dir === 'R' ? [i, k] : [k, i];
        if (g[y][x] !== out[i]) moved = true;
        g[y][x] = out[i];
      }
    }
    if (!moved) return;
    score += gained; anim = 0.12;
    if (gained) { fx.push({ s: '+' + gained, x: ox + size / 2, y: oy + size / 2, t: 0 }); api.sound(gained >= 128 ? 'chime' : 'nom'); } else api.sound('pop');
    add();
    if (!canMove()) { over = true; api.sound('boing'); api.end(score); }
  };
  return {
    update(dt) { t += dt; anim = Math.max(0, anim - dt); if (newAt) newAt.t += dt; },
    draw(dt) {
      bg(ctx, W, H, '#1c1b3f', '#2d1f4d');
      rr(ctx, ox - 8, oy - 8, size + 16, size + 16, 16); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = g[y][x];
        const pop = newAt && newAt.x === x && newAt.y === y ? Math.min(1, newAt.t / 0.15) : 1;
        const pad = 5 + (1 - pop) * cs * 0.3;
        rr(ctx, ox + x * cs + pad, oy + y * cs + pad, cs - pad * 2, cs - pad * 2, 12);
        ctx.fillStyle = v ? TILE_C[v] || '#3fbf9f' : 'rgba(255,255,255,0.06)'; ctx.fill();
        if (v) { emoji(ctx, TILE[v] || '⭐', ox + x * cs + cs / 2, oy + y * cs + cs / 2 - 6, cs * 0.42); text(ctx, String(v), ox + x * cs + cs / 2, oy + y * cs + cs - 17, 13, '#fff'); }
      }
      // the ladder of animals
      const lad = [2, 8, 32, 128, 512, 2048];
      lad.forEach((v, i) => { ctx.globalAlpha = best >= v ? 1 : 0.3; emoji(ctx, TILE[v], 40, 80 + i * 52, 30); text(ctx, String(v), 40, 104 + i * 52, 11, '#9aa3c2'); });
      ctx.globalAlpha = 1;
      pops(ctx, fx, dt);
      text(ctx, `🐲 ${score}`, ox, 24, 18, '#fff', 'left');
      text(ctx, 'arrows or swipe', ox + size, 24, 13, '#9aa3c2', 'right');
    },
    key(k, down) { if (!down) return; const m = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U' }[k]; if (m) move(m); },
    point(px, py, kind) {
      if (kind === 'down') sw = [px, py];
      else if (kind === 'up' && sw) { const dx = px - sw[0], dy = py - sw[1]; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')); }
    },
  };
}

// ---------- Flappy Pet: flap through the gaps between windows ----------
function flappy(ctx, api) {
  const { W, H } = api;
  const px = 120, gapH = 150, pw = 70;
  let y = H / 2, vy = 0, t = 0, score = 0, over = false, started = false, next = 0, speed = 170;
  const pipes = [], fx = [], stars = Array.from({ length: 30 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 1.5) }));
  const flap = () => { if (over) return; started = true; vy = -390; api.sound('hop'); };
  return {
    update(dt) {
      t += dt;
      for (const s of stars) { s.x -= s.s * 12 * dt; if (s.x < 0) s.x = W; }
      if (!started || over) { if (!started) y = H / 2 + Math.sin(t * 3) * 8; if (over && y < H - 20) { vy += 1300 * dt; y = Math.min(H - 20, y + vy * dt); } return; }
      speed = 170 + Math.min(110, t * 2.5);
      vy += 1300 * dt; y += vy * dt;
      next -= dt;
      if (next <= 0) { next = 1.55; pipes.push({ x: W + pw, gy: rand(80, H - 80 - gapH), passed: false }); }
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i]; p.x -= speed * dt;
        if (!p.passed && p.x + pw < px - 16) { p.passed = true; score++; fx.push({ s: '+1', x: px, y: y - 40, t: 0 }); api.sound('pop'); }
        if (px + 16 > p.x && px - 16 < p.x + pw && (y - 34 < p.gy || y - 4 > p.gy + gapH)) { over = true; api.sound('boing'); api.end(score); }
        if (p.x < -pw - 10) pipes.splice(i, 1);
      }
      if (y > H - 6 || y < 20) { over = true; api.sound('boing'); api.end(score); }
    },
    draw(dt) {
      bg(ctx, W, H, '#14254a', '#2a3f72');
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const s of stars) ctx.fillRect(s.x, s.y, s.s * 1.6, s.s * 1.6);
      for (const p of pipes) for (const [yy, hh, up] of [[0, p.gy, true], [p.gy + gapH, H - p.gy - gapH, false]]) {
        rr(ctx, p.x, yy - (up ? 10 : 0), pw, hh + 10, 10); ctx.fillStyle = '#2b3157'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.stroke();
        const by = up ? p.gy - 18 : p.gy + gapH;
        rr(ctx, p.x - 4, by, pw + 8, 18, 6); ctx.fillStyle = '#3a4377'; ctx.fill();
        for (const [i, c] of ['#ff6b6b', '#ffd166', '#7ee8c6'].entries()) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x + 8 + i * 9, by + 9, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      api.pet(px, y, { dir: 1, rot: Math.max(-0.5, Math.min(0.9, vy / 700)), arms: vy < 0 ? 'up' : 'down', eyes: over ? 'x' : vy < 0 ? 'happy' : 'open', mouth: vy < 0 ? 'open' : 'o', ears: vy < 0 ? 1 : -0.4, tailWag: 14 }, 0.85);
      pops(ctx, fx, dt);
      text(ctx, String(score), W / 2, 50, 34, '#fff');
      if (!started) text(ctx, 'Tap, click or Space to flap', W / 2, H / 2 + 70, 17, '#ffd166');
    },
    key(k, down) { if (down && (k === ' ' || k === 'ArrowUp' || k === 'w')) flap(); },
    point(px2, py, kind) { if (kind === 'down') flap(); },
  };
}

// ---------- Pet Wordle: guess the 5-letter word in 6 tries (one word a day) ----------
const ANSWERS = 'apple beach bread brave bunny cabin candy charm cheer chess cloud clown cocoa coral couch crane crown dance daisy dream drink eagle earth feast field flame float flute frost fruit ghost giant glove grape grass green happy heart honey horse house jelly juice kitty koala laugh lemon light llama lucky lunar magic mango maple melon mouse music night ocean olive otter panda party peach pearl penny piano pilot pizza plant plush polar puppy queen quiet radio rainy robin rocky royal salad sandy scarf shark sheep shell shine skate sleep smile snack snail snowy solar space spark spice spoon sport stamp stars storm sugar sunny sweet swing table tiger toast tower train treat tulip unity vivid water whale wheel wings witty world yummy zebra bloom blush cards chair chirp cream crisp dusty fairy fancy flock fluff gecko gummy hippo igloo jolly kayak latte lilac lotus merry mocha moose nacho noble peony petal pixel plume poppy quilt raven salsa scone shiny sushi tacos teddy thyme vapor waltz yacht zesty bagel berry bingo bliss boxer brook bumpy camel chalk chimp cider comet crumb dingo disco donut ember flora fudge gravy gusty hazel heron icing ivory jumbo karma lemur lunch mamba marsh mints moody nerdy noisy nutty oasis pecan perky pinky quack rhino robot rumba scoop sloth spicy squid stork swirl tango tempo trunk unzip viper wafer woody'.split(' ');
let WORDS = null;
const loadWords = () => (WORDS ? Promise.resolve(WORDS) : fetch('/games/words5.txt').then((r) => r.text()).then((t) => (WORDS = new Set(t.split(/\s+/)))).catch(() => (WORDS = new Set(ANSWERS))));
export const wordleDay = () => Math.floor(Date.now() / 86400000);
function wordle(ctx, api) {
  const { W, H } = api;
  const day = wordleDay();
  const ans = ANSWERS[(day * 7919) % ANSWERS.length];
  const rows = [], marks = [];
  let cur = '', over = false, msg = 'Guess today’s word!', shake = 0, t = 0, won = false;
  const keyMarks = {};
  loadWords();
  const kb = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const cs = 44, gx = Math.max(16, (W - 290 - (5 * cs + 4 * 6)) / 2), gy = 30;
  const kx0 = W - 290;
  const keyRect = (r, i) => ({ x: kx0 + i * 27 + r * 12, y: 120 + r * 46, w: 24, h: 40 });
  const special = { enter: { x: kx0, y: 120 + 3 * 46, w: 92, h: 40 }, back: { x: kx0 + 168, y: 120 + 3 * 46, w: 92, h: 40 } };
  const score = (g) => {
    const res = Array(5).fill('x'), left = {};
    for (let i = 0; i < 5; i++) if (g[i] === ans[i]) res[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1;
    for (let i = 0; i < 5; i++) if (res[i] !== 'g' && left[g[i]]) { res[i] = 'y'; left[g[i]]--; }
    return res;
  };
  const submit = () => {
    if (over) return;
    if (cur.length < 5) { msg = 'Not enough letters'; shake = 0.4; api.sound('boing'); return; }
    if (WORDS && !WORDS.has(cur) && !ANSWERS.includes(cur)) { msg = 'Not in the word list'; shake = 0.4; api.sound('boing'); return; }
    const m = score(cur);
    rows.push(cur); marks.push(m);
    for (let i = 0; i < 5; i++) { const c = cur[i], v = m[i]; if (v === 'g' || (v === 'y' && keyMarks[c] !== 'g') || !keyMarks[c]) keyMarks[c] = v; }
    if (cur === ans) { won = true; over = true; msg = ['Genius! 🤯', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew! 😅'][rows.length - 1]; api.sound('chime'); api.end((7 - rows.length) * 10, { daily: day }); }
    else if (rows.length === 6) { over = true; msg = `The word was ${ans.toUpperCase()}`; api.sound('boing'); api.end(0, { daily: day }); }
    else { msg = ''; api.sound('pop'); }
    cur = '';
  };
  const type = (c) => { if (over) return; if (c === 'enter') submit(); else if (c === 'back') cur = cur.slice(0, -1); else if (/^[a-z]$/.test(c) && cur.length < 5) { cur += c; api.sound('hop'); } };
  const COL = { g: '#3fbf7f', y: '#d9a93a', x: '#3a3f5c' };
  return {
    update(dt) { t += dt; shake = Math.max(0, shake - dt); },
    draw() {
      bg(ctx, W, H, '#16193a', '#26204a');
      for (let r = 0; r < 6; r++) {
        const word = r < rows.length ? rows[r] : r === rows.length ? cur : '';
        const sx = r === rows.length && shake ? Math.sin(t * 60) * 6 * shake : 0;
        for (let i = 0; i < 5; i++) {
          const x = gx + i * (cs + 6) + sx, y = gy + r * (cs + 6);
          rr(ctx, x, y, cs, cs, 8);
          ctx.fillStyle = r < rows.length ? COL[marks[r][i]] : 'rgba(255,255,255,0.05)'; ctx.fill();
          ctx.strokeStyle = word[i] && r >= rows.length ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();
          if (word[i]) text(ctx, word[i].toUpperCase(), x + cs / 2, y + cs / 2 + 1, 22, '#fff');
        }
      }
      kb.forEach((row, r) => row.split('').forEach((c, i) => {
        const k = keyRect(r, i); rr(ctx, k.x, k.y, k.w, k.h, 6);
        ctx.fillStyle = keyMarks[c] ? COL[keyMarks[c]] : 'rgba(255,255,255,0.14)'; ctx.fill();
        text(ctx, c.toUpperCase(), k.x + k.w / 2, k.y + k.h / 2, 13, '#fff');
      }));
      for (const [k, l] of [['enter', 'ENTER'], ['back', '⌫ DEL']]) { const b = special[k]; rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); text(ctx, l, b.x + b.w / 2, b.y + b.h / 2, 13, '#fff'); }
      text(ctx, msg, kx0 + 130, 70, 16, won ? '#7ee8c6' : '#ffd166');
      text(ctx, 'Pet Wordle · a new word every day', kx0 + 130, 30, 13, '#9aa3c2');
      api.pet(kx0 + 130, H - 12, { dir: -1, eyes: won ? 'happy' : over ? 'x' : 'open', mouth: won ? 'open' : 'smile', arms: won ? 'up' : 'down', ears: 1, bob: won ? Math.abs(Math.sin(t * 7)) * 4 : 0 }, 0.6);
    },
    key(k, down) { if (!down) return; if (k === 'Enter') type('enter'); else if (k === 'Backspace') type('back'); else if (/^[a-zA-Z]$/.test(k)) type(k.toLowerCase()); },
    point(px, py, kind) {
      if (kind !== 'down') return;
      kb.forEach((row, r) => row.split('').forEach((c, i) => { const k = keyRect(r, i); if (px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h) type(c); }));
      for (const k of ['enter', 'back']) { const b = special[k]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) type(k); }
    },
  };
}

// ---------- Snack Snake ----------
function snake(ctx, api) {
  const { W, H } = api;
  const cs = 24, cols = Math.floor((W - 20) / cs), rows = Math.floor((H - 50) / cs), ox = (W - cols * cs) / 2, oy = 40;
  let body = [[5, 6], [4, 6], [3, 6]], dir = [1, 0], want = [1, 0], acc = 0, step = 0.14, score = 0, over = false, t = 0, sw = null;
  const SN = ['🍪', '🍩', '🍓', '🍦', '🧁', '🍉', '🍬', '🥐'];
  let food = null;
  const fx = [];
  const place = () => { for (let i = 0; i < 200; i++) { const f = [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)]; if (!body.some(([x, y]) => x === f[0] && y === f[1])) { food = { p: f, e: pickOne(SN) }; return; } } };
  place();
  const turn = (d) => { if (d[0] === -dir[0] && d[1] === -dir[1]) return; want = d; };
  return {
    update(dt) {
      t += dt;
      if (over) return;
      acc += dt;
      while (acc >= step) {
        acc -= step;
        dir = want;
        const h = [body[0][0] + dir[0], body[0][1] + dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= cols || h[1] >= rows || body.some(([x, y]) => x === h[0] && y === h[1])) { over = true; api.sound('boing'); api.end(score); return; }
        body.unshift(h);
        if (food && h[0] === food.p[0] && h[1] === food.p[1]) { score++; fx.push({ s: '+1', x: ox + h[0] * cs, y: oy + h[1] * cs, t: 0 }); api.sound('nom'); step = Math.max(0.07, step - 0.004); place(); }
        else body.pop();
      }
    },
    draw(dt) {
      bg(ctx, W, H, '#132a2a', '#1d3a3a');
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { if ((x + y) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs); } }
      ctx.strokeStyle = 'rgba(126,232,198,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cols * cs, rows * cs);
      if (food) emoji(ctx, food.e, ox + food.p[0] * cs + cs / 2, oy + food.p[1] * cs + cs / 2, cs * 0.85, Math.sin(t * 4) * 0.2);
      for (let i = body.length - 1; i >= 1; i--) {
        const [x, y] = body[i];
        ctx.beginPath(); ctx.arc(ox + x * cs + cs / 2, oy + y * cs + cs / 2, cs * 0.42 - Math.min(4, i * 0.15), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#7ee8c6' : '#5fd3b0'; ctx.fill();
      }
      const [hx, hy] = body[0];
      api.pet(ox + hx * cs + cs / 2, oy + hy * cs + cs * 0.95, { dir: dir[0] < 0 ? -1 : 1, eyes: over ? 'x' : 'open', mouth: 'open', ears: 1, stride: 1, walk: t * 18 }, 0.5);
      pops(ctx, fx, dt);
      text(ctx, `🐍 ${score}`, 16, 22, 18, '#fff', 'left');
      text(ctx, 'arrows or swipe', W - 16, 22, 13, '#9aa3c2', 'right');
    },
    key(k, down) { if (!down) return; const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1] }[k]; if (d) turn(d); },
    point(px, py, kind) {
      if (kind === 'down') sw = [px, py];
      else if (kind === 'up' && sw) { const dx = px - sw[0], dy = py - sw[1]; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); }
    },
  };
}

export const SOLO2 = [
  { key: 'blast', title: 'Block Blast', emoji: '🧱', blurb: 'Drop blocks, clear rows and columns, chain combos.', how: 'Drag a shape from the right onto the board.', pts: (s) => Math.min(60, Math.floor(s / 15)), isNew: true },
  { key: 'merge', title: 'Fruit Merge', emoji: '🍉', blurb: 'Drop fruit. Two of a kind merge into a bigger one.', how: 'Move to aim, click or Space to drop. Don’t cross the line!', pts: (s) => Math.min(60, Math.floor(s / 12)), isNew: true },
  { key: 'p2048', title: '2048 Pets', emoji: '🐲', blurb: 'Slide and merge pets all the way up to the dragon.', how: 'Arrow keys or swipe.', pts: (s) => Math.min(60, Math.floor(s / 40)), isNew: true },
  { key: 'flappy', title: 'Flappy Pet', emoji: '🪽', blurb: 'Flap through the gaps between windows.', how: 'Tap, click or Space to flap.', pts: (s) => Math.min(60, s * 3), isNew: true },
  { key: 'wordle', title: 'Pet Wordle', emoji: '🔤', blurb: 'Guess the 5-letter word in 6 tries. New word daily.', how: 'Type letters, Enter to guess. Green = right spot, yellow = in the word.', pts: (s) => Math.min(60, s), daily: true, isNew: true },
  { key: 'snake', title: 'Snack Snake', emoji: '🐍', blurb: 'Classic snake: eat snacks, grow long, don’t bite yourself.', how: 'Arrow keys or swipe.', pts: (s) => Math.min(60, s * 3), isNew: true },
];
export const MAKERS2 = { blast, merge, p2048, flappy, wordle, snake };
