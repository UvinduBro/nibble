// Tea Room in the app. Reading is straight from Firestore (one page of 20 at a time, no live
// listeners, to stay inside the free quota); writing goes through /api/tea so anonymous posts stay
// anonymous. In local test mode (fake backend) the same server code runs right here.
import { PAGE, teaConfig } from '../tea';
import { teaAction, teaAdminList, teaAdminAction } from '../teaCore';

const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);
// test mode only: a stand-in for the server's secret hash
const fakeHash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };

export function createTea({ db, state, emit, apiCall, requireMe, store }) {
  state.teaNew = false;
  let timer = null;
  const k = (name) => `nibble-tea-${name}-${state.user ? state.user.uid : 'anon'}`;

  const fakeStore = {
    test: true,
    get: (p) => db.get(p),
    set: (p, d, merge) => db.set(p, d, !!merge),
    del: (p) => db.del(p),
    query: (p, o) => db.list(p, o),
    incr: async (p, incs) => {
      const d = await db.get(p);
      if (!d) return false;
      for (const [path, n] of Object.entries(incs)) {
        const keys = path.split('.'); let o = d;
        for (const x of keys.slice(0, -1)) o = o[x] = o[x] && typeof o[x] === 'object' ? o[x] : {};
        const last = keys[keys.length - 1]; o[last] = (Number(o[last]) || 0) + n;
      }
      await db.set(p, d);
      return true;
    },
  };
  const call = async (body) => (db.kind === 'fake' ? teaAction(fakeStore, requireMe(), body, { hash: fakeHash }) : apiCall('/api/tea', body));

  const clean = (d) => ({ id: d.id, ...d.data, at: ms(d.data.at), rc: d.data.rc || {} });
  const remember = (name, id, v, max = 300) => {
    const m = store.get(k(name), {});
    if (v === undefined) delete m[id]; else m[id] = v;
    const keys = Object.keys(m);
    if (keys.length > max) for (const x of keys.slice(0, keys.length - max)) delete m[x];
    store.set(k(name), m);
  };

  const api = {
    config: () => teaConfig(state.config),
    // the feeds you can read: Everyone (if on) + each of your groups
    feeds() {
      const c = teaConfig(state.config);
      return [...(c.everyone ? [{ id: 'all', name: 'Everyone', emoji: '🌍' }] : []), ...(state.groups || []).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, group: true }))];
    },
    // one page of posts, newest first. after = the `at` of the last post you have
    async load(feed, after) {
      const raw = await db.list(`teaRooms/${feed}/posts`, { order: ['at', 'desc'], limit: PAGE, ...(after ? { after } : {}) });
      // posts stay forever (older posts may still carry an old `exp` field; it's ignored)
      const posts = raw.map(clean).filter((p) => !p.hidden);
      if (feed === 'all' && !after) api.markSeen(posts[0] ? posts[0].at : 0);
      return { posts, more: raw.length === PAGE, last: raw.length ? ms(raw[raw.length - 1].data.at) : 0 };
    },
    async comments(feed, pid) {
      const raw = await db.list(`teaRooms/${feed}/posts/${pid}/comments`, { order: ['at', 'asc'], limit: 120 });
      return raw.map(clean).filter((c) => !c.hidden);
    },
    async post(feed, text, anon, prompt = -1, media = {}) {
      const r = await call({ action: 'post', feed, text, anon: !!anon, prompt, ...(media.img ? { img: media.img } : {}), ...(media.gif ? { gif: media.gif } : {}) });
      remember('mine', r.id, 1);
      return r;
    },
    async comment(feed, pid, text, anon, media = {}) {
      const r = await call({ action: 'comment', feed, pid, text, anon: !!anon, ...(media.gif ? { gif: media.gif } : {}) });
      remember('mine', pid + '_' + r.id, 1);
      return r;
    },
    myReact: (pid) => store.get(k('rx'), {})[pid] || '',
    isMine: (pid, cid) => !!store.get(k('mine'), {})[cid ? pid + '_' + cid : pid],
    async react(feed, pid, r) {
      const res = await call({ action: 'react', feed, pid, r });
      remember('rx', pid, res.r || undefined);
      return res.r;
    },
    report: (feed, pid, cid, why) => call({ action: 'report', feed, pid, cid: cid || '', why: why || '' }),
    async remove(feed, pid, cid) { await call({ action: 'remove', feed, pid, cid: cid || '' }); remember('mine', cid ? pid + '_' + cid : pid, undefined); },

    // "new tea" badge for the Everyone feed: one tiny read at start and every 30 minutes (only when visible)
    markSeen(at) { const prev = store.get(k('seen'), 0); if (at > prev) store.set(k('seen'), at); if (state.teaNew) { state.teaNew = false; emit(); } },
    async checkNew() {
      const c = teaConfig(state.config);
      if (!c.on || !c.everyone || !state.profile) return;
      const top = await db.list('teaRooms/all/posts', { order: ['at', 'desc'], limit: 1 }).catch(() => []);
      const at = top[0] ? ms(top[0].data.at) : 0;
      const mine = top[0] && top[0].data.by === (state.user && state.user.uid);
      const was = state.teaNew;
      state.teaNew = !!at && !mine && at > store.get(k('seen'), 0);
      if (was !== state.teaNew) emit();
    },
    _start() {
      api._stop();
      const first = setTimeout(() => api.checkNew(), 15_000);
      const every = setInterval(() => { if (typeof document === 'undefined' || (!document.hidden && !(typeof window !== 'undefined' && window.__nibbleHidden))) api.checkNew(); }, 30 * 60_000);
      timer = () => { clearTimeout(first); clearInterval(every); };
    },
    _stop() { if (timer) timer(); timer = null; state.teaNew = false; },

    // Admin → Tea Room (reported / hidden posts, recent Everyone posts with their authors)
    admin: {
      list: () => (db.kind === 'fake' ? teaAdminList(fakeStore) : apiCall('/api/admin/tea')),
      act: (body) => (db.kind === 'fake' ? teaAdminAction(fakeStore, body) : apiCall('/api/admin/tea', body)),
    },
  };
  return api;
}
