// After you send a private message or a group chat message, the app calls this so the people it's
// for get a push notification (only on devices where they turned notifications on).
// The server checks you may message them: a friend (users/{to}/friends/{you}) or a member of the group.
import { accountOf } from '../../../../lib/billing';
import { bearer } from '../../../../lib/adminAuth';
import { fsGet } from '../../../../lib/gcp';
import { pushTo } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;
const h = { 'cache-control': 'no-store' };

// a light per-sender limit (per server instance): enough for a fast chat, not for spam
const hits = new Map();
function limited(uid) {
  const now = Date.now();
  const list = (hits.get(uid) || []).filter((t) => now - t < 60_000);
  list.push(now); hits.set(uid, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 40;
}
const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export async function POST(req) {
  const acct = await accountOf(bearer(req)).catch(() => null);
  if (!acct) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  if (limited(acct.uid)) return Response.json({ ok: true, skipped: 'slow down' }, { headers: h });
  const b = await req.json().catch(() => ({}));
  const me = await fsGet('users/' + acct.uid).catch(() => null);
  const name = (me && me.username) || 'a friend';
  const text = clip(b.text, 140);
  if (!text) return Response.json({ ok: true, skipped: 'empty' }, { headers: h });
  try {
    if (b.kind === 'dm') {
      const to = String(b.to || '');
      if (!/^[A-Za-z0-9]{6,40}$/.test(to) || to === acct.uid) return Response.json({ error: 'Bad request.' }, { status: 400, headers: h });
      const friend = await fsGet(`users/${to}/friends/${acct.uid}`).catch(() => null);
      if (!friend) return Response.json({ ok: true, skipped: 'not friends' }, { headers: h });
      const sent = await pushTo([to], { title: '@' + name, body: text, tag: 'dm-' + acct.uid, url: `/app?tab=messages&with=${acct.uid}` });
      return Response.json({ ok: true, sent }, { headers: h });
    }
    if (b.kind === 'group') {
      const gid = String(b.gid || '');
      if (!/^[A-Za-z0-9_-]{4,40}$/.test(gid)) return Response.json({ error: 'Bad request.' }, { status: 400, headers: h });
      const g = await fsGet('groups/' + gid).catch(() => null);
      const members = (g && Array.isArray(g.members)) ? g.members : [];
      if (!members.includes(acct.uid)) return Response.json({ ok: true, skipped: 'not a member' }, { headers: h });
      const mentioned = new Set((Array.isArray(b.mentions) ? b.mentions : []).map(String));
      const others = members.filter((u) => u !== acct.uid).slice(0, 20);
      const title = `${clip(g.emoji, 8)} ${clip(g.name, 30)}`.trim();
      const url = `/app?tab=groups&group=${gid}`;
      const plain = others.filter((u) => !mentioned.has(u));
      const pinged = others.filter((u) => mentioned.has(u));
      const [a, c] = await Promise.all([
        plain.length ? pushTo(plain, { title, body: `@${name}: ${text}`, tag: 'grp-' + gid, url }) : 0,
        pinged.length ? pushTo(pinged, { title, body: `@${name} mentioned you: ${text}`, tag: 'grp-' + gid, url, mention: true }) : 0,
      ]);
      return Response.json({ ok: true, sent: a + c }, { headers: h });
    }
  } catch {
    return Response.json({ ok: true, skipped: 'error' }, { headers: h });
  }
  return Response.json({ error: 'Bad request.' }, { status: 400, headers: h });
}
