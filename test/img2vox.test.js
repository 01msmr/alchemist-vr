import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox, crop, resizeArea } from '../src/img2vox/image.js';
import { quantize } from '../src/img2vox/quantize.js';
import { latheShell } from '../src/img2vox/lathe.js';
import { writeVox } from '../src/img2vox/voxwrite.js';
import { parseVox } from '../src/vox.js';
import { bodyLayers, splitGlass, liquidModel, fillLayers, toolSpecFromModel } from '../src/img2vox/vessel.js';

// synthetic RGBA image: rows top to bottom; `shape(x, y)` returns [r,g,b] or null for transparent
function makeImage(w, h, shape) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = shape(x, y);
      const i = (y * w + x) * 4;
      if (c) data.set([c[0], c[1], c[2], 255], i);
    }
  }
  return { width: w, height: h, data };
}
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

test('boundingBox finds the opaque area and crop cuts it out', () => {
  const img = makeImage(20, 30, (x, y) => (x >= 5 && x < 12 && y >= 8 && y < 25 ? [200, 0, 0] : null));
  assert.deepEqual(boundingBox(img), { minX: 5, minY: 8, maxX: 11, maxY: 24 });
  const c = crop(img, boundingBox(img));
  assert.equal(c.width, 7);
  assert.equal(c.height, 17);
  assert.equal(alphaAt(c, 0, 0), 255);
});

test('resizeArea averages color weighted by alpha and keeps transparency', () => {
  const img = makeImage(4, 4, (x) => (x < 2 ? [200, 0, 0] : null));
  const small = resizeArea(img, 2, 2);
  assert.deepEqual([...small.data.slice(0, 4)], [200, 0, 0, 255]); // left half red
  assert.equal(alphaAt(small, 1, 0), 0); // right half empty
  const half = resizeArea(makeImage(2, 1, (x) => (x === 0 ? [100, 100, 100] : null)), 1, 1);
  assert.equal(half.data[3], 128); // half covered
  assert.deepEqual([...half.data.slice(0, 3)], [100, 100, 100]); // color not dimmed by the empty half
});

test('quantize reduces many colors to k and maps each input to its nearest', () => {
  const colors = [[250, 0, 0], [240, 10, 5], [0, 0, 250], [10, 5, 240], [0, 250, 0]];
  const { palette, map } = quantize(colors, 3);
  assert.equal(palette.length, 3);
  assert.equal(map[0], map[1]);
  assert.equal(map[2], map[3]);
  assert.notEqual(map[0], map[2]);
  assert.notEqual(map[4], map[0]);
  const red = palette[map[0]];
  assert.ok(red[0] > 200 && red[2] < 40);
  assert.equal(quantize([[1, 2, 3]], 8).palette.length, 1, 'never more colors than inputs');
});

// a vase: wide body, narrow neck, as a silhouette (rows top to bottom)
const VASE_W = 60;
const VASE_H = 100;
const vase = makeImage(VASE_W, VASE_H, (x, y) => {
  const r = y < 40 ? 6 : 24; // neck above, body below
  return Math.abs(x - 29.5) <= r ? (y < 40 ? [180, 140, 60] : [30, 90, 200]) : null;
});

test('latheShell revolves a silhouette into a hollow shell with the right proportions', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  assert.equal(obj.size[1], 20);
  assert.equal(obj.size[0] % 2, 1, 'odd width: the axis sits on a voxel column');
  assert.equal(obj.size[0], obj.size[2]);
  const cx = (obj.size[0] - 1) / 2;
  const widthAt = (y) => { // extent of the shell on this layer (it is hollow, so no counting)
    const xs = [...Array(obj.size[0]).keys()].filter((x) => obj.get(x, y, cx));
    return xs[xs.length - 1] - xs[0] + 1;
  };
  assert.ok(widthAt(2) > widthAt(17) * 2, 'body is much wider than the neck');
  assert.ok(obj.get(cx, 0, cx), 'closed bottom');
  assert.equal(obj.get(cx, 8, cx), 0, 'hollow inside the body');
  assert.ok(obj.get(0, 5, cx) || obj.get(1, 5, cx), 'wall at the outside of the body');
});

test('latheShell is symmetric around the axis and colors follow the picture', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const n = obj.size[0];
  const cx = (n - 1) / 2;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < n; x++) {
      assert.equal(Boolean(obj.get(x, y, cx)), Boolean(obj.get(n - 1 - x, y, cx)), `mirror x at y=${y}`);
      assert.equal(Boolean(obj.get(x, y, cx)), Boolean(obj.get(cx, y, x)), `rotated at y=${y}`);
    }
  }
  const firstWall = (y) => obj.palette[[...Array(n).keys()].map((x) => obj.get(x, y, cx)).find(Boolean)];
  const body = firstWall(3);
  const neck = firstWall(17);
  assert.ok(body[2] > body[0], 'body is blue');
  assert.ok(neck[0] > neck[2], 'neck is bronze');
});

