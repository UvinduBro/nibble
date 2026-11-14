'use client';
// Website version of the feedback form: no sign-in, sends to /api/feedback.
import FeedbackForm from '../social/Feedback';

async function send(report) {
  const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) { const e = new Error(j.error || 'Couldn’t send that right now. Try again in a minute.'); e.friendly = e.message; throw e; }
}

export default function SiteFeedback({ version }) {
  return <FeedbackForm mode="feedback" meta={{ client: 'site', page: 'website', ver: '' }} send={send} askContact theme="site" key={version} />;
}
