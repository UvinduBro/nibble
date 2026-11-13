import { buildFileList } from '../../lib/installer';

// The app files every install needs (read by Get-Nibble.exe and by the app's own self-repair).
export function GET() {
  return new Response(buildFileList(), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
