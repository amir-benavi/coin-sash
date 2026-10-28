/* global Phaser, COIN_DASH, POWER_UPS */
const HIGH_SCORE_KEY = 'coinDash.highScore';
let memoryHighScore = 0;
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.highScore = this.loadHighScore();
    this.paused = false;
    this.hearts = c.lives;
    this.invulnerableMs = 0;
    this.pulseMs = 0;
    this.poisonSpawnMs = c.coinTypes.poisonEverySeconds * 1000;
    this.spareHeartUsed = false;
    // Coins touched this round (not score, which power-ups double or zero): drives speed and size.
    this.coinsPicked = 0;
    this.playerSpeed = c.playerSpeed;
    this.playerScale = 1; // target scale; updateGrowth() eases the player towards it
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.background = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    // Top bar (y 0–44, above the play area): coins left, hearts centred, time right-aligned.
    this.add.rectangle(c.width / 2, 22, c.width, 44, 0x000000, c.hud.barAlpha);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.timeText = this.add.text(c.width - 18, 12, '', { font: '18px monospace', color: '#ffffff' }).setOrigin(1, 0);
    this.createHearts();
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.poisonCoins = this.physics.add.group();
    this.powerUps = this.physics.add.group();
    this.powerSpawnMs = c.powerUps.firstAfterSeconds * 1000;
    Object.values(POWER_UPS).forEach((power) => power.reset && power.reset(this));
    this.coins = this.physics.add.group();
    this.phaseOver = false;
    this.spawnPhase();
    this.drones = this.physics.add.group();
    this.dronesFast = false;
    for (let i = 0; i < c.droneCount; i++) this.spawnDrone(i);
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      // Disable first so the same coin cannot be counted twice.
      if (this.finished || !coin.active) return;
      this.coins.killAndHide(coin);
      coin.body.enable = false;
      this.score += coin.value;
      this.coinsPicked++;
      this.playCoinSound();
      // Mark the phase as over here; update() spawns the next one outside the physics callback.
      if (this.coins.countActive(true) === 0) this.phaseOver = true;
    });
    this.physics.add.overlap(this.player, this.drones, () => this.hitDrone());
    this.physics.add.overlap(this.player, this.poisonCoins, (player, poison) => this.hitPoison(poison));
    this.physics.add.overlap(this.player, this.powerUps, (player, item) => this.collectPowerUp(item));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    // keydown-P fires for both p and P; Shift tells resume apart from pause.
    this.input.keyboard.on('keydown-P', (event) => (event.shiftKey ? this.resumeRound() : this.pauseRound()));
    // Browsers may suspend audio until a user gesture; resume on any key press.
    this.input.keyboard.on('keydown', () => {
      const ctx = this.audioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    });
  }

  audioContext() {
    // Prefer Phaser's WebAudio context; otherwise lazily create our own (null if unsupported).
    if (this.sound && this.sound.context) return this.sound.context;
    if (this.audioCtx === undefined) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      try { this.audioCtx = Ctx ? new Ctx() : null; } catch (e) { this.audioCtx = null; }
    }
    return this.audioCtx;
  }

  playCoinSound() {
    // Synthesized two-note "blip" so the game needs no audio assets.
    try {
      const ctx = this.audioContext();
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(988, t);
      osc.frequency.setValueAtTime(1319, t + 0.05);
      gain.gain.setValueAtTime(COIN_DASH.coinSoundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch (e) { /* audio is optional */ }
  }

  spawnDrone(i) {
    // Drone i of droneCount; also used by power-ups that bring drones back.
    const c = COIN_DASH;
    const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
    this.drones.add(drone);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    const angle = (35 + i * 105) * Math.PI / 180;
    const speed = this.dronesFast ? c.droneSpeedFast : c.droneSpeed;
    drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return drone;
  }

  spawnPhase() {
    // Remove leftover collected coins, then place a new random group of coins.
    this.coins.clear(true, true);
    const count = Phaser.Math.Between(COIN_DASH.coinMin, COIN_DASH.coinMax);
    for (let i = 0; i < count; i++) this.placeCoin();
  }

  randomSpot() {
    const c = COIN_DASH;
    // Avoid spawning directly underneath the player, and keep coins, poison and power-ups apart.
    const others = [...this.coins.getChildren().filter((coin) => coin.active), ...this.poisonCoins.getChildren(),
      ...this.powerUps.getChildren()];
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60
      || others.some((other) => Phaser.Math.Distance.Between(x, y, other.x, other.y) < 40));
    return { x, y };
  }

  placeCoin() {
    const c = COIN_DASH;
    const t = c.coinTypes;
    const { x, y } = this.randomSpot();
    // Sometimes a coin is a bigger, pulsing bonus coin (scaled in updateCoins()).
    const bonus = Math.random() < t.bonusChance;
    const coin = this.add.circle(x, y, 9, bonus ? t.colors.bonus : c.colors.coin);
    if (bonus) coin.setStrokeStyle(2, t.colors.bonusOutline);
    coin.value = bonus ? t.bonusValue : 1;
    this.physics.add.existing(coin);
    coin.body.setCircle(9);
    coin.body.reset(x, y);
    this.coins.add(coin);
  }

  spawnPoison() {
    const t = COIN_DASH.coinTypes;
    const { x, y } = this.randomSpot();
    const poison = this.add.star(x, y, 6, 6, 13, t.colors.poison).setStrokeStyle(2, t.colors.poisonOutline);
    this.poisonCoins.add(poison);
    poison.lifeMs = t.poisonLifetimeSeconds * 1000;
  }

  hitPoison(poison) {
    if (this.finished || !poison.body.enable) return;
    // Consumed on touch even while invulnerable. Destroying it here would edit the group
    // mid-overlap, so updateCoins() removes it on the next frame.
    poison.body.enable = false;
    poison.setVisible(false);
    poison.lifeMs = 0;
    this.loseHeart('Poison got you!');
  }

  createHearts() {
    const c = COIN_DASH;
    // Sample the classic parametric heart once, scaled to heartSize px tall and centred on (0, 0).
    const raw = [];
    for (let i = 0; i < 40; i++) {
      const t = i / 40 * Math.PI * 2;
      raw.push({ x: 16 * Math.sin(t) ** 3,
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
    }
    const top = Math.min(...raw.map((p) => p.y));
    const bottom = Math.max(...raw.map((p) => p.y));
    const k = c.hud.heartSize / (bottom - top);
    this.heartShape = raw.map((p) => ({ x: p.x * k, y: (p.y - (top + bottom) / 2) * k }));
    const step = 32 * k + c.hud.heartGap; // the curve is 32 units wide
    this.heartIcons = [];
    for (let i = 0; i < c.lives; i++) {
      this.heartIcons.push(this.add.graphics({ x: c.width / 2 + (i - (c.lives - 1) / 2) * step, y: 22 }));
    }
    this.shownHearts = -1; // forces the first drawHearts() to paint every icon
    this.drawHearts();
  }

  drawHearts() {
    // Redraw only when the count changes.
    if (this.shownHearts === this.hearts) return;
    const hud = COIN_DASH.hud;
    this.heartIcons.forEach((icon, i) => {
      icon.clear();
      if (i < this.hearts) {
        icon.fillStyle(hud.heartFull, 1).fillPoints(this.heartShape, true);
        return;
      }
      icon.fillStyle(hud.heartEmpty, hud.emptyAlpha).fillPoints(this.heartShape, true);
      icon.lineStyle(2, hud.heartEmpty, 1).strokePoints(this.heartShape, true);
      // Pop the heart that was just lost; the scene's tweens are killed on restart.
      if (i < this.shownHearts) {
        this.tweens.add({ targets: icon, scale: { from: hud.popScale, to: 1 }, duration: 250, ease: 'Back.easeOut' });
      }
    });
    this.shownHearts = this.hearts;
  }

  hitDrone() {
    this.loseHeart('A drone caught you!');
  }

  loseHeart(reason) {
    // The overlap fires every frame while touching, so ignore hits while invulnerable.
    if (this.finished || this.hearts === 0 || this.invulnerableMs > 0) return;
    if (Object.values(POWER_UPS).some((power) => power.blocksDamage && power.blocksDamage(this))) return;
    this.hearts--;
    this.deathReason = reason;
    if (this.hearts === 0) return; // update() ends the round after refreshing the HUD.
    this.invulnerableMs = COIN_DASH.hitInvulnerableMs;
  }

  grantSpareHeart() {
    // One spare heart per round, only once the player has enough coins.
    if (this.spareHeartUsed || this.score <= COIN_DASH.spareHeartMinCoins) return false;
    this.spareHeartUsed = true;
    this.hearts = 1;
    // Brief invulnerability so a drone still overlapping the player does not hit again next frame.
    this.invulnerableMs = COIN_DASH.hitInvulnerableMs;
    return true;
  }

  update(time, delta) {
    if (this.finished || this.paused) return;
    this.updateBackground();
    if (this.phaseOver) {
      this.phaseOver = false;
      this.spawnPhase();
    }
    // Speed drones up once, keeping each drone's current direction.
    if (!this.dronesFast && this.score >= COIN_DASH.fastDronesAt) {
      this.dronesFast = true;
      this.drones.getChildren().forEach((drone) => {
        const v = drone.body.velocity;
        if (v.length() === 0) return;
        const dir = v.clone().normalize();
        drone.body.setVelocity(dir.x * COIN_DASH.droneSpeedFast, dir.y * COIN_DASH.droneSpeedFast);
      });
    }
    // Blink while invulnerable; a countdown (not a timer or tween) leaves nothing behind on restart.
    this.invulnerableMs = Math.max(0, this.invulnerableMs - delta);
    this.player.setAlpha(this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 100) % 2 ? 0.25 : 1);
    this.updateCoins(delta);
    this.updatePowerUps(delta);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    this.updateGrowth(delta);
    const g = COIN_DASH.growth;
    this.playerSpeed = Math.min(g.maxPlayerSpeed, COIN_DASH.playerSpeed + g.speedPerCoin * this.coinsPicked);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}   Best: ${this.highScore}`);
    this.timeText.setText(`Time: ${seconds}s`);
    this.drawHearts();
    if (seconds === 0) this.finish('Time is up!');
    if (this.hearts === 0 && !this.grantSpareHeart()) this.finish(this.deathReason);
  }

  updateCoins(delta) {
    const t = COIN_DASH.coinTypes;
    // Like the invulnerability countdown, these run on delta, so they stop while paused.
    this.pulseMs += delta;
    const pulse = Math.sin(this.pulseMs / 150);
    this.coins.getChildren().forEach((coin) => coin.setScale(coin.value > 1 ? t.bonusScale * (1 + 0.08 * pulse) : 1));
    this.poisonSpawnMs -= delta;
    if (this.poisonSpawnMs <= 0) {
      this.poisonSpawnMs += t.poisonEverySeconds * 1000;
      if (this.poisonCoins.getLength() < t.poisonMax) this.spawnPoison();
    }
    for (const poison of this.poisonCoins.getChildren().slice()) {
      poison.lifeMs -= delta;
      if (poison.lifeMs <= 0) {
        poison.destroy();
        continue;
      }
      poison.setScale(1 + 0.15 * pulse).setAngle(12 * pulse);
      // Blink during the last seconds so the player can see it is about to vanish.
      const fading = poison.lifeMs < t.poisonWarnSeconds * 1000;
      poison.setAlpha(fading && Math.floor(poison.lifeMs / 150) % 2 ? 0.2 : 1);
    }
  }

  updateGrowth(delta) {
    // One growth step every growEvery coins picked up, capped at maxScale.
    const g = COIN_DASH.growth;
    const target = Math.min(g.maxScale, 1 + g.growStep * Math.floor(this.coinsPicked / g.growEvery));
    if (target > this.playerScale) {
      this.playerScale = target;
      const label = this.add.text(this.player.x, this.player.y - 12 * target - 16, 'BIGGER!',
        { font: 'bold 14px monospace', color: Phaser.Display.Color.IntegerToColor(COIN_DASH.colors.player).rgba })
        .setOrigin(0.5);
      this.tweens.add({ targets: label, y: label.y - 20, alpha: 0, duration: 700, onComplete: () => label.destroy() });
    }
    // Ease on delta like the countdowns, so growing stops while paused and nothing outlives a restart.
    // The Arcade body follows on its own: each step Body.updateBounds() sets its size to the rectangle's
    // 24x24 times scale, keeps it centred, and collideWorldBounds pushes it back inside the play area.
    const scale = this.player.scaleX;
    if (scale < this.playerScale) {
      this.player.setScale(Math.min(this.playerScale, scale + g.growStep * delta / g.growMs));
    }
  }

  spawnPowerUp() {
    const kinds = Object.keys(POWER_UPS);
    if (kinds.length === 0) return;
    // Weighted random pick among the registered power-ups.
    const weights = kinds.map((kind) => POWER_UPS[kind].weight || 1);
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    const kind = kinds.find((k, i) => (roll -= weights[i]) < 0) || kinds[kinds.length - 1];
    const cfg = COIN_DASH.powerUps;
    const { x, y } = this.randomSpot();
    // An invisible circle is the hitbox; the power's own icon is drawn on top of it.
    const item = this.add.circle(x, y, cfg.hitRadius, 0xffffff, 0);
    this.physics.add.existing(item);
    item.body.setCircle(cfg.hitRadius);
    item.body.reset(x, y);
    this.powerUps.add(item);
    item.kind = kind;
    item.lifeMs = cfg.lifetimeSeconds * 1000;
    item.icon = POWER_UPS[kind].createIcon(this, x, y);
  }

  collectPowerUp(item) {
    if (this.finished || !item.body.enable) return;
    // Like poison: disable now, updatePowerUps() destroys it outside the overlap callback.
    item.body.enable = false;
    item.icon.setVisible(false);
    item.lifeMs = 0;
    const power = POWER_UPS[item.kind];
    power.collect(this);
    const label = this.add.text(this.player.x, this.player.y - 24, power.label,
      { font: 'bold 18px monospace', color: Phaser.Display.Color.IntegerToColor(power.color || 0xffffff).rgba })
      .setOrigin(0.5);
    this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }

  updatePowerUps(delta) {
    const cfg = COIN_DASH.powerUps;
    this.powerSpawnMs -= delta;
    if (this.powerSpawnMs <= 0) {
      this.powerSpawnMs += cfg.everySeconds * 1000;
      if (this.powerUps.getLength() < cfg.max) this.spawnPowerUp();
    }
    const pulse = Math.sin(this.pulseMs / 200);
    for (const item of this.powerUps.getChildren().slice()) {
      item.lifeMs -= delta;
      if (item.lifeMs <= 0) {
        item.icon.destroy();
        item.destroy();
        continue;
      }
      // Gentle bob, then blink during the last seconds like the poison coins.
      item.icon.setScale(1 + 0.08 * pulse);
      item.icon.setAlpha(item.lifeMs < cfg.warnSeconds * 1000 && Math.floor(item.lifeMs / 150) % 2 ? 0.2 : 1);
    }
    Object.values(POWER_UPS).forEach((power) => power.update && power.update(this, delta));
  }

  updateBackground() {
    // Cross-fade to the next palette colour every everySeconds of played time. Everything derives
    // from the deadline (which resume pushes back), so pausing and restarting need no extra state.
    const cycle = COIN_DASH.backgroundCycle;
    const everyMs = cycle.everySeconds * 1000;
    const elapsed = COIN_DASH.roundSeconds * 1000 - (this.deadline - this.time.now);
    const step = Math.max(0, Math.floor(elapsed / everyMs));
    const progress = step === 0 ? 1 : Math.min(1, (elapsed - step * everyMs) / cycle.fadeMs);
    const colors = cycle.colors;
    const grid = this.background;
    // Brief glow of the grid lines while fading: 0 at the start and end of the fade, peak halfway.
    if (grid.baseLineAlpha === undefined) grid.baseLineAlpha = grid.outlineFillAlpha;
    grid.setOutlineStyle(grid.outlineFillColor, grid.baseLineAlpha + cycle.linePulse * Math.sin(progress * Math.PI));
    let color = colors[step % colors.length];
    if (progress < 1) {
      const from = Phaser.Display.Color.IntegerToColor(colors[(step - 1) % colors.length]);
      const to = Phaser.Display.Color.IntegerToColor(color);
      color = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 1000, Math.round(progress * 1000)).color;
    }
    const camera = this.cameras.main;
    if (color === grid.fillColor && color === camera.backgroundColor.color) return;
    grid.setFillStyle(color, 1);
    camera.setBackgroundColor(color);
  }

  pauseRound() {
    if (this.finished || this.paused) return;
    this.paused = true;
    this.pausedAt = this.time.now;
    this.physics.pause();
    const c = COIN_DASH;
    const panel = c.pausePanel;
    this.pauseOverlay = this.add.container(0, 0, [
      this.add.rectangle(c.width / 2, c.height / 2, panel.width, panel.height, 0x0a1120, panel.alpha),
      this.add.text(c.width / 2, c.height / 2, 'PAUSED — press Shift+P to resume',
        { font: '20px monospace', color: '#ffffff' }).setOrigin(0.5)
    ]);
  }

  resumeRound() {
    if (!this.paused) return;
    this.paused = false;
    // The round timer reads this.deadline, so push it back by the time spent paused.
    this.deadline += this.time.now - this.pausedAt;
    this.pauseOverlay.destroy();
    this.physics.resume();
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    const isNewBest = this.score > this.highScore;
    if (isNewBest) this.saveHighScore(this.score);
    const best = isNewBest ? 'New high score!' : `Best: ${this.highScore}`;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 190, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\n${best}\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }

  // localStorage may be blocked (file://, private mode); fall back to memory.
  loadHighScore() {
    try {
      const stored = parseInt(window.localStorage.getItem(HIGH_SCORE_KEY), 10);
      if (stored >= 0) memoryHighScore = Math.max(memoryHighScore, stored);
    } catch (e) { /* storage unavailable */ }
    return memoryHighScore;
  }

  saveHighScore(score) {
    memoryHighScore = this.highScore = score;
    try { window.localStorage.setItem(HIGH_SCORE_KEY, String(score)); } catch (e) { /* storage unavailable */ }
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
