// "About me" choices. Keys must match the role_* / int_* line packs in public/nibble/engine/lines.js.
export const ROLES = [
  ['designer', 'Designer', '🎨'],
  ['developer', 'Developer', '💻'],
  ['student', 'Student', '📚'],
  ['marketer', 'Marketing', '📈'],
  ['writer', 'Writer', '✍️'],
  ['creator', 'Content creator', '🎥'],
  ['office', 'Office / business', '💼'],
  ['teacher', 'Teacher', '🍎'],
  ['health', 'Healthcare', '🩺'],
  ['other', 'Something else', '✨'],
];

export const INTERESTS = [
  ['music', 'Music', '🎧'], ['gaming', 'Gaming', '🎮'], ['coffee', 'Coffee', '☕'], ['tea', 'Tea', '🍵'],
  ['fitness', 'Fitness', '💪'], ['anime', 'Anime', '🌸'], ['food', 'Food', '🍜'], ['travel', 'Travel', '✈️'],
  ['reading', 'Reading', '📖'], ['movies', 'Movies & shows', '🍿'], ['art', 'Art & drawing', '🖌️'], ['pets', 'Pets', '🐾'],
  ['sports', 'Sports', '🏏'], ['fashion', 'Fashion', '👗'], ['photo', 'Photography', '📷'], ['nature', 'Nature', '🌿'],
];

export const MAX_INTERESTS = 5;

const ROLE_KEYS = new Set(ROLES.map(([k]) => k));
const INT_KEYS = new Set(INTERESTS.map(([k]) => k));
const clean = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

// only known keys and short text ever get saved
export function cleanAbout(a = {}) {
  return {
    nick: clean(a.nick, 20),
    role: ROLE_KEYS.has(a.role) ? a.role : '',
    interests: (Array.isArray(a.interests) ? a.interests : []).filter((k) => INT_KEYS.has(k)).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, MAX_INTERESTS),
    focus: clean(a.focus, 40),
  };
}
