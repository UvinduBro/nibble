// Nibble Social: accounts, usernames, friends, presence, "thinking…" + short messages, pokes.
// Pure JS over an adapter (firebaseAdapter / fakeAdapter). Used by the web app (/app) and the
// desktop Hub (/hub, which relays everything to the pets on your real desktop).
//
// Firestore layout (see firestore.rules):
//   usernames/{name}                 { uid }                          one doc per claimed name
//   users/{uid}                      { username, petName, skin, createdAt, updatedAt }
//   users/{uid}/friends/{fid}        { username, since }              both sides written on accept
//   requests/{from}_{to}             { from, to, fromName, toName, at }
//   presence/{uid}                   { online, lastSeen, username, petName, skin, status, dnd,
//                                      typing, typingAt, say: { id, text, at } }   friends-only read
//   inbox/{uid}/items/{id}           { from, fromName, kind, text, at }  pokes / whispers / emotes

export const MAX_TEXT = 80;
export const NAME_RE = /^[a-z0-9_]{3,20}$/;
export const EMOTES = { wave: '👋', hug: '🤗', kiss: '😘', heart: '❤️', poke: '👉', highfive: '🙌', tickle: '🤭', cheer: '🎉', dance: '🎶', snack: '🍪', visit: '🏠' };
// what the receiver's pet says: "@wagee <verb>"
export const EMOTE_TEXT = { wave: 'waves at you', hug: 'gave you a big cuddle', kiss: 'sent you a smooch', heart: 'sent you a heart', poke: 'poked you!', highfive: 'wants a high five', tickle: 'is tickling you', cheer: 'is cheering you on', dance: 'wants to dance', snack: 'shared a snack', visit: 'came to visit you!' };
// what the SENDER's pet says when it delivers an action on your desktop
export const EMOTE_SAY = { wave: 'hi there! 👋', hug: 'cuddle time! 🤗', kiss: 'mwah! 😘', heart: '❤️ ❤️ ❤️', poke: 'poke! 👉', highfive: 'high five! 🙌', tickle: 'tickle tickle 🤭', cheer: 'you got this! 🎉', dance: "let's dance! 🎶", snack: 'brought you a cookie 🍪', visit: 'hi! just visiting 👋' };
export const MSG_TTL = 30 * 60_000; // chat history disappears after 30 minutes
const ONLINE_MS = 150_000;
const TYPING_MS = 12_000;
const BEAT_MS = 60_000;

export const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const cleanText = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

const ERRORS = {
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account with that email yet. Create one?',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/invalid-email': 'That email doesn\'t look right.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups and try again.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'Can\'t reach the server. Check your internet.',
  'auth/unauthorized-domain': 'This site isn\'t on the Firebase authorized domains list yet.',
  'auth/operation-not-allowed': 'This sign-in method isn\'t switched on in Firebase yet.',
  'permission-denied': 'Not allowed (check the Firestore rules are published).',
  unavailable: 'Can\'t reach the server. Check your internet.',
};
export const niceError = (e) => (e && (ERRORS[e.code] || e.friendly || e.message)) || 'Something went wrong.';
const fail = (friendly) => Object.assign(new Error(friendly), { friendly });

