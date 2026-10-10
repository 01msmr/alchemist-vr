import * as THREE from 'three';
import { sampleTexture } from './texture.js';

// A binary glTF (.glb) as triangles for voxelize(): every triangle mesh in the scene, with the transforms of its nodes
// applied. The color is the material's base color factor, times the vertex colors (COLOR_0) and the base color
// texture (TEXCOORD_0) where there are any. Not supported: .gltf with separate files, triangle strips and fans,
// skins and animation (the model is taken as it lies in the file).
// decodeImage(bytes, mimeType) -> { width, height, data: RGBA } or null; without it textures are ignored.

const COMPONENT = { 5120: [Int8Array, 127], 5121: [Uint8Array, 255], 5122: [Int16Array, 32767], 5123: [Uint16Array, 65535], 5125: [Uint32Array, 1], 5126: [Float32Array, 1] };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

// glTF colors and factors are linear, the game's palette is sRGB
const srgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));

function readChunks(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('not a binary glTF (.glb) file');
  let json = null;
  let bin = null;
  for (let at = 12; at + 8 <= buffer.byteLength;) {
    const length = view.getUint32(at, true);
    const type = view.getUint32(at + 4, true);
    const bytes = new Uint8Array(buffer, at + 8, length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes));
    else if (type === 0x004e4942 && !bin) bin = bytes;
    at += 8 + length;
  }
  if (!json || !bin) throw new Error('not a binary glTF (.glb) file: JSON or binary chunk missing');
  return { json, bin };
}

export function parseGlb(buffer, { decodeImage = null } = {}) {
  const { json, bin } = readChunks(buffer);

  // an accessor as an array of numbers per element (normalized integers become 0..1)
  function read(accessorIndex) {
    const accessor = json.accessors[accessorIndex];
    const view = json.bufferViews[accessor.bufferView];
    const [Type, max] = COMPONENT[accessor.componentType];
    const width = WIDTH[accessor.type];
    const stride = view.byteStride || width * Type.BYTES_PER_ELEMENT;
    const start = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const data = new DataView(bin.buffer);
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[accessor.componentType];
    const out = [];
    for (let i = 0; i < accessor.count; i++) {
      const element = [];
      for (let k = 0; k < width; k++) {
        const value = data[get](start + i * stride + k * Type.BYTES_PER_ELEMENT, true);
        element.push(accessor.componentType === 5126 || !(accessor.normalized || max === 1) ? value : value / max);
      }
      out.push(element);
    }
    return out;
  }

  const textures = new Map();
  function textureOf(info) {
    if (!info || !decodeImage) return null;
    const key = info.index;
    if (!textures.has(key)) {
      const image = json.images?.[json.textures?.[key]?.source];
      let texture = null;
      if (image && image.bufferView !== undefined) {
        const view = json.bufferViews[image.bufferView];
        texture = decodeImage(new Uint8Array(bin.buffer, bin.byteOffset + (view.byteOffset ?? 0), view.byteLength), image.mimeType);
      }
      textures.set(key, texture);
    }
    return textures.get(key);
  }

  const triangles = [];
  function addPrimitive(primitive, matrix) {
    if ((primitive.mode ?? 4) !== 4) return;
    const positions = read(primitive.attributes.POSITION).map((p) => new THREE.Vector3(...p).applyMatrix4(matrix).toArray());
    const indices = primitive.indices !== undefined ? read(primitive.indices).map((e) => e[0]) : positions.map((_, i) => i);
    const pbr = json.materials?.[primitive.material]?.pbrMetallicRoughness ?? {};
    const factor = (pbr.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3).map(srgb);
    const vertexColors = primitive.attributes.COLOR_0 !== undefined ? read(primitive.attributes.COLOR_0).map((c) => c.slice(0, 3).map(srgb)) : null;
    const uvs = primitive.attributes.TEXCOORD_0 !== undefined ? read(primitive.attributes.TEXCOORD_0) : null;
    const texture = uvs ? textureOf(pbr.baseColorTexture) : null;
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const [i0, i1, i2] = [indices[i], indices[i + 1], indices[i + 2]];
      const triangle = { a: positions[i0], b: positions[i1], c: positions[i2], color: factor };
      if (vertexColors || texture) {
        triangle.colorAt = (wa, wb, wc) => {
          const color = factor.slice();
          if (vertexColors) {
            for (let k = 0; k < 3; k++) color[k] = (color[k] * (wa * vertexColors[i0][k] + wb * vertexColors[i1][k] + wc * vertexColors[i2][k])) / 255;
          }
          if (texture) {
            // glTF's v is down from the top of the image
            const u = wa * uvs[i0][0] + wb * uvs[i1][0] + wc * uvs[i2][0];
            const v = wa * uvs[i0][1] + wb * uvs[i1][1] + wc * uvs[i2][1];
            const texel = sampleTexture(texture, u, 1 - v);
            for (let k = 0; k < 3; k++) color[k] = (color[k] * texel[k]) / 255;
          }
          return color.map(Math.round);
        };
      }
      triangles.push(triangle);
    }
  }

  function visit(nodeIndex, parent) {
    const node = json.nodes[nodeIndex];
    const local = new THREE.Matrix4();
    if (node.matrix) local.fromArray(node.matrix);
    else {
      local.compose(
        new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
        new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
      );
    }
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) addPrimitive(primitive, world);
    for (const child of node.children ?? []) visit(child, world);
  }

  const roots = json.scenes ? json.scenes[json.scene ?? 0].nodes : json.nodes.map((_, i) => i).filter((i) => !json.nodes.some((n) => n.children?.includes(i)));
  for (const root of roots) visit(root, new THREE.Matrix4());
  return triangles;
}
