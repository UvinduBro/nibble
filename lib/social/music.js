// Listen Together: synced music rooms + "Now playing".
//
// rooms/{hostUid} = {
//   host, hostName, invited: [uid], names: { uid: username }, here: { uid: serverMs },
//   track: { k, src: 'nb' | 'yt', id, title, artist, dur, by } | null,
//   playing, pos (seconds at startedAt), startedAt (server ms), queue: [track], radio, updatedAt
// }
// Everyone in the room computes the same position from (pos, startedAt) using the server clock,
// so play / pause / seek / skip by anyone stays in sync without streaming any audio.

export const ROOM_MAX = 10;
export const QUEUE_MAX = 50;
const HERE_MS = 75_000;
const BEAT_MS = 25_000;
const NP_MAX_AGE = 15 * 60_000;

const s = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function cleanTrack(t, by = '') {
  if (!t || typeof t !== 'object') return null;
  const src = t.src === 'yt' ? 'yt' : t.src === 'sp' ? 'sp' : '';
  const id = s(t.id, 48);
  if (!src || !id || (src === 'yt' && !/^[\w-]{6,20}$/.test(id)) || (src === 'sp' && !SP_ID.test(id))) return null;
  return {
    k: s(t.k, 24) || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    src, id, title: s(t.title, 80) || (src === 'yt' ? 'YouTube video' : src === 'sp' ? 'Spotify' : 'Nibble Beat'),
    artist: s(t.artist, 60), dur: Math.max(0, Math.min(6 * 3600, Number(t.dur) || 0)), by: s(t.by || by, 20),
  };
}

// youtube.com/watch?v=…, youtu.be/…, /shorts/…, music.youtube.com, or a bare 11-char id
export function youtubeId(text) {
  const t = String(text || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : '';
}

// YouTube playlist id from a link (…&list=PL…)
export function youtubeList(text) {
  const m = String(text || '').match(/[?&]list=([\w-]{10,64})/);
  return m ? m[1] : '';
}
// Spotify: open.spotify.com/(intl-xx/)track|album|playlist|episode/ID or spotify:track:ID → 'track:ID'
const SP_ID = /^(track|album|playlist|episode):[A-Za-z0-9]{10,32}$/;
export function spotifyId(text) {
  const t = String(text || '').trim();
  const m = t.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{10,32})/) || t.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]{10,32})$/);
  return m ? m[1] + ':' + m[2] : '';
}

export const cleanNp = (n) => (n && n.title ? { title: s(n.title, 80), artist: s(n.artist, 60), app: s(n.app, 24), room: s(n.room, 40) } : null);

