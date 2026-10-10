import * as THREE from 'three';
import { LAYOUT } from '../config/index.js';
import { createStirTracker } from '../game/stir.js';
import { stirCrucible } from '../game/sim.js';

// Stirring: the rod tip, while the rod is held, moving across inside the crucible.
export function createStirring(ctx) {
  const tracker = createStirTracker();
  const c = LAYOUT.crucible;
  const target = { cx: c.x, cz: c.z, top: c.top, bottom: c.floor, radius: LAYOUT.stir.radius };
  const tip = new THREE.Vector3();

  return {
    update(dt) {
      const rod = ctx.tools.tools.rod;
      const held = rod.active && rod.holder !== null;
      const stirring = held && tracker.update(tip.copy(rod.pos).addScaledVector(rod.up, -rod.spec.half.y), dt, target);
      if (!held) tracker.reset();
      stirCrucible(ctx.state, dt, stirring);
    },
    reset() {
      tracker.reset();
    },
  };
}
