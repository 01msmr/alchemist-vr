import * as THREE from 'three';
import { CFG, CONSOLE, INPUT, LAYOUT, VIEW } from './config/index.js';
import { createSettings } from './settings.js';
import { useDifficulty } from './game/rules.js';
import { parseVox } from './vox.js';
import bottleUrl from './assets/bottle.vox?url';
import { crucibleModel, crucibleContents, standModel, FLAME_FRAMES } from './assets.js';
import { createState, step, advanceLevel, levelOf } from './game/sim.js';
import { createPuddles } from './game/puddles.js';
import { createPhysics } from './physics.js';
import { setupVR, updateInput, resetPressed, pulse } from './vr.js';
import { createScene, createControls } from './view/scene.js';
import { createEffects } from './view/effects.js';
import { createHud, statusLines } from './view/hud.js';
import { createDropWorld } from './runtime/drops.js';
import { createTools } from './runtime/tools.js';
import { createMatches } from './runtime/matches.js';
import { createStirring } from './runtime/stirring.js';
import { createRunner } from './runtime/runner.js';
import { createHandInput } from './runtime/hands.js';
import { createMouse } from './runtime/mouse.js';
import { createCalibration } from './runtime/calibration.js';
import { createConsole } from './runtime/console.js';
import { createHandTools } from './runtime/handtools.js';
import { createGhostWorld } from './runtime/ghost.js';
import { createGhostView } from './view/ghost.js';
import { createShelfView } from './view/shelf.js';
import { createSpares } from './runtime/spares.js';
import { installTestHook } from './testhook.js';
import { createTriggerLog } from './triggertest.js';

// The composition: the pieces are built here and share one `ctx` (the world they live in); the loop at the end
// runs them in order. Rules are in game/, what you see in view/, what the player can do in runtime/, all numbers
// in config/.
const bottleShell = parseVox(await (await fetch(bottleUrl)).arrayBuffer()); // the vial's voxel model

const view = createScene();
const { matchbox, crucible, stand } = LAYOUT;
const ctx = {
  view,
  state: createState(),
  hands: [],
  drops: [], // mercury drops and sulfur grains in flight
  puddles: createPuddles(LAYOUT.tableBounds),
  bottle: { shell: bottleShell },
  clock: new THREE.Clock(),
  physics: null,
};
ctx.physics = createPhysics({
  table: LAYOUT.tableBounds,
  floorY: -LAYOUT.table.h,
  stack: { x: crucible.x, z: crucible.z, h: crucible.top, halfW: stand.halfW, baseH: crucible.y, innerHalf: crucible.innerHalf },
  matchbox: { x: matchbox.x, y: matchbox.y + matchbox.height / 2, z: matchbox.z, hx: matchbox.halfX, hy: matchbox.height / 2, hz: matchbox.halfZ },
  onDebrisGone(entry) {
    view.world.remove(entry.data);
    entry.data.children.forEach((child) => child.geometry.dispose()); // the shared materials stay
  },
});
ctx.effects = createEffects(view, ctx.puddles);
ctx.hud = createHud(view);
ctx.dropWorld = createDropWorld(ctx);
ctx.tools = createTools(ctx);
ctx.matches = createMatches(ctx);
ctx.stirring = createStirring(ctx);
ctx.runner = createRunner(ctx);
ctx.handInput = createHandInput(ctx);
ctx.settings = createSettings(typeof localStorage === 'undefined' ? undefined : localStorage, CONSOLE.storageKey);
const applyLook = (s) => {
  view.setTheme(s.theme);
  view.setBackground(s.background);
  ctx.hud.setTheme(VIEW.themes[s.theme]);
};
applyLook(ctx.settings.get());
useDifficulty(ctx.settings.get().difficulty);
ctx.settings.subscribe((s, name) => {
  applyLook(s);
  if (name === 'difficulty') {
    useDifficulty(s.difficulty);
    ctx.runner.reset(); // other windows in the middle of a level would not be fair
  }
});
ctx.console = createConsole(ctx); // before the mouse: a click on a control must not pick anything up
ctx.mouse = createMouse(ctx); // before the controls: its pointerdown must run first
createControls(view);
ctx.calibration = createCalibration(ctx); // moves the table to the remembered height

