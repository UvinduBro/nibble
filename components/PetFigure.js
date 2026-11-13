'use client';
import { useEffect, useRef, useState } from 'react';

let loading;
export function loadNibble() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.NibblePet) return Promise.resolve();
  loading ||= ['skins', 'lines', 'wardrobe', 'draw', 'pet', 'social-draw'].reduce(
    (p, f) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = `/nibble/engine/${f}.js`;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    })),
    Promise.resolve()
  );
  return loading;
}

export function useNibble() {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadNibble().then(() => setReady(true)); }, []);
  return ready;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// One shared animation clock for every PetFigure on the page (instead of a 60fps loop each):
// 30fps is plenty for these little previews, and it stops completely when the tab/Hub is hidden.
const figures = new Set();
let tickRaf = 0, lastTick = 0;
const pageHidden = () => (typeof document !== 'undefined' && document.hidden) || (typeof window !== 'undefined' && window.__nibbleHidden);
function tick(now) {
  tickRaf = 0;
  if (!figures.size || pageHidden()) return;
  if (now - lastTick >= 32) { lastTick = now; for (const f of figures) { try { f(now); } catch { /* one bad figure shouldn't stop the rest */ } } }
  tickRaf = requestAnimationFrame(tick);
}
function wake() { if (!tickRaf && figures.size && !pageHidden()) tickRaf = requestAnimationFrame(tick); }
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('nibble-visibility', wake);
}
function addFigure(f) { figures.add(f); wake(); return () => figures.delete(f); }
// shared pointer position (one listener for all figures)
let mouseX = -1e4, mouseY = -1e4;
if (typeof window !== 'undefined') window.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });
const FX = { sleep: ['z', 'Z'], dance: ['♪', '♫'], work: ['</>', '{ }', '01', '=>'], happy: ['♥'], dizzy: ['★'] };
const FX_COLOR = { sleep: '#9aa3bd', dance: '#ff6fb5', work: '#4fd1ff', happy: '#ff5d8f', dizzy: '#ffd23f' };

// A single animated Nibble in a given mood – used for the crew gallery & feature cards.
export default function PetFigure({ skin = 'mint', mood = 'idle', size = 1, w = 170, h = 150, className, onClick, title, acc, tint, makeup, look }) {
  const ref = useRef(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const ready = useNibble();

  useEffect(() => {
    if (!ready) return;
    const c = ref.current, ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    const u = 1.1 * size, floor = h - 14;
    const env = { world: { w, h, left: 0, right: w, top: 0, floor }, settings: { size, chatty: 'silent', pets: [] }, skins: window.SKINS, platforms: [], winsById: new Map(), pets: [], time: 0, emit() {}, sound() {}, onFirstLanding() {} };
    const sk = { ...(window.SKINS[skin] || window.SKINS.mint), neon: skin === 'cyber' };
    const p = new window.NibblePet({ id: 'f', name: 'N', skin, acc: acc || [], tint: tint || '', makeup: makeup || '', style: look || null }, env, 0);
    p._u = u;
    let last = performance.now(), visible = true, mouse = null, cur = null, fxT = 0, blinkT = 2, blinkA = 0;
    const fx = [];
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(c);

    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!visible) return;
      if (mouseX > -1e3) { const r = c.getBoundingClientRect(); mouse = { x: mouseX - r.left, y: mouseY - r.top }; }
      const m = moodRef.current;
      if (m !== cur) {
        cur = m;
        p.state = m; p.st = 0; p.rot = 0; p.dir = 1; p.vy = m === 'jump' ? -1 : 0;
        p.spin = m === 'thrown' ? 4 : 0;
        p.x = w / 2; p.y = ['thrown', 'fall', 'flip'].includes(m) ? floor - 22 : floor;
        fx.length = 0;
      }
      p.t += dt; p.st += dt;
      blinkT -= dt;
      if (blinkT <= 0) { blinkT = 2 + Math.random() * 3; blinkA = 0.16; }
      blinkA = Math.max(0, blinkA - dt);
      p.blink = blinkA > 0 ? Math.abs(Math.cos((blinkA / 0.16) * Math.PI)) : 1;
      if (m === 'walk') p.walk += dt * 7;
      if (m === 'run' || m === 'thrown' || m === 'fall') p.walk += dt * 14;
      if (m === 'thrown') p.rot += dt * 3;
      if (m === 'flip') { const k = (p.st % 1.8) / 1.8; p.rot = k < 0.45 ? -Math.PI * 2 * (k / 0.45) : 0; p.y = floor - Math.sin(Math.min(1, k / 0.45) * Math.PI) * 40; }
      let lx = 0, ly = 0;
      if (mouse && !['sleep', 'work'].includes(m)) {
        lx = clamp((mouse.x - p.x) / 220, -1, 1);
        ly = clamp((mouse.y - (p.y - 25 * u)) / 220, -1, 1);
      }
      if (m === 'work') { lx = 0.7; ly = 0.5; }
      p.look.x += (lx - p.look.x) * Math.min(1, dt * 8);
      p.look.y += (ly - p.look.y) * Math.min(1, dt * 8);
      const sit = ['sit', 'sleep', 'work'].includes(m);
      const br = Math.sin(p.t * (m === 'sleep' ? 1.6 : 2.6)) * (m === 'sleep' ? 0.035 : 0.018);
      p.sy = (sit ? 0.93 : 1) + br; p.sx = (sit ? 1.04 : 1) - br * 0.6;

      // tiny effects
      if (FX[m]) {
        fxT -= dt;
        if (fxT <= 0) {
          fxT = m === 'sleep' ? 1.2 : 0.7;
          const set = FX[m];
          fx.push({ x: p.x + (Math.random() - 0.3) * 30 * u, y: p.y - 50 * u, t: 0, s: set[Math.floor(Math.random() * set.length)] });
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      window.NibbleDraw.drawShadow(ctx, p.x, floor, u, p.y < floor - 5 ? 0.5 : 1);
      window.NibbleDraw.drawPet(ctx, p.pose(), sk, u);
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        f.t += dt; f.y -= 26 * dt; f.x += Math.sin(f.t * 3) * 0.3;
        if (f.t > 1.6) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, (1.6 - f.t) * 1.5);
        ctx.fillStyle = FX_COLOR[m] || '#fff';
        ctx.font = `700 ${(m === 'work' ? 10 : 13) * u}px ui-monospace, monospace`;
        ctx.fillText(f.s, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    };
    const off = addFigure(loop);
    return () => { off(); io.disconnect(); };
  }, [ready, skin, size, w, h, (acc || []).join(','), tint, makeup, look ? [look.sp, look.of, look.oc, look.sk].join('|') : '']);

  return <canvas ref={ref} className={className} style={{ width: w, height: h }} onClick={onClick} title={title} aria-label={`Nibble (${skin}) – ${mood}`} />;
}
