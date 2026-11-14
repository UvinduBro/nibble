import { Space_Grotesk, JetBrains_Mono, Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// public site (landing.css)
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'Nibble: a desktop pet that lives on your windows',
  description: 'A desktop pet for Windows and Mac. Walks on your windows, visits your friends, plays music together, dresses up and plays games for points.',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'Nibble: a desktop pet that lives on your windows', description: 'Walks on your windows. Codes with you. Dances to your music.' },
};

export const viewport = { themeColor: '#0f1714' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
