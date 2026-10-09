import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGeometry } from './voxel-mesh.js';
import {
  createState, step, pour, pourStartAngle, landMercury, breakVial, takeMatch, strikeMatch, dropMatch, lightCandle, snuffCandle,
} from './game/sim.js';
import { spillVelocity, spawnDrop, stepDrops, MAX_DROPS } from './game/drops.js';
import { CFG } from './game/config.js';
import { tiltDirection, vialLip, tiltAngle, distanceToSegment, VIAL_HALF } from './game/geometry.js';
import {
  vialModel, vialLayers, crucibleModel, crucibleContents, standModel, FLAME_FRAMES, matchModel, matchboxModel,
} from './assets.js';
import { setupVR, tipWorld, palmWorld, analog, showGrip, pulse, resetPressed, TIP_Z, PALM_Z } from './vr.js';
import { createPhysics } from './physics.js';

const VOXEL = 0.01; // 1 voxel = 1 cm

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
const WICK = new THREE.Vector3(0, 0.045, 0);
const WICK_RADIUS = 0.035; // lit match head this close to the wick lights the candle
const SNUFF_RADIUS = 0.05; // pinch with the tip this close to the wick snuffs the candle
const VIAL_REST = new THREE.Vector3(0.22, VIAL_HALF, 0.08);
const BOX = new THREE.Vector3(-0.18, 0, 0.07); // matchbox origin (bottom center), footprint 6 x 4 cm
const BOX_HALF = { x: 0.03, z: 0.02 };
const BOX_CENTER = new THREE.Vector3(BOX.x, 0.015, BOX.z);
const BOX_GRAB_RADIUS = 0.045;
const STRIKER_Y = [0.02, 0.065]; // head height band above the striker (top at 0.03)
const VIAL_GRAB_RADIUS = 0.03; // palm (closed hand) to the vial's axis
const MATCH_HEAD_DY = 0.045; // head center above the match model's bottom
const MATCH_PINCH_DY = 0.01; // the fingers hold the match this far above its bottom
const MATCH_BODY_HALF_Y = 0.025; // physics half height of a dropped match
const HOLD_SNAP_TIME = 0.15; // s, the vial settles into the natural hold
const MAX_TILT = THREE.MathUtils.degToRad(130); // mouse: Shift + drag range

// desktop fallback
const HOLD_Y = 0.2; // height of the mouse-held vial's center
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
const matchMesh = part();
matchMesh.visible = false;
const vialGroup = new THREE.Group();
world.add(vialGroup);
const vialMesh = part(vialGroup);
vialMesh.position.y = -VIAL_HALF; // pivot at the vial's middle

// Rings around the crucible mouth: dose gauge (fill + target window) and hold progress.
function makeArc(inner, outer, color, y) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(CRUCIBLE.x, y, CRUCIBLE.z);
  world.add(mesh);
  mesh.visible = false;
  // from/to are fractions 0..1 of a 270 degree sweep
  mesh.userData.set = (from, to) => {
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
gaugeBack.userData.set(0, 1);
gaugeWindow.userData.set(CFG.DOSE_MIN / CFG.VIAL_CAPACITY, CFG.DOSE_MAX / CFG.VIAL_CAPACITY);

// Mercury drops in flight: 1 cm voxels, drawn on the 1 cm grid.
const stream = new THREE.InstancedMesh(new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL), new THREE.MeshBasicMaterial({ color: 0xd7e1eb }), MAX_DROPS);
stream.frustumCulled = false;
stream.count = 0;
world.add(stream);
const snap = (v) => Math.round(v / VOXEL) * VOXEL;
const matrix = new THREE.Matrix4();

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
  g.font = '34px monospace';
  lines.forEach((line, i) => g.fillText(line, 20, 50 + i * 52));
  hudTexture.needsUpdate = true;
}

