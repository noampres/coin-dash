// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  hunterSpeed: 150,
  hunterTurnRate: 2.4, // radians per second the hunter can turn
  hunterLead: 0.35, // seconds ahead of the player the hunter aims
  bonusDelayMin: 6000, // ms between bonus gems (random in range)
  bonusDelayMax: 10000,
  bonusLifetime: 4000, // ms a bonus gem stays before vanishing
  bonusValue: 3,
  freezeDuration: 4000, // ms drones stay frozen after a pickup
  freezeInterval: 11000, // ms between freeze pickup spawns
  freezeLifetime: 6000, // ms an uncollected freeze pickup stays on screen
  themes: {
    dark: { background: 0x101c31, grid: 0x24334b, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
      hud: '#ffffff', overlay: 0x0a1120, overlayText: '#ffffff' },
    light: { background: 0xf4f7fb, grid: 0xc9d3e1, player: 0x0f9d84, coin: 0xe09a00, drone: 0xe0364f,
      hud: '#1a2433', overlay: 0xffffff, overlayText: '#1a2433' }
  }
};
COIN_DASH.themes.dark.hunter = 0xff8c42;
COIN_DASH.themes.light.hunter = 0xd9620b;
COIN_DASH.themes.dark.bonus = 0xc77dff;
COIN_DASH.themes.light.bonus = 0x8e44d6;
Object.assign(COIN_DASH.themes.dark, { freeze: 0x5b8cff, freezeText: '#5b8cff' });
Object.assign(COIN_DASH.themes.light, { freeze: 0x2f62d9, freezeText: '#2f62d9' });
