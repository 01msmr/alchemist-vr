// How things look: colors, sizes of the rings and effects, the glass, the status panel.
export const VIEW = {
  flameFps: 8, // flame frames per second of the candle
  floorGrid: { size: 4, divisions: 40 },
  table: { thickness: 0.04, leg: 0.06, legInset: 0.08 },
  // the two looks (`tableTop` tints the oak picture, `tableSide` is the plain dark oak of the edges and legs); voxel models are unlit and keep their colors. `page` and `pageText` are the desktop page's own
  themes: {
    dark: { grid: [0x555555, 0x333333], tableTop: 0x9a8e84, tableSide: 0x4f3a24, panelBackground: '#101418', panelText: '#dde3ea', page: '#222', pageText: '#ccc' },
    light: { grid: [0x999999, 0xbbbbbb], tableTop: 0xffffff, tableSide: 0x7a5a36, panelBackground: '#eef1f4', panelText: '#1c2126', page: '#e6e8eb', pageText: '#222' },
  },
  // the placeholder backgrounds: the ground and the sky per theme (scenery models come later)
  backgrounds: {
    lab: { dark: { ground: 0x2b2f35, sky: 0x202428 }, light: { ground: 0xc9c2b4, sky: 0xe3ddd0 } },
    bench: { dark: { ground: 0x3a2f26, sky: 0x2a2018 }, light: { ground: 0xc7a77c, sky: 0xe6d3b2 } },
    stable: { dark: { ground: 0x3b3a22, sky: 0x1f2418 }, light: { ground: 0xd2c27a, sky: 0xbfd6a6 } },
  },
  groundSize: 30, // m, the big plane under the grid
  camera: { fov: 50, offset: { x: 0.1, y: 0.5, z: 0.65 }, target: { x: 0, y: 0.1, z: -0.12 } }, // desktop view, from the world origin
  glass: { opacity: 0.38 }, // the vial's see-through part
  ghost: { opacity: 0.6, smokeColor: 0x9aa0a6, smokeCubes: 36, smokeHeight: 0.25 },
  drops: { hg: 0xd7e1eb, sulfur: 0xebd73c, herb: 0x46a03c, salt: 0xf5f5fa, grain: 0.006 },
  puddles: { hg: 0xaebac6, sulfur: 0xd9c63a, herb: 0x3f8f36, salt: 0xf5f5fa, max: 3000, thin: 0.002, thick: 0.006 }, // thickness in m, by amount
  // rings around the crucible mouth: the dose gauge and the hold progress
  rings: {
    gauge: { inner: 0.052, outer: 0.056, back: 0x3a3f45, fill: 0xe8eef5 },
    window: { inner: 0.05, outer: 0.058, color: 0x4caf50 },
    hold: { inner: 0.038, outer: 0.044, good: 0x4caf50, bad: 0xe53935 },
    steps: 90, // resolution of the progress arcs
  },
  // the book of instructions: the page picture in pixels, fonts and colors of the old paper, the leather, the thickness
  book: {
    page: { width: 512, height: 716 }, font: '"UnifrakturCook", serif', titlePx: 50, bodyPx: 27, lineHeight: 1.22, margin: 56,
    light: '#eadcb6', dark: '#d0ba88', stain: 'rgba(120,85,40,0.10)', ink: '#2a1a0e', inkSoft: 'rgba(42,26,14,0.16)', note: '#8e1b17',
    cover: 0x4a2c17, fitting: 0xa07a32, ribbon: 0x8e1b17, wax: 0x9b1c16, waxIcon: '#6e0f0c', waxRim: '#c24a40',
    coverThickness: 0.006, margin3d: 0.01, // m: the leather's thickness and how far it reaches past the pages
    block: { base: 0.014, perPage: 0.006 }, // m: the stack of pages on each side, thicker the more pages lie on it
    leafSeconds: 0.7, leafFastSeconds: 0.3, // one page turns in this long (quicker when several are queued)
    sealIcon: 'dragon',
  },
  // the change between experiments: seconds of darkening, of the title card (with its fade in and out), of brightening; the black sphere around the head, the card's distance and size (m)
  transition: { out: 1.0, card: 2.8, in: 1.0, cardFade: 0.6, radius: 0.5, distance: 0.9, cardW: 0.8, cardH: 0.4, ink: '#e8d8a8', inkSoft: 'rgba(232,216,168,0.55)' },
  panel: { canvasWidth: 1024, canvasHeight: 320, font: '26px monospace', lineHeight: 44 },
};
