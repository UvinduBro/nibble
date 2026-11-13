// Points (⭐): earned from mini games, a daily bonus, friend interactions and gifts; spent in the shop.
//
// wallets/{uid} = { points, owned: [itemId], day, earned (today), streak, daily (day claimed),
//                   gin (last gift claimed), gout (last gift sent), best: { game: score }, at }
// gifts/{id}     = { from, fromName, to, amount, note, claimed, at }
// firestore.rules keep it honest: at most 60 points per earn, 5 s apart, 1500 a day, and spending
// must take points away. Day = UTC day number on the server clock.
import { ITEMS, priceOf } from '../shop';

export const EARN_MAX = 60;
export const DAY_CAP = 1500;
export const GAP_MS = 5600;
export const START_POINTS = 100;
export const SOCIAL_PTS = 3;
export const SOCIAL_CAP = 45;
export const GIFT_MAX = 500;
const DAY = 86400_000;

export const dailyBonus = (streak) => 20 + 10 * Math.min(8, Math.max(1, streak)); // 30 … 100

export function createWallet({ db, state, emit, serverNow, requireMe, store, pushMessage, fail }) {
  let unsub = null, unsubGifts = null, pending = 0, reasons = [], timer = null, busy = false, fails = 0;
  const claiming = new Set();
  const today = () => Math.floor(serverNow() / DAY);
  const path = () => 'wallets/' + state.user.uid;
  const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);

  function blank() { return { points: START_POINTS, owned: [], day: today(), earned: 0, streak: 0, daily: 0, gin: '', gout: '', best: {}, at: db.now() }; }
  const shape = (w) => ({
    points: Math.max(0, Math.floor(Number(w.points) || 0)), owned: Array.isArray(w.owned) ? w.owned.filter((x) => typeof x === 'string') : [],
    day: Number(w.day) || 0, earned: Number(w.earned) || 0, streak: Number(w.streak) || 0, daily: Number(w.daily) || 0,
    gin: String(w.gin || ''), gout: String(w.gout || ''), best: w.best && typeof w.best === 'object' ? w.best : {}, at: w.at,
  });
  function view(w) {
    if (!w) return { ready: false, points: 0, owned: [], best: {}, streak: 0, canDaily: false };
    const d = today();
    return {
      ready: true, points: w.points, owned: w.owned, best: w.best || {}, streak: w.daily === d || w.daily === d - 1 ? w.streak : 0,
      canDaily: w.daily !== d, earnedToday: w.day === d ? w.earned : 0, nextBonus: dailyBonus(w.daily === d - 1 ? w.streak + 1 : 1),
      lastAt: ms(w.at),
    };
  }
  function set(w) { state.walletRaw = w; state.wallet = { ...view(w), pending, error: state.wallet && state.wallet.error }; emit(); }
  function setErr(e) { state.wallet = { ...(state.wallet || view(null)), error: e }; emit(); }

  function start() {
    stop();
    state.wallet = view(null);
    unsub = db.watchDoc(path(), (w) => {
      if (!w) {
        db.set(path(), blank()).catch((e) => setErr(e && e.code === 'permission-denied' ? 'rules' : 'error'));
        return;
      }
      set(shape(w));
      if (pending) schedule(200);
    }, (e) => setErr(e && e.code === 'permission-denied' ? 'rules' : 'error'));
    unsubGifts = db.watchCol('gifts', [['to', '==', state.user.uid]], (list) => {
      for (const d of list) if (d.data && !d.data.claimed && !claiming.has(d.id)) claim(d.id, d.data);
      for (const d of list) if (d.data && d.data.claimed && serverNow() - ms(d.data.at) > 3 * DAY) db.del('gifts/' + d.id).catch(() => {});
    }, () => {});
  }
  function stop() { unsub && unsub(); unsubGifts && unsubGifts(); unsub = unsubGifts = null; clearTimeout(timer); pending = 0; reasons = []; }

  async function claim(id, g) {
    claiming.add(id);
    if (!state.walletRaw) { claiming.delete(id); return; }
    try {
      await db.tx(async (t) => {
        const gift = await t.get('gifts/' + id);
        const cur = await t.get(path());
        if (!gift || gift.claimed || !cur) return;
        t.set('gifts/' + id, { ...gift, claimed: true });
        t.set(path(), { ...shape(cur), points: shape(cur).points + gift.amount, gin: id, at: db.now() });
      });
      pushMessage({ id: 'g_' + id, kind: 'gift', from: g.from, fromName: g.fromName || 'friend', text: `sent you ${g.amount} ⭐${g.note ? ' · ' + g.note : ''}`, at: ms(g.at) || Date.now(), direct: true });
    } catch { setTimeout(() => claiming.delete(id), 15000); } // retried on a later snapshot
  }

  // earning is batched: games call earn() whenever; we write at most once every ~9 s
  function schedule(delay) { clearTimeout(timer); timer = setTimeout(flush, Math.max(50, delay)); }
  async function flush() {
    if (busy || !pending || !state.walletRaw || !state.user) return;
    const wait = GAP_MS - (serverNow() - ms(state.walletRaw.at));
    if (wait > 0) { schedule(wait + 120); return; }
    busy = true;
    const d = today();
    try {
      let delta = 0;
      await db.tx(async (t) => {
        const cur = shape((await t.get(path())) || blank());
        const earned = cur.day === d ? cur.earned : 0;
        delta = Math.min(pending, EARN_MAX, DAY_CAP - earned);
        if (delta <= 0) return;
        t.set(path(), { ...cur, points: cur.points + delta, day: d, earned: earned + delta, at: db.now() });
      });
      pending = delta <= 0 ? 0 : Math.max(0, pending - delta);
      fails = 0;
    } catch (e) {
      // a refused earn is usually the day rolling over or a too-quick write; give up after a few tries
      if (e && e.code === 'permission-denied' && ++fails >= 3) { setErr('rules'); pending = 0; fails = 0; }
    }
    busy = false;
    if (state.wallet) state.wallet = { ...state.wallet, pending };
    emit();
    if (pending > 0) schedule(GAP_MS);
  }

  return {
    _start: start, _stop: stop,
    // n points for something you did (a game score, a friend action). Returns what will be added.
    earn(n, reason = '') {
      n = Math.max(0, Math.floor(n));
      if (!n || !state.user) return 0;
      const w = state.wallet;
      const left = DAY_CAP - ((w && w.earnedToday) || 0) - pending;
      n = Math.min(n, Math.max(0, left));
      if (!n) return 0;
      pending += n; reasons.push(reason);
      if (state.wallet) state.wallet = { ...state.wallet, pending };
      emit();
      schedule(300);
      return n;
    },
    // a few points for sending friends actions, up to SOCIAL_CAP a day
    earnSocial() {
      const k = 'nibble-social-pts-' + (state.user ? state.user.uid : '') + '-' + today();
      const got = Number(store.get(k, 0)) || 0;
      if (got >= SOCIAL_CAP) return 0;
      store.set(k, got + SOCIAL_PTS);
      return this.earn(SOCIAL_PTS, 'friend');
    },
    async claimDaily() {
      requireMe();
      const w = state.walletRaw;
      if (!w) throw fail('Your points are still loading.');
      const d = today();
      if (w.daily === d) throw fail('Already claimed today. Come back tomorrow!');
      const wait = GAP_MS - (serverNow() - ms(w.at));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait + 150));
      let bonus = 0;
      await db.tx(async (t) => {
        const cur = shape((await t.get(path())) || blank());
        if (cur.daily === d) throw fail('Already claimed today.');
        const streak = cur.daily === d - 1 ? cur.streak + 1 : 1;
        bonus = dailyBonus(streak);
        const earned = cur.day === d ? cur.earned : 0;
        t.set(path(), { ...cur, points: cur.points + bonus, day: d, earned: earned + bonus, streak, daily: d, at: db.now() });
      });
      return bonus;
    },
    async buy(id) {
      requireMe();
      const it = ITEMS[id];
      if (!it) throw fail('That item doesn’t exist.');
      const w = state.walletRaw;
      if (!w) throw fail('Your points are still loading.');
      if (w.owned.includes(id) || !it.price) return 'owned';
      if (w.points < it.price) throw fail(`You need ${it.price - w.points} more ⭐. Play a game to earn some!`);
      await db.tx(async (t) => {
        const cur = shape((await t.get(path())) || blank());
        if (cur.owned.includes(id)) return;
        if (cur.points < it.price) throw fail('Not enough points.');
        t.set(path(), { ...cur, points: cur.points - it.price, owned: [...cur.owned, id], at: db.now() });
      });
      return 'bought';
    },
    async gift(to, amount, note = '') {
      requireMe();
      const n = Math.floor(Number(amount));
      if (!(n >= 1 && n <= GIFT_MAX)) throw fail(`Send between 1 and ${GIFT_MAX} points.`);
      const w = state.walletRaw;
      if (!w || w.points < n) throw fail('You don’t have that many points.');
      const f = state.friends.find((x) => x.uid === to);
      if (!f) throw fail('You can only send points to friends.');
      const id = state.user.uid.slice(0, 8) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await db.tx(async (t) => {
        const cur = shape((await t.get(path())) || blank());
        if (cur.points < n) throw fail('You don’t have that many points.');
        t.set('gifts/' + id, { from: state.user.uid, fromName: state.profile.username, to, amount: n, note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, 60), claimed: false, at: db.now() });
        t.set(path(), { ...cur, points: cur.points - n, gout: id, at: db.now() });
      });
      return n;
    },
    // record a personal best (no points). Kept with the next earn when one is pending.
    async best(game, score) {
      const w = state.walletRaw;
      if (!w || !(score > (Number(w.best[game]) || 0))) return false;
      const best = { ...w.best, [game]: Math.floor(score) };
      state.walletRaw = { ...w, best };
      set(state.walletRaw);
      try { await db.set(path(), { ...w, best, at: db.now() }); } catch { /* rules: best-only write; ignore */ }
      return true;
    },
    // friends' wallets for leaderboards (read-only)
    async friendsBest() {
      const out = [];
      for (const f of state.friends) {
        try { const w = await db.get('wallets/' + f.uid); if (w) out.push({ uid: f.uid, username: f.username, best: w.best || {}, points: w.points || 0 }); } catch { /* not readable */ }
      }
      return out;
    },
    priceOf,
  };
}
