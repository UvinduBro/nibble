// Feedback and bug reports from the public website (no sign-in needed). Writes reports/{id} through
// the Firestore REST API as an anonymous visitor, so the Firestore rules still check every field.
// Light spam protection: a hidden honeypot field and a per-address limit.
import { firebaseConfig } from '../../../lib/social/config';
import { cleanReport, reportId } from '../../../lib/reports';
import { sendContactMail } from '../../../lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const hits = new Map(); // ip → [times]
const WINDOW = 10 * 60_000, MAX_PER_WINDOW = 5;

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= MAX_PER_WINDOW) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 2000) hits.delete(hits.keys().next().value);
  return false;
}

const val = (v) => ({ stringValue: String(v) });

export async function POST(req) {
  const h = { 'cache-control': 'no-store' };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > 900_000) return Response.json({ error: 'That’s too big. Try a smaller screenshot.' }, { status: 413, headers: h });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Something went wrong. Try again.' }, { status: 400, headers: h }); }
  if (body && body.site) return Response.json({ ok: true }, { headers: h }); // honeypot: bots fill every field
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return Response.json({ error: 'Thanks! That’s a lot of messages already. Try again in a few minutes.' }, { status: 429, headers: h });

  const r = cleanReport({ ...body, client: 'site' }, {});
  if (r.kind === 'bug' ? r.what.length < 4 : r.text.length < 4) return Response.json({ error: 'Tell us a little more first.' }, { status: 400, headers: h });
  if (r.kind === 'contact' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.contact)) return Response.json({ error: 'Add an email address so we can reply.' }, { status: 400, headers: h });

  const id = reportId();
  const base = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  const fields = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, val(v)]));
  const write = {
    update: { name: `${base}/reports/${id}`, fields },
    updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false },
  };
  const saveToFirestore = async () => {
    const res = await fetch(`https://firestore.googleapis.com/v1/${base}:commit?key=${firebaseConfig.apiKey}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ writes: [write] }),
    });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { ok: false, code: j.error && j.error.status };
  };

  // Contact messages: email hello@ and save to the admin Reports tab at the same time.
  // If either one works, the visitor's message is safe.
  if (r.kind === 'contact') {
    const [saved, mailed] = await Promise.allSettled([
      saveToFirestore(),
      sendContactMail(r, { id, ip }),
    ]);
    const savedOk = saved.status === 'fulfilled' && saved.value.ok;
    const mailedOk = mailed.status === 'fulfilled' && mailed.value.sent;
    if (mailed.status === 'rejected') console.error('contact mail failed:', mailed.reason && mailed.reason.message);
    else if (!mailedOk) console.warn('contact mail skipped:', mailed.value.reason);
    if (savedOk || mailedOk) return Response.json({ ok: true, id }, { headers: h });
    return Response.json({ error: 'Couldn’t send that right now. Try again in a minute, or email hello@meetnibble.com.' }, { status: 502, headers: h });
  }

  try {
    const res = await saveToFirestore();
    if (!res.ok) {
      if (res.code === 'RESOURCE_EXHAUSTED') return Response.json({ error: 'Our server is resting for today. Please try again after 1:30 PM Sri Lanka time.' }, { status: 503, headers: h });
      return Response.json({ error: 'Couldn’t send that right now. Try again in a minute.' }, { status: 502, headers: h });
    }
    return Response.json({ ok: true, id }, { headers: h });
  } catch {
    return Response.json({ error: 'Couldn’t send that right now. Try again in a minute.' }, { status: 502, headers: h });
  }
}
