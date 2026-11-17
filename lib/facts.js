// One source of truth about Nibble for search engines and AI assistants: llms.txt, llms-full.txt,
// the JSON-LD on each page and the /desktop-pet page all read from here, so they never disagree.
import release from '../public/version.json';

export const SITE = 'https://meetnibble.com';
export const NAME = 'Nibble';
export const ALT_NAMES = ['Nibble desktop pet', 'Nibble app', 'Meet Nibble', 'meetnibble'];
export const ONE_LINER = 'Nibble is a free desktop pet app for Windows and Mac: a small animated pet that walks along the top of your windows, naps when you’re away, reacts to the apps you use, and visits your friends’ screens.';
export const PLATFORMS = 'Windows 10, Windows 11, macOS 12 or newer (Apple silicon and Intel), and a web app in any browser';
export const EMAIL = 'hello@meetnibble.com';
export const SOCIAL = ['https://www.instagram.com/meet.nibble', 'https://x.com/meetnibble'];
export const FOUNDERS = [
  { name: 'Uvindu Rajapakshe', role: 'Creator: concept, design and code' },
  { name: 'Wageesha Ruvangi', role: 'Co-creator' },
];
export const VERSION = release.version;
export const RELEASED = release.date;

export const FEATURES = [
  ['Walks on your windows', 'The pet walks along the top edges of open windows, hops between them and lands on the taskbar or Dock.'],
  ['Reacts to what you do', 'It notices the app you’re using (code editors, design tools, music, games) and reacts, and it naps when you step away.'],
  ['Friends’ pets visit you', 'Add friends by username: their pets visit your desktop while you’re both online, deliver messages, pokes and hugs.'],
  ['Listen to music together', 'Listen Together rooms play the same YouTube or Spotify track for everyone in sync.'],
  ['Mini games and points', 'Single-player games like Pool and Ludo earn points to spend on outfits, colours and accessories.'],
  ['Many pets and looks', 'Animals and characters, outfits, colours and skills. Your pet’s look follows you to every computer.'],
  ['Reminders and breaks', 'Deadline reminders, shared reminders with friends, and gentle break reminders.'],
  ['Private by default', 'The names of the apps you use never leave your computer. Friends only see your username, your pet and what you send.'],
];

export const STEPS = [
  ['Download', 'Get Get-Nibble.exe for Windows or Nibble.dmg for Mac from meetnibble.com/#download.'],
  ['Install', 'Run the installer (Windows) or drag Nibble to Applications (Mac). If Windows SmartScreen or macOS blocks it, follow meetnibble.com/install-help.'],
  ['Meet your pet', 'A pet lands on your desktop about a minute later. Open the Nibble Hub from the tray or menu bar to sign in and add friends.'],
];

export const QA = [
  ['What is Nibble?', ONE_LINER],
  ['What is a desktop pet?', 'A desktop pet is a small animated character that lives on your computer screen on top of your other windows. It walks around, reacts to you and keeps you company while you work. Nibble is a modern desktop pet app for Windows and Mac with social features.'],
  ['Is Nibble free?', 'Yes. Nibble is free to download and use, with no ads. Every pet, game and social feature is free. Points are earned by playing and can’t be bought.'],
  ['Which computers does Nibble run on?', `Nibble runs on ${PLATFORMS}.`],
  ['Is Nibble safe to install?', 'Yes. The installer downloads the Electron runtime from GitHub and checks its SHA-256 before installing. Because Nibble is new and not code-signed yet, Windows SmartScreen may show “unknown publisher”: click More info, then Run anyway. Step-by-step help is at meetnibble.com/install-help.'],
  ['Will Nibble slow my computer down?', 'No. The pets sleep when you’re away and step aside in full-screen apps and games. Nibble uses about as much as a browser tab.'],
  ['Can my friends see my pet?', 'Yes. Sign in, add friends by username, and once they accept, your pet visits their desktop whenever you’re both online.'],
  ['Who makes Nibble?', `Nibble is made by ${FOUNDERS.map((f) => f.name).join(' and ')} in Colombo, Sri Lanka.`],
  ['How do I contact the Nibble team?', `Use the contact form at meetnibble.com/#contact or email ${EMAIL}.`],
];

export const LINKS = [
  ['Home', SITE + '/'],
  ['Download (Windows and Mac)', SITE + '/#download'],
  ['Desktop pet app: what Nibble is and does', SITE + '/desktop-pet'],
  ['Web app (Nibble Hub in the browser)', SITE + '/app'],
  ['Install help (SmartScreen, Defender, macOS Gatekeeper)', SITE + '/install-help'],
  ['About the team', SITE + '/about'],
  ['Release notes (JSON)', SITE + '/version.json'],
  ['Privacy policy', SITE + '/privacy'],
  ['Terms of use', SITE + '/terms'],
];

// ---------- JSON-LD ----------
export const orgLd = () => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '/#org',
  name: NAME, alternateName: ALT_NAMES, url: SITE, logo: SITE + '/icons/nibble-512.png', email: EMAIL, sameAs: SOCIAL,
  founder: FOUNDERS.map((f) => ({ '@type': 'Person', name: f.name, jobTitle: f.role })),
  foundingLocation: { '@type': 'Place', name: 'Colombo, Sri Lanka' },
});
export const appLd = () => ({
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': SITE + '/#app',
  name: NAME, alternateName: ALT_NAMES, description: ONE_LINER, url: SITE,
  applicationCategory: 'EntertainmentApplication', applicationSubCategory: 'Desktop pet',
  operatingSystem: 'Windows 10, Windows 11, macOS 12 or later', softwareVersion: VERSION, ...(RELEASED ? { dateModified: RELEASED } : {}),
  downloadUrl: SITE + '/#download', installUrl: SITE + '/#download', image: SITE + '/og/home.jpg', screenshot: SITE + '/og/home.jpg',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  featureList: FEATURES.map(([t]) => t), keywords: 'desktop pet, desktop pet app, virtual pet for Windows, desktop pet for Mac, desktop companion, Nibble',
  publisher: { '@id': SITE + '/#org' }, author: { '@id': SITE + '/#org' },
});
export const siteLd = () => ({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#site', name: NAME, alternateName: ALT_NAMES, url: SITE, publisher: { '@id': SITE + '/#org' }, inLanguage: 'en' });
export const faqLd = (qa = QA) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
export const howToLd = () => ({
  '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to install Nibble, the desktop pet app',
  totalTime: 'PT2M', tool: [{ '@type': 'HowToTool', name: 'A Windows 10/11 PC or a Mac with macOS 12+' }],
  step: STEPS.map(([n, t], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: t })),
});
export const crumbsLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [['Nibble', SITE + '/'], ...items].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});
// safe <script type="application/ld+json"> content
export const ldJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
