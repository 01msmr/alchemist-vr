// When the symbol for the next step shows (pure). It is the same symbol and place as long as the step is the same; the
// difficulty decides how long nothing may happen before it appears (easy: at once, hard: never).
export const createHintTimer = () => ({ key: null, idle: 0 });

export const hintKey = (hint) => (hint ? `${hint.icon}@${hint.at}` : null);

// advance by dt; returns whether the symbol is to be shown now. `delay`: seconds without progress (rules().HINT_DELAY).
// An urgent step (something heats up and waits for the player: the window to act is short) shows after half a second, unless
// the hints are off (a huge delay).
export function stepHintTimer(timer, hint, dt, delay) {
  if (hint?.urgent && delay < 1e8) delay = Math.min(delay, 0.5);
  const key = hintKey(hint);
  if (key !== timer.key) {
    timer.key = key;
    timer.idle = 0;
  } else {
    timer.idle += dt;
  }
  return key !== null && timer.idle >= delay;
}
