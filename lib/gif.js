// GIF search for the chats (server side, so the API key never reaches the browser).
// Provider: KLIPY (KLIPY_API_KEY) or GIPHY (GIPHY_API_KEY), whichever key is set. Tenor's API shut down
// on 30 June 2026. Messages store only { p: 'k'|'g', id, w, h }; the picture is shown through
// /api/gif/m/<p>/<id>, which redirects to the provider's file (cached by Vercel), so no media URL
// ever has to be trusted from a browser.
import { createHash } from 'node:crypto';

export const gifProvider = () => ((process.env.KLIPY_API_KEY || '').trim() ? 'k' : (process.env.GIPHY_API_KEY || '').trim() ? 'g' : '');
export const okGifId = (p, id) => (p === 'k' || p === 'g') && /^[A-Za-z0-9_-]{1,80}$/.test(String(id || ''));
const num = (v) => Math.max(1, Math.min(2000, Math.round(Number(v) || 0))) || 200;
const anonId = (uid) => createHash('sha256').update('nibble-gif:' + uid).digest('hex').slice(0, 32);

// KLIPY items carry their files per size (hd / md / sm / xs) and format (gif / webp / mp4)
function klipyFile(it, sizes) {
  const f = it.file || it.files || {};
  for (const s of sizes) {
    const set = f[s];
    if (!set) continue;
    const pick = set.webp || set.gif || (set.url ? set : null);
    if (pick && pick.url) return { url: pick.url, w: num(pick.width), h: num(pick.height) };
  }
  const flat = f.webp || f.gif;
  return flat && flat.url ? { url: flat.url, w: num(flat.width), h: num(flat.height) } : null;
}

async function klipy(path, params) {
  const key = encodeURIComponent((process.env.KLIPY_API_KEY || '').trim());
  const r = await fetch(`https://api.klipy.com/api/v1/${key}/gifs/${path}?${new URLSearchParams(params)}`, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('klipy ' + r.status);
  return j;
}
async function giphy(path, params) {
  const r = await fetch(`https://api.giphy.com/v1/gifs/${path}?${new URLSearchParams({ api_key: (process.env.GIPHY_API_KEY || '').trim(), ...params })}`, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('giphy ' + r.status);
  return j;
}

// one page of results: [{ p, id, preview, w, h }] (preview = a small picture for the picker)
export async function searchGifs({ q, page = 1, uid }) {
  const p = gifProvider();
  if (!p) return { items: [], provider: '' };
  const query = String(q || '').trim().slice(0, 60);
  if (p === 'k') {
    const params = { page: String(page), per_page: '24', customer_id: anonId(uid || 'x'), locale: 'en' };
    const j = await klipy(query ? 'search' : 'trending', query ? { ...params, q: query } : params);
    const list = (j.data && (j.data.data || j.data)) || [];
    const items = (Array.isArray(list) ? list : []).filter((it) => it && it.type !== 'ad').map((it) => {
      const big = klipyFile(it, ['md', 'sm', 'hd', 'xs']);
      const small = klipyFile(it, ['sm', 'xs', 'md']) || big;
      const id = String(it.slug || it.id || '');
      return big && okGifId('k', id) ? { p: 'k', id, preview: small.url, w: big.w, h: big.h } : null;
    }).filter(Boolean);
    return { items, more: !!(j.data && j.data.has_next), provider: 'k' };
  }
  const params = { limit: '24', offset: String((page - 1) * 24), rating: 'pg-13', random_id: anonId(uid || 'x') };
  const j = await giphy(query ? 'search' : 'trending', query ? { ...params, q: query } : params);
  const items = (j.data || []).map((it) => {
    const im = it.images || {};
    const big = im.fixed_width || im.downsized || im.original || {};
    const small = im.fixed_width_small || big;
    return okGifId('g', it.id) && (small.webp || small.url) ? { p: 'g', id: it.id, preview: small.webp || small.url, w: num(big.width), h: num(big.height) } : null;
  }).filter(Boolean);
  const pg = j.pagination || {};
  return { items, more: (pg.offset || 0) + (pg.count || 0) < (pg.total_count || 0), provider: 'g' };
}

// the file to show for a GIF someone sent
const cache = new Map();
export async function gifMediaUrl(p, id) {
  if (!okGifId(p, id)) return '';
  if (p === 'g') return `https://media.giphy.com/media/${id}/200w.webp`;
  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) return hit.url;
  if (!(process.env.KLIPY_API_KEY || '').trim()) return '';
  const j = await klipy(encodeURIComponent(id), {});
  const it = (j.data && (j.data.data || j.data)) || {};
  const f = klipyFile(Array.isArray(it) ? it[0] || {} : it, ['md', 'sm', 'hd', 'xs']);
  const url = f && /^https:\/\//.test(f.url) ? f.url : '';
  if (url) { cache.set(id, { url, exp: Date.now() + 6 * 3600_000 }); if (cache.size > 2000) cache.clear(); }
  return url;
}
