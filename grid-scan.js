// A faint line that sweeps down the play field every few seconds, like a radar.
function createGridScan(scene) {
  const c = COIN_DASH;
  const s = c.gridScan;
  scene.scanMs = 0;
  scene.scanLine = scene.add.rectangle(c.width / 2, c.height, c.width, 2, s.color, s.alpha).setVisible(false);
}

// Counted in delta, so the sweep pauses with the game like the other timers.
function updateGridScan(scene, delta) {
  const c = COIN_DASH;
  const s = c.gridScan;
  scene.scanMs = (scene.scanMs + delta) % s.everyMs;
  if (scene.scanMs >= s.durationMs) {
    scene.scanLine.setVisible(false);
    return;
  }
  const t = scene.scanMs / s.durationMs;
  scene.scanLine.setVisible(true);
  scene.scanLine.setY(44 + t * (c.height - 44));
  scene.scanLine.setAlpha(s.alpha * (1 - t));
}
