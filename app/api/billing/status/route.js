// Re-checks the caller's subscription with Stripe and updates premium/{uid}. The app calls it after
// coming back from checkout (so Premium shows at once, even before the webhook lands).
import { bearer } from '../../../../lib/adminAuth';
import { accountOf, refreshFromStripe } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };
const last = new Map(); // uid → time (one Stripe check per 20 s per person)

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  if (Date.now() - (last.get(me.uid) || 0) < 20_000) return Response.json({ ok: true, cached: true }, { headers: h });
  last.set(me.uid, Date.now());
  if (last.size > 5000) last.delete(last.keys().next().value);
  try {
    const p = await refreshFromStripe(me.uid);
    return Response.json({ ok: true, premium: p ? { active: !!p.active, until: p.until || 0, cancelAtEnd: !!p.cancelAtEnd } : null }, { headers: h });
  } catch (e) {
    console.error('status failed:', e && e.message);
    return Response.json({ error: 'Couldn’t check your subscription right now.' }, { status: 502, headers: h });
  }
}
