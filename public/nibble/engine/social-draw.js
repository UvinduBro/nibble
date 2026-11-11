// Nibble Social overlays drawn on the pet canvas: name tags, "thinking…" clouds, emote pops,
// and the hold-to-talk ring. Shared by the desktop app and the website.
(function () {
  const FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

  function headY(pet, u) {
    const sk = window.SKINS && window.SKINS[pet.skinKey];
    return pet.y - ((sk && sk.chibi) ? 64 : 56) * u;
  }

  // small pill under the pet: "@wagee"
  function nameTag(ctx, pet, u, label, color) {
    if (pet.state === 'climb' || pet.state === 'cling') return;
    const fs = 10.5 * Math.max(0.9, Math.min(1.2, u));
    ctx.save();
    ctx.font = `700 ${fs}px ${FONT}`;
    const w = ctx.measureText(label).width + 14, h = fs + 7;
    const x = pet.x - w / 2, y = pet.y + 5 * u;
    ctx.globalAlpha = (pet.alpha == null ? 1 : pet.alpha) * 0.95;
    ctx.fillStyle = 'rgba(16,19,32,0.82)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color || '#7ee8c6';
    ctx.beginPath(); ctx.arc(x + 7, y + h / 2, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#eef1fb';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 11, y + h / 2 + 0.5);
    ctx.restore();
  }

  // thought cloud with bouncing dots, used while a friend is typing
  function thought(ctx, pet, u, t) {
    const hx = pet.x + 14 * u, hy = headY(pet, u) - 8 * u;
    const w = 46 * u, h = 26 * u, x = hx - w / 2 + 10 * u, y = hy - h - 10 * u;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    // cloud = rounded rect + 3 puffs
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w * 0.32, y + 2 * u, 9 * u, 0, 7); ctx.arc(x + w * 0.64, y + 1 * u, 7 * u, 0, 7); ctx.fill();
    // trailing bubbles toward the head
    ctx.beginPath(); ctx.arc(hx - 2 * u, hy - 4 * u, 4 * u, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 7 * u, hy + 3 * u, 2.4 * u, 0, 7); ctx.fill();
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.sin(t * 6 - i * 0.8));
      ctx.fillStyle = `rgba(40,46,66,${0.45 + 0.5 * k})`;
      ctx.beginPath(); ctx.arc(x + w / 2 + (i - 1) * 10 * u, y + h / 2 + 1 * u - k * 3 * u, 2.8 * u, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // growing ring while you hold a pet (hold-to-talk feedback). k: 0..1
  function holdRing(ctx, pet, u, k) {
    const cy = pet.y - 26 * u;
    ctx.save();
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = 'rgba(126,232,198,0.25)';
    ctx.beginPath(); ctx.arc(pet.x, cy, 36 * u, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#7ee8c6';
    ctx.beginPath(); ctx.arc(pet.x, cy, 36 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // floating emoji (pokes, waves, hearts) – returns false when finished
  function pop(ctx, p, dt) {
    p.t += dt;
    if (p.t > p.max) return false;
    const k = p.t / p.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - k) * 2);
    ctx.font = `${Math.round(p.size * (0.7 + Math.min(1, p.t * 6) * 0.3))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x + Math.sin(p.t * 5) * 6, p.y - p.t * 46);
    ctx.restore();
    return true;
  }

  window.NibbleSocialDraw = { nameTag, thought, holdRing, pop, headY };
})();