// --- game state + input ---
let state;
let vialHolder; // null | 'mouse' | hand index
let matchHolder; // null | 'mouse' | hand index
let tilt; // mouse only: Shift + drag, 0..1
let shiftHeld;
let tiltOriginY;
let lastPointerY = 0;
let hands = [];
const vialPos = new THREE.Vector3();
const vialQuat = new THREE.Quaternion();
const vialUp = new THREE.Vector3(0, 1, 0);
const matchPos = new THREE.Vector3(); // mouse only: bottom of the match
const head = new THREE.Vector3(); // match head, world-local
const prevHead = new THREE.Vector3();
const headVel = new THREE.Vector3();
let prevHeadValid = false;
const grabOffset = new THREE.Vector2();
const keys = new Map(); // remesh cache: part name -> key
const drops = []; // mercury drops in flight
let pourAccum = 0; // poured amount not yet turned into a drop
const lip = new THREE.Vector3();
const prevLip = new THREE.Vector3();
const lipVel = new THREE.Vector3();
let prevLipValid = false;
// motion of the held vial, handed to the physics when it is let go
const vialLin = new THREE.Vector3();
const vialAng = new THREE.Vector3();
const prevVialPos = new THREE.Vector3();
const prevVialQuat = new THREE.Quaternion();
let vialTrackValid = false;
const mat = new THREE.Matrix4();
const scaleTmp = new THREE.Vector3();
const handPos = new THREE.Vector3();
const handQuat = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const tmp = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();

// --- physics: the vial and dropped matches are loose objects ---
function onVialBreak(pos, vel) {
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
  stack: { x: 0, z: 0, h: CRUCIBLE_TOP, halfW: 0.045 },
  matchbox: { x: BOX_CENTER.x, y: BOX_CENTER.y, z: BOX_CENTER.z, hx: BOX_HALF.x, hy: 0.015, hz: BOX_HALF.z },
  vialRest: VIAL_REST,
  onBreak: onVialBreak,
  onDebrisGone,
});

function reset() {
  state = createState();
  vialHolder = null;
  matchHolder = null;
  tilt = 0;
  prevHeadValid = false;
  prevLipValid = false;
  vialTrackValid = false;
  drops.length = 0;
  pourAccum = 0;
  vialPos.copy(VIAL_REST);
  vialQuat.identity();
  physics.reset();
  for (const hand of hands) {
    hand.held = null;
    hand.pinchOn = false;
    hand.squeezeOn = false;
  }
  keys.clear();
}
reset();

// --- VR input: two grips, like two kinds of fingers ---
// Full hand (grip button): the vial. Palm must be on the vial as the hand closes.
// Pinch (index finger, trigger): the match, and the wick. The tip must be on it as the fingers close.
// A grab only starts while the hand is closing; releasing is a deliberate loosening (hysteresis).
const tip = new THREE.Vector3();
const palm = new THREE.Vector3();
function tipLocal(hand, out) {
  return world.worldToLocal(tipWorld(hand, out));
}
function palmLocal(hand, out) {
  return world.worldToLocal(palmWorld(hand, out));
}

// Match: pinched near its bottom, head sticking out 3.5 cm beyond the fingers. Model +y -> grip -Z.
const MATCH_ATTACH = new THREE.Matrix4()
  .makeTranslation(0, 0, -(TIP_Z - MATCH_PINCH_DY))
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
const MATCH_HEAD_LOCAL = new THREE.Vector3(0, 0, -(TIP_Z - MATCH_PINCH_DY + MATCH_HEAD_DY));
function matchHeadLocal(hand, out) {
  return world.worldToLocal(out.copy(MATCH_HEAD_LOCAL).applyMatrix4(hand.grip.matrixWorld));
}

// Velocity of the held vial (smoothed), so a release throws, drops or sets it down like the hand moved.
function trackVialMotion(dt) {
  if (vialTrackValid && dt > 0) {
    vialLin.lerp(tmp.subVectors(vialPos, prevVialPos).divideScalar(dt), 0.5).clampLength(0, 5);
    tmpQuat.copy(prevVialQuat).invert().premultiply(vialQuat); // rotation since the last frame
    if (tmpQuat.w < 0) tmpQuat.set(-tmpQuat.x, -tmpQuat.y, -tmpQuat.z, -tmpQuat.w);
    const s = Math.sqrt(Math.max(0, 1 - tmpQuat.w * tmpQuat.w));
    const angle = 2 * Math.acos(Math.min(1, tmpQuat.w));
    tmp.set(tmpQuat.x, tmpQuat.y, tmpQuat.z).multiplyScalar(s > 1e-6 ? angle / s / dt : 0);
    vialAng.lerp(tmp, 0.5).clampLength(0, 30);
  } else {
    vialLin.set(0, 0, 0);
    vialAng.set(0, 0, 0);
  }
  prevVialPos.copy(vialPos);
  prevVialQuat.copy(vialQuat);
  vialTrackValid = true;
}

