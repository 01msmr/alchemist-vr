import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox } from './vox.js';
import { VoxelObject } from './voxel-object.js';
import { toGeometry } from './voxel-mesh.js';

const VOXEL = 0.01; // 1 voxel = 1 cm

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202428);
scene.add(new THREE.GridHelper(0.5, 50, 0x555555, 0x333333));

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);
camera.position.set(0.25, 0.2, 0.35);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.06, 0);

// Axis test cube (8^3): red corner at x=0,y=0,z=0 / green at +x / blue at +y / yellow at +z (Y-up).
function axisTestCube() {
  const palette = [[200, 200, 200], [180, 180, 180], [230, 50, 50], [50, 200, 50], [60, 90, 240], [240, 220, 50]];
  const obj = VoxelObject.empty(8, 8, 8, palette);
  for (let z = 0; z < 8; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) obj.set(x, y, z, 1);
  obj.set(0, 0, 0, 2);
  obj.set(7, 0, 0, 3);
  obj.set(0, 7, 0, 4);
  obj.set(0, 0, 7, 5);
  return obj;
}

let mesh = null;
function show(obj) {
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  const geometry = toGeometry(obj, VOXEL);
  // Flat colors, no lighting: the look comes from geometry + vertex AO.
  mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(mesh);
}

show(axisTestCube());

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  try {
    show(parseVox(await file.arrayBuffer()));
  } catch (err) {
    console.error(err);
    document.getElementById('hint').textContent = `error: ${err.message}`;
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
