// The settings console: a lever, three push buttons and a pull cord, set into the table along its right edge.
// Meters, world-local (the origin is on the table top). `x` values are measured inward from the table's right edge.
export const CONSOLE = {
  storageKey: 'alchemist.settings',
  pocket: { voxels: 3 }, // depth of the pockets in the table top, in voxels
  push: { voxels: 2 }, // how far a selected button stands lower than the table top
  lever: { inset: 0.12, z: 0.2, w: 0.12, d: 0.06, tiltDeg: 25, handle: { w: 0.012, h: 0.035 } },
  buttons: { inset: 0.12, pitch: 0.08, z: 0.1, size: 0.06, names: ['lab', 'bench', 'stable'] },
  tapMargin: 0.01, // a fingertip this close outside a control still counts as over it
  cord: { inset: 0.2, z: 0.1, lampY: 1.35, beadY: 0.45, pull: 0.15, grabRadius: 0.05, springTime: 0.2, segment: 0.0075, bead: 0.03 },
  colors: {
    pocketFloor: 0x3b3f45,
    buttonDim: 0x6a6f76,
    buttonLit: 0xffc94a,
    lever: 0xb8bcc2,
    leverBase: 0x4a4e55,
    icon: 0x15171a,
    lamp: 0xffe27a,
    socket: 0x555555,
    cordWhite: 0xeeeeee,
    cordRed: 0xe53935,
    bead: 0xd9d2c0,
  },
  // pictograms, 7 x 7, '#' = a voxel; row 0 is the back (far from the player)
  icons: {
    moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##..#.', '..###..'],
    sun: ['#..#..#', '.#####.', '..###..', '###.###', '..###..', '.#####.', '#..#..#'],
    lab: ['..###..', '...#...', '...#...', '..###..', '.#####.', '.#####.', '..###..'],
    bench: ['#######', '#######', '..###..', '...#...', '...#...', '..###..', '.#####.'],
    stable: ['.#...#.', '##...##', '#.....#', '#.....#', '##...##', '.#####.', '..###..'],
  },
};
