// Pet Pool and Ludo (vs computer). Same maker API as solo.js: (ctx, api) => { update, draw, key, point }.
import { TRACK, START, SAFE, HOME_COL, COLORS, COLOR_NAMES, GOAL, spot, legalMoves, applyMove, allHome, botPick } from '../../lib/ludo';

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function text(ctx, s, x, y, size = 16, color = '#fff', align = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------- Pet Pool
// 10 balls, 12 shots. Drag back from anywhere to aim (like a slingshot), let go to shoot.
// Keyboard: ← → aim, ↑ ↓ power, Space shoot.
function pool(ctx, api) {
  const { W, H } = api;
  const M = 26, R = 9, PR = 17;
  const T = { x: M, y: 44, w: W - M * 2, h: H - 44 - M };
  const pockets = [[T.x, T.y], [T.x + T.w / 2, T.y - 3], [T.x + T.w, T.y], [T.x, T.y + T.h], [T.x + T.w / 2, T.y + T.h + 3], [T.x + T.w, T.y + T.h]];
  const BALL_C = ['#ffd166', '#4ca3ff', '#ff5a6e', '#a78bfa', '#ff9f43', '#3ddc84', '#b5651d', '#111827', '#ff8fd0', '#5ef2ff'];
  const balls = [];
  const cue = { x: T.x + T.w * 0.25, y: T.y + T.h / 2, vx: 0, vy: 0, cue: true, in: false };
  balls.push(cue);
  const rx = T.x + T.w * 0.68, ry = T.y + T.h / 2;
  let n = 0;
  for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) {
    balls.push({ x: rx + row * R * 1.8, y: ry + (k - row / 2) * R * 2.1, vx: 0, vy: 0, c: BALL_C[n], num: n + 1, in: false });
    n++;
  }
  let shots = 12, score = 0, aim = Math.PI, power = 0.55, drag = null, moving = false, potThisShot = 0, scratched = false, over = false, t = 0;
  const fx = [];
  const still = () => balls.every((b) => b.in || Math.hypot(b.vx, b.vy) < 2);
  const left = () => balls.filter((b) => !b.cue && !b.in).length;

  function shoot() {
    if (moving || over || shots <= 0) return;
    const sp = 260 + power * 820;
    cue.vx = Math.cos(aim) * sp; cue.vy = Math.sin(aim) * sp;
    shots--; moving = true; potThisShot = 0; scratched = false;
    api.sound('pop');
  }
  function settle() {
    moving = false;
    for (const b of balls) { b.vx = 0; b.vy = 0; }
    if (potThisShot > 1) { score += (potThisShot - 1) * 5; fx.push({ s: `Combo +${(potThisShot - 1) * 5}`, x: W / 2, y: H / 2, t: 0, c: '#7ee8c6' }); }
    if (scratched) {
      cue.in = false; cue.x = T.x + T.w * 0.25; cue.y = T.y + T.h / 2;
      for (const b of balls) if (b !== cue && !b.in && Math.hypot(b.x - cue.x, b.y - cue.y) < R * 2.2) cue.y += R * 2.5;
      shots = Math.max(0, shots - 1);
      fx.push({ s: 'Scratch! −1 shot', x: W / 2, y: H / 2 + 30, t: 0, c: '#ff8f8f' });
    }
    if (left() === 0) { score += shots * 5; fx.push({ s: `Cleared! +${shots * 5}`, x: W / 2, y: H / 2, t: 0, c: '#ffd166' }); api.sound('chime'); over = true; api.end(score, { cleared: true }); return; }
    if (shots <= 0) { over = true; api.end(score); }
  }
  function step(dt) {
    for (const b of balls) {
      if (b.in) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - (70 + sp * 0.75) * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      for (const [px, py] of pockets) {
        if (Math.hypot(b.x - px, b.y - py) < PR) {
          b.in = true; b.vx = b.vy = 0;
          if (b.cue) { scratched = true; api.sound('boing'); }
          else { score += 10; potThisShot++; fx.push({ s: '+10', x: px, y: py + (py < H / 2 ? 24 : -24), t: 0, c: '#ffd166' }); api.sound('nom'); }
        }
      }
      if (b.in) continue;
      if (b.x < T.x + R) { b.x = T.x + R; b.vx = Math.abs(b.vx) * 0.82; }
      if (b.x > T.x + T.w - R) { b.x = T.x + T.w - R; b.vx = -Math.abs(b.vx) * 0.82; }
      if (b.y < T.y + R) { b.y = T.y + R; b.vy = Math.abs(b.vy) * 0.82; }
      if (b.y > T.y + T.h - R) { b.y = T.y + T.h - R; b.vy = -Math.abs(b.vy) * 0.82; }
    }
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.in || b.in) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < R * 2) {
        const nx = dx / d, ny = dy / d, ov = (R * 2 - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) { const imp = rel * 0.96; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; if (rel > 60) api.sound('hop'); }
      }
    }
  }
  // where the cue ball would first touch another ball along the aim line (for the guide)
  function guide() {
    const dx = Math.cos(aim), dy = Math.sin(aim);
    let best = 900, hit = null;
    for (const b of balls) {
      if (b.cue || b.in) continue;
      const fx2 = b.x - cue.x, fy = b.y - cue.y, proj = fx2 * dx + fy * dy;
      if (proj <= 0) continue;
      const perp = Math.abs(fx2 * dy - fy * dx);
      if (perp < R * 2) { const back = Math.sqrt(R * R * 4 - perp * perp); const d = proj - back; if (d < best) { best = d; hit = b; } }
    }
    // stop at the cushion
    const tx = dx > 0 ? (T.x + T.w - R - cue.x) / dx : dx < 0 ? (T.x + R - cue.x) / dx : 1e9;
    const ty = dy > 0 ? (T.y + T.h - R - cue.y) / dy : dy < 0 ? (T.y + R - cue.y) / dy : 1e9;
    const wall = Math.max(0, Math.min(tx, ty));
    return best < wall ? { len: best, hit } : { len: wall, hit: null };
  }
  return {
    update(dt) {
      t += dt;
      for (const f of fx) f.t += dt;
      while (fx.length && fx[0].t > 1.4) fx.shift();
      if (!moving) return;
      for (let s = 0; s < 6; s++) step(dt / 6);
      if (still()) settle();
    },
    draw() {
      ctx.fillStyle = '#1b1530'; ctx.fillRect(0, 0, W, H);
      text(ctx, `🎱 Shots ${shots}`, 20, 22, 15, '#fff', 'left');
      text(ctx, `Score ${score}`, W / 2, 22, 15, '#ffd166');
      text(ctx, `${left()} balls left`, W - 20, 22, 15, '#cfe3ff', 'right');
      rr(ctx, T.x - 16, T.y - 16, T.w + 32, T.h + 32, 18); ctx.fillStyle = '#6b3f22'; ctx.fill();
      rr(ctx, T.x, T.y, T.w, T.h, 6); ctx.fillStyle = '#1f8f5f'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(T.x + T.w * 0.25, T.y, 1, T.h);
      for (const [px, py] of pockets) { ctx.beginPath(); ctx.arc(px, py, PR, 0, Math.PI * 2); ctx.fillStyle = '#0b0b10'; ctx.fill(); }
      if (!moving && !over && !cue.in) {
        const g = guide();
        ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(cue.x + Math.cos(aim) * g.len, cue.y + Math.sin(aim) * g.len); ctx.stroke(); ctx.setLineDash([]);
        if (g.hit) {
          const gx = cue.x + Math.cos(aim) * g.len, gy = cue.y + Math.sin(aim) * g.len;
          ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
          const nx = g.hit.x - gx, ny = g.hit.y - gy, d = Math.hypot(nx, ny) || 1;
          ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.beginPath(); ctx.moveTo(g.hit.x, g.hit.y); ctx.lineTo(g.hit.x + (nx / d) * 60, g.hit.y + (ny / d) * 60); ctx.stroke();
        }
        // cue stick
        const back = 18 + power * 40;
        const sx = cue.x - Math.cos(aim) * back, sy = cue.y - Math.sin(aim) * back;
        ctx.strokeStyle = '#e8c38a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(aim) * 170, sy - Math.sin(aim) * 170); ctx.stroke(); ctx.lineCap = 'butt';
        // power bar
        rr(ctx, W - 22, T.y + 10, 8, T.h - 20, 4); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
        const ph = (T.h - 20) * power; rr(ctx, W - 22, T.y + 10 + (T.h - 20) - ph, 8, ph, 4); ctx.fillStyle = power > 0.8 ? '#ff8f8f' : '#7ee8c6'; ctx.fill();
      }
      for (const b of balls) {
        if (b.in) continue;
        ctx.beginPath(); ctx.arc(b.x + 1.5, b.y + 2, R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fillStyle = b.cue ? '#fffdf5' : b.c; ctx.fill();
        if (!b.cue) { ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.48, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); text(ctx, String(b.num), b.x, b.y + 0.5, 8, '#111', 'center', 800); }
        ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 2.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      }
      api.pet(T.x + T.w - 40, T.y + T.h + 14, { dir: -1, eyes: moving ? 'happy' : 'open', mouth: moving ? 'open' : 'smile', arms: 'down', ears: moving ? 1 : 0 }, 0.42);
      for (const f of fx) { ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4); text(ctx, f.s, f.x, f.y - f.t * 30, 16, f.c); ctx.globalAlpha = 1; }
      if (!moving && !over && shots === 12 && t < 6) text(ctx, 'Drag back to aim, let go to shoot', W / 2, H - 9, 12, 'rgba(255,255,255,0.7)', 'center', 600);
    },
    key(k, down) {
      if (!down || moving || over) return;
      if (k === 'ArrowLeft' || k === 'a') aim -= 0.04;
      if (k === 'ArrowRight' || k === 'd') aim += 0.04;
      if (k === 'ArrowUp' || k === 'w') power = Math.min(1, power + 0.05);
      if (k === 'ArrowDown') power = Math.max(0.05, power - 0.05);
      if (k === ' ' || k === 'Enter') shoot();
    },
    point(x, y, type) {
      if (moving || over) return;
      if (type === 'down') drag = { x, y };
      if (type === 'move' && drag) {
        const dx = cue.x - x, dy = cue.y - y;
        if (Math.hypot(dx, dy) > 4) aim = Math.atan2(dy, dx);
        power = Math.max(0.05, Math.min(1, Math.hypot(x - drag.x, y - drag.y) / 160));
      }
      if (type === 'up' && drag) {
        const moved = Math.hypot(x - drag.x, y - drag.y);
        drag = null;
        if (moved > 12) shoot();
        else { aim = Math.atan2(y - cue.y, x - cue.x); } // a tap just aims at that spot
      }
    },
  };
}

