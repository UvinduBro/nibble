// The Mac disk image is built on a Mac by GitHub Actions (.github/workflows/mac-dmg.yml)
// and published as the latest GitHub release; this just points at it.
export function GET() {
  return Response.redirect('https://github.com/UvinduBro/nibble/releases/latest/download/Nibble.dmg', 302);
}
