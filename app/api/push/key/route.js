// The public VAPID key the browser needs to subscribe to Nibble's push notifications.
import { vapidKeys } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  const k = vapidKeys();
  if (!k) return Response.json({ error: 'Notifications aren’t set up on the server yet.' }, { status: 503 });
  return Response.json({ key: k.publicKey }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