export function createSocial(db, { storage = typeof localStorage !== 'undefined' ? localStorage : null } = {}) {
  const subs = new Set();
  const msgSubs = new Set();
  const state = {
    ready: false, user: null, profile: undefined, friends: [], incoming: [], outgoing: [],
    messages: [], prefs: { invisible: false, dnd: false, status: '' }, me: null,
    // connection check, shown in Settings: last presence write + each friend's status feed
    diag: { write: '', writeAt: 0, skew: 0, feeds: {} },
  };
  let unsubs = [];
  const friendWatch = new Map(); // uid -> { unsub, presence, lastSay, cached }
  let beat = null, typingOn = 'off', typingSentAt = 0;
  // Friends' timestamps come from Firebase's clock, not this PC's. If this PC's clock is off by a few
  // minutes everyone would look offline, so we measure the offset from our own presence writes.
  let skew = 0, lastWriteAt = 0;
  const serverNow = () => Date.now() + skew;

  const emit = () => { for (const f of subs) f(state); };
  const store = {
    get: (k, d) => { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const msgKey = () => 'nibble-msgs-' + (state.user ? state.user.uid : 'anon');

  const fresh = (list) => list.filter((m) => Date.now() - (m.at || 0) < MSG_TTL);
  function pruneMessages() {
    const kept = fresh(state.messages);
    if (kept.length !== state.messages.length) { state.messages = kept; store.set(msgKey(), kept); emit(); }
  }
  function pushMessage(m, deliver = true) {
    if (state.messages.some((x) => x.id === m.id)) return;
    state.messages = fresh([...state.messages, m]).slice(-300);
    store.set(msgKey(), state.messages);
    if (deliver) for (const f of msgSubs) f(m);
    emit();
  }

  // ---------- friends + presence ----------
  function friendView(uid) {
    const w = friendWatch.get(uid);
    const p = (w && w.presence) || {};
    const now = serverNow();
    const online = !!p.online && now - ms(p.lastSeen) < ONLINE_MS;
    return {
      uid,
      username: p.username || (w && w.cached.username) || 'friend',
      since: w && ms(w.cached.since),
      petName: p.petName || '',
      skin: p.skin || 'mint',
      acc: Array.isArray(p.acc) ? p.acc : [],
      tint: p.tint || '',
      makeup: p.makeup || '',
      status: p.status || '',
      dnd: !!p.dnd,
      online,
      lastSeen: ms(p.lastSeen),
      // typingTo: '' = typing to everyone, otherwise only that friend sees the thinking cloud
      typing: online && !!p.typing && now - ms(p.typingAt) < TYPING_MS && (!p.typingTo || (state.user && p.typingTo === state.user.uid)),
      say: p.say && p.say.text ? { id: p.say.id, text: p.say.text, at: ms(p.say.at) } : null,
    };
  }
  function rebuildFriends() {
    state.friends = [...friendWatch.keys()].map(friendView).sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username));
    emit();
  }

  function watchFriend(uid, cached) {
    if (friendWatch.has(uid)) { friendWatch.get(uid).cached = cached; return; }
    const w = { cached, presence: null, lastSay: undefined, tries: 0 };
    friendWatch.set(uid, w);
    // A brand-new friendship can be checked by the server a moment before it is saved, which
    // refuses the first read and would kill the listener for good. So on any error: retry.
    const attach = () => {
      w.unsub = db.watchDoc('presence/' + uid, (p) => onPresence(p), (e) => {
        w.presence = null;
        state.diag.feeds[uid] = (e && e.code) || 'error';
        rebuildFriends();
        w.unsub = null;
        clearTimeout(w.retry);
        w.retry = setTimeout(() => { if (friendWatch.get(uid) === w) attach(); }, Math.min(30_000, 2000 * ++w.tries));
      });
    };
    const onPresence = (p) => {
      w.tries = 0;
      state.diag.feeds[uid] = p ? 'ok' : 'no status yet';
      w.presence = p;
      const say = p && p.say;
      if (say && say.id) {
        if (w.lastSay === undefined) {
          // first snapshot: only deliver if it was said in the last 20s
          if (serverNow() - ms(say.at) < 20_000) deliverSay(uid, p);
        } else if (say.id !== w.lastSay) deliverSay(uid, p);
        w.lastSay = say.id;
      } else if (w.lastSay === undefined) w.lastSay = null;
      rebuildFriends();
    };
    attach();
  }
  function deliverSay(uid, p) {
    pushMessage({ id: 's_' + p.say.id, kind: 'say', from: uid, fromName: p.username || 'friend', text: p.say.text, at: ms(p.say.at) || Date.now() });
  }
  function unwatchFriend(uid) {
    const w = friendWatch.get(uid);
    if (w) { clearTimeout(w.retry); w.unsub && w.unsub(); friendWatch.delete(uid); delete state.diag.feeds[uid]; }
  }

  async function writePresence(extra = {}) {
    if (!state.user || !state.profile) return;
    const { invisible, dnd, status } = state.prefs;
    const pr = state.profile;
    lastWriteAt = Date.now();
    await db.set('presence/' + state.user.uid, {
      online: !invisible, lastSeen: db.now(), username: pr.username, petName: pr.petName || '', skin: pr.skin || 'mint',
      acc: Array.isArray(pr.acc) ? pr.acc : [], tint: pr.tint || '', makeup: pr.makeup || '',
      status: cleanText(status).slice(0, 40), dnd: !!dnd, ...extra,
    }, true).then(() => { state.diag.write = 'ok'; state.diag.writeAt = Date.now(); }, (e) => {
      // older rules don't allow typingTo yet: retry without it instead of going dark
      if ('typingTo' in extra && e && e.code === 'permission-denied') {
        const { typingTo, ...rest } = extra;
        return writePresence(rest);
      }
      state.diag.write = (e && e.code) || 'error';
      emit();
    });
  }
  function startPresence() {
    stopPresence();
    writePresence({ typing: false });
    beat = setInterval(() => { writePresence(); rebuildFriends(); }, BEAT_MS);
  }
  function stopPresence() { clearInterval(beat); beat = null; }

  // ---------- session lifecycle ----------
  function teardown() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
    for (const uid of [...friendWatch.keys()]) unwatchFriend(uid);
    stopPresence();
    Object.assign(state, { profile: undefined, friends: [], incoming: [], outgoing: [], messages: [], me: null, diag: { write: '', writeAt: 0, skew: 0, feeds: {} } });
  }

  // a listener that re-subscribes itself after errors (network blips, rules propagating, etc.)
  function live(make) {
    let unsub = null, timer = null, tries = 0, dead = false;
    const go = () => {
      unsub = make(() => { tries = 0; if (state.diag.listen) { state.diag.listen = ''; } }, (e) => {
        if (dead) return;
        unsub = null;
        timer = setTimeout(go, Math.min(30_000, 2000 * ++tries));
        state.diag.listen = (e && e.code) || 'error';
        emit();
      });
    };
    go();
    return () => { dead = true; clearTimeout(timer); unsub && unsub(); };
  }

  function startSession(user) {
    const tick = setInterval(() => { rebuildFriends(); pruneMessages(); }, 4000); // expire stale "typing…", online flags, old messages
    unsubs.push(() => clearInterval(tick));
    state.messages = fresh(store.get(msgKey(), []));
    state.prefs = { ...state.prefs, ...store.get('nibble-social-prefs-' + user.uid, {}) };
    unsubs.push(live((ok, err) => db.watchDoc('users/' + user.uid, (p) => {
      ok();
      const had = !!state.profile;
      state.profile = p;
      state.me = p ? { uid: user.uid, username: p.username, petName: p.petName, skin: p.skin, acc: Array.isArray(p.acc) ? p.acc : [], tint: p.tint || '', makeup: p.makeup || '' } : null;
      emit();
      if (p && !had) startPresence();
      else if (p) writePresence();
    }, err)));
    unsubs.push(live((ok, err) => db.watchDoc('presence/' + user.uid, (p) => {
      ok();
      const t = p && ms(p.lastSeen);
      if (t && lastWriteAt && Math.abs(t - lastWriteAt) < 24 * 3600_000) state.diag.skew = skew = t - lastWriteAt;
    }, err)));
    unsubs.push(live((ok, err) => db.watchCol('users/' + user.uid + '/friends', null, (list) => {
      ok();
      const ids = new Set(list.map((d) => d.id));
      for (const uid of [...friendWatch.keys()]) if (!ids.has(uid)) unwatchFriend(uid);
      for (const d of list) watchFriend(d.id, d.data);
      rebuildFriends();
    }, err)));
    unsubs.push(live((ok, err) => db.watchCol('requests', [['to', '==', user.uid]], (list) => {
      ok();
      state.incoming = list.map((d) => ({ id: d.id, ...d.data, at: ms(d.data.at) }));
      emit();
    }, err)));
    unsubs.push(live((ok, err) => db.watchCol('requests', [['from', '==', user.uid]], (list) => {
      ok();
      state.outgoing = list.map((d) => ({ id: d.id, ...d.data, at: ms(d.data.at) }));
      emit();
    }, err)));
    unsubs.push(live((ok, err) => db.watchCol('inbox/' + user.uid + '/items', null, (list) => {
      ok();
      list.sort((a, b) => ms(a.data.at) - ms(b.data.at));
      for (const d of list) {
        const m = d.data;
        if (serverNow() - ms(m.at) < MSG_TTL) pushMessage({ id: 'i_' + d.id, kind: m.kind, from: m.from, fromName: m.fromName, text: m.text || '', at: ms(m.at) || Date.now(), direct: true });
        db.del('inbox/' + user.uid + '/items/' + d.id).catch(() => {});
      }
    }, err)));
  }

  const offAuth = db.auth.onChange((u) => {
    teardown();
    state.user = u;
    state.ready = true;
    if (u) startSession(u);
    else state.profile = null;
    emit();
  });

  const onLeave = () => { if (state.user && state.profile) db.set('presence/' + state.user.uid, { online: false, typing: false, lastSeen: db.now() }, true).catch(() => {}); };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onLeave);

  const requireMe = () => { if (!state.user || !state.profile) throw fail('Pick a username first.'); return state.user.uid; };

  // ---------- public API ----------
  const api = {
    state,
    subscribe(f) { subs.add(f); f(state); return () => subs.delete(f); },
    onMessage(f) { msgSubs.add(f); return () => msgSubs.delete(f); },
    destroy() { offAuth && offAuth(); teardown(); if (typeof window !== 'undefined') window.removeEventListener('pagehide', onLeave); },

    // auth
    signUp: (email, pw) => db.auth.signUp(email.trim(), pw),
    signIn: (email, pw) => db.auth.signIn(email.trim(), pw),
    resetPassword: (email) => db.auth.reset(email.trim()),
    google: () => db.auth.google(),
    googleIdToken: () => db.auth.googleIdToken(),
    googleWithToken: (t) => db.auth.googleWithToken(t),
    async signOut() { onLeave(); await db.auth.signOut(); },

    // profile
    async claimUsername(raw, { petName = '', skin = 'mint' } = {}) {
      const name = String(raw || '').trim().toLowerCase().replace(/^@/, '');
      if (!NAME_RE.test(name)) throw fail('Usernames are 3–20 letters, numbers or _.');
      const uid = state.user && state.user.uid;
      if (!uid) throw fail('Sign in first.');
      await db.tx(async (t) => {
        const taken = await t.get('usernames/' + name);
        if (taken && taken.uid !== uid) throw fail('@' + name + ' is taken. Try another one.');
        const old = await t.get('users/' + uid);
        if (old && old.username && old.username !== name) t.del('usernames/' + old.username);
        t.set('usernames/' + name, { uid });
        t.set('users/' + uid, {
          username: name, petName: cleanText(petName || (old && old.petName) || '').slice(0, 20), skin: skin || (old && old.skin) || 'mint',
          createdAt: (old && old.createdAt) || db.now(), updatedAt: db.now(),
        });
      });
      return name;
    },
    async updateProfile({ petName, skin, acc, tint, makeup }) {
      const uid = requireMe();
      const patch = { updatedAt: db.now() };
      if (petName != null) patch.petName = cleanText(petName).slice(0, 20);
      if (skin) patch.skin = String(skin).slice(0, 20);
      if (acc != null) patch.acc = (Array.isArray(acc) ? acc : []).filter((a) => typeof a === 'string').slice(0, 6);
      if (tint != null) patch.tint = String(tint).slice(0, 7);
      if (makeup != null) patch.makeup = String(makeup).slice(0, 12);
      await db.set('users/' + uid, patch, true);
      if (state.profile) { state.profile = { ...state.profile, ...patch }; writePresence(); emit(); }
    },
    setPrefs(p) {
      state.prefs = { ...state.prefs, ...p };
      if (state.user) store.set('nibble-social-prefs-' + state.user.uid, state.prefs);
      emit();
      writePresence(state.prefs.invisible ? { typing: false } : {});
    },

    // friends
    async addFriend(raw) {
      const uid = requireMe();
      const name = String(raw || '').trim().toLowerCase().replace(/^@/, '');
      if (!NAME_RE.test(name)) throw fail('Type their exact username (3–20 letters, numbers or _).');
      if (name === state.profile.username) throw fail('That\'s you! Add someone else 🙂');
      const hit = await db.get('usernames/' + name);
      if (!hit) throw fail('No one called @' + name + ' yet. Check the spelling?');
      if (friendWatch.has(hit.uid)) throw fail('You and @' + name + ' are already friends.');
      const inc = state.incoming.find((r) => r.from === hit.uid);
      if (inc) { await api.accept(inc); return 'accepted'; }
      if (state.outgoing.some((r) => r.to === hit.uid)) throw fail('Request already sent. Waiting for @' + name + '.');
      await db.set('requests/' + uid + '_' + hit.uid, { from: uid, to: hit.uid, fromName: state.profile.username, toName: name, at: db.now() });
      return 'sent';
    },
    async accept(r) {
      const uid = requireMe();
      await db.batch([
        { op: 'set', path: `users/${uid}/friends/${r.from}`, data: { username: r.fromName, since: db.now() } },
        { op: 'set', path: `users/${r.from}/friends/${uid}`, data: { username: state.profile.username, since: db.now() } },
        { op: 'del', path: 'requests/' + r.id },
      ]);
    },
    decline: (r) => db.del('requests/' + r.id),
    cancel: (r) => db.del('requests/' + r.id),
    async unfriend(fid) {
      const uid = requireMe();
      await db.batch([{ op: 'del', path: `users/${uid}/friends/${fid}` }, { op: 'del', path: `users/${fid}/friends/${uid}` }]);
    },

    // talking
    // to: a friend's uid (private chat) or '' for everyone
    async setTyping(on, to = '') {
      if (!state.user || !state.profile || state.prefs.invisible) return;
      const now = Date.now();
      const key = on ? 'on:' + (to || '') : 'off';
      if (key === typingOn && (!on || now - typingSentAt < 8000)) return;
      typingOn = key; typingSentAt = now;
      await writePresence({ typing: !!on, typingAt: db.now(), typingTo: on ? String(to || '') : '' });
    },
    async say(raw) {
      const uid = requireMe();
      const text = cleanText(raw);
      if (!text) return null;
      const id = rid();
      typingOn = 'off';
      await writePresence({ typing: false, typingTo: '', say: { id, text, at: db.now() } });
      pushMessage({ id: 's_' + id, kind: 'say', from: uid, fromName: state.profile.username, text, at: Date.now(), mine: true }, false);
      return text;
    },
    async send(toUid, kind, raw = '') {
      requireMe();
      if (!EMOTES[kind] && kind !== 'whisper') throw fail('Unknown action.');
      const text = cleanText(raw);
      if (kind === 'whisper' && !text) return null;
      await db.add(`inbox/${toUid}/items`, { from: state.user.uid, fromName: state.profile.username, kind, text, at: db.now() });
      if (kind === 'whisper' && typingOn !== 'off') api.setTyping(false).catch(() => {});
      const f = state.friends.find((x) => x.uid === toUid);
      pushMessage({ id: 'o_' + rid(), kind, from: state.user.uid, fromName: state.profile.username, to: toUid, toName: f ? f.username : '', text, at: Date.now(), mine: true }, false);
      return text || kind;
    },
    clearHistory() { state.messages = []; store.set(msgKey(), []); emit(); },
    refresh: rebuildFriends,
    clockSkew: () => skew,
  };
  return api;
}
