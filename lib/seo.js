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
  ['desktopPet', '/desktop-pet', 'Desktop pet app'],
  ['about', '/about', 'About'],
  ['installHelp', '/install-help', 'Install help'],
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
