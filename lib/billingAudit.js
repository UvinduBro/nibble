// Admin → Stripe audit log: every money action an admin takes (refund, cancel, dispute answer, block…)
// is saved to billingAudit/{id} with who did it, why and what happened. Server only (service account);
// browsers can never read or write it (see firestore.rules). Kept for 2 years.
import { randomBytes } from 'node:crypto';
import { fsSet, fsQuery, fsDelete, fsGet } from './gcp';

const KEEP_MS = 730 * 86400_000;
const clip = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, n);

export async function audit({ by, action, target, reason, amount, currency, ok, error, detail }) {
  const id = Date.now().toString(36) + randomBytes(4).toString('hex');
  const who = await fsGet('users/' + by).catch(() => null);
  await fsSet('billingAudit/' + id, {
    at: Date.now(), by: clip(by, 40), byName: clip(who && who.username, 30), action: clip(action, 40), target: clip(target, 80),
    reason: clip(reason, 200), amount: Number.isFinite(amount) ? Math.round(amount) : 0, currency: clip(currency, 3),
    ok: !!ok, error: clip(error, 300), detail: clip(detail, 300),
  }).catch((e) => console.error('audit write failed:', e && e.message));
  // now and then drop entries older than 2 years
  if (Math.random() < 0.05) {
    const old = await fsQuery('billingAudit', { where: [['at', '<', Date.now() - KEEP_MS]], limit: 20 }).catch(() => []);
    await Promise.all(old.map((d) => fsDelete('billingAudit/' + d.id).catch(() => {})));
  }
}

export async function recentAudit(n = 100) {
  const list = await fsQuery('billingAudit', { order: ['at', 'desc'], limit: n }).catch(() => []);
  return list.map((d) => ({ id: d.id, ...d.data }));
}
