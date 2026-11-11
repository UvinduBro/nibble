'use client';
import '../../components/social/social.css';
import { useEffect, useRef, useState } from 'react';
import { getSocial } from '../../components/social/useSocial';
import { niceError } from '../../lib/social/social';
import PetFigure from '../../components/PetFigure';

// Desktop Google sign-in: the Nibble app opens this page in your normal browser
// (Google doesn't allow sign-in inside embedded app windows). After you sign in here,
// the Google ID token is posted straight to the app on 127.0.0.1 and nowhere else.
export default function LinkPage() {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('idle');
  const [err, setErr] = useState('');
  const form = useRef(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const port = Number(q.get('port'));
    const state = q.get('state') || '';
    if (Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[a-f0-9]{32}$/.test(state)) setInfo({ port, state });
    else setStatus('bad');
  }, []);

  const go = async () => {
    setErr('');
    setStatus('busy');
    try {
      const social = await getSocial();
      if (!social) throw new Error('Nibble Social isn’t switched on yet.');
      const token = await social.googleIdToken();
      if (!token) throw new Error('Google didn’t return a sign-in token. Try again.');
      form.current.g.value = token;
      setStatus('done');
      form.current.submit();
    } catch (e) {
      setErr(niceError(e));
      setStatus('idle');
    }
  };

  return (
    <div className="sa solo">
      <main className="sa-main">
        <div className="sa-center">
          <PetFigure skin="mojo" mood={status === 'done' ? 'dance' : 'wave'} w={160} h={150} />
          {status === 'bad' && <><h1>Open this from the Nibble app</h1><p className="sa-sub">In the Nibble Hub, pick “Continue with Google”. It brings you here with a one-time code.</p></>}
          {status !== 'bad' && status !== 'done' && (
            <>
              <h1>Sign in to the Nibble app</h1>
              <p className="sa-sub">Continue with Google here and you’ll be signed in on your desktop too.</p>
              <button className="sa-google" onClick={go} disabled={!info || status === 'busy'}>{status === 'busy' ? 'Waiting for Google…' : 'Continue with Google'}</button>
              {err && <p className="sa-msg err">{err}</p>}
            </>
          )}
          {status === 'done' && <><h1>Handing you back to Nibble…</h1><p className="sa-sub">You can close this tab once the app says you’re in.</p></>}
          {info && (
            <form ref={form} method="POST" action={`http://127.0.0.1:${info.port}/cb`} style={{ display: 'none' }}>
              <input name="state" defaultValue={info.state} />
              <input name="g" defaultValue="" />
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
