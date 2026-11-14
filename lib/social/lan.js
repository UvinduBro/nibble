// "People on your network": signed-in Nibble users behind the same internet connection (same Wi-Fi,
// office or home router) can find each other and send friend requests.
//
// lan/{netId}/members/{uid} = { username, petName, skin, style, at }
// netId comes from /api/netid: a salted one-way hash of the public IP (the IP is never stored).
// Anyone can switch it off ("Let people on my network find me").
const FRESH_MS = 15 * 60_000;
const BEAT_MS = 4 * 60_000;
const NET_CHECK_MS = 10 * 60_000;

export function createLan({ db, state, emit, serverNow, store }) {
  let net = '', unwatch = null, beat = null, netTimer = null, on = false;
  const key = () => 'nibble-lan-' + (state.user ? state.user.uid : '');
  state.lan = { on: true, net: '', people: [] };
  const me = () => state.user && state.user.uid;
  const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);

  function write() {
    if (!net || !me() || !state.profile || state.banned) return;
    const pr = state.profile;
    db.set(`lan/${net}/members/${me()}`, {
      username: pr.username, petName: String(pr.petName || '').slice(0, 20), skin: String(pr.skin || 'mint').slice(0, 20),
      style: pr.style && typeof pr.style === 'object' ? { sp: String(pr.style.sp || ''), of: String(pr.style.of || ''), oc: String(pr.style.oc || ''), sk: '' } : { sp: '', of: '', oc: '', sk: '' },
      at: db.now(),
    }).catch(() => {});
  }
  function remove(n = net) { if (n && me()) db.del(`lan/${n}/members/${me()}`).catch(() => {}); }
  function listen() {
    unwatch && unwatch();
    if (!net) { state.lan = { ...state.lan, people: [] }; emit(); return; }
    unwatch = db.watchCol(`lan/${net}/members`, null, (list) => {
      const now = serverNow();
      state.lan = {
        ...state.lan, net,
        people: list.filter((d) => d.id !== me() && d.data && now - ms(d.data.at) < FRESH_MS)
          .map((d) => ({ uid: d.id, username: d.data.username, petName: d.data.petName || '', skin: d.data.skin || 'mint', style: d.data.style || null }))
          .sort((a, b) => a.username.localeCompare(b.username)),
      };
      emit();
    }, () => { state.lan = { ...state.lan, people: [] }; emit(); });
  }
  async function checkNet() {
    if (!on || typeof fetch === 'undefined') return;
    try {
      const r = await fetch('/api/netid', { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      const n = d && /^[a-f0-9]{8,40}$/.test(d.net || '') ? d.net : '';
      if (n !== net) { remove(); net = n; listen(); }
      write();
    } catch { /* offline: try again later */ }
  }
  function start() {
    stop();
    on = store.get(key(), true) !== false;
    state.lan = { on, net: '', people: [] };
    if (!on) { emit(); return; }
    checkNet();
    const loop = () => { beat = setTimeout(() => { write(); loop(); }, state.config && state.config.saver ? 3 * BEAT_MS : BEAT_MS); };
    loop();
    netTimer = setInterval(checkNet, NET_CHECK_MS);
  }
  function stop() {
    unwatch && unwatch(); unwatch = null;
    clearTimeout(beat); clearInterval(netTimer); beat = netTimer = null;
    net = '';
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => remove());

  return {
    _start: start,
    _stop: () => { remove(); stop(); },
    refresh: checkNet,
    setOn(v) {
      store.set(key(), !!v);
      if (!v) { remove(); stop(); on = false; state.lan = { on: false, net: '', people: [] }; emit(); }
      else start();
    },
  };
}
