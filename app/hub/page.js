import SocialApp from '../../components/social/SocialApp';

export const metadata = { title: 'Nibble Hub' };

// Loaded inside the desktop app's Hub window (with the window.nibbleDesktop bridge).
export default function Page() {
  return <SocialApp mode="desktop" />;
}
