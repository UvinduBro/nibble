import { SitePage, DemoSection, FeaturesSection, ReachSection, FinalSection } from '../../components/landing/HomeParts';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, SITE } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('features', '/features');
}

export default function Features() {
  return (
    <SitePage ld={crumbsLd([['Features', SITE + '/features']])}>
      <div className="lp-page-top" />
      <DemoSection />
      <FeaturesSection />
      <ReachSection />
      <FinalSection />
    </SitePage>
  );
}
