import * as THREE from 'three';
import { LAYOUT } from '../config/index.js';
import { rules } from '../game/rules.js';
import { levelOf } from '../game/sim.js';
import { createHintTimer, stepHintTimer } from '../game/hints.js';
import { PROPS } from '../props.js';

// The symbol for the next step at work: the level says what comes next and at which place; the difficulty decides when
// the symbol shows (easy: at once, normal: after a while without progress, hard: never).
export function createHints(ctx, hintView) {
  const timer = createHintTimer();
  const where = new THREE.Vector3();
  let time = 0;
  const targets = new Set(); // the tools the shown hint points at (they get an outline)
  const c = LAYOUT.crucible;

  // the places a hint can point at (table-local)
  const anchors = {
    matchbox: () => where.copy(ctx.matches.boxCenter).setY(0.07),
    wick: () => where.set(LAYOUT.wick.x, LAYOUT.wick.y + 0.12, LAYOUT.wick.z),
    crucible: () => where.set(c.x, c.top + 0.12, c.z),
    rod: () => where.copy(ctx.tools.tools.rod.pos).add({ x: 0, y: 0.1, z: 0 }),
    vial: () => where.copy(ctx.tools.tools.vial.pos).add({ x: 0, y: 0.11, z: 0 }),
    dish: () => where.set(PROPS.dish.at.x, 0.09, PROPS.dish.at.z),
    herbs: () => where.set(LAYOUT.herbs.x, 0.09, LAYOUT.herbs.z),
    salt: () => where.set(LAYOUT.salt.x, 0.09, LAYOUT.salt.z),
    ring: () => where.set(ctx.state.ring.x, 0.12, ctx.state.ring.z),
    cat: () => where.set(LAYOUT.cat.x, 0.12, LAYOUT.cat.z),
  };

  return {
    get targets() { return targets; },

    // hazardIconShown: the warning symbol over the crucible takes the place of a hint
    update(dt, hazardIconShown) {
      time += dt;
      const s = ctx.state;
      const hint = ctx.transition.active || hazardIconShown ? null : levelOf(s).hint?.(s, { vialHeld: ctx.tools.tools.vial.holder !== null, rodHeld: ctx.tools.tools.rod.holder !== null }) ?? null;
      const show = stepHintTimer(timer, hint, dt, rules().HINT_DELAY);
      targets.clear();
      if (hint?.target && show) targets.add(hint.target);
      hintView.update(dt, hint && show ? hint : null, hint ? anchors[hint.at]() : null, time);
    },
  };
}
