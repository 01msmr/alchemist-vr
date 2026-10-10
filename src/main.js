import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGeometry } from './voxel-mesh.js';
import {
  createState, step, pour, pourStartAngle, landMercury, landSulfur, stirCrucible, advanceLevel, takeNugget, breakVial,
  takeMatch, strokeMatch, dropMatch, lightCandle, snuffCandle,
} from './game/sim.js';
import { spillVelocity, spawnDrop, stepDrops, MAX_DROPS } from './game/drops.js';
import { CFG } from './game/config.js';
import { createPuddles, CELL, MAX_CELL } from './game/puddles.js';
import { createStirTracker } from './game/stir.js';
import { tiltDirection, vialLip, tiltAngle, distanceToSegment } from './game/geometry.js';
import { parseVox } from './vox.js';
import { splitGlass, liquidModel, fillLayers, toolSpecFromModel } from './img2vox/vessel.js';
import bottleUrl from './assets/bottle.vox?url';
import {
  crucibleModel, crucibleContents, standModel, FLAME_FRAMES, matchModel, matchboxModel,
  dishModel, rodModel, nuggetModel,
} from './assets.js';
import { setupVR, updateInput, tipWorld, palmWorld, analog, showGrip, pulse, resetPressed } from './vr.js';
import { holdOffset } from './tracking.js';
import { createPhysics, GRIP } from './physics.js';
import { TOOLS } from './tools.js';

const VOXEL = 0.01; // 1 voxel = 1 cm

// The mercury vial is a potion bottle voxelized from a photo (tools/img2vox.mjs). Its collision box and grab
// size come from the model. The blue part is see-through glass, the bronze parts are opaque metal, and the
// mercury is real voxels inside the glass, so the fill level can be read from outside.
const bottleShell = parseVox(await (await fetch(bottleUrl)).arrayBuffer());
const bottleLayers = fillLayers(bottleShell); // layers the liquid can fill
const VIAL_SPEC = { ...TOOLS.vial, ...toolSpecFromModel(bottleShell, VOXEL) };

// Table: 2 x 1 m, 0.85 m high. The game lives in `world`, whose origin is on the table top,
// 45 cm in front of the player (who stands at the XR origin, facing -z).
const TABLE = { w: 2, d: 1, h: 0.85, z: -0.65 };
const WORLD_ORIGIN = new THREE.Vector3(0, TABLE.h, -0.45);
// table extent in world-local coordinates
const TABLE_BOUNDS = {
  minX: -TABLE.w / 2,
  maxX: TABLE.w / 2,
  minZ: TABLE.z - WORLD_ORIGIN.z - TABLE.d / 2,
  maxZ: TABLE.z - WORLD_ORIGIN.z + TABLE.d / 2,
};

// layout in world-local coordinates (meters, y up from the table top)
const CRUCIBLE = new THREE.Vector3(0, 0.07, 0); // crucible origin (bottom center), sits on the stand
const CRUCIBLE_TOP = 0.14;
// where falling drops land: inside the mouth = in the crucible, on the rim ring = splash off
const TARGET = { cx: 0, cz: 0, top: CRUCIBLE_TOP, mouth: 0.035, rim: 0.047 };
const STIR_TARGET = { cx: 0, cz: 0, top: CRUCIBLE_TOP, bottom: 0.08, radius: 0.035 };
const WICK = new THREE.Vector3(0, 0.045, 0);
const WICK_RADIUS = 0.035; // lit match head this close to the wick lights the candle
const SNUFF_RADIUS = 0.05; // pinch with the tip this close to the wick snuffs the candle
const BOX = new THREE.Vector3(-0.18, 0, 0.07); // matchbox origin (bottom center), footprint 6 x 4 cm
const BOX_HALF = { x: 0.03, z: 0.02 };
const BOX_CENTER = new THREE.Vector3(BOX.x, 0.015, BOX.z);
const BOX_GRAB_RADIUS = 0.045;
const STRIKER_Y = [0.02, 0.065]; // head height band above the striker (top at 0.03)
const DISH = new THREE.Vector3(0.24, 0, 0.11); // sulfur dish origin (bottom center), level 2
const DISH_CENTER = new THREE.Vector3(DISH.x, 0.02, DISH.z);
const DISH_GRAB_RADIUS = 0.045; // a pinch with the tip this close takes sulfur
const NUGGET_REACH = 0.045; // pinch above the crucible mouth this close takes the gold
const MATCH_HEAD_DY = 0.045; // head center above the match model's bottom
const RESET_REACH = 0.15; // pinching this close to the status panel resets the game
const MATCH_PINCH_DY = 0.01; // the fingers hold the match this far above its bottom
const MATCH_BODY_HALF_Y = 0.025; // physics half height of a dropped match
const HOLD_SNAP_TIME = 0.15; // s, a vial settles into the natural hold
const MAX_TILT = THREE.MathUtils.degToRad(130); // mouse: Shift + drag range

// where the tools start; the rod lies on the table with its axis along x
const VIAL_REST = new THREE.Vector3(0.22, VIAL_SPEC.half.y, 0.08);
const ROD_REST = new THREE.Vector3(0.3, TOOLS.rod.half.x, -0.06);
const ROD_REST_QUAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

// desktop fallback
const MOUSE_Y = { vial: 0.2, rod: 0.2, nugget: 0.16 }; // height of a mouse-held tool's center
const GRAINS_Y = 0.16; // height of mouse-held sulfur
const MATCH_Y = 0.012; // bottom of the mouse-held match
const TILT_PIXELS = 150; // Shift + vertical drag range for tilt 0..1

const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202428);
scene.add(new THREE.GridHelper(4, 40, 0x555555, 0x333333));

// table: light grey top, darker sides and legs
const topMaterial = new THREE.MeshBasicMaterial({ color: 0xd5d8dc });
const sideMaterial = new THREE.MeshBasicMaterial({ color: 0x8c8f94 });
const tableTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.04, TABLE.d), [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial]);
tableTop.position.set(0, TABLE.h - 0.02, TABLE.z);
scene.add(tableTop);
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, TABLE.h - 0.04, 0.06), sideMaterial);
    leg.position.set(sx * (TABLE.w / 2 - 0.08), (TABLE.h - 0.04) / 2, TABLE.z + sz * (TABLE.d / 2 - 0.08));
    scene.add(leg);
  }
}

