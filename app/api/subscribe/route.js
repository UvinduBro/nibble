// "Email me Nibble news": opt-in to the marketing list (Resend segment, see lib/marketing.js).
//   Website form:  POST { email, name?, site (honeypot) }               rate-limited per address
//   Signed in:     Authorization: Bearer <Firebase ID token>
//                  GET → { subscribed }   POST { on: true | false }     uses the account's own email
import { firebaseConfig } from '../../../lib/social/config';
import { bearer } from '../../../lib/adminAuth';
import { marketingReady, subscribe, unsubscribe, isSubscribed, cleanEmail } from '../../../lib/marketing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const h = { 'cache-control': 'no-store' };
const hits = new Map();
const WINDOW = 60 * 60_000, MAX = 6;
function limited(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW);
  if (list.length >= MAX) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return false;
}
const ipOf = (req) => req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

// the signed-in person's verified email, checked by Firebase Auth itself
async function accountEmail(token) {
  if (!token || token.length > 4096) return '';
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }), cache: 'no-store',
  });
  if (!r.ok) return '';
  const u = ((await r.json().catch(() => ({}))).users || [])[0] || {};
  return u.emailVerified ? cleanEmail(u.email) : '';
}

export async function GET(req) {
  if (!marketingReady()) return Response.json({ ready: false, subscribed: false }, { headers: h });
  const email = await accountEmail(bearer(req));
  if (!email) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: h });
  return Response.json({ ready: true, subscribed: await isSubscribed(email).catch(() => false), email }, { headers: h });
}

export async function POST(req) {
  if (Number(req.headers.get('content-length') || 0) > 4000) return Response.json({ error: 'Bad request.' }, { status: 413, headers: h });
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: 'Bad request.' }, { status: 400, headers: h }); }
  if (b && b.site) return Response.json({ ok: true }, { headers: h }); // honeypot
  if (!marketingReady()) return Response.json({ error: 'Sign-ups aren’t open yet. Try again soon.' }, { status: 503, headers: h });
  if (limited(ipOf(req))) return Response.json({ error: 'Too many tries. Try again in a while.' }, { status: 429, headers: h });

  const token = bearer(req);
  try {
    if (token) {
      const email = await accountEmail(token);
      if (!email) return Response.json({ error: 'Your account has no verified email.' }, { status: 400, headers: h });
      if (b && b.on === false) await unsubscribe(email);
      else await subscribe(email, { name: b && b.name, source: 'app' });
      return Response.json({ ok: true, subscribed: !(b && b.on === false) }, { headers: h });
    }
    const email = cleanEmail(b && b.email);
    if (!email) return Response.json({ error: 'That doesn’t look like an email address.' }, { status: 400, headers: h });
    await subscribe(email, { name: b && b.name, source: 'site' });
    return Response.json({ ok: true }, { headers: h });
  } catch (e) {
    console.error('subscribe failed:', e && e.message);
    return Response.json({ error: 'Couldn’t sign you up right now. Try again in a minute.' }, { status: 502, headers: h });
  }
}
