// "Manage subscription": Stripe's customer portal (cancel, change card, invoices) for the caller.
import { bearer } from '../../../../lib/adminAuth';
import { accountOf, getStripe, findCustomer, SITE } from '../../../../lib/billing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };

export async function POST(req) {
  const me = await accountOf(bearer(req)).catch(() => null);
  if (!me) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  try {
    const customer = await findCustomer(me.uid);
    if (!customer) return Response.json({ error: 'No subscription found for this account.' }, { status: 404, headers: h });
    const s = await getStripe().billingPortal.sessions.create({ customer, return_url: `${SITE}/app?premium=manage` });
    return Response.json({ url: s.url }, { headers: h });
  } catch (e) {
    console.error('portal failed:', e && e.message);
    return Response.json({ error: 'Couldn’t open subscription settings. Try again in a minute.' }, { status: 502, headers: h });
  }
}
