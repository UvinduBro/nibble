import { SitePage, ContactSection, FeedbackSection } from '../../components/landing/HomeParts';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, SITE } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('contact', '/contact');
}

export default function Contact() {
  return (
    <SitePage ld={crumbsLd([['Contact', SITE + '/contact']])}>
      <div className="lp-page-top" />
      <ContactSection />
      <FeedbackSection />
    </SitePage>
  );
}
