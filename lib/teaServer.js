// Server side of the Tea Room: the Firestore store (service account) and the secret mask hash.
import { createHash, createHmac } from 'node:crypto';
import { fsGet, fsSet, fsDelete, fsQuery, fsIncrement, serviceKey, googleToken } from './gcp';
import { firebaseConfig } from './social/config';

export const teaStore = {
  get: (p) => fsGet(p),
  set: (p, d, merge = false) => fsSet(p, d, { merge }),
  del: (p) => fsDelete(p),
  query: (p, o) => fsQuery(p, o),
  incr: (p, incs) => fsIncrement(p, incs),
  bucket: firebaseConfig.storageBucket,
  // delete a post's picture from Firebase Storage (best effort: needs the service account to have a
  // Storage role; if it can't, the file just stays)
  async delFile(url) {
    const m = /\/o\/(tea%2F[A-Za-z0-9]{20,40}\.(?:webp|jpg))\?/.exec(String(url || ''));
    if (!m) return;
    const token = await googleToken('https://www.googleapis.com/auth/devstorage.read_write');
    await fetch(`https://storage.googleapis.com/storage/v1/b/${firebaseConfig.storageBucket}/o/${m[1]}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + token } });
  },
};

// The mask behind an anonymous post is HMAC(secret, uid:thread). Without the secret nobody can
// match a mask to a person. TEA_SALT (optional) → NET_SALT → derived from the service-account key.
function salt() {
  const s = (process.env.TEA_SALT || process.env.NET_SALT || '').trim();
  if (s) return s;
  const k = serviceKey();
  return k ? createHash('sha256').update('nibble-tea:' + k.private_key).digest('hex') : '';
}
export function teaHash(text) {
  const s = salt();
  if (!s) throw Object.assign(new Error('The Tea Room isn’t set up on the server yet.'), { status: 503 });
  return createHmac('sha256', s).update(text).digest('hex');
}
export const teaReady = () => !!serviceKey();
