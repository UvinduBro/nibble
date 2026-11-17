// Email marketing through Resend: an opt-in subscriber list (a Resend segment) and broadcasts.
// Only people who chose to get news are on the list, and every broadcast carries Resend's
// one-click unsubscribe link. Needs RESEND_MARKETING_KEY (a full-access key: contacts + broadcasts)
// and RESEND_SEGMENT_ID (the "Nibble subscribers" segment).
import { mailFrom, esc, EMAIL_RE } from './mail';

const API = 'https://api.resend.com';
export const marketingReady = () => !!(process.env.RESEND_MARKETING_KEY && process.env.RESEND_SEGMENT_ID);
const seg = () => process.env.RESEND_SEGMENT_ID;

async function call(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { authorization: 'Bearer ' + process.env.RESEND_MARKETING_KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
const fail = (r, what) => new Error(`${what}: ${r.status} ${(r.j && (r.j.message || r.j.name)) || ''}`.trim());

export const cleanEmail = (e) => {
  const s = String(e || '').trim().toLowerCase();
  return s.length <= 120 && EMAIL_RE.test(s) ? s : '';
};

// add (or re-subscribe) someone to the list
export async function subscribe(email, { name = '', source = '' } = {}) {
  email = cleanEmail(email);
  if (!email) throw new Error('bad email');
  const first = String(name || '').replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 40);
  let r = await call('POST', '/contacts', { email, unsubscribed: false, ...(first ? { first_name: first } : {}), segments: [{ id: seg() }] });
  if (r.ok) return true;
  // already a contact: switch them back on and make sure they're in the segment
  if (r.status === 409 || r.status === 422 || r.status === 400) {
    await call('PATCH', '/contacts/' + encodeURIComponent(email), { unsubscribed: false });
    const s = await call('POST', `/contacts/${encodeURIComponent(email)}/segments/${seg()}`);
    if (s.ok || s.status === 409 || s.status === 422) return true;
  }
  // older API shape (audiences)
  r = await call('POST', `/audiences/${seg()}/contacts`, { email, unsubscribed: false, ...(first ? { first_name: first } : {}) });
  if (r.ok || r.status === 409) return true;
  throw fail(r, 'subscribe');
  void source;
}

export async function unsubscribe(email) {
  email = cleanEmail(email);
  if (!email) return false;
  const r = await call('PATCH', '/contacts/' + encodeURIComponent(email), { unsubscribed: true });
  if (r.ok) return true;
  const o = await call('PATCH', `/audiences/${seg()}/contacts/${encodeURIComponent(email)}`, { unsubscribed: true });
  return o.ok;
}

export async function isSubscribed(email) {
  email = cleanEmail(email);
  if (!email) return false;
  let r = await call('GET', '/contacts/' + encodeURIComponent(email));
  if (!r.ok) r = await call('GET', `/audiences/${seg()}/contacts/${encodeURIComponent(email)}`);
  return !!(r.ok && r.j && r.j.email && !r.j.unsubscribed);
}

// how many people are on the list (pages through up to 2,000)
export async function countSubscribers() {
  let total = 0, after = '', more = true, pages = 0, base = `/segments/${seg()}/contacts`;
  while (more && pages < 20) {
    let r = await call('GET', `${base}?limit=100${after ? '&after=' + after : ''}`);
    if (!r.ok && pages === 0) { base = `/audiences/${seg()}/contacts`; r = await call('GET', `${base}?limit=100`); }
    if (!r.ok) break;
    const list = r.j.data || [];
    total += list.filter((c) => !c.unsubscribed).length;
    more = !!r.j.has_more && list.length > 0;
    after = list.length ? list[list.length - 1].id : '';
    pages++;
  }
  return { total, capped: more };
}

export async function listBroadcasts() {
  const r = await call('GET', '/broadcasts?limit=20');
  if (!r.ok) return [];
  return (r.j.data || []).slice(0, 20).map((b) => ({ id: b.id, name: b.name || '', status: b.status || '', at: b.sent_at || b.scheduled_at || b.created_at || '' }));
}

// the marketing email: plain text in, simple branded HTML out, with the unsubscribe link
export function campaignEmail({ subject, message, preview = '', cta = '', ctaUrl = '' }) {
  const unsub = '{{{RESEND_UNSUBSCRIBE_URL}}}';
  const safeUrl = /^https:\/\/[^\s"'<>]+$/.test(ctaUrl) ? ctaUrl : '';
  const text = `${message}${cta && safeUrl ? `\n\n${cta}: ${safeUrl}` : ''}\n\n—\nThe Nibble team · https://meetnibble.com\nYou’re getting this because you asked for Nibble news. Unsubscribe: ${unsub}`;
  const button = cta && safeUrl
    ? `<tr><td style="padding-top:22px"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#7ee8c6" style="background-color:#7ee8c6;border-radius:10px"><a href="${esc(safeUrl)}" style="display:inline-block;padding-top:12px;padding-bottom:12px;padding-left:22px;padding-right:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:#0b0d17;text-decoration:none">${esc(cta)}</a></td></tr></table></td></tr>`
    : '';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f5fa">
<div style="display:none;max-height:0;overflow:hidden">${esc(preview)}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5fa" style="background-color:#f4f5fa"><tr><td align="center" style="padding-top:28px;padding-bottom:28px;padding-left:12px;padding-right:12px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px" bgcolor="#ffffff">
<tr><td bgcolor="#0b0d17" style="background-color:#0b0d17;padding-top:20px;padding-bottom:20px;padding-left:28px;padding-right:28px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:bold;color:#7ee8c6">Nibble (◕‿◕)</td></tr>
<tr><td style="padding-top:28px;padding-bottom:30px;padding-left:28px;padding-right:28px"><table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#1a1a1a;white-space:pre-wrap">${esc(message)}</td></tr>${button}
</table></td></tr>
<tr><td style="padding-top:16px;padding-bottom:22px;padding-left:28px;padding-right:28px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#888888">The Nibble team · <a href="https://meetnibble.com" style="color:#888888">meetnibble.com</a><br>You’re getting this because you asked for Nibble news. <a href="${unsub}" style="color:#888888">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

// create the broadcast for the whole list, then send it (now, or at `scheduledAt`, ISO time)
export async function sendCampaign({ subject, message, preview, cta, ctaUrl, scheduledAt }) {
  const { text, html } = campaignEmail({ subject, message, preview, cta, ctaUrl });
  const base = { from: mailFrom(), subject, html, text, name: subject.slice(0, 80) + ' · ' + new Date().toISOString().slice(0, 10), ...(preview ? { preview_text: preview } : {}) };
  let r = await call('POST', '/broadcasts', { ...base, segment_id: seg() });
  if (!r.ok && (r.status === 422 || r.status === 400)) r = await call('POST', '/broadcasts', { ...base, audience_id: seg() });
  if (!r.ok || !r.j.id) throw fail(r, 'create broadcast');
  const s = await call('POST', `/broadcasts/${r.j.id}/send`, scheduledAt ? { scheduled_at: scheduledAt } : {});
  if (!s.ok) throw fail(s, 'send broadcast');
  return r.j.id;
}
