import SocialApp from '../../components/social/SocialApp';

export const metadata = { title: 'Nibble Social — your pets, your friends', description: 'Sign in, add friends by username and watch your pets visit each other. Hold a pet to talk.' };

export default function Page() {
  return <SocialApp mode="web" />;
}