const world = new THREE.Group();
world.position.copy(WORLD_ORIGIN);
scene.add(world);
world.updateMatrixWorld(true);
const worldInv = new THREE.Matrix4().copy(world.matrixWorld).invert();

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 20);
camera.position.set(0.1, 0.35, 0.5).add(WORLD_ORIGIN);

const material = new THREE.MeshBasicMaterial({ vertexColors: true }); // flat colors, look comes from geometry + AO
function part(parent = world) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  parent.add(mesh);
  return mesh;
}
function remesh(mesh, obj) {
  mesh.geometry.dispose();
  mesh.geometry = toGeometry(obj, VOXEL);
}

const standMesh = part();
const crucibleMesh = part();
crucibleMesh.position.copy(CRUCIBLE);
const boxMesh = part();
boxMesh.position.copy(BOX);
const dishMesh = part();
dishMesh.position.copy(DISH);
remesh(dishMesh, dishModel());
dishMesh.visible = false;
const matchMesh = part();
matchMesh.visible = false;

// Rings around the crucible mouth: dose gauge (fill + target window) and hold progress.
function makeArc(inner, outer, color, y) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(CRUCIBLE.x, y, CRUCIBLE.z);
  world.add(mesh);
  mesh.visible = false;
  // from/to are fractions 0..1 of a 270 degree sweep
  let last = '';
  mesh.userData.set = (from, to) => {
    const key = `${from}|${to}`;
    if (key === last) return; // unchanged: keep the geometry
    last = key;
    mesh.visible = to > from;
    if (!mesh.visible) return;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.RingGeometry(inner, outer, 48, 1, Math.PI * 0.75 + from * 1.5 * Math.PI, (to - from) * 1.5 * Math.PI);
  };
  return mesh;
}
const gaugeBack = makeArc(0.052, 0.056, 0x3a3f45, CRUCIBLE_TOP + 0.001);
const gaugeWindow = makeArc(0.05, 0.058, 0x4caf50, CRUCIBLE_TOP + 0.002);
const gaugeFill = makeArc(0.052, 0.056, 0xe8eef5, CRUCIBLE_TOP + 0.003);
const holdGood = makeArc(0.038, 0.044, 0x4caf50, CRUCIBLE_TOP + 0.002);
const holdBad = makeArc(0.038, 0.044, 0xe53935, CRUCIBLE_TOP + 0.002);
const SULFUR_SCALE = 1.2; // the gauge covers 0 .. this many doses of sulfur in level 2
gaugeBack.userData.set(0, 1);

// Drops in flight (mercury, sulfur grains): 1 cm voxels, drawn on the 1 cm grid.
const DROP_COLORS = { hg: new THREE.Color(0xd7e1eb), sulfur: new THREE.Color(0xebd73c) };
const stream = new THREE.InstancedMesh(new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_DROPS);
stream.setColorAt(0, DROP_COLORS.hg);
stream.frustumCulled = false;
stream.count = 0;
world.add(stream);
const snap = (v) => Math.round(v / VOXEL) * VOXEL;
const matrix = new THREE.Matrix4();

// Spilled mercury and sulfur stay on the table as flat 1 cm patches until reset.
const puddles = createPuddles(TABLE_BOUNDS);
const PUDDLE_MAX = 3000;
const PUDDLE_COLORS = { hg: new THREE.Color(0xaebac6), sulfur: new THREE.Color(0xd9c63a) };
const puddleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), PUDDLE_MAX);
puddleMesh.setColorAt(0, PUDDLE_COLORS.hg);
puddleMesh.frustumCulled = false;
puddleMesh.count = 0;
world.add(puddleMesh);
let puddleVersion = -1;
function updatePuddleMesh() {
  if (puddleVersion === puddles.version) return;
  puddleVersion = puddles.version;
  let i = 0;
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const none = new THREE.Quaternion();
  for (const [cell, amount] of puddles.cells) {
    if (i >= PUDDLE_MAX) break;
    const [ix, iz] = cell.split(',').map(Number);
    const h = 0.002 + 0.004 * Math.min(1, amount / MAX_CELL); // thicker where there is more
    matrix.compose(pos.set(ix * CELL, h / 2 + 0.0003, iz * CELL), none, scale.set(CELL * 0.98, h, CELL * 0.98));
    puddleMesh.setMatrixAt(i, matrix);
    puddleMesh.setColorAt(i, PUDDLE_COLORS[puddles.kinds.get(cell)] ?? PUDDLE_COLORS.hg);
    i++;
  }
  puddleMesh.count = i;
  puddleMesh.instanceMatrix.needsUpdate = true;
  puddleMesh.instanceColor.needsUpdate = true;
}

// Status panel behind the table: the only text you can read inside the headset.
const hudCanvas = document.createElement('canvas');
hudCanvas.width = 1024;
hudCanvas.height = 320;
const hudTexture = new THREE.CanvasTexture(hudCanvas);
hudTexture.colorSpace = THREE.SRGBColorSpace;
const hudPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.2), new THREE.MeshBasicMaterial({ map: hudTexture }));
hudPanel.position.set(0, 0.3, TABLE_BOUNDS.minZ + 0.1);
hudPanel.visible = false;
world.add(hudPanel);
let hudPanelAt = 0;
function drawHudPanel(lines) {
  const g = hudCanvas.getContext('2d');
  g.fillStyle = '#101418';
  g.fillRect(0, 0, hudCanvas.width, hudCanvas.height);
  g.fillStyle = '#dde3ea';
  g.font = '26px monospace';
  lines.forEach((line, i) => g.fillText(line, 16, 38 + i * 44));
  hudTexture.needsUpdate = true;
}

// --- tools: the vial, the stirring rod and the gold nugget are loose objects the player takes ---
let state;
let matchHolder; // null | 'mouse' | hand index
let mouseGrains; // sulfur held by the mouse: null | { count }
let tilt; // mouse only: Shift + drag, 0..1
let shiftHeld;
let tiltOriginY;
let lastPointerY = 0;
let hands = [];
let clock; // created with the render loop

