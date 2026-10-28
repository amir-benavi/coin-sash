// Power-up registry. Each file in powers/ adds one entry; game.js spawns, draws and collects them.
//
// POWER_UPS.<key> = {
//   label: 'SHIELD',              shown briefly above the player when collected
//   color: 0x7fd4ff,              colour of that label
//   weight: 1,                    relative chance of being the one that spawns (optional, default 1)
//   createIcon(scene, x, y)       return a display object (Graphics, Shape, Text or Container) drawn
//                                 at (x, y); it is only the picture, the engine adds the hitbox
//   collect(scene)                apply the effect when the player touches it
//   reset(scene)                  optional: clear this power's state at the start of every round
//   update(scene, delta)          optional: runs each frame while not paused or finished (timed effects)
//   blocksDamage(scene)           optional: return true while the player must not lose hearts
// };
window.POWER_UPS = {};
