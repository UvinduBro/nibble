// Tea Room: every post, comment, reaction, report and delete goes through here, so anonymous posts
// never carry who wrote them (the author is kept in a server-only collection). See lib/teaCore.js.
import { bearer } from '../../../lib/adminAuth';
import { accountOf } from '../../../lib/billing';
import { teaAction } from '../../../lib/teaCore';
import { teaStore, teaHash, teaReady } from '../../../lib/teaServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };
const burst = new Map(); // uid → [times] (a quick in-memory brake on top of the daily limits)

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  if (!teaReady()) return Response.json({ error: 'The Tea Room isn’t set up on the server yet.' }, { status: 503, headers: h });
  const now = Date.now();
  const recent = (burst.get(me.uid) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) return Response.json({ error: 'Too fast! Take a breath and try again in a minute.' }, { status: 429, headers: h });
  burst.set(me.uid, [...recent, now]);
  if (burst.size > 5000) burst.delete(burst.keys().next().value);
  const raw = await req.text();
  if (raw.length > 4000) return Response.json({ error: 'Too long.' }, { status: 413, headers: h });
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return Response.json({ error: 'Bad request.' }, { status: 400, headers: h }); }
  try {
    const out = await teaAction(teaStore, me.uid, body || {}, { hash: teaHash });
    return Response.json(out, { headers: h });
  } catch (e) {
    if (e && e.friendly) return Response.json({ error: e.friendly }, { status: e.status || 400, headers: h });
    console.error('tea failed:', e && e.message);
    return Response.json({ error: 'The Tea Room hit a snag. Try again in a moment.' }, { status: 502, headers: h });
  }
}
