import { nibbleSvg } from '../../lib/nibbleSvg';

export const dynamic = 'force-static';

export function GET() {
  return new Response(nibbleSvg({}, 64), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
}
