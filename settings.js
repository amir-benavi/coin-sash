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
  // Each pickup shifts the blip by a random pentatonic note (semitones) plus comboStep per quick
  // consecutive pickup (within comboWindowMs), capped at comboMax steps; durationJitter is +/- fraction.
  coinSoundVariation: { scale: [-5, -3, 0, 2, 4], comboWindowMs: 600, comboStep: 2, comboMax: 4, durationJitter: 0.15 },
  fastDronesAt: 5,
  droneSpeedFast: 170,
  // One more drone every everySeconds of played time, up to max in total; new drones appear at an
  // edge at least minDistance px from the player and blink harmlessly for warnMs.
  droneSpawn: { everySeconds: 10, max: 7, minDistance: 220, warnMs: 1000 },
  hud: { heartSize: 20, heartGap: 10, heartFull: 0xff4d6d, heartEmpty: 0x6b7a93, emptyAlpha: 0.3, popScale: 1.6, barAlpha: 0.3 },
  lives: 3,
  hitInvulnerableMs: 1500,
  spareHeartMinCoins: 10,
  // Every everySeconds of played time the background cross-fades (fadeMs) to the next colour, cycling.
  // Keep the colours dark so player, coins and drones stay visible; the first should match colors.background.
  backgroundCycle: { everySeconds: 60, fadeMs: 1800, linePulse: 0.35,
    colors: [0x101c31, 0x22183f, 0x0c2a2e, 0x2b1620] },
  coinTypes: {
    bonusChance: 0.15, bonusValue: 3, bonusScale: 1.4,
    poisonEverySeconds: 6, poisonMax: 3, poisonLifetimeSeconds: 10, poisonWarnSeconds: 2,
    colors: { bonus: 0x7ff6ff, bonusOutline: 0xffffff, poison: 0xb04cff, poisonOutline: 0x2e0a45 }
  },
  // A freeze coin (ice-blue diamond, rarer than bonus, at most one per phase) stops all drones for freezeMs.
  freezeMs: 5000, freezeCoinChance: 0.05, freezeColors: { coin: 0xbff4ff, outline: 0xffffff, drone: 0x7fd8ff },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