test('latheShell can cut the top off (a stopper) before voxelizing', () => {
  const full = latheShell(vase, { height: 20, colors: 4 });
  const cut = latheShell(vase, { height: 12, colors: 4, cropTop: 0.4 });
  assert.equal(cut.obj.size[1], 12);
  assert.ok(cut.obj.size[0] > full.obj.size[0] - 2, 'the cut part was the narrow neck, so the width stays about the same');
});

test('stretch makes the shell taller without making it wider', () => {
  const plain = latheShell(vase, { height: 20, colors: 4 }).obj;
  const tall = latheShell(vase, { height: 20, colors: 4, stretch: 1.2 }).obj;
  assert.equal(tall.size[1], 24);
  assert.equal(tall.size[0], plain.size[0]);
  assert.equal(tall.size[2], plain.size[2]);
});

test('writeVox round-trips through the parser, including the axis conversion', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const back = parseVox(writeVox(obj));
  assert.deepEqual(back.size, obj.size);
  for (let i = 0; i < obj.data.length; i++) {
    assert.equal(back.data[i], obj.data[i], `voxel ${i}`);
  }
  for (let i = 1; i < obj.palette.length; i++) assert.deepEqual(back.palette[i], obj.palette[i]);
});

const filled = (o) => o.data.filter(Boolean).length;
const LIQUID_COLOR = [215, 225, 235];

test('splitGlass puts the bluish voxels into the glass and the rest (bronze) into the metal', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const { metal, glass } = splitGlass(obj);
  assert.equal(filled(metal) + filled(glass), filled(obj), 'every voxel is in exactly one part');
  const cx = (obj.size[0] - 1) / 2;
  const firstWall = (o, y) => [...Array(o.size[0]).keys()].map((x) => o.get(x, y, cx)).find(Boolean);
  assert.ok(firstWall(glass, 3), 'the blue body is glass');
  assert.ok(!firstWall(metal, 3), 'and not metal');
  assert.ok(firstWall(metal, 17), 'the bronze neck is metal');
  assert.ok(!firstWall(glass, 17));
  for (let i = 0; i < obj.data.length; i++) assert.ok(!(metal.data[i] && glass.data[i]), 'no voxel in both');
});

test('liquidModel fills the inside of the shell from the bottom, never the wall', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const top = fillLayers(obj);
  assert.equal(top, Math.max(...bodyLayers(obj)));
  assert.equal(filled(liquidModel(obj, 0)), 0);
  const half = liquidModel(obj, 0.5);
  const full = liquidModel(obj, 1);
  assert.ok(filled(half) > 0 && filled(full) > filled(half) * 1.5);
  // inside the shell only: never on a wall voxel, never above the body, never in the closed base
  for (let z = 0; z < obj.size[2]; z++) {
    for (let y = 0; y < obj.size[1]; y++) {
      for (let x = 0; x < obj.size[0]; x++) {
        if (!full.get(x, y, z)) continue;
        assert.equal(obj.get(x, y, z), 0, 'not on the wall');
        assert.ok(y >= 1 && y <= top, `level ${y}`);
      }
    }
  }
  // it fills from the bottom: whatever the half level holds, the full level holds too
  for (let i = 0; i < half.data.length; i++) if (half.data[i]) assert.ok(full.data[i]);
  assert.deepEqual(full.palette[1], LIQUID_COLOR);
});

test('the liquid is enclosed by the shell on every side of its layer', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const full = liquidModel(obj, 1);
  const wallBeside = (x, y, z, dx, dz) => {
    for (let k = 1; k < obj.size[0]; k++) if (obj.get(x + dx * k, y, z + dz * k)) return true;
    return false;
  };
  for (let z = 0; z < obj.size[2]; z++) {
    for (let y = 1; y < obj.size[1]; y++) {
      for (let x = 0; x < obj.size[0]; x++) {
        if (!full.get(x, y, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(wallBeside(x, y, z, dx, dz));
      }
    }
  }
});

test('toolSpecFromModel derives the collision box and grab size from the voxel model', () => {
  const { obj } = latheShell(vase, { height: 20, colors: 4 });
  const spec = toolSpecFromModel(obj, 0.01);
  assert.ok(Math.abs(spec.half.y - 0.1) < 1e-9);
  assert.ok(Math.abs(spec.half.x - (obj.size[0] * 0.01) / 2) < 1e-9);
  assert.equal(spec.axisHalf, spec.half.y);
  assert.ok(spec.grabRadius >= 0.03);
  assert.ok(spec.radius <= spec.half.x);
});
