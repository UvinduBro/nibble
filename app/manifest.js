export default function manifest() {
  return {
    name: 'Nibble Social',
    short_name: 'Nibble',
    description: 'Your desktop pet, your friends, music and games.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0f1714',
    theme_color: '#0f1714',
    icons: [
      { src: '/icons/nibble-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/nibble-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/nibble-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
