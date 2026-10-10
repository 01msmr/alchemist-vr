import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGeometry } from '../voxel-mesh.js';
import { LAYOUT, VIEW } from '../config/index.js';
import { PROPS } from '../props.js';

// Everything you see that is not a tool or an effect: the renderer, the table, the camera, the world group
// (its origin is on the table top) and the static voxel parts. Returns the `view` the other modules share.
export function createScene() {
  const { table, worldOrigin } = LAYOUT;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VIEW.background);
  const grid = VIEW.floorGrid;
  scene.add(new THREE.GridHelper(grid.size, grid.divisions, grid.colorA, grid.colorB));

  // table: light grey top, darker sides and legs
  const topMaterial = new THREE.MeshBasicMaterial({ color: VIEW.table.top });
  const sideMaterial = new THREE.MeshBasicMaterial({ color: VIEW.table.side });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(table.w, VIEW.table.thickness, table.d), [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial]);
  slab.position.set(0, table.h - VIEW.table.thickness / 2, table.z);
  scene.add(slab);
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(VIEW.table.leg, table.h - VIEW.table.thickness, VIEW.table.leg), sideMaterial);
      leg.position.set(sx * (table.w / 2 - VIEW.table.legInset), (table.h - VIEW.table.thickness) / 2, table.z + sz * (table.d / 2 - VIEW.table.legInset));
      scene.add(leg);
      legs.push(leg);
    }
  }

  const world = new THREE.Group();
  world.position.set(worldOrigin.x, worldOrigin.y, worldOrigin.z);
  scene.add(world);
  world.updateMatrixWorld(true);
  const worldInv = new THREE.Matrix4().copy(world.matrixWorld).invert();

  const camera = new THREE.PerspectiveCamera(VIEW.camera.fov, innerWidth / innerHeight, 0.01, 20);
  camera.position.set(VIEW.camera.offset.x + worldOrigin.x, VIEW.camera.offset.y + worldOrigin.y, VIEW.camera.offset.z + worldOrigin.z);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const material = new THREE.MeshBasicMaterial({ vertexColors: true }); // flat colors, the look comes from geometry + AO
  const part = (parent = world) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    parent.add(mesh);
    return mesh;
  };
  const remesh = (mesh, obj) => {
    mesh.geometry.dispose();
    mesh.geometry = toGeometry(obj, LAYOUT.voxel);
  };

  // Re-mesh a part only when its quantised look changes. refresh(name, key, mesh, build); refresh.clear() forgets all.
  const seen = new Map();
  const refresh = (name, key, mesh, build) => {
    if (seen.get(name) === key) return;
    seen.set(name, key);
    remesh(mesh, build());
  };
  refresh.clear = () => seen.clear();

  // the static parts; their look is refreshed from the state each frame
  const stand = part();
  const crucible = part();
  crucible.position.set(LAYOUT.crucible.x, LAYOUT.crucible.y, LAYOUT.crucible.z);
  const box = part();
  box.position.set(LAYOUT.matchbox.x, LAYOUT.matchbox.y, LAYOUT.matchbox.z);
  const match = part(); // the match in hand
  match.visible = false;
  const props = {}; // shown or hidden by the level
  for (const [name, prop] of Object.entries(PROPS)) {
    const mesh = part();
    mesh.position.set(prop.at.x, prop.at.y, prop.at.z);
    remesh(mesh, prop.build());
    mesh.visible = false;
    props[name] = mesh;
  }

  const view = { renderer, scene, camera, world, worldInv, material, part, remesh, refresh, meshes: { stand, crucible, box, match }, props, controls: null };

  // The table top is at height h (m above the floor): everything on the table moves with it (the world group's
  // origin is on the table top), and the desktop camera keeps its view of the table.
  view.setTableHeight = (h) => {
    const delta = h - world.position.y;
    world.position.y = h;
    world.updateMatrixWorld(true);
    worldInv.copy(world.matrixWorld).invert();
    slab.position.y = h - VIEW.table.thickness / 2;
    for (const leg of legs) {
      leg.scale.y = (h - VIEW.table.thickness) / (table.h - VIEW.table.thickness);
      leg.position.y = (h - VIEW.table.thickness) / 2;
    }
    camera.position.y += delta;
    if (view.controls) view.controls.target.y += delta;
  };
  return view;
}

// The desktop camera control. Created after the mouse handlers, so their pointerdown runs first and can
// switch orbiting off when something is picked up.
export function createControls(view) {
  const { camera, renderer } = view;
  const o = LAYOUT.worldOrigin;
  const t = VIEW.camera.target;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(o.x + t.x, o.y + t.y, o.z + t.z);
  controls.enablePan = false;
  renderer.xr.addEventListener('sessionstart', () => { controls.enabled = false; });
  renderer.xr.addEventListener('sessionend', () => { controls.enabled = true; });
  view.controls = controls;
  return controls;
}
