// Tea Room actions. The server runs these (app/api/tea, app/api/admin/tea) with the service account;
// local test mode runs the very same code in the browser against the fake database.
//
// store: { get(path), set(path, data, merge), del(path), query(colPath, { where, order, limit }), incr(path, { field: n }) }
// hash(text) → hex string. On the server it's an HMAC with a secret, so nobody can work out who is
// behind a mask by hashing their friends' ids themselves.
//
// Server-only collections (never readable from a browser):
//   teaAuthors/{pid | pid_cid}   { uid, username, feed, at }   who wrote what
//   teaLimits/{uid}              { day, posts, anon, comments, reports, last }
//   teaReacts/{pid_uid}          { r }                         one reaction per person per post
//   teaReports/{flagId_uid}      { at }                        one report per person per post/comment
//   teaHidden/{flagId}           { text }                      words of a hidden post (admins can restore)
//   teaFlags/{flagId}            reported or hidden posts and comments, for Admin → Tea Room
import {
  MAX_POST, MAX_COMMENT, MAX_COMMENTS, HIDE_AT, LIMITS, REACT_KEYS, teaConfig, cleanTea, checkTea,
  maskFrom, okFeed, okId, newId, postPath, authorId, flagId, dayIndex, PROMPTS,
} from './tea';

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status, friendly: msg });

async function feedAccess(store, uid, feed, cfg) {
  if (!okFeed(feed)) throw fail('Unknown feed.');
  if (feed === 'all') {
    if (!cfg.everyone) throw fail('The Everyone feed is switched off right now.', 403);
    return null;
  }
  const g = await store.get('groups/' + feed);
  if (!g || !Array.isArray(g.members) || !g.members.includes(uid)) throw fail('You’re not in that group.', 403);
  return g;
}

async function useLimit(store, uid, kind, extra = {}) {
  const today = dayIndex();
  const l = (await store.get('teaLimits/' + uid)) || {};
  const cur = l.day === today ? l : { day: today, posts: 0, anon: 0, comments: 0, reports: 0, last: 0 };
  const now = Date.now();
  if ((kind === 'posts' || kind === 'comments') && now - (cur.last || 0) < (kind === 'posts' ? LIMITS.gapMs : LIMITS.commentGapMs)) throw fail('Slow down a little: wait a few seconds between posts.', 429);
  if ((cur[kind] || 0) >= LIMITS[kind]) throw fail(kind === 'reports' ? 'That’s enough reports for today.' : `That’s today’s limit for ${kind}. Come back tomorrow!`, 429);
  if (extra.anon && (cur.anon || 0) >= (extra.premium ? LIMITS.anonPremium : LIMITS.anon)) {
    throw fail('That’s all the anonymous posts for today. Post as yourself, or come back tomorrow.', 429);
  }
  const next = { ...cur, [kind]: (cur[kind] || 0) + 1, ...(extra.anon ? { anon: (cur.anon || 0) + 1 } : {}), ...(kind !== 'reports' ? { last: now } : {}) };
  return () => store.set('teaLimits/' + uid, next);
}

// remove a post and everything hanging off it
async function wipePost(store, feed, pid) {
  const comments = await store.query(postPath(feed, pid) + '/comments', { limit: MAX_COMMENTS + 20 }).catch(() => []);
  for (const c of comments) {
    await store.del(postPath(feed, pid, c.id)).catch(() => {});
    await store.del('teaAuthors/' + authorId(pid, c.id)).catch(() => {});
  }
  await store.del(postPath(feed, pid)).catch(() => {});
  await store.del('teaAuthors/' + pid).catch(() => {});
  await store.del('teaFlags/' + flagId(feed, pid)).catch(() => {});
}


const premiumOn = (p) => !!(p && p.active && (p.until || 0) > Date.now());

