import SocialApp from '../../components/social/SocialApp';
import { pageMetadata } from '../../lib/seo';

export function generateMetadata() {
  return pageMetadata('app', '/app');
}

export default function Page() {
  return <SocialApp mode="web" />;
}
