'use client';
// Phones in a browser / the installed web app (PWA): an app-style bottom tab bar
// (Home, Friends, Messages, Groups, More) and a "More" sheet with everything else.
// Not used in the desktop Hub or inside the phone app (that one draws native tabs).
import { useEffect, useState } from 'react';
import Emo from '../Emo';
import { canPrompt, disablePush, enablePush, isIOS, isStandalone, onInstallChange, promptInstall, pushState, pushSupported } from '../../lib/pwa';

const MAIN = ['home', 'friends', 'messages', 'groups'];

export function PhoneTabs({ items, tab, go, badge }) {
  const [more, setMore] = useState(false);
  const byKey = Object.fromEntries(items.map((x) => [x[0], x]));
  const rest = items.filter(([k]) => !MAIN.includes(k));
  const moreOn = !MAIN.includes(tab);
  const moreBadge = rest.some(([k]) => badge(k));
  useEffect(() => { setMore(false); }, [tab]);
  return (
    <>
      <nav className="pt-bar" aria-label="App">
        {MAIN.filter((k) => byKey[k]).map((k) => {
          const [, l, i] = byKey[k];
          const b = badge(k);
          return (
            <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
              <span><Emo k={i} size={24} />{b ? <em>{b === true ? '' : b}</em> : null}</span><b>{l}</b>
            </button>
          );
        })}
        <button className={moreOn || more ? 'on' : ''} aria-expanded={more} onClick={() => setMore(!more)}>
          <span><i className="pt-dots" aria-hidden><i /><i /><i /></i>{moreBadge ? <em /> : null}</span><b>More</b>
        </button>
      </nav>
      {more && (
        <div className="pt-sheet-wrap" onClick={() => setMore(false)}>
          <div className="pt-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <i className="pt-grab" aria-hidden />
            <div className="pt-grid">
              {rest.map(([k, l, i]) => {
                const b = badge(k);
                return (
                  <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>
                    <span><Emo k={i} size={30} />{b ? <em>{b === true ? '' : b}</em> : null}</span><b>{l}</b>
                  </button>
                );
              })}
            </div>
            <InstallCard compact />
            <a className="pt-desk" href="/download">💻 Get Nibble for your computer</a>
          </div>
        </div>
      )}
    </>
  );
}

// "Add Nibble to your home screen": the browser's install button (Android, Chrome, Edge) or the
// Share → Add to Home Screen steps on iPhone. Hidden once installed or after "Not now".
export function InstallCard({ compact }) {
  const [, force] = useState(0);
  const [hide, setHide] = useState(true);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = !compact && Number(localStorage.getItem('nibble-install-later') || 0) > Date.now(); } catch {}
    setHide(isStandalone() || dismissed);
    return onInstallChange(() => force((n) => n + 1));
  }, [compact]);
  if (hide) return null;
  const ios = isIOS();
  if (!ios && !canPrompt()) return null; // this browser can't install (or already did)
  const later = () => { try { localStorage.setItem('nibble-install-later', String(Date.now() + 14 * 864e5)); } catch {} setHide(true); };
  return (
    <div className={'pt-install' + (compact ? ' compact' : '')}>
      <img src="/icons/app-192.png" alt="" width={52} height={52} />
      <div>
        <b>Add Nibble to your home screen</b>
        {steps && ios
          ? <small>Tap <span className="pt-share" aria-label="Share">⬆︎</span> Share at the bottom of Safari, then <b>Add to Home Screen</b>.</small>
          : <small>Open it like an app: full screen, one tap away.</small>}
      </div>
      <div className="pt-install-acts">
        <button className="btn small" onClick={() => (ios ? setSteps(true) : promptInstall())}>{ios ? 'How?' : 'Install'}</button>
        {!compact && <button className="pt-x" aria-label="Not now" onClick={later}>✕</button>}
      </div>
    </div>
  );
}

// ---------- push notifications (web app) ----------

function usePush() {
  const [st, setSt] = useState('');
  useEffect(() => { let on = true; pushState().then((v) => on && setSt(v), () => on && setSt('unsupported')); return () => { on = false; }; }, []);
  return [st, setSt];
}

// Home: "Get a notification when friends message you". Shows only where it can work and isn't on yet.
export function NotifyCard({ social, toast }) {
  const [st, setSt] = usePush();
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(true);
  useEffect(() => { try { setLater(Number(localStorage.getItem('nibble-push-later') || 0) > Date.now()); } catch { setLater(false); } }, []);
  if (st !== 'off' || later) return null;
  const turnOn = () => { setBusy(true); enablePush(social).then((v) => { setSt(v); toast({ text: '🔔 Notifications are on for this device' }); }, (e) => { setBusy(false); toast({ err: true, text: e.message }); }); };
  const hide = () => { try { localStorage.setItem('nibble-push-later', String(Date.now() + 14 * 864e5)); } catch {} setLater(true); };
  return (
    <div className="pt-install pt-push">
      <span className="pt-bell" aria-hidden>🔔</span>
      <div>
        <b>Know when friends message you</b>
        <small>Get a notification for new messages, group chats and @mentions.</small>
      </div>
      <div className="pt-install-acts">
        <button className="btn small" disabled={busy} onClick={turnOn}>{busy ? '…' : 'Turn on'}</button>
        <button className="pt-x" aria-label="Not now" onClick={hide}>✕</button>
      </div>
    </div>
  );
}

// Settings: the on/off switch for this device
export function PushSetting({ social, toast }) {
  const [st, setSt] = usePush();
  const [busy, setBusy] = useState(false);
  if (!st) return null;
  const flip = (v) => {
    setBusy(true);
    (v ? enablePush(social) : disablePush(social)).then((x) => { setSt(x); setBusy(false); toast({ text: x === 'on' ? '🔔 Notifications are on for this device' : 'Notifications are off for this device' }); },
      (e) => { setBusy(false); toast({ err: true, text: e.message }); });
  };
  const hint = st === 'unsupported'
    ? (isIOS() ? 'On iPhone: add Nibble to your home screen (Share → Add to Home Screen), open it from there, then turn this on.' : 'This browser can’t show notifications.')
    : st === 'denied' ? 'Blocked in your browser. Allow notifications for meetnibble.com in your browser or phone settings, then come back.'
      : 'New private messages, group chats and @mentions, even when Nibble is closed. Just for this device.';
  return (
    <label className={'sa-toggle' + (busy || st === 'unsupported' || st === 'denied' ? ' off' : '')}>
      <span><b>🔔 Notifications on this device</b><small>{hint}</small></span>
      <input type="checkbox" checked={st === 'on'} disabled={busy || st === 'unsupported' || st === 'denied'} onChange={(e) => flip(e.target.checked)} />
      <i />
    </label>
  );
}
export { pushSupported };
