/* global POWER_UPS */
// 2x: instantly doubles the coins collected so far (0 stays 0) and flashes the coin counter gold.
POWER_UPS.double = {
  label: '2x COINS!',
  color: 0x9dff6b,
  weight: 1,
  iconSize: 28,
  iconRadius: 7,
  iconFill: 0x0f5132,
  iconOutline: 0xffd166,
  flashColor: '#ffd166',
  flashScale: 1.3,
  flashMs: 600,

  createIcon(scene, x, y) {
    // Dark green rounded badge with a gold rim and bold gold "2x": unlike the plain round coins.
    const s = this.iconSize;
    const badge = scene.add.graphics();
    badge.fillStyle(this.iconFill, 1).fillRoundedRect(-s / 2, -s / 2, s, s, this.iconRadius);
    badge.lineStyle(2, this.iconOutline, 1).strokeRoundedRect(-s / 2, -s / 2, s, s, this.iconRadius);
    const text = scene.add.text(0, 0, '2x', { font: 'bold 15px monospace', color: this.flashColor }).setOrigin(0.5);
    return scene.add.container(x, y, [badge, text]);
  },

  collect(scene) {
    scene.score *= 2;
    // Flash the HUD: gold and enlarged, easing back. A second pickup restarts the flash, and the
    // HUD text is recreated on restart, so the white colour and scale 1 always come back.
    const hud = scene.hud;
    scene.tweens.killTweensOf(hud);
    hud.setColor(this.flashColor).setScale(1);
    scene.tweens.add({
      targets: hud,
      scale: { from: this.flashScale, to: 1 },
      duration: this.flashMs,
      ease: 'Back.easeOut',
      onComplete: () => hud.setColor('#ffffff').setScale(1)
    });
  }
};
