/* global Phaser, POWER_UPS, COIN_DASH */
// Tactical nuke: flash the screen and wipe out every drone and poison star. The drones come back
// after respawnSeconds, blinking and harmless for warnSeconds before they turn solid again.
// Poison stars return on their own through the normal spawner.
POWER_UPS.nuke = {
  label: 'NUKE!',
  color: 0xff9f1c,
  weight: 0.6, // rarer than the other power-ups (default weight 1)
  respawnSeconds: 6,
  warnSeconds: 1,
  safeDistance: 120, // a respawning drone closer than this to the player is moved to the far corner
  flashMs: 450,
  shakeMs: 300,
  shakeIntensity: 0.012,
  iconRadius: 14,
  iconColor: 0xffb000,

  createIcon(scene, x, y) {
    // Radiation trefoil: three black 60° wedges around a small hub on an amber disc.
    const r = this.iconRadius;
    const icon = scene.add.graphics({ x, y });
    icon.fillStyle(this.iconColor, 1).fillCircle(0, 0, r);
    icon.lineStyle(2, 0x000000, 1).strokeCircle(0, 0, r);
    icon.fillStyle(0x000000, 1);
    [-90, 30, 150].forEach((mid) => {
      icon.slice(0, 0, r - 3, (mid - 30) * Math.PI / 180, (mid + 30) * Math.PI / 180).fillPath();
    });
    // Gap between the wedges and the hub, then the hub itself.
    icon.fillStyle(this.iconColor, 1).fillCircle(0, 0, r * 0.32);
    icon.fillStyle(0x000000, 1).fillCircle(0, 0, r * 0.2);
    return icon;
  },

  collect(scene) {
    // The skull lowers flashEffect.alpha for its red flash; the nuke always flashes at full strength.
    scene.cameras.main.flashEffect.alpha = 1;
    scene.cameras.main.flash(this.flashMs, 255, 220, 150, true);
    scene.cameras.main.shake(this.shakeMs, this.shakeIntensity, true);
    // We are inside the player/power-up overlap callback, so only mark the blast here;
    // update() removes the drones and poison stars (later this same frame).
    scene.nukePending = true;
    // A second nuke while the drones are gone simply restarts the respawn countdown.
    scene.nukeRespawnMs = this.respawnSeconds * 1000;
  },

  reset(scene) {
    // Runs before the scene creates its drones; restart destroys the old display objects itself.
    scene.nukePending = false;
    scene.nukeRespawnMs = 0;
    scene.nukeWarnMs = 0;
  },

  update(scene, delta) {
    if (scene.nukePending) {
      scene.nukePending = false;
      this.detonate(scene);
    }
    if (scene.nukeRespawnMs > 0) {
      scene.nukeRespawnMs -= delta;
      if (scene.nukeRespawnMs <= 0) {
        scene.nukeRespawnMs = 0;
        this.respawnDrones(scene);
      }
    }
    if (scene.nukeWarnMs > 0) {
      scene.nukeWarnMs = Math.max(0, scene.nukeWarnMs - delta);
      const arriving = scene.drones.getChildren().filter((drone) => drone.nukeArriving);
      arriving.forEach((drone) => {
        if (scene.nukeWarnMs > 0) {
          drone.setAlpha(Math.floor(scene.nukeWarnMs / 120) % 2 ? 0.2 : 0.6);
          return;
        }
        drone.nukeArriving = false;
        drone.setAlpha(1);
        drone.body.enable = true;
      });
    }
  },

  holdsDrones(scene) {
    // While the countdown runs the playfield stays clear; the regular spawner refills it afterwards.
    return scene.nukeRespawnMs > 0;
  },

  detonate(scene) {
    const enemies = [...scene.drones.getChildren(), ...scene.poisonCoins.getChildren()];
    // A short orange burst where each enemy was, plus a shockwave from the player.
    enemies.forEach((enemy) => this.burst(scene, enemy.x, enemy.y, 6, 3));
    this.burst(scene, scene.player.x, scene.player.y, 20, 14);
    scene.drones.clear(true, true);
    scene.poisonCoins.clear(true, true);
    // Drones that were still arriving are gone too, so there is nothing left to blink.
    scene.nukeWarnMs = 0;
  },

  burst(scene, x, y, radius, scale) {
    // The scene's tweens are killed on restart and the circle is destroyed with the scene.
    const ring = scene.add.circle(x, y, radius, this.color, 0.7).setStrokeStyle(3, 0xffffff, 0.9);
    scene.tweens.add({ targets: ring, scale, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
  },

  respawnDrones(scene) {
    const c = COIN_DASH;
    const player = scene.player;
    for (let i = 0; i < c.droneCount; i++) {
      const drone = scene.spawnDrone(i);
      // spawnDrone sets the normal or fast velocity; body.reset() below zeroes it, so keep a copy.
      const v = drone.body.velocity.clone();
      if (Phaser.Math.Distance.Between(drone.x, drone.y, player.x, player.y) < this.safeDistance) {
        // Corner of the play area (which starts at y 44) opposite the player, staggered per drone.
        const x = player.x < c.width / 2 ? c.width - 60 - i * 30 : 60 + i * 30;
        const y = player.y < (44 + c.height) / 2 ? c.height - 60 : 104;
        drone.body.reset(x, y);
      }
      drone.body.setVelocity(v.x, v.y);
      // Frozen and harmless until the warning ends: overlap checks skip disabled bodies.
      drone.body.enable = false;
      drone.nukeArriving = true;
      drone.setAlpha(0.2);
    }
    scene.nukeWarnMs = this.warnSeconds * 1000;
  }
};
