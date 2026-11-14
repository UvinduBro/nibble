// In-browser fake of the Firebase adapter, for local testing only (NEXT_PUBLIC_NIBBLE_FAKE=1).
// Data lives in localStorage so two tabs of the same browser share one "backend";
// each tab has its own signed-in user (sessionStorage). No security rules are enforced here.
const KEY = 'nibble-fakedb';
const AKEY = 'nibble-fakeauth';

// like Firestore: an undefined value anywhere makes the whole write fail
function noUndef(v, p) {
  if (v === undefined) throw Object.assign(new Error('Unsupported field value: undefined (' + p + ')'), { code: 'invalid-argument' });
  if (v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) for (const k of Object.keys(v)) noUndef(v[k], p + '.' + k);
  if (Array.isArray(v)) v.forEach((x) => noUndef(x, p));
}
export function createFakeAdapter() {
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f());
  addEventListener('storage', (e) => { if (e.key === KEY) notify(); });

  const db = () => read(KEY, {});
  const save = (d) => { write(KEY, d); notify(); };
  const isChild = (path, colPath) => path.startsWith(colPath + '/') && !path.slice(colPath.length + 1).includes('/');
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  // like Firestore's set(..., { merge: true }): nested maps merge, everything else replaces
  const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v) && !v.__now;
  const deep = (a, b) => { const o = { ...(isMap(a) ? a : {}) }; for (const [k, v] of Object.entries(b)) o[k] = isMap(v) && isMap(o[k]) ? deep(o[k], v) : v; return o; };
  const resolve = (v) => (v && v.__now ? Date.now() : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)])) : v);

  let user = null;
  try { user = JSON.parse(sessionStorage.getItem('nibble-fakeuser')); } catch { user = null; }
  const authCbs = new Set();
  const setUser = (u) => { user = u; sessionStorage.setItem('nibble-fakeuser', JSON.stringify(u)); authCbs.forEach((f) => f(u)); };
  const err = (code) => Object.assign(new Error(code), { code });

  const api = {
    kind: 'fake',
    now: () => ({ __now: true }),
    auth: {
      onChange: (cb) => { authCbs.add(cb); setTimeout(() => cb(user), 30); return () => authCbs.delete(cb); },
      signUp: async (email, pw) => {
        const users = read(AKEY, {});
        if (users[email]) throw err('auth/email-already-in-use');
        if (!pw || pw.length < 6) throw err('auth/weak-password');
        users[email] = { pw, uid: 'u' + Math.random().toString(36).slice(2, 10) };
        write(AKEY, users);
        setUser({ uid: users[email].uid, email, provider: 'password' });
      },
      signIn: async (email, pw) => {
        const u = read(AKEY, {})[email];
        if (!u || u.pw !== pw) throw err('auth/invalid-credential');
        setUser({ uid: u.uid, email, provider: 'password' });
      },
      reset: async () => {},
      google: async () => { throw err('auth/operation-not-supported-in-this-environment'); },
      googleIdToken: async () => 'fake-google-token',
      googleWithToken: async () => setUser({ uid: 'g' + Math.random().toString(36).slice(2, 8), email: 'google@example.com', provider: 'google.com' }),
      signOut: async () => setUser(null),
    },
    get: async (p) => clone(db()[p]),
    set: async (p, d, merge = false) => { noUndef(d, p); const x = db(); x[p] = merge ? deep(x[p], resolve(d)) : resolve(d); save(x); },
    del: async (p) => { const x = db(); delete x[p]; save(x); },
    add: async (p, d) => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await api.set(p + '/' + id, d); return { id }; },
    watchDoc: (p, cb) => {
      let last;
      const run = () => { const v = JSON.stringify(db()[p] ?? null); if (v !== last) { last = v; cb(JSON.parse(v)); } };
      listeners.add(run); setTimeout(run, 0);
      return () => listeners.delete(run);
    },
    top: async (p, field, n) => {
      const all = db();
      return Object.keys(all).filter((k) => isChild(k, p) && typeof all[k][field] === 'number')
        .sort((a, b) => all[b][field] - all[a][field]).slice(0, n).map((k) => ({ id: k.slice(p.length + 1), data: clone(all[k]) }));
    },
    watchCol: (p, filters, cb) => {
      let last;
      const run = () => {
        const all = db();
        const list = Object.keys(all).filter((k) => isChild(k, p))
          .filter((k) => (filters || []).every(([f, op, v]) => (op === 'array-contains' ? Array.isArray(all[k][f]) && all[k][f].includes(v) : all[k][f] === v)))
          .map((k) => ({ id: k.slice(p.length + 1), data: all[k] }));
        const v = JSON.stringify(list);
        if (v !== last) { last = v; cb(JSON.parse(v)); }
      };
      listeners.add(run); setTimeout(run, 0);
      return () => listeners.delete(run);
    },
    batch: async (ops) => {
      const x = db();
      for (const o of ops) { if (o.op === 'del') delete x[o.path]; else x[o.path] = o.merge ? deep(x[o.path], resolve(o.data)) : resolve(o.data); }
      save(x);
    },
    tx: async (fn) => {
      const ops = [];
      const out = await fn({ get: async (p) => clone(db()[p]), set: (p, d) => ops.push({ op: 'set', path: p, data: d }), del: (p) => ops.push({ op: 'del', path: p }) });
      await api.batch(ops);
      return out;
    },
  };
  return api;
}
