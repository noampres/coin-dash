// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  themes: {
    dark: { background: 0x101c31, grid: 0x24334b, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
      hud: '#ffffff', overlay: 0x0a1120, overlayText: '#ffffff' },
    light: { background: 0xf4f7fb, grid: 0xc9d3e1, player: 0x0f9d84, coin: 0xe09a00, drone: 0xe0364f,
      hud: '#1a2433', overlay: 0xffffff, overlayText: '#1a2433' }
  }
};
