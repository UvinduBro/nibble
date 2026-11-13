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
//   rooms/{hostUid}                  Listen Together room (see music.js)   host + invited only
//   wallets/{uid}, gifts/{id}        points, owned shop items, gifts (see wallet.js)
//   matches/{id}                     live friend games (see games.js)

import { cleanAbout } from '../about';
import { createMusic } from './music';
import { createWallet } from './wallet';
import { createGames } from './games';

export const MAX_TEXT = 80;
// deadline reminders: your pet reminds you 1 day before and again 3 hours before
export const REMIND_DAY = 24 * 3600_000;
export const REMIND_SOON = 3 * 3600_000;
export const MAX_DEADLINES = 40;
export const NAME_RE = /^[a-z0-9_]{3,20}$/;
export const EMOTES = { wave: '👋', hug: '🤗', kiss: '😘', heart: '❤️', poke: '👉', highfive: '🙌', tickle: '🤭', cheer: '🎉', dance: '🎶', snack: '🍪', annoy: '😜', icecream: '🍦', listen: '🎧', visit: '🏠', boop: '👆', flower: '🌷', cake: '🎂', fistbump: '👊', pillow: '🛏', serenade: '🎸', gift: '🎁', bubbles: '🫧', game: '🎮' };
// what the receiver's pet says: "@wagee <verb>"
export const EMOTE_TEXT = { wave: 'waves at you', hug: 'gave you a big cuddle', kiss: 'sent you a smooch', heart: 'sent you a heart', poke: 'poked you!', highfive: 'wants a high five', tickle: 'is tickling you', cheer: 'is cheering you on', dance: 'wants to dance', snack: 'shared a snack', annoy: 'is teasing you 😜', icecream: 'shared ice cream with you 🍦', listen: 'invited you to listen together 🎧', visit: 'came to visit you!', boop: 'booped you 👆', flower: 'gave you a flower 🌷', cake: 'baked you a cake 🎂', fistbump: 'wants a fist bump 👊', pillow: 'started a pillow fight! 🛏', serenade: 'is singing to you 🎸', gift: 'sent you a present 🎁', bubbles: 'is blowing bubbles at you 🫧', game: 'challenged you to a game 🎮' };
// what the SENDER's pet says when it delivers an action on your desktop
export const EMOTE_SAY = { wave: 'hi there! 👋', hug: 'cuddle time! 🤗', kiss: 'mwah! 😘', heart: '❤️ ❤️ ❤️', poke: 'poke! 👉', highfive: 'high five! 🙌', tickle: 'tickle tickle 🤭', cheer: 'you got this! 🎉', dance: "let's dance! 🎶", snack: 'brought you a cookie 🍪', annoy: 'boop! 😜', icecream: 'ice cream for you! 🍦', listen: 'come listen with me! 🎧', visit: 'hi! just visiting 👋', boop: 'boop! 👆', flower: 'a flower for you 🌷', cake: 'surprise! 🎂', fistbump: 'bump it! 👊', pillow: 'pillow fight!! 🛏', serenade: '♪ la la laaa ♪', gift: 'I got you something 🎁', bubbles: 'bubbles! 🫧', game: 'wanna play? 🎮' };
export const MSG_TTL = 30 * 60_000; // chat history disappears after 30 minutes
const ONLINE_MS = 150_000;
const TYPING_MS = 12_000;
const BEAT_MS = 60_000;

export const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const cleanText = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
// like cleanText but with its own limit (announcements and notices are longer than chat lines)
const long = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
export const LEVELS = ['info', 'update', 'warn', 'party'];
// only well-formed deadline items survive, newest-due first doesn't matter (UI sorts)
export const cleanDeadlines = (list) => (Array.isArray(list) ? list : [])
  .filter((d) => d && typeof d.id === 'string' && Number(d.due) > 0)
  .map((d) => ({ id: d.id.slice(0, 20), title: String(d.title || '').slice(0, 60), due: Number(d.due), done: !!d.done, r1: !!d.r1, r2: !!d.r2, createdAt: Number(d.createdAt) || 0 }))
  .slice(0, 60);
