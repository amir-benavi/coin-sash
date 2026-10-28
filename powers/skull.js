/* global Phaser, POWER_UPS */
// The skull is a trap, not a power-up: touching it resets this round's coins to 0.
// The best score is left alone; game.js only compares it with the score when the round ends.
POWER_UPS.skull = {
  label: 'COINS LOST!',
  color: 0xff3b3b,
  weight: 0.8,
  // A short red flash plus a shake so the loss is obvious; both stay under 300 ms.
  flashMs: 220,
  flashAlpha: 0.55,
  shakeMs: 250,
  shakeIntensity: 0.012,
  colors: { bone: 0xf2ecd8, outline: 0x8b0000, socket: 0x1a0a0a, glint: 0xff3b3b },

  createIcon(scene, x, y) {
    // About 26 x 29 px, centred on (0, 0) so the engine's pulse scales it around (x, y).
    const k = this.colors;
    const icon = scene.add.graphics({ x, y });
    // Fill slightly larger shapes in the outline colour first, then the bone on top: a 2 px
    // dark red rim shows around the skull, and none crosses where cranium and jaw meet.
    icon.fillStyle(k.outline, 1).fillCircle(0, -3, 13).fillRoundedRect(-9, 1, 18, 12, 4);
    icon.fillStyle(k.bone, 1).fillCircle(0, -3, 11).fillRoundedRect(-7, 3, 14, 8, 3);
    // Eye sockets with a small red glint, and a nose.
    icon.fillStyle(k.socket, 1).fillEllipse(-4.5, -3, 7, 8).fillEllipse(4.5, -3, 7, 8)
      .fillTriangle(0, 1.5, -2, 5, 2, 5);
    icon.fillStyle(k.glint, 1).fillCircle(-4.5, -2.5, 1.3).fillCircle(4.5, -2.5, 1.3);
    // Teeth: dark gaps across the jaw.
    icon.lineStyle(1.5, k.socket, 1).lineBetween(-3.5, 7, -3.5, 11).lineBetween(0, 7, 0, 11)
      .lineBetween(3.5, 7, 3.5, 11);
    return icon;
  },

  collect(scene) {
    scene.score = 0;
    // force = true restarts the effects if a second skull is taken while they are still running.
    const camera = scene.cameras.main;
    const rgb = Phaser.Display.Color.IntegerToColor(this.color);
    camera.flashEffect.alpha = this.flashAlpha;
    camera.flash(this.flashMs, rgb.red, rgb.green, rgb.blue, true);
    camera.shake(this.shakeMs, this.shakeIntensity, true);
  }
};