function takeVial() {
  vialHolder = null; // set by the caller
  physics.hold();
  vialTrackValid = false;
}

function releaseVial() {
  if (vialHolder === null) return;
  const hand = hands[vialHolder];
  if (hand) hand.held = null;
  vialHolder = null;
  tilt = 0;
  vialTrackValid = false;
  // no snapping upright: the vial falls, tips, rolls or breaks like any loose object
  physics.release(vialLin, vialAng);
}

function releaseMatch() {
  if (matchHolder === null) return;
  const hand = hands[matchHolder];
  if (hand) hand.held = null;
  matchHolder = null;
  if (state.match) { // a loose match falls from the hand
    const group = new THREE.Group();
    group.add(new THREE.Mesh(toGeometry(matchModel(state.match.lit > 0), VOXEL), material));
    group.children[0].position.y = -MATCH_BODY_HALF_Y;
    world.add(group);
    tmp.set(0, MATCH_BODY_HALF_Y, 0).applyQuaternion(matchMesh.quaternion).add(matchMesh.position);
    physics.addDebris(tmp, matchMesh.quaternion, headVel, group);
  }
  dropMatch(state);
}

function tryGrabVial(hand) {
  palmLocal(hand, palm);
  const a = vialPos.clone().addScaledVector(vialUp, -VIAL_HALF);
  const b = vialPos.clone().addScaledVector(vialUp, VIAL_HALF);
  if (vialHolder !== null || state.vialBroken || distanceToSegment(palm, a, b) > VIAL_GRAB_RADIUS) return;
  takeVial();
  vialHolder = hand.index;
  hand.held = 'vial';
  // settle from where the vial was into a natural hold: standing through the fist, thumb side up,
  // centered in the palm, liquid window toward the player
  mat.compose(vialPos, vialQuat, ONE).premultiply(world.matrixWorld);
  mat.premultiply(hand.grip.matrixWorld.clone().invert()).decompose(hand.grab.fromPos, hand.grab.fromQuat, scaleTmp);
  hand.grab.toPos.set(0, 0, -PALM_Z);
  hand.grab.toQuat.identity();
  hand.grab.t0 = clock.elapsedTime;
  pulse(hand, 0.3, 20);
}

function tryPinch(hand) {
  tipLocal(hand, tip);
  if (matchHolder === null && tip.distanceTo(BOX_CENTER) <= BOX_GRAB_RADIUS && takeMatch(state)) {
    matchHolder = hand.index;
    hand.held = 'match';
    pulse(hand, 0.3, 20);
  } else if (state.candleLit && tip.distanceTo(WICK) <= SNUFF_RADIUS) {
    snuffCandle(state); // pinch out the flame
    pulse(hand, 0.2, 30);
  }
}

function updateGrips(dt) {
  for (const hand of hands) {
    const { pinch, squeeze } = analog(hand);
    showGrip(hand, pinch, squeeze);
    hand.holdBlend += ((hand.held === 'vial' ? 1 : 0) - hand.holdBlend) * Math.min(1, dt * 10);
    hand.model.setHold(hand.holdBlend);

    if (!hand.squeezeOn && squeeze >= CFG.SQUEEZE_ON) {
      hand.squeezeOn = true;
      if (!hand.held) tryGrabVial(hand);
    } else if (hand.squeezeOn && squeeze < CFG.SQUEEZE_OFF) {
      hand.squeezeOn = false;
      if (hand.held === 'vial') releaseVial();
    }

    if (!hand.pinchOn && pinch >= CFG.PINCH_ON) {
      hand.pinchOn = true;
      if (!hand.held) tryPinch(hand);
    } else if (hand.pinchOn && pinch < CFG.PINCH_OFF) {
      hand.pinchOn = false;
      if (hand.held === 'match') releaseMatch();
    }
  }
}

hands = setupVR(renderer, scene);