// '2.0.5' < '2.0.6' → true
export const verLess = (a, b) => {
  const pa = String(a || '').split('.').map(Number), pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  return false;
};

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
// { sp: species, of: outfit, oc: outfit colour, sk: skill } — the wardrobe look (see lib/shop.js)
export const cleanStyleMap = (st) => {
  const o = st && typeof st === 'object' ? st : {};
  const w = (v, n) => String(v || '').replace(/[^a-z]/g, '').slice(0, n);
  return { sp: w(o.sp, 12), of: w(o.of, 12), oc: /^#[0-9a-fA-F]{6}$/.test(o.oc || '') ? o.oc : '', sk: w(o.sk, 12) };
};
const fail = (friendly) => Object.assign(new Error(friendly), { friendly });

export function createSocial(db, { storage = typeof localStorage !== 'undefined' ? localStorage : null } = {}) {
  const subs = new Set();
  const msgSubs = new Set();
  const remSubs = new Set(); // reminder listeners (desktop pets, web desk, banner)
  const sentSubs = new Set(); // actions you just sent (so your own pets can act them out too)
  const state = {
    ready: false, user: null, profile: undefined, friends: [], incoming: [], outgoing: [],
    messages: [], prefs: { invisible: false, dnd: false, status: '' }, me: null, broadcast: null,
    // site config set by admins (min desktop version, site notice) and whether this account is suspended
    config: null, banned: false,
    // private "About me" (nick, role, interests, focus) — shapes what your own pet thinks about
    about: null,
    // private deadlines: [{ id, title, due (ms), done, r1, r2, createdAt }]
    deadlines: [],
    // connection check, shown in Settings: last presence write + each friend's status feed
    diag: { write: '', writeAt: 0, skew: 0, feeds: {} },
    // points (⭐), owned shop items, daily bonus — see wallet.js
    wallet: null,
    // live friend games — see games.js
    matches: [],
  };
  let unsubs = [];
  const friendWatch = new Map(); // uid -> { unsub, presence, lastSay, cached }
  let beat = null, typingOn = 'off', typingSentAt = 0;
  // Friends' timestamps come from Firebase's clock, not this PC's. If this PC's clock is off by a few
  // minutes everyone would look offline, so we measure the offset from our own presence writes.
  let skew = 0, lastWriteAt = 0, wseq = 0;
  const writeTimes = new Map(); // presence write # -> when we sent it (matches each server timestamp to its own write)
  const serverNow = () => Date.now() + skew;
  // which app this session runs in, reported in presence so admins can see platform + version
  let client = { client: 'web', ver: '' };

  const emit = () => { for (const f of subs) f(state); };
  const store = {
    get: (k, d) => { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const msgKey = () => 'nibble-msgs-' + (state.user ? state.user.uid : 'anon');
  // Listen Together rooms + "Now playing" (lib/social/music.js)
  const music = createMusic({ db, state, emit: () => emit(), serverNow: () => serverNow(), requireMe: () => requireMe(), store, writePresence: () => writePresence(),
    sendInvite: (uid) => api.send(uid, 'listen', '') });
  const wallet = createWallet({ db, state, emit: () => emit(), serverNow: () => serverNow(), requireMe: () => requireMe(), store, pushMessage: (m) => pushMessage(m), fail });
  const games = createGames({ db, state, emit: () => emit(), serverNow: () => serverNow(), requireMe: () => requireMe(), store, fail, wallet, send: (to, k, t) => api.send(to, k, t) });

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
      style: cleanStyleMap(p.style),
      status: p.status || '',
      dnd: !!p.dnd,
      online,
      lastSeen: ms(p.lastSeen),
      // typingTo: '' = typing to everyone, otherwise only that friend sees the thinking cloud
      typing: online && !!p.typing && now - ms(p.typingAt) < TYPING_MS && (!p.typingTo || (state.user && p.typingTo === state.user.uid)),
      say: p.say && p.say.text ? { id: p.say.id, text: p.say.text, at: ms(p.say.at) } : null,
      // what they're listening to (a Nibble room song, or Spotify/YouTube… if they share it)
      np: online ? music.friendNp(p) : null,
      room: online ? String(p.room || '') : '',
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

  // level 3 = everything; 2 = without np/room (rules before 2.0.12); 1 = without client/ver (rules from v2.0.4); 0 = legacy.
  // Each permission-denied steps down one level, so an un-republished rules file never costs us the look.
  async function writePresence(extra = {}, level = 4) {
    if (!state.user || !state.profile) return;
    const { invisible, dnd, status } = state.prefs;
    const pr = state.profile;
    lastWriteAt = Date.now();
    const data = {
      online: !invisible, lastSeen: db.now(), username: pr.username, petName: pr.petName || '', skin: pr.skin || 'mint',
      status: cleanText(status).slice(0, 40), dnd: !!dnd, ...extra,
    };
    if (level >= 1) { data.acc = Array.isArray(pr.acc) ? pr.acc : []; data.tint = pr.tint || ''; data.makeup = pr.makeup || ''; }
    if (level >= 2) { data.client = client.client; data.ver = client.ver || ''; }
    if (level >= 3) {
      const mp = music.presence(); data.np = mp.np; data.room = mp.room;
      data.wseq = ++wseq; writeTimes.set(wseq, lastWriteAt);
      if (writeTimes.size > 12) writeTimes.delete(writeTimes.keys().next().value);
    }
    if (level >= 4) data.style = cleanStyleMap(pr.style);
    await db.set('presence/' + state.user.uid, data, true)
      .then(() => { state.diag.write = 'ok'; state.diag.writeAt = Date.now(); }, (e) => {
        if (level > 0 && e && e.code === 'permission-denied' && !state.banned) {
          const rest = { ...extra };
          if (level === 1) delete rest.typingTo;
          return writePresence(rest, level - 1);
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

  // ---------- deadlines + reminders ----------
  const dlKey = () => 'nibble-dl-' + (state.user ? state.user.uid : 'anon');
  async function saveDeadlines(items) {
    const uid = requireMe();
    // keep it small: finished items older than 14 days fall off
    const keep = cleanDeadlines(items).filter((d) => !(d.done && Date.now() - d.due > 14 * 86400_000)).slice(0, MAX_DEADLINES);
    state.deadlines = keep;
    store.set(dlKey(), keep);
    emit();
    try { await db.set('users/' + uid + '/private/deadlines', { items: keep, updatedAt: db.now() }); return 'synced'; }
    catch (e) { if (e && e.code === 'permission-denied') return 'local'; throw e; }
  }
  const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function dayWord(t) {
    const d = new Date(t), n = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(n)) / 86400_000);
    return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'on ' + d.toLocaleDateString([], { weekday: 'long' });
  }
  function reminderText(d, stage) {
    const nick = state.about && state.about.nick;
    const left = d.due - Date.now();
    if (stage === 1) return `⏰ Heads up${nick ? ', ' + nick : ''}! “${d.title}” is due ${dayWord(d.due)} at ${timeOf(d.due)}.`;
    const inT = left > 90 * 60_000 ? Math.round(left / 3600_000) + ' hours' : Math.max(1, Math.round(left / 60_000)) + ' minutes';
    return `⏰ ${nick ? nick + ', ' : ''}“${d.title}” is due in ${inT} (${timeOf(d.due)}). You've got this 💪`;
  }
  function fireReminder(d, stage) {
    const r = { kind: 'reminder', id: d.id + ':' + stage, stage, title: d.title, due: d.due, text: reminderText(d, stage) };
    for (const f of remSubs) { try { f(r); } catch {} }
  }
  // stage 1 = within a day, stage 2 = within 3 hours. Each fires once (flags sync across devices).
  function checkDeadlines() {
    if (!state.user || !state.profile || !state.deadlines.length) return;
    const now = Date.now();
    let changed = false;
    const next = state.deadlines.map((d) => {
      if (d.done) return d;
      const left = d.due - now;
      if (left <= 0) return d; // past due: shown as overdue, no late alarms
      if (left <= REMIND_SOON && !d.r2) { fireReminder(d, 2); changed = true; return { ...d, r2: true }; }
      if (left <= REMIND_DAY && left > REMIND_SOON && !d.r1) { fireReminder(d, 1); changed = true; return { ...d, r1: true }; }
      return d;
    });
    if (changed) saveDeadlines(next).catch(() => {});
  }

  // ---------- session lifecycle ----------
  function teardown() {
    unsubs.forEach((u) => u && u());
    unsubs = [];
    for (const uid of [...friendWatch.keys()]) unwatchFriend(uid);
    stopPresence();
    music._stop(); wallet._stop(); games._stop();
    Object.assign(state, { wallet: null, matches: [], profile: undefined, friends: [], incoming: [], outgoing: [], messages: [], me: null, broadcast: null, admin: false, config: null, banned: false, about: null, deadlines: [], diag: { write: '', writeAt: 0, skew: 0, feeds: {} } });
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
      // a look saved before the rules allowed `style` lives on this device until it can sync
      if (p && !p.style) { const ls = store.get('nibble-style-' + user.uid, null); if (ls) { p = { ...p, style: ls }; state.profile = p; } }
      state.me = p ? { uid: user.uid, username: p.username, petName: p.petName, skin: p.skin, acc: Array.isArray(p.acc) ? p.acc : [], tint: p.tint || '', makeup: p.makeup || '', style: cleanStyleMap(p.style) } : null;
      emit();
      if (p && !had) startPresence();
      else if (p) writePresence();
    }, err)));
    unsubs.push(live((ok, err) => db.watchDoc('presence/' + user.uid, (p) => {
      ok();
      const t = p && ms(p.lastSeen);
      // server clock offset. With write numbers (rules 2.0.12+) each timestamp is matched to the write that
      // made it, so overlapping writes can't skew the estimate; the server-confirmed snapshot wins.
      const sent = p && p.wseq && writeTimes.get(p.wseq);
      if (t && sent) state.diag.skew = skew = t - sent;
      else if (t && lastWriteAt && !(p && p.wseq) && Math.abs(t - lastWriteAt) < 24 * 3600_000) state.diag.skew = skew = t - lastWriteAt;
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
        if (!m || !m.kind) { db.del('inbox/' + user.uid + '/items/' + d.id).catch(() => {}); continue; }
        // Inbox items are one-shot: we delete each one right after reading it, so anything
        // still sitting here is something we haven't delivered yet. Deliver it regardless of
        // the clock — comparing a server timestamp against a wrong local clock was silently
        // dropping real pokes/waves on a PC whose clock is off. pushMessage dedups by id, so
        // seeing the same item across snapshots can never double-fire.
        pushMessage({ id: 'i_' + d.id, kind: m.kind, from: m.from, fromName: m.fromName, text: m.text || '', at: ms(m.at) || Date.now(), direct: true });
        if (m.kind === 'listen') music.gotInvite({ from: m.from, fromName: m.fromName, at: ms(m.at) || Date.now() });
        db.del('inbox/' + user.uid + '/items/' + d.id).catch(() => {});
      }
    }, err)));
    // admin broadcasts: a single announcement everyone sees
    unsubs.push(db.watchDoc('broadcast/latest', (b) => { state.broadcast = b && b.text ? b : null; emit(); }, () => {}));
    // site config (min desktop version, site notice) and whether an admin suspended this account.
    // Both fail quietly on older rules — the app simply behaves as before.
    unsubs.push(db.watchDoc('config/app', (c) => { state.config = c || null; emit(); }, () => {}));
    unsubs.push(db.watchDoc('banned/' + user.uid, (b) => { state.banned = !!b; emit(); }, () => {}));
    // About me: private to you (users/{uid}/private/about). Cached on this device so it still
    // works before the rules are published, and loads instantly next time.
    state.about = store.get('nibble-about-' + user.uid, null);
    unsubs.push(db.watchDoc('users/' + user.uid + '/private/about', (a) => {
      if (a) { state.about = cleanAbout(a); store.set('nibble-about-' + user.uid, state.about); }
      emit();
    }, () => {}));
    // Deadlines: private doc, cached on this device. Remote wins whenever it exists.
    state.deadlines = cleanDeadlines(store.get('nibble-dl-' + user.uid, []));
    unsubs.push(db.watchDoc('users/' + user.uid + '/private/deadlines', (d) => {
      if (d && Array.isArray(d.items)) { state.deadlines = cleanDeadlines(d.items); store.set('nibble-dl-' + user.uid, state.deadlines); }
      emit();
    }, () => {}));
    // reminder clock: first check shortly after start (so the pets are ready), then every 20s
    const first = setTimeout(checkDeadlines, 8000);
    const every = setInterval(checkDeadlines, 20_000);
    unsubs.push(() => { clearTimeout(first); clearInterval(every); });
    music._start(); wallet._start(); games._start();
    // am I an admin? (admins/{uid} doc exists)
    db.get('admins/' + user.uid).then((d) => { state.admin = !!d; emit(); }, () => {});
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
    async updateProfile({ petName, skin, acc, tint, makeup, style }) {
      const uid = requireMe();
      const patch = { updatedAt: db.now() };
      if (petName != null) patch.petName = cleanText(petName).slice(0, 20);
      if (skin) patch.skin = String(skin).slice(0, 20);
      if (acc != null) patch.acc = (Array.isArray(acc) ? acc : []).filter((a) => typeof a === 'string').slice(0, 6);
      if (tint != null) patch.tint = String(tint).slice(0, 7);
      if (makeup != null) patch.makeup = String(makeup).slice(0, 12);
      if (style != null) patch.style = cleanStyleMap(style);
      let where = 'synced';
      try { await db.set('users/' + uid, patch, true); }
      catch (e) {
        // rules from before 2.0.13 don't know `style`: save the rest, keep the look on this device
        if (!(e && e.code === 'permission-denied' && patch.style)) throw e;
        const { style: st, ...rest } = patch;
        await db.set('users/' + uid, rest, true);
        store.set('nibble-style-' + uid, st);
        where = 'local';
      }
      if (patch.style) store.set('nibble-style-' + uid, patch.style);
      if (state.profile) { state.profile = { ...state.profile, ...patch }; if (state.me) state.me = { ...state.me, ...patch }; writePresence(); emit(); }
      return where;
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
      const sent = { id: 'o_' + rid(), kind, from: state.user.uid, fromName: state.profile.username, to: toUid, toName: f ? f.username : '', text, at: Date.now(), mine: true };
      pushMessage(sent, false);
      for (const cb of sentSubs) { try { cb(sent); } catch {} }
      if (kind !== 'whisper' && kind !== 'game' && kind !== 'listen') wallet.earnSocial();
      return text || kind;
    },
    clearHistory() { state.messages = []; store.set(msgKey(), []); emit(); },
    refresh: rebuildFriends,
    clockSkew: () => skew,
    // deadlines (private). Each returns 'synced' or 'local' (saved on this device only).
    deadlines: {
      async add(title, due) {
        const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        const when = Number(due);
        if (!t) throw fail('What\'s due? Give it a name.');
        if (!when || when < Date.now() + 60_000) throw fail('Pick a time in the future.');
        if (state.deadlines.filter((d) => !d.done).length >= MAX_DEADLINES) throw fail('That\'s a lot of deadlines! Finish or delete a few first.');
        const left = when - Date.now();
        // adding one that's already inside a window shouldn't instantly fire the earlier reminder
        // added less than a day ahead? you just typed it in — skip the 1-day reminder, keep the 3-hour one
        const item = { id: rid(), title: t, due: when, done: false, r1: left <= REMIND_DAY, r2: false, createdAt: Date.now() };
        const r = await saveDeadlines([...state.deadlines, item]);
        setTimeout(checkDeadlines, 1500); // e.g. something due in 2 hours gets its reminder right away
        return r;
      },
      toggle(id) { return saveDeadlines(state.deadlines.map((d) => (d.id === id ? { ...d, done: !d.done } : d))); },
      remove(id) { return saveDeadlines(state.deadlines.filter((d) => d.id !== id)); },
      clearDone() { return saveDeadlines(state.deadlines.filter((d) => !d.done)); },
      // "show me how it looks": fires a sample reminder through the same path
      test() {
        const nick = state.about && state.about.nick;
        const r = { kind: 'reminder', id: 'test:' + rid(), stage: 1, title: 'Test', due: Date.now() + REMIND_DAY, test: true,
          text: `⏰ This is how I'll remind you${nick ? ', ' + nick : ''}: “Final project” is due tomorrow at 5:00 PM.` };
        for (const f of remSubs) { try { f(r); } catch {} }
      },
    },
    onReminder(f) { remSubs.add(f); return () => remSubs.delete(f); },
    onSent(f) { sentSubs.add(f); return () => sentSubs.delete(f); },
    music,
    wallet,
    games,
    // save your About me. Returns 'synced', or 'local' when the rules don't allow it yet.
    async setAbout(a) {
      const uid = requireMe();
      const about = cleanAbout(a);
      state.about = about;
      store.set('nibble-about-' + uid, about);
      emit();
      try {
        await db.set('users/' + uid + '/private/about', { ...about, updatedAt: db.now() });
        return 'synced';
      } catch (e) {
        if (e && e.code === 'permission-denied') return 'local';
        throw e;
      }
    },
    // tell admins which app this is ('desktop' + version, or 'web'); re-sends presence when it changes
    setClient(c) {
      const next = { client: c && c.client === 'desktop' ? 'desktop' : 'web', ver: String((c && c.ver) || '').slice(0, 12) };
      if (next.client === client.client && next.ver === client.ver) return;
      client = next;
      writePresence();
    },

    // ---------- admin (gated by an admins/{uid} doc) ----------
    admin: {
      // live list of every user, merged with presence. Re-merges every 30s so "online" ages out on its own.
      watchUsers(cb) {
        let users = [], pres = {}, ok = false;
        const merge = () => {
          if (!ok) return;
          cb(users.map((u) => {
            const d = u.data || {}, p = pres[u.id] || {};
            const lastSeen = ms(p.lastSeen);
            const online = !!p.online && serverNow() - lastSeen < ONLINE_MS;
            return {
              uid: u.id, username: d.username || u.id, petName: d.petName || '', skin: d.skin || 'mint',
              acc: Array.isArray(d.acc) ? d.acc : [], tint: d.tint || '', makeup: d.makeup || '',
              createdAt: ms(d.createdAt), updatedAt: ms(d.updatedAt),
              status: p.status || '', dnd: !!p.dnd, online, lastSeen, hasPresence: !!pres[u.id],
              client: p.client || '', ver: p.ver || '',
            };
          }).sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username)));
        };
        const u1 = db.watchCol('users', null, (list) => { users = list; ok = true; merge(); }, () => cb(null));
        const u2 = db.watchCol('presence', null, (list) => { pres = {}; for (const d of list) pres[d.id] = d.data; merge(); }, () => {});
        const t = setInterval(merge, 30_000);
        return () => { u1 && u1(); u2 && u2(); clearInterval(t); };
      },
      // { title, text, level: info|update|warn|party, link, hours } — hours 0 = until cleared
      async broadcast({ title = '', text = '', level = 'info', link = '', hours = 0 } = {}) {
        requireMe();
        const body = long(text, 200);
        if (!body) throw fail('Write a message to send.');
        const url = String(link || '').trim();
        if (url && !/^(https:\/\/|\/)/.test(url)) throw fail('Links must start with https:// or /');
        const data = {
          title: long(title, 60), text: body, level: LEVELS.includes(level) ? level : 'info', link: url.slice(0, 200),
          expiresAt: hours > 0 ? Date.now() + hours * 3600_000 : 0, at: db.now(), by: state.profile.username, id: rid(),
        };
        await db.set('broadcast/latest', data);
        db.add('broadcasts', data).catch(() => {}); // history log (needs latest rules; harmless if missing)
        return true;
      },
      async clearBroadcast() { requireMe(); await db.del('broadcast/latest').catch(() => {}); },
      watchHistory(cb) {
        return db.watchCol('broadcasts', null, (list) => cb(list.map((d) => ({ hid: d.id, ...d.data, at: ms(d.data.at) })).sort((a, b) => b.at - a.at).slice(0, 30)), () => cb(null));
      },
      async removeUser(uid, username) {
        requireMe();
        const ops = [{ op: 'del', path: 'users/' + uid }, { op: 'del', path: 'presence/' + uid }];
        if (username) ops.push({ op: 'del', path: 'usernames/' + username });
        await db.batch(ops);
        db.del('users/' + uid + '/private/about').catch(() => {}); // best effort (needs latest rules)
        db.del('users/' + uid + '/private/deadlines').catch(() => {});
      },
      // suspend: the rules then refuse their presence, messages, requests and profile edits
      async ban(uid, username, reason = '') {
        requireMe();
        if (uid === state.user.uid) throw fail('You can\'t suspend yourself.');
        await db.set('banned/' + uid, { username: String(username || ''), reason: long(reason, 120), by: state.profile.username, at: db.now() });
        await db.del('presence/' + uid).catch(() => {}); // vanish from friends' desktops right away
      },
      async unban(uid) { requireMe(); await db.del('banned/' + uid); },
      watchBanned(cb) {
        return db.watchCol('banned', null, (list) => cb(list.map((d) => ({ uid: d.id, ...d.data, at: ms(d.data.at) }))), () => cb(null));
      },
      async resetLook(uid) {
        requireMe();
        try { await db.set('users/' + uid, { acc: [], tint: '', makeup: '', style: { sp: '', of: '', oc: '', sk: '' }, updatedAt: db.now() }, true); }
        catch (e) { if (e && e.code === 'permission-denied') await db.set('users/' + uid, { acc: [], tint: '', makeup: '', updatedAt: db.now() }, true); else throw e; }
      },
      // config/app: { minVersion, updateMsg, notice, noticeLevel }
      async setConfig(patch) {
        requireMe();
        const clean = {};
        if ('minVersion' in patch) {
          const v = String(patch.minVersion || '').trim();
          if (v && !/^\d+\.\d+\.\d+$/.test(v)) throw fail('Version looks like 2.0.6');
          clean.minVersion = v;
        }
        if ('updateMsg' in patch) clean.updateMsg = long(patch.updateMsg, 160);
        if ('notice' in patch) clean.notice = long(patch.notice, 200);
        if ('noticeLevel' in patch) clean.noticeLevel = LEVELS.includes(patch.noticeLevel) ? patch.noticeLevel : 'info';
        await db.set('config/app', { ...clean, updatedAt: db.now(), by: state.profile.username }, true);
      },
    },
  };
  return api;
}
