// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  pausePanel: { width: 460, height: 80, alpha: 0.9 },
  roundSeconds: 180,
  coinMin: 1,
  coinMax: 4,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  coinSoundVolume: 0.15,
  fastDronesAt: 5,
  droneSpeedFast: 170,
  lives: 3,
  hitInvulnerableMs: 1500,
  // Every everySeconds of played time the background cross-fades (fadeMs) to the next colour, cycling.
  // Keep the colours dark so player, coins and drones stay visible; the first should match colors.background.
  backgroundCycle: { everySeconds: 60, fadeMs: 1800, linePulse: 0.35,
    colors: [0x101c31, 0x22183f, 0x0c2a2e, 0x2b1620] },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
