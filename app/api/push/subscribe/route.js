// Turn push notifications on (POST { sub }) or off (DELETE { endpoint }) for this device.
import { accountOf } from '../../../../lib/billing';
import { bearer } from '../../../../lib/adminAuth';
import { addSub, cleanSub, forgetNoPush, removeSub } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };

export async function POST(req) {
  const acct = await accountOf(bearer(req)).catch(() => null);
  if (!acct) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  const body = await req.json().catch(() => ({}));
  const sub = cleanSub(body.sub);
  if (!sub) return Response.json({ error: 'This browser’s notification address doesn’t look right.' }, { status: 400, headers: h });
  try { await addSub(acct.uid, sub, req.headers.get('user-agent')); forgetNoPush(acct.uid); }
  catch { return Response.json({ error: 'Couldn’t save that. Try again in a minute.' }, { status: 500, headers: h }); }
  return Response.json({ ok: true }, { headers: h });
}

export async function DELETE(req) {
  const acct = await accountOf(bearer(req)).catch(() => null);
  if (!acct) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  const body = await req.json().catch(() => ({}));
  await removeSub(acct.uid, String(body.endpoint || '')).catch(() => {});
  return Response.json({ ok: true }, { headers: h });
}
