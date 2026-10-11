import { CFG } from '../config/index.js';
import { levelOf } from '../game/sim.js';

// A broken vial is replaced from the shelf while there is a spare (easy); otherwise only a restart helps.
export function createSpares(ctx) {
  let timer = 0;
  return {
    update(dt) {
      const s = ctx.state;
      if (!(s.vialBroken && !ctx.tools.tools.vial.active && s.spareVials > 0)) {
        timer = 0;
        return;
      }
      timer += dt;
      if (timer < CFG.SPARE_DELAY) return;
      timer = 0;
      s.spareVials -= 1;
      s.vialBroken = false;
      s.vial.fill = levelOf(s).vialFill ?? CFG.VIAL_CAPACITY;
      ctx.tools.spawnAtRest('vial');
    },
  };
}
