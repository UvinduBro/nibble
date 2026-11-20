// Re-checks the caller's subscription with Stripe and updates premium/{uid}. The app calls it after
// coming back from checkout (so Premium shows at once, even before the webhook lands). With the
// checkout session id from the return link, that exact session is checked (it must belong to the caller).
import { bearer } from '../../../../lib/adminAuth';
import { accountOf, refreshFromStripe, getStripe, syncSubscription, subUid } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };
const last = new Map(); // uid → time (one Stripe check per 20 s per person)
const lastSid = new Map(); // uid → time (a check with a session id: at most one every 3 s, so it can't be used to flood Stripe)
const SESSION = /^cs_(test|live)_\w{10,200}$/;

const view = (p) => ({ ok: true, premium: p ? { active: !!p.active, until: p.until || 0, cancelAtEnd: !!p.cancelAtEnd, action: p.action || '' } : null });

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  let body = {};
  try { body = JSON.parse((await req.text()).slice(0, 1000) || '{}'); } catch {}
  const sid = SESSION.test(String(body.sessionId || '')) ? String(body.sessionId) : '';
  if (!sid && Date.now() - (last.get(me.uid) || 0) < 20_000) return Response.json({ ok: true, cached: true }, { headers: h });
  if (sid && Date.now() - (lastSid.get(me.uid) || 0) < 3_000) return Response.json({ ok: true, cached: true }, { headers: h });
  if (sid) { lastSid.set(me.uid, Date.now()); if (lastSid.size > 5000) lastSid.delete(lastSid.keys().next().value); }
  last.set(me.uid, Date.now());
  if (last.size > 5000) last.delete(last.keys().next().value);
  try {
    if (sid) {
      const s = await getStripe().checkout.sessions.retrieve(sid, { expand: ['subscription'] }).catch(() => null);
      // someone else's session id: ignore it and just check the caller's own account
      if (s && s.client_reference_id === me.uid && s.status === 'complete' && s.subscription && typeof s.subscription === 'object' && subUid(s.subscription) === me.uid) {
        return Response.json(view(await syncSubscription(s.subscription)), { headers: h });
      }
    }
    return Response.json(view(await refreshFromStripe(me.uid)), { headers: h });
  } catch (e) {
    console.error('status failed:', e && e.message);
    return Response.json({ error: 'Couldn’t check your subscription right now.' }, { status: 502, headers: h });
  }
}
