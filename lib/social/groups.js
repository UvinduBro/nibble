// Groups: a few friends together, with a 24-hour group chat, a pack walk, a group Tea Room feed,
// "poke everyone", listening together and a group points board.
//
// Firestore (see firestore.rules):
//   groups/{gid}            { owner, name, emoji, members: [uid] (≤20), invited: [uid] (≤20),
//                             names: { uid: username }, at, updatedAt, chatAt, chatBy, teaAt }
//   groups/{gid}/msgs/{id}  { from, fromName, text, at, exp (ms) }   members only, gone after 24 h
//
// Reads are kept low: one listener for your groups and one for your invites (they only fire when a
// group changes); the chat listener runs only while a group chat is open.

export const MAX_GROUPS = 10;
export const MAX_MEMBERS = 20;
export const GROUP_MSG_TTL = 24 * 3600_000;
export const MAX_GROUP_MSG = 200;
export const MAX_GROUP_NAME = 30;
export const GROUP_EMOJIS = ['🐾', '🍵', '🎮', '🎧', '📚', '💼', '🌸', '🔥', '🍕', '⭐', '🌙', '🐸', '💜', '🏀', '✈️', '🎨'];

const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);
const cleanName = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_GROUP_NAME);

export function createGroups({ db, state, emit, requireMe, fail, serverNow, store }) {
  state.groups = [];
  state.groupInvites = [];
  let unsubs = [];
  let mine = [], invites = [];
  const seenKey = () => 'nibble-gseen-' + (state.user ? state.user.uid : 'anon');
  let seen = {};

  const view = (id, d) => ({
    id, owner: d.owner, name: d.name || 'Group', emoji: d.emoji || '🐾',
    members: Array.isArray(d.members) ? d.members : [], invited: Array.isArray(d.invited) ? d.invited : [],
    names: d.names && typeof d.names === 'object' ? d.names : {},
    at: ms(d.at), chatAt: ms(d.chatAt), chatBy: d.chatBy || '', teaAt: Number(d.teaAt) || 0,
  });
  const publish = () => {
    const uid = state.user && state.user.uid;
    state.groups = mine.map((g) => ({
      ...g,
      unreadChat: !!g.chatAt && g.chatAt > ((seen[g.id] || {}).chat || g.at) && g.chatBy !== (state.profile && state.profile.username),
      newTea: !!g.teaAt && g.teaAt > ((seen[g.id] || {}).tea || g.at),
      isOwner: g.owner === uid,
    })).sort((a, b) => Math.max(b.chatAt, b.teaAt, b.at) - Math.max(a.chatAt, a.teaAt, a.at));
    state.groupInvites = invites.filter((g) => !g.members.includes(uid));
    emit();
  };

  async function change(gid, fn) {
    await db.tx(async (t) => {
      const g = await t.get('groups/' + gid);
      if (!g) throw fail('That group doesn’t exist any more.');
      const next = fn(g);
      if (next) t.set('groups/' + gid, { ...g, ...next, updatedAt: db.now() });
    });
  }
  const friendName = (uid) => { const f = state.friends.find((x) => x.uid === uid); return f ? f.username : ''; };

  const api = {
    _start(uid) {
      api._stop();
      seen = store.get(seenKey(), {});
      unsubs.push(db.watchCol('groups', [['members', 'array-contains', uid]], (list) => { mine = list.map((d) => view(d.id, d.data)); publish(); }, () => { mine = []; publish(); }));
      unsubs.push(db.watchCol('groups', [['invited', 'array-contains', uid]], (list) => { invites = list.map((d) => view(d.id, d.data)); publish(); }, () => { invites = []; publish(); }));
    },
    _stop() { unsubs.forEach((u) => u && u()); unsubs = []; mine = []; invites = []; state.groups = []; state.groupInvites = []; },

    // you opened a group's chat or Tea Room feed: clear its badge
    markSeen(gid, kind) {
      const g = mine.find((x) => x.id === gid);
      if (!g) return;
      seen = { ...seen, [gid]: { ...(seen[gid] || {}), [kind]: Math.max(Date.now(), kind === 'chat' ? g.chatAt : g.teaAt) } };
      store.set(seenKey(), seen);
      publish();
    },

    async create(name, emoji, inviteUids = []) {
      const uid = requireMe();
      const n = cleanName(name);
      if (!n) throw fail('Give your group a name.');
      if (mine.length >= MAX_GROUPS) throw fail(`You’re in ${MAX_GROUPS} groups already. Leave one first.`);
      const id = uid.slice(0, 6) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await db.set('groups/' + id, {
        owner: uid, name: n, emoji: GROUP_EMOJIS.includes(emoji) ? emoji : '🐾', members: [uid], invited: [],
        names: { [uid]: state.profile.username }, at: db.now(), updatedAt: db.now(),
      });
      // invites go one at a time (the rules check each person is your friend)
      let sent = 0;
      for (const f of [...new Set(inviteUids)].slice(0, MAX_MEMBERS - 1)) { try { await api.invite(id, f); sent++; } catch {} }
      return { id, sent };
    },
    async invite(gid, fuid) {
      const uid = requireMe();
      const name = friendName(fuid);
      if (!name) throw fail('You can only invite your friends.');
      await change(gid, (g) => {
        if (!g.members.includes(uid)) throw fail('You’re not in this group.');
        if (g.members.includes(fuid)) throw fail(`@${name} is already in the group.`);
        if (g.invited.includes(fuid)) return null; // already invited
        if (g.members.length + g.invited.length >= MAX_MEMBERS) throw fail(`Groups hold up to ${MAX_MEMBERS} people.`);
        return { invited: [...g.invited, fuid], names: { ...g.names, [fuid]: name } };
      });
    },
    async accept(gid) {
      const uid = requireMe();
      if (mine.length >= MAX_GROUPS) throw fail(`You’re in ${MAX_GROUPS} groups already. Leave one first.`);
      await change(gid, (g) => {
        if (!g.invited.includes(uid)) throw fail('That invite was cancelled.');
        if (g.members.length >= MAX_MEMBERS) throw fail('That group is full.');
        return { members: [...g.members, uid], invited: g.invited.filter((x) => x !== uid), names: { ...g.names, [uid]: state.profile.username } };
      });
    },
    async decline(gid) {
      const uid = requireMe();
      await change(gid, (g) => (g.invited.includes(uid) ? { invited: g.invited.filter((x) => x !== uid) } : null));
    },
    async leave(gid) {
      const uid = requireMe();
      const g = mine.find((x) => x.id === gid);
      if (g && g.owner === uid) {
        // the owner leaving ends the group for everyone
        if (g.members.length > 1) throw fail('You made this group. Remove everyone or delete the group instead.');
        return api.remove(gid);
      }
      await change(gid, (d) => (d.members.includes(uid) ? { members: d.members.filter((x) => x !== uid) } : null));
    },
    // owner: take someone out (member or pending invite)
    async kick(gid, who) {
      requireMe();
      await change(gid, (g) => ({ members: g.members.filter((x) => x !== who || x === g.owner), invited: g.invited.filter((x) => x !== who) }));
    },
    async rename(gid, name, emoji) {
      requireMe();
      const n = cleanName(name);
      if (!n) throw fail('Give your group a name.');
      await change(gid, () => ({ name: n, emoji: GROUP_EMOJIS.includes(emoji) ? emoji : '🐾' }));
    },
    // owner: delete the group (and its chat) for everyone
    async remove(gid) {
      requireMe();
      const msgs = await db.list('groups/' + gid + '/msgs', { limit: 200 }).catch(() => []);
      for (let i = 0; i < msgs.length; i += 400) await db.batch(msgs.slice(i, i + 400).map((m) => ({ op: 'del', path: `groups/${gid}/msgs/${m.id}` }))).catch(() => {});
      await db.del('groups/' + gid);
    },

    // live chat while it's open: newest 60 messages, oldest first
    watchChat(gid, cb) {
      let swept = false;
      return db.watchQuery('groups/' + gid + '/msgs', { order: ['at', 'desc'], limit: 60 }, (list) => {
        const now = serverNow();
        const all = list.map((d) => ({ id: d.id, ...d.data, at: ms(d.data.at) || Date.now() }));
        cb(all.filter((m) => (m.exp || 0) > now).reverse());
        // tidy up a few expired messages (any member may delete them)
        if (!swept) {
          swept = true;
          const old = all.filter((m) => (m.exp || 0) <= now).slice(0, 8);
          if (old.length) db.batch(old.map((m) => ({ op: 'del', path: `groups/${gid}/msgs/${m.id}` }))).catch(() => {});
        }
      }, () => cb(null));
    },
    async send(gid, raw) {
      const uid = requireMe();
      const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_GROUP_MSG);
      if (!text) return null;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await db.batch([
        { op: 'set', path: `groups/${gid}/msgs/${id}`, data: { from: uid, fromName: state.profile.username, text, at: db.now(), exp: Math.floor(serverNow() + GROUP_MSG_TTL) } },
        // members' apps watch the group doc, so this is how they see "new message" without a chat listener
        { op: 'set', path: 'groups/' + gid, data: { chatAt: db.now(), chatBy: state.profile.username, updatedAt: db.now() }, merge: true },
      ]);
      seen = { ...seen, [gid]: { ...(seen[gid] || {}), chat: Date.now() + 5000 } };
      store.set(seenKey(), seen);
      return text;
    },
    async deleteMsg(gid, id) { await db.del(`groups/${gid}/msgs/${id}`); },

    // points earned all-time by each member (one-off read, cached for 5 minutes)
    _pts: new Map(),
    async points(gid, force) {
      const g = mine.find((x) => x.id === gid);
      if (!g) return [];
      const hit = api._pts.get(gid);
      if (!force && hit && Date.now() - hit.at < 5 * 60_000) return hit.rows;
      const rows = await Promise.all(g.members.map(async (u) => {
        const w = await db.get('wallets/' + u).catch(() => null);
        return { uid: u, username: g.names[u] || 'friend', total: Math.max(0, Number(w && (w.total != null ? w.total : w.points)) || 0) };
      }));
      rows.sort((a, b) => b.total - a.total);
      api._pts.set(gid, { at: Date.now(), rows });
      return rows;
    },
  };
  return api;
}
