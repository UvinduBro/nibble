// Firestore usage for the admin dashboard. Admins only: the caller sends their Firebase ID token,
// and we check it by reading admins/{uid} from Firestore *with that token* (the rules only let an
// admin read their own admin doc, and Firestore itself verifies the token).
import { firebaseConfig } from '../../../../lib/social/config';
import { getUsage } from '../../../../lib/usage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const okAdmins = new Map(); // token → expiry (avoid a Firestore read on every refresh)

function uidOf(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).user_id || ''; } catch { return ''; }
}

async function isAdmin(token) {
  const hit = okAdmins.get(token);
  if (hit && hit > Date.now()) return true;
  const uid = uidOf(token);
  if (!uid || !/^[A-Za-z0-9]{10,40}$/.test(uid)) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/admins/${uid}`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) return false;
  okAdmins.set(token, Date.now() + 10 * 60_000);
  if (okAdmins.size > 50) okAdmins.delete(okAdmins.keys().next().value);
  return true;
}

export async function GET(req) {
  const h = { 'cache-control': 'no-store' };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try {
    if (!(await isAdmin(token))) return Response.json({ error: 'Admins only.' }, { status: 403, headers: h });
  } catch {
    return Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h });
  }
  try {
    return Response.json(await getUsage(firebaseConfig.projectId), { headers: h });
  } catch (e) {
    return Response.json({ configured: true, error: String((e && e.message) || e) }, { status: 200, headers: h });
  }
}
