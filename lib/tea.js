// Tea Room: short text posts and comments, as yourself or anonymous ("masked"). Shared by the
// browser (lib/social/tea.js), the server (app/api/tea) and local test mode (lib/teaCore.js).
//
// Feeds: 'all' (everyone on Nibble) and one per group (feed id = the group id).
// Everything is written by the server, so an anonymous post never contains who wrote it; the author
// is kept in teaAuthors/{id}, which only the server (and admins, through the server) can read.

export const MAX_POST = 280;
export const MAX_COMMENT = 200;
export const MAX_COMMENTS = 100;             // per post
export const HIDE_AT = 3;                    // reports from different people before a post is hidden
export const PAGE = 20;
// daily limits per person (anonymous posts count towards posts too)
export const LIMITS = { posts: 30, anon: 20, anonPremium: 40, comments: 120, reports: 20, gapMs: 15_000, commentGapMs: 4_000 };

// Facebook-style reactions (lib/reactions.js)
export const REACTS = [['like', '👍', 'Like'], ['love', '❤️', 'Love'], ['haha', '😂', 'Haha'], ['wow', '😮', 'Wow'], ['sad', '😢', 'Sad'], ['angry', '😡', 'Angry']];
export const REACT_KEYS = REACTS.map(([k]) => k);

// admin switches in config/app.tea (missing = default)
export function teaConfig(cfg) {
  const t = (cfg && cfg.tea) || {};
  return {
    on: t.on !== false,                // the whole Tea Room
    everyone: t.everyone !== false,    // the "Everyone" feed
    anon: t.anon !== false,            // anonymous posts in group feeds
    anonAll: t.anonAll !== false,      // anonymous posts in the Everyone feed
    ios: t.ios === true,               // show it in the iPhone app (off by default: App Store review)
  };
}

// a new prompt every day, the same for everyone
export const PROMPTS = [
  'What’s your unpopular opinion?', 'Weirdest thing you saw today?', 'Confess something small.', 'What are you pretending not to care about?',
  'Best thing that happened this week?', 'Hot take about your job or class?', 'What song is stuck in your head?', 'Rate your day out of 10. Why?',
  'What did you procrastinate on today?', 'A small win nobody noticed?', 'What snack are you hiding?', 'The last thing that made you laugh out loud?',
  'What would your pet say about you?', 'Which app do you open too much?', 'Dream job if money didn’t matter?', 'What’s overrated?',
  'What’s underrated?', 'Tell us a tiny secret.', 'Who deserves a thank-you today?', 'What are you looking forward to?',
  'The most chaotic thing in your group chat?', 'Something you changed your mind about?', 'Your comfort movie or show?', 'What should we all try this week?',
  'A rule you secretly break?', 'Your toxic trait (the cute kind)?', 'Best advice you ever got?', 'What did you learn today?',
];
export const dayIndex = (t = Date.now()) => Math.floor(t / 86400_000);
export const dailyPrompt = (t = Date.now()) => ({ id: dayIndex(t) % PROMPTS.length, text: PROMPTS[dayIndex(t) % PROMPTS.length] });

// masked identity: the same person gets the same mask inside one thread, a different one in the next
export const MASK_ANIMALS = [['Fox', '🦊'], ['Owl', '🦉'], ['Panda', '🐼'], ['Koala', '🐨'], ['Otter', '🦦'], ['Bunny', '🐰'], ['Cat', '🐱'], ['Frog', '🐸'], ['Duck', '🦆'], ['Bee', '🐝'], ['Tiger', '🐯'], ['Penguin', '🐧'], ['Hedgehog', '🦔'], ['Raccoon', '🦝'], ['Sloth', '🦥'], ['Llama', '🦙']];
export const MASK_COLOURS = [['Teal', '#2ec4b6'], ['Pink', '#ff5d8f'], ['Gold', '#ffb703'], ['Violet', '#9b5de5'], ['Mint', '#57cc99'], ['Coral', '#ff7f51'], ['Sky', '#4cc9f0'], ['Plum', '#c77dff']];
// hex = a secret, per-thread hash of the author (made by the server)
export function maskFrom(hex) {
  const n = parseInt(String(hex).slice(0, 8), 16) || 0;
  const [animal, emoji] = MASK_ANIMALS[n % MASK_ANIMALS.length];
  const [colour, color] = MASK_COLOURS[Math.floor(n / MASK_ANIMALS.length) % MASK_COLOURS.length];
  return { name: `${colour} ${animal}`, emoji, color };
}

