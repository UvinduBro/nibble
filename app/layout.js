import { Space_Grotesk, JetBrains_Mono, Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// public site (landing.css)
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const SITE = 'https://nibblex.vercel.app';
const TITLE = 'Nibble: a free desktop pet for Windows and Mac';
const DESC = 'Nibble is a free desktop pet that walks on your windows, naps when you’re away, dances to your music and visits your friends’ screens. Dress it up, play games for points and listen to music together. Windows 10/11 and macOS.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · Nibble' },
  description: DESC,
  applicationName: 'Nibble',
  keywords: ['desktop pet', 'desktop pet for Windows', 'desktop pet for Mac', 'virtual pet', 'cute desktop companion', 'shimeji alternative', 'desktop buddy', 'pet that walks on windows', 'listen together', 'free desktop app', 'Nibble', 'Sri Lanka'],
  authors: [{ name: 'Uvindu Rajapakshe' }],
  creator: 'Uvindu Rajapakshe',
  publisher: 'Nibble',
  category: 'entertainment',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icons/nibble-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/nibble-180.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website', url: '/', siteName: 'Nibble', locale: 'en_US', title: TITLE,
    description: 'Walks on your windows, visits your friends, plays music with you. Free for Windows and Mac.',
    images: [{ url: '/og/home.jpg', width: 1200, height: 630, alt: 'Nibble: a desktop pet that walks, plays and visits your friends' }],
  },
  twitter: {
    card: 'summary_large_image', title: TITLE,
    description: 'Walks on your windows, visits your friends, plays music with you. Free for Windows and Mac.',
    images: ['/og/home.jpg'],
  },
  ...(process.env.NEXT_PUBLIC_GSC_VERIFY ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFY } } : {}),
};

export const viewport = { themeColor: '#0f1714' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
