// One shared palette for the whole game. Index = palette index used in VoxelObject.
export const P = {
  GLASS: 1,
  GLASS_EMPTY: 2,
  MERCURY: 3,
  LEAD_COLD: 4,
  LEAD_WARM: 5,
  LEAD_HOT: 6,
  LEAD_CRIT: 7,
  AMALGAM_GOOD: 8,
  AMALGAM_POOR: 9,
  SLUDGE: 10,
  BURNT: 11,
  CRUCIBLE: 12,
  BRONZE: 13,
  FLAME_A: 14,
  FLAME_B: 15,
  WAX: 16,
  MATCH_WOOD: 17,
  MATCH_HEAD: 18,
  BOX: 19,
  STRIKER: 20,
};

const COLORS = {
  GLASS: [150, 190, 205],
  GLASS_EMPTY: [60, 80, 90],
  MERCURY: [215, 225, 235],
  LEAD_COLD: [70, 80, 100],
  LEAD_WARM: [150, 70, 60],
  LEAD_HOT: [230, 120, 40],
  LEAD_CRIT: [255, 225, 120],
  AMALGAM_GOOD: [225, 200, 110],
  AMALGAM_POOR: [135, 130, 105],
  SLUDGE: [110, 130, 150],
  BURNT: [30, 30, 30],
  CRUCIBLE: [110, 85, 75],
  BRONZE: [150, 110, 50],
  FLAME_A: [255, 140, 30],
  FLAME_B: [255, 220, 80],
  WAX: [235, 225, 200],
  MATCH_WOOD: [190, 150, 90],
  MATCH_HEAD: [190, 40, 40],
  BOX: [60, 90, 160],
  STRIKER: [90, 60, 50],
};

export const PALETTE = [[0, 0, 0]];
for (const [name, index] of Object.entries(P)) PALETTE[index] = COLORS[name];
