import { SitePage, CrewSection, FinalSection } from '../../components/landing/HomeParts';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, SITE } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('pets', '/pets');
}

export default function Pets() {
  return (
    <SitePage ld={crumbsLd([['Pets and characters', SITE + '/pets']])}>
      <div className="lp-page-top" />
      <CrewSection />
      <FinalSection />
    </SitePage>
  );
}
