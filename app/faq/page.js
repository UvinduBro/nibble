import { SitePage, FaqSection, FinalSection, FAQ } from '../../components/landing/HomeParts';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, faqLd, SITE } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('faq', '/faq');
}

export default function Faq() {
  return (
    <SitePage ld={[crumbsLd([['FAQ', SITE + '/faq']]), faqLd(FAQ)]}>
      <div className="lp-page-top" />
      <FaqSection />
      <FinalSection />
    </SitePage>
  );
}
