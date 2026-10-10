import * as THREE from 'three';
import { LAYOUT } from './config/index.js';
import { PROPS } from './props.js';

// A hook for the headless smoke test (npm run smoke): installed only with ?test in the URL. It exposes the game
// state and the screen position (pixels) of things on the table, so a script can point the mouse at them.
export function installTestHook(ctx) {
  if (!new URLSearchParams(location.search).has('test')) return;
  const point = new THREE.Vector3();
  const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
  const source = PROPS.dish.source.center;
  window.__game = {
    get state() { return ctx.state; },
    tools: ctx.tools.tools,
    drops: ctx.drops,
    puddles: ctx.puddles,
    setTableHeight: (h) => ctx.calibration.set(h),
    get tableHeight() { return ctx.calibration.height; },
    get worldY() { return ctx.view.world.position.y; },
    get floorY() { return ctx.physics.world.bodies.find((b) => b.shapes[0]?.type === 2 /* plane */)?.position.y; },
    screenOf(name) {
      const where = {
        box: ctx.matches.boxCenter,
        crucible: v(LAYOUT.crucible),
        stand: v(LAYOUT.wick),
        dish: v(source),
        vial: ctx.tools.tools.vial.pos,
        rod: ctx.tools.tools.rod.pos,
        nugget: ctx.tools.tools.nugget.pos,
      }[name];
      point.copy(where).applyMatrix4(ctx.view.world.matrixWorld).project(ctx.view.camera);
      return { x: ((point.x + 1) / 2) * innerWidth, y: ((1 - point.y) / 2) * innerHeight };
    },
  };
}
