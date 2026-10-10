// How things look: colors, sizes of the rings and effects, the glass, the status panel.
export const VIEW = {
  background: 0x202428,
  flameFps: 8, // flame frames per second of the candle
  floorGrid: { size: 4, divisions: 40, colorA: 0x555555, colorB: 0x333333 },
  table: { top: 0xd5d8dc, side: 0x8c8f94, thickness: 0.04, leg: 0.06, legInset: 0.08 },
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
  panel: { canvasWidth: 1024, canvasHeight: 320, font: '26px monospace', lineHeight: 44, background: '#101418', text: '#dde3ea' },
};
