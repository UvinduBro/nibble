import { buildCmd } from '../../lib/installer';

export function GET(req) {
  const origin = new URL(req.url).origin;
  return new Response(buildCmd(origin), {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="Install Nibble.cmd"',
      'cache-control': 'no-store',
    },
  });
}