// ---------------------------------------------------------------- Ludo (vs computer)
function ludo(ctx, api) {
  const { W, H } = api;
  const wide = W >= 560;
  const S = Math.floor(wide ? Math.min((H - 16) / 15, (W - 190) / 15) : Math.min((W - 16) / 15, (H - 110) / 15));
  const BX = wide ? 8 : Math.floor((W - S * 15) / 2), BY = 8;
  const PX = wide ? BX + S * 15 + 16 : 12, PY = wide ? BY : BY + S * 15 + 10, PW = wide ? W - PX - 10 : W - 24;
  const ME = 3;
  let seats = null, tokens = {}, turn = ME, dice = 0, rolling = 0, sixes = 0, phase = 'pick', hint = '', anim = null, t = 0, winner = -1, caps = 0, botWait = 0;
  const btns = [];

  function start(n) {
    seats = n === 2 ? [3, 1] : [3, 0, 1, 2];
    tokens = Object.fromEntries(seats.map((s) => [s, [0, 0, 0, 0]]));
    turn = ME; dice = 0; phase = 'roll'; hint = 'Roll the dice';
  }
  const nextSeat = (s) => { const i = seats.indexOf(s); return seats[(i + 1) % seats.length]; };
  function endTurn(extra) {
    if (allHome(tokens, turn)) { winner = turn; phase = 'over'; finish(); return; }
    if (!extra) { turn = nextSeat(turn); sixes = 0; }
    dice = 0; phase = 'roll'; hint = turn === ME ? (extra ? 'Bonus roll! Roll again' : 'Your turn: roll the dice') : `${COLOR_NAMES[turn]} is thinking…`;
    botWait = 0.7;
  }
  function finish() {
    const home = tokens[ME].filter((p) => p >= GOAL).length;
    const won = winner === ME;
    const score = (won ? (seats.length === 4 ? 100 : 60) : 0) + home * 10 + caps * 5;
    api.sound(won ? 'chime' : 'boing');
    api.end(score, { won });
  }
  function roll() {
    if (phase !== 'roll') return;
    phase = 'rolling'; rolling = 0.55; api.sound('hop');
  }
  function afterRoll() {
    if (dice === 6) sixes++;
    if (sixes === 3) { hint = 'Three sixes in a row: turn over!'; sixes = 0; setTimeout(() => endTurn(false), 700); phase = 'wait'; return; }
    const moves = legalMoves(tokens, turn, dice);
    if (!moves.length) { hint = turn === ME ? `No moves with a ${dice}` : `${COLOR_NAMES[turn]} can't move`; phase = 'wait'; setTimeout(() => endTurn(false), 900); return; }
    if (turn === ME) {
      if (moves.length === 1) { phase = 'wait'; setTimeout(() => move(moves[0]), 350); }
      else { phase = 'move'; hint = 'Pick a glowing token'; }
    } else { phase = 'wait'; setTimeout(() => move(botPick(tokens, turn, dice)), 550); }
  }
  function move(i) {
    const seat = turn;
    const from = tokens[seat][i];
    const r = applyMove(tokens, seat, i, dice);
    const path = [];
    if (from === 0) path.push(1); else for (let p = from + 1; p <= r.to; p++) path.push(p);
    anim = { seat, i, path, k: 0, tt: 0, then: () => {
      tokens = r.tokens;
      if (r.captured.length) { api.sound('boing'); if (seat === ME) caps += r.captured.length; hint = seat === ME ? 'Captured! Bonus roll' : `${COLOR_NAMES[seat]} captured ${r.captured.some(([s]) => s === ME) ? 'your token' : 'a token'}!`; }
      else if (r.finished) { api.sound('chime'); hint = seat === ME ? 'Home! Bonus roll' : `${COLOR_NAMES[seat]} got one home`; }
      endTurn(r.extra && !allHome(r.tokens, seat));
    } };
    phase = 'anim';
  }
  const cellXY = ([cx, cy]) => [BX + cx * S, BY + cy * S];
  function tokenAt(x, y) {
    if (phase !== 'move' || turn !== ME) return -1;
    const ok = legalMoves(tokens, ME, dice);
    for (const i of ok) {
      const [cx, cy] = cellXY(spot(ME, tokens[ME][i], i));
      if (Math.hypot(x - cx, y - cy) < S * 0.7) return i;
    }
    return -1;
  }
  function drawBoard() {
    ctx.fillStyle = '#fbf7ef'; rr(ctx, BX - 4, BY - 4, S * 15 + 8, S * 15 + 8, 10); ctx.fill();
    const quad = [[0, 0, 0], [9, 0, 1], [9, 9, 2], [0, 9, 3]];
    for (const [qx, qy, s] of quad) {
      ctx.fillStyle = COLORS[s]; rr(ctx, BX + qx * S, BY + qy * S, 6 * S, 6 * S, 8); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, BX + (qx + 0.8) * S, BY + (qy + 0.8) * S, 4.4 * S, 4.4 * S, 10); ctx.fill();
      for (const [bx, by] of [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]]) { ctx.beginPath(); ctx.arc(BX + (qx + bx) * S + 0, BY + (qy + by) * S, S * 0.55, 0, Math.PI * 2); ctx.fillStyle = COLORS[s] + '44'; ctx.fill(); }
    }
    TRACK.forEach(([c, r], i) => {
      let fill = '#fff';
      for (let s = 0; s < 4; s++) if (START[s] === i) fill = COLORS[s];
      ctx.fillStyle = fill; ctx.fillRect(BX + c * S + 0.5, BY + r * S + 0.5, S - 1, S - 1);
      if (SAFE.has(i) && fill === '#fff') text(ctx, '★', BX + (c + 0.5) * S, BY + (r + 0.55) * S, S * 0.6, '#c9b98f');
    });
    HOME_COL.forEach((col, s) => col.forEach(([c, r]) => { ctx.fillStyle = COLORS[s]; ctx.fillRect(BX + c * S + 0.5, BY + r * S + 0.5, S - 1, S - 1); }));
    const cx = BX + 7.5 * S, cy = BY + 7.5 * S;
    const tri = (s, ax, ay, bx2, by2) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(BX + ax * S, BY + ay * S); ctx.lineTo(BX + bx2 * S, BY + by2 * S); ctx.closePath(); ctx.fillStyle = COLORS[s]; ctx.fill(); };
    tri(0, 6, 6, 6, 9); tri(1, 6, 6, 9, 6); tri(2, 9, 6, 9, 9); tri(3, 6, 9, 9, 9);
  }
  function drawToken(seat, i, p, glow, override) {
    const [cx, cy] = override || cellXY(spot(seat, p, i));
    const same = override ? 0 : Object.keys(tokens).flatMap((s) => tokens[s].map((q, j) => [Number(s), j, q])).filter(([s, j, q]) => q > 0 && q < GOAL && spot(s, q, j).join() === spot(seat, p, i).join());
    const k = same ? same.findIndex(([s, j]) => s === seat && j === i) : 0;
    const off = same && same.length > 1 ? (k - (same.length - 1) / 2) * S * 0.22 : 0;
    const x = cx + off, y = cy - (override ? 0 : 0);
    if (glow) { ctx.beginPath(); ctx.arc(x, y, S * 0.55 + Math.sin(t * 6) * 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y + 2, S * 0.38, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, S * 0.38, 0, Math.PI * 2); ctx.fillStyle = COLORS[seat]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.arc(x - S * 0.11, y - 1, S * 0.05, 0, Math.PI * 2); ctx.arc(x + S * 0.11, y - 1, S * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  function drawDie(x, y, size, v) {
    ctx.fillStyle = '#fff'; rr(ctx, x, y, size, size, size * 0.2); ctx.fill();
    ctx.strokeStyle = COLORS[turn]; ctx.lineWidth = 3; ctx.stroke();
    const P = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]] }[v] || [];
    ctx.fillStyle = '#1b1530';
    for (const [a, b] of P) { ctx.beginPath(); ctx.arc(x + a * size, y + b * size, size * 0.08, 0, Math.PI * 2); ctx.fill(); }
  }
  return {
    update(dt) {
      t += dt;
      if (phase === 'rolling') {
        rolling -= dt;
        dice = 1 + Math.floor(Math.random() * 6);
        if (rolling <= 0) { dice = 1 + Math.floor(Math.random() * 6); phase = 'rolled'; afterRoll(); }
      }
      if (phase === 'roll' && turn !== ME && seats) { botWait -= dt; if (botWait <= 0) roll(); }
      if (phase === 'anim' && anim) {
        anim.tt += dt;
        if (anim.tt > 0.12) { anim.tt = 0; anim.k++; api.sound('pop'); }
        if (anim.k >= anim.path.length) { const f = anim.then; anim = null; f(); }
      }
    },
    draw() {
      ctx.fillStyle = '#2b1d3f'; ctx.fillRect(0, 0, W, H);
      btns.length = 0;
      if (!seats) {
        text(ctx, '🎲 Ludo', W / 2, 90, 34);
        text(ctx, 'Race all 4 of your tokens home before the computer does.', W / 2, 135, 14, '#cfe3ff', 'center', 600);
        const bw = Math.min(220, W / 2 - 24);
        for (const [n, lab, sub, x] of [[2, '1 vs 1', 'Quick game (~5 min)', W / 2 - bw - 8], [4, '4 players', 'You vs 3 computers', W / 2 + 8]]) {
          rr(ctx, x, 180, bw, 110, 16); ctx.fillStyle = n === 2 ? '#4ca3ff' : '#ff5a6e'; ctx.fill();
          text(ctx, lab, x + bw / 2, 222, 22); text(ctx, sub, x + bw / 2, 255, 13, '#fff', 'center', 600);
          btns.push({ x, y: 180, w: bw, h: 110, go: () => start(n) });
        }
        text(ctx, 'Press 1 or 4 on your keyboard too', W / 2, 330, 12, 'rgba(255,255,255,0.6)', 'center', 600);
        return;
      }
      drawBoard();
      const ok = phase === 'move' && turn === ME ? legalMoves(tokens, ME, dice) : [];
      for (const s of seats) tokens[s].forEach((p, i) => {
        if (anim && anim.seat === s && anim.i === i) return;
        drawToken(s, i, p, ok.includes(i));
      });
      if (anim) {
        const p = anim.path[Math.min(anim.k, anim.path.length - 1)];
        const [x, y] = cellXY(spot(anim.seat, p, anim.i));
        drawToken(anim.seat, anim.i, p, false, [x, y - Math.sin((anim.tt / 0.12) * Math.PI) * S * 0.25]);
      }
      // panel
      const ds = wide ? 74 : 56;
      const dx = wide ? PX + (PW - ds) / 2 : PX + 10, dy = wide ? PY + 40 : PY + 4;
      text(ctx, turn === ME ? 'Your turn' : `${COLOR_NAMES[turn]}’s turn`, wide ? PX + PW / 2 : dx + ds + 14, wide ? PY + 16 : PY + 16, 15, COLORS[turn], wide ? 'center' : 'left');
      drawDie(dx, dy + (phase === 'rolling' ? Math.sin(t * 40) * 3 : 0), ds, dice || 1);
      if (turn === ME && phase === 'roll') { btns.push({ x: dx, y: dy, w: ds, h: ds, go: roll }); text(ctx, 'Tap to roll', wide ? dx + ds / 2 : dx + ds + 14, wide ? dy + ds + 16 : PY + 46, 12, '#fff', wide ? 'center' : 'left', 700); }
      const hy = wide ? dy + ds + 44 : PY + 70;
      ctx.font = '600 13px system-ui, sans-serif';
      const words = hint.split(' '); let line = '', ly = hy;
      for (const w of words) { const tl = line ? line + ' ' + w : w; if (ctx.measureText(tl).width > (wide ? PW : PW - ds - 30) && line) { text(ctx, line, wide ? PX + PW / 2 : dx + ds + 14, ly, 13, '#cfe3ff', wide ? 'center' : 'left', 600); line = w; ly += 18; } else line = tl; }
      if (line) text(ctx, line, wide ? PX + PW / 2 : dx + ds + 14, ly, 13, '#cfe3ff', wide ? 'center' : 'left', 600);
      if (wide) {
        let y = hy + 56;
        for (const s of seats) {
          const home = tokens[s].filter((p) => p >= GOAL).length;
          ctx.beginPath(); ctx.arc(PX + 14, y, 7, 0, Math.PI * 2); ctx.fillStyle = COLORS[s]; ctx.fill();
          text(ctx, `${s === ME ? 'You' : COLOR_NAMES[s]}  ${'●'.repeat(home)}${'○'.repeat(4 - home)}`, PX + 28, y, 13, '#fff', 'left', 700);
          y += 24;
        }
        api.pet(PX + PW / 2, H - 14, { dir: 1, eyes: turn === ME ? 'happy' : 'open', mouth: 'smile', arms: turn === ME ? 'up' : 'down', ears: 1 }, 0.5);
      }
    },
    key(k, down) {
      if (!down) return;
      if (!seats) { if (k === '1' || k === '2') start(2); if (k === '4') start(4); return; }
      if ((k === ' ' || k === 'Enter') && turn === ME && phase === 'roll') roll();
      if (/^[1-4]$/.test(k) && phase === 'move' && turn === ME) { const i = Number(k) - 1; if (legalMoves(tokens, ME, dice).includes(i)) move(i); }
    },
    point(x, y, type) {
      if (type !== 'up') return;
      for (const b of btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.go(); return; }
      const i = tokenAt(x, y);
      if (i >= 0) move(i);
    },
  };
}

export const SOLO3 = [
  { key: 'pool', title: 'Pet Pool', emoji: '🎱', blurb: 'Pot all 10 balls in 12 shots. Combos score extra.', how: 'Drag back to aim and set power, let go to shoot. Keys: ← → aim, ↑ ↓ power, Space.', pts: (s) => Math.min(60, Math.floor(s / 3)), isNew: true },
  { key: 'ludo', title: 'Ludo', emoji: '🎲', blurb: 'Race your 4 tokens home against the computer.', how: 'Click the dice (or Space) to roll, then click a glowing token (or press 1–4).', pts: (s) => Math.min(60, Math.floor(s / 2)), isNew: true },
];
export const MAKERS3 = { pool, ludo };
