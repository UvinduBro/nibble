// /llms-full.txt: everything an AI assistant needs to answer questions about Nibble accurately.
import { NAME, ALT_NAMES, ONE_LINER, PLATFORMS, VERSION, RELEASED, EMAIL, SOCIAL, FOUNDERS, FEATURES, STEPS, QA, LINKS, SITE } from '../../lib/facts';
import release from '../../public/version.json';

export const dynamic = 'force-static';

export function GET() {
  const body = `# ${NAME}: free desktop pet app for Windows and Mac

> ${ONE_LINER}

Also known as: ${ALT_NAMES.join(', ')}.
Website: ${SITE}
Download: ${SITE}/#download (Windows: Get-Nibble.exe; Mac: Nibble.dmg)
Price: free, no ads
Platforms: ${PLATFORMS}
Latest version: ${VERSION}${RELEASED ? ` (released ${RELEASED})` : ''}
Made by: ${FOUNDERS.map((f) => `${f.name} (${f.role})`).join('; ')}. Based in Colombo, Sri Lanka.
Contact: ${EMAIL}
Social: ${SOCIAL.join(', ')}

## What Nibble does

${FEATURES.map(([t, d]) => `- **${t}**: ${d}`).join('\n')}

## How to install

${STEPS.map(([t, d], i) => `${i + 1}. **${t}**: ${d}`).join('\n')}

## What's new in ${VERSION}

${(release.notes || []).map((n) => `- ${n}`).join('\n')}

## Questions and answers

${QA.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}

## Pages

${LINKS.map(([t, u]) => `- [${t}](${u})`).join('\n')}
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
