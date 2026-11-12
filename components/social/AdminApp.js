'use client';
import './social.css';
import { useEffect, useRef, useState } from 'react';
import { useSocial } from './useSocial';
import { AuthScreen } from './Auth';
import { niceError } from '../../lib/social/social';

function Toast({ note, onDone }) {
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => { if (!note) return; const t = setTimeout(() => done.current(), 3000); return () => clearTimeout(t); }, [note]);
  if (!note) return null;
  return <div className={'sa-toast' + (note.err ? ' err' : '')}>{note.text}</div>;
}

function Dashboard({ social, state }) {
  const [users, setUsers] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState(null);
  const [q, setQ] = useState('');
  const toast = (n) => setNote(n);
  useEffect(() => social.admin.watchUsers(setUsers), [social]);

  const send = async (e) => {
    e.preventDefault();
    try { await social.admin.broadcast(title, body); toast({ text: 'Announcement sent to everyone' }); setBody(''); setTitle(''); }
    catch (x) { toast({ err: true, text: niceError(x) }); }
  };
  const clearBc = async () => { await social.admin.clearBroadcast(); toast({ text: 'Announcement cleared' }); };
  const remove = async (u) => {
    if (!confirm('Remove @' + u.username + '? This deletes their profile.')) return;
    try { await social.admin.removeUser(u.uid, u.username); toast({ text: 'Removed @' + u.username }); }
    catch (x) { toast({ err: true, text: niceError(x) }); }
  };

  const list = users || [];
  const online = list.filter((u) => u.online).length;
  const shown = q ? list.filter((u) => u.username.toLowerCase().includes(q.toLowerCase())) : list;

  return (
    <div className="sa-main" style={{ margin: '0 auto' }}>
      <div className="sa-page">
        <h2>⚙️ Nibble Admin</h2>
        <div className="sa-stats">
          <div className="sa-stat"><b>{users ? list.length : '—'}</b><span>users</span></div>
          <div className="sa-stat"><b>{users ? online : '—'}</b><span>online now</span></div>
          <div className="sa-stat"><b>{state.broadcast ? 'on' : 'off'}</b><span>announcement</span></div>
        </div>

        <div className="sa-card">
          <h3>📣 Send an announcement</h3>
          <p className="sa-sub">Everyone signed in sees a banner. Desktop users also get a Windows notification.</p>
          <form className="sa-form" onSubmit={send}>
            <label>Title (optional) <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Heads up!" /></label>
            <label>Message <input value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} placeholder="New update is live — reinstall to get it." /></label>
            <div className="sa-inline" style={{ margin: 0 }}>
              <button className="btn" disabled={!body.trim()}>Send to everyone</button>
              {state.broadcast && <button type="button" className="btn small ghost" onClick={clearBc}>Clear current</button>}
            </div>
          </form>
          {state.broadcast && <p className="sa-sub" style={{ marginTop: 10 }}>Live now: <b>{state.broadcast.title ? state.broadcast.title + ' — ' : ''}{state.broadcast.text}</b></p>}
        </div>

        <div className="sa-card">
          <h3>People <small>{users ? list.length : '…'}</small></h3>
          <div className="sa-inline" style={{ marginTop: 0 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username…" />
          </div>
          {!users && <p className="sa-empty">Loading…</p>}
          {users && shown.length === 0 && <p className="sa-empty">No users found.</p>}
          {shown.map((u) => (
            <div key={u.uid} className="sa-friend">
              <div className="sa-friend-main">
                <b>@{u.username}</b>
                <small>
                  <span className={'sa-dot' + (u.online ? ' on' : '')} />
                  {u.online ? 'online' : 'offline'}{u.petName ? ` · ${u.petName}` : ''}{u.status ? ` · “${u.status}”` : ''}
                </small>
              </div>
              <button className="sa-x" title="Remove user" onClick={() => remove(u)}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <Toast note={note} onDone={() => setNote(null)} />
    </div>
  );
}

export default function AdminApp() {
  const { social, state, missing } = useSocial();
  if (missing) return <div className="sa solo"><div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">The backend isn’t configured yet.</p></div></div>;
  if (!social || !state.ready) return <div className="sa solo"><div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Loading…</p></div></div>;

  let inner;
  if (!state.user) inner = <div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Sign in to continue.</p><div style={{ maxWidth: 380, width: '100%' }}><AuthScreen social={social} /></div></div>;
  else if (!state.profile) inner = <div className="sa-center"><h1>Nibble Admin</h1><p className="sa-sub">Finish setting up your account in the <a className="sa-link" href="/app">Nibble app</a> first.</p></div>;
  else if (!state.admin) inner = (
    <div className="sa-center">
      <h1>Not an admin</h1>
      <p className="sa-sub">Your account isn’t an admin yet. To become one, add a document in Firestore:<br />collection <b>admins</b> → document ID = your UID below → any field.</p>
      <code className="sa-copy" style={{ userSelect: 'all' }}>{state.user.uid}</code>
      <p className="sa-sub" style={{ marginTop: 10 }}><button className="btn small ghost" onClick={() => social.signOut()}>Sign out</button></p>
    </div>
  );
  else return <div className="sa solo"><Dashboard social={social} state={state} /></div>;

  return <div className="sa solo">{inner}</div>;
}
