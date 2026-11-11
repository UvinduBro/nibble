import { ImageResponse } from 'next/og';
import { nibbleSvg } from '../../lib/nibbleSvg';

export const dynamic = 'force-static';

// Renders Nibble to a 256px PNG and wraps it in an .ico container (PNG-in-ICO, Windows Vista+).
export async function GET() {
  const src = 'data:image/svg+xml;base64,' + Buffer.from(nibbleSvg({}, 256)).toString('base64');
  const img = new ImageResponse(<img src={src} width={256} height={256} alt="" />, { width: 256, height: 256 });
  const png = new Uint8Array(await img.arrayBuffer());
  const out = new Uint8Array(22 + png.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true); // type: icon
  dv.setUint16(4, 1, true); // one image
  dv.setUint16(10, 1, true); // planes
  dv.setUint16(12, 32, true); // bpp
  dv.setUint32(14, png.length, true);
  dv.setUint32(18, 22, true);
  out.set(png, 22);
  return new Response(out, { headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=86400' } });
}
