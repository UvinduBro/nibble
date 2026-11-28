// Shows a GIF someone sent: redirects to the provider's file. Cached by Vercel for a day.
import { gifMediaUrl } from '../../../../../../lib/gif';

export const runtime = 'nodejs';

export async function GET(_req, ctx) {
  const { p, id } = await ctx.params;
  const url = await gifMediaUrl(String(p), String(id)).catch(() => '');
  if (!url) return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'public, max-age=86400, s-maxage=86400, immutable' } });
}
