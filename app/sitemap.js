import { SITE } from './layout';
import release from '../public/version.json';

export default function sitemap() {
  const updated = new Date(release.date || Date.now());
  return [
    { url: `${SITE}/`, lastModified: updated, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/app`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/privacy`, lastModified: new Date('2026-11-15'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: new Date('2026-11-15'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/about`, lastModified: updated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/install-help`, lastModified: updated, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/Nibble-Reinstall-Guide.pdf`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
