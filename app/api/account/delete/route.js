// POST /api/account/delete  (Authorization: Bearer <Firebase ID token>, body { confirm: "DELETE" })
// Deletes the caller's account and Nibble data (lib/accountDelete.js). Required by Apple + Google Play.
import { bearer } from '../../../../lib/adminAuth';
import { deleteAccount } from '../../../../lib/accountDelete';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const recent = new Map(); // ip → time (one try every 10 s is plenty)

export async function POST(req) {
  const h = { 'cache-control': 'no-store' };
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const last = recent.get(ip) || 0;
  if (Date.now() - last < 10_000) return Response.json({ error: 'One moment, then try again.' }, { status: 429, headers: h });
  recent.set(ip, Date.now());
  if (recent.size > 2000) recent.delete(recent.keys().next().value);

  const body = await req.json().catch(() => ({}));
  if (!body || body.confirm !== 'DELETE') return Response.json({ error: 'Type DELETE to confirm.' }, { status: 400, headers: h });
  try {
    const r = await deleteAccount(bearer(req));
    if (!r.ok) return Response.json({ error: r.error, code: r.code }, { status: r.code === 'recent' ? 401 : r.code === 'auth' ? 401 : 502, headers: h });
    return Response.json({ ok: true }, { headers: h });
  } catch {
    return Response.json({ error: 'Couldn’t delete the account right now. Try again in a minute.' }, { status: 502, headers: h });
  }
}
