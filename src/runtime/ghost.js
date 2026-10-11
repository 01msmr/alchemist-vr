import { CFG, LAYOUT } from '../config/index.js';
import { ringClosed, saltCells } from '../game/ring.js';
import { CELL } from '../game/puddles.js';

// Level 3 at work: reads the table (the salt on it, the gold, the vial, the cat's place) and tells the rules what it
// sees (state.ring, state.finaleInput); afterwards takes the gold that became the cat's eyes out of the game.
export function createGhostWorld(ctx) {
  const { tools } = ctx.tools;
  const cat = LAYOUT.cat;
  let salt = new Set();
  let saltVersion = -1;
  let last = { key: '', result: { closed: false } };

  // before the rules run
  function sense() {
    const s = ctx.state;
    if (s.level !== 3) return;
    const nugget = tools.nugget;
    const resting = nugget.active && nugget.holder === null && s.nugget;
    const bait = resting ? s.nugget.kind : null;
    const vial = tools.vial;
    const gold = nugget.pos;

    let closed = false;
    if (resting) {
      if (saltVersion !== ctx.puddles.version) {
        salt = saltCells(ctx.puddles.cells, ctx.puddles.kinds);
        saltVersion = ctx.puddles.version;
      }
      const center = { ix: Math.round(gold.x / CELL), iz: Math.round(gold.z / CELL) };
      const key = `${saltVersion} ${center.ix} ${center.iz} ${CFG.RING_GAP_TOL}`;
      if (key !== last.key) last = { key, result: ringClosed(salt, center, { maxRadius: CFG.RING_RADIUS_MAX / CELL, minArea: CFG.RING_MIN_CELLS, gapTol: CFG.RING_GAP_TOL }) };
      closed = last.result.closed;
    }
    const over = (p, radius) => Math.hypot(vial.pos.x - p.x, vial.pos.z - p.z) <= radius;
    s.ring = {
      closed,
      bait,
      x: gold.x,
      z: gold.z,
      vialOver: closed && vial.active && vial.up.y < -0.5 && over(gold, CFG.TRAP_RADIUS), // upside down over the ring
    };
    const atEyes = resting && Math.hypot(gold.x - cat.x, gold.z - cat.z) <= CFG.EYE_RADIUS && gold.y < cat.eyeY * 2;
    s.finaleInput = {
      eyes: atEyes ? s.nugget.kind : null,
      opened: vial.active && vial.up.y < 0.5 && over(cat, 0.09), // tipped well over the cat
    };
  }

  // after the rules ran: the gold on the cat's eyes stays there as eyes
  function settle() {
    const s = ctx.state;
    if (s.level === 3 && s.finale.eyes && s.nugget) {
      s.nugget = null;
      ctx.tools.deactivate(tools.nugget);
    }
  }

  return { sense, settle };
}
