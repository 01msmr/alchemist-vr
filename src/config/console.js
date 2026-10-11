// The settings console: rows of tap buttons set into the table along its right edge, and a pull cord with a lamp.
// Meters, world-local (the origin is on the table top). Per row the options lie side by side, the first on the left.
export const CONSOLE = {
  storageKey: 'alchemist.settings',
  pocket: { voxels: 3 }, // depth of the pockets in the table top, in voxels
  push: { voxels: 2 }, // how far a chosen button stands lower than the table top
  // `key` is the setting, `z` the buttons' middle (the first row is nearest to the player); the icon is a Font Awesome name (src/icons.js)
  rows: [
    { key: 'theme', z: 0.14, options: [{ value: 'dark', icon: 'moon' }, { value: 'light', icon: 'sun' }] },
    { key: 'background', z: 0.04, options: [{ value: 'lab', icon: 'flask' }, { value: 'bench', icon: 'hammer' }, { value: 'stable', icon: 'horse' }] },
    { key: 'difficulty', z: -0.06, options: [{ value: 'easy', icon: 'smile' }, { value: 'normal', icon: 'meh' }, { value: 'hard', icon: 'skull' }] },
  ],
  buttons: { sizeVoxels: 4, pitch: 0.06, inset: 0.1, iconSize: 0.05, iconGap: 0.045 }, // the icon picture is this wide (m) and lies this far behind its button's middle
  tapMargin: 0.01, // a fingertip this close outside a button still counts as over it
  cord: { inset: 0.32, z: 0.05, lampY: 1.35, beadY: 0.45, pull: 0.15, push: 0.1, grabRadius: 0.09, springTime: 0.2, segment: 0.0075, bead: 0.04 },
  colors: {
    pocketFloor: 0x3b3f45,
    buttonPassive: 0x1f5a2e, // dark green
    buttonActive: 0x57ff7a, // lit
    icon: '#f3e6c4', // CSS colors of the picture and its dark rim
    iconRim: '#15171a',
    lamp: 0xffe27a,
    socket: 0x555555,
    cordWhite: 0xeeeeee,
    cordRed: 0xe53935, // pulling down: the game starts over
    cordPreset: 0x2e9bd6, // pushing up: the perfect preconditions of the level shown in the book
    bead: 0xd9d2c0,
    beadNear: 0xfff2b0, // the bead lights up when a hand is in reach
  },
};
