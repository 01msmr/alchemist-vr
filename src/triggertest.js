// The trigger test (open the game with ?trigger): per hand, the raw trigger and grip value as a bar, a short history
// and what the hardware does with it: how many different values it gave, the largest jump between two readings.
// A trigger that is really analog gives many values and small jumps; an on/off one gives 2 and a jump of 1.
const SHADES = ' .:-=+*#%@';

export function createTriggerLog(history = 36) {
  const channels = new Map();

  function record(name, value) {
    let c = channels.get(name);
    if (!c) channels.set(name, (c = { last: null, min: 1, max: 0, seen: new Set(), maxStep: 0, trail: [] }));
    if (c.last !== null && value !== c.last) c.maxStep = Math.max(c.maxStep, Math.abs(value - c.last));
    c.last = value;
    c.min = Math.min(c.min, value);
    c.max = Math.max(c.max, value);
    c.seen.add(Math.round(value * 1000));
    c.trail.push(value);
    if (c.trail.length > history) c.trail.shift();
  }

  function line(name, label) {
    const c = channels.get(name);
    if (!c) return `${label} -`;
    const bar = '#'.repeat(Math.round(c.last * 10)).padEnd(10, '-');
    const trail = c.trail.map((v) => SHADES[Math.min(SHADES.length - 1, Math.floor(v * SHADES.length))]).join('');
    return `${label} ${c.last.toFixed(2)} [${bar}] ${trail}`;
  }

  function summary(name, label) {
    const c = channels.get(name);
    if (!c) return '';
    return `${label} n${c.seen.size} ${c.min.toFixed(2)}-${c.max.toFixed(2)} jump${c.maxStep.toFixed(2)}${c.seen.size <= 3 ? ' ON/OFF?' : ''}`; // n = different values seen
  }

  return {
    record,
    line,
    summary,
    reset: () => channels.clear(),

    // the panel lines for the hands (mode, gamepad); also records this frame's values
    lines(hands) {
      const out = []; // the panel holds 7 lines: 3 per hand and its reset line
      hands.forEach((hand, i) => {
        const side = (hand.handedness?.[0] ?? String(i)).toUpperCase();
        const pad = hand.gamepad;
        if (!pad) {
          out.push(`${side}: no controller (${hand.mode})`);
          return;
        }
        const [trigger, grip] = [pad.buttons[0], pad.buttons[1]];
        record(`${i}:trigger`, trigger?.value ?? 0);
        record(`${i}:grip`, grip?.value ?? 0);
        out.push(this.line(`${i}:trigger`, `${side} trigger`), this.line(`${i}:grip`, `${side} grip   `), `${this.summary(`${i}:trigger`, 'trig')} | ${this.summary(`${i}:grip`, 'grip')}`);
      });
      return out;
    },
  };
}
