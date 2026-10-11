import { createState, levelOf } from '../game/sim.js';
import { PROPS } from '../props.js';
import { LEVELS } from '../game/levels/index.js';

// Starts the game over and moves between levels. A level lists the tools and props it shows; going from one
// level to the next clears away what the next one does not list (the mess on the table stays).
export function createRunner(ctx) {
  const { view, physics } = ctx;

  // show the level's objects; `previous` is the level that just ended (none at the start)
  function enter(level, previous) {
    level.onEnter?.(ctx.state);
    const had = new Set(previous?.scene.tools ?? []);
    const has = new Set(level.scene.tools);
    for (const id of had) if (!has.has(id)) ctx.tools.deactivate(ctx.tools.tools[id]);
    for (const id of has) if (!had.has(id)) ctx.tools.spawnAtRest(id);
    // (only the vial and the rod have a rest place; the gold nugget is made by the player)

    physics.removeExtras();
    for (const [name, mesh] of Object.entries(view.props)) {
      mesh.visible = level.scene.props.includes(name);
      if (mesh.visible) {
        const k = PROPS[name].collider;
        physics.addStaticBox(k.x, k.y, k.z, k.hx, k.hy, k.hz);
      }
    }

    if (previous) {
      physics.clearDebris();
      // drops of a substance the new level does not take are cleared away (the mercury, for instance)
      ctx.dropWorld.clear(Object.keys(previous.accepts).filter((kind) => !(kind in level.accepts)));
    }
  }

  return {
    enter,

    // a new game: level 1 with nothing spilled
    reset() {
      ctx.state = createState();
      ctx.dropWorld.reset();
      ctx.puddles.clear();
      ctx.stirring.reset();
      ctx.matches.reset();
      ctx.mouse?.reset();
      physics.reset();
      for (const hand of ctx.hands) {
        hand.held = null;
        hand.tool = null;
        hand.holdMode = null;
        hand.grains = null;
        hand.carry = null;
        hand.pinchOn = false;
        hand.squeezeOn = false;
      }
      for (const t of ctx.tools.list) ctx.tools.deactivate(t);
      enter(LEVELS[0], null);
      view.refresh.clear();
    },

    levelOf: () => levelOf(ctx.state),
  };
}