export function createMusic({ db, state, emit, serverNow, requireMe, sendInvite, store, writePresence }) {
  const m = {
    room: null,       // the room you're in (live), with .id = host uid
    roomId: '',
    ended: '',        // set when the room you were in closed
    invites: [],      // [{ host, fromName, at }]
    beats: [],        // Nibble Beats catalogue (/music/beats/tracks.json)
    share: false,     // share what you're playing in Spotify / YouTube… (desktop)
    deviceNp: null,   // what this PC is playing right now (desktop only)
  };
  state.music = m;
  let unwatch = null, beat = null, lastNp = '', unInv = null;
  // invites come from two places: the inbox message (one-shot) and the rooms that list you as invited
  // (lasts, and every open session sees it — the inbox one can be taken by another tab first)
  let inboxInv = [], roomInv = [];
  const dismissed = () => store.get(key('inv-dismissed'), {});
  function mergeInvites() {
    const dis = dismissed();
    const all = [...roomInv, ...inboxInv].filter((i) => i.host !== m.roomId && !(dis[i.host] && dis[i.host] >= i.at));
    const seen = new Set();
    m.invites = all.sort((a, b) => b.at - a.at).filter((i) => (seen.has(i.host) ? false : seen.add(i.host))).slice(0, 6);
    emit();
  }

  const key = (k) => 'nibble-' + k + '-' + (state.user ? state.user.uid : 'anon');
  const loadBeats = () => Promise.resolve([]); // Nibble Beats were removed (2.0.18)

  function norm(id, d) {
    if (!d) return null;
    const now = serverNow();
    const here = d.here && typeof d.here === 'object' ? d.here : {};
    const present = Object.keys(here).filter((u) => now - Number(here[u] || 0) < HERE_MS);
    return {
      id, host: d.host, hostName: d.hostName || '', invited: Array.isArray(d.invited) ? d.invited : [],
      names: d.names || {}, here, present,
      track: d.track ? cleanTrack(d.track) : null, playing: !!d.playing, pos: Number(d.pos) || 0, startedAt: Number(d.startedAt) || 0,
      queue: (Array.isArray(d.queue) ? d.queue : []).map((t) => cleanTrack(t)).filter(Boolean),
      radio: false, updatedAt: Number(d.updatedAt) || 0,
      // Spotify-style: repeat 'off' | 'all' (the whole list again) | 'one'; shuffle picks the next song at random
      repeat: ['off', 'all', 'one'].includes(d.repeat) ? d.repeat : 'all',
      shuffle: !!d.shuffle,
      history: (Array.isArray(d.history) ? d.history : []).map((t) => cleanTrack(t)).filter(Boolean),
    };
  }

  // where the song should be right now, in seconds
  function position(r = m.room) {
    if (!r || !r.track) return 0;
    const p = r.playing ? r.pos + (serverNow() - r.startedAt) / 1000 : r.pos;
    return Math.max(0, p);
  }

  const path = (id = m.roomId) => 'rooms/' + id;
  const patch = (data) => {
    if (!m.roomId) return Promise.reject(Object.assign(new Error('Join a room first.'), { friendly: 'Join a room first.' }));
    return db.set(path(), { ...data, updatedAt: serverNow() }, true);
  };
  const me = () => state.user && state.user.uid;
  const myName = () => (state.profile && state.profile.username) || '';

  function heartbeat() {
    clearInterval(beat);
    const tick = () => { if (m.roomId && me()) db.set(path(), { here: { [me()]: serverNow() } }, true).catch(() => {}); };
    tick();
    beat = setInterval(() => { tick(); if (m.room) { m.room = norm(m.roomId, m.raw); emit(); } }, BEAT_MS);
  }

  function watch(id) {
    unwatch && unwatch();
    m.roomId = id; m.ended = '';
    store.set(key('room'), id);
    unwatch = db.watchDoc(path(id), (d) => {
      if (m.roomId !== id) return;
      if (!d) { // the host ended it (or it never existed)
        const wasIn = !!m.room;
        stopLocal();
        m.ended = wasIn ? 'The room ended.' : 'That room has closed.';
        emit(); syncPresence();
        return;
      }
      m.raw = d;
      m.room = norm(id, d);
      emit(); syncPresence();
    }, () => { stopLocal(); m.ended = 'Couldn\'t open that room.'; emit(); });
    heartbeat();
  }
  function stopLocal() {
    unwatch && unwatch(); unwatch = null;
    clearInterval(beat); beat = null;
    m.room = null; m.raw = null; m.roomId = '';
    store.set(key('room'), '');
  }

  // what friends see on your pet: the room song, else whatever this PC is playing (if you share it)
  function currentNp() {
    const r = m.room;
    if (r && r.track && r.playing) return cleanNp({ title: r.track.title, artist: r.track.artist, app: 'Nibble', room: r.id });
    if (m.share && m.deviceNp && m.deviceNp.playing !== false) return cleanNp(m.deviceNp);
    return null;
  }
  function syncPresence(force) {
    const np = currentNp();
    const j = JSON.stringify(np);
    if (!force && j === lastNp) return;
    lastNp = j;
    writePresence();
  }

  const api = {
    position,
    loadBeats,
    presence() { const np = currentNp(); return { np: np ? { ...np, at: serverNow() } : null, room: m.room ? m.room.id : '' }; },
    // friends' presence → np shown only if fresh
    friendNp(p) {
      const n = p && p.np;
      if (!n || !n.title || serverNow() - Number(n.at || 0) > NP_MAX_AGE) return null;
      return cleanNp(n);
    },

    // ----- rooms -----
    async start(inviteUids = []) {
      const uid = requireMe();
      if (m.roomId && m.roomId !== uid) await api.leave();
      const ids = [...new Set(inviteUids)].filter((u) => u !== uid).slice(0, ROOM_MAX);
      const names = { [uid]: myName() };
      for (const u of ids) { const f = state.friends.find((x) => x.uid === u); if (f) names[u] = f.username; }
      const inv = Object.fromEntries(ids.map((u) => [u, serverNow()]));
      await db.set('rooms/' + uid, {
        host: uid, hostName: myName(), invited: ids, names, inv, here: { [uid]: serverNow() },
        track: null, playing: false, pos: 0, startedAt: 0, queue: [], radio: false, repeat: 'all', shuffle: false, history: [], updatedAt: serverNow(),
      });
      watch(uid);
      const failed = [];
      await Promise.all(ids.map((u) => sendInvite(u).catch(() => failed.push(u))));
      if (failed.length === ids.length && ids.length) console.warn('[nibble] invite messages could not be sent; friends still see the invite in Music');
      loadBeats();
      return uid;
    },
    async invite(uid) {
      const mine = requireMe();
      if (!m.room || m.room.host !== mine) throw Object.assign(new Error('Only the host can invite.'), { friendly: 'Only the host can invite people.' });
      const f = state.friends.find((x) => x.uid === uid);
      if (!m.room.invited.includes(uid)) {
        if (m.room.invited.length >= ROOM_MAX) throw Object.assign(new Error('full'), { friendly: `Rooms fit ${ROOM_MAX + 1} people.` });
        await patch({ invited: [...m.room.invited, uid], names: { [uid]: f ? f.username : 'friend' }, inv: { [uid]: serverNow() } });
      } else await patch({ inv: { [uid]: serverNow() } }).catch(() => {}); // invite again = pops up again for them
      await sendInvite(uid).catch(() => {});
    },
    async join(host) {
      requireMe();
      if (m.roomId === host) return;
      if (m.roomId) await api.leave();
      inboxInv = inboxInv.filter((i) => i.host !== host);
      watch(host);
      mergeInvites();
      loadBeats();
    },
    async leave() {
      const id = m.roomId, uid = me();
      if (!id) return;
      const host = m.room && m.room.host === uid;
      stopLocal();
      m.ended = '';
      emit(); syncPresence(true);
      if (host) await db.del('rooms/' + id).catch(() => {});
      else await db.set('rooms/' + id, { here: { [uid]: 0 } }, true).catch(() => {});
    },
    dismissInvite(host) {
      const dis = dismissed(); dis[host] = serverNow() + 5000; store.set(key('inv-dismissed'), dis);
      mergeInvites();
    },
    clearEnded() { m.ended = ''; emit(); },
    // called by social.js for every 'listen' inbox item
    gotInvite(msg) {
      if (!msg || !msg.from || msg.from === m.roomId) return;
      inboxInv = [{ host: msg.from, fromName: msg.fromName || 'friend', at: msg.at || Date.now() }, ...inboxInv.filter((i) => i.host !== msg.from)].slice(0, 6);
      mergeInvites();
    },

    // ----- playback (anyone in the room) -----
    async play(track) {
      const t = cleanTrack(track, myName());
      if (!t) throw Object.assign(new Error('bad track'), { friendly: 'That doesn\'t look like a song we can play.' });
      await patch({ track: t, playing: true, pos: 0, startedAt: serverNow() + 700 });
    },
    async add(track) {
      const t = cleanTrack(track, myName());
      if (!t) throw Object.assign(new Error('bad track'), { friendly: 'That doesn\'t look like a song we can play.' });
      if (!m.room) throw Object.assign(new Error('no room'), { friendly: 'Join a room first.' });
      if (!m.room.track) return api.play(t);
      if (m.room.queue.length >= QUEUE_MAX) throw Object.assign(new Error('full'), { friendly: 'The queue is full.' });
      await patch({ queue: [...m.room.queue, t] });
    },
    // a whole playlist at once: the first one plays if nothing is on, the rest join the queue
    async addMany(tracks) {
      if (!m.room) throw Object.assign(new Error('no room'), { friendly: 'Join a room first.' });
      const list = (tracks || []).map((t) => cleanTrack(t, myName())).filter(Boolean);
      if (!list.length) return 0;
      let first = null;
      if (!m.room.track) first = list.shift();
      const room = Math.max(0, QUEUE_MAX - m.room.queue.length);
      const add = list.slice(0, room);
      const p = { queue: [...m.room.queue, ...add] };
      if (first) Object.assign(p, { track: first, playing: true, pos: 0, startedAt: serverNow() + 700 });
      await patch(p);
      return add.length + (first ? 1 : 0);
    },
    async remove(k) { if (m.room) await patch({ queue: m.room.queue.filter((t) => t.k !== k) }); },
    async playFromQueue(k) {
      if (!m.room) return;
      const t = m.room.queue.find((x) => x.k === k);
      if (!t) return;
      await patch({ queue: m.room.queue.filter((x) => x.k !== k), track: t, playing: true, pos: 0, startedAt: serverNow() + 700 });
    },
    async toggle() {
      const r = m.room;
      if (!r || !r.track) return;
      if (r.playing) await patch({ playing: false, pos: position(r) });
      else await patch({ playing: true, pos: r.track.dur && position(r) >= r.track.dur - 1 ? 0 : r.pos, startedAt: serverNow() + 400 });
    },
    async seek(sec) {
      const r = m.room;
      if (!r || !r.track) return;
      const p = Math.max(0, Math.min(r.track.dur || 1e6, Number(sec) || 0));
      await patch({ pos: p, startedAt: serverNow() + 400 });
    },
    async setRadio(on) { await patch({ radio: !!on }); },
    // song finished (or Skip): the first person to call this for track `k` moves everyone on
    // a song ended (or Skip): the first person to call this for track `k` moves everyone on.
    // Repeat one replays the song (not on Skip); Repeat all starts the played list again when the queue runs
    // out; Shuffle picks the next one at random. With Repeat off the room goes quiet at the end.
    async next(k, opts = {}) {
      const id = m.roomId;
      if (!id) return;
      await db.tx(async (t) => {
        const d = await t.get(path(id));
        if (!d) return;
        const r = norm(id, d);
        if (k && (!r.track || r.track.k !== k)) return; // someone already moved on
        const again = (x) => cleanTrack({ ...x, k: '' }); // same song, new play id
        const cur = r.track;
        let nextT = null, queue = r.queue.slice(), history = r.history.slice();
        if (cur && r.repeat === 'one' && !opts.skip) nextT = again(cur);
        else {
          if (cur) history = [...history, cur].slice(-QUEUE_MAX);
          if (!queue.length && r.repeat === 'all' && history.length) { queue = history.map(again); history = []; }
          if (queue.length) {
            const i = r.shuffle ? Math.floor(Math.random() * queue.length) : 0;
            nextT = queue[i];
            queue.splice(i, 1);
          }
        }
        t.set(path(id), { ...d, track: nextT, queue, history, playing: !!nextT, pos: 0, startedAt: serverNow() + 900, radio: false, updatedAt: serverNow() });
      });
    },
    // ⏮: the song before (or the start of this one if it's been playing a while)
    async prev() {
      const id = m.roomId, r = m.room;
      if (!id || !r) return;
      if (r.track && position(r) > 5) return api.seek(0);
      await db.tx(async (t) => {
        const d = await t.get(path(id));
        if (!d) return;
        const x = norm(id, d);
        if (!x.history.length) return;
        const before = x.history[x.history.length - 1];
        const queue = x.track ? [cleanTrack({ ...x.track, k: '' }), ...x.queue].slice(0, QUEUE_MAX) : x.queue;
        t.set(path(id), { ...d, track: cleanTrack({ ...before, k: '' }), queue, history: x.history.slice(0, -1), playing: true, pos: 0, startedAt: serverNow() + 700, updatedAt: serverNow() });
      });
    },
    async setRepeat(mode) { if (['off', 'all', 'one'].includes(mode)) await patch({ repeat: mode }); },
    async setShuffle(on) { await patch({ shuffle: !!on }); },
    // pause / play for everyone (explicit, so a pause can never turn into a play)
    async pause() {
      const r = m.room;
      if (!r || !r.track || !r.playing) return;
      await patch({ playing: false, pos: position(r) });
    },
    async resume() {
      const r = m.room;
      if (!r || !r.track || r.playing) return;
      await patch({ playing: true, pos: r.track.dur && r.pos >= r.track.dur - 1 ? 0 : r.pos, startedAt: serverNow() + 400 });
    },
    // YouTube tells us the real title/length once it loads
    async fillInfo(k, info) {
      const r = m.room;
      if (!r || !r.track || r.track.k !== k) return;
      const t = { ...r.track };
      let changed = false;
      if (info.title && (t.title === 'YouTube video' || !t.title)) { t.title = s(info.title, 80); changed = true; }
      if (info.artist && !t.artist) { t.artist = s(info.artist, 60); changed = true; }
      if (info.dur && Math.abs((t.dur || 0) - info.dur) > 2) { t.dur = Math.round(info.dur); changed = true; }
      if (changed) await patch({ track: t }).catch(() => {});
    },

    // ----- now playing (desktop: Spotify / YouTube / Apple Music… via Windows media controls) -----
    setShare(on) { m.share = !!on; store.set(key('npshare'), m.share); emit(); syncPresence(true); },
    setDeviceNp(np) {
      const n = np && np.title ? { ...cleanNp(np), playing: np.playing !== false } : null;
      if (JSON.stringify(n) === JSON.stringify(m.deviceNp)) return;
      m.deviceNp = n;
      emit(); syncPresence();
    },

    // session lifecycle (called by social.js)
    _start() {
      m.share = !!store.get(key('npshare'), false);
      const last = store.get(key('room'), '');
      // pick up where you left off after a reload / app restart, but only a room that's still alive;
      // an old room of yours is paused instead of suddenly playing yesterday's queue again
      if (last) {
        db.get(path(last)).then((d) => {
          if (!d || m.roomId) return;
          const now = serverNow();
          const here = d.here && typeof d.here === 'object' ? d.here : {};
          const others = Object.keys(here).filter((u) => u !== me() && now - Number(here[u] || 0) < HERE_MS);
          const fresh = now - Number(here[me()] || 0) < 3 * 60_000 || others.length > 0;
          if (fresh) { watch(last); return; }
          store.set(key('room'), '');
          if (d.host === me() && d.playing) db.set(path(last), { playing: false, pos: 0, updatedAt: serverNow() }, true).catch(() => {});
        }).catch(() => {});
      }
      // rooms you're invited to (needs rules 2.0.16+; quietly does nothing on older rules)
      unInv = db.watchCol('rooms', [['invited', 'array-contains', me()]], (list) => {
        const now = serverNow();
        roomInv = list.map((d) => ({ d: d.data, id: d.id }))
          .filter(({ d, id }) => d && d.host === id && id !== me() && now - Number((d.here || {})[d.host] || 0) < 10 * 60_000)
          .map(({ d, id }) => ({ host: id, fromName: d.hostName || 'friend', at: Number((d.inv || {})[me()]) || Number(d.updatedAt) || now, room: true }));
        mergeInvites();
      }, () => {});
    },
    _stop() { stopLocal(); unInv && unInv(); unInv = null; inboxInv = []; roomInv = []; m.invites = []; m.ended = ''; m.deviceNp = null; lastNp = ''; },
  };
  return api;
}
