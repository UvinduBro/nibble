// Admin → SEO → Save: the admin writes seo/site in Firestore (rules check it), then calls this so the
// site uses the new titles, descriptions and share images right away instead of within 5 minutes.
import { revalidateTag, revalidatePath } from 'next/cache';
import { adminUid, bearer } from '../../../../lib/adminAuth';
import { SEO_TAG } from '../../../../lib/seo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const h = { 'cache-control': 'no-store' };
  const token = bearer(req);
  if (!token) return Response.json({ error: 'Sign in as an admin.' }, { status: 401, headers: h });
  try { if (!(await adminUid(token))) return Response.json({ error: 'Admins only.' }, { status: 403, headers: h }); }
  catch { return Response.json({ error: 'Couldn’t check your admin access. Try again.' }, { status: 502, headers: h }); }
  try { revalidateTag(SEO_TAG, 'max'); } catch { try { revalidateTag(SEO_TAG); } catch {} }
  revalidatePath('/', 'layout');
  return Response.json({ ok: true }, { headers: h });
}
