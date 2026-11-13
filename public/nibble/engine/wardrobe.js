// Nibble wardrobe: animal species, outfits (any colour) and extra hats. draw.js calls into this.
// pose.style = { sp: species, of: outfit, oc: outfit colour '#rrggbb' }   ·   pose.tint = 'nat' → natural animal colours
// Coordinates match drawPet: feet at (0,0), facing right (+x), body bean centred at (1.5,-19.5) r 23×19.5.
(function () {
  const TAU = Math.PI * 2;
  const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); };
  function shade(hex, amt) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return hex || '#888';
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const HEX = /^#[0-9a-fA-F]{6}$/;
  // clothes must stand out from the fur: a suit on a penguin or panda gets lifted to a lighter tone
  const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const [r, g, b] = rgbOf(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const mixHex = (h, to, k) => { const a = rgbOf(h), b = rgbOf(to); return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * k).toString(16).padStart(2, '0')).join(''); };
  function visibleOn(oc, body) {
    if (!HEX.test(oc || '') || !HEX.test(body || '')) return oc;
    const lb = lum(body), a = rgbOf(oc), b = rgbOf(body);
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    // light fur: the dark outline already separates the clothes. Dark fur swallows dark clothes, outline and all.
    if (dist >= 95 || lb >= 0.45) return oc;
    return mixHex(oc, '#ffffff', 0.55);
  }

  // natural colours per animal (used when the colour is set to "Natural")
  const SPECIES = {
    cat:     { label: 'Cat',      emoji: '🐱', nat: { body: '#ffb26b', belly: '#fff1e0', ear: '#ff9fb0', line: '#3a2618', eye: '#22150c', cheek: '#ff8f8f' } },
    dog:     { label: 'Puppy',    emoji: '🐶', nat: { body: '#ecc79c', belly: '#fff7ec', ear: '#a3704a', line: '#3b2818', eye: '#21150b', cheek: '#ff9b8a' } },
    bunny:   { label: 'Bunny',    emoji: '🐰', nat: { body: '#f7f3f8', belly: '#ffffff', ear: '#ffb6c8', line: '#4a3d4d', eye: '#2a2230', cheek: '#ffa3bd' } },
    fox:     { label: 'Fox',      emoji: '🦊', nat: { body: '#ff8a3d', belly: '#fff4e8', ear: '#ffe2c8', line: '#3a1c0c', eye: '#1f0f06', cheek: '#ff7b6b', tip: '#2d1b14' } },
    bear:    { label: 'Bear',     emoji: '🐻', nat: { body: '#a7744e', belly: '#ecd0ad', ear: '#ecd0ad', line: '#2e1d10', eye: '#1b1009', cheek: '#ff9d8a' } },
    panda:   { label: 'Panda',    emoji: '🐼', nat: { body: '#fbfbfb', belly: '#ffffff', ear: '#2a2a30', line: '#26262c', eye: '#1a1a1f', cheek: '#ffb0c4', limb: '#2a2a30', patch: '#2a2a30' } },
    frog:    { label: 'Frog',     emoji: '🐸', nat: { body: '#84d86f', belly: '#ecffdd', ear: '#ffa7b8', line: '#1f3b17', eye: '#13240e', cheek: '#ff9fb0' } },
    penguin: { label: 'Penguin',  emoji: '🐧', nat: { body: '#33405e', belly: '#ffffff', ear: '#ffffff', line: '#161c2b', eye: '#141a29', cheek: '#ff9fb8', feet: '#ffa630', beak: '#ffa630' } },
    mouse:   { label: 'Mouse',    emoji: '🐭', nat: { body: '#c9c4d6', belly: '#f4f1f8', ear: '#ffb6c8', line: '#3a3446', eye: '#1f1b26', cheek: '#ff9fbb' } },
    pig:     { label: 'Piglet',   emoji: '🐷', nat: { body: '#ffb7c5', belly: '#ffe3ea', ear: '#ff9fb4', line: '#5a2a36', eye: '#2c1219', cheek: '#ff7f9a', snout: '#ff8fa8' } },
    dragon:  { label: 'Dragon',   emoji: '🐲', nat: { body: '#66d18f', belly: '#fff3c4', ear: '#fff3dc', line: '#16391f', eye: '#0d2413', cheek: '#ffb36b', wing: '#3fa36a' } },
    unicorn: { label: 'Unicorn',  emoji: '🦄', nat: { body: '#ffffff', belly: '#fff4fb', ear: '#ffc6e0', line: '#5a4466', eye: '#2f2240', cheek: '#ffa8d0' } },
  };

  // outfits: default colour + whether it has long sleeves (arms get the outfit colour)
  const OUTFITS = {
    tee:      { label: 'T-shirt',   emoji: '👕', color: '#4cc9f0' },
    hoodie:   { label: 'Hoodie',    emoji: '🧥', color: '#ff7ab8', sleeve: true },
    sweater:  { label: 'Sweater',   emoji: '🧶', color: '#e2504a', sleeve: true },
    dress:    { label: 'Dress',     emoji: '👗', color: '#b9a3ff' },
    overalls: { label: 'Overalls',  emoji: '👖', color: '#4a78c2' },
    raincoat: { label: 'Raincoat',  emoji: '🌧', color: '#ffd23f', sleeve: true },
    kimono:   { label: 'Kimono',    emoji: '👘', color: '#ff6f91', sleeve: true },
    suit:     { label: 'Suit',      emoji: '🤵', color: '#2b2f3a', sleeve: true },
    jersey:   { label: 'Jersey',    emoji: '🏀', color: '#2ec4b6' },
    pajamas:  { label: 'Pajamas',   emoji: '🌙', color: '#7aa2ff', sleeve: true },
    scarf:    { label: 'Scarf',     emoji: '🧣', color: '#ff4d5e' },
    cape:     { label: 'Hero cape', emoji: '🦸', color: '#e63946' },
  };

  const HATS = {
    beanie: '🧢 Beanie', beret: '🎨 Beret', witch: '🧙 Witch hat', halo: '😇 Halo', chef: '👨‍🍳 Chef hat', grad: '🎓 Grad cap',
    santa: '🎅 Santa hat', cowboy: '🤠 Cowboy hat', flowercrown: '🌼 Flower crown', viking: '⚔️ Viking helmet', bandana: '🏴 Bandana',
    sprout: '🌱 Sprout', heartglasses: '😍 Heart glasses', eyepatch: '🏴‍☠️ Eyepatch', monocle: '🧐 Monocle',
  };

  function prep(pose, skin) {
    const st = pose.style || {};
    const sp = SPECIES[st.sp] ? st.sp : '';
    if (sp && pose.tint === 'nat') skin = Object.assign({}, skin, SPECIES[sp].nat);
    else if (sp === 'panda') skin = Object.assign({}, skin, { limb: '#2a2a30', patch: '#2a2a30', ear: '#2a2a30' });
    else if (sp === 'penguin') skin = Object.assign({}, skin, { feet: '#ffa630', beak: '#ffa630' });
    const of = OUTFITS[st.of] ? st.of : '';
    const oc = of ? visibleOn(HEX.test(st.oc || '') ? st.oc : OUTFITS[of].color, skin.body) : '';
    return { skin, sp, of, oc, sleeve: of && OUTFITS[of].sleeve ? oc : '' };
  }

  // ---------- species parts ----------
  function pointEar(ctx, x, y, w, h, tilt, fill, inner, tip) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(-w * 0.3, -h * 0.85, 0, -h);
    ctx.quadraticCurveTo(w * 0.3, -h * 0.85, w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (tip) { ctx.save(); ctx.clip(); ctx.fillStyle = tip; ctx.fillRect(-w, -h * 1.1, w * 2, h * 0.42); ctx.restore(); }
    ctx.stroke();
    if (inner) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.22, -h * 0.12);
      ctx.quadraticCurveTo(-w * 0.12, -h * 0.62, 0, -h * 0.7);
      ctx.quadraticCurveTo(w * 0.12, -h * 0.62, w * 0.22, -h * 0.12);
      ctx.closePath(); ctx.fillStyle = inner; ctx.fill();
    }
    ctx.restore();
  }
  function longEar(ctx, x, y, tilt, len, skin, u) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ellipse(ctx, 0, -len / 2, 4.6 * u, len / 2);
    ctx.fillStyle = skin.body; ctx.fill(); ctx.stroke();
    ellipse(ctx, 0, -len / 2 - 1 * u, 2.2 * u, len / 2 - 3.5 * u);
    ctx.fillStyle = skin.ear; ctx.fill();
    ctx.restore();
  }
  function roundEar(ctx, x, y, r, outer, inner, u) {
    ellipse(ctx, x, y, r, r); ctx.fillStyle = outer; ctx.fill(); ctx.stroke();
    ellipse(ctx, x, y + 0.6 * u, r * 0.55, r * 0.55); ctx.fillStyle = inner; ctx.fill();
  }

  // ears / horns behind the head
  function earsBack(ctx, pose, skin, sp, u, sx, sy) {
    const et = pose.ears ?? 0;
    const tw = Math.sin((pose.t || 0) * 1.3) * 0.04;
    const droop = et < 0 ? 0.45 : 0;
    const L = -11 * u * sx, R = 13 * u * sx, Y = -33 * u * sy;
    switch (sp) {
      case 'cat':
        pointEar(ctx, L, Y, 13 * u, 16 * u * (1 + et * 0.1), -0.32 + tw - droop, skin.body, skin.ear);
        pointEar(ctx, R, Y, 13 * u, 16 * u * (1 + et * 0.1), 0.3 - tw + droop, skin.body, skin.ear);
        break;
      case 'fox':
        pointEar(ctx, -10 * u * sx, Y, 15 * u, 19 * u, -0.3 + tw - droop, skin.body, skin.ear, skin.tip || shade(skin.body, -0.55));
        pointEar(ctx, 12 * u * sx, Y, 15 * u, 19 * u, 0.28 - tw + droop, skin.body, skin.ear, skin.tip || shade(skin.body, -0.55));
        break;
      case 'bunny': {
        const flop = et < 0 ? 0.9 : 0;
        longEar(ctx, -6 * u * sx, -35 * u * sy, -0.18 + tw - flop * 0.6, 27 * u * (1 + et * 0.06), skin, u);
        longEar(ctx, 9 * u * sx, -35 * u * sy, 0.2 - tw + flop, 26 * u * (1 + et * 0.06), skin, u);
        break;
      }
      case 'bear':
        roundEar(ctx, -13 * u * sx, -34.5 * u * sy, 6.6 * u, skin.body, skin.ear, u);
        roundEar(ctx, 16 * u * sx, -34.5 * u * sy, 6.6 * u, skin.body, skin.ear, u);
        break;
      case 'panda':
        roundEar(ctx, -13 * u * sx, -34.5 * u * sy, 6.8 * u, skin.ear, shade(skin.ear, 0.15), u);
        roundEar(ctx, 16 * u * sx, -34.5 * u * sy, 6.8 * u, skin.ear, shade(skin.ear, 0.15), u);
        break;
      case 'mouse':
        roundEar(ctx, -15 * u * sx, -33 * u * sy, 9.5 * u, skin.body, skin.ear, u);
        roundEar(ctx, 18 * u * sx, -33 * u * sy, 9.5 * u, skin.body, skin.ear, u);
        break;
      case 'dragon':
        for (const [hx, r] of [[-8, -0.35], [11, 0.35]]) {
          ctx.save(); ctx.translate(hx * u * sx, -35 * u * sy); ctx.rotate(r);
          ctx.beginPath(); ctx.moveTo(-3.4 * u, 0); ctx.quadraticCurveTo(-1 * u, -8 * u, 0.8 * u, -11 * u); ctx.quadraticCurveTo(2.4 * u, -6 * u, 3.4 * u, 0); ctx.closePath();
          ctx.fillStyle = skin.ear; ctx.fill(); ctx.stroke(); ctx.restore();
        }
        break;
      case 'unicorn':
        pointEar(ctx, -12 * u * sx, -32 * u * sy, 9 * u, 11 * u, -0.45 + tw - droop, skin.body, skin.ear);
        pointEar(ctx, 14 * u * sx, -32 * u * sy, 9 * u, 11 * u, 0.42 - tw + droop, skin.body, skin.ear);
        break;
      default: break; // frog, penguin: no ears; dog, pig: drawn in front of the head
    }
  }

  // floppy ears, frog eye bumps, unicorn horn + mane — in front of the head
  function earsFront(ctx, pose, skin, sp, u, sx, sy) {
    const et = pose.ears ?? 0;
    const t = pose.t || 0;
    if (sp === 'dog') {
      const sw = Math.sin(t * 2.2) * 0.06 + (et > 0 ? -0.18 : et < 0 ? 0.15 : 0);
      for (const [x, r] of [[-18, 0.38 - sw], [21, -0.38 + sw]]) {
        ctx.save(); ctx.translate(x * u * sx, -32 * u * sy); ctx.rotate(r);
        ctx.beginPath();
        ctx.moveTo(-4 * u, 0);
        ctx.bezierCurveTo(-7.5 * u, 6 * u, -6 * u, 15 * u, 0, 16 * u);
        ctx.bezierCurveTo(6 * u, 15 * u, 6.5 * u, 6 * u, 4 * u, 0);
        ctx.closePath();
        ctx.fillStyle = skin.ear; ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    } else if (sp === 'pig') {
      pointEar(ctx, -12 * u * sx, -34 * u * sy, 10 * u, 10 * u, -1.15 - (et < 0 ? 0.4 : 0), skin.body, skin.ear);
      pointEar(ctx, 15 * u * sx, -34 * u * sy, 10 * u, 10 * u, 1.15 + (et < 0 ? 0.4 : 0), skin.body, skin.ear);
    } else if (sp === 'frog') {
      for (const x of [-7, 10]) {
        ellipse(ctx, x * u * sx, -34.5 * u * sy, 7.4 * u, 6.6 * u);
        ctx.fillStyle = skin.body; ctx.fill();
        ctx.beginPath(); ctx.ellipse(x * u * sx, -34.5 * u * sy, 7.4 * u, 6.6 * u, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ellipse(ctx, (x - 2) * u * sx, -37 * u * sy, 2 * u, 1.2 * u, -0.4); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      }
    } else if (sp === 'unicorn') {
      const mane = ['#ff7ab8', '#ffd166', '#7ee8c6', '#7aa2ff', '#b9a3ff'];
      const pts = [[-17, -30], [-14, -35.5], [-9, -39], [-3, -41], [3, -41.5]];
      pts.forEach(([x, y], i) => { ellipse(ctx, x * u * sx, y * u * sy, 4.6 * u, 4.2 * u); ctx.fillStyle = mane[i]; ctx.fill(); ctx.stroke(); });
      ctx.save(); ctx.translate(4 * u * sx, -38 * u * sy); ctx.rotate(0.16);
      ctx.beginPath(); ctx.moveTo(-3.2 * u, 0); ctx.lineTo(0, -15 * u); ctx.lineTo(3.2 * u, 0); ctx.closePath();
      ctx.fillStyle = '#ffd86b'; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1 * u; ctx.strokeStyle = shade('#ffd86b', -0.35);
      for (const k of [3.5, 7, 10.5]) { ctx.beginPath(); ctx.moveTo(-2.4 * u + k * 0.2 * u, -k * u + 1 * u); ctx.lineTo(2.2 * u - k * 0.18 * u, -k * u - 1.4 * u); ctx.stroke(); }
      ctx.restore();
    }
  }

  function tail(ctx, pose, skin, sp, u, sx, sy) {
    const t = pose.t || 0;
    const wag = Math.sin(t * (pose.tailWag || 3)) * 0.35;
    const thick = (path, w, color) => {
      ctx.save(); path();
      ctx.lineCap = 'round';
      ctx.lineWidth = w + 2.9 * u; ctx.strokeStyle = skin.line; ctx.stroke();
      ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
    };
    ctx.save();
    ctx.translate(-19 * u * sx, -9 * u * sy);
    switch (sp) {
      case 'cat':
        ctx.rotate(-0.3 + wag);
        thick(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-12 * u, 0, -14 * u, -14 * u, -8 * u, -22 * u); ctx.quadraticCurveTo(-5 * u, -26 * u, -9 * u, -28 * u); }, 3.8 * u, skin.body);
        break;
      case 'mouse':
        ctx.rotate(-0.1 + wag * 0.6);
        thick(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-14 * u, 4 * u, -20 * u, -10 * u, -12 * u, -14 * u); ctx.quadraticCurveTo(-6 * u, -16 * u, -8 * u, -10 * u); }, 1.8 * u, skin.ear);
        break;
      case 'dog':
        ctx.rotate(-0.6 + Math.sin(t * Math.max(6, pose.tailWag || 3)) * 0.45);
        thick(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-7 * u, -4 * u, -7 * u, -13 * u); }, 4.4 * u, skin.body);
        break;
      case 'pig':
        ctx.rotate(wag * 0.5);
        thick(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3 * u, -1 * u); ctx.arc(-6 * u, -2 * u, 3 * u, 0.2, Math.PI * 1.7, true); ctx.arc(-6.5 * u, -5 * u, 1.8 * u, Math.PI * 0.6, Math.PI * 2.2); }, 1.9 * u, skin.body);
        break;
      case 'bunny':
        ellipse(ctx, -2 * u, 2 * u, 6.2 * u, 5.8 * u); ctx.fillStyle = skin.belly; ctx.fill(); ctx.stroke();
        break;
      case 'bear': case 'panda':
        ellipse(ctx, -1 * u, 1 * u, 4.6 * u, 4.2 * u); ctx.fillStyle = sp === 'panda' ? (skin.limb || skin.body) : skin.body; ctx.fill(); ctx.stroke();
        break;
      case 'penguin':
        ctx.beginPath(); ctx.moveTo(1 * u, 3 * u); ctx.lineTo(-6 * u, 8 * u); ctx.lineTo(1 * u, 8 * u); ctx.closePath();
        ctx.fillStyle = skin.body; ctx.fill(); ctx.stroke();
        break;
      case 'fox': {
        ctx.rotate(-0.55 + wag * 0.8);
        ctx.beginPath();
        ctx.moveTo(2 * u, 2 * u);
        ctx.bezierCurveTo(-8 * u, 4 * u, -18 * u, -6 * u, -14 * u, -20 * u);
        ctx.bezierCurveTo(-11 * u, -28 * u, -3 * u, -26 * u, -2 * u, -18 * u);
        ctx.bezierCurveTo(-1 * u, -10 * u, 4 * u, -6 * u, 2 * u, 2 * u);
        ctx.closePath();
        ctx.fillStyle = skin.body; ctx.fill();
        ctx.save(); ctx.clip(); ellipse(ctx, -9 * u, -24 * u, 9 * u, 6.5 * u); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
        ctx.stroke();
        break;
      }
      case 'dragon':
        ctx.rotate(0.15 + wag * 0.5);
        thick(() => { ctx.beginPath(); ctx.moveTo(4 * u, 4 * u); ctx.quadraticCurveTo(-10 * u, 8 * u, -16 * u, -2 * u); }, 6 * u, skin.body);
        ctx.save(); ctx.translate(-16 * u, -2 * u); ctx.rotate(-1.1);
        ctx.beginPath(); ctx.moveTo(0, -5 * u); ctx.lineTo(-7 * u, 0); ctx.lineTo(0, 5 * u); ctx.lineTo(-2 * u, 0); ctx.closePath();
        ctx.fillStyle = skin.wing || shade(skin.body, -0.2); ctx.fill(); ctx.stroke(); ctx.restore();
        break;
      case 'unicorn': {
        ctx.rotate(-0.35 + wag * 0.6);
        const cols = ['#ff7ab8', '#ffd166', '#7ee8c6', '#7aa2ff'];
        cols.forEach((c, i) => thick(() => { ctx.beginPath(); ctx.moveTo(0, i * 1.5 * u); ctx.bezierCurveTo(-10 * u, (i * 2 - 2) * u, -14 * u, (-12 + i * 2) * u, (-8 + i) * u, (-20 + i * 3) * u); }, 2.4 * u, c));
        break;
      }
      default: break; // frog: no tail
    }
    ctx.restore();
  }

  // dragon wings + cape: behind the body
  function back(ctx, pose, skin, look, u, sx, sy) {
    const t = pose.t || 0;
    if (look.sp === 'dragon') {
      const flap = Math.sin(t * (pose.air ? 14 : 2.4)) * (pose.air ? 0.35 : 0.08);
      ctx.save(); ctx.translate(-12 * u * sx, -26 * u * sy); ctx.rotate(-0.5 + flap);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-6 * u, -16 * u); ctx.quadraticCurveTo(-12 * u, -10 * u, -20 * u, -12 * u);
      ctx.quadraticCurveTo(-15 * u, -6 * u, -18 * u, -1 * u); ctx.quadraticCurveTo(-10 * u, -2 * u, -8 * u, 4 * u); ctx.closePath();
      ctx.fillStyle = skin.wing || shade(skin.body, -0.22); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (look.of === 'cape') {
      const sw = Math.sin(t * 3) * 1.6 * u + (pose.speed ? 6 * u : 0) + (pose.stride || 0) * 2 * u;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-6 * u * sx, -14 * u * sy);
      ctx.quadraticCurveTo(-24 * u - sw, -12 * u, -30 * u - sw, 1 * u);
      ctx.lineTo(-20 * u - sw * 0.6, -1 * u);
      ctx.lineTo(-14 * u - sw * 0.3, 2 * u);
      ctx.quadraticCurveTo(-4 * u, -4 * u, 10 * u * sx, -14 * u * sy);
      ctx.closePath();
      ctx.fillStyle = shade(look.oc, -0.18); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // marks on the face drawn before the eyes (panda patches, penguin face, bear muzzle, cat stripes)
  function faceUnder(ctx, pose, skin, sp, u) {
    if (sp === 'panda') {
      for (const [x, r] of [[-6.5, 0.45], [9.5, -0.45]]) {
        ellipse(ctx, x * u, -22.2 * u, 5.4 * u, 6.6 * u, r); ctx.fillStyle = skin.patch || '#2a2a30'; ctx.fill();
        ellipse(ctx, x * u, -23 * u, 4.3 * u, 5.3 * u); ctx.fillStyle = '#ffffff'; ctx.fill();
      }
    } else if (sp === 'penguin') {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-5 * u, -24 * u, 9 * u, 9 * u, 0, 0, TAU);
      ctx.ellipse(9 * u, -24 * u, 9 * u, 9 * u, 0, 0, TAU);
      ctx.ellipse(2 * u, -13 * u, 15 * u, 11 * u, 0, 0, TAU);
      ctx.fillStyle = skin.belly; ctx.fill();
      ctx.restore();
    } else if (sp === 'bear' || sp === 'dog') {
      ellipse(ctx, 1.8 * u, -17 * u, 6.4 * u, 4.6 * u); ctx.fillStyle = skin.belly; ctx.fill();
    } else if (sp === 'cat' || sp === 'fox') {
      ctx.strokeStyle = shade(skin.body, -0.28); ctx.lineWidth = 1.6 * u;
      for (const [x, h] of [[-2, 4], [1.8, 5], [5.6, 4]]) { ctx.beginPath(); ctx.moveTo(x * u, -38 * u); ctx.lineTo(x * u, (-38 + h) * u); ctx.stroke(); }
      ctx.strokeStyle = skin.line;
    }
  }
  // noses, snouts, whiskers, teeth, beaks — after the eyes and mouth
  function faceOver(ctx, pose, skin, sp, u) {
    const lx = (pose.look?.x || 0) * 2.4 * u * 0.7;
    const nx = 1.8 * u + lx;
    const whiskers = () => {
      ctx.save(); ctx.strokeStyle = shade(skin.line, 0.25); ctx.lineWidth = 1 * u; ctx.globalAlpha *= 0.7;
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
        const bx = s < 0 ? -12 * u : 16 * u;
        ctx.beginPath(); ctx.moveTo(bx + lx * 0.5, -18 * u + k * 1.8 * u); ctx.lineTo(bx + s * 7 * u + lx * 0.5, -18.5 * u + k * 3 * u); ctx.stroke();
      }
      ctx.restore();
    };
    ctx.save();
    ctx.lineWidth = 1.2 * u;
    switch (sp) {
      case 'cat':
        ctx.beginPath(); ctx.moveTo(nx - 1.7 * u, -20 * u); ctx.lineTo(nx + 1.7 * u, -20 * u); ctx.lineTo(nx, -18.4 * u); ctx.closePath();
        ctx.fillStyle = '#ff7f9a'; ctx.fill();
        whiskers();
        break;
      case 'mouse':
        ellipse(ctx, nx, -19.6 * u, 1.7 * u, 1.4 * u); ctx.fillStyle = '#ff7f9a'; ctx.fill();
        whiskers();
        break;
      case 'bunny':
        ctx.beginPath(); ctx.moveTo(nx - 1.5 * u, -20 * u); ctx.lineTo(nx + 1.5 * u, -20 * u); ctx.lineTo(nx, -18.6 * u); ctx.closePath();
        ctx.fillStyle = '#ff8fab'; ctx.fill();
        if (pose.mouth !== 'o' && pose.mouth !== 'yawn') {
          ctx.beginPath(); ctx.roundRect(nx - 2.2 * u, -15.6 * u, 4.4 * u, 2.6 * u, 0.6 * u); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = skin.line; ctx.lineWidth = 0.8 * u; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(nx, -15.6 * u); ctx.lineTo(nx, -13 * u); ctx.stroke();
        }
        whiskers();
        break;
      case 'dog': case 'bear': case 'fox': case 'panda':
        ellipse(ctx, nx, -19.6 * u, sp === 'dog' ? 2.6 * u : 2.1 * u, sp === 'dog' ? 1.8 * u : 1.5 * u);
        ctx.fillStyle = sp === 'panda' ? '#1a1a1f' : skin.eye; ctx.fill();
        ellipse(ctx, nx - 0.7 * u, -20.2 * u, 0.7 * u, 0.4 * u); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
        if (sp === 'dog' && (pose.mouth === 'open' || pose.mouth === 'smile') ) {
          ellipse(ctx, nx + 0.3 * u, -13.4 * u, 1.8 * u, 2.4 * u); ctx.fillStyle = '#ff7f9a'; ctx.fill();
        }
        break;
      case 'pig':
        ellipse(ctx, nx, -19.4 * u, 3.8 * u, 2.6 * u); ctx.fillStyle = skin.snout || shade(skin.body, -0.12); ctx.fill(); ctx.strokeStyle = skin.line; ctx.stroke();
        ctx.fillStyle = skin.line;
        ellipse(ctx, nx - 1.3 * u, -19.4 * u, 0.6 * u, 0.9 * u); ctx.fill();
        ellipse(ctx, nx + 1.3 * u, -19.4 * u, 0.6 * u, 0.9 * u); ctx.fill();
        break;
      case 'penguin':
        ctx.beginPath(); ctx.moveTo(nx - 2.6 * u, -19.8 * u); ctx.quadraticCurveTo(nx, -21.8 * u, nx + 2.6 * u, -19.8 * u); ctx.lineTo(nx, -17.6 * u); ctx.closePath();
        ctx.fillStyle = skin.beak || '#ffa630'; ctx.fill(); ctx.strokeStyle = skin.line; ctx.lineWidth = 0.9 * u; ctx.stroke();
        break;
      case 'dragon':
        ctx.fillStyle = skin.line;
        ellipse(ctx, nx - 1.6 * u, -19.8 * u, 0.6 * u, 0.5 * u); ctx.fill();
        ellipse(ctx, nx + 1.6 * u, -19.8 * u, 0.6 * u, 0.5 * u); ctx.fill();
        break;
      default: break;
    }
    ctx.restore();
  }

  // ---------- outfits (drawn on the body bean, under the face) ----------
  function outfit(ctx, pose, skin, look, u, bodyPath) {
    const of = look.of, c = look.oc;
    if (!of || of === 'cape') {
      if (of === 'cape') { // clasp
        ellipse(ctx, -4 * u, -12.5 * u, 2.2 * u, 2.2 * u); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.lineWidth = 1 * u; ctx.stroke();
      }
      return;
    }
    const dark = shade(c, -0.32), light = shade(c, 0.35);
    if (of === 'scarf') {
      ctx.save();
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.roundRect(-19 * u, -15 * u, 43 * u, 5.6 * u, 2.8 * u); ctx.fillStyle = c; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.fillStyle = light; for (let x = -16; x < 24; x += 7) ctx.fillRect(x * u, -15 * u, 2.4 * u, 6 * u); ctx.restore();
      const sway = Math.sin((pose.t || 0) * 3) * 1.2 * u;
      ctx.beginPath(); ctx.roundRect(-9 * u + sway, -11 * u, 5 * u, 10 * u, 1.5 * u); ctx.fillStyle = c; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = dark; ctx.lineWidth = 1 * u;
      for (const k of [0, 1.6, 3.2]) { ctx.beginPath(); ctx.moveTo(-8.4 * u + sway + k * u, -1 * u); ctx.lineTo(-8.4 * u + sway + k * u, 1 * u); ctx.stroke(); }
      ctx.restore();
      return;
    }
    const top = of === 'overalls' ? -6 : of === 'dress' ? -12 : -11.5;
    ctx.save();
    bodyPath(); ctx.clip();
    // main fill with a neckline
    ctx.beginPath();
    ctx.moveTo(-30 * u, top * u - 1 * u);
    if (of === 'overalls') ctx.lineTo(34 * u, top * u);
    else if (of === 'kimono' || of === 'suit') { ctx.lineTo(-4 * u, top * u); ctx.lineTo(1.8 * u, -4 * u); ctx.lineTo(7.5 * u, top * u); ctx.lineTo(34 * u, top * u); }
    else { ctx.lineTo(-5 * u, top * u); ctx.quadraticCurveTo(1.8 * u, (top + 4.6) * u, 8.6 * u, top * u); ctx.lineTo(34 * u, top * u - 1 * u); }
    ctx.lineTo(34 * u, 4 * u); ctx.lineTo(-30 * u, 4 * u); ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
    ctx.lineWidth = 1.4 * u; ctx.strokeStyle = dark; ctx.stroke();
    switch (of) {
      case 'tee':
        ctx.fillStyle = light;
        ctx.beginPath(); const hx = 9 * u, hy = -5.5 * u;
        ctx.moveTo(hx, hy + 2 * u); ctx.bezierCurveTo(hx - 3.4 * u, hy - 0.6 * u, hx - 1.6 * u, hy - 3.2 * u, hx, hy - 1.4 * u); ctx.bezierCurveTo(hx + 1.6 * u, hy - 3.2 * u, hx + 3.4 * u, hy - 0.6 * u, hx, hy + 2 * u); ctx.fill();
        break;
      case 'hoodie':
        ctx.beginPath(); ctx.roundRect(-5 * u, -6.5 * u, 14 * u, 6 * u, 2.4 * u); ctx.fillStyle = dark; ctx.globalAlpha *= 0.45; ctx.fill(); ctx.globalAlpha /= 0.45;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1 * u;
        for (const x of [-2, 5.6]) { ctx.beginPath(); ctx.moveTo(x * u, -9.5 * u); ctx.lineTo(x * u, -5.6 * u); ctx.stroke(); ellipse(ctx, x * u, -5.2 * u, 0.8 * u, 0.8 * u); ctx.fillStyle = '#fff'; ctx.fill(); }
        break;
      case 'sweater':
        ctx.fillStyle = light;
        for (const y of [-7.5, -3]) ctx.fillRect(-30 * u, y * u, 64 * u, 1.8 * u);
        ctx.fillStyle = dark; ctx.globalAlpha *= 0.6;
        for (let x = -18; x < 24; x += 5) { ctx.beginPath(); ctx.moveTo(x * u, -5.2 * u); ctx.lineTo((x + 1.4) * u, -4 * u); ctx.lineTo(x * u, -2.8 * u); ctx.lineTo((x - 1.4) * u, -4 * u); ctx.fill(); }
        ctx.globalAlpha /= 0.6;
        break;
      case 'dress':
        ctx.fillStyle = dark; ctx.fillRect(-30 * u, -6.6 * u, 64 * u, 2 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (const [x, y] of [[-12, -2], [-4, -1], [5, -2.5], [14, -1.5], [20, -2.8], [-17, -3]]) { ellipse(ctx, x * u, y * u, 1 * u, 1 * u); ctx.fill(); }
        break;
      case 'overalls':
        ctx.fillStyle = c; ctx.strokeStyle = dark; ctx.lineWidth = 1.2 * u;
        ctx.beginPath(); ctx.roundRect(-5 * u, -15 * u, 14 * u, 10 * u, 1.6 * u); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 2.2 * u; ctx.strokeStyle = c;
        ctx.beginPath(); ctx.moveTo(-4 * u, -14 * u); ctx.lineTo(-16 * u, -22 * u); ctx.moveTo(8 * u, -14 * u); ctx.lineTo(20 * u, -22 * u); ctx.stroke();
        ctx.fillStyle = '#ffd166';
        for (const x of [-3, 7]) { ellipse(ctx, x * u, -13.5 * u, 1.1 * u, 1.1 * u); ctx.fill(); }
        ctx.strokeStyle = dark; ctx.lineWidth = 0.9 * u; ctx.beginPath(); ctx.roundRect(-1 * u, -11.5 * u, 6 * u, 4 * u, 0.8 * u); ctx.stroke();
        break;
      case 'raincoat':
        ctx.fillStyle = dark;
        for (const y of [-8, -4.5, -1]) { ellipse(ctx, 2.6 * u, y * u, 0.9 * u, 0.9 * u); ctx.fill(); }
        ctx.fillStyle = light;
        ctx.beginPath(); ctx.moveTo(-6 * u, -11.6 * u); ctx.lineTo(1.5 * u, -9 * u); ctx.lineTo(-3 * u, -6.5 * u); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(9.6 * u, -11.6 * u); ctx.lineTo(2.2 * u, -9 * u); ctx.lineTo(6.6 * u, -6.5 * u); ctx.closePath(); ctx.fill();
        break;
      case 'kimono':
        ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = 2.2 * u;
        ctx.beginPath(); ctx.moveTo(-4 * u, -11.5 * u); ctx.lineTo(4 * u, -3.8 * u); ctx.moveTo(7.5 * u, -11.5 * u); ctx.lineTo(1.8 * u, -5.5 * u); ctx.stroke();
        ctx.fillStyle = dark; ctx.fillRect(-30 * u, -5 * u, 64 * u, 3.4 * u);
        ctx.fillStyle = '#ffd166'; ctx.fillRect(-30 * u, -3.9 * u, 64 * u, 1 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (const [x, y] of [[-13, -8], [15, -9], [19, -0.5], [-16, 0]]) { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ellipse(ctx, (x + Math.cos(a) * 1.3) * u, (y + Math.sin(a) * 1.3) * u, 0.9 * u, 0.9 * u); ctx.fill(); } }
        break;
      case 'suit':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-4 * u, -11.6 * u); ctx.lineTo(1.8 * u, -4 * u); ctx.lineTo(7.5 * u, -11.6 * u); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = light; ctx.lineWidth = 1 * u;
        ctx.beginPath(); ctx.moveTo(-4 * u, -11.6 * u); ctx.lineTo(-1 * u, -6 * u); ctx.lineTo(1.8 * u, -4 * u); ctx.moveTo(7.5 * u, -11.6 * u); ctx.lineTo(4.6 * u, -6 * u); ctx.lineTo(1.8 * u, -4 * u); ctx.stroke();
        ctx.fillStyle = '#e63946';
        ctx.beginPath(); ctx.moveTo(1.8 * u, -10.8 * u); ctx.lineTo(-1.6 * u, -12.6 * u); ctx.lineTo(-1.6 * u, -9 * u); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1.8 * u, -10.8 * u); ctx.lineTo(5.2 * u, -12.6 * u); ctx.lineTo(5.2 * u, -9 * u); ctx.closePath(); ctx.fill();
        ellipse(ctx, 1.8 * u, -10.8 * u, 1 * u, 1 * u); ctx.fill();
        break;
      case 'jersey':
        ctx.fillStyle = light; ctx.fillRect(-30 * u, -12 * u, 9 * u, 16 * u); ctx.fillRect(18 * u, -12 * u, 12 * u, 16 * u);
        ctx.font = `900 ${7.5 * u}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 1.8 * u; ctx.strokeStyle = dark; ctx.strokeText('7', 3 * u, -4.6 * u); ctx.fillStyle = '#ffffff'; ctx.fillText('7', 3 * u, -4.6 * u);
        break;
      case 'pajamas':
        ctx.fillStyle = light;
        for (const [x, y] of [[-12, -7], [-4, -2], [6, -8], [13, -3], [20, -7], [-17, -1]]) {
          ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, r = (k % 2 ? 0.8 : 1.9) * u; ctx.lineTo(x * u + Math.cos(a) * r, y * u + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 * u;
        ctx.beginPath(); ctx.moveTo(-5 * u, -11.6 * u); ctx.quadraticCurveTo(1.8 * u, -6.6 * u, 8.6 * u, -11.6 * u); ctx.stroke();
        break;
      default: break;
    }
    ctx.restore();
    // dress: a flared skirt past the body edge
    if (of === 'dress') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-20 * u, -6 * u);
      ctx.lineTo(23 * u, -6 * u);
      ctx.quadraticCurveTo(30 * u, -1 * u, 31 * u, 1.5 * u);
      for (let x = 31; x > -28; x -= 6.5) ctx.quadraticCurveTo((x - 3.2) * u, 4 * u, (x - 6.5) * u, 1.5 * u);
      ctx.quadraticCurveTo(-26 * u, -1 * u, -20 * u, -6 * u);
      ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = skin.line; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (const [x, y] of [[-15, -1], [-6, 0], [4, -2], [13, 0], [22, -1]]) { ellipse(ctx, x * u, y * u, 1.1 * u, 1.1 * u); ctx.fill(); }
      ctx.restore();
    }
  }

  // ---------- extra hats & face accessories (pose.acc) ----------
  function hat(ctx, name, skin, u, pose) {
    const C = (c) => { ctx.fillStyle = c; };
    const t = (pose && pose.t) || 0;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = skin.line; ctx.lineWidth = 2 * u;
    switch (name) {
      case 'beanie':
        C('#4cc9f0'); ctx.beginPath(); ctx.arc(1.5 * u, -32 * u, 15 * u, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#2a9fd0'); ctx.beginPath(); ctx.roundRect(-14 * u, -35 * u, 31 * u, 5 * u, 2 * u); ctx.fill(); ctx.stroke();
        C('#ffffff'); ellipse(ctx, 1.5 * u, -48 * u, 3.6 * u, 3.6 * u); ctx.fill(); ctx.stroke();
        break;
      case 'beret':
        C('#e2504a'); ellipse(ctx, 4 * u, -37 * u, 15 * u, 5.5 * u, -0.15); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4 * u, -42 * u); ctx.lineTo(5 * u, -45.5 * u); ctx.lineWidth = 2.4 * u; ctx.stroke();
        break;
      case 'witch':
        C('#3a2a5c'); ellipse(ctx, 1.5 * u, -35 * u, 21 * u, 4.5 * u); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10 * u, -36 * u); ctx.quadraticCurveTo(-2 * u, -50 * u, 6 * u, -62 * u); ctx.quadraticCurveTo(9 * u, -64 * u, 10 * u, -60 * u); ctx.quadraticCurveTo(10 * u, -48 * u, 13 * u, -36 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#b9a3ff'); ctx.fillRect(-9.5 * u, -41 * u, 22 * u, 3.2 * u);
        C('#ffd166'); ctx.beginPath(); ctx.roundRect(-0.5 * u, -41.6 * u, 4.4 * u, 4.4 * u, 0.6 * u); ctx.fill();
        break;
      case 'halo':
        ctx.save(); ctx.shadowColor = '#fff27a'; ctx.shadowBlur = 10 * u; ctx.strokeStyle = '#ffe866'; ctx.lineWidth = 3 * u;
        ellipse(ctx, 1.5 * u, -50 * u + Math.sin(t * 2) * 1.2 * u, 11 * u, 3.4 * u); ctx.stroke(); ctx.restore();
        break;
      case 'chef':
        C('#ffffff');
        ctx.beginPath(); ctx.roundRect(-9 * u, -40 * u, 21 * u, 7 * u, 1.5 * u); ctx.fill(); ctx.stroke();
        for (const [x, y, r] of [[-6, -45, 6], [1.5, -48, 7], [9, -45, 6]]) { ellipse(ctx, x * u, y * u, r * u, r * u); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.roundRect(-8 * u, -42 * u, 19 * u, 6 * u, 1 * u); ctx.fill();
        break;
      case 'grad':
        C('#20232e');
        ctx.beginPath(); ctx.roundRect(-8 * u, -40 * u, 19 * u, 6 * u, 1 * u); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.5 * u, -48 * u); ctx.lineTo(19 * u, -42 * u); ctx.lineTo(1.5 * u, -37 * u); ctx.lineTo(-16 * u, -42 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.4 * u;
        ctx.beginPath(); ctx.moveTo(1.5 * u, -42.5 * u); ctx.lineTo(14 * u, -40 * u); ctx.lineTo(14 * u, -32 * u); ctx.stroke();
        C('#ffd166'); ellipse(ctx, 14 * u, -31 * u, 1.6 * u, 2.2 * u); ctx.fill();
        break;
      case 'santa':
        C('#e63946');
        ctx.beginPath(); ctx.moveTo(-13 * u, -34 * u); ctx.quadraticCurveTo(-4 * u, -56 * u, 18 * u, -50 * u); ctx.quadraticCurveTo(14 * u, -44 * u, 16 * u, -34 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#ffffff'); ctx.beginPath(); ctx.roundRect(-15 * u, -37 * u, 33 * u, 6 * u, 3 * u); ctx.fill(); ctx.stroke();
        ellipse(ctx, 19 * u, -49 * u, 4 * u, 4 * u); ctx.fill(); ctx.stroke();
        break;
      case 'cowboy':
        C('#b07a46');
        ctx.beginPath(); ctx.moveTo(-22 * u, -38 * u); ctx.quadraticCurveTo(1.5 * u, -30 * u, 25 * u, -38 * u); ctx.quadraticCurveTo(1.5 * u, -34 * u, -22 * u, -38 * u); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10 * u, -36 * u); ctx.quadraticCurveTo(-11 * u, -52 * u, -3 * u, -50 * u); ctx.lineTo(1.5 * u, -47 * u); ctx.lineTo(6 * u, -50 * u); ctx.quadraticCurveTo(14 * u, -52 * u, 13 * u, -36 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#5a3a20'); ctx.fillRect(-10 * u, -40 * u, 23 * u, 3 * u);
        break;
      case 'flowercrown': {
        const cols = ['#ff7ab8', '#ffd166', '#ffffff', '#b9a3ff', '#ff8f6b'];
        ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.ellipse(1.5 * u, -36 * u, 17 * u, 4.5 * u, 0, Math.PI, 2 * Math.PI); ctx.stroke();
        [-14, -7, 1.5, 10, 17].forEach((x, i) => {
          const y = -36 * u - Math.sqrt(Math.max(0, 1 - ((x - 1.5) / 17) ** 2)) * 4.5 * u;
          ctx.fillStyle = cols[i];
          for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ellipse(ctx, x * u + Math.cos(a) * 2.2 * u, y + Math.sin(a) * 2.2 * u, 1.7 * u, 1.7 * u); ctx.fill(); }
          ellipse(ctx, x * u, y, 1.2 * u, 1.2 * u); ctx.fillStyle = '#ffd166'; ctx.fill();
        });
        break;
      }
      case 'viking':
        C('#9aa3b5'); ctx.beginPath(); ctx.arc(1.5 * u, -33 * u, 14 * u, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#c9a46a'); ctx.fillRect(-12.5 * u, -36 * u, 28 * u, 3.5 * u);
        C('#fff3dc');
        for (const s of [-1, 1]) { ctx.beginPath(); const bx = 1.5 * u + s * 12 * u; ctx.moveTo(bx, -40 * u); ctx.quadraticCurveTo(bx + s * 10 * u, -42 * u, bx + s * 9 * u, -54 * u); ctx.quadraticCurveTo(bx + s * 4 * u, -46 * u, bx - s * 1 * u, -44 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        break;
      case 'bandana':
        C('#e63946');
        ctx.beginPath(); ctx.arc(1.5 * u, -31 * u, 16 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(19 * u, -33 * u); ctx.lineTo(-16 * u, -33 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-15 * u, -34 * u); ctx.lineTo(-23 * u, -30 * u + Math.sin(t * 5) * 1.5 * u); ctx.lineTo(-19 * u, -36 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        C('#ffffff'); for (const [x, y] of [[-6, -40], [3, -43], [11, -40]]) { ellipse(ctx, x * u, y * u, 1 * u, 1 * u); ctx.fill(); }
        break;
      case 'sprout': {
        const sw = Math.sin(t * 2.4) * 0.12;
        ctx.save(); ctx.translate(1.5 * u, -38 * u); ctx.rotate(sw);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8 * u); ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 1.8 * u; ctx.stroke();
        ctx.strokeStyle = skin.line; ctx.lineWidth = 1.4 * u;
        ctx.fillStyle = '#7bd88f';
        ellipse(ctx, -4 * u, -9 * u, 4.4 * u, 2.4 * u, -0.5); ctx.fill(); ctx.stroke();
        ellipse(ctx, 4 * u, -10 * u, 4.4 * u, 2.4 * u, 0.5); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'heartglasses':
        ctx.lineWidth = 1.4 * u;
        for (const x of [-6.5, 9.5]) {
          const hx = x * u, hy = -24.5 * u;
          ctx.beginPath(); ctx.moveTo(hx, hy + 4 * u); ctx.bezierCurveTo(hx - 6 * u, hy - 0.5 * u, hx - 3.4 * u, hy - 5 * u, hx, hy - 2.2 * u); ctx.bezierCurveTo(hx + 3.4 * u, hy - 5 * u, hx + 6 * u, hy - 0.5 * u, hx, hy + 4 * u);
          ctx.fillStyle = 'rgba(255,60,120,0.85)'; ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(-2 * u, -25 * u); ctx.lineTo(5 * u, -25 * u); ctx.stroke();
        break;
      case 'eyepatch':
        ctx.lineWidth = 1.2 * u;
        ctx.beginPath(); ctx.moveTo(-20 * u, -30 * u); ctx.lineTo(23 * u, -19 * u); ctx.stroke();
        ellipse(ctx, 9.5 * u, -23 * u, 4.8 * u, 5.4 * u); ctx.fillStyle = '#1a1a1f'; ctx.fill(); ctx.stroke();
        break;
      case 'monocle':
        ctx.lineWidth = 1.4 * u; ctx.strokeStyle = '#c9a46a';
        ellipse(ctx, 9.5 * u, -23 * u, 5.6 * u, 5.6 * u); ctx.fillStyle = 'rgba(200,230,255,0.25)'; ctx.fill(); ctx.stroke();
        ctx.lineWidth = 0.8 * u; ctx.beginPath(); ctx.moveTo(14 * u, -20 * u); ctx.quadraticCurveTo(17 * u, -10 * u, 12 * u, -6 * u); ctx.stroke();
        break;
      default: break;
    }
    ctx.restore();
  }

  window.NibbleWardrobe = { SPECIES, OUTFITS, HATS, prep, earsBack, earsFront, tail, back, faceUnder, faceOver, outfit, hat, shade };
})();
