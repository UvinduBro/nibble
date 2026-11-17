// Generated share image (1200×630): /og?title=…&sub=…&theme=mint|pink|violet|sun
// Used by Admin → SEO → "Generate image", so every page can have a clean social card.
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const THEMES = {
  mint: ['#0b0d17', '#7ee8c6'], pink: ['#170b14', '#ff8fd0'], violet: ['#0f0b1c', '#a78bfa'], sun: ['#17120b', '#ffd166'],
};

export function GET(req) {
  const q = new URL(req.url).searchParams;
  const title = (q.get('title') || 'Nibble').slice(0, 90);
  const sub = (q.get('sub') || 'A free desktop pet for Windows and Mac').slice(0, 140);
  const [bg, accent] = THEMES[q.get('theme')] || THEMES.mint;
  const big = title.length > 40 ? 64 : 80;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: bg, padding: '64px 72px', color: '#eef2fb', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 36, fontWeight: 700, color: accent }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: accent, color: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>◕‿◕</div>
          nibble
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: big, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 34, lineHeight: 1.3, color: '#aab3cf' }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26, color: '#8b93b0' }}>
          <span>meetnibble.com</span>
          <span style={{ color: accent }}>Free · Windows · Mac</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800' } },
  );
}
