import { buildSh } from '../../lib/installer';

// macOS installer:  curl -fsSL https://nibblex.vercel.app/install.sh | bash
export function GET(req) {
  const origin = new URL(req.url).origin;
  return new Response(buildSh(origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
