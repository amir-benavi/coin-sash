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
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coins = this.physics.add.group();
    this.phaseOver = false;
    this.spawnPhase();
    this.drones = this.physics.add.group();
    this.dronesFast = false;
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      // Disable first so the same coin cannot be counted twice.
      if (this.finished || !coin.active) return;
      this.coins.killAndHide(coin);
      coin.body.enable = false;
      this.score++;
      // Mark the phase as over here; update() spawns the next one outside the physics callback.
      if (this.coins.countActive(true) === 0) this.phaseOver = true;
    });
    this.physics.add.overlap(this.player, this.drones, () => this.hitDrone());
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    // keydown-P fires for both p and P; Shift tells resume apart from pause.
    this.input.keyboard.on('keydown-P', (event) => (event.shiftKey ? this.resumeRound() : this.pauseRound()));
  }

  spawnPhase() {
    // Remove leftover collected coins, then place a new random group of coins.
    this.coins.clear(true, true);
    const count = Phaser.Math.Between(COIN_DASH.coinMin, COIN_DASH.coinMax);
    for (let i = 0; i < count; i++) this.placeCoin();
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning coins directly underneath the player or on top of each other.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60
      || this.coins.getChildren().some((coin) => Phaser.Math.Distance.Between(x, y, coin.x, coin.y) < 30));
    const coin = this.add.circle(x, y, 9, c.colors.coin);
    this.physics.add.existing(coin);
    coin.body.setCircle(9);
    coin.body.reset(x, y);
    this.coins.add(coin);
  }

  hitDrone() {
    // The overlap fires every frame while touching, so ignore hits while invulnerable.
    if (this.finished || this.hearts === 0 || this.invulnerableMs > 0) return;
    this.hearts--;
    if (this.hearts === 0) return; // update() ends the round after refreshing the HUD.
    this.invulnerableMs = COIN_DASH.hitInvulnerableMs;
    this.player.body.reset(COIN_DASH.width / 2, COIN_DASH.height / 2);
  }

  update(time, delta) {
    if (this.finished || this.paused) return;
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
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const hearts = '♥'.repeat(this.hearts) + '♡'.repeat(COIN_DASH.lives - this.hearts);
    this.hud.setText(`Coins: ${this.score}   Best: ${this.highScore}       ${hearts}       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
    if (this.hearts === 0) this.finish('A drone caught you!');
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
