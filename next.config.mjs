/** @type {import('next').NextConfig} */
export default {
  async headers() {
    return [{ source: '/nibble/engine/:file*', headers: [{ key: 'cache-control', value: 'public, max-age=3600' }] }];
  },
};
