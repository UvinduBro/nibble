import { notFound } from 'next/navigation';
import BlogFrame from '../../../components/blog/BlogFrame';
import { Blocks, Inline } from '../../../components/blog/Blocks';
import { POSTS, getPost, postOg, readingMinutes, postText, headingId } from '../../../lib/blog';
import { SITE, FOUNDERS, ldJson, crumbsLd } from '../../../lib/facts';

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const p = getPost((await params).slug);
  if (!p) return {};
  const img = postOg(p);
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    authors: [{ name: FOUNDERS[0].name, url: SITE + '/about' }],
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: {
      type: 'article', url: `/blog/${p.slug}`, title: p.title, description: p.description, publishedTime: p.date, modifiedTime: p.updated || p.date,
      authors: [FOUNDERS[0].name], section: p.tag, tags: p.keywords,
      images: [{ url: img, width: 1200, height: 630, alt: p.title }, { url: p.hero, alt: p.heroAlt }],
    },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [img] },
  };
}

const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Cta() {
  return (
    <div className="bl-cta">
      <div>
        <h2>Get Nibble, free</h2>
        <p>A desktop pet for Windows 10/11 and macOS 12+. No ads. Your pet lands on your desktop about a minute after you download.</p>
      </div>
      <div className="bl-cta-btns">
        <a className="lp-btn" href="/download">Download for Windows or Mac</a>
        <a className="lp-btn ghost" href="/app">Open in your browser</a>
      </div>
    </div>
  );
}

export default async function Post({ params }) {
  const p = getPost((await params).slug);
  if (!p) notFound();
  const toc = p.blocks.filter((b) => b[0] === 'h2').map((b) => [headingId(b[1]), b[1]]);
  if (p.blocks.some((b) => b[0] === 'qa')) toc.push(['questions', 'Quick questions']);
  const others = POSTS.filter((x) => x.slug !== p.slug);
  const i = POSTS.indexOf(p);
  const related = [...others.slice(i), ...others.slice(0, i)].slice(0, 3);
  const words = postText(p).split(/\s+/).length;
  const url = `${SITE}/blog/${p.slug}`;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': url + '#post', mainEntityOfPage: url, url,
      headline: p.title, description: p.description, keywords: p.keywords.join(', '), articleSection: p.tag, wordCount: words,
      image: [SITE + p.hero, SITE + postOg(p)], datePublished: p.date, dateModified: p.updated || p.date, inLanguage: 'en',
      author: { '@type': 'Person', name: FOUNDERS[0].name, url: SITE + '/about' },
      publisher: { '@id': SITE + '/#org' }, isPartOf: { '@id': SITE + '/blog#blog' }, about: { '@id': SITE + '/#app' },
    },
    crumbsLd([['Blog', SITE + '/blog'], [p.short || p.title, url]]),
  ];
  return (
    <BlogFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <main className="bl-post">
        <nav className="bl-crumbs" aria-label="Breadcrumb"><a href="/">Nibble</a><span aria-hidden>›</span><a href="/blog">Blog</a><span aria-hidden>›</span><span>{p.short}</span></nav>
        <header className="bl-post-head">
          <span className="bl-tag">{p.tag}</span>
          <h1>{p.title}</h1>
          <p className="bl-lede">{p.description}</p>
          <p className="bl-meta">By <a href="/about">{FOUNDERS[0].name}</a> · <time dateTime={p.date}>{fmt(p.date)}</time> · {readingMinutes(p)} min read</p>
        </header>
        <figure className="bl-hero"><img src={p.hero} alt={p.heroAlt} fetchPriority="high" /></figure>
        <div className="bl-body-wrap">
          {toc.length > 2 && (
            <aside className="bl-toc" aria-label="On this page">
              <b>On this page</b>
              <ol>{toc.map(([id, t]) => <li key={id}><a href={'#' + id}><Inline text={t} /></a></li>)}</ol>
            </aside>
          )}
          <article className="bl-body">
            <Blocks blocks={p.blocks} cta={<Cta />} />
          </article>
        </div>
        <section className="bl-more" aria-label="More from the blog">
          <h2>Keep reading</h2>
          <ul className="bl-grid small">
            {related.map((r) => (
              <li key={r.slug}>
                <a href={`/blog/${r.slug}`}>
                  <img src={r.hero} alt={r.heroAlt} loading="lazy" />
                  <span className="bl-tag">{r.tag}</span>
                  <h3>{r.title}</h3>
                  <small>{readingMinutes(r)} min read</small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </BlogFrame>
  );
}
