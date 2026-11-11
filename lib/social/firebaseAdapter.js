// Thin adapter over the Firebase modular SDK. social.js only talks to this interface,
// so it can run against the real backend or the local fake (fakeAdapter.js) in tests.
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut,
  setPersistence, browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore, doc, collection, getDoc, setDoc, deleteDoc, addDoc, onSnapshot, query, where,
  writeBatch, runTransaction, serverTimestamp,
} from 'firebase/firestore';

export function createFirebaseAdapter(config) {
  const app = getApps()[0] || initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  const ref = (p) => doc(db, p);
  const col = (p) => collection(db, p);
  const data = (snap) => (snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : null);

  return {
    kind: 'firebase',
    now: () => serverTimestamp(),
    auth: {
      onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, provider: (u.providerData[0] || {}).providerId || 'password' } : null)),
      signUp: (email, pw) => createUserWithEmailAndPassword(auth, email, pw),
      signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
      reset: (email) => sendPasswordResetEmail(auth, email),
      google: () => signInWithPopup(auth, new GoogleAuthProvider()),
      // Used by /link: returns the Google ID token so the desktop app can sign in too.
      googleIdToken: async () => {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        const cred = GoogleAuthProvider.credentialFromResult(res);
        return cred && cred.idToken;
      },
      googleWithToken: (idToken) => signInWithCredential(auth, GoogleAuthProvider.credential(idToken)),
      signOut: () => signOut(auth),
    },
    get: async (p) => data(await getDoc(ref(p))),
    set: (p, d, merge = false) => setDoc(ref(p), d, { merge }),
    del: (p) => deleteDoc(ref(p)),
    add: (p, d) => addDoc(col(p), d),
    watchDoc: (p, cb, onErr) => onSnapshot(ref(p), (s) => cb(data(s)), onErr || (() => cb(null))),
    watchCol: (p, filters, cb, onErr) => {
      const q = filters && filters.length ? query(col(p), ...filters.map(([f, op, v]) => where(f, op, v))) : col(p);
      return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, data: d.data({ serverTimestamps: 'estimate' }) }))), onErr || (() => cb([])));
    },
    batch: async (ops) => {
      const b = writeBatch(db);
      for (const o of ops) o.op === 'del' ? b.delete(ref(o.path)) : b.set(ref(o.path), o.data, { merge: !!o.merge });
      await b.commit();
    },
    // fn receives { get(path), set(path, data), del(path) }
    tx: (fn) => runTransaction(db, async (t) => fn({
      get: async (p) => data(await t.get(ref(p))),
      set: (p, d) => t.set(ref(p), d),
      del: (p) => t.delete(ref(p)),
    })),
  };
}
