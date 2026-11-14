import SocialApp from '../../components/social/SocialApp';

const D = 'Sign in to Nibble Social: add friends by username, watch your pets visit each other, listen to music together and play games for points. Works in your browser too.';
export const metadata = {
  title: 'Nibble Social: your pets, your friends',
  description: D,
  alternates: { canonical: '/app' },
  openGraph: { url: '/app', title: 'Nibble Social: your pets, your friends', description: D, images: [{ url: '/og/app.jpg', width: 1200, height: 630, alt: 'Nibble Social: your pets, your friends, one desktop' }] },
  twitter: { card: 'summary_large_image', title: 'Nibble Social: your pets, your friends', description: D, images: ['/og/app.jpg'] },
};

export default function Page() {
  return <SocialApp mode="web" />;
}
