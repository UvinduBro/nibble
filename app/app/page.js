import SocialApp from '../../components/social/SocialApp';
import { pageMetadata } from '../../lib/seo';

export async function generateMetadata() {
  return {
    ...(await pageMetadata('app', '/app')),
    // "Add to Home Screen" on iPhone: open full screen with the app icon and name
    appleWebApp: { capable: true, title: 'Nibble', statusBarStyle: 'black-translucent' },
  };
}

// fill the whole phone screen (notch included); the app pads itself with safe-area insets
export const viewport = { themeColor: '#0f1714', viewportFit: 'cover', width: 'device-width', initialScale: 1 };

export default function Page() {
  return <SocialApp mode="web" />;
}
