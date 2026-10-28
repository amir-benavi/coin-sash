/* global POWER_UPS */
// The shield power-up registers itself here: POWER_UPS.shield = { ... } (see powerups.js).
// Collecting it makes the player immune to drones and poison for shieldSeconds; collecting another one
// while active refreshes the timer (no stacking). Per-round state lives on the scene: scene.shieldMs
// (remaining ms, 0 = off), scene.shieldBubble (Graphics around the player), scene.shieldText (HUD countdown).
POWER_UPS.shield = {
  label: 'SHIELD',
  color: 0x7fd4ff,
  weight: 1,
  shieldSeconds: 10,
  warnSeconds: 2, // the bubble and countdown blink during the last warnSeconds
  iconWidth: 24,
  iconHeight: 28,
  iconColors: { fill: 0x8fd3ff, outline: 0xeaf7ff, emblem: 0x2f6fa8, highlight: 0xffffff },
  bubblePadding: 8, // gap between the player's corners and the bubble
  bubbleColors: { fill: 0x7fd4ff, fillAlpha: 0.18, outline: 0xbfeaff, outlineAlpha: 0.9 },
  hudX: 560, // countdown centre in the top bar, between the hearts (x 400) and Time (right-aligned)

  shieldPoints(w, h) {
    // Heater-shield outline centred on (0, 0): flat top, straight sides, then quadratic curves to a point.
    const top = -h / 2, bottom = h / 2, sideEnd = top + h * 0.45, ctrlY = bottom - h * 0.1;
    const right = [{ x: w / 2, y: top }, { x: w / 2, y: sideEnd }];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, a = (1 - t) * (1 - t), b = 2 * t * (1 - t);
      right.push({ x: (a + b) * w / 2, y: a * sideEnd + b * ctrlY + t * t * bottom });
    }
    // Mirror the right half (minus the bottom point) for the left side.
    const left = right.slice(0, -1).reverse().map((p) => ({ x: -p.x, y: p.y }));
    return [...right, ...left];
  },

  createIcon(scene, x, y) {
    const col = this.iconColors;
    const w = this.iconWidth, h = this.iconHeight;
    const icon = scene.add.graphics({ x, y });
    icon.fillStyle(col.fill, 1).fillPoints(this.shieldPoints(w, h), true);
    // Darker inner emblem and a small highlight on the upper left so it reads as metal.
    icon.lineStyle(2, col.emblem, 1).strokePoints(this.shieldPoints(w * 0.55, h * 0.55), true);
    icon.fillStyle(col.highlight, 0.6).fillRect(-w / 2 + 3, -h / 2 + 3, 4, 8);
    icon.lineStyle(2, col.outline, 1).strokePoints(this.shieldPoints(w, h), true);
    return icon;
  },

  collect(scene) {
    // Refresh rather than stack: always back to the full duration.
    scene.shieldMs = this.shieldSeconds * 1000;
    if (!scene.shieldBubble) scene.shieldBubble = scene.add.graphics();
    if (!scene.shieldText) {
      scene.shieldText = scene.add.text(this.hudX, 12, '', { font: '18px monospace', color: '#7fd4ff' })
        .setOrigin(0.5, 0);
    }
    this.drawBubble(scene);
  },

  reset(scene) {
    // scene.restart() has already destroyed the old display objects; just drop the references.
    scene.shieldMs = 0;
    scene.shieldBubble = null;
    scene.shieldText = null;
  },

  update(scene, delta) {
    // Runs only while not paused or finished, so pausing freezes the shield.
    if (!scene.shieldMs) return;
    scene.shieldMs = Math.max(0, scene.shieldMs - delta);
    if (scene.shieldMs > 0) {
      this.drawBubble(scene);
      return;
    }
    scene.shieldBubble.destroy();
    scene.shieldText.destroy();
    scene.shieldBubble = null;
    scene.shieldText = null;
  },

  blocksDamage(scene) {
    return scene.shieldMs > 0;
  },

  drawBubble(scene) {
    const col = this.bubbleColors;
    const player = scene.player;
    // Sized from the player's current display size, so it still fits if the player grows.
    const radius = Math.hypot(player.displayWidth, player.displayHeight) / 2 + this.bubblePadding;
    const bubble = scene.shieldBubble;
    bubble.clear().setPosition(player.x, player.y);
    bubble.fillStyle(col.fill, col.fillAlpha).fillCircle(0, 0, radius);
    bubble.lineStyle(3, col.outline, col.outlineAlpha).strokeCircle(0, 0, radius);
    // Blink during the last seconds so the player knows it is about to end.
    const ending = scene.shieldMs < this.warnSeconds * 1000;
    const alpha = ending && Math.floor(scene.shieldMs / 150) % 2 ? 0.2 : 1;
    bubble.setAlpha(alpha);
    scene.shieldText.setText(`SHIELD ${Math.ceil(scene.shieldMs / 1000)}s`).setAlpha(alpha);
  }
};
