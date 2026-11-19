// Admin → Tea Room: reported / hidden posts (with who wrote them) and moderation actions.
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { teaAdminList, teaAdminAction } from '../../../../lib/teaCore';
import { teaStore, teaReady } from '../../../../lib/teaServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };

async function gate(req) {
  const token = bearer(req);
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try { if (!(await adminUid(token))) return Response.json({ error: 'Admins only.' }, { status: 403, headers: h }); }
  catch { return Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h }); }
  if (!teaReady()) return Response.json({ error: 'The server has no service account key, so it can’t read the Tea Room.' }, { status: 503, headers: h });
  return null;
}
const oops = (e) => (e && e.friendly
  ? Response.json({ error: e.friendly }, { status: e.status || 400, headers: h })
  : Response.json({ error: 'Couldn’t reach Firestore (does the service account have the Cloud Datastore User role?)' }, { status: 502, headers: h }));

export async function GET(req) {
  const no = await gate(req); if (no) return no;
  try { return Response.json(await teaAdminList(teaStore), { headers: h }); } catch (e) { console.error('tea admin list:', e && e.message); return oops(e); }
}
export async function POST(req) {
  const no = await gate(req); if (no) return no;
  const body = await req.json().catch(() => ({}));
  try { return Response.json(await teaAdminAction(teaStore, body || {}), { headers: h }); } catch (e) { console.error('tea admin:', e && e.message); return oops(e); }
}