// --- desktop fallback: mouse ---
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);
const matchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MATCH_Y);
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

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || renderer.xr.isPresenting) return;
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const [first] = raycaster.intersectObjects([vialMesh, boxMesh, standMesh]);
  if (!first) return; // empty space: orbit camera
  capturing = true;
  controls.enabled = false;
  if (first.object === standMesh) {
    snuffCandle(state);
  } else if (first.object === boxMesh) {
    if (matchHolder === null && takeMatch(state)) {
      matchHolder = 'mouse';
      const p = pointOn(matchPlane);
      matchPos.set(p.x, MATCH_Y, p.z);
    }
  } else if (vialHolder === null && !state.vialBroken) {
    takeVial();
    vialHolder = 'mouse';
    vialPos.y = HOLD_Y;
    const p = pointOn(holdPlane);
    grabOffset.set(vialPos.x - p.x, vialPos.z - p.z);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  updatePointer(e);
  if (vialHolder === 'mouse') {
    if (shiftHeld) {
      tilt = Math.min(1, Math.max(0, (e.clientY - tiltOriginY) / TILT_PIXELS));
    } else {
      const p = pointOn(holdPlane);
      if (p) vialPos.set(p.x + grabOffset.x, HOLD_Y, p.z + grabOffset.y);
    }
  }
  if (matchHolder === 'mouse') {
    const p = pointOn(matchPlane);
    if (p) matchPos.set(p.x, MATCH_Y, p.z);
  }
});

