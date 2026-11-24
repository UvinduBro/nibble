// Marketing email templates in the flyer's look: deep green-black, mint accents, rounded tiles,
// the real Nibble logo and art (public/email/*). Pure functions: the admin page uses them for the
// live preview and the server uses the same ones to send, so what you see is what goes out.
//
// Email-safe HTML only: tables, inline styles, bgcolor fallbacks, absolute image URLs, no scripts.
// Merge tags Resend fills per person: {{{FIRST_NAME|there}}}, {{{EMAIL}}}, {{{RESEND_UNSUBSCRIBE_URL}}}

export const ORIGIN = 'https://meetnibble.com';
export const ASSET = ORIGIN + '/email';
const BG = '#0d1917';      // page (flyer background)
const PANEL = '#12201d';   // tiles / cards
const LINE = '#1f3631';    // tile borders
const MINT = '#7ee8c6';
const INK = '#f1f6f4';
const MUTED = '#a9bdb6';
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const UNSUB = '{{{RESEND_UNSUBSCRIBE_URL}}}';

// Dark mode in mail apps: Gmail on iPhone rewrites every colour of an email (dark designs come
// out light). Two standard fixes keep the flyer look:
//  1. backgrounds are also set as a one-colour gradient image, which Gmail leaves alone;
//  2. text sits inside two layers with mix-blend-mode (screen + difference over black) that
//     undo Gmail's inversion. Everywhere else those layers change nothing.
const bgs = (c) => `background-color:${c};background-image:linear-gradient(${c},${c});`;
const gm = (html) => `<div class="gm-s"><div class="gm-d">${html}</div></div>`;
const gmi = (html) => `<span class="gm-s" style="display:inline-block"><span class="gm-d" style="display:inline-block">${html}</span></span>`;

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '').trim()) ? String(u).trim() : 'https://meetnibble.com');
const paras = (text, size = 16) => String(text || '').trim().split(/\n{2,}/).filter(Boolean)
  .map((p) => `<div style="margin:0 0 14px 0;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${MUTED}">${gm(esc(p).replace(/\n/g, '<br>'))}</div>`).join('');

export const TEMPLATES = [
  { id: 'launch', name: 'Try Nibble (flyer style)', note: 'Big headline, the four features, the peeking Nibble and a Try Nibble button. Best for first contact.' },
  { id: 'release', name: 'New release', note: 'Version badge, what’s new as a list, and an update button.' },
  { id: 'letter', name: 'Simple letter', note: 'A short personal note with the logo and an optional button.' },
  { id: 'flyer', name: 'Flyer image', note: 'The full flyer as one image, with a short message and a button below.' },
];

export const TEMPLATE_DEFAULTS = {
  launch: {
    subject: 'Your desktop just got a little more fun',
    preview: 'A tiny pet that walks, plays, visits your friends and listens with you.',
    headline: 'Your desktop just got a little more fun.',
    sub: 'A tiny pet that walks, plays, visits your friends & listens with you.',
    message: 'Hi {{{FIRST_NAME|there}}},\n\nMeet Nibble: a little desktop pet that walks along the top of your windows, naps when you’re away and pops over to your friends’ screens. It’s free, it has no ads, and it takes about a minute to set up.',
    cta: 'Try Nibble', ctaUrl: 'https://meetnibble.com/download', bullets: '', version: '',
  },
  release: {
    subject: 'Nibble just got an update',
    preview: 'New pets, new tricks and a few fixes.',
    headline: 'Fresh tricks for your pet',
    sub: '',
    message: 'Hi {{{FIRST_NAME|there}}},\n\nA new version of Nibble is out. Here’s what’s new:',
    bullets: 'Pets walk on your windows on Mac too\nThe Hub keeps its buttons in full screen\nNibble news by email, only if you want it',
    cta: 'Get the update', ctaUrl: 'https://meetnibble.com/download', version: '2.0.23',
  },
  letter: {
    subject: 'A quick hello from Nibble',
    preview: 'A short note from the Nibble team.',
    headline: '',
    sub: '',
    message: 'Hi {{{FIRST_NAME|there}}},\n\nThanks for being part of Nibble.\n\n',
    cta: '', ctaUrl: 'https://meetnibble.com', bullets: '', version: '',
  },
  flyer: {
    subject: 'Meet Nibble, your new desktop buddy',
    preview: 'Free for Windows & Mac. No ads.',
    headline: '',
    sub: '',
    message: 'Hi {{{FIRST_NAME|there}}}, we made a little desktop pet and we think you’ll like it.',
    cta: 'Try Nibble', ctaUrl: 'https://meetnibble.com/download', bullets: '', version: '',
  },
};