const mat = new THREE.Matrix4();
const mat2 = new THREE.Matrix4();
const scaleTmp = new THREE.Vector3();
const handPos = new THREE.Vector3();
const handQuat = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const tmp = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tip = new THREE.Vector3();
const palm = new THREE.Vector3();

function onVialBreak(pos, vel) {
  deactivate(tools.vial);
  const spilled = breakVial(state);
  const count = Math.round(spilled / CFG.DROP_AMOUNT);
  for (let i = 0; i < count; i++) { // the mercury scatters
    const angle = i * 2.399963; // golden angle: an even spread without randomness
    const r = 0.2 + 0.8 * ((i * 0.618034) % 1);
    const v = { x: vel.x * 0.3 + Math.cos(angle) * r * 0.9, y: 0.4 + 0.6 * r, z: vel.z * 0.3 + Math.sin(angle) * r * 0.9 };
    if (!spawnDrop(drops, pos, v, CFG.DROP_AMOUNT)) state.wasted += CFG.DROP_AMOUNT;
  }
}
function onDebrisGone(entry) {
  world.remove(entry.data);
  entry.data.children[0].geometry.dispose();
}
const physics = createPhysics({
  table: TABLE_BOUNDS,
  floorY: -TABLE.h,
  stack: { x: 0, z: 0, h: CRUCIBLE_TOP, halfW: 0.045, baseH: CRUCIBLE.y, innerHalf: 0.033 },
  matchbox: { x: BOX_CENTER.x, y: BOX_CENTER.y, z: BOX_CENTER.z, hx: BOX_HALF.x, hy: 0.015, hz: BOX_HALF.z },
  onDebrisGone,
});

function makeTool(id, extra, spec = TOOLS[id]) {
  const group = new THREE.Group();
  group.visible = false;
  world.add(group);
  const mesh = part(group);
  mesh.position.y = -spec.half.y; // models have their origin at the bottom, the body at the center
  return {
    id, spec, group, mesh,
    ph: physics.addTool(spec, extra),
    pickMeshes: [mesh], // what a mouse click can hit
    active: false,
    holder: null, // null | 'mouse' | hand index
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    up: new THREE.Vector3(0, 1, 0),
    // motion of a mouse-held tool, handed to the physics when it is let go
    lin: new THREE.Vector3(),
    ang: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    prevQuat: new THREE.Quaternion(),
    trackValid: false,
    // where a hand wants it, and how that target moves
    gripPos: new THREE.Vector3(),
    gripQuat: new THREE.Quaternion(),
    gripVel: new THREE.Vector3(),
    prevGripPos: new THREE.Vector3(),
    gripTrackValid: false,
    grabOffset: new THREE.Vector2(), // mouse: pointer to tool offset
  };
}
const tools = {
  vial: makeTool('vial', { onBreak: onVialBreak }, VIAL_SPEC),
  rod: makeTool('rod'),
  nugget: makeTool('nugget'),
};
const toolList = Object.values(tools);
remesh(tools.rod.mesh, rodModel());

// the vial: metal (tools.vial.mesh) and liquid are opaque, the glass is see-through and drawn after them
const vialParts = splitGlass(bottleShell);
remesh(tools.vial.mesh, vialParts.metal);
const glassMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false });
const vialGlass = new THREE.Mesh(toGeometry(vialParts.glass, VOXEL), glassMaterial);
vialGlass.position.y = -VIAL_SPEC.half.y;
vialGlass.renderOrder = 1;
tools.vial.group.add(vialGlass);
tools.vial.pickMeshes.push(vialGlass);
const vialLiquid = part(tools.vial.group);
vialLiquid.position.y = -VIAL_SPEC.half.y;

function spawnTool(t, pos, quat = new THREE.Quaternion()) {
  t.ph.spawn(pos, quat);
  t.pos.copy(pos);
  t.quat.copy(quat);
  t.up.copy(UP).applyQuaternion(quat);
  t.active = true;
  t.holder = null;
  t.trackValid = false;
  t.gripTrackValid = false;
  t.group.visible = true;
}

// takes the tool out of the game (and out of any hand)
function deactivate(t) {
  if (t.holder !== null && t.holder !== 'mouse') {
    const hand = hands[t.holder];
    if (hand) {
      hand.held = null;
      hand.tool = null;
      hand.holdMode = null;
    }
  }
  t.holder = null;
  t.active = false;
  t.ph.remove();
  t.group.visible = false;
}

const drops = []; // mercury drops and sulfur grains in flight
let pourAccum = 0; // poured amount not yet turned into a drop
const lip = new THREE.Vector3();
const prevLip = new THREE.Vector3();
const lipVel = new THREE.Vector3();
let prevLipValid = false;
const stirTracker = createStirTracker();
const keys = new Map(); // remesh cache: part name -> key
const matchPos = new THREE.Vector3(); // mouse only: bottom of the match
const head = new THREE.Vector3(); // match head, world-local
const prevHead = new THREE.Vector3();
const headVel = new THREE.Vector3();
let prevHeadValid = false;
const grainsMesh = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), new THREE.MeshBasicMaterial({ color: DROP_COLORS.sulfur }));
  m.visible = false;
  world.add(m);
  return m;
});
const mouseGrainsPos = new THREE.Vector3();

function reset() {
  state = createState();
  matchHolder = null;
  mouseGrains = null;
  tilt = 0;
  prevHeadValid = false;
  prevLipValid = false;
  drops.length = 0;
  puddles.clear();
  pourAccum = 0;
  stirTracker.reset();
  physics.reset();
  for (const hand of hands) {
    hand.held = null;
    hand.tool = null;
    hand.holdMode = null;
    hand.grains = 0;
    hand.pinchOn = false;
    hand.squeezeOn = false;
  }
  for (const t of toolList) deactivate(t);
  spawnTool(tools.vial, VIAL_REST);
  dishMesh.visible = false;
  keys.clear();
}

function enterLevel2() {
  deactivate(tools.vial);
  physics.clearDebris();
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].kind === 'hg') drops.splice(i, 1); // the mercury is cleared away
  dishMesh.visible = true;
  physics.addStaticBox(DISH.x, 0.015, DISH.z, 0.035, 0.015, 0.035);
  spawnTool(tools.rod, ROD_REST, ROD_REST_QUAT);
}

