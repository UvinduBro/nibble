// The web app manifest: lets people add Nibble to their phone's home screen (or install it on a
// computer) and open /app full screen like an app. Icons are drawn by tools/pwa/make-icons.cjs.
export default function manifest() {
  return {
    id: '/app',
    name: 'Nibble',
    short_name: 'Nibble',
    description: 'Your pet, your friends, music and games. Chat with friends through your pets.',
    start_url: '/app?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#0f1714',
    theme_color: '#0f1714',
    categories: ['social', 'entertainment', 'games'],
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Messages', short_name: 'Messages', url: '/app?tab=messages&source=pwa', icons: [{ src: '/icons/app-192.png', sizes: '192x192' }] },
      { name: 'Groups', short_name: 'Groups', url: '/app?tab=groups&source=pwa', icons: [{ src: '/icons/app-192.png', sizes: '192x192' }] },
      { name: 'Friends', short_name: 'Friends', url: '/app?tab=friends&source=pwa', icons: [{ src: '/icons/app-192.png', sizes: '192x192' }] },
      { name: 'Games', short_name: 'Games', url: '/app?tab=games&source=pwa', icons: [{ src: '/icons/app-192.png', sizes: '192x192' }] },
    ],
    screenshots: [
      { src: '/icons/shot-home.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Your pet and friends' },
      { src: '/icons/shot-games.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Mini games and points' },
    ],
  };
}
