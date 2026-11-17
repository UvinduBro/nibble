// Admin dashboard → Marketing (admins only).
//   GET → { ready, from, lists: { subscribers: { total, capped, ready }, imported: {…} }, broadcasts }
//   POST { action: 'source', url }                   read contacts from a JSON / CSV link (preview only)
//   POST { action: 'import', list, consent, contacts: [{ email, first, last }] }   up to 25 per call
//   POST { action: 'test', to, template, fields }    one copy to you
//   POST { action: 'send', list, template, fields, scheduledAt? }                  the whole list
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { sendMail, mailFrom, EMAIL_RE } from '../../../../lib/mail';
import { marketingReady, countSubscribers, listBroadcasts, sendCampaign, importBatch, listId, LISTS, cleanEmail } from '../../../../lib/marketing';
import { renderEmail, fillForPreview, TEMPLATES } from '../../../../lib/emailTemplates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const h = { 'cache-control': 'no-store' };
const bad = (error, status = 400) => Response.json({ error }, { status, headers: h });
let lastSend = 0; // one campaign per 2 minutes (guards against double clicks + a stolen session)

async function guard(req) {
  const token = bearer(req);
  if (!token) return bad('Sign in as an admin.', 401);
  try { return (await adminUid(token)) ? null : bad('Admins only.', 403); }
  catch { return bad('Couldn’t check your admin access. Try again.', 502); }
}

export async function GET(req) {
  const g = await guard(req);
  if (g) return g;
  if (!marketingReady()) return Response.json({ ready: false, from: mailFrom() }, { headers: h });
  const keys = Object.keys(LISTS);
  const [counts, broadcasts] = await Promise.all([
    Promise.all(keys.map((k) => (listId(k) ? countSubscribers(listId(k)).catch(() => ({ total: 0, capped: false })) : { total: 0, capped: false }))),
    listBroadcasts().catch(() => []),
  ]);
  const lists = Object.fromEntries(keys.map((k, i) => [k, { label: LISTS[k].label, ready: !!listId(k), ...counts[i] }]));
  return Response.json({ ready: true, from: mailFrom(), lists, subscribers: lists.subscribers.total, broadcasts }, { headers: h });
}

// ---------- reading a contact list from a link ----------
function okUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return false;
    const host = x.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return false;
    return true;
  } catch { return false; }
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k.trim() || 'col' + (i + 1), (r[i] || '').trim()])));
}
// the first list of records anywhere in the JSON (e.g. [...], { data: [...] }, { tickets: [...] })
function findRecords(j, depth = 0) {
  if (Array.isArray(j)) return j.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
  if (!j || typeof j !== 'object' || depth > 3) return [];
  for (const v of Object.values(j)) { const r = findRecords(v, depth + 1); if (r.length) return r; }
  return [];
}
const flat = (o, pre = '', out = {}, depth = 0) => {
  for (const [k, v] of Object.entries(o || {})) {
    const key = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) flat(v, key, out, depth + 1);
    else if (typeof v === 'string' || typeof v === 'number') out[key] = String(v).trim().slice(0, 200);
  }
  return out;
};
function guess(columns, rows) {
  const share = (k, re) => rows.slice(0, 200).filter((r) => re.test(r[k] || '')).length / Math.max(1, Math.min(200, rows.length));
  const email = columns.map((k) => [k, share(k, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)]).sort((a, b) => b[1] - a[1]).find(([, s]) => s > 0.3);
  const pick = (re) => columns.find((k) => re.test(k.split('.').pop()));
  return {
    email: email ? email[0] : '',
    first: pick(/^(first[_ -]?name|firstname|given[_ -]?name|fname)$/i) || '',
    last: pick(/^(last[_ -]?name|lastname|surname|family[_ -]?name|lname)$/i) || '',
    name: pick(/^(full[_ -]?name|fullname|name|attendee[_ -]?name|display[_ -]?name)$/i) || '',
  };
}