// --- VR input: two grips, like two kinds of fingers ---
// Full hand (grip button): a tool. The palm must be on it as the hand closes.
// Pinch (index finger, trigger): a tool by two fingertips, the match, a pinch of sulfur, the gold, the wick.
// The tip must be on it as the fingers close. A grab only starts while the hand is closing; releasing is a
// deliberate loosening (hysteresis).
function tipLocal(hand, out) {
  return world.worldToLocal(tipWorld(hand, out));
}
function palmLocal(hand, out) {
  return world.worldToLocal(palmWorld(hand, out));
}

// Match: pinched near its bottom, head sticking out 3.5 cm beyond the fingers. Model +y -> grip -Z.
// The pinch point is wherever the fingertips are in the grip frame (a fixed point for a controller).
const MATCH_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
function matchAttach(hand, out) {
  return out.makeTranslation(hand.tipInGrip.x, hand.tipInGrip.y, hand.tipInGrip.z + MATCH_PINCH_DY).multiply(MATCH_ROTATION);
}
function matchHeadLocal(hand, out) {
  out.set(hand.tipInGrip.x, hand.tipInGrip.y, hand.tipInGrip.z + MATCH_PINCH_DY - MATCH_HEAD_DY);
  return world.worldToLocal(out.applyMatrix4(hand.grip.matrixWorld));
}

// Velocity of a mouse-held tool (smoothed), so a release throws, drops or sets it down like the hand moved.
function trackTool(t, dt) {
  if (t.trackValid && dt > 0) {
    t.lin.lerp(tmp.subVectors(t.pos, t.prevPos).divideScalar(dt), 0.5).clampLength(0, 5);
    tmpQuat.copy(t.prevQuat).invert().premultiply(t.quat); // rotation since the last frame
    if (tmpQuat.w < 0) tmpQuat.set(-tmpQuat.x, -tmpQuat.y, -tmpQuat.z, -tmpQuat.w);
    const s = Math.sqrt(Math.max(0, 1 - tmpQuat.w * tmpQuat.w));
    const angle = 2 * Math.acos(Math.min(1, tmpQuat.w));
    tmp.set(tmpQuat.x, tmpQuat.y, tmpQuat.z).multiplyScalar(s > 1e-6 ? angle / s / dt : 0);
    t.ang.lerp(tmp, 0.5).clampLength(0, 30);
  } else {
    t.lin.set(0, 0, 0);
    t.ang.set(0, 0, 0);
  }
  t.prevPos.copy(t.pos);
  t.prevQuat.copy(t.quat);
  t.trackValid = true;
}

// Motion of the target a hand wants the tool at (for the damping of the grip spring).
function trackGrip(t, dt) {
  if (t.gripTrackValid && dt > 0) t.gripVel.lerp(tmp.subVectors(t.gripPos, t.prevGripPos).divideScalar(dt), 0.5).clampLength(0, 5);
  else t.gripVel.set(0, 0, 0);
  t.prevGripPos.copy(t.gripPos);
  t.gripTrackValid = true;
}

function releaseTool(t) {
  if (t.holder === null) return;
  if (t.holder === 'mouse') {
    t.ph.release(t.lin, t.ang);
  } else {
    const hand = hands[t.holder];
    if (hand) {
      hand.held = null;
      hand.tool = null;
      hand.holdMode = null;
    }
    t.ph.endGrip(); // keeps the velocity the tool has: it drops, tips, rolls or breaks
  }
  t.holder = null;
  if (t.id === 'vial') tilt = 0;
  t.trackValid = false;
  t.gripTrackValid = false;
}

// A tool slipped out of the hand (grip too weak for the weight and motion, or pulled too far away).
function loseTool(t, hand) {
  t.ph.endGrip();
  hand.held = null;
  hand.tool = null;
  hand.holdMode = null;
  t.holder = null;
  t.gripTrackValid = false;
  pulse(hand, 0.6, 90);
}

