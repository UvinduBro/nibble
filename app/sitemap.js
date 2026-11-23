import { SITE } from './layout';
import release from '../public/version.json';
import { POSTS, BLOG_UPDATED } from '../lib/blog';

export default function sitemap() {
  const updated = new Date(release.date || Date.now());
  return [
    { url: `${SITE}/`, lastModified: updated, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/app`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/pricing`, lastModified: new Date('2026-11-21'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/refunds`, lastModified: new Date('2026-11-21'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: new Date('2026-11-21'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: new Date('2026-11-21'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/desktop-pet`, lastModified: updated, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/about`, lastModified: updated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/install-help`, lastModified: updated, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/blog`, lastModified: new Date(BLOG_UPDATED), changeFrequency: 'weekly', priority: 0.8 },
    ...POSTS.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: new Date(p.updated || p.date), changeFrequency: 'monthly', priority: 0.7, images: [SITE + p.hero] })),
    { url: `${SITE}/delete-account`, lastModified: new Date('2026-11-22'), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/Nibble-Reinstall-Guide.pdf`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
