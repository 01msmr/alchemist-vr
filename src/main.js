import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGeometry } from './voxel-mesh.js';
import { createState, step, takeMatch, strikeMatch, dropMatch, lightCandle, snuffCandle } from './game/sim.js';
import { CFG } from './game/config.js';
import { tiltDirection, vialLip, tiltOf, distanceToSegment, VIAL_HALF } from './game/geometry.js';
import {
  vialModel, vialLayers, crucibleModel, crucibleContents, standModel, FLAME_FRAMES, matchModel, matchboxModel,
} from './assets.js';
import { setupVR, tipWorld, pulse, resetPressed, TIP_Z } from './vr.js';

const VOXEL = 0.01; // 1 voxel = 1 cm

// Table: 2 x 1 m, 0.85 m high. The game lives in `world`, whose origin is on the table top,
// 45 cm in front of the player (who stands at the XR origin, facing -z).
const TABLE = { w: 2, d: 1, h: 0.85, z: -0.65 };
const WORLD_ORIGIN = new THREE.Vector3(0, TABLE.h, -0.45);
// table extent in world-local coordinates
const TABLE_X = TABLE.w / 2 - 0.05;
const TABLE_Z0 = TABLE.z - WORLD_ORIGIN.z - TABLE.d / 2 + 0.05;
const TABLE_Z1 = TABLE.z - WORLD_ORIGIN.z + TABLE.d / 2 - 0.05;

// layout in world-local coordinates (meters, y up from the table top)
const CRUCIBLE = new THREE.Vector3(0, 0.07, 0); // crucible origin (bottom center), sits on the stand
const CRUCIBLE_TOP = 0.14;
const CRUCIBLE_MOUTH = 0.04; // lip must be within this horizontal distance to pour in
const WICK = new THREE.Vector3(0, 0.045, 0);
const WICK_RADIUS = 0.035; // lit match head this close to the wick lights the candle
const SNUFF_RADIUS = 0.05; // trigger with the tip this close to the wick snuffs the candle
const VIAL_REST = new THREE.Vector3(0.22, VIAL_HALF, 0.08);
const BOX = new THREE.Vector3(-0.18, 0, 0.07); // matchbox origin (bottom center), footprint 6 x 4 cm
const BOX_HALF = { x: 0.03, z: 0.02 };
const BOX_CENTER = new THREE.Vector3(BOX.x, 0.015, BOX.z);
const BOX_GRAB_RADIUS = 0.045;
const STRIKER_Y = [0.02, 0.065]; // head height band above the striker (top at 0.03)
const VIAL_GRAB_RADIUS = 0.03; // controller tip to the vial's axis
const MATCH_HEAD_DY = 0.045; // head center above the match model's bottom
const MAX_TILT = THREE.MathUtils.degToRad(110);

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
const floor = new THREE.GridHelper(4, 40, 0x555555, 0x333333);
scene.add(floor);

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

// Pour stream: a column of 1 cm voxels falling from the lip.
const STREAM_CUBES = 16;
const stream = new THREE.InstancedMesh(new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL), new THREE.MeshBasicMaterial({ color: 0xd7e1eb }), STREAM_CUBES);
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
hudPanel.position.set(0, 0.3, TABLE_Z0 + 0.05);
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
let prevHeadValid = false;
const grabOffset = new THREE.Vector2();
const keys = new Map(); // remesh cache: part name -> key
const mat = new THREE.Matrix4();
const scaleTmp = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

function reset() {
  state = createState();
  vialHolder = null;
  matchHolder = null;
  tilt = 0;
  prevHeadValid = false;
  vialPos.copy(VIAL_REST);
  vialQuat.identity();
  for (const hand of hands) hand.held = null;
  keys.clear();
}
reset();

// --- VR input: squeeze to take (the tip must be on the object), release to let go ---
const tip = new THREE.Vector3();
function tipLocal(hand, out) {
  return world.worldToLocal(tipWorld(hand, out));
}

// Match: held like a pen, head at the tip (grip -Z). Model +y -> grip -Z, head center at TIP_Z.
const MATCH_ATTACH = new THREE.Matrix4()
  .makeTranslation(0, 0, -(TIP_Z - MATCH_HEAD_DY))
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

function placeOnTable(p) {
  p.x = Math.min(TABLE_X, Math.max(-TABLE_X, p.x));
  p.z = Math.min(TABLE_Z1, Math.max(TABLE_Z0, p.z));
  // not inside the stand
  const dx = p.x - CRUCIBLE.x;
  const dz = p.z - CRUCIBLE.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.07) {
    const k = 0.07 / (d || 1);
    p.x = CRUCIBLE.x + (d ? dx * k : 0.07);
    p.z = CRUCIBLE.z + (d ? dz * k : 0);
  }
}

function releaseVial() {
  if (vialHolder === null) return;
  const hand = hands[vialHolder];
  if (hand) hand.held = null;
  vialHolder = null;
  tilt = 0;
  vialQuat.identity(); // set down upright
  vialPos.y = VIAL_HALF;
  placeOnTable(vialPos);
}

