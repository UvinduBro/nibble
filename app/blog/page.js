import BlogFrame from '../../components/blog/BlogFrame';
import { POSTS, readingMinutes, BLOG_UPDATED } from '../../lib/blog';
import { SITE, ldJson, crumbsLd } from '../../lib/facts';
import { pageMetadata } from '../../lib/seo';

const TITLE = 'The Nibble blog: desktop pets, friends, music and games';
const DESC = 'Guides and stories about Nibble, the free desktop pet for Windows and Mac: what desktop pets are, how Nibble walks on your windows, friends, music rooms, mini games and dressing up your pet.';

export async function generateMetadata() {
  const m = await pageMetadata('blog', '/blog');
  // the blog title is complete on its own (no "· Nibble" on the end)
  return { ...m, title: { absolute: m.title }, alternates: { ...m.alternates, types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'The Nibble blog' }] } } };
}

const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function BlogIndex() {
  const [first, ...rest] = POSTS;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Blog', '@id': SITE + '/blog#blog', name: 'The Nibble blog', url: SITE + '/blog', description: DESC,
      publisher: { '@id': SITE + '/#org' }, inLanguage: 'en', dateModified: BLOG_UPDATED,
      blogPost: POSTS.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date, image: SITE + p.hero })),
    },
    crumbsLd([['Blog', SITE + '/blog']]),
  ];
  return (
    <BlogFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <main className="bl-index">
        <header className="bl-head">
          <span className="lp-kicker">The Nibble blog</span>
          <h1>Desktop pets, friends, music and games.</h1>
          <p>Guides to everything Nibble does, from your first pet to music rooms with your friends. Nibble is a free desktop pet for Windows and Mac.</p>
        </header>
        <a className="bl-feature" href={`/blog/${first.slug}`}>
          <img src={first.hero} alt={first.heroAlt} />
          <div>
            <span className="bl-tag">{first.tag}</span>
            <h2>{first.title}</h2>
            <p>{first.description}</p>
            <small>{fmt(first.date)} · {readingMinutes(first)} min read</small>
          </div>
        </a>
        <ul className="bl-grid">
          {rest.map((p) => (
            <li key={p.slug}>
              <a href={`/blog/${p.slug}`}>
                <img src={p.hero} alt={p.heroAlt} loading="lazy" />
                <span className="bl-tag">{p.tag}</span>
                <h2>{p.title}</h2>
                <p>{p.description}</p>
                <small>{fmt(p.date)} · {readingMinutes(p)} min read</small>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </BlogFrame>
  );
}