// one action from a signed-in person. Returns plain JSON for the browser.
export async function teaAction(store, uid, body, { hash }) {
  const action = String((body && body.action) || '');
  const feed = String(body.feed || '');
  const pid = String(body.pid || '');
  const cid = String(body.cid || '');
  const cfg = await store.get('config/app').catch(() => null);
  const tc = teaConfig(cfg);
  if (!tc.on) throw fail('The Tea Room is closed for now.', 403);
  if (await store.get('banned/' + uid).catch(() => null)) throw fail('This account is suspended.', 403);
  const group = await feedAccess(store, uid, feed, tc);
  const words = Array.isArray(cfg && cfg.teaWords) ? cfg.teaWords : [];

  if (action === 'post' || action === 'comment') {
    const isPost = action === 'post';
    const anon = !!body.anon;
    if (anon && !(feed === 'all' ? tc.anonAll : tc.anon)) throw fail('Anonymous posting is switched off here right now.', 403);
    const text = cleanTea(body.text, isPost ? MAX_POST : MAX_COMMENT);
    const why = checkTea(text, { anon, words });
    if (why) throw fail(why);
    let post = null;
    if (!isPost) {
      if (!okId(pid)) throw fail('Unknown post.');
      post = await store.get(postPath(feed, pid));
      if (!post || post.hidden) throw fail('That post is gone.', 404);
      if ((post.cc || 0) >= MAX_COMMENTS) throw fail('This thread is full.');
    }
    const prof = await store.get('users/' + uid);
    if (!prof || !prof.username) throw fail('Finish setting up your account first.', 403);
    const premium = anon ? premiumOn(await store.get('premium/' + uid).catch(() => null)) : false;
    const commit = await useLimit(store, uid, isPost ? 'posts' : 'comments', { anon: anon && isPost, premium });
    const id = newId();
    const thread = isPost ? id : pid;
    const at = Date.now();
    const who = anon
      ? { anon: true, mask: maskFrom(await hash(uid + ':' + thread)), by: '', name: '', skin: '', look: null }
      : { anon: false, mask: null, by: uid, name: prof.username, skin: String(prof.skin || 'mint').slice(0, 20), look: prof.style || null };
    let doc;
    if (isPost) {
      const prompt = Number.isInteger(body.prompt) && PROMPTS[body.prompt] ? body.prompt : -1;
      doc = { text, ...who, at, rc: {}, cc: 0, reports: 0, hidden: false, prompt };
      await store.set(postPath(feed, id), doc);
    } else {
      // "poster" badge when the person who started the thread replies
      const author = await store.get('teaAuthors/' + pid).catch(() => null);
      doc = { text, ...who, at, op: !!(author && author.uid === uid), reports: 0, hidden: false };
      await store.set(postPath(feed, pid, id), doc);
      await store.incr(postPath(feed, pid), { cc: 1 }).catch(() => {});
    }
    await store.set('teaAuthors/' + authorId(isPost ? id : pid, isPost ? '' : id), { uid, username: prof.username, feed, at, anon });
    await commit();
    if (isPost) {
      // group members' apps watch their group doc, so this lights up "new tea" without extra reads
      if (group) await store.set('groups/' + feed, { teaAt: at }, true).catch(() => {});
    }
    return { ok: true, id, doc };
  }

  if (!okId(pid) || (cid && !okId(cid))) throw fail('Unknown post.');

  if (action === 'react') {
    const r = String(body.r || '');
    if (r && !REACT_KEYS.includes(r)) throw fail('Unknown reaction.');
    const post = await store.get(postPath(feed, pid));
    if (!post || post.hidden) throw fail('That post is gone.', 404);
    const key = `teaReacts/${pid}_${uid}`;
    const prev = ((await store.get(key).catch(() => null)) || {}).r || '';
    if (prev === r) return { ok: true, r };
    const incs = {};
    if (prev) incs['rc.' + prev] = -1;
    if (r) incs['rc.' + r] = 1;
    await store.incr(postPath(feed, pid), incs);
    if (r) await store.set(key, { r, at: Date.now() }); else await store.del(key);
    return { ok: true, r };
  }

  if (action === 'report') {
    const fid = flagId(feed, pid, cid);
    const key = `teaReports/${fid}_${uid}`;
    if (await store.get(key).catch(() => null)) return { ok: true, already: true };
    const path = postPath(feed, pid, cid);
    const target = await store.get(path);
    if (!target) throw fail('That post is gone.', 404);
    const commit = await useLimit(store, uid, 'reports');
    await store.set(key, { at: Date.now() });
    await commit();
    const reports = (target.reports || 0) + 1;
    const hide = reports >= HIDE_AT && !target.hidden;
    const author = await store.get('teaAuthors/' + authorId(pid, cid)).catch(() => null);
    const prev = await store.get('teaFlags/' + fid).catch(() => null);
    const why = cleanTea(body.why, 80);
    await store.set('teaFlags/' + fid, {
      feed, pid, cid, text: target.text || (prev && prev.text) || '', anon: !!target.anon, mask: target.mask || null,
      authorUid: (author && author.uid) || '', authorName: (author && author.username) || '',
      reports, hidden: target.hidden || hide, reasons: [...((prev && prev.reasons) || []), why].filter(Boolean).slice(-10),
      postedAt: target.at || 0, lastAt: Date.now(),
    });
    if (hide) {
      await store.set('teaHidden/' + fid, { text: target.text || '' });
      await store.set(path, { reports, hidden: true, text: '' }, true);
    } else await store.set(path, { reports }, true);
    return { ok: true, hidden: hide };
  }

  if (action === 'remove') {
    const author = await store.get('teaAuthors/' + authorId(pid, cid)).catch(() => null);
    const mine = author && author.uid === uid;
    const owner = group && group.owner === uid;
    if (!mine && !owner) throw fail('You can only delete your own posts.', 403);
    if (cid) {
      await store.del(postPath(feed, pid, cid));
      await store.del('teaAuthors/' + authorId(pid, cid)).catch(() => {});
      await store.del('teaFlags/' + flagId(feed, pid, cid)).catch(() => {});
      await store.incr(postPath(feed, pid), { cc: -1 }).catch(() => {});
    } else await wipePost(store, feed, pid);
    return { ok: true };
  }

  throw fail('Unknown action.');
}

