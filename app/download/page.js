import { SitePage, DownloadSection, StepsSection } from '../../components/landing/HomeParts';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, howToLd, SITE } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('download', '/download');
}

export default function DownloadPage() {
  return (
    <SitePage ld={[crumbsLd([['Download', SITE + '/download']]), howToLd()]}>
      <div className="lp-page-top" />
      <DownloadSection />
      <StepsSection />
    </SitePage>
  );
}
