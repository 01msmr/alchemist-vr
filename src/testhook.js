import * as THREE from 'three';
import { LAYOUT } from './config/index.js';
import { PROPS } from './props.js';
import { LEVELS } from './game/levels/index.js';
import { levelOf } from './game/sim.js';

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
    setTableEdge: (e) => ctx.calibration.setEdge(e),
    get tableEdge() { return ctx.calibration.edge; },
    view: ctx.view,
    // jump to a level (the way the game does when one is done)
    goToLevel(n) {
      const before = levelOf(ctx.state);
      ctx.state.level = n;
      ctx.runner.enter(LEVELS[n - 1], before);
    },
    consoleCenter: (id) => ctx.console.centerOf(id),
    get hands() { return ctx.hands; },
    // act like a Quest controller: its working end at `tip` (table-local), the trigger and the grip button pressed this far
    fakeController(i, { tip, pinch = 0, squeeze = 0 }) {
      const hand = ctx.hands[i];
      hand.gamepad = { buttons: [{ value: pinch }, { value: squeeze }] };
      hand.grip.visible = true;
      const p = ctx.view.world.localToWorld(new THREE.Vector3(tip.x, tip.y, tip.z));
      p.z += hand.tipZ; // the controller is held pointing along -z: its working end is tipZ in front of it
      hand.grip.matrix.makeTranslation(p.x, p.y, p.z); // a controller's grip has no auto update: the XR pose sets its matrix
      hand.grip.matrixWorldNeedsUpdate = true;
    },
    setSetting: (key, value) => ctx.settings.set(key, value),
    get layout() { return LAYOUT; },
    // where the pointer at pixel (px, py) meets the horizontal plane at height y, table-local (what the mouse drag uses)
    planePoint(px, py, y) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1), ctx.view.camera);
      const ray = raycaster.ray.clone().applyMatrix4(ctx.view.worldInv);
      const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
      return { x: hit.x, z: hit.z };
    },
    screenAt(x, y, z) {
      point.set(x, y, z).applyMatrix4(ctx.view.world.matrixWorld).project(ctx.view.camera);
      return { x: ((point.x + 1) / 2) * innerWidth, y: ((1 - point.y) / 2) * innerHeight };
    },
    tool: (id) => ctx.tools.tools[id],
    spawnNugget(kind, x, z) {
      ctx.state.nugget = { kind, quality: 0.9 };
      ctx.tools.spawn(ctx.tools.tools.nugget, new THREE.Vector3(x, 0.02, z));
    },
    get settings() { return ctx.settings.get(); },
    get cordPulled() { return ctx.console.cord.pulled; },
    breakVial: () => ctx.tools.tools.vial.ph.breakNow(),
    get shards() { return ctx.physics.debris.length; },
    get worldYaw() { return ctx.view.world.rotation.y; },
    get worldY() { return ctx.view.world.position.y; },
    get floorY() { return ctx.physics.world.bodies.find((b) => b.shapes[0]?.type === 2 /* plane */)?.position.y; },
    screenOf(name) {
      const where = (name === 'bead' || name.includes(':')) ? ctx.console.centerOf(name) : {
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