function releaseMatch() {
  if (matchHolder === null) return;
  const hand = hands[matchHolder];
  if (hand) hand.held = null;
  matchHolder = null;
  if (state.match) { // a loose match falls from the hand
    const group = new THREE.Group();
    group.add(new THREE.Mesh(toGeometry(matchModel(state.match.lit > 0, state.match.broken), VOXEL), material));
    group.children[0].position.y = -MATCH_BODY_HALF_Y;
    world.add(group);
    tmp.set(0, MATCH_BODY_HALF_Y, 0).applyQuaternion(matchMesh.quaternion).add(matchMesh.position);
    physics.addDebris(tmp, matchMesh.quaternion, headVel, group);
  }
  dropMatch(state);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A hand starts holding a tool at `point` (palm for a fist, fingertips for a pinch). How well it is held depends
// on how much of the tool is in the hand: a grab at the edge or over the end is weak and slips.
function beginGrip(hand, t, mode, point, contact) {
  t.holder = hand.index;
  hand.held = 'tool';
  hand.tool = t;
  hand.holdMode = mode;
  hand.grab.axial = Math.max(-t.spec.axisHalf, Math.min(t.spec.axisHalf, tmp.copy(point).sub(t.pos).dot(t.up)));
  hand.grab.t0 = clock.elapsedTime;
  t.gripTrackValid = false;
  // the tool's pose relative to the hand at the moment of grabbing
  mat.compose(t.pos, t.quat, ONE).premultiply(world.matrixWorld);
  mat.premultiply(hand.grip.matrixWorld.clone().invert()).decompose(hand.grab.fromPos, hand.grab.fromQuat, scaleTmp);
  if (mode === 'fist' && t.spec.snap === 'upright') {
    // settles into a natural hold: standing through the fist, thumb side up, centered in the palm
    const o = holdOffset(hand.mode, hand.handedness, t.spec.radius);
    hand.grab.toPos.set(o.x, o.y, o.z);
    hand.grab.toQuat.identity();
  } else {
    // keeps the pose it had; a pinch pivots between the fingertips
    hand.grab.toPos.copy(hand.grab.fromPos);
    hand.grab.toQuat.copy(hand.grab.fromQuat);
  }
  t.ph.startGrip(mode, mode === 'fist' ? t.pos : point, contact);
  pulse(hand, 0.3, 20);
}

function tryGrabTool(hand, mode) {
  const point = mode === 'fist' ? palmLocal(hand, palm) : tipLocal(hand, tip);
  let best = null;
  let bestD = Infinity;
  for (const t of toolList) {
    if (!t.active || t.holder !== null) continue;
    const a = t.pos.clone().addScaledVector(t.up, -t.spec.axisHalf);
    const b = t.pos.clone().addScaledVector(t.up, t.spec.axisHalf);
    const d = distanceToSegment(point, a, b);
    if (d <= t.spec.grabRadius && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  if (!best) return false;
  const axial = point.clone().sub(best.pos).dot(best.up);
  let contact = 1 - 0.6 * Math.min(1, bestD / best.spec.grabRadius); // off the axis: only the edge is caught
  if (mode === 'fist') contact *= clamp01((best.spec.axisHalf - Math.abs(axial) + 0.035) / 0.07); // palm over the end: half in the hand
  beginGrip(hand, best, mode, point, contact);
  return true;
}

// Things a pinch can do other than holding a tool.
function tryPinchAction(hand) {
  tipLocal(hand, tip);
  if (tip.distanceTo(hudPanel.position) <= RESET_REACH) {
    reset(); // pinching the status panel starts over (a tracked hand has no reset button)
    hand.pinchOn = true; // still pinching: not a new press
  } else if (matchHolder === null && tip.distanceTo(BOX_CENTER) <= BOX_GRAB_RADIUS && takeMatch(state)) {
    matchHolder = hand.index;
    hand.held = 'match';
    pulse(hand, 0.3, 20);
  } else if (state.level >= 2 && tip.distanceTo(DISH_CENTER) <= DISH_GRAB_RADIUS) {
    hand.held = 'grains'; // a pinch of sulfur between the fingertips
    hand.grains = CFG.GRAINS_PER_PINCH;
    pulse(hand, 0.2, 20);
  } else if (!state.nugget && Math.hypot(tip.x - TARGET.cx, tip.z - TARGET.cz) <= NUGGET_REACH && tip.y > 0.08 && tip.y < 0.22 && takeNugget(state)) {
    spawnTool(tools.nugget, tip);
    beginGrip(hand, tools.nugget, 'pinch', tip, 1);
  } else if (state.candleLit && tip.distanceTo(WICK) <= SNUFF_RADIUS) {
    snuffCandle(state); // pinch out the flame
    pulse(hand, 0.2, 30);
  }
}

// Open the fingers: the sulfur falls from the fingertips, carrying the hand's motion.
function releaseGrains(pos, vel, count) {
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963;
    const spread = 0.02 + 0.03 * ((i * 0.618034) % 1);
    spawnDrop(drops, pos, { x: vel.x + Math.cos(a) * spread, y: vel.y, z: vel.z + Math.sin(a) * spread }, CFG.GRAIN, 'sulfur');
  }
}

function updateGrips(dt) {
  for (const hand of hands) {
    const { pinch, squeeze } = analog(hand);
    showGrip(hand, pinch);
    // fingertip velocity: sulfur and thrown things carry it
    tipLocal(hand, tmp);
    if (hand.tipValid && dt > 0) hand.tipVel.lerp(handPos.subVectors(tmp, hand.tipPos).divideScalar(dt), 0.5).clampLength(0, 5);
    else hand.tipVel.set(0, 0, 0);
    hand.tipPos.copy(tmp);
    hand.tipValid = true;

    if (!hand.squeezeOn && squeeze >= CFG.SQUEEZE_ON) {
      hand.squeezeOn = true;
      if (!hand.held) tryGrabTool(hand, 'fist');
    } else if (hand.squeezeOn && squeeze < CFG.SQUEEZE_OFF) {
      hand.squeezeOn = false;
      if (hand.held === 'tool' && hand.holdMode === 'fist') releaseTool(hand.tool);
    }

    if (!hand.pinchOn && pinch >= CFG.PINCH_ON) {
      hand.pinchOn = true;
      if (!hand.held && !tryGrabTool(hand, 'pinch')) tryPinchAction(hand);
    } else if (hand.pinchOn && pinch < CFG.PINCH_OFF) {
      hand.pinchOn = false;
      if (hand.held === 'tool' && hand.holdMode === 'pinch') releaseTool(hand.tool);
      else if (hand.held === 'match') releaseMatch();
      else if (hand.held === 'grains') {
        releaseGrains(hand.tipPos, hand.tipVel, hand.grains);
        hand.grains = 0;
        hand.held = null;
      }
    }
  }
}

hands = setupVR(renderer, scene);
for (const hand of hands) {
  world.add(hand.fist.group, hand.pinchGrip.group);
  Object.assign(hand, { tool: null, grains: 0, tipPos: new THREE.Vector3(), tipVel: new THREE.Vector3(), tipValid: false });
}
reset();

// --- desktop fallback: mouse ---
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const planes = {
  vial: new THREE.Plane(new THREE.Vector3(0, 1, 0), -MOUSE_Y.vial),
  rod: new THREE.Plane(new THREE.Vector3(0, 1, 0), -MOUSE_Y.rod),
  nugget: new THREE.Plane(new THREE.Vector3(0, 1, 0), -MOUSE_Y.nugget),
  grains: new THREE.Plane(new THREE.Vector3(0, 1, 0), -GRAINS_Y),
  match: new THREE.Plane(new THREE.Vector3(0, 1, 0), -MATCH_Y),
};
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
let controls; // created after the pointer handler so that handler can disable orbiting first
let capturing = false;

function pointOn(plane) {
  raycaster.setFromCamera(pointer, camera);
  ray.copy(raycaster.ray).applyMatrix4(worldInv);
  return ray.intersectPlane(plane, hit);
}

function updatePointer(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  lastPointerY = e.clientY;
}

function mouseHold(t) {
  t.ph.hold();
  t.holder = 'mouse';
  t.trackValid = false;
  t.pos.y = MOUSE_Y[t.id];
  const p = pointOn(planes[t.id]);
  t.grabOffset.set(t.pos.x - p.x, t.pos.z - p.z);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || renderer.xr.isPresenting) return;
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const pickables = [boxMesh, standMesh, crucibleMesh];
  if (dishMesh.visible) pickables.push(dishMesh);
  for (const t of toolList) if (t.active && t.holder === null) pickables.push(...t.pickMeshes);
  const [first] = raycaster.intersectObjects(pickables);
  if (!first) return; // empty space: orbit camera
  const picked = toolList.find((t) => t.pickMeshes.includes(first.object));

  if (first.object === crucibleMesh) {
    if (state.nugget || !['gold', 'dull', 'fools'].includes(state.crucible.content)) return; // nothing to take: orbit
    takeNugget(state);
    spawnTool(tools.nugget, new THREE.Vector3(0, MOUSE_Y.nugget, 0));
    capturing = true;
    controls.enabled = false;
    mouseHold(tools.nugget);
    return;
  }
  capturing = true;
  controls.enabled = false;
  if (first.object === standMesh) {
    snuffCandle(state);
  } else if (first.object === boxMesh) {
    if (matchHolder === null && takeMatch(state)) {
      matchHolder = 'mouse';
      const p = pointOn(planes.match);
      matchPos.set(p.x, MATCH_Y, p.z);
    }
  } else if (first.object === dishMesh) {
    if (!mouseGrains) {
      mouseGrains = { count: CFG.GRAINS_PER_PINCH };
      const p = pointOn(planes.grains);
      mouseGrainsPos.set(p.x, GRAINS_Y, p.z);
    }
  } else if (picked) {
    mouseHold(picked);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  updatePointer(e);
  for (const t of toolList) {
    if (t.holder !== 'mouse') continue;
    if (t.id === 'vial' && shiftHeld) {
      tilt = Math.min(1, Math.max(0, (e.clientY - tiltOriginY) / TILT_PIXELS));
    } else {
      const p = pointOn(planes[t.id]);
      if (p) t.pos.set(p.x + t.grabOffset.x, MOUSE_Y[t.id], p.z + t.grabOffset.y);
    }
  }
  if (matchHolder === 'mouse') {
    const p = pointOn(planes.match);
    if (p) matchPos.set(p.x, MATCH_Y, p.z);
  }
  if (mouseGrains) {
    const p = pointOn(planes.grains);
    if (p) mouseGrainsPos.set(p.x, GRAINS_Y, p.z);
  }
});

function mouseRelease() {
  for (const t of toolList) if (t.holder === 'mouse') releaseTool(t);
  if (matchHolder === 'mouse') releaseMatch();
  if (mouseGrains) {
    releaseGrains(mouseGrainsPos, { x: 0, y: 0, z: 0 }, mouseGrains.count);
    mouseGrains = null;
  }
  if (capturing) {
    capturing = false;
    controls.enabled = !renderer.xr.isPresenting;
  }
}
addEventListener('pointerup', (e) => { if (e.button === 0) mouseRelease(); });
addEventListener('blur', mouseRelease);

addEventListener('keydown', (e) => {
  if (e.key === 'Shift' && !shiftHeld) {
    shiftHeld = true;
    tiltOriginY = lastPointerY - tilt * TILT_PIXELS;
  }
  if (e.key === 'r' || e.key === 'R') reset();
});
addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftHeld = false;
    tilt = 0;
    const t = tools.vial;
    if (t.holder === 'mouse') { // resume position drag without a jump
      const p = pointOn(planes.vial);
      if (p) t.grabOffset.set(t.pos.x - p.x, t.pos.z - p.z);
    }
  }
});

controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(WORLD_ORIGIN).add(new THREE.Vector3(0, 0.08, 0.03));
controls.enablePan = false;
renderer.xr.addEventListener('sessionstart', () => { controls.enabled = false; hudPanel.visible = true; });
renderer.xr.addEventListener('sessionend', () => { controls.enabled = true; hudPanel.visible = false; });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Re-mesh a part only when its quantised look changes.
function refresh(name, key, mesh, build) {
  if (keys.get(name) === key) return;
  keys.set(name, key);
  remesh(mesh, build());
}

// Poses of what is held, from the hands (VR) or the mouse. A free tool gets its pose from the physics instead.
function updatePoses() {
  for (const hand of hands) {
    if (hand.held !== 'tool') continue;
    const t = hand.tool;
    const g = hand.grab;
    if (hand.holdMode === 'fist') {
      const k = Math.min(1, (clock.elapsedTime - g.t0) / HOLD_SNAP_TIME);
      const e = k * k * (3 - 2 * k);
      mat.compose(handPos.lerpVectors(g.fromPos, g.toPos, e), handQuat.slerpQuaternions(g.fromQuat, g.toQuat, e), ONE);
      mat.premultiply(hand.grip.matrixWorld).premultiply(worldInv).decompose(t.gripPos, t.gripQuat, scaleTmp);
    } else {
      tipLocal(hand, t.gripPos); // the fingertips pull the pinched point along
      mat.copy(hand.grip.matrixWorld).premultiply(worldInv).decompose(handPos, handQuat, scaleTmp);
      t.gripQuat.copy(handQuat).multiply(g.fromQuat);
    }
  }
  for (const t of toolList) {
    if (t.holder !== 'mouse') continue;
    if (t.id === 'vial') {
      const dir = tiltDirection(t.pos, CRUCIBLE);
      t.quat.setFromAxisAngle(tmp.crossVectors(UP, handPos.set(dir.x, 0, dir.z)), tilt * MAX_TILT);
    } else {
      t.quat.identity();
    }
  }

  if (matchHolder === 'mouse') {
    matchMesh.position.copy(matchPos);
    matchMesh.quaternion.identity();
    head.set(matchPos.x, MATCH_Y + MATCH_HEAD_DY, matchPos.z);
  } else if (matchHolder !== null) {
    const hand = hands[matchHolder];
    mat.copy(hand.grip.matrixWorld).multiply(matchAttach(hand, mat2)).premultiply(worldInv);
    mat.decompose(matchMesh.position, matchMesh.quaternion, scaleTmp);
    matchHeadLocal(hand, head);
  }
}

