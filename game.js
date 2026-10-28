/* global Phaser, COIN_DASH */
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
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.background = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    createGridScan(this);
    // Top bar (y 0–44, above the play area): coins left, hearts centred, time right-aligned.
    this.add.rectangle(c.width / 2, 22, c.width, 44, 0x000000, c.hud.barAlpha);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.timeText = this.add.text(c.width - 18, 12, '', { font: '18px monospace', color: '#ffffff' }).setOrigin(1, 0);
    this.createHearts();
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.poisonCoins = this.physics.add.group();
    this.coins = this.physics.add.group();
    this.phaseOver = false;
    this.spawnPhase();
    this.drones = this.physics.add.group();
    this.dronesFast = false;
    for (let i = 0; i < c.droneCount; i++) this.addDrone(90 + i * 270, 100, 35 + i * 105);
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      // Disable first so the same coin cannot be counted twice.
      if (this.finished || !coin.active) return;
      this.coins.killAndHide(coin);
      coin.body.enable = false;
      this.score += coin.value;
      this.playCoinSound();
      // Mark the phase as over here; update() spawns the next one outside the physics callback.
      if (this.coins.countActive(true) === 0) this.phaseOver = true;
    });
    this.physics.add.overlap(this.player, this.drones, (player, drone) => this.hitDrone(drone));
    this.physics.add.overlap(this.player, this.poisonCoins, (player, poison) => this.hitPoison(poison));
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
      const v = COIN_DASH.coinSoundVariation, t = ctx.currentTime;
      // Quick consecutive pickups climb in pitch; a pause resets the combo.
      const quick = this.lastCoinSoundAt !== undefined && (t - this.lastCoinSoundAt) * 1000 <= v.comboWindowMs;
      this.coinCombo = quick ? Math.min((this.coinCombo || 0) + 1, v.comboMax) : 0;
      this.lastCoinSoundAt = t;
      const semis = Phaser.Utils.Array.GetRandom(v.scale) + this.coinCombo * v.comboStep;
      const ratio = Math.pow(2, semis / 12), d = 1 + Phaser.Math.FloatBetween(-v.durationJitter, v.durationJitter);
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(988 * ratio, t);
      osc.frequency.setValueAtTime(1319 * ratio, t + 0.05 * d);
      gain.gain.setValueAtTime(COIN_DASH.coinSoundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 * d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13 * d);
    } catch (e) { /* audio is optional */ }
  }

  spawnPhase() {
    // Remove leftover collected coins, then place a new random group of coins.
    this.coins.clear(true, true);
    const count = Phaser.Math.Between(COIN_DASH.coinMin, COIN_DASH.coinMax);
    for (let i = 0; i < count; i++) this.placeCoin();
  }

  randomSpot() {
    const c = COIN_DASH;
    // Avoid spawning directly underneath the player, and keep coins and poison apart.
    const others = [...this.coins.getChildren().filter((coin) => coin.active), ...this.poisonCoins.getChildren()];
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

  addDrone(x, y, angleDeg) {
    const c = COIN_DASH;
    const drone = this.add.rectangle(x, y, 26, 26, c.colors.drone);
    this.drones.add(drone);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    // Use the current speed so drones added after the speed-up are fast too.
    const speed = this.dronesFast ? c.droneSpeedFast : c.droneSpeed;
    const angle = angleDeg * Math.PI / 180;
    drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    drone.warnMs = 0;
    return drone;
  }

  spawnExtraDrone() {
    const c = COIN_DASH;
    const d = c.droneSpawn;
    // Try random points on the playfield edges; fall back to the corner farthest from the player.
    const left = 13, right = c.width - 13, top = 44 + 13, bottom = c.height - 13;
    const far = (x, y) => Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
    let spot = null;
    for (let i = 0; i < 20 && !spot; i++) {
      const side = Phaser.Math.Between(0, 3);
      const x = side === 0 ? left : side === 1 ? right : Phaser.Math.Between(left, right);
      const y = side === 2 ? top : side === 3 ? bottom : Phaser.Math.Between(top, bottom);
      if (far(x, y) >= d.minDistance) spot = { x, y };
    }
    if (!spot) {
      const corners = [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }];
      spot = corners.reduce((best, p) => (far(p.x, p.y) > far(best.x, best.y) ? p : best));
    }
    // Head roughly towards the middle of the playfield so it does not hug the wall.
    const toCentre = Phaser.Math.RadToDeg(Math.atan2((top + bottom) / 2 - spot.y, c.width / 2 - spot.x));
    const drone = this.addDrone(spot.x, spot.y, toCentre + Phaser.Math.Between(-35, 35));
    // Harmless and blinking for warnMs; counted down in updateDrones(), so it pauses with the game.
    drone.warnMs = d.warnMs;
  }

  hitDrone(drone) {
    if (drone.warnMs > 0) return; // still blinking in
    this.loseHeart('A drone caught you!');
  }

  loseHeart(reason) {
    // The overlap fires every frame while touching, so ignore hits while invulnerable.
    if (this.finished || this.hearts === 0 || this.invulnerableMs > 0) return;
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
    this.updateDrones(delta);
    updateGridScan(this, delta);
    // Blink while invulnerable; a countdown (not a timer or tween) leaves nothing behind on restart.
    this.invulnerableMs = Math.max(0, this.invulnerableMs - delta);
    this.player.setAlpha(this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 100) % 2 ? 0.25 : 1);
    this.updateCoins(delta);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
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

  updateDrones(delta) {
    const c = COIN_DASH;
    const d = c.droneSpawn;
    // One more drone every everySeconds of played time; elapsed derives from the deadline
    // (which resume pushes back), so paused time never counts.
    const remaining = this.deadline - this.time.now;
    const elapsed = c.roundSeconds * 1000 - remaining;
    const wanted = Math.min(d.max, c.droneCount + Math.floor(elapsed / (d.everySeconds * 1000)));
    if (remaining > 0 && this.drones.getLength() < wanted) this.spawnExtraDrone();
    this.drones.getChildren().forEach((drone) => {
      if (drone.warnMs <= 0) return;
      drone.warnMs = Math.max(0, drone.warnMs - delta);
      drone.setAlpha(drone.warnMs > 0 && Math.floor(drone.warnMs / 100) % 2 ? 0.25 : 1);
    });
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
