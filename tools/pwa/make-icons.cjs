// Draws the app (PWA) icons with the real pet engine. Needs the site running locally:
//   npx next start -p 3400   then   node tools/pwa/make-icons.cjs   (playwright-core + Chrome)
// Writes public/icons/app-{192,512}.png, app-maskable-512.png, app-180.png (iPhone home screen).
const { chromium } = require(process.env.PW || 'playwright-core');
const fs = require('fs');
const path = require('path');
const SITE = process.env.SITE || 'http://localhost:3400';
const OUT = path.join(__dirname, '../../public/icons');
const JOBS = [
  // [file, size, rounded corners?, pet scale (share of the icon's width)]
  ['app-512.png', 512, true, 0.64],
  ['app-192.png', 192, true, 0.64],
  ['app-maskable-512.png', 512, false, 0.58], // Android crops maskable icons to a circle: keep the pet in the middle
  ['app-180.png', 180, false, 0.64],          // iOS rounds the corners itself
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const p = await b.newPage();
  await p.goto(SITE + '/about', { waitUntil: 'domcontentloaded' });
  for (const f of ['skins', 'lines', 'wardrobe', 'draw']) await p.addScriptTag({ url: `${SITE}/nibble/engine/${f}.js` });
  for (const [file, size, round, scale] of JOBS) {
    const data = await p.evaluate(({ size, round, scale }) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d');
      if (round) { const r = size * 0.225; x.beginPath(); x.roundRect(0, 0, size, size, r); x.clip(); }
      // soft pastel sky: lavender → pink, with a mint glow behind the pet
      const g = x.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#c9b8ff'); g.addColorStop(1, '#ffadd6');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      const glow = x.createRadialGradient(size / 2, size * 0.58, 0, size / 2, size * 0.58, size * 0.5);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = glow; x.fillRect(0, 0, size, size);
      // little sparkles
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [sx, sy, sr] of [[0.2, 0.22, 0.018], [0.8, 0.18, 0.014], [0.84, 0.72, 0.012], [0.14, 0.7, 0.01]]) { x.beginPath(); x.arc(size * sx, size * sy, size * sr, 0, Math.PI * 2); x.fill(); }
      const sk = window.SKINS.mint;
      const u = (size * scale) / 64;
      const pose = { x: size / 2 + 4 * u, y: size / 2 + 28 * u, dir: 1, sx: 1, sy: 1, walk: 0, t: 0.4, blink: 1, look: { x: 0, y: 0.1 }, eyes: 'open', mouth: 'smile', arms: 'down', ears: 0, stride: 0, bob: 0, tailWag: 3, acc: [], tint: '', makeup: '', style: null };
      x.save(); x.globalAlpha = 0.18; x.fillStyle = '#5a3a7a'; x.beginPath(); x.ellipse(size / 2, pose.y + 1 * u, 22 * u, 4 * u, 0, 0, Math.PI * 2); x.fill(); x.restore();
      window.NibbleDraw.drawPet(x, pose, sk, u);
      return c.toDataURL('image/png');
    }, { size, round, scale });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', file);
  }
  // the small monochrome icon Android shows in the status bar: a white pet silhouette
  const badge = await p.evaluate(() => {
    const size = 96, c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const u = (size * 0.86) / 64;
    window.NibbleDraw.drawPet(x, { x: size / 2 + 4 * u, y: size / 2 + 30 * u, dir: 1, sx: 1, sy: 1, walk: 0, t: 0.4, blink: 1, look: { x: 0, y: 0 }, eyes: 'open', mouth: 'w', arms: 'down', ears: 0, stride: 0, bob: 0, tailWag: 3, acc: [], tint: '', makeup: '', style: null }, window.SKINS.mint, u);
    const img = x.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, 'badge-96.png'), Buffer.from(badge.split(',')[1], 'base64'));
  console.log('wrote badge-96.png');
  await b.close();
})();