// Strike on the matchbox (fast sideways motion over the striker), light the candle at the wick.
function updateMatch(dt) {
  if (matchHolder === null || !state.match) {
    prevHeadValid = false;
    headVel.set(0, 0, 0);
    return;
  }
  const hand = matchHolder === 'mouse' ? null : hands[matchHolder];
  if (prevHeadValid) {
    headVel.lerp(tmp.subVectors(head, prevHead).divideScalar(dt), 0.5).clampLength(0, 5);
    const dist = Math.hypot(head.x - prevHead.x, head.z - prevHead.z);
    const onBox = Math.abs(head.x - BOX.x) <= BOX_HALF.x && Math.abs(head.z - BOX.z) <= BOX_HALF.z && head.y >= STRIKER_Y[0] && head.y <= STRIKER_Y[1];
    const result = strokeMatch(state, onBox, dist / dt, dist);
    if (hand && result === 'lit') pulse(hand, 0.7, 50);
    else if (hand && result === 'broken') pulse(hand, 1, 120);
  }
  prevHead.copy(head);
  prevHeadValid = true;
  if (!state.candleLit && state.match.lit > 0 && head.distanceTo(WICK) <= WICK_RADIUS) {
    lightCandle(state);
    if (hand) pulse(hand, 0.8, 80);
  }
}

function statusLines() {
  const c = state.crucible;
  const matchText = state.match ? `  in hand: ${state.match.broken ? 'head broke off' : state.match.lit > 0 ? `lit ${state.match.lit.toFixed(1)}s` : 'unlit'}` : '';
  const lines = [`level ${state.level}  candle ${state.candleLit ? 'LIT' : 'out'}  matches ${state.matches}${matchText}`];
  if (state.level === 1) {
    lines.push(state.vialBroken
      ? `vial BROKEN (R or B/Y resets)  mess ${puddles.total().toFixed(2)}`
      : `vial ${state.vial.fill.toFixed(2)} pours from ${Math.round((pourStartAngle(state.vial.fill) * 180) / Math.PI)} deg  wasted ${state.wasted.toFixed(2)} (on the table ${puddles.total().toFixed(2)})`);
    lines.push(`crucible: ${c.content}  Hg ${c.mercury.toFixed(2)} (window ${CFG.DOSE_MIN}-${CFG.DOSE_MAX})`);
  } else {
    lines.push(`sulfur ${c.sulfur.toFixed(2)} (window ${CFG.SULFUR_MIN}-${CFG.SULFUR_MAX})  stir ${c.stir.toFixed(1)}/${CFG.STIR_NEEDED}s  mess ${puddles.total().toFixed(2)}`);
    lines.push(`crucible: ${c.content}${state.nugget ? `  you hold the ${state.nugget.kind}` : ''}`);
  }
  lines.push(`temp ${c.temp.toFixed(2)} (melt ${CFG.MELT} / burn ${CFG.BURN})` + (c.quality !== null ? `  quality ${c.quality.toFixed(2)}` : ''));
  // the fingers as the game sees them (mode, pinch, grip): for tuning the recognition on the headset
  lines.push(hands.map((h) => `${h.handedness[0].toUpperCase()}:${h.mode} p${h.pinch.toFixed(2)} g${h.squeeze.toFixed(2)}`).join('   '));
  return lines;
}

