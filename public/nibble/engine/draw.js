// Procedural drawing of Nibble. Everything is vector/canvas so it stays crisp at any size and
// every pose is just numbers. Tweak freely – this file is the "sprite sheet".
//
// drawPet(ctx, pose, skin, u)
//   u    = unit size in px (1 unit ≈ 1px at size "Normal")
//   pose = { x, y, dir, rot, baseRot, sx, sy, walk, eyes, mouth, look:{x,y}, ears, arms,
//            laptop, glasses, headphones, typing, tailWag, bob, t, alpha,
//            lift, wand, jet, aura, emote, speed, fx }   ← costume kits live in skins.js
(function () {
  const TAU = Math.PI * 2;

  function blob(ctx, cx, cy, rx, ry) {
    // a soft bean: flatter bottom, rounder top
    const k = 0.5523;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy);
    ctx.bezierCurveTo(cx - rx, cy - ry * k * 1.05, cx - rx * k, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k * 1.05, cx + rx, cy);
    ctx.bezierCurveTo(cx + rx, cy + ry * 0.75, cx + rx * 0.62, cy + ry * 0.98, cx, cy + ry * 0.98);
    ctx.bezierCurveTo(cx - rx * 0.62, cy + ry * 0.98, cx - rx, cy + ry * 0.75, cx - rx, cy);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  }

  function ear(ctx, x, y, w, h, tilt, skin, u) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(-w * 0.28, -h * 0.9, 0, -h);
    ctx.quadraticCurveTo(w * 0.28, -h * 0.9, w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = skin.body;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -h * 0.12);
    ctx.quadraticCurveTo(-w * 0.12, -h * 0.68, 0, -h * 0.74);
    ctx.quadraticCurveTo(w * 0.12, -h * 0.68, w * 0.24, -h * 0.12);
    ctx.closePath();
    ctx.fillStyle = skin.ear;
    ctx.fill();
    ctx.restore();
  }

  function eyes(ctx, pose, skin, u) {
    const lx = (pose.look?.x || 0) * 2.4 * u;
    const ly = (pose.look?.y || 0) * 1.8 * u;
    const ex = [-6.5 * u + lx, 9.5 * u + lx];
    const ey = -23 * u + ly;
    ctx.lineCap = 'round';
    const mode = pose.eyes || 'open';
    for (let i = 0; i < 2; i++) {
      const x = ex[i];
      if (mode === 'closed') {
        ctx.beginPath();
        ctx.arc(x, ey - 0.5 * u, 3.4 * u, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = skin.eye;
        ctx.lineWidth = 2 * u;
        ctx.stroke();
      } else if (mode === 'happy') {
        ctx.beginPath();
        ctx.arc(x, ey + 1.6 * u, 3.4 * u, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.strokeStyle = skin.eye;
        ctx.lineWidth = 2.2 * u;
        ctx.stroke();
      } else if (mode === 'dizzy') {
        ctx.beginPath();
        for (let a = 0; a < TAU * 2; a += 0.3) {
          const r = (a / (TAU * 2)) * 3.8 * u;
          const px = x + Math.cos(a + pose.t * 8) * r;
          const py = ey + Math.sin(a + pose.t * 8) * r;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = skin.eye;
        ctx.lineWidth = 1.4 * u;
        ctx.stroke();
      } else if (mode === 'x') {
        ctx.beginPath();
        ctx.moveTo(x - 2.6 * u, ey - 2.6 * u); ctx.lineTo(x + 2.6 * u, ey + 2.6 * u);
        ctx.moveTo(x + 2.6 * u, ey - 2.6 * u); ctx.lineTo(x - 2.6 * u, ey + 2.6 * u);
        ctx.strokeStyle = skin.eye;
        ctx.lineWidth = 1.8 * u;
        ctx.stroke();
      } else if (mode === 'star') {
        ctx.fillStyle = skin.glow;
        ctx.shadowColor = skin.glow;
        ctx.shadowBlur = 6 * u;
        star4(ctx, x, ey, 4.6 * u * (1 + Math.sin((pose.t || 0) * 10) * 0.12));
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const style = (skin.kit && skin.kit.eyes) || 'round';
        const big = (mode === 'wide' ? 1.25 : 1) * (style === 'sparkle' ? 1.15 : 1);
        const blink = (pose.blink ?? 1) * (style === 'sleepy' && mode !== 'wide' ? 0.55 : 1);
        ellipse(ctx, x, ey, 3.5 * u * big, 4.6 * u * big * Math.max(0.08, blink));
        ctx.fillStyle = skin.eye;
        if (skin.neon) { ctx.shadowColor = skin.eye; ctx.shadowBlur = 6 * u; }
        ctx.fill();
        ctx.shadowBlur = 0;
        if (style === 'sparkle' && blink > 0.4) {
          // glossy anime iris: lighter lower half + star glint
          ctx.save();
          ellipse(ctx, x, ey, 3.5 * u * big, 4.6 * u * big * blink);
          ctx.clip();
          ellipse(ctx, x, ey + 3 * u, 3.4 * u, 2.6 * u);
          ctx.fillStyle = skin.ear;
          ctx.globalAlpha *= 0.75;
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#fff';
          star4(ctx, x + 1.3 * u, ey - 1.8 * u, 2.2 * u);
          ctx.fill();
          ellipse(ctx, x - 1.4 * u, ey + 1.6 * u, 0.7 * u, 0.7 * u);
          ctx.fill();
        } else if (blink > 0.4) {
          ellipse(ctx, x + 1.2 * u, ey - 1.6 * u, 1.3 * u, 1.5 * u * blink);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ellipse(ctx, x - 1.2 * u, ey + 1.8 * u, 0.6 * u, 0.6 * u * blink);
          ctx.fill();
        }
        if (style === 'sharp' && mode !== 'wide') {
          // determined brow-lid: cut the top of the eye at an angle toward the centre
          const inner = i === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(x - 5 * u, ey - 6.5 * u);
          ctx.lineTo(x + 5 * u, ey - 6.5 * u);
          ctx.lineTo(x + 5 * u, ey - (inner > 0 ? 1.2 : 3.6) * u);
          ctx.lineTo(x - 5 * u, ey - (inner > 0 ? 3.6 : 1.2) * u);
          ctx.closePath();
          ctx.fillStyle = skin.body;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - 4.6 * u, ey - (inner > 0 ? 3.6 : 1.2) * u);
          ctx.lineTo(x + 4.6 * u, ey - (inner > 0 ? 1.2 : 3.6) * u);
          ctx.strokeStyle = skin.eye;
          ctx.lineWidth = 1.6 * u;
          ctx.stroke();
        }
        if (style === 'sleepy' && mode !== 'wide') {
          ctx.beginPath();
          ctx.moveTo(x - 4 * u, ey - 2.4 * u);
          ctx.lineTo(x + 4 * u, ey - 2.4 * u);
          ctx.strokeStyle = skin.eye;
          ctx.lineWidth = 1.5 * u;
          ctx.stroke();
        }
      }
    }
    // cheeks
    ctx.globalAlpha *= 0.55;
    ellipse(ctx, -12 * u + lx * 0.6, -16.5 * u, 3.3 * u, 2 * u);
    ctx.fillStyle = skin.cheek;
    ctx.fill();
    ellipse(ctx, 15.5 * u + lx * 0.6, -16.5 * u, 3.3 * u, 2 * u);
    ctx.fill();
    ctx.globalAlpha /= 0.55;

    // mouth
    const mx = 1.6 * u + lx * 0.7;
    const my = -16.5 * u + ly * 0.5;
    ctx.strokeStyle = skin.eye;
    ctx.fillStyle = skin.eye;
    ctx.lineWidth = 1.5 * u;
    const m = pose.mouth || 'w';
    if (m === 'o') {
      ellipse(ctx, mx, my + 0.8 * u, 2.1 * u, 2.6 * u);
      ctx.fill();
    } else if (m === 'yawn') {
      ellipse(ctx, mx, my + 1.2 * u, 2.8 * u, 3.8 * u);
      ctx.fill();
      ellipse(ctx, mx, my + 2.6 * u, 1.6 * u, 1.3 * u);
      ctx.fillStyle = '#ff8fa3';
      ctx.fill();
    } else if (m === 'smile') {
      ctx.beginPath();
      ctx.arc(mx, my - 0.6 * u, 3.2 * u, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (m === 'open') {
      ctx.beginPath();
      ctx.moveTo(mx - 3 * u, my - 0.5 * u);
      ctx.quadraticCurveTo(mx, my + 5 * u, mx + 3 * u, my - 0.5 * u);
      ctx.closePath();
      ctx.fill();
    } else if (m === 'flat') {
      ctx.beginPath();
      ctx.moveTo(mx - 2 * u, my + 0.5 * u);
      ctx.lineTo(mx + 2 * u, my + 0.5 * u);
      ctx.stroke();
    } else {
      // cat "w"
      ctx.beginPath();
      ctx.arc(mx - 1.6 * u, my, 1.6 * u, 0.1 * Math.PI, 0.95 * Math.PI);
      ctx.moveTo(mx + 3.2 * u, my);
      ctx.arc(mx + 1.6 * u, my, 1.6 * u, 0.05 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    if (skin.kit && skin.kit.fang && (m === 'w' || m === 'smile' || m === 'open')) {
      ctx.beginPath();
      ctx.moveTo(mx + 2.4 * u, my + 0.6 * u);
      ctx.lineTo(mx + 3.4 * u, my + 3.4 * u);
      ctx.lineTo(mx + 4.3 * u, my + 0.4 * u);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 0.8 * u;
      ctx.stroke();
    }
  }

  function star4(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
  }

  // ---------- costume kit pieces (local, facing right, feet at 0,0) ----------
  function kitBack(ctx, pose, skin, kit, u) {
    const t = pose.t || 0;
    if (kit.katana) {
      ctx.save();
      ctx.translate(-6 * u, -22 * u);
      ctx.rotate(-0.85);
      ctx.beginPath();
      ctx.roundRect(-2 * u, -30 * u, 4 * u, 36 * u, 2 * u);
      ctx.fillStyle = kit.katana;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-4 * u, -31 * u, 8 * u, 2.4 * u, 1 * u);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-1.7 * u, -43 * u, 3.4 * u, 12 * u, 1.5 * u);
      ctx.fillStyle = '#1d1d1d';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 0.9 * u;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-1.7 * u, (-41 + k * 2.8) * u);
        ctx.lineTo(1.7 * u, (-39.6 + k * 2.8) * u);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (kit.thrusters) {
      for (const yy of [-27, -13]) {
        ctx.beginPath();
        ctx.roundRect(-27 * u, yy * u, 8 * u, 9 * u, 2 * u);
        ctx.fillStyle = kit.thrusters;
        ctx.fill();
        ctx.stroke();
        ellipse(ctx, -26.5 * u, (yy + 4.5) * u, 1.6 * u, 3 * u);
        ctx.fillStyle = pose.jet ? '#ffb020' : '#111';
        ctx.fill();
      }
    }
    if (kit.scarf) {
      // two trailing scarf ends, fluttering harder when moving fast
      const flap = (pose.speed ? 2.2 : 1) * Math.sin(t * (pose.speed ? 18 : 6));
      ctx.fillStyle = kit.scarf;
      for (const [dy, ph] of [[0, 0], [3.5, 1.3]]) {
        const w2 = Math.sin(t * (pose.speed ? 18 : 6) + ph) * 3 * u;
        ctx.beginPath();
        ctx.moveTo(-14 * u, (-12 + dy) * u);
        ctx.bezierCurveTo(-24 * u, (-14 + dy) * u + w2, -30 * u, (-8 + dy) * u - w2 + flap * u, -38 * u, (-10 + dy) * u + w2);
        ctx.lineTo(-37 * u, (-6 + dy) * u + w2);
        ctx.bezierCurveTo(-29 * u, (-4 + dy) * u - w2, -23 * u, (-8 + dy) * u + w2, -14 * u, (-7 + dy) * u);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function kitHead(ctx, pose, skin, kit, u) {
    const t = pose.t || 0;
    if (kit.hood) {
      ctx.beginPath();
      ctx.moveTo(-21.8 * u, -21 * u);
      ctx.bezierCurveTo(-21.8 * u, -33 * u, -11 * u, -39.3 * u, 1.5 * u, -39.3 * u);
      ctx.bezierCurveTo(14 * u, -39.3 * u, 24.8 * u, -33 * u, 24.8 * u, -21 * u);
      ctx.bezierCurveTo(18 * u, -28.5 * u, 10 * u, -29.5 * u, 1.5 * u, -29.5 * u);
      ctx.bezierCurveTo(-7 * u, -29.5 * u, -15 * u, -28.5 * u, -21.8 * u, -21 * u);
      ctx.closePath();
      ctx.fillStyle = kit.hood;
      ctx.fill();
      ctx.stroke();
      // knot tails at the back of the hood
      ctx.fillStyle = kit.hood;
      for (const a of [0, 1]) {
        const w = Math.sin(t * 7 + a) * 2 * u;
        ctx.beginPath();
        ctx.moveTo(-19 * u, -31 * u);
        ctx.quadraticCurveTo(-27 * u, (-35 + a * 4) * u + w, -31 * u, (-30 + a * 5) * u + w);
        ctx.lineTo(-28 * u, (-28 + a * 5) * u + w);
        ctx.quadraticCurveTo(-24 * u, (-30 + a * 3) * u, -19 * u, -28 * u);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (kit.horns) {
      for (const [hx, dir] of [[-3.5, -1], [7, 1]]) {
        ctx.beginPath();
        ctx.moveTo((hx - 3.4) * u, -37.6 * u);
        ctx.quadraticCurveTo((hx + dir * 0.5) * u, -49 * u, (hx + dir * 3.5) * u, -52 * u);
        ctx.quadraticCurveTo((hx + dir * 2.5) * u, -44 * u, (hx + 3.4) * u, -38.2 * u);
        ctx.closePath();
        ctx.fillStyle = kit.horns;
        ctx.fill();
        ctx.stroke();
      }
    }
    if (kit.fin) {
      ctx.beginPath();
      ctx.moveTo(-4 * u, -38.4 * u);
      ctx.quadraticCurveTo(0, -48 * u, 9 * u, -55 * u);
      ctx.quadraticCurveTo(6 * u, -46 * u, 7 * u, -38.6 * u);
      ctx.closePath();
      ctx.fillStyle = kit.fin;
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, 6.2 * u, -50 * u, 1.3 * u, 1.3 * u);
      ctx.fillStyle = kit.visor || skin.glow;
      ctx.fill();
    }
    if (kit.kasa) {
      ctx.beginPath();
      ctx.moveTo(-31 * u, -31 * u);
      ctx.quadraticCurveTo(-10 * u, -43 * u, 1.5 * u, -52 * u);
      ctx.quadraticCurveTo(13 * u, -43 * u, 34 * u, -31 * u);
      ctx.quadraticCurveTo(1.5 * u, -27 * u, -31 * u, -31 * u);
      ctx.closePath();
      ctx.fillStyle = kit.kasa;
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 0.9 * u;
      for (let k = -4; k <= 4; k++) {
        ctx.beginPath();
        ctx.moveTo(1.5 * u, -52 * u);
        ctx.lineTo((1.5 + k * 8.5) * u, -27 * u);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (kit.band) {
      // sporty sweatband with two little tie-ends flapping at the back
      ctx.fillStyle = kit.band;
      for (const a of [0, 1]) {
        const w = Math.sin(t * 6 + a * 1.4) * 1.6 * u;
        ctx.beginPath();
        ctx.moveTo(-16 * u, -31 * u);
        ctx.quadraticCurveTo(-22 * u, (-33 + a * 5) * u + w, -27 * u, (-30 + a * 6) * u + w);
        ctx.lineTo(-25 * u, (-27 + a * 6) * u + w);
        ctx.quadraticCurveTo(-20 * u, (-29 + a * 3) * u, -16 * u, -28 * u);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-17 * u, -33.5 * u);
      ctx.quadraticCurveTo(1.5 * u, -38 * u, 20 * u, -33.5 * u);
      ctx.lineTo(21.6 * u, -28.2 * u);
      ctx.quadraticCurveTo(1.5 * u, -32.6 * u, -18.6 * u, -28.2 * u);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12 * u, -32.6 * u);
      ctx.quadraticCurveTo(1.5 * u, -35.6 * u, 15 * u, -32.6 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.1 * u;
      ctx.stroke();
      ctx.strokeStyle = skin.line;
      ctx.lineWidth = 2.3 * u;
    }
    if (kit.sprout) {
      // a little leaf sprout that sways instead of an antenna
      const sw = Math.sin(t * 2.2) * 0.18;
      ctx.save();
      ctx.translate(1.5 * u, -38.8 * u);
      ctx.rotate(sw);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-1 * u, -5 * u, 0.5 * u, -9 * u);
      ctx.lineWidth = 1.8 * u;
      ctx.stroke();
      ctx.fillStyle = kit.sprout;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0.5 * u, -9 * u);
        ctx.quadraticCurveTo(s * 5 * u, -15 * u, s * 10 * u, -11 * u);
        ctx.quadraticCurveTo(s * 5 * u, -7 * u, 0.5 * u, -9 * u);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1.5 * u;
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineWidth = 2.3 * u;
    }
    if (kit.bow) {
      ctx.save();
      ctx.translate(13 * u, -37 * u);
      ctx.rotate(0.35 + Math.sin(t * 3) * 0.05);
      ctx.fillStyle = kit.bow;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(sx * 6 * u, -9 * u, sx * 14 * u, -6 * u, sx * 12 * u, 1 * u);
        ctx.bezierCurveTo(sx * 11 * u, 6 * u, sx * 5 * u, 4 * u, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx * 1 * u, 1 * u);
        ctx.quadraticCurveTo(sx * 4 * u, 7 * u, sx * 3 * u, 11 * u);
        ctx.lineTo(sx * 6 * u, 10 * u);
        ctx.quadraticCurveTo(sx * 5 * u, 6 * u, sx * 2 * u, 0.5 * u);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ellipse(ctx, 0, 0.4 * u, 2.6 * u, 2.6 * u);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function kitFace(ctx, pose, skin, kit, u) {
    if (kit.mask) {
      ctx.beginPath();
      ctx.moveTo(-20.5 * u, -19.5 * u);
      ctx.quadraticCurveTo(1.5 * u, -21.5 * u, 23.5 * u, -19.5 * u);
      ctx.bezierCurveTo(23 * u, -10 * u, 14 * u, -7 * u, 1.5 * u, -7 * u);
      ctx.bezierCurveTo(-11 * u, -7 * u, -20 * u, -10 * u, -20.5 * u, -19.5 * u);
      ctx.closePath();
      ctx.fillStyle = kit.mask;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2 * u, -18 * u);
      ctx.quadraticCurveTo(3 * u, -13 * u, 1 * u, -9 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.2 * u;
      ctx.stroke();
      ctx.strokeStyle = skin.line;
    }
    if (kit.scarf) {
      ctx.beginPath();
      ctx.moveTo(-19 * u, -12.5 * u);
      ctx.quadraticCurveTo(1.5 * u, -9 * u, 22 * u, -12.5 * u);
      ctx.lineTo(22.6 * u, -7.5 * u);
      ctx.quadraticCurveTo(1.5 * u, -3.5 * u, -19.6 * u, -7.5 * u);
      ctx.closePath();
      ctx.fillStyle = kit.scarf;
      ctx.fill();
      ctx.stroke();
    }
    if (kit.visor) {
      ctx.beginPath();
      ctx.roundRect(-13.5 * u, -28.5 * u, 30 * u, 10 * u, 4 * u);
      ctx.fillStyle = kit.visor;
      ctx.globalAlpha *= 0.38;
      ctx.shadowColor = kit.visor;
      ctx.shadowBlur = 8 * u;
      ctx.fill();
      ctx.globalAlpha /= 0.38;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10 * u, -26 * u);
      ctx.lineTo(-4 * u, -26 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.2 * u;
      ctx.stroke();
      ctx.strokeStyle = skin.line;
    }
  }

  function wisps(ctx, pose, kit, u) {
    const t = pose.t || 0;
    for (let k = 0; k < 2; k++) {
      const a = t * 1.4 + k * Math.PI;
      const x = 1.5 * u + Math.cos(a) * 37 * u;
      const y = -20 * u + Math.sin(a) * 11 * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(a) * 0.2 - Math.cos(a) * 0.35);
      ctx.scale(1.45, 1.45);
      ctx.globalAlpha *= 0.7 + Math.sin(t * 9 + k) * 0.15;
      ctx.shadowColor = kit.wisps;
      ctx.shadowBlur = 10 * u;
      ctx.beginPath();
      ctx.moveTo(0, -7 * u);
      ctx.quadraticCurveTo(4 * u, -1 * u, 3 * u, 2 * u);
      ctx.arc(0, 2 * u, 3 * u, 0, Math.PI);
      ctx.quadraticCurveTo(-4 * u, -1 * u, 0, -7 * u);
      ctx.fillStyle = kit.wisps;
      ctx.fill();
      ellipse(ctx, 0, 2.2 * u, 1.5 * u, 1.5 * u);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }

  function aura(ctx, pose, color, u) {
    const t = pose.t || 0;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * u;
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = color;
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      const fl = 1 + Math.sin(t * 22 + k * 1.7) * 0.25;
      const bx = 1.5 * u + Math.cos(a) * 25 * u, by = -20 * u + Math.sin(a) * 22 * u;
      ctx.beginPath();
      ctx.moveTo(bx - 5 * u, by + 4 * u);
      ctx.quadraticCurveTo(bx + Math.cos(a) * 6 * u, by + Math.sin(a) * 14 * fl * u - 6 * u, bx, by - 12 * fl * u);
      ctx.quadraticCurveTo(bx + 2 * u, by, bx + 5 * u, by + 4 * u);
      ctx.fill();
    }
    ctx.restore();
  }

  function emote(ctx, pose, skin, u) {
    const t = pose.t || 0;
    const e = pose.emote;
    if (e === 'sweat') {
      const y = -34 * u + ((t * 14) % 6) * u;
      ctx.beginPath();
      ctx.moveTo(25 * u, y - 5 * u);
      ctx.quadraticCurveTo(28.5 * u, y + 1 * u, 25 * u, y + 2.5 * u);
      ctx.quadraticCurveTo(21.5 * u, y + 1 * u, 25 * u, y - 5 * u);
      ctx.fillStyle = '#8fd3ff';
      ctx.fill();
      ctx.lineWidth = 1 * u;
      ctx.strokeStyle = '#2a6fa3';
      ctx.stroke();
    } else if (e === 'anger') {
      const s = 1 + Math.sin(t * 16) * 0.12;
      ctx.save();
      ctx.translate(20 * u, -36 * u);
      ctx.scale(s, s);
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 1.8 * u;
      for (const r of [0, 1, 2, 3]) {
        ctx.save();
        ctx.rotate(r * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(1.2 * u, -4.5 * u);
        ctx.quadraticCurveTo(1.2 * u, -1.2 * u, 4.5 * u, -1.2 * u);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (e === 'blush') {
      ctx.strokeStyle = skin.cheek;
      ctx.lineWidth = 1.2 * u;
      for (const cx of [-12, 15.5]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo((cx - 2.5 + k * 2) * u, -15 * u);
          ctx.lineTo((cx - 1.2 + k * 2) * u, -17.8 * u);
          ctx.stroke();
        }
      }
    }
    if (pose.speed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.4 * u;
      for (let k = 0; k < 4; k++) {
        const yy = (-34 + k * 9) * u;
        const off = ((t * 300 + k * 37) % 30) * u;
        ctx.beginPath();
        ctx.moveTo(-30 * u - off, yy);
        ctx.lineTo(-48 * u - off, yy);
        ctx.stroke();
      }
    }
  }

  // world-space effects owned by a pet (smoke puffs, slashes, sparkles, afterimages, sound-effect text)
  function drawFx(ctx, list, skin, u) {
    for (const f of list) {
      const k = Math.max(0, Math.min(1, f.t / f.max));
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (f.type === 'smoke') {
        ctx.fillStyle = f.color || 'rgba(205,210,225,0.95)';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + f.seed;
          const r = (10 + k * 26) * u;
          ellipse(ctx, f.x + Math.cos(a) * r, f.y - 20 * u + Math.sin(a) * r * 0.7, (9 - k * 4) * u, (9 - k * 4) * u);
          ctx.fill();
        }
      } else if (f.type === 'slash') {
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = f.color || '#bde0ff';
        ctx.shadowBlur = 10 * u;
        ctx.lineWidth = (5 - k * 4) * u;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 22 * u, 46 * u * (0.6 + k * 0.5), 14 * u, f.dir > 0 ? -0.35 : 0.35, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      } else if (f.type === 'ring') {
        ctx.strokeStyle = f.color || '#fff27a';
        ctx.shadowColor = f.color || '#fff27a';
        ctx.shadowBlur = 12 * u;
        ctx.lineWidth = 3 * u * (1 - k);
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 22 * u, (10 + k * 60) * u, (6 + k * 26) * u, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === 'spark') {
        ctx.fillStyle = f.color || '#fff27a';
        ctx.shadowColor = f.color || '#fff27a';
        ctx.shadowBlur = 8 * u;
        star4(ctx, f.x + f.vx * k, f.y + f.vy * k, (5 - k * 3) * u);
        ctx.fill();
      } else if (f.type === 'puff') {
        ctx.fillStyle = f.color || '#ffffff';
        ctx.globalAlpha = 0.85 * (1 - k);
        ellipse(ctx, f.x, f.y - k * 6 * u, (5 + k * 7) * u * (f.s || 1), (4 + k * 5) * u * (f.s || 1));
        ctx.fill();
      } else if (f.type === 'ghost') {
        ctx.globalAlpha = 0.35 * (1 - k);
        drawPet(ctx, { ...f.pose, fx: null, alpha: 0.35 * (1 - k) }, skin, u);
      } else if (f.type === 'rainbow') {
        const cols = ['#ff5e7e', '#ffb347', '#ffe066', '#7ee8a1', '#6ec6ff', '#b39dff'];
        ctx.globalAlpha = 0.75 * (1 - k);
        cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(f.x - 7 * u, f.y - (30 - i * 4.2) * u, 14 * u, 4.4 * u); });
      } else if (f.type === 'confetti') {
        const tt = f.t;
        ctx.translate(f.x + f.vx * tt, f.y + f.vy * tt + 160 * u * tt * tt);
        ctx.rotate(f.seed + tt * 9);
        ctx.scale(1, Math.abs(Math.cos(f.seed + tt * 7)) + 0.2);
        ctx.fillStyle = f.color || '#ffd166';
        ctx.fillRect(-2.4 * u, -1.4 * u, 4.8 * u, 2.8 * u);
      } else if (f.type === 'sfx') {
        const sc = 1 + Math.min(1, f.t / 0.12) * 0.25 - k * 0.15;
        ctx.translate(f.x, f.y - k * 12 * u);
        ctx.rotate(f.rot || -0.12);
        ctx.scale(sc, sc);
        ctx.font = `900 ${(f.size || 20) * u}px "Yu Gothic UI", "Meiryo", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5 * u;
        ctx.strokeStyle = '#1a1a1a';
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color || '#ffd23f';
        ctx.fillText(f.text, 0, 0);
      }
      ctx.restore();
    }
  }

  // the personal cloud Kumo rides on (pose.cloud = 0..1 grow-in scale)
  function cloud(ctx, pose, skin, kit, u) {
    const s = pose.cloud;
    const t = pose.t || 0;
    ctx.save();
    ctx.translate(1.5 * u, 8 * u);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(160,210,255,0.8)';
    ctx.shadowBlur = 10 * u;
    const puffs = [[-24, 3, 7.5], [-12, 0, 9], [1, -1.5, 10], [14, 0, 9], [25, 3, 7], [0, 6, 10.5]];
    ctx.beginPath();
    for (const [px, py, r] of puffs) {
      const wob = Math.sin(t * 5 + px) * 0.6 * u;
      ctx.moveTo((px + r) * u, py * u + wob);
      ctx.arc(px * u, py * u + wob, r * u, 0, Math.PI * 2);
    }
    ctx.fillStyle = kit.cloud;
    ctx.fill();
    ctx.shadowBlur = 0;
    // soft blue underside
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(150,200,255,0.35)';
    ctx.fillRect(-40 * u, 6 * u, 80 * u, 20 * u);
    ctx.restore();
    ctx.restore();
  }

  function laptop(ctx, pose, skin, u) {
    // tiny laptop seen from behind – Nibble peeks over the lid, paws tapping away
    const t = pose.t || 0;
    const cx = 4 * u, w = 27 * u, h = 17 * u, bot = -1 * u;
    ctx.save();
    // screen glow on the face
    const g = ctx.createRadialGradient(cx, -22 * u, 0, cx, -22 * u, 20 * u);
    g.addColorStop(0, 'rgba(140,210,255,0.32)');
    g.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 22 * u, -42 * u, 44 * u, 40 * u);
    // paws tapping on the keyboard (just peeking over the lid)
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 1.8 * u;
    for (const [px, ph] of [[-4 * u, 0], [11 * u, 1.7]]) {
      ellipse(ctx, cx + px, bot - h - 0.5 * u + Math.max(0, Math.sin(t * 20 + ph * 3)) * -2.2 * u, 3.4 * u, 2.6 * u);
      ctx.fillStyle = skin.body;
      ctx.fill();
      ctx.stroke();
    }
    // lid
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, bot - h, w, h, 2.6 * u);
    ctx.fillStyle = '#d9dee7';
    ctx.fill();
    ctx.strokeStyle = '#1a1d24';
    ctx.lineWidth = 1.7 * u;
    ctx.stroke();
    // lid shine
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 3 * u, bot - h + 3 * u);
    ctx.lineTo(cx - w / 2 + 8 * u, bot - h + 3 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
    // glowing logo
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 5 * u;
    ellipse(ctx, cx, bot - h / 2, 2.2 * u, 2.2 * u);
    ctx.fillStyle = skin.glow;
    ctx.fill();
    ctx.shadowBlur = 0;
    // designer stickers
    ctx.save();
    ctx.translate(cx - 8 * u, bot - 5 * u);
    ctx.rotate(-0.25);
    ctx.beginPath();
    ctx.roundRect(-2.6 * u, -1.8 * u, 5.2 * u, 3.6 * u, 1 * u);
    ctx.fillStyle = skin.ear;
    ctx.fill();
    ctx.restore();
    ellipse(ctx, cx + 8.5 * u, bot - 4.5 * u, 2 * u, 2 * u);
    ctx.fillStyle = '#7c5cff';
    ctx.fill();
    ctx.restore();
  }

  function glasses(ctx, pose, u) {
    const lx = (pose.look?.x || 0) * 2.4 * u;
    const ly = (pose.look?.y || 0) * 1.8 * u;
    ctx.save();
    ctx.strokeStyle = '#15171c';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.roundRect(-11 * u + lx, -27.5 * u + ly, 9 * u, 8.5 * u, 3 * u);
    ctx.roundRect(5 * u + lx, -27.5 * u + ly, 9 * u, 8.5 * u, 3 * u);
    ctx.moveTo(-2 * u + lx, -24 * u + ly);
    ctx.quadraticCurveTo(1.5 * u + lx, -26 * u + ly, 5 * u + lx, -24 * u + ly);
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,255,0.18)';
    ctx.fill();
    ctx.restore();
  }

  function headphones(ctx, skin, u) {
    ctx.save();
    ctx.lineWidth = 2.6 * u;
    ctx.strokeStyle = '#22252d';
    ctx.beginPath();
    ctx.arc(1.5 * u, -21 * u, 21 * u, 1.08 * Math.PI, 1.92 * Math.PI);
    ctx.stroke();
    for (const sx of [-19 * u, 22 * u]) {
      ctx.beginPath();
      ctx.roundRect(sx - 3.5 * u, -27 * u, 7 * u, 11 * u, 3 * u);
      ctx.fillStyle = '#2b2f39';
      ctx.fill();
      ctx.lineWidth = 1.4 * u;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(sx - 1.5 * u, -24.5 * u, 3 * u, 6 * u, 1.5 * u);
      ctx.fillStyle = skin.glow;
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- user customization: hats, glasses, makeup ----------
  // Drawn in the face save-block (already scaled by sx/sy, facing right). Head top ~ -40u, eye line ~ -23u.
  function sunglasses(ctx, u) {
    ctx.save();
    ctx.fillStyle = '#15171c';
    ctx.strokeStyle = '#15171c';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.roundRect(-11 * u, -27.5 * u, 9 * u, 7.5 * u, 2.5 * u);
    ctx.roundRect(5 * u, -27.5 * u, 9 * u, 7.5 * u, 2.5 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2 * u, -25 * u);
    ctx.lineTo(5 * u, -25 * u);
    ctx.stroke();
    // little shine
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.moveTo(-9 * u, -25.5 * u); ctx.lineTo(-6 * u, -25.5 * u);
    ctx.moveTo(7 * u, -25.5 * u); ctx.lineTo(10 * u, -25.5 * u);
    ctx.stroke();
    ctx.restore();
  }

  function accessory(ctx, name, skin, u, pose) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2 * u;
    const C = (c) => { ctx.fillStyle = c; };
    switch (name) {
      case 'cap': {
        C('#ff5e5e');
        ctx.beginPath(); ctx.arc(1.5 * u, -34 * u, 15 * u, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9 * u, -34 * u);
        ctx.quadraticCurveTo(27 * u, -35.5 * u, 25 * u, -30.5 * u);
        ctx.quadraticCurveTo(17 * u, -33 * u, 9 * u, -33 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ellipse(ctx, 1.5 * u, -48.5 * u, 1.8 * u, 1.8 * u); C('#ffd166'); ctx.fill(); ctx.stroke();
        break;
      }
      case 'tophat': {
        C('#20232e');
        ctx.beginPath(); ctx.ellipse(1.5 * u, -34 * u, 20 * u, 4.5 * u, 0, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-10 * u, -58 * u, 23 * u, 25 * u, 2 * u); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff5e5e';
        ctx.beginPath(); ctx.rect(-10 * u, -40 * u, 23 * u, 4 * u); ctx.fill();
        break;
      }
      case 'party': {
        ctx.beginPath();
        ctx.moveTo(1.5 * u, -56 * u); ctx.lineTo(-11 * u, -33 * u); ctx.lineTo(14 * u, -33 * u); ctx.closePath();
        C('#ff7ab8'); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 3; i++) { ellipse(ctx, (-5 + i * 6) * u, (-37 - i * 5) * u, 1.8 * u, 1.8 * u); ctx.fillStyle = i % 2 ? '#7ee8c6' : '#ffd166'; ctx.fill(); }
        ellipse(ctx, 1.5 * u, -57 * u, 2.6 * u, 2.6 * u); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.stroke();
        break;
      }
      case 'crown': {
        C('#ffd166');
        ctx.beginPath();
        ctx.moveTo(-12 * u, -34 * u);
        ctx.lineTo(-12 * u, -44 * u); ctx.lineTo(-5 * u, -39 * u); ctx.lineTo(1.5 * u, -47 * u);
        ctx.lineTo(8 * u, -39 * u); ctx.lineTo(15 * u, -44 * u); ctx.lineTo(15 * u, -34 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        for (const [gx, gy] of [[-12, -44], [1.5, -47], [15, -44]]) { ellipse(ctx, gx * u, gy * u, 1.7 * u, 1.7 * u); ctx.fillStyle = '#ff5e5e'; ctx.fill(); }
        break;
      }
      case 'bow': {
        C('#ff4fa3');
        ctx.beginPath(); ctx.moveTo(1.5 * u, -37 * u); ctx.lineTo(-11 * u, -42 * u); ctx.lineTo(-11 * u, -32 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.5 * u, -37 * u); ctx.lineTo(14 * u, -42 * u); ctx.lineTo(14 * u, -32 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ellipse(ctx, 1.5 * u, -37 * u, 3 * u, 3 * u); ctx.fill(); ctx.stroke();
        break;
      }
      case 'flower': {
        const fx = 13 * u, fy = -36 * u;
        ctx.fillStyle = '#ff8fab';
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ellipse(ctx, fx + Math.cos(a) * 4 * u, fy + Math.sin(a) * 4 * u, 2.6 * u, 2.6 * u); ctx.fill(); ctx.stroke(); }
        ellipse(ctx, fx, fy, 2.4 * u, 2.4 * u); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.stroke();
        break;
      }
      default: if (window.NibbleWardrobe) window.NibbleWardrobe.hat(ctx, name, skin, u, pose); break;
    }
    ctx.restore();
  }

  function drawMakeup(ctx, pose, skin, u) {
    ctx.save();
    const m = pose.makeup;
    if (m === 'blush' || m === 'all') {
      ctx.fillStyle = skin.cheek || '#ff8fab';
      ctx.globalAlpha = 0.75;
      ellipse(ctx, -9 * u, -20 * u, 4.5 * u, 3 * u);
      ctx.fill();
      ellipse(ctx, 12 * u, -20 * u, 4.5 * u, 3 * u);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (m === 'freckles' || m === 'all') {
      ctx.fillStyle = shade(skin.cheek || '#ff8fab', -0.25);
      for (const [dx, dy] of [[-10, -21], [-7, -22.5], [-4, -21], [9, -21], [12, -22.5], [15, -21]]) { ellipse(ctx, dx * u, dy * u, 0.9 * u, 0.9 * u); ctx.fill(); }
    }
    if (m === 'star') {
      ctx.fillStyle = '#ffd166';
      star4(ctx, -9 * u, -20 * u, 3.2 * u); ctx.fill();
    }
    ctx.restore();
  }

  function drawAcc(ctx, pose, skin, u) {
    for (const a of pose.acc) {
      if (a === 'sunglasses') sunglasses(ctx, u);
      else if (a === 'glasses') glasses(ctx, pose, u);
      else if (a === 'headphones') headphones(ctx, skin, u);
      else accessory(ctx, a, skin, u, pose);
    }
  }

  // ---------- humanoid anime chibi (Mojo) ----------
  // Same pose contract as drawPet: feet at (0,0), facing right, ~62u tall. Palette lives in skin.chibi.
  function drawChibi(ctx, pose, skin, u) {
    const c = skin.chibi;
    const ink = skin.line;
    const t = pose.t || 0;
    const sit = !!pose.sit;
    const sleeping = !!pose.sleep;
    const music = !!(pose.headphones || pose.music);
    const arms = pose.arms || 'down';
    const groove = !sit && !pose.laptop && arms === 'down' && !pose.stride && !pose.air && (pose.eyes || 'open') === 'open';
    const nod = groove ? Math.sin(t * 5.5) : 0;
    const walk = pose.walk || 0;
    const stride = pose.stride ?? 1;
    const L = (w) => { ctx.lineWidth = w * u; };
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x * u, y * u, w * u, h * u, r * u); };
    const fill = (col) => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
      ctx.closePath();
    };
    const line = (x1, y1, x2, y2, col, w) => {
      ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.lineTo(x2 * u, y2 * u);
      ctx.strokeStyle = col; L(w); ctx.stroke(); ctx.strokeStyle = ink; L(2);
    };

    ctx.save();
    ctx.globalAlpha = pose.alpha ?? 1;
    ctx.translate(pose.x, pose.y - (pose.lift || 0) * u);
    if (pose.baseRot) ctx.rotate(pose.baseRot);
    if (pose.rot) { ctx.translate(0, -28 * u); ctx.rotate(pose.rot); ctx.translate(0, 28 * u); }
    ctx.scale(pose.dir < 0 ? -1 : 1, 1);
    ctx.translate(0, -(pose.bob || 0) * u);
    ctx.scale(pose.sx ?? 1, pose.sy ?? 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    L(2);
    if (pose.aura) { ctx.save(); ctx.translate(0, -12 * u); aura(ctx, pose, pose.aura, u); ctx.restore(); }

    // ---- legs: striped socks + chunky platform sneakers
    const shoe = (x, y) => {
      rr(x - 5.2, y - 3, 12.6, 3, 1.4); fill(c.creamDark);
      rr(x - 4.6, y - 7.4, 11.4, 5, 2.6); fill(c.cream);
      line(x + 0.6, y - 6.4, x + 2.2, y - 5.2, c.coral, 1.1);
      line(x + 2.4, y - 6.6, x + 4, y - 5.4, c.coral, 1.1);
    };
    const sock = (x, y) => {
      rr(x - 2.6, y - 12.5, 5.2, 6.5, 1.5); fill(c.cream);
      line(x - 1.9, y - 10.6, x + 1.9, y - 10.6, c.coral, 1.1);
      line(x - 1.9, y - 8.8, x + 1.9, y - 8.8, c.coral, 1.1);
    };
    if (sit) {
      // cross-legged: shorts first, sneakers crossed in front
      rr(-12, -10.5, 27, 8.5, 4); fill(c.shorts);
      line(1.5, -10, 1.5, -3.5, c.shortsDark, 1);
      shoe(-6.5, 0.6);
      shoe(5.5, 0);
    } else {
      const fA = Math.sin(walk) * 3.6 * stride, fB = Math.sin(walk + Math.PI) * 3.6 * stride;
      const lA = Math.max(0, Math.cos(walk)) * 2.2 * stride, lB = Math.max(0, Math.cos(walk + Math.PI)) * 2.2 * stride;
      sock(-3.5 + fB, -lB); shoe(-3.5 + fB, -lB);
      sock(5 + fA, -lA); shoe(5 + fA, -lA);
      rr(-9.5, -18.5, 21, 9, 3); fill(c.shorts);
      line(1, -13.5, 1, -9.8, c.shortsDark, 1);
      rr(7.8, -16, 3.2, 3.8, 0.8); ctx.strokeStyle = c.shortsDark; L(0.9); ctx.stroke(); ctx.strokeStyle = ink; L(2);
    }

    // ---- upper body (drops when sitting)
    ctx.save();
    if (sit) ctx.translate(0, 7 * u);

    const arm = (x, y, rot, len = 10) => {
      ctx.save();
      ctx.translate(x * u, y * u);
      ctx.rotate(rot);
      rr(-3.2, -1, 6.4, len, 3.2); fill(c.sleeve);
      rr(-3.5, len - 3.4, 7, 2.8, 1.2); fill(c.cream);
      ctx.beginPath(); ctx.ellipse(0, (len + 1.3) * u, 2.8 * u, 2.6 * u, 0, 0, TAU); fill(c.skin);
      ctx.restore();
    };
    let back = 0.28, front = -0.28, backLen = 10, frontLen = 10;
    const sw = Math.sin(walk) * 0.45 * stride;
    if (arms === 'wave') { back = 0.3; front = -2.7 + Math.sin(t * 12) * 0.4; frontLen = 11; }
    else if (arms === 'up') { back = 2.6 + Math.sin(t * 9) * 0.3; front = -2.6 - Math.sin(t * 9) * 0.3; }
    else if (arms === 'dance') { const d = Math.sin(t * 8); back = 1.2 + d * 0.9; front = -1.2 + d * 0.9; }
    else if (arms === 'climb') { const cl = Math.sin(walk) * 0.5; back = -2.0 + cl; front = -1.2 - cl; }
    else if (arms === 'vinyl') { back = 2.62; backLen = 13; front = -1.9; }
    else if (groove) { back = 0.25; front = -2.55; frontLen = 13; }
    else { back = 0.25 - sw; front = -0.25 - sw; }
    if (!pose.laptop) arm(-8.5, -29, back, backLen);

    // varsity jacket
    ctx.beginPath();
    ctx.moveTo(-9 * u, -31 * u);
    ctx.quadraticCurveTo(1.5 * u, -33 * u, 12 * u, -31 * u);
    ctx.lineTo(14 * u, -15 * u);
    ctx.quadraticCurveTo(1.5 * u, -13 * u, -11 * u, -15 * u);
    ctx.closePath();
    fill(c.jacket);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c.jacketDark;
    ctx.fillRect(-12 * u, -33 * u, 6 * u, 20 * u);
    ctx.restore();
    poly([[-0.5, -31], [5, -31], [5.6, -15.6], [-1.2, -15.6]]); fill(c.cream);
    ctx.beginPath(); ctx.arc(2.4 * u, -22.5 * u, 1.7 * u, 0, TAU); ctx.fillStyle = c.coral; ctx.fill();
    ctx.beginPath(); ctx.arc(2.4 * u, -22.5 * u, 0.5 * u, 0, TAU); ctx.fillStyle = c.cream; ctx.fill();
    rr(-11.3, -17.4, 25.6, 3.8, 1.6); fill(c.cream);
    line(-10.6, -15.5, 13.6, -15.5, c.sleeve, 1.1);
    rr(-3.4, -33.6, 11, 3.2, 1.6); fill(c.cream);
    line(-2.8, -32, 7, -32, c.sleeve, 0.9);
    // cat-paw patch
    ctx.beginPath(); ctx.ellipse(9.4 * u, -23.2 * u, 1.7 * u, 1.4 * u, 0, 0, TAU); ctx.fillStyle = c.coral; ctx.fill();
    for (const [px, py] of [[7.6, -25.4], [9.4, -26.1], [11.2, -25.4]]) { ctx.beginPath(); ctx.arc(px * u, py * u, 0.7 * u, 0, TAU); ctx.fill(); }

    // ---- head (nods to the beat, tilts when asleep)
    ctx.save();
    ctx.translate(1.5 * u, -31 * u);
    ctx.rotate((sleeping ? 0.32 : 0) + nod * 0.05);
    ctx.translate(-1.5 * u, (31 + 1.2 + (groove ? Math.max(0, nod) * 0.8 : 0)) * u);

    // teal underlayer: peeks out at the nape, flashes bright mid-air
    ctx.save();
    if (pose.air) { ctx.shadowColor = c.under; ctx.shadowBlur = 12 * u; }
    for (const s of [-1, 1]) {
      const m = (x) => (s < 0 ? x : 3 - x);
      poly([[m(-16.5), -46], [m(-19.8), -31.2], [m(-16), -36], [m(-15.4), -30], [m(-12), -36], [m(-11), -44]]);
      fill(pose.air ? c.underHi : c.under);
    }
    ctx.restore();
    // copper back mass + wolf-cut layers
    ctx.beginPath(); ctx.ellipse(1.5 * u, -47 * u, 20 * u, 16.5 * u, 0, 0, TAU); fill(c.hair);
    for (const s of [-1, 1]) {
      const m = (x) => (s < 0 ? x : 3 - x);
      poly([[m(-19.6), -50], [m(-21.6), -37.5], [m(-18), -40.6], [m(-18.4), -33], [m(-14.2), -39.5], [m(-13), -48]]);
      fill(c.hair);
    }

    // face
    ctx.beginPath(); ctx.ellipse(1.5 * u, -42 * u, 15 * u, 13.6 * u, 0, 0, TAU); fill(c.skin);
    const lx = (pose.look?.x || 0) * 1.6;
    const ly = (pose.look?.y || 0) * 1.2;
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = c.coral;
    for (const bx of [-8.6, 12.4]) { ctx.beginPath(); ctx.ellipse((bx + lx * 0.5) * u, -36.8 * u, 2.9 * u, 1.6 * u, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha /= 0.45;

    // eyes: amber vinyl-record irises
    const mode = pose.eyes || 'open';
    const blink = pose.blink ?? 1;
    const excited = !!(pose.excited || music);
    for (const [i, ex] of [[0, -4.3], [1, 7.8]]) {
      const x = ex + lx, y = -41.5 + ly;
      const outer = i === 0 ? -1 : 1;
      if (mode === 'happy') {
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.ellipse((x - 1.2) * u, (y + 2) * u, 2 * u, 1.45 * u, -0.45, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo((x + 0.6) * u, (y + 1.6) * u); ctx.lineTo((x + 0.6) * u, (y - 3.8) * u);
        ctx.quadraticCurveTo((x + 3.6) * u, (y - 2.8) * u, (x + 3) * u, (y - 0.4) * u);
        ctx.strokeStyle = ink; L(1.4); ctx.stroke(); L(2);
      } else if (mode === 'closed' || blink < 0.25) {
        ctx.beginPath(); ctx.arc(x * u, (y - 0.6) * u, 3.4 * u, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = ink; L(1.8); ctx.stroke(); L(2);
      } else if (mode === 'dizzy' || mode === 'x') {
        ctx.beginPath();
        if (mode === 'x') {
          ctx.moveTo((x - 2.6) * u, (y - 2.6) * u); ctx.lineTo((x + 2.6) * u, (y + 2.6) * u);
          ctx.moveTo((x + 2.6) * u, (y - 2.6) * u); ctx.lineTo((x - 2.6) * u, (y + 2.6) * u);
        } else {
          for (let a = 0; a < TAU * 2; a += 0.3) {
            const r = (a / (TAU * 2)) * 3.8 * u;
            const px = x * u + Math.cos(a + t * 8) * r, py = y * u + Math.sin(a + t * 8) * r;
            a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
        }
        ctx.strokeStyle = ink; L(1.5); ctx.stroke(); L(2);
      } else if (mode === 'star') {
        ctx.fillStyle = c.irisHi; ctx.shadowColor = c.irisHi; ctx.shadowBlur = 6 * u;
        star4(ctx, x * u, y * u, 4.4 * u); ctx.fill(); ctx.shadowBlur = 0;
      } else {
        const wide = mode === 'wide';
        const sy2 = Math.max(0.1, blink);
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x * u, y * u, 3.9 * u * (wide ? 1.12 : 1), 4.9 * u * (wide ? 1.12 : 1) * sy2, 0, 0, TAU);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.clip();
        const ir = wide ? 0.62 : 1;
        const g = ctx.createRadialGradient(x * u, (y + 1) * u, 0.4 * u, x * u, y * u, 4.4 * u * ir);
        g.addColorStop(0, c.irisHi); g.addColorStop(1, c.iris);
        ctx.beginPath(); ctx.ellipse(x * u, (y + 0.3) * u, 3.3 * u * ir, 4.3 * u * ir, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
        // vinyl grooves (spin when the music's on)
        ctx.strokeStyle = c.irisDark; L(0.5);
        if (excited) { ctx.setLineDash([1.3 * u, 0.9 * u]); ctx.lineDashOffset = -t * 14 * u; }
        for (const k of [0.78, 0.55]) { ctx.beginPath(); ctx.ellipse(x * u, (y + 0.3) * u, 3.3 * u * ir * k, 4.3 * u * ir * k, 0, 0, TAU); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.ellipse(x * u, (y + 0.3) * u, 1.1 * u * ir, 1.5 * u * ir, 0, 0, TAU); ctx.fillStyle = ink; ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse((x + 1.3) * u, (y - 1.9) * u, 1.3 * u, 1.6 * u, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc((x - 1.3) * u, (y + 2.1) * u, 0.6 * u, 0, TAU); ctx.fill();
        ctx.restore();
        // lash line with an outer flick
        const top = y - 4.9 * (wide ? 1.12 : 1) * sy2;
        ctx.beginPath();
        ctx.moveTo((x - 4.2) * u, (y - 1.6 * sy2) * u);
        ctx.quadraticCurveTo(x * u, (top - 1.6) * u, (x + 4.2) * u, (y - 1.6 * sy2) * u);
        ctx.lineTo((x + outer * 5.6) * u, (y - 3 * sy2) * u);
        ctx.strokeStyle = ink; L(1.9); ctx.stroke(); L(2);
        line(x - 1.4, y + 4.9 * sy2, x + 1.4, y + 4.9 * sy2, c.skinShade, 0.9);
      }
    }
    // star-shaped beauty mark
    ctx.fillStyle = ink;
    star4(ctx, (11.6 + lx) * u, -36.2 * u, 1.15 * u); ctx.fill();

    // mouth: cheeky grin + one snaggletooth
    const mx = 2.2 + lx * 0.6, my = -35 + ly * 0.4;
    const m = pose.mouth || 'w';
    ctx.strokeStyle = ink;
    const tooth = (ox, oy) => {
      ctx.beginPath(); ctx.moveTo((mx + ox) * u, (my + oy) * u); ctx.lineTo((mx + ox + 0.7) * u, (my + oy + 1.6) * u); ctx.lineTo((mx + ox + 1.4) * u, (my + oy - 0.2) * u);
      ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); L(0.7); ctx.stroke(); L(2);
    };
    if (m === 'open' || m === 'yawn') {
      const h = m === 'yawn' ? 4.4 : 3.2;
      ctx.beginPath(); ctx.moveTo((mx - 2.8) * u, (my - 0.4) * u); ctx.quadraticCurveTo(mx * u, (my + h * 1.6) * u, (mx + 2.8) * u, (my - 0.4) * u); ctx.closePath();
      ctx.fillStyle = c.mouth; L(1.3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(mx * u, (my + h * 0.75) * u, 1.6 * u, 0.9 * u, 0, 0, TAU); ctx.fillStyle = c.coral; ctx.fill();
      if (m === 'open') tooth(0.4, -0.3);
      L(2);
    } else if (m === 'o') {
      ctx.beginPath(); ctx.ellipse(mx * u, (my + 0.8) * u, 1.6 * u, 2 * u, 0, 0, TAU); ctx.fillStyle = c.mouth; L(1.2); ctx.fill(); ctx.stroke(); L(2);
    } else if (m === 'flat') {
      line(mx - 1.8, my + 0.6, mx + 1.8, my + 0.4, ink, 1.3);
    } else {
      const w2 = m === 'smile' ? 3.4 : 2.7;
      ctx.beginPath(); ctx.moveTo((mx - w2) * u, (my - 0.3) * u); ctx.quadraticCurveTo((mx - 0.2) * u, (my + 2.2) * u, (mx + w2) * u, (my - 1) * u);
      L(1.4); ctx.stroke(); L(2);
      tooth(0.9, 0.5);
    }

    // front hair: layered wolf-cut fringe + face-framing locks
    ctx.beginPath();
    [[-17.5, -50], [-16.5, -36.5], [-13, -45], [-10, -47.8], [-7.5, -50.5], [-4, -47.6], [-1.5, -50.5], [1.5, -43.5], [3.5, -50], [6.5, -47.6], [9.5, -50.5], [12.5, -47.8], [15.5, -45], [19.5, -36.5], [20.5, -50]]
      .forEach(([x, y], i) => (i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
    ctx.bezierCurveTo(22 * u, -64 * u, -19 * u, -64 * u, -17.5 * u, -50 * u);
    ctx.closePath();
    L(1.6);
    fill(c.hair);
    L(2);
    ctx.strokeStyle = c.hairDark; L(0.9);
    for (const [x1, y1, x2, y2] of [[-12, -55, -14.5, -41], [-6, -57, -9.5, -48.5], [1.5, -58, 1.5, -46], [8.5, -57, 11.5, -48.5], [14.5, -55, 17.5, -41]]) {
      ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.quadraticCurveTo(((x1 + x2) / 2) * u, ((y1 + y2) / 2 - 1) * u, x2 * u, y2 * u); ctx.stroke();
    }
    // glossy anime highlight band
    ctx.strokeStyle = c.hairHi; L(1.7);
    for (const [a, b2] of [[-10, -3.5], [5.5, 12]]) {
      ctx.beginPath(); ctx.moveTo(a * u, -54.5 * u); ctx.quadraticCurveTo(((a + b2) / 2) * u, -57 * u, b2 * u, -55.2 * u); ctx.stroke();
    }
    ctx.strokeStyle = ink; L(2);

    // brows over the fringe for big expressions
    const angry = pose.emote === 'anger';
    if (angry || mode === 'wide') {
      for (const [ex, s] of [[-4.3, -1], [7.8, 1]]) {
        const bx = ex + lx;
        if (angry) line(bx - 2.6 * s, -49.6, bx + 2.4 * s, -48, ink, 1.5);
        else line(bx - 2.4, -50.6, bx + 2.4, -51, ink, 1.4);
      }
    }

    // headphones (slide down round the neck while he naps)
    if (!sleeping) {
      ctx.beginPath(); ctx.ellipse(1.5 * u, -42 * u, 20.6 * u, 17.6 * u, 0, Math.PI * 1.06, Math.PI * 1.94);
      L(4.6); ctx.stroke(); ctx.strokeStyle = c.coral; L(2.6); ctx.stroke(); ctx.strokeStyle = ink; L(2);
    } else {
      ctx.beginPath(); ctx.arc(1.5 * u, -36 * u, 15 * u, 0.12 * Math.PI, 0.88 * Math.PI);
      L(4.6); ctx.stroke(); ctx.strokeStyle = c.coral; L(2.6); ctx.stroke(); ctx.strokeStyle = ink; L(2);
    }
    // the eighth-note cowlick (perky when happy, flops over when sleepy)
    const droop = sleeping || mode === 'closed';
    ctx.save();
    ctx.translate(2.6 * u, -59 * u);
    ctx.rotate(droop ? 1.15 : Math.sin(t * 4) * 0.12 - (mode === 'happy' ? 0.15 : 0) + nod * 0.1);
    ctx.beginPath(); ctx.moveTo(0, 0.6 * u); ctx.quadraticCurveTo(-0.6 * u, -2.6 * u, 0.4 * u, -5.4 * u);
    L(3.8); ctx.stroke(); ctx.strokeStyle = c.hair; L(1.9); ctx.stroke(); ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(0.4 * u, -5.4 * u); ctx.quadraticCurveTo(4.2 * u, -4.6 * u, 4.4 * u, -1.2 * u); ctx.quadraticCurveTo(3 * u, -3 * u, 0.6 * u, -3.4 * u); ctx.closePath();
    L(1.2); fill(c.hair);
    ctx.beginPath(); ctx.ellipse(-1.5 * u, 0.4 * u, 2 * u, 1.45 * u, -0.45, 0, TAU); fill(c.hair);
    ctx.restore();
    L(2);
    const cupY = sleeping ? -33 : -42;
    for (const cx of [-18.6, 21.6]) {
      rr(cx - 3.7, cupY - 6, 7.4, 12, 3.3); fill(c.coral);
      ctx.save();
      if (music) { ctx.shadowColor = c.under; ctx.shadowBlur = (8 + Math.sin(t * 12) * 3) * u; }
      rr(cx - 1.9, cupY - 4, 3.8, 8, 1.9); ctx.fillStyle = music ? c.underHi : c.cream; ctx.fill();
      ctx.restore();
    }
    if (pose.glasses) { ctx.save(); ctx.translate(0, -18.5 * u); glasses(ctx, pose, u); ctx.restore(); }
    ctx.save(); ctx.translate(0, -19 * u); emote(ctx, pose, skin, u); ctx.restore();
    ctx.restore(); // head

    if (!pose.laptop) arm(11, -29, front, frontLen);

    // Drop the Beat: a glowing vinyl spinning above his palm
    if (pose.vinyl) {
      ctx.save();
      ctx.translate(23 * u, -40 * u);
      ctx.shadowColor = c.under; ctx.shadowBlur = 12 * u;
      ctx.beginPath(); ctx.arc(0, 0, 7.2 * u, 0, TAU); ctx.fillStyle = '#16161c'; ctx.fill(); L(1.3); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#3a3a46'; L(0.6);
      for (const r of [5.8, 4.6]) { ctx.beginPath(); ctx.arc(0, 0, r * u, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; L(1.6);
      ctx.beginPath(); ctx.arc(0, 0, 5.2 * u, t * 9, t * 9 + 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.4 * u, 0, TAU); ctx.fillStyle = c.coral; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 0.6 * u, 0, TAU); ctx.fillStyle = c.cream; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ink; L(2);
    }
    if (pose.laptop) { ctx.save(); ctx.translate(0, -6 * u); laptop(ctx, pose, skin, u); ctx.restore(); }

    ctx.restore(); // upper body
    ctx.restore();
    if (pose.fx && pose.fx.length) drawFx(ctx, pose.fx, skin, u);
  }

  function drawPet(ctx, pose, skin, u) {
    // the hand-drawn chibi (Mojo) keeps his own outfit — unless you pick an animal or an outfit for him
    if (skin.chibi && !(pose.style && (pose.style.sp || pose.style.of))) return drawChibi(ctx, pose, skin, u);
    const t = pose.t || 0;
    const kit = skin.kit || {};
    // user colour customization: recolour the body, keep outline/eyes for contrast
    if (pose.tint && /^#[0-9a-fA-F]{6}$/.test(pose.tint)) {
      skin = Object.assign({}, skin, { body: pose.tint, belly: shade(pose.tint, 0.55), ear: shade(pose.tint, -0.12) });
    }
    // animal species, outfits, natural colours (wardrobe.js)
    const W = window.NibbleWardrobe;
    const look = W && pose.style ? W.prep(pose, skin) : null;
    if (look) skin = look.skin;
    const sp = look ? look.sp : '';
    ctx.save();
    ctx.globalAlpha = pose.alpha ?? 1;
    ctx.translate(pose.x, pose.y - (pose.lift || 0) * u);
    if (pose.scale && pose.scale !== 1) ctx.scale(pose.scale, pose.scale);
    if (pose.baseRot) ctx.rotate(pose.baseRot);
    if (pose.rot) {
      ctx.translate(0, -20 * u);
      ctx.rotate(pose.rot);
      ctx.translate(0, 20 * u);
    }
    ctx.scale(pose.dir < 0 ? -1 : 1, 1);
    ctx.translate(0, -(pose.bob || 0) * u);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2.3 * u;
    if (skin.neon) { ctx.shadowColor = skin.line; ctx.shadowBlur = 5 * u; }

    const sx = pose.sx ?? 1;
    const sy = pose.sy ?? 1;
    const walk = pose.walk || 0;
    const stride = pose.stride ?? 1;

    if (pose.aura) aura(ctx, pose, pose.aura, u);

    // --- tail(s) (behind)
    const wag = Math.sin(t * (pose.tailWag || 3)) * 0.35;
    if (sp) { ctx.shadowBlur = 0; W.tail(ctx, pose, skin, sp, u, sx, sy); }
    else for (let k = 0; k < (kit.tails || 1); k++) {
      ctx.save();
      ctx.translate(-19 * u * sx, (-9 + k * 4) * u * sy);
      ctx.rotate(-0.4 + wag * (k ? -1 : 1) + k * 0.75);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-8 * u, -2 * u, -12 * u, -10 * u, -9 * u, -17 * u);
      ctx.lineWidth = 6.5 * u;
      ctx.strokeStyle = skin.line;
      ctx.stroke();
      ctx.lineWidth = 3.6 * u;
      ctx.strokeStyle = skin.body;
      ctx.shadowBlur = 0;
      ctx.stroke();
      if (kit.tails) {
        ellipse(ctx, -9 * u, -17 * u, 2.6 * u, 2.6 * u);
        ctx.fillStyle = kit.wisps || skin.glow;
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2.3 * u;
    if (skin.neon) { ctx.shadowColor = skin.line; ctx.shadowBlur = 5 * u; }

    ctx.lineWidth = 2.3 * u;
    kitBack(ctx, pose, skin, kit, u);
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2.3 * u;
    if (look) { W.back(ctx, pose, skin, look, u, sx, sy); ctx.strokeStyle = skin.line; ctx.lineWidth = 2.3 * u; }

    // --- back foot
    const fA = Math.sin(walk) * 4.5 * u * stride;
    const fB = Math.sin(walk + Math.PI) * 4.5 * u * stride;
    const liftA = Math.max(0, Math.cos(walk)) * 2.5 * u * stride;
    const liftB = Math.max(0, Math.cos(walk + Math.PI)) * 2.5 * u * stride;
    const sitting = pose.sit;
    ellipse(ctx, -8 * u + fB, -2.6 * u - liftB, 5 * u, 3 * u);
    ctx.fillStyle = shade(skin.feet || skin.limb || skin.body, -0.08);
    ctx.fill();
    ctx.stroke();

    // --- ears
    const earTilt = pose.ears ?? 0; // -1 droopy … 1 perky
    const earT = Math.sin(t * 1.3) * 0.04;
    if (sp) { if (!kit.kasa) W.earsBack(ctx, pose, skin, sp, u, sx, sy); ctx.lineWidth = 2.3 * u; ctx.strokeStyle = skin.line; }
    else if (!kit.kasa) {
      ear(ctx, -11 * u * sx, -33 * u * sy, 13 * u, 13 * u * (1 + earTilt * 0.12), -0.35 - earTilt * -0.1 + earT - (earTilt < 0 ? 0.5 : 0), skin, u);
      ear(ctx, 13 * u * sx, -33 * u * sy, 13 * u, 13 * u * (1 + earTilt * 0.12), 0.32 + earTilt * -0.1 - earT + (earTilt < 0 ? 0.5 : 0), skin, u);
    }

    // --- antenna
    const sway = Math.sin(t * 2.1) * 2.5 * u + (pose.antennaSway || 0) * u;
    if (kit.antenna !== false && !sp) {
    ctx.beginPath();
    ctx.moveTo(1 * u, -38 * u * sy);
    ctx.quadraticCurveTo(1 * u + sway * 0.4, -46 * u * sy, 4 * u + sway, -51 * u * sy);
    ctx.lineWidth = 1.8 * u;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = (6 + Math.sin(t * 3) * 3) * u;
    ellipse(ctx, 4 * u + sway, -52.5 * u * sy, 3.1 * u, 3.1 * u);
    ctx.fillStyle = skin.glow;
    ctx.fill();
    ctx.lineWidth = 1.5 * u;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
    }
    ctx.lineWidth = 2.3 * u;

    // --- body
    ctx.save();
    ctx.scale(sx, sy);
    blob(ctx, 1.5 * u, -19.5 * u, 23 * u, 19.5 * u);
    ctx.fillStyle = skin.body;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // belly / face patch
    blob(ctx, 3.5 * u, -12 * u, 13 * u, 9 * u);
    ctx.fillStyle = skin.belly;
    ctx.globalAlpha *= 0.85;
    ctx.fill();
    ctx.globalAlpha /= 0.85;
    // little highlight
    ellipse(ctx, -9 * u, -31 * u, 4.5 * u, 2.2 * u, -0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    if (look) {
      const bodyPath = () => blob(ctx, 1.5 * u, -19.5 * u, 23 * u, 19.5 * u);
      if (sp) { ctx.save(); bodyPath(); ctx.clip(); W.faceUnder(ctx, pose, skin, sp, u); ctx.restore(); }
      ctx.strokeStyle = skin.line;
      if (look.of) W.outfit(ctx, pose, skin, look, u, bodyPath);
      bodyPath(); ctx.strokeStyle = skin.line; ctx.lineWidth = 2.3 * u; ctx.stroke();
    }
    ctx.restore();
    if (sp) { ctx.save(); ctx.lineWidth = 2.1 * u; ctx.strokeStyle = skin.line; ctx.shadowBlur = 0; W.earsFront(ctx, pose, skin, sp, u, sx, sy); ctx.restore(); }

    // --- face
    ctx.save();
    ctx.scale(sx, sy);
    eyes(ctx, pose, skin, u);
    if (sp) W.faceOver(ctx, pose, skin, sp, u);
    ctx.lineWidth = 2.3 * u;
    ctx.strokeStyle = skin.line;
    kitFace(ctx, pose, skin, kit, u);
    if (pose.glasses && !kit.visor) glasses(ctx, pose, u);
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2.3 * u;
    kitHead(ctx, pose, skin, kit, u);
    if (kit.wisps) wisps(ctx, pose, kit, u);
    if (pose.makeup) drawMakeup(ctx, pose, skin, u);
    if (pose.acc && pose.acc.length) drawAcc(ctx, pose, skin, u);
    emote(ctx, pose, skin, u);
    ctx.restore();

    if (pose.headphones) {
      ctx.save();
      ctx.scale(sx, sy);
      headphones(ctx, skin, u);
      ctx.restore();
    }

    // --- arms (little nubs)
    ctx.strokeStyle = skin.line;
    ctx.lineWidth = 2 * u;
    if (skin.neon) { ctx.shadowColor = skin.line; ctx.shadowBlur = 5 * u; }
    const arms = pose.arms || 'down';
    const armFill = (look && look.sleeve) || skin.limb || skin.body;
    const armDraw = (x, y, rot, len = 7) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ellipse(ctx, 0, len * 0.5 * u, 3.2 * u, len * 0.62 * u);
      ctx.fillStyle = armFill;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    if (pose.laptop) { /* arms hidden behind the lid */ } else if (arms === 'wave') {
      armDraw(-17 * u * sx, -15 * u * sy, 0.25);
      armDraw(21 * u * sx, -22 * u * sy, -2.7 + Math.sin(t * 12) * 0.45, 9);
    } else if (arms === 'up') {
      armDraw(-18 * u * sx, -20 * u * sy, 2.5 + Math.sin(t * 9) * 0.3);
      armDraw(20 * u * sx, -20 * u * sy, -2.5 - Math.sin(t * 9) * 0.3);
    } else if (arms === 'type') {
      armDraw(14 * u, -9 * u + Math.sin(t * 22) * 1.2 * u, -1.2);
      armDraw(8 * u, -9 * u + Math.cos(t * 19) * 1.2 * u, -1.0);
    } else if (arms === 'climb') {
      const c = Math.sin(walk) * 0.5;
      armDraw(16 * u, -26 * u, -2.0 + c, 8);
      armDraw(16 * u, -12 * u, -1.2 - c, 8);
    } else if (arms === 'dance') {
      const d = Math.sin(t * 8);
      armDraw(-18 * u * sx, -17 * u * sy, 1.2 + d * 0.9);
      armDraw(20 * u * sx, -17 * u * sy, -1.2 + d * 0.9);
    } else {
      const s = Math.sin(walk) * 0.35 * stride;
      armDraw(-17 * u * sx, -14 * u * sy, 0.3 + s);
      armDraw(19 * u * sx, -14 * u * sy, -0.3 + s);
    }

    if (pose.wand && (kit.wand || pose.wandColor)) {
      ctx.save();
      ctx.translate(22 * u, -18 * u);
      ctx.rotate(-0.5 + Math.sin(t * 8) * 0.25);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -16 * u);
      ctx.strokeStyle = skin.line;
      ctx.lineWidth = 3.2 * u;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6 * u;
      ctx.stroke();
      ctx.translate(0, -19 * u);
      ctx.rotate(t * 2);
      ctx.shadowColor = kit.wand || pose.wandColor;
      ctx.shadowBlur = 10 * u;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const r = (k % 2 ? 2.6 : 6) * u;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = kit.wand || pose.wandColor;
      ctx.fill();
      ctx.lineWidth = 1.2 * u;
      ctx.strokeStyle = skin.line;
      ctx.stroke();
      ctx.restore();
    }
    if (pose.jet) {
      for (const fx of [-6, 9]) {
        const fl = 1 + Math.sin(t * 40 + fx) * 0.25;
        ctx.save();
        ctx.translate(fx * u, 1 * u);
        ctx.shadowColor = '#ffb020';
        ctx.shadowBlur = 12 * u;
        ctx.beginPath();
        ctx.moveTo(-4 * u, 0);
        ctx.quadraticCurveTo(0, 20 * fl * u, 4 * u, 0);
        ctx.fillStyle = '#ffb020';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2 * u, 0);
        ctx.quadraticCurveTo(0, 10 * fl * u, 2 * u, 0);
        ctx.fillStyle = '#fff6c2';
        ctx.fill();
        ctx.restore();
      }
    }

    // --- front foot
    ctx.lineWidth = 2.3 * u;
    if (sitting) {
      ellipse(ctx, 12 * u, -2.6 * u, 5.5 * u, 3 * u);
    } else {
      ellipse(ctx, 9 * u + fA, -2.6 * u - liftA, 5 * u, 3 * u);
    }
    ctx.fillStyle = skin.feet || skin.limb || skin.body;
    ctx.fill();
    ctx.stroke();

    if (pose.laptop) laptop(ctx, pose, skin, u);
    if (pose.cloud) cloud(ctx, pose, skin, kit.cloud ? kit : Object.assign({}, kit, { cloud: '#ffffff' }), u);

    ctx.restore();
    if (pose.fx && pose.fx.length) drawFx(ctx, pose.fx, skin, u);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  function drawShadow(ctx, x, y, u, k = 1) {
    ctx.save();
    ctx.globalAlpha = 0.18 * k;
    ellipse(ctx, x + 1.5 * u, y, 20 * u * (0.6 + 0.4 * k), 3.2 * u);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  window.NibbleDraw = { drawPet, drawShadow, shade, drawFx };
})();
