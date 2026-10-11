import * as THREE from 'three';
import { CFG, INPUT, LAYOUT } from '../config/index.js';
import { spillVelocity, spawnDrop, stepDrops, trickle } from '../game/drops.js';
import { landSubstance } from '../game/sim.js';
import { pour } from '../game/pouring.js';
import { vialLip, tiltAngle } from '../game/geometry.js';

const GOLDEN_ANGLE = 2.399963; // an even spread without randomness
const GOLDEN_RATIO = 0.618034;

// What falls and where it ends up: mercury poured from the vial, sulfur grains from the fingertips, the
// scattered mercury of a broken vial. A drop that reaches the crucible mouth is taken (or refused) by the level;
// everything else is wasted and stays on the table as a puddle.
export function createDropWorld(ctx) {
  const target = { cx: LAYOUT.crucible.x, cz: LAYOUT.crucible.z, top: LAYOUT.crucible.top, ...LAYOUT.landing };
  let pourAccum = 0; // poured amount not yet turned into a drop
  const lip = new THREE.Vector3();
  const prevLip = new THREE.Vector3();
  const lipVel = new THREE.Vector3();
  let prevLipValid = false;
  const tmp = new THREE.Vector3();

  function onLand(amount, where, x, z, kind) {
    const state = ctx.state;
    if (where === 'crucible') {
      landSubstance(state, kind, amount);
      return;
    }
    if (kind !== 'salt') state.wasted += amount; // splashed off the rim or fell on the table (salt on the table is the ring, not waste)
    let px = x;
    let pz = z;
    if (where === 'rim') { // splashes outward and lands beside the stand
      const d = Math.hypot(x - target.cx, z - target.cz) || 1;
      px = target.cx + ((x - target.cx) / d) * LAYOUT.landing.splashRadius;
      pz = target.cz + ((z - target.cz) / d) * LAYOUT.landing.splashRadius;
    }
    ctx.puddles.add(px, pz, amount, kind); // stays where it fell
  }

  return {
    // Pour from the vial this frame. The drops leave the lip with the lip's own velocity (smoothed from its
    // motion). A vial pours whenever it is tilted far enough, held or not: one lying on its side leaks.
    pourFromVial(vial, dt) {
      if (vial.active) {
        lip.copy(vialLip(vial.pos, vial.up, vial.spec.half.y));
        if (prevLipValid && dt > 0) lipVel.lerp(tmp.subVectors(lip, prevLip).divideScalar(dt).clampLength(0, INPUT.motion.lipMaxSpeed), INPUT.motion.lipSmoothing);
        else lipVel.set(0, 0, 0);
        prevLip.copy(lip);
        prevLipValid = true;
      } else {
        prevLipValid = false;
      }
      pourAccum += pour(ctx.state, dt, vial.active ? tiltAngle(vial.up) : 0);
      while (pourAccum >= CFG.DROP_AMOUNT) {
        pourAccum -= CFG.DROP_AMOUNT;
        spawnDrop(ctx.drops, lip, spillVelocity(vial.up, ctx.state.flow / CFG.POUR_MAX_RATE, lipVel), CFG.DROP_AMOUNT);
      }
    },

    // The fingers open: grains fall from the fingertips, carrying the hand's motion.
    releaseGrains(source, pos, vel, count = source.count) {
      for (let i = 0; i < count; i++) {
        const a = i * GOLDEN_ANGLE;
        const spread = CFG.GRAIN_SPREAD + CFG.GRAIN_SPREAD_RANGE * ((i * GOLDEN_RATIO) % 1);
        spawnDrop(ctx.drops, pos, { x: vel.x + Math.cos(a) * spread, y: vel.y, z: vel.z + Math.sin(a) * spread }, source.amount, source.substance);
      }
    },

    // what a hand or the mouse carries from a source: the grains left, and what the spoon spilled on the way
    newCarry: (source) => ({ load: source.count, acc: 0, prev: null }),

    // A loaded spoon (source.sprinkle) moves: grains trickle out while it is low over the table.
    trickle(source, carry, pos) {
      const n = trickle(carry, pos, { perMeter: CFG.TRICKLE_PER_M, maxHeight: CFG.TRICKLE_HEIGHT });
      for (let i = 0; i < n; i++) {
        const a = (carry.load + i) * GOLDEN_ANGLE;
        spawnDrop(ctx.drops, pos, { x: Math.cos(a) * 0.01, y: 0, z: Math.sin(a) * 0.01 }, source.amount, source.substance);
      }
    },

    // The vial broke: its mercury scatters from where it broke.
    scatter(pos, vel, amount) {
      const count = Math.round(amount / CFG.DROP_AMOUNT);
      for (let i = 0; i < count; i++) {
        const angle = i * GOLDEN_ANGLE;
        const r = 0.2 + 0.8 * ((i * GOLDEN_RATIO) % 1);
        const v = {
          x: vel.x * CFG.SCATTER_INHERIT + Math.cos(angle) * r * CFG.SCATTER_SPEED,
          y: CFG.SCATTER_LIFT + CFG.SCATTER_LIFT_RANGE * r,
          z: vel.z * CFG.SCATTER_INHERIT + Math.sin(angle) * r * CFG.SCATTER_SPEED,
        };
        if (!spawnDrop(ctx.drops, pos, v, CFG.DROP_AMOUNT)) ctx.state.wasted += CFG.DROP_AMOUNT;
      }
    },

    step(dt) {
      stepDrops(ctx.drops, dt, target, onLand);
    },

    // clear drops in flight, all of them or only those of the given kinds
    clear(kinds) {
      for (let i = ctx.drops.length - 1; i >= 0; i--) if (!kinds || kinds.includes(ctx.drops[i].kind)) ctx.drops.splice(i, 1);
    },

    reset() {
      pourAccum = 0;
      prevLipValid = false;
      ctx.drops.length = 0;
    },
  };
}
