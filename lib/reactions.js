// Facebook-style reactions, shared by the Tea Room, group chat and private messages.
// key → label; the icon is public/icons/3d/<key>.webp (components/Emo.js)
export const REACTIONS = [['like', 'Like'], ['love', 'Love'], ['haha', 'Haha'], ['wow', 'Wow'], ['sad', 'Sad'], ['angry', 'Angry']];
export const REACTION_KEYS = REACTIONS.map(([k]) => k);
export const reactionLabel = (k) => (REACTIONS.find(([x]) => x === k) || [])[1] || '';
// { like: 3, love: 1 } from { uid: 'like', … }
export const countReactions = (rx) => {
  const out = {};
  for (const v of Object.values(rx || {})) if (REACTION_KEYS.includes(v)) out[v] = (out[v] || 0) + 1;
  return out;
};
