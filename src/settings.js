// What the player chose, kept in one JSON value in the storage (localStorage; may be missing or blocked).
const OPTIONS = {
  theme: ['dark', 'light'],
  background: ['lab', 'bench', 'stable'],
  difficulty: ['easy', 'normal', 'hard'],
};
const DEFAULTS = { theme: 'dark', background: 'lab', difficulty: 'normal' };

export function createSettings(storage, key) {
  const values = { ...DEFAULTS };
  const listeners = new Set();

  try {
    const stored = JSON.parse(storage?.getItem(key) ?? 'null');
    if (stored && typeof stored === 'object') {
      for (const name of Object.keys(OPTIONS)) if (OPTIONS[name].includes(stored[name])) values[name] = stored[name];
    }
  } catch { /* broken or blocked: the defaults stay */ }

  return {
    get: () => ({ ...values }),

    // returns whether something changed; unknown names and values are refused
    set(name, value) {
      if (!(name in OPTIONS) || !OPTIONS[name].includes(value) || values[name] === value) return false;
      values[name] = value;
      try { storage?.setItem(key, JSON.stringify(values)); } catch { /* blocked: not remembered */ }
      for (const listener of listeners) listener({ ...values }, name);
      return true;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
