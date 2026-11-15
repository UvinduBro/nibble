'use client';
// Contact form on the website: lands in the admin dashboard's Reports inbox (kind "contact").
import { useState } from 'react';
import { CONTACT_TOPICS } from '../../lib/reports';
import { track } from './Analytics';

export default function ContactForm() {
  const [f, setF] = useState({ name: '', email: '', topic: 'general', subject: '', message: '', site: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ok = f.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()) && f.message.trim().length >= 4;
  const send = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'contact', cat: f.topic, name: f.name.trim(), contact: f.email.trim(), title: f.subject.trim() || (CONTACT_TOPICS.find(([k]) => k === f.topic) || [, ''])[1], text: f.message.trim(), client: 'site', page: 'contact', site: f.site }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Couldn’t send that right now. Try again in a minute.');
      setDone(true); track('contact_submit', { topic: f.topic });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (done) {
    return (
      <div className="ct-done" role="status">
        <span aria-hidden>📬</span>
        <b>Thanks, {f.name.trim().split(' ')[0]}! Your message reached us.</b>
        <p>We usually reply within a couple of days, to {f.email.trim()}.</p>
        <button type="button" className="lp-btn ghost" onClick={() => { setDone(false); setF((x) => ({ ...x, subject: '', message: '' })); }}>Send another</button>
      </div>
    );
  }
  return (
    <form className="ct" onSubmit={send}>
      <div className="ct-two">
        <label><span>Your name</span><input value={f.name} onChange={set('name')} maxLength={60} autoComplete="name" required /></label>
        <label><span>Email</span><input type="email" value={f.email} onChange={set('email')} maxLength={100} autoComplete="email" required /></label>
      </div>
      <fieldset className="ct-topics"><legend>What’s it about?</legend>
        {CONTACT_TOPICS.map(([k, l]) => <label key={k} className={f.topic === k ? 'on' : ''}><input type="radio" name="topic" value={k} checked={f.topic === k} onChange={set('topic')} />{l}</label>)}
      </fieldset>
      <label><span>Subject <small>optional</small></span><input value={f.subject} onChange={set('subject')} maxLength={80} /></label>
      <label><span>Message</span><textarea rows={5} value={f.message} onChange={set('message')} maxLength={2000} required /></label>
      <input className="fb-hp" tabIndex={-1} autoComplete="off" aria-hidden name="website" value={f.site} onChange={set('site')} />
      {err && <p className="ct-err" role="alert">{err}</p>}
      <div className="ct-foot">
        <button className="lp-btn" disabled={!ok || busy}>{busy ? 'Sending…' : 'Send message'}</button>
        <small>Goes straight to <a href="mailto:hello@meetnibble.com">hello@meetnibble.com</a>. We only use your email to reply. See our <a href="/privacy">privacy policy</a>.</small>
      </div>
    </form>
  );
}
