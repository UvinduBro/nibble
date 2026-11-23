// RSS feed of the Nibble blog (/blog/feed.xml): feed readers and search engines pick up new articles.
import { POSTS } from '../../../lib/blog';
import { SITE } from '../../../lib/facts';

export const dynamic = 'force-static';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const items = POSTS.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.date + 'T06:00:00Z').toUTCString()}</pubDate>
      <category>${esc(p.tag)}</category>
      <description>${esc(p.description)}</description>
      <enclosure url="${SITE}${p.hero}" type="image/webp" length="0" />
    </item>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Nibble blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Desktop pets, friends, music and games: guides to Nibble, the free desktop pet for Windows and Mac.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
