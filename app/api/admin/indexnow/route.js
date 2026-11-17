// Admin → SEO → "Ask search engines to re-crawl": IndexNow tells Bing (which also feeds ChatGPT
// search and Copilot), Yandex, Seznam and others that our pages changed, so they update quickly.
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { INDEXNOW_KEY } from '../../../../lib/indexnow-key';
import sitemap from '../../../sitemap';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = { 'cache-control': 'no-store' };
let last = 0;

export async function POST(req) {
  const token = bearer(req);
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try { if (!(await adminUid(token))) return Response.json({ error: 'Admins only.' }, { status: 403, headers: h }); }
  catch { return Response.json({ error: 'Couldn’t check your admin access.' }, { status: 502, headers: h }); }
  if (Date.now() - last < 10 * 60_000) return Response.json({ error: 'Already sent in the last 10 minutes.' }, { status: 429, headers: h });
  const urls = sitemap().map((x) => x.url).filter((u) => u.startsWith('https://meetnibble.com/') && !u.endsWith('.pdf'));
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, cache: 'no-store',
    body: JSON.stringify({ host: 'meetnibble.com', key: INDEXNOW_KEY, keyLocation: `https://meetnibble.com/${INDEXNOW_KEY}.txt`, urlList: urls }),
  }).catch(() => null);
  if (!r || (r.status !== 200 && r.status !== 202)) return Response.json({ error: `IndexNow answered ${r ? r.status : 'nothing'}. Try again later.` }, { status: 502, headers: h });
  last = Date.now();
  return Response.json({ ok: true, count: urls.length, urls }, { headers: h });
}