ctx.hands = setupVR(view.renderer, view.scene);
for (const hand of ctx.hands) {
  view.world.add(hand.fist.group, hand.pinchGrip.group);
  Object.assign(hand, { tool: null, grains: null, tipPos: new THREE.Vector3(), tipVel: new THREE.Vector3(), tipValid: false });
}
ctx.handTools = createHandTools(ctx);
ctx.ghostWorld = createGhostWorld(ctx);
const ghostView = createGhostView(view);
const shelfView = createShelfView(view, bottleShell);
ctx.spares = createSpares(ctx);
ctx.runner.reset();
installTestHook(ctx);

const triggerLog = new URLSearchParams(location.search).has('trigger') ? createTriggerLog() : null; // ?trigger: show the raw trigger values on the panel
const { tools, matches, dropWorld, effects, physics } = ctx;
const { meshes, refresh } = view;
let lastPourPulse = 0;
const pourHaptics = INPUT.haptics.pour;

view.renderer.setAnimationLoop(() => {
  const dt = Math.min(ctx.clock.getDelta(), 0.05);
  const time = ctx.clock.elapsedTime;

  for (const hand of ctx.hands) updateInput(hand);
  for (const hand of ctx.hands) if (resetPressed(hand)) ctx.runner.reset();

  // input: what the hands and the mouse hold, and where
  ctx.handInput.update(dt);
  ctx.calibration.update(dt);
  ctx.console.update(dt);
  tools.updateHandTargets(dt);
  ctx.mouse.updatePoses();
  matches.updatePose();
  tools.stepPhysics(dt);
  ctx.handInput.updateVisuals();

  // the world: pouring, falling drops, stirring, the match, the rules
  const vial = tools.tools.vial;
  matches.update(dt);
  dropWorld.pourFromVial(vial, dt);
  dropWorld.step(dt);
  ctx.stirring.update(dt);
  const state = ctx.state;
  const before = levelOf(state);
  ctx.ghostWorld.sense(); // level 3: what the table shows the rules (the salt ring, the gold, the vial)
  step(state, dt);
  ctx.ghostWorld.settle();
  const next = advanceLevel(state, dt, vial.holder !== null);
  if (next) ctx.runner.enter(next, before);

  if (state.flow > 0 && typeof vial.holder === 'number' && time - lastPourPulse > pourHaptics.every) {
    lastPourPulse = time;
    pulse(ctx.hands[vial.holder], pourHaptics.base + (pourHaptics.range * state.flow) / CFG.POUR_MAX_RATE, pourHaptics.ms);
  }

  // the look of everything
  matches.refreshLook(state);
  const flame = state.candleLit ? Math.floor(time * VIEW.flameFps) % FLAME_FRAMES : -1;
  refresh('stand', flame, meshes.stand, () => standModel(flame));
  const contents = crucibleContents(state.crucible);
  refresh('crucible', JSON.stringify(contents), meshes.crucible, () => crucibleModel(contents));
  tools.refreshLook(state);
  ghostView.update(state, time, vial.pos);
  ctx.spares.update(dt);
  shelfView.update(ctx.handTools.inShelf, state.spareVials);
  const level = levelOf(state);
  effects.updateGauge(state, level);
  effects.updateDrops(ctx.drops);
  effects.updatePuddles();
  const grains = ctx.hands.filter((h) => h.held === 'grains').map((h) => h.tipPos);
  if (ctx.mouse.grains) grains.push(ctx.mouse.grainsPos);
  effects.updateGrains(grains);
  for (const entry of physics.debris) {
    entry.data.position.set(entry.body.position.x, entry.body.position.y, entry.body.position.z);
    entry.data.quaternion.set(entry.body.quaternion.x, entry.body.quaternion.y, entry.body.quaternion.z, entry.body.quaternion.w);
  }

  ctx.hud.update(triggerLog ? triggerLog.lines(ctx.hands) : statusLines(state, level, ctx.hands, ctx.puddles.total(), ctx.calibration.statusLine()), time);
  if (!view.renderer.xr.isPresenting) view.controls.update();
  view.renderer.render(view.scene, view.camera);
});
