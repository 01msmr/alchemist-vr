// Warning signs of a wrong development (too hot, too long hot, not stirred) and what the player sees, feels and hears of a failure.
// `level` is the hazard 0..1 from game/hazard.js: 0 = all well, 1 = it is going wrong right now.
export const HAZARD = {
  warnFrom: 0.25, // sparks, smoke and a crackle begin here
  iconFrom: 0.6, // the warning symbol over the crucible appears here
  failureSeconds: 5, // the failure symbol and the smoke stay this long
  sparks: { speed: 0.35, life: 0.7, size: 2, color: 0xffa23c }, // rise from the crucible mouth; size in voxels
  smoke: { rise: 0.2, life: 1.7, size: 3, grey: 0x8a8d90, black: 0x1c1c1e, perSecondMax: 22 },
  burst: { count: 26 }, // smoke puffs at the moment of a failure
  maxParticles: 90,
  icon: { size: 0.075, height: 0.14, bob: 0.01, warn: '#ffb04a', stir: '#ffe08a', fail: '#f2ede0', rim: '#1a0c06' },
  hint: { size: 0.06, bob: 0.008, color: '#f7f1dc', rim: '#1a0c06', fade: 3 }, // the symbol for the next step (fade: how fast it appears and goes, 1/s)
  haptic: { gapSlow: 0.5, gapFast: 0.12, strengthLow: 0.15, strengthHigh: 0.7, ms: 30, failTicks: 3, failGap: 0.07, failStrength: 0.4 }, // seconds between pulses, then their strength
  sound: { crackleMin: 3, crackleMax: 30, gain: 0.16, hissSeconds: 1.2, hissGain: 0.2 }, // crackles per second; a hiss when it fails (no thud)
};
