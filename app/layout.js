import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Nibble — a desktop pet that lives on your windows',
  description: 'A geeky little desktop pet for Windows. Walks on your windows, rides along when you drag them, codes with you in VS Code, dances to Spotify and reminds you to take breaks.',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'Nibble — a desktop pet that lives on your windows', description: 'Walks on your windows. Codes with you. Dances to your music.' },
};

export const viewport = { themeColor: '#0b0d17' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
