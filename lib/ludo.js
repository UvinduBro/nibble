// Ludo rules + board geometry for the solo game (vs computer).
// Board: 15×15 grid. Seats: 0 = red (top-left), 1 = green (top-right), 2 = yellow (bottom-right),
// 3 = blue (bottom-left). A token's progress: 0 = in base, 1..51 = on the shared track,
// 52..56 = its own home column, 57 = home (finished).

const seg = (pts) => pts;
export const TRACK = (() => {
  const t = [];
  for (let c = 1; c <= 5; c++) t.push([c, 6]);
  for (let r = 5; r >= 0; r--) t.push([6, r]);
  t.push([7, 0]);
  for (let r = 0; r <= 5; r++) t.push([8, r]);
  for (let c = 9; c <= 14; c++) t.push([c, 6]);
  t.push([14, 7]);
  for (let c = 14; c >= 9; c--) t.push([c, 8]);
  for (let r = 9; r <= 14; r++) t.push([8, r]);
  t.push([7, 14]);
  for (let r = 14; r >= 9; r--) t.push([6, r]);
  for (let c = 5; c >= 0; c--) t.push([c, 8]);
  t.push([0, 7]);
  t.push([0, 6]);
  return seg(t);
})(); // 52 cells
export const START = [0, 13, 26, 39];            // where each seat enters the track
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // start squares + stars
export const HOME_COL = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
export const BASE_SPOTS = [
  [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
];
export const CENTER_SPOT = [[6.6, 7.5], [7.5, 6.6], [8.4, 7.5], [7.5, 8.4]]; // finished tokens per seat (cell units)
export const COLORS = ['#ff5a6e', '#3ddc84', '#ffc93d', '#4ca3ff'];
export const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
export const GOAL = 57;

export const absIndex = (seat, p) => (p >= 1 && p <= 51 ? (START[seat] + p - 1) % 52 : -1);

// centre of a token in cell units (x, y), for drawing
export function spot(seat, p, i) {
  if (p === 0) return BASE_SPOTS[seat][i];
  if (p >= GOAL) return CENTER_SPOT[seat];
  if (p >= 52) { const [c, r] = HOME_COL[seat][p - 52]; return [c + 0.5, r + 0.5]; }
  const [c, r] = TRACK[absIndex(seat, p)];
  return [c + 0.5, r + 0.5];
}

// tokens: { [seat]: [p, p, p, p] }
export function legalMoves(tokens, seat, dice) {
  const out = [];
  tokens[seat].forEach((p, i) => {
    if (p >= GOAL) return;
    if (p === 0) { if (dice === 6) out.push(i); return; }
    if (p + dice <= GOAL) out.push(i);
  });
  return out;
}

// returns { tokens, captured: [[seat, i]], finished, extra }
export function applyMove(tokens, seat, i, dice) {
  const next = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, v.slice()]));
  const from = next[seat][i];
  const to = from === 0 ? 1 : from + dice;
  next[seat][i] = to;
  const captured = [];
  const a = absIndex(seat, to);
  if (a >= 0 && !SAFE.has(a)) {
    for (const k of Object.keys(next)) {
      const s = Number(k);
      if (s === seat) continue;
      next[s].forEach((q, j) => { if (absIndex(s, q) === a) { next[s][j] = 0; captured.push([s, j]); } });
    }
  }
  const finished = to === GOAL;
  return { tokens: next, captured, finished, extra: dice === 6 || captured.length > 0 || finished, from, to };
}

export const allHome = (tokens, seat) => tokens[seat].every((p) => p >= GOAL);

// simple computer player: capture > finish > leave base > reach safety > escape danger > furthest back
export function botPick(tokens, seat, dice) {
  const moves = legalMoves(tokens, seat, dice);
  if (!moves.length) return -1;
  const danger = (s2, p) => {
    const a = absIndex(s2, p);
    if (a < 0 || SAFE.has(a)) return false;
    for (const k of Object.keys(tokens)) {
      const o = Number(k);
      if (o === s2) continue;
      for (const q of tokens[o]) {
        const b = absIndex(o, q);
        if (b < 0) continue;
        const gap = (a - b + 52) % 52;
        if (gap >= 1 && gap <= 6) return true;
      }
    }
    return false;
  };
  let best = moves[0], bestScore = -1e9;
  for (const i of moves) {
    const r = applyMove(tokens, seat, i, dice);
    let sc = 0;
    if (r.captured.length) sc += 100;
    if (r.finished) sc += 80;
    if (r.from === 0) sc += 60;
    if (r.to >= 52) sc += 40;
    const a = absIndex(seat, r.to);
    if (a >= 0 && SAFE.has(a)) sc += 25;
    if (danger(seat, r.from) && !danger(seat, r.to)) sc += 30;
    if (danger(seat, r.to)) sc -= 35;
    sc += r.to * 0.3;
    sc += Math.random() * 4;
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}
