// Which build is live right now. The desktop Hub polls this and reloads itself after a deploy,
// so people get fixes without quitting Nibble.
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ build: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 12) }, { headers: { 'cache-control': 'no-store' } });
}
