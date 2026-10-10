import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGeometry } from '../voxel-mesh.js';
import { CONSOLE, LAYOUT, VIEW } from '../config/index.js';
import { pockets } from '../game/console.js';
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(VIEW.groundSize, VIEW.groundSize).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial());
  ground.position.y = -0.002; // just under the grid
  scene.add(ground);
  let grid = null;

  // table: a top with a hole for every control of the console (its pocket) on a lower slab, darker sides and legs
  const topMaterial = new THREE.MeshBasicMaterial();
  const sideMaterial = new THREE.MeshBasicMaterial();
  const floorMaterial = new THREE.MeshBasicMaterial({ color: CONSOLE.colors.pocketFloor });
  const centerZ = table.z - worldOrigin.z; // the table's middle in the world group
  const depth = CONSOLE.pocket.voxels * LAYOUT.voxel; // pocket depth
  const slabHeight = VIEW.table.thickness - depth;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(table.w, slabHeight, table.d), [sideMaterial, sideMaterial, floorMaterial, sideMaterial, sideMaterial, sideMaterial]);
  slab.position.set(0, -depth - slabHeight / 2, centerZ); // in the world group: y from the table top
  const b = LAYOUT.tableBounds;
  const outline = new THREE.Shape([new THREE.Vector2(b.minX, -b.minZ), new THREE.Vector2(b.maxX, -b.minZ), new THREE.Vector2(b.maxX, -b.maxZ), new THREE.Vector2(b.minX, -b.maxZ)]);
  for (const p of pockets()) outline.holes.push(new THREE.Path([new THREE.Vector2(p.x0, -p.z0), new THREE.Vector2(p.x0, -p.z1), new THREE.Vector2(p.x1, -p.z1), new THREE.Vector2(p.x1, -p.z0)]));
  // the shape lies in x / -z so that turning it flat makes its normal point up; the extrusion then goes up from y = -depth
  const topLayer = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -depth, 0), [topMaterial, sideMaterial]);
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(VIEW.table.leg, table.h - VIEW.table.thickness, VIEW.table.leg), sideMaterial);
      leg.position.set(sx * (table.w / 2 - VIEW.table.legInset), -VIEW.table.thickness - (table.h - VIEW.table.thickness) / 2, centerZ + sz * (table.d / 2 - VIEW.table.legInset));
      legs.push(leg);
    }
  }

  const world = new THREE.Group();
  world.position.set(worldOrigin.x, worldOrigin.y, worldOrigin.z);
  scene.add(world);
  world.add(slab, topLayer, ...legs);
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

  // The look: dark or light, and the placeholder background (ground and sky colors)
  const look = { theme: 'dark', background: 'lab' };
  function applyLook() {
    const theme = VIEW.themes[look.theme];
    const back = VIEW.backgrounds[look.background][look.theme];
    scene.background = new THREE.Color(back.sky);
    ground.material.color.set(back.ground);
    topMaterial.color.set(theme.tableTop);
    sideMaterial.color.set(theme.tableSide);
    if (grid) {
      scene.remove(grid);
      grid.dispose();
    }
    grid = new THREE.GridHelper(VIEW.floorGrid.size, VIEW.floorGrid.divisions, theme.grid[0], theme.grid[1]);
    scene.add(grid);
  }
  view.setTheme = (name) => { look.theme = name; applyLook(); };
  view.setBackground = (name) => { look.background = name; applyLook(); };
  applyLook();

  // The table top is at height h (m above the floor): everything on the table moves with it (the world group's
  // origin is on the table top), and the desktop camera keeps its view of the table.
  view.setTableHeight = (h) => {
    const delta = h - world.position.y;
    world.position.y = h;
    world.updateMatrixWorld(true);
    worldInv.copy(world.matrixWorld).invert();
    for (const leg of legs) {
      leg.scale.y = (h - VIEW.table.thickness) / (table.h - VIEW.table.thickness);
      leg.position.y = -VIEW.table.thickness - (h - VIEW.table.thickness) / 2;
    }
    camera.position.y += delta;
    if (view.controls) view.controls.target.y += delta;
  };

  // The table's front edge was measured: the world group (and with it the table, its legs and everything on it)
  // moves to the edge point and turns with the edge. e = { x, z, yaw } in the scene.
  view.setTableEdge = ({ x, z, yaw }) => {
    world.position.x = x;
    world.position.z = z;
    world.rotation.y = yaw;
    world.updateMatrixWorld(true);
    worldInv.copy(world.matrixWorld).invert();
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
