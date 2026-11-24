// SEO settings: defaults here, overrides saved by admins in Firestore (seo/site, edited in
// Admin → SEO). Server components read them through getSeo() (cached, refreshed within 5 minutes,
// or right away when an admin saves).
import { firebaseConfig } from './social/config';

export const SITE = 'https://meetnibble.com';
export const SEO_TAG = 'seo';

// pages that have their own title / description / share image
export const SEO_PAGES = [
  ['home', '/', 'Home'],
  ['app', '/app', 'Web app'],
  ['features', '/features', 'Features'],
  ['pets', '/pets', 'Pets'],
  ['download', '/download', 'Download'],
  ['faq', '/faq', 'FAQ'],
  ['contact', '/contact', 'Contact'],
  ['desktopPet', '/desktop-pet', 'Desktop pet app'],
  ['about', '/about', 'About'],
  ['installHelp', '/install-help', 'Install help'],
  ['blog', '/blog', 'Blog'],
  ['pricing', '/pricing', 'Pricing'],
  ['refunds', '/refunds', 'Refunds'],
  ['privacy', '/privacy', 'Privacy policy'],
  ['terms', '/terms', 'Terms of use'],
];

export const SEO_DEFAULTS = {
  siteName: 'Nibble',
  titleTemplate: '%s · Nibble',
  keywords: 'desktop pet, desktop pet for Windows, desktop pet for Mac, virtual pet, cute desktop companion, shimeji alternative, desktop buddy, pet that walks on windows, listen together, free desktop app, Nibble, Sri Lanka',
  twitter: '',
  googleVerify: '',
  bingVerify: '',
  noindex: false,
  pages: {
    home: {
      title: 'Nibble: a free desktop pet for Windows and Mac',
      description: 'Nibble is a free desktop pet that walks on your windows, naps when you’re away, dances to your music and visits your friends’ screens. Dress it up, play games for points and listen to music together. Windows 10/11 and macOS.',
      ogTitle: '', ogDescription: 'Walks on your windows, visits your friends, plays music with you. Free for Windows and Mac.',
      ogImage: '/og/home.jpg', ogAlt: 'Nibble: a desktop pet that walks, plays and visits your friends',
    },
    app: {
      title: 'Nibble Social: your pets, your friends',
      description: 'Sign in to Nibble Social: add friends by username, watch your pets visit each other, listen to music together and play games for points. Works in your browser too.',
      ogTitle: '', ogDescription: '', ogImage: '/og/app.jpg', ogAlt: 'Nibble Social: your pets, your friends, one desktop',
    },
    features: {
      title: 'Features: a desktop pet that walks on your windows',
      description: 'Everything Nibble does: walks on your windows, reacts to your apps, friends’ pets visit you, music rooms in sync, 14 mini games, points, reminders and more. Free for Windows and Mac.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Everything%20Nibble%20does&sub=A%20desktop%20pet%20that%20walks%2C%20plays%20and%20visits%20your%20friends&theme=mint', ogAlt: 'Nibble features',
    },
    pets: {
      title: 'Pets and characters: animals, anime crew and outfits',
      description: 'Meet the Nibble crew: 12 animals, the original Nibble and 8 anime characters, each with its own walk, voice and special move. Dress them in any outfit and colour.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Meet%20the%20crew&sub=Animals%2C%20anime%20characters%20and%20outfits&theme=pink', ogAlt: 'Nibble pets and characters',
    },
    download: {
      title: 'Download Nibble for Windows and Mac (free)',
      description: 'Get Nibble, the free desktop pet: from the Microsoft Store on Windows 10/11, or as a direct download for Windows and macOS 12+. Install help included.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Download%20Nibble&sub=Microsoft%20Store%2C%20Windows%20and%20Mac&theme=violet', ogAlt: 'Download Nibble',
    },
    faq: {
      title: 'Desktop pet FAQ: questions about Nibble',
      description: 'Is Nibble free? Will it slow my computer down? Does it work on Mac? Answers to the most common questions about Nibble, the desktop pet for Windows and Mac.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Nibble%20FAQ&sub=Answers%20about%20the%20desktop%20pet&theme=sun', ogAlt: 'Nibble FAQ',
    },
    contact: {
      title: 'Contact the Nibble team',
      description: 'Questions, press, partnerships or feedback: write to the people behind Nibble in Colombo, Sri Lanka, or report a bug and suggest a feature.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Contact%20Nibble&sub=We%20read%20every%20message&theme=mint', ogAlt: 'Contact Nibble',
    },
    desktopPet: {
      title: 'Desktop pet app for Windows and Mac (free)',
      description: 'Nibble is a free desktop pet app for Windows 10/11 and macOS: a cute animated pet that walks on your windows, reacts to your apps and visits your friends. No ads.',
      ogTitle: 'Nibble: a free desktop pet for Windows and Mac', ogDescription: '', ogImage: '/og/home.jpg', ogAlt: 'Nibble desktop pets walking on a desktop',
    },
    about: {
      title: 'About Nibble and the people behind it',
      description: 'Nibble is a free desktop pet for Windows and Mac, made by two people in Colombo, Sri Lanka. The story, the team and what we care about.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=About%20Nibble&sub=A%20tiny%20friend%20for%20your%20desktop%2C%20made%20in%20Sri%20Lanka&theme=mint', ogAlt: 'About Nibble',
    },
    installHelp: {
      title: 'Install help: Windows and Mac',
      description: 'Step-by-step help when Windows SmartScreen, Microsoft Defender or macOS Gatekeeper stops Nibble from installing or opening.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=Install%20help%3A%20Windows%20and%20Mac&sub=What%20to%20click%20when%20your%20computer%20blocks%20Nibble&theme=violet', ogAlt: 'Nibble install help for Windows and Mac',
    },
    blog: {
      title: 'The Nibble blog: desktop pets, friends, music and games',
      description: 'Guides and stories about Nibble, the free desktop pet for Windows and Mac: what desktop pets are, how Nibble walks on your windows, friends, music rooms, mini games and dressing up your pet.',
      ogTitle: '', ogDescription: '', ogImage: '/og?title=The%20Nibble%20blog&sub=Desktop%20pets%2C%20friends%2C%20music%20and%20games&theme=mint', ogAlt: 'The Nibble blog',
    },
    pricing: { title: 'Pricing: free, with optional Nibble Premium', description: 'Nibble is free with no ads. Nibble Premium is an optional subscription with a few extras. Prices, renewals, cancelling and the 14-day refund.', ogTitle: '', ogDescription: '', ogImage: '', ogAlt: '' },
    refunds: { title: 'Refunds and cancellations', description: 'Full refund within 14 days of any Nibble Premium payment. How to cancel, free trials and billing mistakes.', ogTitle: '', ogDescription: '', ogImage: '', ogAlt: '' },
    privacy: { title: 'Privacy policy', description: 'What Nibble collects, why, who processes it and how to delete it.', ogTitle: '', ogDescription: '', ogImage: '', ogAlt: '' },
    terms: { title: 'Terms of use', description: 'The simple rules for using Nibble.', ogTitle: '', ogDescription: '', ogImage: '', ogAlt: '' },
  },
};

