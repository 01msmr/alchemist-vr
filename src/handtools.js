import { HANDTOOLS } from './config/index.js';

// What a hand tool may do (pure).
export const canDo = (tool, action) => HANDTOOLS[tool]?.can.includes(action) ?? false;

// the next hand tool in the order, after `current` (the first one if `current` is unknown)
export function nextTool(current, order = HANDTOOLS.order) {
  return order[(order.indexOf(current) + 1) % order.length];
}