// words that are never allowed (admins add more in Admin → Tea Room). Matched as whole words.
export const BLOCKED = ['kys', 'kill yourself', 'kill urself', 'go die', 'neck yourself', 'retard', 'retarded'];
const norm = (t) => ` ${String(t || '').toLowerCase().replace(/[^a-z0-9@ ]+/g, ' ').replace(/\s+/g, ' ')} `;

export const cleanTea = (t, max) => String(t || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim().slice(0, max);

// a picture on a post: a Firebase Storage file under tea/ in our own bucket (or a data: picture in test mode)
export const TEA_IMG_MAX = 2 * 1024 * 1024; // 2 MB (storage.rules enforces the same)
export function cleanTeaImg(v, { bucket, test } = {}) {
  if (!v || typeof v !== 'object') return null;
  const u = String(v.u || '');
  const w = Math.round(Number(v.w) || 0), h = Math.round(Number(v.h) || 0);
  if (w < 1 || h < 1 || w > 4000 || h > 4000) return null;
  if (test && /^data:image\/(webp|jpeg);base64,/.test(u) && u.length < 3_000_000) return { u, w, h };
  const pre = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/tea%2F`;
  if (!bucket || !u.startsWith(pre) || u.length > 400) return null;
  if (!/^[A-Za-z0-9]{20,40}\.(webp|jpg)\?alt=media&token=[A-Za-z0-9-]{20,60}$/.test(u.slice(pre.length))) return null;
  return { u, w, h };
}
// a GIF: provider + id only (shown through /api/gif/m/<p>/<id>)
export function cleanGif(v) {
  if (!v || typeof v !== 'object') return null;
  const p = String(v.p || ''), id = String(v.id || '');
  if (!((p === 'k' || p === 'g') && /^[A-Za-z0-9_-]{1,80}$/.test(id))) return null;
  const w = Math.max(1, Math.min(2000, Math.round(Number(v.w) || 200))), h = Math.max(1, Math.min(2000, Math.round(Number(v.h) || 200)));
  return { p, id, w, h };
}

// → '' when fine, else a friendly reason
export function checkTea(text, { anon, words = [], min = 2 } = {}) {
  if (text.length < min) return min > 0 ? 'Write a little more first.' : '';
  const n = norm(text);
  for (const w of [...BLOCKED, ...words]) {
    const x = norm(w).trim();
    if (x && n.includes(` ${x} `)) return 'That post has a word that isn’t allowed here.';
  }
  if (anon) {
    // anonymous posts can't carry someone's private contact details (doxxing)
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return 'Anonymous posts can’t include email addresses.';
    if (/(\+?\d[\s-]?){9,}/.test(text)) return 'Anonymous posts can’t include phone numbers.';
  }
  return '';
}

export const okFeed = (f) => f === 'all' || /^[A-Za-z0-9]{6,40}$/.test(String(f || ''));
export const okId = (x) => /^[a-z0-9]{6,30}$/.test(String(x || ''));
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const postPath = (feed, pid, cid) => `teaRooms/${feed}/posts/${pid}` + (cid ? `/comments/${cid}` : '');
export const authorId = (pid, cid) => (cid ? `${pid}_${cid}` : pid);
export const flagId = (feed, pid, cid) => `${feed}_${pid}_${cid || 'p'}`;
