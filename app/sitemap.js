import { SITE } from './layout';
import release from '../public/version.json';

export default function sitemap() {
  const updated = new Date(release.date || Date.now());
  return [
    { url: `${SITE}/`, lastModified: updated, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/app`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/Nibble-Reinstall-Guide.pdf`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
