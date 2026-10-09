import * as THREE from 'three';
import { meshVoxelObject } from './mesher.js';

export function toGeometry(obj, voxelSize) {
  const m = meshVoxelObject(obj, voxelSize);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return geometry;
}
