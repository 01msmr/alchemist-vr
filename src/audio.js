import { HAZARD } from './config/index.js';

// A tiny synthesizer for the warning sounds (no sound files): crackles while it goes wrong, a hiss when it fails (no thud).
// The browser only starts sound after a click or the start of the VR session; until then everything here is silent.
export function createAudio(renderer) {
  const S = HAZARD.sound;
  let ctx = null;
  let noise = null;

  function ensure() {
    if (ctx) return ctx;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    ctx = new Context();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // a second of white noise
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const wake = () => {
    const c = ensure();
    if (c?.state === 'suspended') c.resume().catch(() => {});
  };
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);
  renderer.xr.addEventListener('sessionstart', wake);

  // noise through a filter with a volume envelope: [start, end] of the filter's frequency, seconds, peak gain
  function burst({ filter = 'highpass', from, to, seconds, gain }) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(from, now);
    f.frequency.exponentialRampToValueAtTime(to, now + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + Math.min(0.01, seconds / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(f).connect(g).connect(ctx.destination);
    source.start(now, Math.random() * 0.8);
    source.stop(now + seconds + 0.02);
  }

  return {
    // one short crackle, louder the more it is going wrong
    crackle(level) {
      burst({ from: 2200 + Math.random() * 3000, to: 1200, seconds: 0.025 + Math.random() * 0.04, gain: S.gain * (0.4 + 0.6 * level) * (0.5 + Math.random() * 0.5) });
    },
    // a failure: a long hiss that sinks (steam on hot metal)
    hiss() {
      burst({ filter: 'bandpass', from: 5000, to: 700, seconds: S.hissSeconds, gain: S.hissGain });
    },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
}
