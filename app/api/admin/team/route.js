// Admin → Team: list, add and remove admins. admins/{uid} can't be written from a browser (rules),
// so this server route does it with the service account after checking the caller is an admin.
import { adminUid, bearer, forgetAdmin } from '../../../../lib/adminAuth';
import { fsGet, fsSet, fsDelete, fsQuery, serviceKey } from '../../../../lib/gcp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });

async function gate(req) {
  const token = bearer(req);
  if (!token) return { no: bad('Sign in as an admin.', 401) };
  let uid = '';
  try { uid = await adminUid(token); } catch { return { no: bad('Couldn’t check your admin access. Try again.', 502) }; }
  if (!uid) return { no: bad('Admins only.', 403) };
  if (!serviceKey()) return { no: bad('The server has no service account key yet.', 503) };
  return { uid };
}

async function list() {
  const docs = await fsQuery('admins', {});
  return Promise.all(docs.map(async (d) => {
    const u = await fsGet('users/' + d.id).catch(() => null);
    return { uid: d.id, username: (u && u.username) || d.data.username || '', skin: (u && u.skin) || 'mint', addedBy: d.data.addedBy || '', at: d.data.at || 0 };
  }));
}

export async function GET(req) {
  const g = await gate(req); if (g.no) return g.no;
  try { return Response.json({ admins: await list() }, { headers: h }); }
  catch (e) { console.error('team list:', e && e.message); return bad('Couldn’t reach Firestore (does the service account have the Cloud Datastore User role?)', 502); }
}

export async function POST(req) {
  const g = await gate(req); if (g.no) return g.no;
  const body = await req.json().catch(() => ({}));
  try {
    const me = await fsGet('users/' + g.uid).catch(() => null);
    if (body.action === 'add') {
      const name = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(name)) return bad('Type their exact username.');
      const hit = await fsGet('usernames/' + name);
      if (!hit || !hit.uid) return bad(`No one called @${name}.`);
      if (await fsGet('admins/' + hit.uid)) return bad(`@${name} is already an admin.`);
      await fsSet('admins/' + hit.uid, { username: name, addedBy: (me && me.username) || '', at: Date.now() });
    } else if (body.action === 'remove') {
      const uid = String(body.uid || '');
      if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) return bad('Unknown admin.');
      if (uid === g.uid) return bad('You can’t remove yourself. Ask another admin.');
      const all = await fsQuery('admins', {});
      if (all.length <= 1) return bad('Nibble needs at least one admin.');
      await fsDelete('admins/' + uid);
      forgetAdmin(uid);
    } else return bad('Unknown action.');
    return Response.json({ ok: true, admins: await list() }, { headers: h });
  } catch (e) {
    console.error('team:', e && e.message);
    return bad('Couldn’t reach Firestore (does the service account have the Cloud Datastore User role?)', 502);
  }
}
