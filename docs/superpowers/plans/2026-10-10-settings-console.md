# Settings Console (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Build stage 1 of the settings console: dark/light lever, three background push buttons, restart cord, pockets in the table, mouse fallback, persisted settings.

**Architecture:** Pure state (`settings.js`) and pure geometry/cord logic (`game/console.js`) are test-first. `view/console.js` draws controls, lamp and cord; `runtime/console.js` turns taps, pinches and mouse clicks into `settings.set` / `runner.reset()`. `scene.js` gets the pocketed table top, `setTheme`, `setBackground`.

**Tech Stack:** three.js, Vite, node:test, puppeteer smoke test.

**Spec:** `docs/superpowers/specs/2026-10-10-settings-console-design.md`

## Global Constraints
- Every number lives in `src/config/` (new `console.js`; `VIEW.themes`, `VIEW.backgrounds`); configs are deep-frozen.
- Only tracked hands operate the console by touch; controllers do not. Mouse clicks do on the desktop.
- Settings stored as one JSON under `alchemist.settings`, localStorage wrapped in try/catch.
- Run `npm test` and `npm run smoke` before pushing.
- Deviation from spec: pocket depth is 3 voxels (2.25 cm), not 1.5 cm, so a button pushed in 2 voxels still has a body.

## Review Focus
- Broken/partly invalid stored settings keep valid keys, default the rest (settings test).
- Blocked localStorage does not throw (settings test).
- Cord fires once per pull, not every frame while held at 1 (cord test).
- A tap between two controls hits nothing (hit-test test).
- Controls never overlap each other or leave the table (layout test).

## Tasks
1. **Config + settings** (`src/config/console.js`, `src/config/index.js`, `src/settings.js`, `test/settings.test.js`): write failing tests, implement, commit.
2. **Pure console logic** (`src/game/console.js`, `test/console.test.js`): `controls()`, `hitControl(x, z)`, `pockets()`, `createCord()`; tests first, commit.
3. **Look** (`src/config/view.js`, `src/view/scene.js`, `src/view/hud.js`, `src/view/console.js`): themes, backgrounds, pocketed table, control meshes, lamp, cord.
4. **Runtime** (`src/runtime/console.js`, `src/runtime/hands.js`, `src/main.js`, `src/testhook.js`): taps, pinch on bead, mouse, `nearThing`, wiring.
5. **Smoke + docs** (`test/smoke.mjs`, `CLAUDE.md`): click lever/button, drag cord, reload keeps choices; update notes; `npm test`, `npm run smoke`; commit.
