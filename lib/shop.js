// Nibble shop catalog: everything you can wear, send or do, and what it costs in points (⭐).
// Price 0 = free for everyone. Owned item ids live in wallets/{uid}.owned (see lib/social/wallet.js).
// Drawing lives in public/nibble/engine/wardrobe.js (species, outfits, hats) and pet.js (emotes, skills).

export const PT = '⭐';

export const SPECIES = [
  { key: '', label: 'Nibble', emoji: '👾', price: 0, note: 'The original, antenna and all' },
  { key: 'cat', label: 'Cat', emoji: '🐱', price: 0 },
  { key: 'dog', label: 'Puppy', emoji: '🐶', price: 0 },
  { key: 'bunny', label: 'Bunny', emoji: '🐰', price: 0 },
  { key: 'mouse', label: 'Mouse', emoji: '🐭', price: 80 },
  { key: 'pig', label: 'Piglet', emoji: '🐷', price: 100 },
  { key: 'bear', label: 'Bear', emoji: '🐻', price: 120 },
  { key: 'frog', label: 'Frog', emoji: '🐸', price: 120 },
  { key: 'fox', label: 'Fox', emoji: '🦊', price: 150 },
  { key: 'panda', label: 'Panda', emoji: '🐼', price: 180 },
  { key: 'penguin', label: 'Penguin', emoji: '🐧', price: 180 },
  { key: 'dragon', label: 'Dragon', emoji: '🐲', price: 300 },
  { key: 'unicorn', label: 'Unicorn', emoji: '🦄', price: 300 },
];

export const OUTFITS = [
  { key: '', label: 'Nothing', emoji: '🚫', price: 0 },
  { key: 'tee', label: 'T-shirt', emoji: '👕', price: 0, color: '#4cc9f0' },
  { key: 'hoodie', label: 'Hoodie', emoji: '🧥', price: 0, color: '#ff7ab8' },
  { key: 'scarf', label: 'Scarf', emoji: '🧣', price: 60, color: '#ff4d5e' },
  { key: 'sweater', label: 'Sweater', emoji: '🧶', price: 90, color: '#e2504a' },
  { key: 'overalls', label: 'Overalls', emoji: '👖', price: 90, color: '#4a78c2' },
  { key: 'raincoat', label: 'Raincoat', emoji: '🌧', price: 100, color: '#ffd23f' },
  { key: 'pajamas', label: 'Pajamas', emoji: '🌙', price: 100, color: '#7aa2ff' },
  { key: 'jersey', label: 'Jersey', emoji: '🏀', price: 120, color: '#2ec4b6' },
  { key: 'dress', label: 'Dress', emoji: '👗', price: 140, color: '#b9a3ff' },
  { key: 'kimono', label: 'Kimono', emoji: '👘', price: 160, color: '#ff6f91' },
  { key: 'suit', label: 'Suit', emoji: '🤵', price: 180, color: '#2b2f3a' },
  { key: 'cape', label: 'Hero cape', emoji: '🦸', price: 220, color: '#e63946' },
];

// hats + face accessories (pose.acc). The first nine have always been free.
export const ACCS = [
  { key: 'cap', label: 'Cap', emoji: '🧢', price: 0 },
  { key: 'tophat', label: 'Top hat', emoji: '🎩', price: 0 },
  { key: 'party', label: 'Party hat', emoji: '🥳', price: 0 },
  { key: 'crown', label: 'Crown', emoji: '👑', price: 0 },
  { key: 'bow', label: 'Bow', emoji: '🎀', price: 0 },
  { key: 'flower', label: 'Flower', emoji: '🌸', price: 0 },
  { key: 'sunglasses', label: 'Shades', emoji: '🕶', price: 0, face: true },
  { key: 'glasses', label: 'Glasses', emoji: '👓', price: 0, face: true },
  { key: 'headphones', label: 'Headphones', emoji: '🎧', price: 0 },
  { key: 'sprout', label: 'Sprout', emoji: '🌱', price: 50 },
  { key: 'beanie', label: 'Beanie', emoji: '🧢', price: 60 },
  { key: 'bandana', label: 'Bandana', emoji: '🏴', price: 60 },
  { key: 'eyepatch', label: 'Eyepatch', emoji: '🏴‍☠️', price: 70, face: true },
  { key: 'beret', label: 'Beret', emoji: '🎨', price: 80 },
  { key: 'heartglasses', label: 'Heart glasses', emoji: '😍', price: 90, face: true },
  { key: 'monocle', label: 'Monocle', emoji: '🧐', price: 90, face: true },
  { key: 'flowercrown', label: 'Flower crown', emoji: '🌼', price: 100 },
  { key: 'chef', label: 'Chef hat', emoji: '👨‍🍳', price: 100 },
  { key: 'grad', label: 'Grad cap', emoji: '🎓', price: 120 },
  { key: 'cowboy', label: 'Cowboy hat', emoji: '🤠', price: 120 },
  { key: 'santa', label: 'Santa hat', emoji: '🎅', price: 120 },
  { key: 'witch', label: 'Witch hat', emoji: '🧙', price: 150 },
  { key: 'viking', label: 'Viking helmet', emoji: '⚔️', price: 160 },
  { key: 'halo', label: 'Halo', emoji: '😇', price: 200 },
];

