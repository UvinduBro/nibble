// Title + artwork for a Spotify link (Spotify's oEmbed, fetched server-side for browsers that block it).
const OK = /^https:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/[A-Za-z0-9]{10,32}$/;

export async function GET(req) {
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!OK.test(url)) return Response.json({ error: 'bad url' }, { status: 400 });
  try {
    const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url), { headers: { accept: 'application/json' } });
    if (!r.ok) return Response.json({ error: 'not found' }, { status: 404 });
    const d = await r.json();
    return Response.json({ title: String(d.title || '').slice(0, 120), thumbnail_url: String(d.thumbnail_url || '') }, { headers: { 'cache-control': 'public, max-age=86400' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502 });
  }
}
