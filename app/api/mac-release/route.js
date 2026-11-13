// Is there a Mac .dmg yet, and is it signed + notarized by Apple? (read from the GitHub release notes)
export const revalidate = 300;
export async function GET() {
  try {
    const r = await fetch('https://api.github.com/repos/UvinduBro/nibble/releases/latest', {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'nibble-site' },
      next: { revalidate: 300 },
    });
    if (!r.ok) return Response.json({ ready: false });
    const j = await r.json();
    const dmg = (j.assets || []).find((a) => a.name === 'Nibble.dmg');
    const body = String(j.body || '');
    return Response.json({
      ready: !!dmg && /^mac-v/.test(j.tag_name || ''),
      version: String(j.tag_name || '').replace(/^mac-v/, ''),
      signed: /Signed with Developer ID: yes/.test(body),
      notarized: /Notarized by Apple: yes/.test(body),
      size: dmg ? dmg.size : 0,
    });
  } catch {
    return Response.json({ ready: false });
  }
}
