import { buildPs1 } from '../../lib/installer';

export function GET(req) {
  const origin = new URL(req.url).origin;
  return new Response(buildPs1(origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
