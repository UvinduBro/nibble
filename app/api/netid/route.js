// "Same network" id: a one-way, salted hash of the caller's public IP (IPv6: the /64 prefix).
// People behind the same router get the same id; the IP itself is never stored or returned.
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function clientIp(req) {
  const h = req.headers;
  const xf = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  return xf || h.get('x-real-ip') || '';
}
function prefix(ip) {
  if (!ip) return '';
  if (ip.includes(':') && !/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split('%')[0].split(':');
    // expand '::' far enough to take the first four groups (the /64 network)
    const i = parts.indexOf('');
    const full = i >= 0 ? [...parts.slice(0, i), ...Array(Math.max(0, 8 - parts.filter(Boolean).length)).fill('0'), ...parts.slice(i + 1).filter(Boolean)] : parts;
    return 'v6:' + full.slice(0, 4).map((x) => (x || '0').toLowerCase()).join(':');
  }
  return 'v4:' + ip.replace(/^::ffff:/, '');
}

export async function GET(req) {
  const p = prefix(clientIp(req));
  if (!p) return Response.json({ net: '' }, { headers: { 'cache-control': 'no-store' } });
  const salt = process.env.NET_SALT || 'nibble-lan-dev';
  const net = createHmac('sha256', salt).update(p).digest('hex').slice(0, 24);
  return Response.json({ net }, { headers: { 'cache-control': 'no-store' } });
}
