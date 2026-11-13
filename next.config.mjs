/** @type {import('next').NextConfig} */
// the deployed commit: engine files are loaded with ?v=<build> (never stale), and the desktop Hub
// compares it with /api/build to reload itself when a new version is live
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 12);
export default {
  env: { NEXT_PUBLIC_BUILD: BUILD },
  async headers() {
    return [{ source: '/nibble/engine/:file*', headers: [{ key: 'cache-control', value: 'public, max-age=300' }] }];
  },
};
