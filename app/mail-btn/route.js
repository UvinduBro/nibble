// The email button as a picture: /mail-btn?t=Try%20Nibble → a mint pill with dark text and an arrow
// (2× size for sharp phones). Mail apps never recolour images, so it looks the same in dark mode.
import { ImageResponse } from 'next/og';
import { buttonWidth } from '../../lib/emailTemplates';

export const runtime = 'edge';

// the site's bold font (Figtree 700) from Google Fonts; falls back to the built-in font if offline
let font = null;
async function bold() {
  if (font) return font;
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Figtree:wght@700&display=swap')).text();
    const url = (css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/) || [])[1];
    if (url) font = await (await fetch(url)).arrayBuffer();
  } catch {}
  return font;
}

export async function GET(req) {
  const t = (new URL(req.url).searchParams.get('t') || 'Try Nibble').replace(/\s+/g, ' ').trim().slice(0, 40);
  const w = buttonWidth(t) * 2, h = 116;
  const f = await bold();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#7ee8c6', borderRadius: 999, color: '#0d1917', fontSize: 40, fontWeight: 700, letterSpacing: -0.5, fontFamily: f ? 'Figtree' : undefined }}>
        {t} →
      </div>
    ),
    { width: w, height: h, ...(f ? { fonts: [{ name: 'Figtree', data: f, weight: 700, style: 'normal' }] } : {}), headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  );
}
