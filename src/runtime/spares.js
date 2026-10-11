import { CFG } from '../config/index.js';
import { levelOf } from '../game/sim.js';

// The vial on the shelf. A broken vial is replaced from the shelf while there is a spare (easy); otherwise only a restart
// helps. Safety net: if the level needs the vial and it is neither on the table nor broken (lost somehow), it stands on
// its shelf again after a moment.
export function createSpares(ctx) {
  let timer = 0;
  let lostFor = 0;
  return {
    update(dt) {
      const s = ctx.state;
      const vial = ctx.tools.tools.vial;

      const needed = levelOf(s).scene.tools.includes('vial') && !ctx.transition.active;
      lostFor = needed && !vial.active && !s.vialBroken ? lostFor + dt : 0;
      if (lostFor >= CFG.SPARE_DELAY) {
        lostFor = 0;
        ctx.tools.spawnAtRest('vial');
        return;
      }

      if (!(s.vialBroken && !vial.active && s.spareVials > 0)) {
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