clock = new THREE.Clock();
let lastPourPulse = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  for (const hand of hands) updateInput(hand);
  for (const hand of hands) if (resetPressed(hand)) reset();
  updateGrips(dt);
  updatePoses();

  // physics: the mouse holds a tool rigidly; a hand holds it with a force-limited grip
  for (const t of toolList) {
    if (!t.active) continue;
    if (t.holder === 'mouse') {
      t.ph.setPose(t.pos, t.quat);
      trackTool(t, dt);
    } else if (t.holder !== null) {
      const hand = hands[t.holder];
      const { pinch, squeeze } = analog(hand);
      trackGrip(t, dt);
      t.ph.setGrip(t.gripPos, t.gripVel, t.gripQuat, clamp01(((hand.holdMode === 'fist' ? squeeze : pinch) - 0.3) / 0.7));
    }
  }
  physics.step(dt);
  for (const t of toolList) {
    if (!t.active) continue;
    if (typeof t.holder === 'number' && t.ph.gripSeparation() > GRIP[hands[t.holder].holdMode].lose) loseTool(t, hands[t.holder]);
    if (t.holder !== 'mouse') {
      t.ph.readPose(t.pos, t.quat);
    }
  }
  for (const t of toolList) {
    if (!t.active) continue;
    t.up.copy(UP).applyQuaternion(t.quat);
    t.group.position.copy(t.pos);
    t.group.quaternion.copy(t.quat);
  }
  for (const hand of hands) { // the hand that holds a tool is drawn on the tool itself
    const holding = hand.held === 'tool';
    const drawn = hand.mode === 'controller'; // a tracked hand draws itself
    hand.model.group.visible = drawn && !holding;
    hand.fist.group.visible = drawn && holding && hand.holdMode === 'fist';
    hand.pinchGrip.group.visible = drawn && holding && hand.holdMode === 'pinch';
    if (!holding || !drawn) continue;
    const t = hand.tool;
    world.worldToLocal(tmp.setFromMatrixPosition(hand.grip.matrixWorld));
    if (hand.holdMode === 'fist') {
      hand.fist.place(handPos.copy(t.pos).addScaledVector(t.up, hand.grab.axial), t.up, tmp, t.spec.radius);
    } else {
      t.ph.gripAnchor(handPos);
      hand.pinchGrip.place(handPos, t.up, tmp, t.spec.radius);
    }
  }
  // sulfur between the fingertips
  const pinched = hands.filter((hand) => hand.held === 'grains');
  grainsMesh.forEach((m, i) => {
    const source = i < pinched.length ? pinched[i].tipPos : mouseGrains && i === pinched.length ? mouseGrainsPos : null;
    m.visible = !!source;
    if (source) m.position.copy(source);
  });

  // the vial: lip velocity from its motion (smoothed; the drops inherit it), pouring
  const vial = tools.vial;
  if (vial.active) {
    lip.copy(vialLip(vial.pos, vial.up, vial.spec.half.y));
    if (prevLipValid && dt > 0) lipVel.lerp(tmp.subVectors(lip, prevLip).divideScalar(dt).clampLength(0, 4), 0.4);
    else lipVel.set(0, 0, 0);
    prevLip.copy(lip);
    prevLipValid = true;
  } else {
    prevLipValid = false;
  }

  if (dt > 0) updateMatch(dt);

  // a vial pours whenever it is tilted far enough, held or not: one lying on its side leaks
  const angle = vial.active ? tiltAngle(vial.up) : 0;
  pourAccum += pour(state, dt, angle);
  while (pourAccum >= CFG.DROP_AMOUNT) {
    pourAccum -= CFG.DROP_AMOUNT;
    spawnDrop(drops, lip, spillVelocity(vial.up, state.flow / CFG.POUR_MAX_RATE, lipVel), CFG.DROP_AMOUNT);
  }
  stepDrops(drops, dt, TARGET, (amount, where, x, z, kind) => {
    if (where === 'crucible') {
      if (kind === 'sulfur') landSulfur(state, amount);
      else landMercury(state, amount);
      return;
    }
    state.wasted += amount; // splashed off the rim or fell on the table
    let px = x;
    let pz = z;
    if (where === 'rim') { // splashes outward and lands beside the stand
      const d = Math.hypot(x - TARGET.cx, z - TARGET.cz) || 1;
      px = TARGET.cx + ((x - TARGET.cx) / d) * 0.06;
      pz = TARGET.cz + ((z - TARGET.cz) / d) * 0.06;
    }
    puddles.add(px, pz, amount, kind); // stays where it fell
  });

  // stirring: the rod tip, held, moving inside the crucible
  const rod = tools.rod;
  const stirring = rod.active && rod.holder !== null && stirTracker.update(tmp.copy(rod.pos).addScaledVector(rod.up, -rod.spec.half.y), dt, STIR_TARGET);
  if (!rod.active || rod.holder === null) stirTracker.reset();
  stirCrucible(state, dt, stirring);

  step(state, dt);
  if (advanceLevel(state, dt, vial.holder !== null)) enterLevel2();
  if (matchHolder !== null && !state.match) { // burnt out in the hand
    const hand = hands[matchHolder];
    if (hand) hand.held = null;
    matchHolder = null;
  }
  const c = state.crucible;

  if (state.flow > 0 && typeof vial.holder === 'number' && time - lastPourPulse > 0.08) {
    lastPourPulse = time;
    pulse(hands[vial.holder], 0.1 + (0.5 * state.flow) / CFG.POUR_MAX_RATE, 60);
  }

  matchMesh.visible = !!state.match;
  if (state.match) {
    const lit = state.match.lit > 0;
    const broken = state.match.broken;
    refresh('match', `${lit}|${broken}`, matchMesh, () => matchModel(lit, broken));
  }
  refresh('box', state.matches, boxMesh, () => matchboxModel(state.matches));
  const flame = state.candleLit ? Math.floor(time * 8) % FLAME_FRAMES : -1;
  refresh('stand', flame, standMesh, () => standModel(flame));
  const contents = crucibleContents(c);
  refresh('crucible', JSON.stringify(contents), crucibleMesh, () => crucibleModel(contents));
  if (vial.active) {
    const lit = Math.ceil(Math.min(1, state.vial.fill / CFG.VIAL_CAPACITY) * bottleLayers - 1e-9); // layers with liquid
    refresh('vial', lit, vialLiquid, () => liquidModel(bottleShell, lit / bottleLayers));
  }
  if (tools.nugget.active && state.nugget) {
    const kind = state.nugget.kind;
    refresh('nugget', kind, tools.nugget.mesh, () => nuggetModel(kind));
  }

  // gauge around the crucible mouth: the dose being added (mercury in level 1, sulfur in level 2)
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 90) / 90;
  if (state.level === 1) {
    gaugeWindow.userData.set(CFG.DOSE_MIN / CFG.VIAL_CAPACITY, CFG.DOSE_MAX / CFG.VIAL_CAPACITY);
    gaugeFill.userData.set(0, q(c.mercury / CFG.VIAL_CAPACITY));
    holdGood.userData.set(0, q((state.progress.amalgam || 0) / CFG.AMALGAM_HOLD));
    holdBad.userData.set(0, q((state.progress.burn || 0) / CFG.BURN_HOLD));
  } else {
    gaugeWindow.userData.set(CFG.SULFUR_MIN / SULFUR_SCALE, CFG.SULFUR_MAX / SULFUR_SCALE);
    gaugeFill.userData.set(0, q(c.sulfur / SULFUR_SCALE));
    holdGood.userData.set(0, q(c.stir / CFG.STIR_NEEDED));
    holdBad.userData.set(0, q((state.progress.burn2 || 0) / CFG.BURN_HOLD));
  }

  updatePuddleMesh();
  drops.forEach((d, i) => {
    matrix.setPosition(snap(d.x), snap(d.y), snap(d.z));
    stream.setMatrixAt(i, matrix);
    stream.setColorAt(i, DROP_COLORS[d.kind] ?? DROP_COLORS.hg);
  });
  stream.instanceMatrix.needsUpdate = true;
  stream.instanceColor.needsUpdate = true;
  stream.count = drops.length;

  for (const entry of physics.debris) {
    entry.data.position.set(entry.body.position.x, entry.body.position.y, entry.body.position.z);
    entry.data.quaternion.set(entry.body.quaternion.x, entry.body.quaternion.y, entry.body.quaternion.z, entry.body.quaternion.w);
  }

  const lines = statusLines();
  if (renderer.xr.isPresenting) {
    if (time - hudPanelAt > 0.25) {
      hudPanelAt = time;
      drawHudPanel([...lines, 'pinch this panel to reset']);
    }
  } else {
    hud.textContent =
      `matchbox: click for a match, rub it fast over the striker | light candle: lit match at the wick | snuff: click candle\n` +
      `tools: drag with left mouse (vial: Shift + drag up/down tilts) | level 2: click the dish for sulfur, stir with the rod, click the finished gold | reset: R\n` +
      `VR (hands or controllers): closed fist / grip button = full hand (tool), pinch / trigger = two fingers (tool, match, sulfur, gold, wick), pinch the panel / B or Y = reset\n` +
      lines.join('\n');
    controls.update();
  }
  renderer.render(scene, camera);
});
