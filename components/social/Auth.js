'use client';
import { useEffect, useMemo, useState } from 'react';
import PetFigure from '../PetFigure';
import { CHARACTERS, byKey } from '../../lib/characters';
import { NAME_RE, niceError } from '../../lib/social/social';
import { SOURCES, USES, countries, guessCountry, flag } from '../../lib/signup';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export function AuthScreen({ social, desktop }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ err: true, text: niceError(e) }); }
    setBusy(false);
  };
  const submit = (e) => {
    e.preventDefault();
    run(() => (mode === 'up' ? social.signUp(email, pw) : social.signIn(email, pw)));
  };
  const google = () => run(async () => {
    if (desktop) {
      setMsg({ text: 'Finish signing in with Google in your browser…' });
      const token = await desktop.googleSignIn();
      if (!token) throw Object.assign(new Error('Google sign-in was cancelled.'), { friendly: 'Google sign-in was cancelled.' });
      await social.googleWithToken(token);
    } else await social.google();
  });
  const reset = () => {
    if (!email) return setMsg({ err: true, text: 'Type your email above first.' });
    run(async () => { await social.resetPassword(email); setMsg({ text: 'Reset link sent. Check your inbox.' }); });
  };

  return (
    <div className="sa-auth">
      <div className="sa-auth-art">
        <PetFigure skin="mojo" mood="wave" w={150} h={150} />
        <PetFigure skin="mint" mood="happy" w={110} h={120} />
        <PetFigure skin="kumo" mood="dance" w={130} h={140} />
      </div>
      <h1>{mode === 'up' ? 'Make your Nibble account' : 'Welcome back'}</h1>
      <p className="sa-sub">Pick a username, add friends, and your pets visit each other’s desktops. Hold a pet to say hi.</p>
      <button className="sa-google" onClick={google} disabled={busy}><GoogleG /> Continue with Google</button>
      <div className="sa-or"><span>or with email</span></div>
      <form onSubmit={submit} className="sa-form">
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required /></label>
        <button className="btn" disabled={busy}>{busy ? 'One sec…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      </form>
      {msg && <p className={'sa-msg' + (msg.err ? ' err' : '')}>{msg.text}</p>}
      <p className="sa-switch">
        {mode === 'up' ? <>Have an account? <button onClick={() => setMode('in')}>Sign in</button></> : <>New here? <button onClick={() => setMode('up')}>Create an account</button> · <button onClick={reset}>Forgot password</button></>}
      </p>
    </div>
  );
}

export function CharacterGrid({ value, onPick, compact }) {
  return (
    <div className={'sa-chars' + (compact ? ' compact' : '')}>
      {CHARACTERS.map((c) => (
        <button key={c.key} type="button" className={'sa-char' + (value === c.key ? ' on' : '')} onClick={() => onPick(c.key)} title={`${c.name} · ${c.role}`}>
          <PetFigure skin={c.key} mood={value === c.key ? 'happy' : 'idle'} w={compact ? 76 : 92} h={compact ? 80 : 96} size={compact ? 0.62 : 0.72} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export function SignupQuestions({ value, onChange, compact }) {
  const list = useMemo(() => countries(), []);
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  return (
    <div className={'sa-sq' + (compact ? ' compact' : '')}>
      <h3>How did you find Nibble?</h3>
      <div className="sa-sq-chips">
        {SOURCES.map(([k, l]) => <button type="button" key={k} className={v.source === k ? 'on' : ''} onClick={() => set({ source: k })}>{l}</button>)}
      </div>
      {v.source === 'other' && <input className="sa-sq-other" value={v.sourceOther} maxLength={60} onChange={(e) => set({ sourceOther: e.target.value })} placeholder="Where? (optional)" />}
      <label className="sa-sq-row"><span>Where are you from?</span>
        <select value={v.country} onChange={(e) => set({ country: e.target.value })}>
          <option value="">Pick your country</option>
          {list.map(([c, n]) => <option key={c} value={c}>{flag(c)} {n}</option>)}
        </select>
      </label>
      <div className="sa-sq-row"><span>What will you use it for? <small>pick any</small></span>
        <div className="sa-sq-chips small">
          {USES.map(([k, l]) => <button type="button" key={k} className={v.uses.includes(k) ? 'on' : ''} onClick={() => set({ uses: v.uses.includes(k) ? v.uses.filter((x) => x !== k) : [...v.uses, k] })}>{l}</button>)}
        </div>
      </div>
    </div>
  );
}

export function Onboard({ social, state, initialSkin }) {
  const [name, setName] = useState('');
  const [skin, setSkin] = useState(initialSkin || 'mojo');
  const [petName, setPetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sq, setSq] = useState({ source: '', sourceOther: '', country: '', uses: [] });
  useEffect(() => { setSq((x) => (x.country ? x : { ...x, country: guessCountry() })); }, []);
  const clean = name.trim().toLowerCase().replace(/^@/, '');
  const ok = NAME_RE.test(clean) && !!sq.source && !!sq.country;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await social.claimUsername(clean, { skin, petName: petName || byKey[skin]?.name || 'Nibble' });
      social.saveSignup(sq).catch(() => {}); // never blocks getting in
    }
    catch (x) { setErr(niceError(x)); }
    setBusy(false);
  };

  return (
    <form className="sa-onboard" onSubmit={submit}>
      <h1>Claim your username</h1>
      <p className="sa-sub">Friends add you with this. Signed in as {state.user?.email || 'you'} · <button type="button" className="sa-link" onClick={() => social.signOut()}>switch account</button></p>
      <div className="sa-handle">
        <span>@</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, ''))} placeholder="yourname" maxLength={21} aria-label="Username" />
        <em className={clean ? (ok ? 'good' : 'bad') : ''}>{!clean ? '3–20 letters, numbers, _' : ok ? 'looks good' : 'letters, numbers, _ only'}</em>
      </div>
      <h3>Pick the pet your friends will see</h3>
      <CharacterGrid value={skin} onPick={setSkin} compact />
      <label className="sa-inline">Pet name <input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder={byKey[skin]?.name || 'Nibble'} maxLength={20} /></label>
      <SignupQuestions value={sq} onChange={setSq} />
      {err && <p className="sa-msg err">{err}</p>}
      {!ok && NAME_RE.test(clean) && <p className="sa-sub">{!sq.source ? 'Tell us how you found Nibble' : 'Pick your country'} to continue.</p>}
      <button className="btn big" disabled={!ok || busy}>{busy ? 'Claiming…' : `Let’s go, @${clean || 'you'}`}</button>
    </form>
  );
}
