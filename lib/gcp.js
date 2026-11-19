// Server-only access to Firestore with a Google service account (bypasses the security rules, so it
// is only ever used by trusted server code: the Stripe webhook and admin-checked API routes).
//
// Key: FIREBASE_ADMIN_KEY (service-account JSON, raw or base64), else GCP_USAGE_KEY.
// The service account needs the "Cloud Datastore User" role on the Firebase project.
import { createSign } from 'node:crypto';
import { firebaseConfig } from './social/config';

export function serviceKey() {
  for (const name of ['FIREBASE_ADMIN_KEY', 'GCP_USAGE_KEY']) {
    const raw = (process.env[name] || '').trim();
    if (!raw) continue;
    try {
      const k = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
      if (k.client_email && k.private_key) return { ...k, env: name };
    } catch {}
  }
  return null;
}

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tokens = new Map(); // scope → { token, exp }
export async function googleToken(scope = 'https://www.googleapis.com/auth/datastore') {
  const key = serviceKey();
  if (!key) throw new Error('no service account key (FIREBASE_ADMIN_KEY)');
  const hit = tokens.get(scope);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(head + '.' + body);
  const jwt = head + '.' + body + '.' + b64url(signer.sign(key.private_key.replace(/\\n/g, '\n')));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt, cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google sign-in for the service account failed: ' + (j.error_description || j.error || r.status));
  tokens.set(scope, { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}

// ---------- Firestore REST (typed values ↔ plain JS) ----------
const BASE = () => `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const okPath = (p) => /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)+$/.test(p) && p.split('/').length % 2 === 0;

export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toValue(x)])) } };
}
export function fromValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  return null;
}

async function call(method, url, body) {
  const token = await googleToken();
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + token, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

export async function fsGet(path) {
  if (!okPath(path)) throw new Error('bad path');
  const r = await call('GET', `${BASE()}/${path}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`firestore get ${r.status}: ${(r.j.error && r.j.error.message) || ''}`);
  return fromValue({ mapValue: { fields: r.j.fields || {} } });
}

// set (replace) or merge the given top-level fields
export async function fsSet(path, data, { merge = false } = {}) {
  if (!okPath(path)) throw new Error('bad path');
  const fields = toValue(data).mapValue.fields;
  const mask = merge ? '?' + Object.keys(fields).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&') : '';
  const r = await call('PATCH', `${BASE()}/${path}${mask}`, { fields });
  if (!r.ok) throw new Error(`firestore set ${r.status}: ${(r.j.error && r.j.error.message) || ''}`);
  return true;
}

export async function fsDelete(path) {
  if (!okPath(path)) throw new Error('bad path');
  const r = await call('DELETE', `${BASE()}/${path}`);
  if (!r.ok && r.status !== 404) throw new Error(`firestore delete ${r.status}`);
  return true;
}

// query one collection: fsQuery('teaRooms/all/posts', { where: [['exp', '<', 123]], order: ['at', 'desc'], limit: 20 })
// → [{ id, data }]. One order field only (no composite indexes needed).
const OPS = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', 'array-contains': 'ARRAY_CONTAINS' };
export async function fsQuery(colPath, { where = [], order, limit } = {}) {
  const segs = String(colPath).split('/');
  if (segs.length % 2 !== 1 || !segs.every((s) => /^[A-Za-z0-9_-]+$/.test(s))) throw new Error('bad path');
  const parent = segs.slice(0, -1).join('/');
  const filters = where.map(([f, op, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: OPS[op], value: toValue(v) } }));
  const sq = {
    from: [{ collectionId: segs[segs.length - 1] }],
    ...(filters.length === 1 ? { where: filters[0] } : filters.length ? { where: { compositeFilter: { op: 'AND', filters } } } : {}),
    ...(order ? { orderBy: [{ field: { fieldPath: order[0] }, direction: order[1] === 'desc' ? 'DESCENDING' : 'ASCENDING' }] } : {}),
    ...(limit ? { limit } : {}),
  };
  const r = await call('POST', `${BASE()}${parent ? '/' + parent : ''}:runQuery`, { structuredQuery: sq });
  if (!r.ok) throw new Error(`firestore query ${r.status}: ${(r.j.error && r.j.error.message) || ''}`);
  return (Array.isArray(r.j) ? r.j : []).filter((x) => x.document).map((x) => ({
    id: x.document.name.split('/').pop(),
    data: fromValue({ mapValue: { fields: x.document.fields || {} } }),
  }));
}

// add numbers to fields of an existing doc without reading it first: fsIncrement(path, { 'rc.tea': 1, cc: 1 })
export async function fsIncrement(path, incs) {
  if (!okPath(path)) throw new Error('bad path');
  const name = `projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`;
  const r = await call('POST', `${BASE()}:commit`, {
    writes: [{
      update: { name, fields: {} }, updateMask: { fieldPaths: [] }, currentDocument: { exists: true },
      updateTransforms: Object.entries(incs).map(([fieldPath, n]) => ({ fieldPath, increment: { integerValue: String(Math.trunc(n)) } })),
    }],
  });
  if (!r.ok && r.status !== 404) throw new Error(`firestore increment ${r.status}: ${(r.j.error && r.j.error.message) || ''}`);
  return r.ok;
}
