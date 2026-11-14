'use client';
// "Report a bug" + "Tell us what you think", shared by the Nibble Hub and the public website.
// Version, system and time are filled in automatically. A screenshot is optional: pick a file or
// paste one (Ctrl+V); it's shrunk to a small JPEG before sending.
import { useEffect, useRef, useState } from 'react';
import './feedback.css';

export const FEEDBACK_CATS = [
  ['like', '💚 Something I like'],
  ['dislike', '😕 Something I don’t like'],
  ['feature', '✨ A feature I want'],
  ['idea', '💡 An idea to make it better'],
  ['problem', '🧩 A problem I had'],
];
const MAX_SHOT = 600_000; // characters of base64; keeps the whole report well under Firestore's 1 MB

export function systemName(platform) {
  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') return 'Windows';
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  const win = ua.match(/Windows NT (\d+\.\d+)/);
  if (win) return 'Windows' + (win[1] === '10.0' ? ' 10/11' : ' ' + win[1]);
  if (/Mac OS X/.test(ua)) return /iPhone|iPad/.test(ua) ? 'iOS' : 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

// Shrink an image file to a JPEG data URL that fits in a report.
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('That isn’t an image.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      let out = '';
      for (const [max, q] of [[1400, 0.72], [1100, 0.62], [900, 0.55], [700, 0.5], [520, 0.45]]) {
        const s = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length <= MAX_SHOT) break;
      }
      URL.revokeObjectURL(url);
      if (out.length > MAX_SHOT) reject(new Error('That screenshot is too big. Try a smaller one.'));
      else resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Couldn’t read that image.')); };
    img.src = url;
  });
}

/**
 * props:
 *  mode: 'bug' | 'feedback' (initial tab)
 *  meta: { ver, os, client } filled in automatically
 *  send: async (report) => void
 *  askContact: show an optional "email or @username" field (website)
 *  theme: 'hub' | 'site'
 */
