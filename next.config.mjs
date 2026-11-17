/** @type {import('next').NextConfig} */
// the deployed commit: engine files are loaded with ?v=<build> (never stale), and the desktop Hub
// compares it with /api/build to reload itself when a new version is live
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 12);
export default {
  env: { NEXT_PUBLIC_BUILD: BUILD },
  poweredByHeader: false,
  async headers() {
    // safe defaults on every response: HTTPS only, no MIME sniffing, no framing by other sites
    // (clickjacking), no plugins / <base> tricks, and no camera / mic / location access
    const security = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ];
    return [
      { source: '/:path*', headers: security },
      // the same site on *.vercel.app (the desktop app still loads it there) must not compete with
      // meetnibble.com in search results
      { source: '/:path*', has: [{ type: 'host', value: '(?<vhost>.+)\\.vercel\\.app' }], headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/nibble/engine/:file*', headers: [{ key: 'cache-control', value: 'public, max-age=300' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
