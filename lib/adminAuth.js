// Admin check for API routes. The caller sends their Firebase ID token; we read admins/{uid} from
// Firestore *with that token*: Firestore verifies the token's signature + expiry, and the rules only
// let an admin read their own admin doc. So a forged or someone else's token can't pass.
import { firebaseConfig } from './social/config';

const okAdmins = new Map(); // token → { uid, until } (saves a Firestore read on every refresh)

function claims(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) || {}; } catch { return {}; }
}

export const bearer = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

// → the admin's uid, or '' when the token isn't an admin's
export async function adminUid(token) {
  if (!token || token.length > 4096 || token.split('.').length !== 3) return '';
  const hit = okAdmins.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;
  const c = claims(token);
  const uid = c.user_id || '';
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) return '';
  if (c.exp && c.exp * 1000 < Date.now()) return '';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/admins/${uid}`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!r.ok) return '';
  // never cache past the token's own expiry
  const until = Math.min(Date.now() + 10 * 60_000, c.exp ? c.exp * 1000 : Infinity);
  okAdmins.set(token, { uid, until });
  if (okAdmins.size > 50) okAdmins.delete(okAdmins.keys().next().value);
  return uid;
}

// after someone is removed as an admin, stop trusting their cached tokens on this server
export function forgetAdmin(uid) {
  for (const [t, v] of okAdmins) if (v.uid === uid) okAdmins.delete(t);
}