function releaseMatch() {
  if (matchHolder === null) return;
  const hand = hands[matchHolder];
  if (hand) hand.held = null;
  matchHolder = null;
  dropMatch(state); // a dropped match is gone
}

function squeezeStart(hand) {
  if (hand.held) return;
  tipLocal(hand, tip);
  const a = vialPos.clone().addScaledVector(vialUp, -VIAL_HALF);
  const b = vialPos.clone().addScaledVector(vialUp, VIAL_HALF);
  if (vialHolder === null && distanceToSegment(tip, a, b) <= VIAL_GRAB_RADIUS) {
    vialHolder = hand.index;
    hand.held = 'vial';
    // keep the pose of the vial relative to the hand: 1:1 control, no snapping
    mat.compose(vialPos, vialQuat, ONE).premultiply(world.matrixWorld);
    hand.offset = hand.grip.matrixWorld.clone().invert().multiply(mat);
    pulse(hand, 0.3, 20);
  } else if (matchHolder === null && tip.distanceTo(BOX_CENTER) <= BOX_GRAB_RADIUS && takeMatch(state)) {
    matchHolder = hand.index;
    hand.held = 'match';
    pulse(hand, 0.3, 20);
  }
}

function squeezeEnd(hand) {
  if (hand.held === 'vial') releaseVial();
  else if (hand.held === 'match') releaseMatch();
}

function selectStart(hand) {
  if (tipLocal(hand, tip).distanceTo(WICK) <= SNUFF_RADIUS && state.candleLit) {
    snuffCandle(state);
    pulse(hand, 0.2, 30);
  }
}

hands = setupVR(renderer, scene, { squeezeStart, squeezeEnd, selectStart });

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
  } else if (vialHolder === null) {
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

// Pose of everything that is held, from the hands (VR) or the mouse.
function updatePoses() {
  for (const hand of hands) {
    if (hand.held === 'vial') {
      mat.copy(hand.grip.matrixWorld).multiply(hand.offset).premultiply(worldInv);
      mat.decompose(vialPos, vialQuat, scaleTmp);
    }
  }
  if (vialHolder === 'mouse') {
    const dir = tiltDirection(vialPos, CRUCIBLE);
    vialQuat.setFromAxisAngle(new THREE.Vector3().crossVectors(UP, new THREE.Vector3(dir.x, 0, dir.z)), tilt * MAX_TILT);
  }
  vialUp.copy(UP).applyQuaternion(vialQuat);
  vialGroup.position.copy(vialPos);
  vialGroup.quaternion.copy(vialQuat);

  if (matchHolder === 'mouse') {
    matchMesh.position.copy(matchPos);
    matchMesh.quaternion.identity();
    head.set(matchPos.x, MATCH_Y + MATCH_HEAD_DY, matchPos.z);
  } else if (matchHolder !== null) {
    const hand = hands[matchHolder];
    mat.copy(hand.grip.matrixWorld).multiply(MATCH_ATTACH).premultiply(worldInv);
    mat.decompose(matchMesh.position, matchMesh.quaternion, scaleTmp);
    tipLocal(hand, head);
  }
}

// Strike on the matchbox (fast sideways motion over the striker), light the candle at the wick.
function updateMatch(dt) {
  if (matchHolder === null || !state.match) {
    prevHeadValid = false;
    return;
  }
  const hand = matchHolder === 'mouse' ? null : hands[matchHolder];
  if (prevHeadValid) {
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
    `vial ${state.vial.fill.toFixed(2)}  wasted ${state.wasted.toFixed(2)}`,
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

  updatePoses();
  const lip = vialLip(vialPos, vialUp);
  const tiltNow = vialHolder === null ? 0 : tiltOf(vialUp, MAX_TILT);
  const overCrucible = vialHolder !== null && Math.hypot(lip.x - CRUCIBLE.x, lip.z - CRUCIBLE.z) <= CRUCIBLE_MOUTH && lip.y > CRUCIBLE_TOP;

  if (dt > 0) updateMatch(dt);
  step(state, dt, { tilt: tiltNow, overCrucible });
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

  if (state.flow > 0) {
    const endY = overCrucible ? CRUCIBLE_TOP - 0.02 : 0;
    for (let i = 0; i < STREAM_CUBES; i++) {
      const t = (i / STREAM_CUBES + time * 1.5) % 1;
      matrix.setPosition(snap(lip.x), snap(lip.y + (endY - lip.y) * t), snap(lip.z));
      stream.setMatrixAt(i, matrix);
    }
    stream.instanceMatrix.needsUpdate = true;
    stream.count = STREAM_CUBES;
  } else {
    stream.count = 0;
  }

  const lines = statusLines();
  if (renderer.xr.isPresenting) {
    if (time - hudPanelAt > 0.25) {
      hudPanelAt = time;
      drawHudPanel(lines);
    }
  } else {
    hud.textContent =
      `matchbox: click to take a match, rub it fast over the striker | light candle: lit match at the wick | snuff: click candle\n` +
      `vial: drag with left mouse, Shift + drag up/down tilts | reset: R | orbit: drag empty space\n` +
      lines.join('\n');
    controls.update();
  }
  renderer.render(scene, camera);
});
