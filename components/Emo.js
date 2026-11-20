// Colourful 3D icons (Microsoft Fluent Emoji 3D, MIT licence: public/icons/3d/LICENSE.txt) used in
// place of system emoji, which look flat, outdated or missing on older Windows PCs.
// <Emo k="tea" /> by name, or <Emo e="🍵" /> by emoji (falls back to the emoji text if we have no icon).

const MAP = {
  '🏠': 'house', '⌂': 'house', '🎨': 'palette', '✿': 'palette', '🎮': 'game', '◆': 'game', '🏆': 'trophy',
  '☺': 'smile', '😊': 'smile', '🙂': 'smile', '✉': 'envelope', '👥': 'people', '🍵': 'teacup', '☕': 'tea', '♫': 'notes',
  '🎶': 'notes', '⏰': 'alarm', '☻': 'bust', '👤': 'bust', '🐛': 'bug', '✨': 'sparkles', '✦': 'gem', '⚙': 'gear',
  '👍': 'like', '❤': 'love', '😂': 'haha', '😮': 'wow', '😢': 'sad', '😡': 'angry', '😠': 'angry', '🌍': 'globe',
  '🕶': 'sunglasses', '😎': 'sunglasses', '🔥': 'fire', '🆕': 'new', '💬': 'speech', '🗑': 'trash', '⚑': 'flag', '🚩': 'flag',
  '🦊': 'fox', '🦉': 'owl', '🐼': 'panda', '🐨': 'koala', '🦦': 'otter', '🐰': 'bunny', '🐱': 'cat', '🐸': 'frog',
  '🦆': 'duck', '🐝': 'bee', '🐯': 'tiger', '🐧': 'penguin', '🦔': 'hedgehog', '🦝': 'raccoon', '🦥': 'sloth', '🦙': 'llama',
  '❔': 'question', '❓': 'question', '🐾': 'paw', '🎧': 'headphone', '📚': 'books', '💼': 'briefcase', '🌸': 'blossom',
  '🍕': 'pizza', '⭐': 'star', '🌙': 'moon', '💜': 'purpleheart', '🏀': 'basketball', '✈': 'airplane', '👋': 'wave',
  '👑': 'crown', '🥇': 'medal1', '🥈': 'medal2', '🥉': 'medal3', '🤗': 'hug', '😘': 'kiss', '👉': 'poke', '🙌': 'highfive',
  '🤭': 'tickle', '🎉': 'cheer', '🍪': 'cookie', '😜': 'annoy', '🍦': 'icecream', '👆': 'boop', '🌷': 'tulip', '🎂': 'cake',
  '👊': 'fistbump', '🛏': 'bed', '🎸': 'guitar', '🎁': 'gift', '🫧': 'bubbles', '🚀': 'rocket', '🛡': 'shield', '🌟': 'glowstar',
  '💎': 'gem', '🔒': 'lock', '📣': 'megaphone', '📊': 'trophy', '📬': 'envelope', '📢': 'megaphone', '🔎': 'sparkles',
  '📈': 'trophy', '🕵': 'sunglasses',
};
const strip = (e) => String(e || '').replace(/[️‍]/g, '');
export const emoKey = (e) => MAP[strip(e)] || '';

export default function Emo({ k, e, size = 20, title, className = '' }) {
  const key = k || emoKey(e);
  if (!key) return e ? <span className={'emo-txt ' + className} style={{ fontSize: size * 0.9 }} title={title}>{e}</span> : null;
  return <img className={'emo ' + className} src={`/icons/3d/${key}.webp`} width={size} height={size} alt={title || ''} title={title} aria-hidden={title ? undefined : true} draggable={false} loading="lazy" decoding="async" />;
}
