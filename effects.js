/* global Phaser, COIN_DASH */
// Visual-only effects. Nothing here touches physics bodies, groups or game state.
const BLAST = { durationMs: 600, particles: 12, shakeMs: 150, shakeIntensity: 0.004 };

function blastAt(scene, x, y, color) {
  const warm = 0xfff3b0;
  const life = BLAST.durationMs;
  // Bright flash core that grows and fades quickly.
  const flash = scene.add.circle(x, y, 9, warm, 1).setDepth(10);
  scene.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: life * 0.5, ease: 'Quad.easeOut',
    onComplete: () => flash.destroy() });
  // Shockwave ring expanding outwards.
  const ring = scene.add.circle(x, y, 10, 0x000000, 0).setStrokeStyle(3, color, 1).setDepth(10);
  scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: life, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy() });
  // Small particles in the drone colour, with some warm sparks mixed in.
  for (let i = 0; i < BLAST.particles; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(30, 70);
    const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 4), i % 3 === 0 ? warm : color, 1).setDepth(10);
    scene.tweens.add({ targets: dot, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
      alpha: 0, duration: life * Phaser.Math.FloatBetween(0.7, 1), ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy() });
  }
  // Small shake; intensity is a fraction of the camera size.
  scene.cameras.main.shake(BLAST.shakeMs, BLAST.shakeIntensity);
}
