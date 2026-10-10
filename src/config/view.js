// How things look: colors, sizes of the rings and effects, the glass, the status panel.
export const VIEW = {
  flameFps: 8, // flame frames per second of the candle
  floorGrid: { size: 4, divisions: 40 },
  table: { thickness: 0.04, leg: 0.06, legInset: 0.08 },
  // the two looks; voxel models are unlit and keep their colors. `page` and `pageText` are the desktop page's own
  themes: {
    dark: { grid: [0x555555, 0x333333], tableTop: 0xd5d8dc, tableSide: 0x8c8f94, panelBackground: '#101418', panelText: '#dde3ea', page: '#222', pageText: '#ccc' },
    light: { grid: [0x999999, 0xbbbbbb], tableTop: 0xf1f2f4, tableSide: 0xb4b7bc, panelBackground: '#eef1f4', panelText: '#1c2126', page: '#e6e8eb', pageText: '#222' },
  },
  // the placeholder backgrounds: the ground and the sky per theme (scenery models come later)
  backgrounds: {
    lab: { dark: { ground: 0x2b2f35, sky: 0x202428 }, light: { ground: 0xc9c2b4, sky: 0xe3ddd0 } },
    bench: { dark: { ground: 0x3a2f26, sky: 0x2a2018 }, light: { ground: 0xc7a77c, sky: 0xe6d3b2 } },
    stable: { dark: { ground: 0x3b3a22, sky: 0x1f2418 }, light: { ground: 0xd2c27a, sky: 0xbfd6a6 } },
  },
  groundSize: 30, // m, the big plane under the grid
  camera: { fov: 50, offset: { x: 0.1, y: 0.35, z: 0.5 }, target: { x: 0, y: 0.08, z: 0.03 } }, // desktop view, from the world origin
  glass: { opacity: 0.38 }, // the vial's see-through part
  drops: { hg: 0xd7e1eb, sulfur: 0xebd73c, grain: 0.006 },
  puddles: { hg: 0xaebac6, sulfur: 0xd9c63a, max: 3000, thin: 0.002, thick: 0.006 }, // thickness in m, by amount
  // rings around the crucible mouth: the dose gauge and the hold progress
  rings: {
    gauge: { inner: 0.052, outer: 0.056, back: 0x3a3f45, fill: 0xe8eef5 },
    window: { inner: 0.05, outer: 0.058, color: 0x4caf50 },
    hold: { inner: 0.038, outer: 0.044, good: 0x4caf50, bad: 0xe53935 },
    steps: 90, // resolution of the progress arcs
  },
  panel: { canvasWidth: 1024, canvasHeight: 320, font: '26px monospace', lineHeight: 44 },
};
