// Admin dashboard → Email. Admins only (lib/adminAuth.js).
//   GET  → is email set up (Resend / SMTP), the From address, and recent emails sent through Resend
//   POST { to, subject, message, reportId? } → sends one email from the team (to up to 20 people,
//        each gets their own copy so nobody sees the other addresses)
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { sendMail, teamEmail, resendReady, mailReady, mailFrom, EMAIL_RE } from '../../../../lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const h = { 'cache-control': 'no-store' };
const MAX_TO = 20, HOUR = 3600_000, PER_HOUR = 60;
const sent = new Map(); // admin uid → [times] (a stolen admin session can't blast out mail)

async function guard(req) {
  const token = bearer(req);
  if (!token) return { res: Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h }) };
  try {
    const uid = await adminUid(token);
    if (!uid) return { res: Response.json({ error: 'Admins only.' }, { status: 403, headers: h }) };
    return { uid };
  } catch {
    return { res: Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h }) };
  }
}

export async function GET(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  const out = { resend: resendReady(), smtp: mailReady(), from: mailFrom(), recent: [] };
  if (out.resend) {
    try {
      const r = await fetch('https://api.resend.com/emails?limit=20', { headers: { authorization: 'Bearer ' + (process.env.RESEND_MARKETING_KEY || process.env.RESEND_API_KEY) }, cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        out.recent = (j.data || []).slice(0, 20).map((e) => ({
          id: e.id, to: Array.isArray(e.to) ? e.to.join(', ') : String(e.to || ''), subject: e.subject || '', status: e.last_event || '', at: e.created_at || '',
        }));
      }
    } catch {}
  }
  return Response.json(out, { headers: h });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.res) return g.res;
  if (Number(req.headers.get('content-length') || 0) > 60_000) return Response.json({ error: 'That message is too long.' }, { status: 413, headers: h });
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: 'Bad request.' }, { status: 400, headers: h }); }
  const to = [...new Set(String((b && b.to) || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const subject = String((b && b.subject) || '').trim();
  const message = String((b && b.message) || '').replace(/\r\n/g, '\n').trim();
  if (!to.length) return Response.json({ error: 'Add who it’s to.' }, { status: 400, headers: h });
  if (to.length > MAX_TO) return Response.json({ error: `Up to ${MAX_TO} people at a time.` }, { status: 400, headers: h });
  const bad = to.find((x) => !EMAIL_RE.test(x) || x.length > 120);
  if (bad) return Response.json({ error: `“${bad.slice(0, 60)}” isn’t an email address.` }, { status: 400, headers: h });
  if (!subject || subject.length > 150) return Response.json({ error: 'Add a subject (up to 150 characters).' }, { status: 400, headers: h });
  if (!message || message.length > 20_000) return Response.json({ error: 'Write a message (up to 20,000 characters).' }, { status: 400, headers: h });
  if (!resendReady() && !mailReady()) return Response.json({ error: 'Email isn’t set up yet: add RESEND_API_KEY in Vercel.' }, { status: 503, headers: h });

  const now = Date.now();
  const mine = (sent.get(g.uid) || []).filter((t) => now - t < HOUR);
  if (mine.length + to.length > PER_HOUR) return Response.json({ error: 'That’s a lot of email this hour. Try again later.' }, { status: 429, headers: h });

  const mail = teamEmail({ subject, message });
  const results = [];
  for (const addr of to) {
    try {
      const r = await sendMail({ to: addr, ...mail, replyTo: 'hello@meetnibble.com', tags: [{ name: 'type', value: 'admin' }] });
      results.push({ to: addr, ok: !!r.sent, error: r.sent ? '' : 'not sent' });
      if (r.sent) mine.push(now);
    } catch (e) {
      console.error('admin email failed:', e && e.message);
      results.push({ to: addr, ok: false, error: 'not sent' });
    }
  }
  sent.set(g.uid, mine);
  const ok = results.filter((r) => r.ok).length;
  if (!ok) return Response.json({ error: 'Couldn’t send it. Try again in a minute.', results }, { status: 502, headers: h });
  return Response.json({ ok, failed: results.length - ok, results }, { headers: h });
}