export async function POST(req) {
  const g = await guard(req);
  if (g) return g;
  if (!marketingReady()) return bad('Marketing isn’t set up: add RESEND_MARKETING_KEY and RESEND_SEGMENT_ID in Vercel.', 503);
  if (Number(req.headers.get('content-length') || 0) > 400_000) return bad('That’s too much at once.', 413);
  let b;
  try { b = await req.json(); } catch { return bad('Bad request.'); }

  // read contacts from a link: nothing is saved yet, the admin checks the columns first
  if (b.action === 'source') {
    const url = String(b.url || '').trim();
    if (!okUrl(url)) return bad('Use a public https:// link to a JSON or CSV file.');
    try {
      const r = await fetch(url, { headers: { accept: 'application/json, text/csv;q=0.9, */*;q=0.5' }, signal: AbortSignal.timeout(15_000), cache: 'no-store', redirect: 'follow' });
      if (!r.ok) return bad(`That link answered ${r.status}.`, 502);
      if (Number(r.headers.get('content-length') || 0) > 5_000_000) return bad('That file is over 5 MB.', 413);
      const text = await r.text();
      if (text.length > 5_000_000) return bad('That file is over 5 MB.', 413);
      let records;
      try { records = findRecords(JSON.parse(text)); } catch { records = parseCsv(text); }
      const rows = records.slice(0, 5000).map((x) => flat(x));
      const columns = [...new Set(rows.slice(0, 500).flatMap((r) => Object.keys(r)))].slice(0, 60);
      if (!rows.length || !columns.length) return bad('Couldn’t find a list of people in that file.');
      return Response.json({ ok: true, total: records.length, rows, columns, guess: guess(columns, rows) }, { headers: h });
    } catch (e) {
      return bad('Couldn’t read that link: ' + String((e && e.message) || 'error').slice(0, 100), 502);
    }
  }

  if (b.action === 'import') {
    if (b.consent !== true) return bad('Confirm these people agreed to get email from you.');
    const list = b.list === 'subscribers' ? 'subscribers' : 'imported';
    if (!listId(list)) return bad('That list isn’t set up yet (RESEND_IMPORT_SEGMENT_ID).', 503);
    const contacts = (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 25)
      .map((c) => ({ email: cleanEmail(c && c.email), first: String((c && c.first) || ''), last: String((c && c.last) || '') }))
      .filter((c) => c.email);
    if (!contacts.length) return bad('No valid email addresses in this batch.');
    return Response.json({ ok: true, ...(await importBatch(contacts, list)) }, { headers: h });
  }

  // campaigns
  const template = TEMPLATES.some((t) => t.id === b.template) ? b.template : 'letter';
  const mail = renderEmail(template, b.fields || {});
  const ctaUrl = String((b.fields && b.fields.ctaUrl) || '');
  if (!mail.subject) return bad('Add a subject.');
  if (ctaUrl && !/^https:\/\/[^\s"'<>]+$/.test(ctaUrl)) return bad('The button link must start with https://');

  try {
    if (b.action === 'test') {
      const to = String(b.to || '').trim().toLowerCase();
      if (!EMAIL_RE.test(to)) return bad('Add the address to send the test to.');
      const r = await sendMail({ to, subject: '[Test] ' + fillForPreview(mail.subject, to), text: fillForPreview(mail.text, to), html: fillForPreview(mail.html, to), tags: [{ name: 'type', value: 'test' }] });
      if (!r.sent) return bad('Couldn’t send the test.', 502);
      return Response.json({ ok: true, test: true }, { headers: h });
    }
    if (b.action !== 'send') return bad('Unknown action.');
    const list = LISTS[b.list] ? b.list : 'subscribers';
    if (Date.now() - lastSend < 120_000) return bad('A campaign just went out. Wait a couple of minutes.', 429);
    let scheduledAt = '';
    if (b.scheduledAt) {
      const t = Date.parse(b.scheduledAt);
      if (!t || t < Date.now() + 60_000 || t > Date.now() + 30 * 86400_000) return bad('Pick a time between a minute and 30 days from now.');
      scheduledAt = new Date(t).toISOString();
    }
    lastSend = Date.now();
    const id = await sendCampaign({ template, fields: b.fields || {}, list, scheduledAt });
    return Response.json({ ok: true, id, scheduled: !!scheduledAt }, { headers: h });
  } catch (e) {
    console.error('marketing failed:', e && e.message);
    return bad('Resend didn’t accept it: ' + String((e && e.message) || 'unknown error').slice(0, 160), 502);
  }
}
