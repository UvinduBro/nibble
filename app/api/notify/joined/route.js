// "Someone new joined" → a team alert email to hello@meetnibble.com (lib/teamAlerts.js).
// Called once by the app right after a new account claims its username. Safe to call by anyone:
// the Firebase token proves who it is, only accounts made in the last 2 hours with a username count,
// and each account is announced at most once (teamAlerts/joined_<uid>).
import { accountOf } from '../../../../lib/billing';
import { bearer } from '../../../../lib/adminAuth';
import { fsGet } from '../../../../lib/gcp';
import { cleanSignup } from '../../../../lib/signup';
import { alertJoined, alertsOn } from '../../../../lib/teamAlerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 20;

const NEW_FOR = 2 * 3600_000;
const decode = (s) => { try { return decodeURIComponent(s || ''); } catch { return ''; } };

export async function POST(req) {
  const h = { 'cache-control': 'no-store' };
  if (!alertsOn()) return Response.json({ ok: true, skipped: 'off' }, { headers: h });
  const acct = await accountOf(bearer(req)).catch(() => null);
  if (!acct) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  if (!acct.createdAt || Date.now() - acct.createdAt > NEW_FOR) return Response.json({ ok: true, skipped: 'not new' }, { headers: h });
  const profile = await fsGet('users/' + acct.uid).catch(() => null);
  if (!profile || !profile.username) return Response.json({ ok: true, skipped: 'no username yet' }, { headers: h });
  const body = await req.json().catch(() => ({}));
  const r = await alertJoined({
    acct, profile,
    answers: cleanSignup(body.answers || {}),
    ip: {
      country: (req.headers.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2),
      city: decode(req.headers.get('x-vercel-ip-city')).slice(0, 60),
    },
    client: ['web', 'desktop', 'mobile'].includes(body.client) ? body.client : '',
  });
  return Response.json({ ok: true, sent: !!r.sent }, { headers: h });
}