export default function FeedbackForm({ mode = 'bug', meta = {}, send, askContact = false, theme = 'hub', signedInAs = '' }) {
  const [tab, setTab] = useState(mode);
  const [f, setF] = useState({ title: '', what: '', doing: '', expected: '', actual: '', text: '', cat: 'idea', contact: '', site: '' });
  const [shot, setShot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const fileRef = useRef(null);
  const [os, setOs] = useState(meta.os || '');   // worked out in the browser (the server can't know it)
  useEffect(() => { if (!meta.os) setOs(systemName()); }, [meta.os]);
  useEffect(() => setTab(mode), [mode]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const takeFile = async (file) => {
    setErr('');
    try { setShot(await shrinkImage(file)); } catch (e) { setErr(e.message); }
  };
  const onPaste = (e) => {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type && i.type.startsWith('image/'));
    if (item) { e.preventDefault(); takeFile(item.getAsFile()); }
  };

  const ready = tab === 'bug' ? f.what.trim().length >= 4 : f.text.trim().length >= 4;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setErr('');
    const base = { kind: tab, ver: meta.ver || '', os: os || systemName(), client: meta.client || '', page: meta.page || '', contact: f.contact.trim(), site: f.site };
    const report = tab === 'bug'
      ? { ...base, title: f.title.trim() || f.what.trim().slice(0, 60), what: f.what.trim(), doing: f.doing.trim(), expected: f.expected.trim(), actual: f.actual.trim(), shot }
      : { ...base, cat: f.cat, title: f.text.trim().replace(/\s+/g, ' ').slice(0, 70), text: f.text.trim(), shot };
    try {
      await send(report);
      setDone(tab === 'bug' ? 'Thanks! Your bug report reached us. We’ll look into it.' : 'Thanks! We read every message.');
      setF({ title: '', what: '', doing: '', expected: '', actual: '', text: '', cat: f.cat, contact: f.contact, site: '' });
      setShot('');
    } catch (x) {
      setErr((x && (x.friendly || x.message)) || 'Couldn’t send that. Try again in a minute.');
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className={'fb fb-' + theme}>
        <div className="fb-done">
          <span aria-hidden>🐾</span>
          <b>{done}</b>
          <button type="button" className="fb-btn ghost" onClick={() => setDone('')}>Send another</button>
        </div>
      </div>
    );
  }

  return (
    <form className={'fb fb-' + theme} onSubmit={submit} onPaste={onPaste}>
      <div className="fb-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'bug'} className={tab === 'bug' ? 'on' : ''} onClick={() => setTab('bug')}>🐛 Report a bug</button>
        <button type="button" role="tab" aria-selected={tab === 'feedback'} className={tab === 'feedback' ? 'on' : ''} onClick={() => setTab('feedback')}>💬 Tell us what you think</button>
      </div>

      {tab === 'bug' ? (
        <>
          <label className="fb-f"><span>What happened? <em>required</em></span>
            <textarea rows={3} maxLength={1000} value={f.what} onChange={set('what')} placeholder="e.g. My pet froze on top of a window and I couldn’t drag it" /></label>
          <label className="fb-f"><span>What were you doing when it happened?</span>
            <textarea rows={2} maxLength={1000} value={f.doing} onChange={set('doing')} placeholder="e.g. Playing music in a room, then I locked my PC" /></label>
          <div className="fb-two">
            <label className="fb-f"><span>What did you expect?</span>
              <textarea rows={2} maxLength={1000} value={f.expected} onChange={set('expected')} placeholder="e.g. To pick it up and throw it" /></label>
            <label className="fb-f"><span>What happened instead?</span>
              <textarea rows={2} maxLength={1000} value={f.actual} onChange={set('actual')} placeholder="e.g. Nothing, clicks went through it" /></label>
          </div>
        </>
      ) : (
        <>
          <div className="fb-cats" role="radiogroup" aria-label="What is it about?">
            {FEEDBACK_CATS.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={f.cat === k} className={f.cat === k ? 'on' : ''} onClick={() => setF((x) => ({ ...x, cat: k }))}>{l}</button>)}
          </div>
          <label className="fb-f"><span>Tell us <em>required</em></span>
            <textarea rows={4} maxLength={2000} value={f.text} onChange={set('text')} placeholder={f.cat === 'feature' ? 'e.g. Shared reminders with friends' : f.cat === 'like' ? 'e.g. The music rooms!' : 'Anything at all'} /></label>
        </>
      )}

      <div className="fb-shot">
        {shot ? (
          <div className="fb-shot-prev"><img src={shot} alt="Your screenshot" /><button type="button" className="fb-btn ghost small" onClick={() => setShot('')}>Remove</button></div>
        ) : (
          <button type="button" className="fb-btn ghost small" onClick={() => fileRef.current && fileRef.current.click()}>📎 Add a screenshot <small>(optional, or paste one)</small></button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) takeFile(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {askContact && (
        <label className="fb-f"><span>Email or Nibble username <small>optional, only if you’d like a reply</small></span>
          <input maxLength={100} value={f.contact} onChange={set('contact')} placeholder="you@example.com or @username" /></label>
      )}
      <input className="fb-hp" tabIndex={-1} autoComplete="off" aria-hidden value={f.site} onChange={set('site')} name="website" />

      <p className="fb-meta">
        Sent with: {[meta.ver ? 'Nibble ' + meta.ver : '', os, meta.client === 'desktop' ? 'desktop app' : meta.client === 'site' ? 'website' : meta.client ? meta.client : '', 'the time now', signedInAs ? '@' + signedInAs : ''].filter(Boolean).join(', ')}.
      </p>
      {err && <p className="fb-err" role="alert">{err}</p>}
      <button className="fb-btn" disabled={!ready || busy}>{busy ? 'Sending…' : tab === 'bug' ? 'Send bug report' : 'Send feedback'}</button>
    </form>
  );
}
