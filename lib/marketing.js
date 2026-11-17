// Email marketing through Resend: an opt-in subscriber list (a Resend segment) and broadcasts.
// Only people who chose to get news are on the list, and every broadcast carries Resend's
// one-click unsubscribe link. Needs RESEND_MARKETING_KEY (a full-access key: contacts + broadcasts)
// and RESEND_SEGMENT_ID (the "Nibble subscribers" segment).
import { mailFrom, esc, EMAIL_RE } from './mail';
import { renderEmail } from './emailTemplates';

const API = 'https://api.resend.com';
export const marketingReady = () => !!(process.env.RESEND_MARKETING_KEY && process.env.RESEND_SEGMENT_ID);
const seg = () => process.env.RESEND_SEGMENT_ID;
// the lists a campaign can go to: people who opted in, and contacts an admin imported
export const LISTS = {
  subscribers: { label: 'Subscribers', id: () => process.env.RESEND_SEGMENT_ID },
  imported: { label: 'Imported contacts', id: () => process.env.RESEND_IMPORT_SEGMENT_ID },
};
export const listId = (k) => (LISTS[k] ? LISTS[k].id() || '' : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
export async function countSubscribers(segId = seg()) {
  if (!segId) return { total: 0, capped: false };
  let total = 0, after = '', more = true, pages = 0, base = `/segments/${segId}/contacts`;
  while (more && pages < 20) {
    let r = await call('GET', `${base}?limit=100${after ? '&after=' + after : ''}`);
    if (!r.ok && pages === 0) { base = `/audiences/${segId}/contacts`; r = await call('GET', `${base}?limit=100`); }
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

// Add one imported contact to a list. Never re-subscribes someone who unsubscribed before.
// → 'added' | 'existing'
export async function importContact({ email, first = '', last = '' }, list = 'imported') {
  email = cleanEmail(email);
  const segId = listId(list);
  if (!email || !segId) throw new Error('bad contact');
  const nm = (v) => String(v || '').replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 40);
  const body = { email, ...(nm(first) ? { first_name: nm(first) } : {}), ...(nm(last) ? { last_name: nm(last) } : {}) };
  let r = await call('POST', '/contacts', { ...body, segments: [{ id: segId }] });
  if (r.ok) return 'added';
  if (r.status === 429) { await sleep(1200); r = await call('POST', '/contacts', { ...body, segments: [{ id: segId }] }); if (r.ok) return 'added'; }
  if (r.status === 409 || r.status === 422 || r.status === 400) {
    const s2 = await call('POST', `/contacts/${encodeURIComponent(email)}/segments/${segId}`);
    if (s2.ok || s2.status === 409 || s2.status === 422) return 'existing';
  }
  r = await call('POST', `/audiences/${segId}/contacts`, body);
  if (r.ok) return 'added';
  if (r.status === 409) return 'existing';
  throw fail(r, 'import');
}

// a batch from the admin page, one at a time (Resend allows a few requests a second)
export async function importBatch(contacts, list) {
  const out = { added: 0, existing: 0, failed: 0 };
  for (const c of contacts) {
    try { out[await importContact(c, list)]++; } catch { out.failed++; }
    await sleep(550);
  }
  return out;
}

// create the broadcast for a list, then send it (now, or at `scheduledAt`, ISO time)
export async function sendCampaign({ template, fields, list = 'subscribers', scheduledAt }) {
  const segId = listId(list);
  if (!segId) throw new Error('that list isn’t set up');
  const { subject, preview, html, text } = renderEmail(template, fields);
  const base = { from: mailFrom(), subject, html, text, name: subject.slice(0, 70) + ' · ' + LISTS[list].label + ' · ' + new Date().toISOString().slice(0, 10), ...(preview ? { preview_text: preview } : {}) };
  let r = await call('POST', '/broadcasts', { ...base, segment_id: segId });
  if (!r.ok && (r.status === 422 || r.status === 400)) r = await call('POST', '/broadcasts', { ...base, audience_id: segId });
  if (!r.ok || !r.j.id) throw fail(r, 'create broadcast');
  const s = await call('POST', `/broadcasts/${r.j.id}/send`, scheduledAt ? { scheduled_at: scheduledAt } : {});
  if (!s.ok) throw fail(s, 'send broadcast');
  return r.j.id;
}
void esc;
