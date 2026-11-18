// Reviews from real Nibble users: one per account, written in the app, shown on the website only
// after an admin approves it. Never invented, never edited by us (admins can only approve, hide,
// feature or reply).
//
// reviews/{uid} = { uid, username, skin, rating 1-5, text, show (ok to show publicly), client,
//                   status 'pending' | 'approved' | 'hidden', featured, reply, at, updatedAt }
import { firebaseConfig } from './social/config';

export const MAX_REVIEW = 400, MIN_REVIEW = 10;
export const REVIEWS_TAG = 'reviews';

const s = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
export function cleanReview(id, d) {
  if (!d || typeof d !== 'object') return null;
  const rating = Math.round(Number(d.rating));
  if (!(rating >= 1 && rating <= 5)) return null;
  return {
    id, uid: s(d.uid, 40), username: s(d.username, 20), skin: s(d.skin, 20) || 'mint', rating,
    text: s(d.text, MAX_REVIEW), client: s(d.client, 16), status: ['approved', 'hidden'].includes(d.status) ? d.status : 'pending',
    featured: d.featured === true, show: d.show !== false, reply: s(d.reply, 300),
    at: typeof d.at === 'number' ? d.at : Date.parse(d.at) || 0, updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.parse(d.updatedAt) || 0,
  };
}

export const summarize = (list) => {
  const n = list.length;
  const avg = n ? list.reduce((t, r) => t + r.rating, 0) / n : 0;
  const counts = [5, 4, 3, 2, 1].map((k) => [k, list.filter((r) => r.rating === k).length]);
  return { count: n, avg: Math.round(avg * 10) / 10, counts };
};

// Server: approved, public reviews for the website (Firestore REST; the rules only allow listing
// approved ones). Cached, refreshed every 10 minutes or when an admin approves one.
export async function approvedReviews() {
  try {
    const base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
    const r = await fetch(`${base}:runQuery?key=${firebaseConfig.apiKey}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'reviews' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }, limit: 200 } }),
      next: { revalidate: 600, tags: [REVIEWS_TAG] },
    });
    if (!r.ok) return [];
    const rows = await r.json();
    const val = (v) => (v == null ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'timestampValue' in v ? Date.parse(v.timestampValue) : null);
    return rows.filter((x) => x.document).map((x) => {
      const f = x.document.fields || {};
      return cleanReview(x.document.name.split('/').pop(), Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)])));
    }).filter((r) => r && r.status === 'approved' && r.show)
      .sort((a, b) => (b.featured - a.featured) || (b.at - a.at));
  } catch {
    return [];
  }
}
