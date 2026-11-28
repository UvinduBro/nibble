// GIF picker search (signed-in people only, so the provider key can't be used from outside).
import { accountOf } from '../../../../lib/billing';
import { bearer } from '../../../../lib/adminAuth';
import { gifProvider, searchGifs } from '../../../../lib/gif';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'private, max-age=300' };
const hits = new Map();

export async function GET(req) {
  if (!gifProvider()) return Response.json({ error: 'GIFs aren’t set up yet.', off: true }, { status: 503, headers: h });
  const acct = await accountOf(bearer(req)).catch(() => null);
  if (!acct) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  const now = Date.now();
  const list = (hits.get(acct.uid) || []).filter((t) => now - t < 60_000);
  list.push(now); hits.set(acct.uid, list); if (hits.size > 5000) hits.clear();
  if (list.length > 60) return Response.json({ error: 'Slow down a little 🙂' }, { status: 429, headers: h });
  const u = new URL(req.url);
  const page = Math.max(1, Math.min(20, Number(u.searchParams.get('page')) || 1));
  try {
    return Response.json(await searchGifs({ q: u.searchParams.get('q') || '', page, uid: acct.uid }), { headers: h });
  } catch {
    return Response.json({ error: 'GIF search isn’t answering. Try again in a moment.' }, { status: 502, headers: h });
  }
}
