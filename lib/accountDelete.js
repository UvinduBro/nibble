// "Delete my account" (Settings, website + phone app). Apple (5.1.1(v)) and Google Play both require that
// people can delete their account from inside the app. Server only: uses the service account (lib/gcp.js).
//
// Order matters:
//  1. the caller's Firebase ID token is checked (accounts:lookup)
//  2. a live Premium subscription is cancelled at Stripe, so nobody is charged for a deleted account
//  3. the Firebase sign-in account is deleted *with the person's own token* (needs a recent sign-in;
//     if it's too old we stop here and ask them to sign in again, before anything is removed)
//  4. their Nibble data is removed. Payment records (billingCustomers, billingAudit, billingEvents,
//     billingFlags) are kept: tax and fraud rules require them, and they hold no profile data.
import { firebaseConfig } from './social/config';
import { fsGet, fsSet, fsDelete, fsQuery } from './gcp';

const UID_RE = /^[A-Za-z0-9]{10,40}$/;
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const each = async (list, fn) => { for (const x of list || []) await safe(() => fn(x)); };

async function idt(method, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j, code: String((j.error && j.error.message) || '') };
}

// → { uid, lastLoginAt } for a valid token, else null
export async function whoIs(token) {
  if (!token || token.length > 4096 || token.split('.').length !== 3) return null;
  const r = await idt('lookup', { idToken: token });
  const u = r.ok && (r.j.users || [])[0];
  if (!u || !UID_RE.test(u.localId || '')) return null;
  return { uid: u.localId, lastLoginAt: Number(u.lastLoginAt) || 0 };
}

async function cancelStripe(uid) {
  const prem = await safe(() => fsGet('premium/' + uid));
  if (!prem || prem.source !== 'stripe') return 'none';
  // the Stripe SDK is only loaded when this person actually had a subscription
  const { getStripe, findCustomer, subUid, ACTIVE } = await import('./billing');
  const customer = await findCustomer(uid);
  if (!customer) return 'none';
  const subs = ((await getStripe().subscriptions.list({ customer, status: 'all', limit: 20 })).data || [])
    .filter((s) => subUid(s) === uid && (ACTIVE.includes(s.status) || s.status === 'paused' || s.status === 'incomplete'));
  for (const s of subs) await getStripe().subscriptions.cancel(s.id, { cancellation_details: { comment: 'Account deleted by the user' } });
  return subs.length ? 'cancelled' : 'none';
}

async function wipeData(uid) {
  const prof = await safe(() => fsGet('users/' + uid));
  const username = prof && typeof prof.username === 'string' ? prof.username : '';

  // friends: take yourself off every friend's list, then your own list
  const friends = (await safe(() => fsQuery(`users/${uid}/friends`, { limit: 500 }))) || [];
  await each(friends, (f) => fsDelete(`users/${f.id}/friends/${uid}`));
  await each(friends, (f) => fsDelete(`users/${uid}/friends/${f.id}`));

  // friend requests both ways
  for (const field of ['from', 'to']) {
    const reqs = (await safe(() => fsQuery('requests', { where: [[field, '==', uid]], limit: 500 }))) || [];
    await each(reqs, (r) => fsDelete('requests/' + r.id));
  }

  // inbox, private notes
  const inbox = (await safe(() => fsQuery(`inbox/${uid}/items`, { limit: 500 }))) || [];
  await each(inbox, (d) => fsDelete(`inbox/${uid}/items/${d.id}`));
  await each(['about', 'deadlines'], (d) => fsDelete(`users/${uid}/private/${d}`));
  await fsDelete('pushSubs/' + uid).catch(() => {}); // this person's notification devices

  // groups: delete the ones you own, leave the others
  const groups = (await safe(() => fsQuery('groups', { where: [['members', 'array-contains', uid]], limit: 50 }))) || [];
  await each(groups, async (g) => {
    if (g.data.owner === uid) {
      const msgs = (await safe(() => fsQuery(`groups/${g.id}/msgs`, { limit: 500 }))) || [];
      await each(msgs, (m) => fsDelete(`groups/${g.id}/msgs/${m.id}`));
      await fsDelete('groups/' + g.id);
    } else {
      const names = { ...(g.data.names || {}) }; delete names[uid];
      await fsSet('groups/' + g.id, { members: (g.data.members || []).filter((x) => x !== uid), names, updatedAt: new Date() }, { merge: true });
    }
  });
  const invited = (await safe(() => fsQuery('groups', { where: [['invited', 'array-contains', uid]], limit: 50 }))) || [];
  await each(invited, (g) => fsSet('groups/' + g.id, { invited: (g.data.invited || []).filter((x) => x !== uid) }, { merge: true }));

  // shared reminders: delete yours, leave the others
  const rems = (await safe(() => fsQuery('reminders', { where: [['people', 'array-contains', uid]], limit: 200 }))) || [];
  await each(rems, (r) => (r.data.owner === uid
    ? fsDelete('reminders/' + r.id)
    : fsSet('reminders/' + r.id, { people: (r.data.people || []).filter((x) => x !== uid) }, { merge: true })));

  // Tea Room posts and comments you wrote (anonymous ones too)
  const tea = (await safe(() => fsQuery('teaAuthors', { where: [['uid', '==', uid]], limit: 500 }))) || [];
  await each(tea, async (t) => {
    const feed = String(t.data.feed || '');
    const [pid, cid] = t.id.split('_');
    if (/^[A-Za-z0-9_-]{1,60}$/.test(feed) && pid) {
      if (cid) await safe(() => fsDelete(`teaRooms/${feed}/posts/${pid}/comments/${cid}`));
      else await safe(() => fsDelete(`teaRooms/${feed}/posts/${pid}`));
    }
    await fsDelete('teaAuthors/' + t.id);
  });

  // single docs
  await each(['users', 'presence', 'wallets', 'signup', 'reviews', 'rooms', 'premium', 'banned'], (c) => fsDelete(`${c}/${uid}`));
  if (/^[a-z0-9_]{3,20}$/.test(username)) {
    const claim = await safe(() => fsGet('usernames/' + username));
    if (claim && claim.uid === uid) await safe(() => fsDelete('usernames/' + username));
  }
  return { username };
}

// → { ok: true } | { ok: false, code, error }
export async function deleteAccount(token) {
  const who = await whoIs(token);
  if (!who) return { ok: false, code: 'auth', error: 'Please sign in again.' };
  const uid = who.uid;
  // Firebase only deletes accounts with a recent sign-in; check before touching anything
  if (who.lastLoginAt && Date.now() - who.lastLoginAt > 4 * 60_000) {
    return { ok: false, code: 'recent', error: 'For your safety, sign out and sign in again, then delete your account straight away.' };
  }
  let stripe = 'none';
  try { stripe = await cancelStripe(uid); }
  catch { return { ok: false, code: 'stripe', error: 'We couldn’t cancel your Premium subscription just now, so nothing was deleted. Try again in a minute.' }; }
  const del = await idt('delete', { idToken: token });
  if (!del.ok) {
    if (/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED|INVALID_ID_TOKEN/.test(del.code)) return { ok: false, code: 'recent', error: 'For your safety, sign out and sign in again, then delete your account straight away.' };
    if (!/USER_NOT_FOUND/.test(del.code)) return { ok: false, code: 'auth', error: 'Couldn’t delete the account right now. Try again in a minute.' };
  }
  await wipeData(uid).catch(() => {});
  return { ok: true, stripe };
}