export const MAKEUPS = [
  { key: '', label: 'None', emoji: '🙂', price: 0 },
  { key: 'blush', label: 'Blush', emoji: '😊', price: 0 },
  { key: 'freckles', label: 'Freckles', emoji: '🙃', price: 0 },
  { key: 'star', label: 'Star', emoji: '⭐', price: 0 },
  { key: 'all', label: 'Full glam', emoji: '✨', price: 0 },
];

// friend actions you can send. The classic set is free; the rest are unlocked.
export const EMOTES = [
  { key: 'wave', label: 'Wave', emoji: '👋', price: 0 },
  { key: 'hug', label: 'Cuddle', emoji: '🤗', price: 0 },
  { key: 'kiss', label: 'Kiss', emoji: '😘', price: 0 },
  { key: 'heart', label: 'Heart', emoji: '❤️', price: 0 },
  { key: 'poke', label: 'Poke', emoji: '👉', price: 0 },
  { key: 'annoy', label: 'Tease', emoji: '😜', price: 0 },
  { key: 'icecream', label: 'Ice cream', emoji: '🍦', price: 0 },
  { key: 'highfive', label: 'High five', emoji: '🙌', price: 0 },
  { key: 'tickle', label: 'Tickle', emoji: '🤭', price: 0 },
  { key: 'cheer', label: 'Cheer', emoji: '🎉', price: 0 },
  { key: 'snack', label: 'Snack', emoji: '🍪', price: 0 },
  { key: 'dance', label: 'Dance', emoji: '🎶', price: 0 },
  { key: 'boop', label: 'Boop', emoji: '👆', price: 60 },
  { key: 'flower', label: 'Give a flower', emoji: '🌷', price: 80 },
  { key: 'bubbles', label: 'Bubbles', emoji: '🫧', price: 80 },
  { key: 'fistbump', label: 'Fist bump', emoji: '👊', price: 90 },
  { key: 'gift', label: 'Gift box', emoji: '🎁', price: 100 },
  { key: 'cake', label: 'Birthday cake', emoji: '🎂', price: 120 },
  { key: 'serenade', label: 'Serenade', emoji: '🎸', price: 140 },
  { key: 'pillow', label: 'Pillow fight', emoji: '🛏', price: 150 },
];

// special moves any pet can learn. '' = the character's own move (backflip for the classic crew).
export const SKILLS = [
  { key: '', label: 'Signature move', emoji: '🤸', price: 0, note: 'Backflip, or the anime crew’s own move' },
  { key: 'rainbow', label: 'Rainbow dash', emoji: '🌈', price: 200, note: 'Zooms across the window leaving a rainbow' },
  { key: 'confetti', label: 'Confetti pop', emoji: '🎊', price: 200, note: 'Spins up and bursts into confetti' },
  { key: 'float', label: 'Spirit float', emoji: '👻', price: 220, note: 'Drifts up, half-transparent' },
  { key: 'transform', label: 'Sparkle transform', emoji: '✨', price: 250, note: 'Spins into a burst of stars' },
  { key: 'rage', label: 'Rage mode', emoji: '🔥', price: 250, note: 'Flame aura and tiny angry fists' },
  { key: 'shadowstep', label: 'Shadow step', emoji: '💨', price: 250, note: 'Vanishes, reappears on another window' },
  { key: 'iai', label: 'Iai dash', emoji: '⚔️', price: 280, note: 'Blinks across in one clean cut' },
  { key: 'surf', label: 'Cloud surf', emoji: '☁️', price: 280, note: 'Rides a cloud to another window' },
  { key: 'boost', label: 'Rocket boost', emoji: '🚀', price: 280, note: 'Jet-jumps to the highest window' },
  { key: 'giant', label: 'Giant mode', emoji: '💪', price: 350, note: 'Grows huge for a few seconds' },
];

export const BODY_COLORS = ['#7ee8c6', '#ff8fab', '#ffd166', '#b9a3ff', '#4cc9f0', '#ff6b3d', '#a3ff12', '#f4f6fb', '#2b2f3a', '#c58b5c'];
export const OUTFIT_COLORS = ['#ff4d5e', '#ff7ab8', '#ffd23f', '#7ee8c6', '#2ec4b6', '#4cc9f0', '#4a78c2', '#b9a3ff', '#2b2f3a', '#ffffff'];

export const CATS = { sp: SPECIES, of: OUTFITS, acc: ACCS, em: EMOTES, sk: SKILLS };
const byId = {};
for (const [cat, list] of Object.entries(CATS)) for (const it of list) if (it.key) byId[cat + ':' + it.key] = { ...it, cat, id: cat + ':' + it.key };
export const ITEMS = byId;
export const itemId = (cat, key) => cat + ':' + key;
export const priceOf = (id) => (byId[id] ? byId[id].price : 0);
// free items count as owned
export const owns = (owned, cat, key) => !key || priceOf(itemId(cat, key)) === 0 || (owned || []).includes(itemId(cat, key));

// keep a saved look valid: anything not owned falls back to the free default
export function cleanStyle(st, owned) {
  const o = st && typeof st === 'object' ? st : {};
  const hex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '');
  const pick = (cat, key) => (CATS[cat].some((x) => x.key === key) && owns(owned, cat, key) ? key : '');
  return { sp: pick('sp', o.sp || ''), of: pick('of', o.of || ''), oc: hex(o.oc), sk: pick('sk', o.sk || '') };
}
