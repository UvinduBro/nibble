// window.nibbleMobile: the bridge between the web app (/m) and the Nibble phone app (Flutter, `mobile/`).
//
// The phone app loads https://meetnibble.com/m in a WebView, adds a JavaScript channel called
// `NibbleMobile`, and puts "NibbleMobile/<version> (<ios|android>)" at the end of the user agent.
// Web → app: NibbleMobile.postMessage(JSON { id?, type, ...data })
// App → web: window.__nibbleMobileIn({ id, result } | { id, error } | { event, value })
// Everything the app sends back is treated as untrusted data (only known event names, plain values).

const UA = /NibbleMobile\/([\d.]+) \((ios|android)\)/;

export function getMobileBridge() {
  if (typeof window === 'undefined') return null;
  if (window.nibbleMobile) return window.nibbleMobile;
  const m = (navigator.userAgent || '').match(UA);
  const chan = window.NibbleMobile;
  if (!m || !chan || typeof chan.postMessage !== 'function') return null;

  let seq = 0;
  const waiting = new Map(); // id → { ok, fail, timer }
  const subs = { tab: new Set(), visible: new Set(), back: new Set() };
  const post = (msg) => { try { chan.postMessage(JSON.stringify(msg)); } catch {} };
  const ask = (type, data = {}, ms = 5 * 60_000) => new Promise((ok, fail) => {
    const id = 'q' + (++seq);
    const timer = setTimeout(() => { waiting.delete(id); fail(new Error('The app didn’t answer. Try again.')); }, ms);
    waiting.set(id, { ok, fail, timer });
    post({ id, type, ...data });
  });

  window.__nibbleMobileIn = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.id && waiting.has(msg.id)) {
      const w = waiting.get(msg.id); waiting.delete(msg.id); clearTimeout(w.timer);
      if (msg.error) w.fail(Object.assign(new Error(String(msg.error)), { friendly: String(msg.error) }));
      else w.ok(msg.result == null ? null : msg.result);
      return;
    }
    const set = subs[msg.event];
    if (set) for (const cb of set) { try { cb(msg.value); } catch {} }
  };
  const on = (name) => (cb) => { subs[name].add(cb); return () => subs[name].delete(cb); };

  const bridge = {
    platform: m[2],          // 'ios' | 'android'
    appVersion: m[1],
    // Google sign-in happens in the phone's browser (Google blocks it inside app WebViews):
    // the app opens /link?app=mobile and gets the Google ID token back.
    googleSignIn: () => ask('google').then((t) => (typeof t === 'string' ? t : '')),
    notify: ({ title, body, tab } = {}) => post({ type: 'notify', title: String(title || 'Nibble').slice(0, 80), body: String(body || '').slice(0, 200), tab: String(tab || '') }),
    // the native tab bar: which pages exist, which one is open, and the little red numbers
    setTabs: (tabs) => post({ type: 'tabs', tabs }),
    setCurrent: (tab) => post({ type: 'current', tab }),
    setBadges: (badges) => post({ type: 'badges', badges }),
    openExternal: (url) => post({ type: 'open', url: String(url) }),
    share: ({ text, url } = {}) => post({ type: 'share', text: String(text || ''), url: String(url || '') }),
    haptic: (kind = 'light') => post({ type: 'haptic', kind }),
    signedOut: () => post({ type: 'signedOut' }),
    onTab: on('tab'),
    onVisible: on('visible'),
    onBack: on('back'),
  };
  window.nibbleMobile = bridge;
  post({ type: 'ready' });
  return bridge;
}
