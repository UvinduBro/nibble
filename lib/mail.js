// Email for Nibble. Sends through Resend (https://resend.com, free: 3,000 emails a month, 100 a day)
// from the verified meetnibble.com domain; falls back to the Spacemail SMTP mailbox if Resend isn't
// set up or fails.
// Vercel environment variables (Production):
//   RESEND_API_KEY = re_…           sending key for meetnibble.com (Resend → API keys)
//   MAIL_FROM      = Nibble <no-reply@meetnibble.com>   (optional, this is the default)
//   RESEND_MARKETING_KEY, RESEND_SEGMENT_ID   subscribers + broadcasts (lib/marketing.js)
//   CONTACT_TO     = where contact-form messages go (default hello@meetnibble.com)
//   SMTP_USER / SMTP_PASS (+ SMTP_HOST, SMTP_PORT)   the old Spacemail fallback, optional
import nodemailer from 'nodemailer';
import { CONTACT_TOPICS } from './reports';

export const DEFAULT_FROM = 'Nibble <no-reply@meetnibble.com>';
export const mailFrom = () => (process.env.MAIL_FROM || DEFAULT_FROM).trim();
export const contactTo = () => (process.env.CONTACT_TO || 'hello@meetnibble.com').trim();
export const resendReady = () => !!process.env.RESEND_API_KEY;
export const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

// one email through Resend's HTTP API (no extra package needed)
async function viaResend({ from, to, subject, text, html, replyTo, headers, tags }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}), ...(tags ? { tags } : {}) }),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('resend ' + r.status + ': ' + (j.message || j.name || 'failed'));
  return j.id || '';
}

// Send one email. → { sent: true, id, via } or { sent: false, reason }
export async function sendMail({ to, subject, text, html, replyTo, headers, tags, from = mailFrom() }) {
  if (resendReady()) {
    try { return { sent: true, id: await viaResend({ from, to, subject, text, html, replyTo, headers, tags }), via: 'resend' }; }
    catch (e) { console.error('resend failed:', e.message); if (!mailReady()) return { sent: false, reason: e.message }; }
  }
  const t = getTransport();
  if (!t) return { sent: false, reason: 'not-configured' };
  const info = await t.sendMail({ from: { name: 'Nibble', address: process.env.SMTP_USER }, to, replyTo, subject, text, html, headers });
  return { sent: true, id: info && info.messageId, via: 'smtp' };
}

let transport;
function getTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.spacemail.com',
      port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
  }
  return transport;
}

export const mailReady = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
export const anyMail = () => resendReady() || mailReady();

export const addressOf = (f) => { const m = String(f).match(/<([^>]+)>/); return (m ? m[1] : String(f)).trim(); };
export const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

export async function sendContactMail(r, { id, ip } = {}) {
  if (!anyMail()) return { sent: false, reason: 'not-configured' };
  const topic = (CONTACT_TOPICS.find(([k]) => k === r.cat) || [, 'Message'])[1];
  const to = contactTo();
  const who = oneLine(r.name) || r.contact;
  const subject = `[Nibble · ${topic}] ${oneLine(r.title) || 'New message'} — ${who}`.slice(0, 160);
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' });

  const text = [
    `New message from the meetnibble.com contact form`,
    ``,
    `Topic: ${topic}`,
    `Name: ${r.name || '—'}`,
    `Email: ${r.contact}`,
    r.title ? `Subject: ${r.title}` : '',
    ``,
    r.text,
    ``,
    `—`,
    `Sent ${when} (Sri Lanka time) · ref ${id || '—'}`,
    `Just hit Reply to answer them.`,
  ].filter((l) => l !== '').join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1a1a1a">
  <p style="margin:0 0 14px;font-size:13px;color:#666">New message from the meetnibble.com contact form</p>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:3px 14px 3px 0;color:#666">Topic</td><td><b>${esc(topic)}</b></td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#666">Name</td><td>${esc(r.name) || '—'}</td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#666">Email</td><td><a href="mailto:${esc(r.contact)}">${esc(r.contact)}</a></td></tr>
    ${r.title ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Subject</td><td>${esc(r.title)}</td></tr>` : ''}
  </table>
  <div style="font-size:15px;line-height:1.55;white-space:pre-wrap;padding:14px 16px;background:#f5f5f7;border-radius:10px">${esc(r.text)}</div>
  <p style="margin:16px 0 0;font-size:12px;color:#888">Sent ${esc(when)} (Sri Lanka time) · ref ${esc(id || '—')}<br>Hit Reply to answer them directly.</p>
</div>`;

  return sendMail({
    from: 'Nibble contact form <' + addressOf(mailFrom()) + '>',
    to,
    replyTo: r.name ? `${oneLine(r.name).replace(/[<>"]/g, '')} <${r.contact}>` : r.contact,
    subject, text, html,
    headers: { 'X-Nibble-Ref': id || '' },
    tags: [{ name: 'type', value: 'contact' }],
  });
}

// A message from the team (admin dashboard → Email): plain text in, a simple branded email out.
export function teamEmail({ subject, message }) {
  const text = `${message}\n\n—\nThe Nibble team · meetnibble.com\nJust reply to this email to reach us.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <div style="padding:18px 0 10px;font-size:20px;font-weight:800;color:#12131c">Nibble <span style="font-size:18px">(◕‿◕)</span></div>
  <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>
  <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#888">The Nibble team · <a href="https://meetnibble.com" style="color:#888">meetnibble.com</a><br>Just reply to this email to reach us.</p>
</div>`;
  return { subject: oneLine(subject).slice(0, 160), text, html };
}