export const SEO_LIMITS = { title: 70, description: 300, ogTitle: 90, ogDescription: 300, ogImage: 400, ogAlt: 140 };

const str = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, n);
// only our own paths, or https links
export const cleanImage = (u) => { const s = str(u, SEO_LIMITS.ogImage); return /^\/[^\s"'<>]*$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s) ? s : ''; };

// the saved doc → a complete, safe settings object (used by the server and the admin form)
export function mergeSeo(saved) {
  const d = SEO_DEFAULTS, s = saved && typeof saved === 'object' ? saved : {};
  const out = {
    siteName: str(s.siteName, 40) || d.siteName,
    titleTemplate: str(s.titleTemplate, 60).includes('%s') ? str(s.titleTemplate, 60) : d.titleTemplate,
    keywords: s.keywords != null ? str(s.keywords, 600) : d.keywords,
    twitter: str(s.twitter, 30).replace(/[^@\w]/g, ''),
    googleVerify: str(s.googleVerify, 100).replace(/[^\w-]/g, ''),
    bingVerify: str(s.bingVerify, 100).replace(/[^\w-]/g, ''),
    noindex: s.noindex === true,
    pages: {},
  };
  for (const [k] of SEO_PAGES) {
    const p = (s.pages && s.pages[k]) || {}, dp = d.pages[k];
    out.pages[k] = {
      title: str(p.title, SEO_LIMITS.title) || dp.title,
      description: str(p.description, SEO_LIMITS.description) || dp.description,
      ogTitle: str(p.ogTitle, SEO_LIMITS.ogTitle),
      ogDescription: p.ogDescription != null ? str(p.ogDescription, SEO_LIMITS.ogDescription) : dp.ogDescription,
      ogImage: p.ogImage != null ? cleanImage(p.ogImage) : dp.ogImage,
      ogAlt: str(p.ogAlt, SEO_LIMITS.ogAlt) || dp.ogAlt,
    };
  }
  return out;
}

// Firestore REST (seo/site is publicly readable), cached by Next under the 'seo' tag
const fsValue = (v) => {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fsValue(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
  return null;
};
export async function getSeo() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/seo/site?key=${firebaseConfig.apiKey}`;
    const r = await fetch(url, { next: { revalidate: 300, tags: [SEO_TAG] } });
    if (!r.ok) return mergeSeo(null);
    const j = await r.json();
    return mergeSeo(fsValue({ mapValue: { fields: j.fields || {} } }));
  } catch {
    return mergeSeo(null);
  }
}

// Next.js metadata for one page
export async function pageMetadata(key, path) {
  const s = await getSeo();
  const p = s.pages[key] || s.pages.home;
  const img = p.ogImage || s.pages.home.ogImage;
  const ogTitle = p.ogTitle || p.title;
  const ogDesc = p.ogDescription || p.description;
  const images = img ? [{ url: img, width: 1200, height: 630, alt: p.ogAlt || ogTitle }] : undefined;
  return {
    ...(key === 'home' ? { title: { absolute: p.title } } : { title: p.title }),
    description: p.description,
    alternates: { canonical: path },
    openGraph: { type: 'website', url: path, siteName: s.siteName, locale: 'en_US', title: ogTitle, description: ogDesc, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDesc, ...(img ? { images: [img] } : {}), ...(s.twitter ? { site: s.twitter, creator: s.twitter } : {}) },
  };
}
