// Firestore usage for the admin dashboard (admins only, see lib/adminAuth.js).
import { firebaseConfig } from '../../../../lib/social/config';
import { getUsage } from '../../../../lib/usage';
import { adminUid, bearer } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const h = { 'cache-control': 'no-store' };
  const token = bearer(req);
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try {
    if (!(await adminUid(token))) return Response.json({ error: 'Admins only.' }, { status: 403, headers: h });
  } catch {
    return Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h });
  }
  try {
    return Response.json(await getUsage(firebaseConfig.projectId), { headers: h });
  } catch (e) {
    console.error('usage failed:', e && e.message);
    return Response.json({ configured: true, error: 'Couldn’t read usage from Google Cloud right now.' }, { status: 200, headers: h });
  }
}
