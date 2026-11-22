import SocialApp from '../../components/social/SocialApp';

export const metadata = { title: 'Nibble', robots: { index: false, follow: false } };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover', themeColor: '#0e0f1a' };

// Loaded inside the Nibble phone app (Flutter WebView in mobile/, with the window.nibbleMobile bridge).
export default function Page() {
  return <SocialApp mode="mobile" />;
}
