import { HANDTOOLS } from './config/index.js';

// What a hand tool may do (pure). A hand with no tool (null) can do nothing.
export const canDo = (tool, action) => HANDTOOLS[tool]?.can.includes(action) ?? false;
