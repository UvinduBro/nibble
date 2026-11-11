// Colour palettes + costume kits for Nibble. Add your own: copy one, change the hexes, restart the app.
// body: main fill · belly: tummy/face patch · ear: inner ear · line: outline
// eye: pupils · glow: antenna tip / sparkles · cheek: blush
// kit (optional): costume pieces drawn by draw.js + the special move pet.js performs.
(function (root) {
  const SKINS = {
    mint:     { label: 'Mint',      body: '#7ee8c6', belly: '#e3fff5', ear: '#ff9fb8', line: '#23343c', eye: '#1b2429', glow: '#ffd166', cheek: '#ff8fab' },
    midnight: { label: 'Midnight',  body: '#4a4785', belly: '#bdb9ff', ear: '#ff8fd0', line: '#14122e', eye: '#0d0b20', glow: '#5ef2ff', cheek: '#ff7ac3' },
    peach:    { label: 'Peach',     body: '#ffb38a', belly: '#fff0e6', ear: '#ff7f7f', line: '#3d2620', eye: '#2a1712', glow: '#ffe066', cheek: '#ff6b6b' },
    lavender: { label: 'Lavender',  body: '#b9a3ff', belly: '#f2edff', ear: '#ffb3d9', line: '#2a2345', eye: '#1c1730', glow: '#9dffb0', cheek: '#ff9ccf' },
    cyber:    { label: 'Cyberpunk', body: '#1d1b33', belly: '#2d2a52', ear: '#ff2bd6', line: '#00ffd5', eye: '#00ffd5', glow: '#ff2bd6', cheek: '#ff2bd6', neon: true },
    goldie:   { label: 'Goldie',    body: '#ffcc4d', belly: '#fff6d6', ear: '#ff9a62', line: '#3b2a10', eye: '#2b1d08', glow: '#ff5e5e', cheek: '#ff8a5c' },
    ghost:    { label: 'Ghost',     body: '#f4f6fb', belly: '#ffffff', ear: '#c9d3ff', line: '#3b4256', eye: '#262b38', glow: '#7aa2ff', cheek: '#ffb3c7' },
    lava:     { label: 'Lava',      body: '#ff6b3d', belly: '#ffd9a8', ear: '#ffd23f', line: '#3a120a', eye: '#250a05', glow: '#ffe14d', cheek: '#ffd23f' },
    ocean:    { label: 'Ocean',     body: '#4cc9f0', belly: '#e6f9ff', ear: '#f7a8c4', line: '#0f2c3d', eye: '#0a1d29', glow: '#b8f35a', cheek: '#ff9ebb' },

    // ---- anime-style crew (original characters) ----
    kaze: {
      label: 'Kaze · Shinobi', petName: 'Kaze', body: '#5a6496', belly: '#d6dcff', ear: '#ff8fa8', line: '#151a33', eye: '#0b0e1f', glow: '#ff4d5e', cheek: '#ff8fab',
      kit: { hood: '#1f2440', mask: '#3a4373', scarf: '#ff4d5e', antenna: false, eyes: 'sharp', special: 'shadowstep' },
    },
    hikari: {
      label: 'Hikari · Magical star', petName: 'Hikari', body: '#ffc2e2', belly: '#fff4fa', ear: '#ff7ab8', line: '#5a2346', eye: '#3a1d5c', glow: '#fff27a', cheek: '#ff6fae',
      kit: { bow: '#ff4fa3', wand: '#fff27a', eyes: 'sparkle', special: 'transform' },
    },
    tetsu: {
      label: 'Tetsu · Ronin', petName: 'Tetsu', body: '#9fb3c4', belly: '#eef3f7', ear: '#e8a0a0', line: '#1f2a33', eye: '#121a20', glow: '#ffd36b', cheek: '#f29a9a',
      kit: { kasa: '#d9b46a', katana: '#7a1f2b', antenna: false, eyes: 'sharp', special: 'iai' },
    },
    volt: {
      label: 'Volt · Mecha pilot', petName: 'Volt', body: '#59606e', belly: '#d5d9e0', ear: '#a3ff12', line: '#0e1116', eye: '#0e1116', glow: '#a3ff12', cheek: '#7dd3fc',
      kit: { visor: '#a3ff12', fin: '#e5e7eb', thrusters: '#2b3038', antenna: false, special: 'boost' },
    },
    kuro: {
      label: 'Kuro · Little oni', petName: 'Kuro', body: '#e2504a', belly: '#ffe0cc', ear: '#ffb36b', line: '#3a0d0d', eye: '#240707', glow: '#ffb020', cheek: '#ffd1a6',
      kit: { horns: '#fff3dc', fang: true, antenna: false, special: 'rage' },
    },
    yuki: {
      label: 'Yuki · Spirit cat', petName: 'Yuki', body: '#e8fbff', belly: '#ffffff', ear: '#a9e8ff', line: '#2a4a5a', eye: '#1b3442', glow: '#7ae2ff', cheek: '#ffc1dc',
      kit: { tails: 2, wisps: '#7ae2ff', antenna: false, eyes: 'sleepy', special: 'float' },
    },
    kumo: {
      label: 'Kumo · Cloud surfer', petName: 'Kumo', body: '#ffb36b', belly: '#fff3e2', ear: '#ff8f7a', line: '#3d2414', eye: '#24140a', glow: '#7bd88f', cheek: '#ff8a70',
      kit: { sprout: '#7bd88f', band: '#2ec4b6', cloud: '#ffffff', antenna: false, special: 'surf' },
    },
    // ---- humanoid anime chibi (drawn by drawChibi in draw.js) ----
    mojo: {
      label: 'Mojo · Pocket DJ', petName: 'Mojo', body: '#f2b134', belly: '#fff4e0', ear: '#ff6f61', line: '#1f2440', eye: '#1f2440', glow: '#2bb3a3', cheek: '#ff8a7a',
      kit: { antenna: false, special: 'beat' },
      chibi: {
        skin: '#ffe3cf', skinShade: '#efb9a0', hair: '#c9582b', hairHi: '#f39a62', hairDark: '#97391a', under: '#2bb3a3', underHi: '#6ff2df',
        jacket: '#f2b134', jacketDark: '#d6962b', sleeve: '#2bb3a3', cream: '#fff4e0', creamDark: '#e6d3b6', coral: '#ff6f61',
        shorts: '#2a9d8f', shortsDark: '#1d7a6f', iris: '#c06a17', irisHi: '#ffd27a', irisDark: '#8a4a0e', mouth: '#7a2630',
      },
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SKINS;
  else root.SKINS = SKINS;
})(typeof window !== 'undefined' ? window : globalThis);
