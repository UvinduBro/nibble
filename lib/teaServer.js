// Server side of the Tea Room: the Firestore store (service account) and the secret mask hash.
import { createHash, createHmac } from 'node:crypto';
import { fsGet, fsSet, fsDelete, fsQuery, fsIncrement, serviceKey } from './gcp';

export const teaStore = {
  get: (p) => fsGet(p),
  set: (p, d, merge = false) => fsSet(p, d, { merge }),
  del: (p) => fsDelete(p),
  query: (p, o) => fsQuery(p, o),
  incr: (p, incs) => fsIncrement(p, incs),
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
