// Live turn-based games with friends: Tic-tac-toe and Connect Four.
//
// matches/{id} = { game: 'ttt' | 'c4', players: [challenger, friend], names: { uid: username },
//                  board: string ('.' empty, '0' / '1' = player index), turn: uid, status: 'invite' | 'live' | 'done',
//                  winner: uid | 'draw' | '', moves, last: cell index, at }
// The challenger moves first. Both players award their own points when a match ends.

export const GAMES = {
  ttt: { label: 'Tic-tac-toe', emoji: '❌', cols: 3, rows: 3, need: 3 },
  c4: { label: 'Connect Four', emoji: '🔴', cols: 7, rows: 6, need: 4 },
};
export const WIN_PTS = 40, DRAW_PTS = 20, LOSE_PTS = 10;
const STALE = 2 * 86400_000;

export const emptyBoard = (g) => '.'.repeat(GAMES[g].cols * GAMES[g].rows);

// returns '0' | '1' | 'draw' | ''
export function judge(game, board) {
  const { cols, rows, need } = GAMES[game];
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '' : board[y * cols + x]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = at(x, y);
    if (c !== '0' && c !== '1') continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let k = 1;
      while (k < need && at(x + dx * k, y + dy * k) === c) k++;
      if (k === need) return c;
    }
  }
  return board.includes('.') ? '' : 'draw';
}
// the winning cells, for highlighting
export function winLine(game, board) {
  const { cols, rows, need } = GAMES[game];
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '' : board[y * cols + x]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = at(x, y);
    if (c !== '0' && c !== '1') continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const cells = [y * cols + x];
      let k = 1;
      while (k < need && at(x + dx * k, y + dy * k) === c) { cells.push((y + dy * k) * cols + x + dx * k); k++; }
      if (k === need) return cells;
    }
  }
  return [];
}
// where a move at `cell` lands (Connect Four drops to the lowest free row of that column)
export function place(game, board, cell) {
  const { cols, rows } = GAMES[game];
  if (game === 'c4') {
    const x = cell % cols;
    for (let y = rows - 1; y >= 0; y--) if (board[y * cols + x] === '.') return y * cols + x;
    return -1;
  }
  return board[cell] === '.' ? cell : -1;
}

export function createGames({ db, state, emit, serverNow, requireMe, store, fail, wallet, send }) {
  let unsub = null;
  const ms = (t) => (t == null ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : 0);
  const rewardedKey = () => 'nibble-match-paid-' + (state.user ? state.user.uid : '');

  function payout(list) {
    const paid = new Set(store.get(rewardedKey(), []));
    let changed = false;
    for (const m of list) {
      if (m.status !== 'done' || paid.has(m.id) || !m.winner || m.moves < 2) continue;
      paid.add(m.id); changed = true;
      const me = state.user.uid;
      const pts = m.winner === 'draw' ? DRAW_PTS : m.winner === me ? WIN_PTS : LOSE_PTS;
      wallet.earn(pts, 'match');
    }
    if (changed) store.set(rewardedKey(), [...paid].slice(-80));
  }

  function start() {
    stop();
    state.matches = [];
    unsub = db.watchCol('matches', [['players', 'array-contains', state.user.uid]], (list) => {
      const now = serverNow();
      state.matches = list.map((d) => ({ id: d.id, ...d.data, at: ms(d.data.at) }))
        .filter((m) => m.game in GAMES && Array.isArray(m.players))
        .sort((a, b) => b.at - a.at);
      // tidy up: finished or abandoned matches older than two days
      for (const m of state.matches) if (now - m.at > STALE) db.del('matches/' + m.id).catch(() => {});
      payout(state.matches);
      emit();
    }, () => { state.matches = []; emit(); });
  }
  function stop() { unsub && unsub(); unsub = null; }

  return {
    _start: start, _stop: stop,
    async challenge(friendUid, game) {
      const me = requireMe();
      if (!GAMES[game]) throw fail('Unknown game.');
      const f = state.friends.find((x) => x.uid === friendUid);
      if (!f) throw fail('You can only challenge friends.');
      const open = (state.matches || []).find((m) => m.status !== 'done' && m.game === game && m.players.includes(friendUid));
      if (open) return open.id;
      const id = me.slice(0, 6) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      await db.set('matches/' + id, {
        game, players: [me, friendUid], names: { [me]: state.profile.username, [friendUid]: f.username },
        board: emptyBoard(game), turn: me, status: 'invite', winner: '', moves: 0, last: -1, at: db.now(),
      });
      send && send(friendUid, 'game', GAMES[game].label).catch(() => {});
      return id;
    },
    async accept(id) { requireMe(); await db.set('matches/' + id, { status: 'live', at: db.now() }, true); },
    async decline(id) { requireMe(); await db.del('matches/' + id); },
    async move(id, cell) {
      const me = requireMe();
      await db.tx(async (t) => {
        const m = await t.get('matches/' + id);
        if (!m) throw fail('This game is gone.');
        if (m.status === 'invite' && m.players[0] === me) throw fail('Waiting for them to accept.');
        if (m.status === 'done') throw fail('This game is over.');
        if (m.turn !== me) throw fail('Not your turn yet.');
        const at = place(m.game, m.board, cell);
        if (at < 0) throw fail('That spot is taken.');
        const idx = String(m.players.indexOf(me));
        const board = m.board.slice(0, at) + idx + m.board.slice(at + 1);
        const r = judge(m.game, board);
        const other = m.players.find((p) => p !== me);
        t.set('matches/' + id, {
          ...m, board, last: at, moves: (m.moves || 0) + 1, status: r ? 'done' : 'live',
          winner: r === 'draw' ? 'draw' : r ? m.players[Number(r)] : '', turn: r ? '' : other, at: db.now(),
        });
      });
    },
    async resign(id) {
      const me = requireMe();
      const m = (state.matches || []).find((x) => x.id === id);
      if (!m) return;
      if (m.status === 'invite') return this.decline(id);
      // resigning counts as a loss; the board doesn't change so it's allowed on either turn
      await db.set('matches/' + id, { status: 'done', winner: m.players.find((p) => p !== me), turn: '', at: db.now() }, true);
    },
    async rematch(id) {
      const m = (state.matches || []).find((x) => x.id === id);
      if (!m) return null;
      const other = m.players.find((p) => p !== state.user.uid);
      await db.del('matches/' + id).catch(() => {});
      return this.challenge(other, m.game);
    },
  };
}
