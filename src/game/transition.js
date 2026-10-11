// The change between two experiments, pure: fade to black, a title card in the dark, fade in again.
// phases: 'idle' -> 'out' (darkening) -> 'card' (black, the card shows) -> 'in' (brightening) -> 'idle'.
const ease = (k) => k * k * (3 - 2 * k);

export const createTransition = () => ({ phase: 'idle', t: 0, startEvent: false });

// start it; `startDark`: begin already black with the card (the start of the game)
export function beginTransition(tr, { startDark = false } = {}) {
  tr.phase = startDark ? 'card' : 'out';
  tr.t = 0;
  tr.startEvent = startDark;
}

export const cancelTransition = (tr) => {
  tr.phase = 'idle';
  tr.t = 0;
  tr.startEvent = false;
};

// Advance by dt seconds. Returns { dark (0..1: how black the picture is), card (0..1: how visible the card is),
// swap (true once, when the picture is fully black: change the scene now), cardStart (true once, the card appears) }.
// cfg: { out, card, in, cardFade } seconds.
export function stepTransition(tr, dt, cfg) {
  const f = { dark: 0, card: 0, swap: false, cardStart: false };
  if (tr.phase === 'idle') return f;
  tr.t += dt;
  if (tr.phase === 'out' && tr.t >= cfg.out) {
    tr.t -= cfg.out;
    tr.phase = 'card';
    f.swap = true;
    f.cardStart = true;
  }
  if (tr.startEvent) {
    f.cardStart = true;
    tr.startEvent = false;
  }
  if (tr.phase === 'card' && tr.t >= cfg.card) {
    tr.t -= cfg.card;
    tr.phase = 'in';
  }
  if (tr.phase === 'in' && tr.t >= cfg.in) {
    cancelTransition(tr);
    return f;
  }
  if (tr.phase === 'out') f.dark = ease(tr.t / cfg.out);
  else if (tr.phase === 'card') {
    f.dark = 1;
    f.card = Math.max(0, Math.min(1, tr.t / cfg.cardFade, (cfg.card - tr.t) / cfg.cardFade));
  } else f.dark = 1 - ease(tr.t / cfg.in);
  return f;
}
