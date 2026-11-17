// Admin dashboard → Marketing (admins only).
//   GET  → { ready, from, subscribers, capped, broadcasts }
//   POST { action: 'test', to?, subject, message, preview?, cta?, ctaUrl? }   one copy to you (or `to`)
//   POST { action: 'send', subject, message, preview?, cta?, ctaUrl?, scheduledAt? }   the whole list
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { sendMail, mailFrom, EMAIL_RE } from '../../../../lib/mail';
import { marketingReady, countSubscribers, listBroadcasts, campaignEmail, sendCampaign } from '../../../../lib/marketing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const h = { 'cache-control': 'no-store' };
let lastSend = 0; // one campaign per 2 minutes (guards against double clicks + a stolen session)

async function guard(req) {
  const token = bearer(req);
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try { return (await adminUid(token)) ? null : Response.json({ error: 'Admins only.' }, { status: 403, headers: h }); }
  catch { return Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h }); }
}

export async function GET(req) {
  const bad = await guard(req);
  if (bad) return bad;
  if (!marketingReady()) return Response.json({ ready: false, from: mailFrom() }, { headers: h });
  const [count, broadcasts] = await Promise.all([countSubscribers().catch(() => ({ total: 0, capped: false })), listBroadcasts().catch(() => [])]);
  return Response.json({ ready: true, from: mailFrom(), subscribers: count.total, capped: count.capped, broadcasts }, { headers: h });
}

export async function POST(req) {
  const bad = await guard(req);
  if (bad) return bad;
  if (!marketingReady()) return Response.json({ error: 'Marketing isn’t set up: add RESEND_MARKETING_KEY and RESEND_SEGMENT_ID in Vercel.' }, { status: 503, headers: h });
  if (Number(req.headers.get('content-length') || 0) > 60_000) return Response.json({ error: 'That email is too long.' }, { status: 413, headers: h });
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: 'Bad request.' }, { status: 400, headers: h }); }
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim();
  const message = String(b.message || '').replace(/\r\n/g, '\n').trim();
  const preview = String(b.preview || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 140);
  const cta = String(b.cta || '').trim().slice(0, 40);
  const ctaUrl = String(b.ctaUrl || '').trim().slice(0, 300);
  if (!subject || subject.length > 150) return Response.json({ error: 'Add a subject (up to 150 characters).' }, { status: 400, headers: h });
  if (!message || message.length > 20_000) return Response.json({ error: 'Write a message (up to 20,000 characters).' }, { status: 400, headers: h });
  if (ctaUrl && !/^https:\/\/[^\s"'<>]+$/.test(ctaUrl)) return Response.json({ error: 'The button link must start with https://' }, { status: 400, headers: h });

  try {
    if (b.action === 'test') {
      const to = String(b.to || '').trim().toLowerCase();
      if (!EMAIL_RE.test(to)) return Response.json({ error: 'Add the address to send the test to.' }, { status: 400, headers: h });
      // fill the merge tags the way Resend would for someone without a name
      const fill = (x) => x.replace(/\{\{\{FIRST_NAME\|([^}]*)\}\}\}/g, '$1').replace(/\{\{\{(FIRST_NAME|LAST_NAME)\}\}\}/g, '').replace(/\{\{\{EMAIL\}\}\}/g, to);
      const { text, html } = campaignEmail({ subject, message: fill(message), preview, cta, ctaUrl });
      const r = await sendMail({ to, subject: '[Test] ' + subject, text: text.replace('{{{RESEND_UNSUBSCRIBE_URL}}}', 'https://meetnibble.com'), html: html.split('{{{RESEND_UNSUBSCRIBE_URL}}}').join('https://meetnibble.com'), tags: [{ name: 'type', value: 'test' }] });
      if (!r.sent) return Response.json({ error: 'Couldn’t send the test.' }, { status: 502, headers: h });
      return Response.json({ ok: true, test: true }, { headers: h });
    }
    if (b.action !== 'send') return Response.json({ error: 'Unknown action.' }, { status: 400, headers: h });
    if (Date.now() - lastSend < 120_000) return Response.json({ error: 'A campaign just went out. Wait a couple of minutes.' }, { status: 429, headers: h });
    let scheduledAt = '';
    if (b.scheduledAt) {
      const t = Date.parse(b.scheduledAt);
      if (!t || t < Date.now() + 60_000 || t > Date.now() + 30 * 86400_000) return Response.json({ error: 'Pick a time between a minute and 30 days from now.' }, { status: 400, headers: h });
      scheduledAt = new Date(t).toISOString();
    }
    lastSend = Date.now();
    const id = await sendCampaign({ subject, message, preview, cta, ctaUrl, scheduledAt });
    return Response.json({ ok: true, id, scheduled: !!scheduledAt }, { headers: h });
  } catch (e) {
    console.error('marketing failed:', e && e.message);
    return Response.json({ error: 'Resend didn’t accept it: ' + String((e && e.message) || 'unknown error').slice(0, 160) }, { status: 502, headers: h });
  }
}
