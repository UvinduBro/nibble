'use client';
// Footer sign-up: "Get Nibble news by email" → /api/subscribe (Resend list, unsubscribe any time).
import { useState } from 'react';
import { track } from './Analytics';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [site, setSite] = useState(''); // honeypot
  const [state, setState] = useState(''); // '' | 'busy' | 'done' | error text
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const send = async (e) => {
    e.preventDefault();
    if (!ok || state === 'busy') return;
    setState('busy');
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), site }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Couldn’t sign you up right now.');
      setState('done'); track('newsletter_signup');
    } catch (x) { setState(x.message); }
  };
  if (state === 'done') return <p className="lp-news-done">You’re on the list 💌 We’ll only email when there’s something worth sharing.</p>;
  return (
    <form className="lp-news" onSubmit={send}>
      <b>Get Nibble news</b>
      <div className="lp-news-row">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" autoComplete="email" maxLength={120} />
        <button className="lp-btn" disabled={!ok || state === 'busy'}>{state === 'busy' ? '…' : 'Subscribe'}</button>
      </div>
      <input className="lp-hp" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} aria-hidden="true" name="site" />
      <small>{state && state !== 'busy' ? state : 'New pets and releases, a few times a month at most. Unsubscribe any time.'}</small>
    </form>
  );
}
