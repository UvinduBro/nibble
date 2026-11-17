import { Space_Grotesk, JetBrains_Mono, Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import Analytics from '../components/landing/Analytics';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// public site (landing.css)
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

import { SITE, getSeo } from '../lib/seo';
export { SITE };

const ICONS = {
  icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/logo.svg', type: 'image/svg+xml' }, { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/icons/favicon-96.png', sizes: '96x96', type: 'image/png' }, { url: '/icons/nibble-192.png', sizes: '192x192', type: 'image/png' }],
  shortcut: '/favicon.ico',
  apple: [{ url: '/icons/nibble-180.png', sizes: '180x180' }],
};

// site-wide defaults; every page adds its own title, description and share image (lib/seo.js).
// Edited in Admin → SEO.
export async function generateMetadata() {
  const s = await getSeo();
  const home = s.pages.home;
  const img = home.ogImage;
  const google = s.googleVerify || process.env.NEXT_PUBLIC_GSC_VERIFY || '';
  return {
    metadataBase: new URL(SITE),
    title: { default: home.title, template: s.titleTemplate },
    description: home.description,
    applicationName: s.siteName,
    keywords: s.keywords.split(',').map((k) => k.trim()).filter(Boolean),
    authors: [{ name: 'Uvindu Rajapakshe' }],
    creator: 'Uvindu Rajapakshe',
    publisher: s.siteName,
    category: 'entertainment',
    alternates: { canonical: '/' },
    robots: s.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    icons: ICONS,
    openGraph: {
      type: 'website', url: '/', siteName: s.siteName, locale: 'en_US', title: home.ogTitle || home.title,
      description: home.ogDescription || home.description,
      ...(img ? { images: [{ url: img, width: 1200, height: 630, alt: home.ogAlt || home.title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image', title: home.ogTitle || home.title, description: home.ogDescription || home.description,
      ...(img ? { images: [img] } : {}), ...(s.twitter ? { site: s.twitter, creator: s.twitter } : {}),
    },
    ...(google || s.bingVerify ? { verification: { ...(google ? { google } : {}), ...(s.bingVerify ? { other: { 'msvalidate.01': s.bingVerify } } : {}) } } : {}),
  };
}

export const viewport = { themeColor: '#0f1714' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${body.variable}`}>
      <body>{children}<Analytics /></body>
    </html>
  );
}