// ---------- shared pieces ----------
function shell({ subject, preview, inner }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(subject)}</title>
<style>
:root { color-scheme: dark only; supported-color-schemes: dark only; }
body, .body { margin: 0; padding: 0; background-color: ${BG}; }
u + .body .gm-s { background: #000; mix-blend-mode: screen; }
u + .body .gm-d { background: #000; mix-blend-mode: difference; }
</style></head>
<body class="body" style="margin:0;padding:0;${bgs(BG)}" bgcolor="${BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG}">${esc(preview)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="${bgs(BG)}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
${inner}
${footer()}
</table></td></tr></table></body></html>`;
}

function logo(center = true) {
  return `<tr><td align="${center ? 'center' : 'left'}" style="padding:8px 8px 22px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:10px"><img src="${ASSET}/logo.png" width="58" height="58" alt="Nibble" border="0" style="display:block;width:58px;height:58px"></td>
<td style="font-family:${FONT};font-size:34px;line-height:40px;font-weight:700;color:${INK};letter-spacing:-0.5px">${gm('nibble')}</td>
</tr></table></td></tr>`;
}

// The button is a picture of the mint pill (/mail-btn renders it), because Gmail's dark mode turns
// dark-on-mint text light. If images are off, the alt text shows on the mint cell instead.
export const buttonWidth = (text) => Math.round(96 + String(text).length * 12.5);
function button(text, url) {
  if (!text) return '';
  const w = buttonWidth(text);
  const src = `${ORIGIN}/mail-btn?t=${encodeURIComponent(text)}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td align="center" bgcolor="${MINT}" style="${bgs(MINT)}border-radius:999px">
<a href="${esc(safeUrl(url))}" style="display:block;text-decoration:none;border-radius:999px"><img src="${src}" width="${w}" height="58" alt="${esc(text)} &rarr;" border="0" style="display:block;width:${w}px;height:58px;border-radius:999px;font-family:${FONT};font-size:19px;line-height:58px;font-weight:700;color:#0d1917;text-align:center"></a>
</td></tr></table>`;
}

function siteLine() {
  return `<tr><td align="center" style="padding:26px 8px 10px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="70" style="border-top:1px solid ${LINE};font-size:0;line-height:0">&nbsp;</td>
<td style="padding:0 16px;font-family:${FONT};font-size:20px;font-weight:700;color:${INK}"><a href="https://meetnibble.com" style="color:${INK};text-decoration:none">${gmi('meetnibble.com')}</a></td>
<td width="70" style="border-top:1px solid ${LINE};font-size:0;line-height:0">&nbsp;</td>
</tr></table></td></tr>
<tr><td align="center" style="padding:6px 8px 8px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:1px solid ${LINE};border-radius:999px;padding:9px 20px;font-family:${FONT};font-size:14px;color:${INK}">${gm('&#128187;&nbsp; Free for Windows &amp; Mac &middot; No ads')}</td></tr></table>
</td></tr>`;
}

function footer() {
  return `<tr><td align="center" style="padding:30px 16px 8px;font-family:${FONT};font-size:12px;line-height:18px;color:#6f857e">${gm(`
You’re getting this because you’re on the Nibble list.<br>
<a href="${UNSUB}" style="color:#9fb5ae;text-decoration:underline">Unsubscribe</a> &middot; <a href="https://meetnibble.com/privacy" style="color:#9fb5ae;text-decoration:underline">Privacy</a><br>
Nibble &middot; Made in Colombo, Sri Lanka`)}
</td></tr>`;
}

function features() {
  const F = [['icon-1.png', 'Walks on<br>windows'], ['icon-2.png', 'Plays<br>games'], ['icon-3.png', 'Visits<br>your friends'], ['icon-4.png', 'Listens<br>with you']];
  const cells = F.map(([img, label]) => `<td width="25%" valign="top" style="padding:0 5px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${PANEL}" style="${bgs(PANEL)};border:1px solid ${LINE};border-radius:18px;padding:16px 4px 14px">
<img src="${ASSET}/${img}" width="52" height="39" alt="" border="0" style="display:block;width:52px;height:39px;margin:0 auto 8px">
<div style="font-family:${FONT};font-size:14px;line-height:18px;font-weight:600;color:${INK}">${gm(label)}</div>
</td></tr></table></td>`).join('');
  return `<tr><td style="padding:6px 3px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`;
}

// ---------- templates ----------
function launch(f) {
  return shell({ subject: f.subject, preview: f.preview, inner: `
${logo()}
<tr><td align="center" style="padding:0 10px 14px;font-family:${FONT};font-size:40px;line-height:46px;font-weight:800;color:${INK};letter-spacing:-1px">${gm(esc(f.headline))}</td></tr>
<tr><td align="center" style="padding:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="120" height="4" bgcolor="${MINT}" style="${bgs(MINT)};border-radius:4px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
${f.sub ? `<tr><td align="center" style="padding:0 24px 24px;font-family:${FONT};font-size:19px;line-height:28px;color:${MUTED}">${gm(esc(f.sub))}</td></tr>` : ''}
${features()}
${f.message ? `<tr><td style="padding:26px 20px 4px">${paras(f.message)}</td></tr>` : ''}
<tr><td align="center" style="padding:16px 0 0"><img src="${ASSET}/peek.png" width="200" height="104" alt="" border="0" style="display:block;width:200px;height:104px"></td></tr>
<tr><td align="center" style="padding:0 0 4px">${button(f.cta, f.ctaUrl)}</td></tr>
${siteLine()}` });
}

function release(f) {
  const items = String(f.bullets || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const list = items.length ? `<tr><td style="padding:4px 14px 10px">${items.map((it) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px"><tr><td bgcolor="${PANEL}" style="${bgs(PANEL)};border:1px solid ${LINE};border-radius:14px;padding:13px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" style="padding-right:12px;font-family:${FONT};font-size:16px;line-height:22px;color:${MINT};font-weight:800">${gm('&#10003;')}</td>
<td style="font-family:${FONT};font-size:16px;line-height:22px;color:${INK}">${gm(esc(it))}</td></tr></table>
</td></tr></table>`).join('')}</td></tr>` : '';
  return shell({ subject: f.subject, preview: f.preview, inner: `
${logo()}
${f.version ? `<tr><td align="center" style="padding:0 0 14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:1px solid ${MINT};border-radius:999px;padding:6px 16px;font-family:${FONT};font-size:13px;font-weight:700;color:${MINT};letter-spacing:0.5px">${gm('NEW IN ' + esc(f.version))}</td></tr></table></td></tr>` : ''}
${f.headline ? `<tr><td align="center" style="padding:0 10px 22px;font-family:${FONT};font-size:34px;line-height:40px;font-weight:800;color:${INK};letter-spacing:-0.8px">${gm(esc(f.headline))}</td></tr>` : ''}
<tr><td style="padding:0 20px 6px">${paras(f.message)}</td></tr>
${list}
<tr><td align="center" style="padding:6px 0 0"><img src="${ASSET}/peek.png" width="170" height="88" alt="" border="0" style="display:block;width:170px;height:88px"></td></tr>
<tr><td align="center">${button(f.cta, f.ctaUrl)}</td></tr>
<tr><td align="center" style="padding:16px 20px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED}">${gm(`Already have Nibble? Open the tray or menu bar icon &rarr; <b style="color:${INK}">Update Nibble</b>.`)}</td></tr>
${siteLine()}` });
}

function letter(f) {
  return shell({ subject: f.subject, preview: f.preview, inner: `
${logo()}
<tr><td bgcolor="${PANEL}" style="${bgs(PANEL)};border:1px solid ${LINE};border-radius:22px;padding:30px 28px 22px">
${f.headline ? `<div style="font-family:${FONT};font-size:26px;line-height:32px;font-weight:800;color:${INK};margin:0 0 16px">${gm(esc(f.headline))}</div>` : ''}
${paras(f.message)}
${f.cta ? `<div style="padding:8px 0 10px">${button(f.cta, f.ctaUrl)}</div>` : ''}
<div style="margin:18px 0 0;font-family:${FONT};font-size:15px;line-height:22px;color:${INK}">${gm(`The Nibble team <span style="color:${MINT}">(◕‿◕)</span>`)}</div>
</td></tr>
${siteLine()}` });
}

function flyer(f) {
  return shell({ subject: f.subject, preview: f.preview, inner: `
<tr><td align="center" style="padding:0"><a href="${esc(safeUrl(f.ctaUrl))}" style="text-decoration:none"><img src="${ASSET}/flyer.jpg" width="600" alt="Nibble: your desktop just got a little more fun. A tiny pet that walks on windows, plays games, visits your friends and listens with you. Free for Windows and Mac, no ads. meetnibble.com" border="0" style="display:block;width:100%;max-width:600px;height:auto;border-radius:22px"></a></td></tr>
${f.message ? `<tr><td align="center" style="padding:26px 24px 6px">${paras(f.message, 17).replace(/<div style="/g, '<div align="center" style="text-align:center;')}</td></tr>` : ''}
<tr><td align="center" style="padding:8px 0 4px">${button(f.cta, f.ctaUrl)}</td></tr>` });
}

const RENDER = { launch, release, letter, flyer };

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
export function cleanFields(t, f) {
  const d = TEMPLATE_DEFAULTS[t] || TEMPLATE_DEFAULTS.letter;
  const o = { ...d, ...(f || {}) };
  return {
    subject: clip(o.subject, 150).replace(/[\r\n]+/g, ' ').trim(),
    preview: clip(o.preview, 140).replace(/[\r\n]+/g, ' ').trim(),
    headline: clip(o.headline, 120), sub: clip(o.sub, 200), message: clip(o.message, 8000),
    bullets: clip(o.bullets, 2000), cta: clip(o.cta, 40), ctaUrl: clip(o.ctaUrl, 300), version: clip(o.version, 16),
  };
}

// → { subject, preview, html, text }
export function renderEmail(template, fields) {
  const t = RENDER[template] ? template : 'letter';
  const f = cleanFields(t, fields);
  const html = RENDER[t](f);
  const bullets = String(f.bullets || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const text = [
    f.headline, f.sub, '', f.message, bullets.length ? '\n' + bullets.map((b) => '• ' + b).join('\n') : '',
    f.cta ? `\n${f.cta}: ${safeUrl(f.ctaUrl)}` : '',
    '\n—\nNibble · meetnibble.com · Free for Windows & Mac · No ads',
    `Unsubscribe: ${UNSUB}`,
  ].filter((x) => x !== '').join('\n');
  return { subject: f.subject, preview: f.preview, html, text };
}

// what a person without a saved name sees (used for previews and test sends)
export const fillForPreview = (s, email = 'you@example.com') => String(s)
  .replace(/\{\{\{FIRST_NAME\|([^}]*)\}\}\}/g, '$1').replace(/\{\{\{(FIRST_NAME|LAST_NAME)\}\}\}/g, '')
  .replace(/\{\{\{EMAIL\}\}\}/g, email).split(UNSUB).join('https://meetnibble.com');
