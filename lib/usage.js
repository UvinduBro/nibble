// Firestore usage for the admin dashboard, read from Google Cloud Monitoring.
// Needs a service account key (JSON) in the Vercel env var GCP_USAGE_KEY, with the
// "Monitoring Viewer" role on the Firebase project. No extra npm packages: the OAuth token is
// signed here with node:crypto.
import { createSign } from 'node:crypto';

export const FREE = { reads: 50_000, writes: 20_000, deletes: 20_000 }; // Spark plan, per day
const METRICS = {
  reads: 'firestore.googleapis.com/document/read_count',
  writes: 'firestore.googleapis.com/document/write_count',
  deletes: 'firestore.googleapis.com/document/delete_count',
};
const HOUR = 3600_000;

// The free quota resets at midnight Pacific time. Returns that midnight (ms) for the given instant.
export function pacificMidnight(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now)).reduce((o, p) => ((o[p.type] = p.value), o), {});
  const sinceMidnight = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + (now % 1000);
  return now - sinceMidnight;
}
// Pacific calendar day label (YYYY-MM-DD) for an instant
export function pacificDay(t) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}

export function readKey() {
  const raw = process.env.GCP_USAGE_KEY || '';
  if (!raw.trim()) return null;
  try {
    const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const k = JSON.parse(txt);
    if (!k.client_email || !k.private_key) return null;
    return k;
  } catch { return null; }
}

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let tokenCache = null;
async function accessToken(key) {
  if (tokenCache && tokenCache.exp - 60_000 > Date.now()) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/monitoring.read', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(head + '.' + body);
  const jwt = head + '.' + body + '.' + b64url(signer.sign(key.private_key.replace(/\\n/g, '\n')));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google sign-in for the usage key failed: ' + (j.error_description || j.error || r.status));
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

// hourly sums for one metric, as [{ t: hourStartMs, n }]
async function series(token, project, metric, start, end) {
  const q = new URLSearchParams({
    filter: `metric.type="${metric}"`,
    'interval.startTime': new Date(start).toISOString(),
    'interval.endTime': new Date(end).toISOString(),
    'aggregation.alignmentPeriod': '3600s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${q}`, { headers: { authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || String(r.status);
    if (/has not been used|is disabled/i.test(msg)) throw new Error('Turn on the Cloud Monitoring API for the project (see the setup steps).');
    if (r.status === 403) throw new Error('The usage key needs the "Monitoring Viewer" role.');
    throw new Error('Cloud Monitoring: ' + msg);
  }
  return parsePoints(j);
}

export function parsePoints(j) {
  const out = new Map();
  for (const ts of j.timeSeries || []) {
    for (const p of ts.points || []) {
      const t = Date.parse(p.interval && (p.interval.startTime || p.interval.endTime));
      const v = p.value || {};
      const n = Number(v.int64Value != null ? v.int64Value : v.doubleValue != null ? v.doubleValue : 0) || 0;
      if (!Number.isFinite(t)) continue;
      const h = t - (t % HOUR);
      out.set(h, (out.get(h) || 0) + n);
    }
  }
  return [...out.entries()].map(([t, n]) => ({ t, n })).sort((a, b) => a.t - b.t);
}

// Today (since Pacific midnight), each hour today, and the last 7 Pacific days.
export function summarize(byMetric, now = Date.now()) {
  const mid = pacificMidnight(now);
  const today = {}, hours = new Map(), days = new Map();
  for (const [k, pts] of Object.entries(byMetric)) {
    today[k] = 0;
    for (const { t, n } of pts) {
      const d = pacificDay(t + HOUR / 2);
      const day = days.get(d) || { day: d, reads: 0, writes: 0, deletes: 0 };
      day[k] += n; days.set(d, day);
      if (t + HOUR > mid) {
        today[k] += n;
        const h = hours.get(t) || { t, reads: 0, writes: 0, deletes: 0 };
        h[k] += n; hours.set(t, h);
      }
    }
  }
  return {
    today, limits: FREE,
    hours: [...hours.values()].sort((a, b) => a.t - b.t),
    days: [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-7),
    resetAt: mid + 24 * HOUR,
  };
}

let cache = null;
export async function getUsage(project) {
  const key = readKey();
  if (!key) return { configured: false, limits: FREE, resetAt: pacificMidnight() + 24 * HOUR };
  if (cache && Date.now() - cache.at < 2 * 60_000) return cache.data;
  const token = await accessToken(key);
  const end = Date.now(), start = pacificMidnight(end) - 6 * 24 * HOUR;
  const entries = await Promise.all(Object.entries(METRICS).map(async ([k, m]) => [k, await series(token, key.project_id || project, m, start, end)]));
  const data = { configured: true, at: end, ...summarize(Object.fromEntries(entries), end) };
  cache = { at: Date.now(), data };
  return data;
}
