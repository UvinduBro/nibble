import { SITE } from './layout';

// Search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot…) are welcome
// on the public pages, so people can find Nibble when they ask for a desktop pet app.
// Private areas (admin, desktop Hub, sign-in hand-off, APIs) stay out of every index.
const PRIVATE = ['/admin', '/hub', '/link', '/api/'];
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'meta-externalagent', 'CCBot'];

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ['/', '/llms.txt', '/llms-full.txt'], disallow: PRIVATE },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
