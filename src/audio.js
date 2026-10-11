import { HAZARD } from './config/index.js';

// A tiny synthesizer for the warning sounds (no sound files): crackles while it goes wrong, a hiss when it fails (no thud).
// The browser only starts sound after a click or the start of the VR session; until then everything here is silent.
export function createAudio(renderer) {
  const S = HAZARD.sound;
  const X = HAZARD.sounds;
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

  // a soft bell note: a sine with a quieter octave above it, ringing out
  function bell(freq, start, seconds, gain) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + start;
    for (const [mul, level] of [[1, 1], [2, 0.3], [3.01, 0.1]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain * level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + seconds + 0.05);
    }
  }

  // the pour: a loop of noise through a band filter that wobbles (running liquid), its volume follows the flow
  let pourGain = null;
  function pourNodes() {
    if (pourGain || !ctx) return pourGain;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = X.pourFreq;
    filter.Q.value = 1.4;
    const wobble = ctx.createOscillator(); // the surface of a stream is never still
    wobble.frequency.value = 9;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = X.pourFreq * 0.35;
    wobble.connect(wobbleDepth).connect(filter.frequency);
    pourGain = ctx.createGain();
    pourGain.gain.value = 0;
    source.connect(filter).connect(pourGain).connect(ctx.destination);
    source.start();
    wobble.start();
    return pourGain;
  }

  return {
    // the match scratches over the striker
    strike() {
      burst({ filter: 'bandpass', from: 3500, to: 1000, seconds: 0.22, gain: X.strikeGain });
    },
    // the candle catches fire: a soft whoosh
    flame() {
      burst({ filter: 'lowpass', from: 300, to: 1800, seconds: 0.5, gain: X.flameGain });
    },
    // the flow of the pour 0..1 (call every frame; silent at 0)
    setPour(flow) {
      if (!ctx || ctx.state !== 'running') return;
      const gain = pourNodes();
      gain?.gain.setTargetAtTime(flow > 0.01 ? X.pourGain * (0.3 + 0.7 * Math.min(1, flow)) : 0, ctx.currentTime, 0.08);
    },
    // an experiment is done (a short rising chime) or the whole game (a longer one, with the high note ringing on)
    chime(big = false) {
      X.chimeNotes.slice(0, big ? X.chimeNotes.length : 3).forEach((freq, i) => bell(freq, i * X.chimeGap, big ? 2.4 : 1.2, X.chimeGain));
      if (big) bell(X.chimeNotes.at(-1) * 2, X.chimeNotes.length * X.chimeGap, 3.2, X.chimeGain * 0.7);
    },

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
