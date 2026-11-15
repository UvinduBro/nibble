// Sends contact-form messages to the team inbox through Spacemail SMTP.
// Needs these Vercel environment variables (Production):
//   SMTP_USER = hello@meetnibble.com
//   SMTP_PASS = the mailbox password
// Optional: SMTP_HOST (default mail.spacemail.com), SMTP_PORT (465), CONTACT_TO (default SMTP_USER).
import nodemailer from 'nodemailer';
import { CONTACT_TOPICS } from './reports';

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

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

export async function sendContactMail(r, { id, ip } = {}) {
  const t = getTransport();
  if (!t) return { sent: false, reason: 'not-configured' };
  const topic = (CONTACT_TOPICS.find(([k]) => k === r.cat) || [, 'Message'])[1];
  const from = process.env.SMTP_USER;
  const to = process.env.CONTACT_TO || from;
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

  await t.sendMail({
    from: { name: 'Nibble contact form', address: from },
    to,
    replyTo: r.name ? { name: oneLine(r.name), address: r.contact } : r.contact,
    subject, text, html,
    headers: { 'X-Nibble-Ref': id || '', 'X-Nibble-IP': ip || '' },
  });
  return { sent: true };
}