function mouseRelease() {
  if (vialHolder === 'mouse') releaseVial();
  if (matchHolder === 'mouse') releaseMatch();
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
    if (vialHolder === 'mouse') { // resume position drag without a jump
      const p = pointOn(holdPlane);
      if (p) grabOffset.set(vialPos.x - p.x, vialPos.z - p.z);
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

// Pose of what is held, from the hands (VR) or the mouse. A free vial gets its pose from the physics instead.
function updatePoses() {
  for (const hand of hands) {
    if (hand.held === 'vial') {
      const g = hand.grab;
      const t = Math.min(1, (clock.elapsedTime - g.t0) / HOLD_SNAP_TIME);
      const e = t * t * (3 - 2 * t);
      mat.compose(handPos.lerpVectors(g.fromPos, g.toPos, e), handQuat.slerpQuaternions(g.fromQuat, g.toQuat, e), ONE);
      mat.premultiply(hand.grip.matrixWorld).premultiply(worldInv).decompose(vialPos, vialQuat, scaleTmp);
    }
  }
  if (vialHolder === 'mouse') {
    const dir = tiltDirection(vialPos, CRUCIBLE);
    vialQuat.setFromAxisAngle(new THREE.Vector3().crossVectors(UP, new THREE.Vector3(dir.x, 0, dir.z)), tilt * MAX_TILT);
  }

  if (matchHolder === 'mouse') {
    matchMesh.position.copy(matchPos);
    matchMesh.quaternion.identity();
    head.set(matchPos.x, MATCH_Y + MATCH_HEAD_DY, matchPos.z);
  } else if (matchHolder !== null) {
    const hand = hands[matchHolder];
    mat.copy(hand.grip.matrixWorld).multiply(MATCH_ATTACH).premultiply(worldInv);
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
    const speed = Math.hypot(head.x - prevHead.x, head.z - prevHead.z) / dt;
    const onBox = Math.abs(head.x - BOX.x) <= BOX_HALF.x && Math.abs(head.z - BOX.z) <= BOX_HALF.z && head.y >= STRIKER_Y[0] && head.y <= STRIKER_Y[1];
    if (onBox && speed >= CFG.STRIKE_SPEED && state.match.lit === 0) {
      strikeMatch(state);
      if (hand) pulse(hand, 0.7, 50);
    }
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
  return [
    `candle ${state.candleLit ? 'LIT' : 'out'}  matches ${state.matches}` +
      (state.match ? `  in hand: ${state.match.lit > 0 ? `lit ${state.match.lit.toFixed(1)}s` : 'unlit'}` : ''),
    state.vialBroken
      ? `vial BROKEN (R or B/Y resets)  wasted ${state.wasted.toFixed(2)}`
      : `vial ${state.vial.fill.toFixed(2)} pours from ${Math.round((pourStartAngle(state.vial.fill) * 180) / Math.PI)} deg  wasted ${state.wasted.toFixed(2)}`,
    `crucible: ${c.content}  Hg ${c.mercury.toFixed(2)} (window ${CFG.DOSE_MIN}-${CFG.DOSE_MAX})`,
    `temp ${c.temp.toFixed(2)} (melt ${CFG.MELT} / burn ${CFG.BURN})` + (c.quality !== null ? `  quality ${c.quality.toFixed(2)}` : ''),
  ];
}

const clock = new THREE.Clock();
let lastPourPulse = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  for (const hand of hands) if (resetPressed(hand)) reset();
  updateGrips(dt);
  updatePoses();

  // physics: a held vial follows the hand, a free one is a rigid body
  if (vialHolder !== null) {
    physics.setPose(vialPos, vialQuat);
    trackVialMotion(dt);
  }
  physics.step(dt);
  if (vialHolder === null && physics.isAlive()) physics.readPose(vialPos, vialQuat);
  vialUp.copy(UP).applyQuaternion(vialQuat);
  vialGroup.position.copy(vialPos);
  vialGroup.quaternion.copy(vialQuat);
  vialGroup.visible = !state.vialBroken;
  for (const entry of physics.debris) {
    entry.data.position.set(entry.body.position.x, entry.body.position.y, entry.body.position.z);
    entry.data.quaternion.set(entry.body.quaternion.x, entry.body.quaternion.y, entry.body.quaternion.z, entry.body.quaternion.w);
  }

  lip.copy(vialLip(vialPos, vialUp));
  // lip velocity from motion, smoothed; the drops inherit it
  if (prevLipValid && dt > 0) {
    lipVel.lerp(tmp.subVectors(lip, prevLip).divideScalar(dt).clampLength(0, 4), 0.4);
  } else {
    lipVel.set(0, 0, 0);
  }
  prevLip.copy(lip);
  prevLipValid = true;

  if (dt > 0) updateMatch(dt);

  // a vial pours whenever it is tilted far enough, held or not: one lying on its side leaks
  const angle = state.vialBroken ? 0 : tiltAngle(vialUp);
  pourAccum += pour(state, dt, angle);
  while (pourAccum >= CFG.DROP_AMOUNT) {
    pourAccum -= CFG.DROP_AMOUNT;
    spawnDrop(drops, lip, spillVelocity(vialUp, state.flow / CFG.POUR_MAX_RATE, lipVel), CFG.DROP_AMOUNT);
  }
  stepDrops(drops, dt, TARGET, (amount, where) => {
    if (where === 'crucible') landMercury(state, amount);
    else state.wasted += amount; // splashed off the rim or fell on the table
  });

  step(state, dt);
  if (matchHolder !== null && !state.match) { // burnt out in the hand
    const hand = hands[matchHolder];
    if (hand) hand.held = null;
    matchHolder = null;
  }
  const c = state.crucible;

  if (state.flow > 0 && typeof vialHolder === 'number' && time - lastPourPulse > 0.08) {
    lastPourPulse = time;
    pulse(hands[vialHolder], 0.1 + (0.5 * state.flow) / CFG.POUR_MAX_RATE, 60);
  }

  matchMesh.visible = !!state.match;
  if (state.match) {
    const lit = state.match.lit > 0;
    refresh('match', lit, matchMesh, () => matchModel(lit));
  }
  refresh('box', state.matches, boxMesh, () => matchboxModel(state.matches));
  const flame = state.candleLit ? Math.floor(time * 8) % FLAME_FRAMES : -1;
  refresh('stand', flame, standMesh, () => standModel(flame));
  const contents = crucibleContents(c);
  refresh('crucible', JSON.stringify(contents), crucibleMesh, () => crucibleModel(contents));
  const layers = vialLayers(state.vial.fill);
  refresh('vial', layers, vialMesh, () => vialModel(layers));

  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 90) / 90;
  gaugeFill.userData.set(0, q(c.mercury / CFG.VIAL_CAPACITY));
  holdGood.userData.set(0, q((state.progress.amalgam || 0) / CFG.AMALGAM_HOLD));
  holdBad.userData.set(0, q((state.progress.burn || 0) / CFG.BURN_HOLD));

  drops.forEach((d, i) => {
    matrix.setPosition(snap(d.x), snap(d.y), snap(d.z));
    stream.setMatrixAt(i, matrix);
  });
  stream.instanceMatrix.needsUpdate = true;
  stream.count = drops.length;

  const lines = statusLines();
  if (renderer.xr.isPresenting) {
    if (time - hudPanelAt > 0.25) {
      hudPanelAt = time;
      drawHudPanel(lines);
    }
  } else {
    hud.textContent =
      `matchbox: click to take a match, rub it fast over the striker | light candle: lit match at the wick | snuff: click candle\n` +
      `vial: drag with left mouse, Shift + drag up/down tilts, let go to drop it | reset: R | orbit: drag empty space\n` +
      `VR: grip button = full hand (vial), trigger = pinch (match, wick), B/Y = reset\n` +
      lines.join('\n');
    controls.update();
  }
  renderer.render(scene, camera);
});