// ---------- admin ----------
export async function teaAdminList(store) {
  const flags = await store.query('teaFlags', { order: ['lastAt', 'desc'], limit: 60 });
  // every recent post and comment, in every feed (Everyone + groups), with who really wrote it
  const authors = await store.query('teaAuthors', { order: ['at', 'desc'], limit: 80 });
  const groupNames = {};
  const recent = (await Promise.all(authors.map(async (a) => {
    const [pid, cid] = a.id.split('_');
    const feed = a.data.feed;
    if (!okFeed(feed) || !okId(pid)) return null;
    const doc = await store.get(postPath(feed, pid, cid)).catch(() => null);
    if (!doc) return null;
    if (feed !== 'all' && !(feed in groupNames)) groupNames[feed] = ((await store.get('groups/' + feed).catch(() => null)) || {}).name || 'a group';
    const hidden = doc.hidden ? ((await store.get('teaHidden/' + flagId(feed, pid, cid)).catch(() => null)) || {}).text || '' : '';
    return {
      id: a.id, feed, feedName: feed === 'all' ? 'Everyone' : groupNames[feed], pid, cid: cid || '',
      text: doc.text || hidden, hidden: !!doc.hidden, anon: !!doc.anon, mask: doc.mask || null, at: doc.at || a.data.at,
      cc: doc.cc || 0, rc: doc.rc || {}, reports: doc.reports || 0, authorUid: a.data.uid || '', authorName: a.data.username || '',
    };
  }))).filter(Boolean);
  return { flags: flags.map((f) => ({ id: f.id, ...f.data, feedName: f.data.feed === 'all' ? 'Everyone' : groupNames[f.data.feed] || 'a group' })), recent };
}

export async function teaAdminAction(store, body) {
  const action = String(body.action || '');
  const feed = String(body.feed || ''), pid = String(body.pid || ''), cid = String(body.cid || '');
  if (!okFeed(feed) || !okId(pid) || (cid && !okId(cid))) throw fail('Unknown post.');
  const fid = flagId(feed, pid, cid);
  const path = postPath(feed, pid, cid);
  if (action === 'delete') {
    if (cid) {
      await store.del(path); await store.del('teaAuthors/' + authorId(pid, cid)).catch(() => {});
      await store.incr(postPath(feed, pid), { cc: -1 }).catch(() => {});
    } else await wipePost(store, feed, pid);
    await store.del('teaFlags/' + fid).catch(() => {});
    await store.del('teaHidden/' + fid).catch(() => {});
    return { ok: true };
  }
  const target = await store.get(path);
  if (!target) { await store.del('teaFlags/' + fid).catch(() => {}); throw fail('That post is already gone.', 404); }
  if (action === 'hide') {
    if (!target.hidden) {
      await store.set('teaHidden/' + fid, { text: target.text || '' });
      await store.set(path, { hidden: true, text: '' }, true);
    }
    const author = await store.get('teaAuthors/' + authorId(pid, cid)).catch(() => null);
    const prev = await store.get('teaFlags/' + fid).catch(() => null);
    await store.set('teaFlags/' + fid, {
      ...(prev || {}), feed, pid, cid, text: target.text || (prev && prev.text) || '', anon: !!target.anon, mask: target.mask || null,
      authorUid: (author && author.uid) || '', authorName: (author && author.username) || '',
      reports: target.reports || 0, hidden: true, reasons: (prev && prev.reasons) || ['hidden by an admin'], postedAt: target.at || 0, lastAt: Date.now(),
    });
    return { ok: true };
  }
  if (action === 'restore' || action === 'dismiss') {
    if (target.hidden) {
      const h = await store.get('teaHidden/' + fid).catch(() => null);
      await store.set(path, { hidden: false, reports: 0, text: (h && h.text) || '' }, true);
      await store.del('teaHidden/' + fid).catch(() => {});
    } else await store.set(path, { reports: 0 }, true);
    await store.del('teaFlags/' + fid).catch(() => {});
    return { ok: true };
  }
  throw fail('Unknown action.');
}
