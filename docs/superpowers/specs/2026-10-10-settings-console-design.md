# Settings console — design

Status: draft for review (2026-10-10). Decided by Uli in conversation; not built.

## Goal

Let the player change a few settings inside the game, in the world, with the tracked hand: dark or light look, the
background scene, later the difficulty, and restart the level. The controls are objects in the alchemist's lab (switches
set into the table, a light bulb with a pull cord), not a menu. Success: the player taps a switch with the index finger
and the scene changes; pulls the cord and the level restarts; the choices are still there after a reload.

## Scope

**Stage 1 (this spec, to be built first):** settings state, dark/light lever, three background push buttons, restart cord,
the pockets in the table, desktop (mouse) fallback.
**Stage 2 (outlined, specified when stage 1 is in):** difficulty rotary switch and what each level changes.
**Stage 3 (outlined only):** the shelf for objects (spare vials; later choosing objects).
Out of scope: scenery models for the backgrounds (stage 1 changes colors only), sound, controllers as input for the console
(tracked hands and the mouse operate it; controllers do not, like the table calibration).

## Layout

Everything is in world-local coordinates of the table (origin on the table top, x right, z toward the player), in
`src/config/console.js` (new, one file per domain, nothing hard-coded in modules).

The group stands along the table's **right edge**: one **row per setting**, the **options of a row side by side**
toward the table's middle. Rows run front to back (decreasing z). There is no plate: every control sits in its **own
pocket** cut into the table top (a pocket is a rectangle of whole voxels, 1.5 cm deep, with a dark wall).

| row | control | pockets | where (local) |
|---|---|---|---|
| 1 | dark/light lever | one, 8 x 5 cm | x = maxX - 0.12, z = 0.20 |
| 2 | background buttons: lab, workbench, stable | three, 6 x 6 cm, 2 cm apart | x = maxX - 0.12 - 0.08 i (i = 0..2), z = 0.10 |
| 3 | difficulty rotary switch (stage 2) | one, round, 8 cm | x = maxX - 0.12, z = 0.00 |

The numbers are a first guess to tune with the tracked hand; they must keep the controls clear of the matchbox, the vial's
rest place and the dish (`nearThing` knows the controls, see Interaction).

The **restart cord** hangs above the right end of the group: a light bulb at 1.35 m above the table top (x = maxX - 0.20,
z = 0.10), a cord down to a grip bead 0.45 m above the table top. The ceiling itself is not drawn (the cord and the
lamp end in the dark above).

Known cost, accepted by Uli: the right edge of a 2 m table is about 1 m from the middle of the table, out of arm's reach
when standing there. The player has to step to the right.

## Interaction

All input comes through the hand fields that `vr.js` already fills (`indexPoint`, `pinchOn`, `held`, `mode`). Only
tracked hands operate the console.

- **Tap (lever, buttons):** a single tap of the index finger on the table at the control's footprint, detected with the
  existing `createTapCounter` (count 1). The real table is the feel under the finger, the pocket is only drawn. A tap
  counts when the hand is tracked, holds nothing, the fingertip is within `INPUT.calibration.band` of the table top and
  the tap's place (the fingertip's x, z at its lowest point) lies inside a control's footprint.
- **Lever:** a tap flips it. Left = dark, right = light; the lever tilts sideways about 25 degrees, a small moon and sun icon on
  either side.
- **Push buttons:** a tap selects that background. The selected button is **pushed in** (its top 2 voxels lower) and
  **lit**, the others stand at the table level and are dim. Exactly one is selected.
- **Cord:** a pinch near the grip bead takes it. While pinched, the bead follows the fingertip's downward movement
  (clamped to 0..`pull` = 0.15 m). **Progress = pulled / pull** (0..1). The cord turns **red from the top down**: the part
  of the cord above `progress` of its length is red, the rest stays white. At progress 1 the level restarts
  (`ctx.runner.reset()`), once; the cord then returns up. If the pinch is let go earlier, the bead springs back
  up and the red recedes (exponential, about 0.2 s). The pinch on the status panel keeps working as before.
- **Calibration:** the control footprints (and the cord bead's zone) are included in `nearThing`, so a tap on a control
  never counts toward the table calibration, and calibration taps never reach a control.
- **Mouse (desktop):** a click on a lever or button does the same; dragging the bead down pulls the cord. Raycast on the
  controls' meshes, like the existing tool picking.

## Settings state (pure, tested)

`src/settings.js`: `createSettings(storage)` with `{ theme: 'dark' | 'light', background: 'lab' | 'bench' | 'stable',
difficulty: 'easy' | 'normal' | 'hard' }`, defaults dark, lab, normal. `get()`, `set(key, value)` (validates, refuses
unknown values, returns whether it changed), `subscribe(listener)`. Stored as one JSON value under
`alchemist.settings` in `localStorage` (wrapped in try/catch like the table calibration, empty when blocked). Loading a
broken or partly invalid value keeps the valid keys and takes defaults for the rest.

## Look

- **Theme:** `config/view.js` gets two color sets under `VIEW.themes` (scene background, floor grid, table top and side, the
  status panel's background and text) and the page's own background and text for the desktop help lines.
  `view.setTheme(name)` applies them; voxel models are unlit and keep their colors.
- **Background:** `VIEW.backgrounds.{lab, bench, stable}` each give a floor color and a backdrop (sky) color per theme,
  applied by `view.setBackground(name)`: a large ground plane under the grid and the scene background. Placeholder
  scenery (a shelf with bottles, a tool wall, hay) comes later and is a separate piece of art.
- **Icons:** pictograms in `config/console.js` as small ASCII bitmaps (about 7 x 7 voxels): a retort for the lab, an anvil
  for the workbench, a horseshoe for the stable; a moon and a sun for the lever. Drawn as voxels on the buttons' tops.
- **Pockets:** the table top becomes a mesh with rectangular holes (an extruded shape, 1.5 cm deep, wall in the table's side
  color) on top of a flat lower slab. The physics table stays a flat slab at the table top: the pockets are only drawn.
  The control inside a pocket is a voxel model whose top is at the table level when idle.
- **Cord and lamp:** the lamp is a small voxel bulb (warm yellow) with a socket; the cord is a column of one-voxel
  segments (about 0.75 cm each) colored white or red by progress; the bead is a larger voxel ball.

## Modules

- `src/config/console.js` (new): positions, sizes, pull length, colors, icon bitmaps.
- `src/settings.js` (new, pure): the state above.
- `src/game/console.js` (new, pure): the footprints (hit test: a point and the control it lies in or null), the cord
  progress and spring-back (`pullProgress`, `stepCord`), pocket rectangles for the table mesh.
- `src/view/console.js` (new): builds the control meshes, the lamp and cord; `update(settings, cordProgress)` draws the pushed
  in and lit states and the cord's colors.
- `src/runtime/console.js` (new): taps (per hand, `createTapCounter`), pinch on the bead, the mouse, calls `settings.set` and
  `ctx.runner.reset()`.
- `src/view/scene.js` (change): table top with pockets, `setTheme`, `setBackground`.
- `src/runtime/hands.js` (change): `nearThing` includes the console's zones.
- `src/main.js` (change): creates settings and console, applies the stored look at start.
- `test/*.test.js` for the pure parts; `test/smoke.mjs` clicks the controls with the mouse.

## Testing

Pure logic test-first: settings (defaults, validation, persistence round trip, blocked storage, a partly broken value,
subscribers), footprints (a point on a control, between controls, outside), the cord (progress from pull, clamping,
fires once at 1, springs back, red part of the cord for a progress), the pocket rectangles (inside the table, not
overlapping, whole voxels). Smoke test (headless, mouse): a click on the lever changes the theme, a click on a button the
background and the pressed-in state, dragging the cord down restarts the level, a reload keeps the choices, no console
errors. Real hands are not covered (as for the rest of the hand input).

## Unverified, to check on the headset

- That one tap on the real table at a virtual button is reliable with hand tracking (the tap thresholds `drop` 2 cm,
  `lift` 1.5 cm are unverified even for the calibration), and that the controls are big enough (6 cm, 2 cm apart).
- That the pocket's look reads well when the real table is flat; whether the pushed-in button is clearly visible.
- That the cord is easy to grab (pinch near the bead, the reach of `INPUT.reach`) and that 15 cm of pull is comfortable.
- Draw calls and frame time with the pockets, the cord's segments and the lamp (not measured on a Quest).
- That the light theme is readable in the headset (bright backgrounds).

## Later stages (not specified here)

- **Difficulty (stage 2):** a rotary switch, pinched and turned with the wrist (roll about the vertical), snapping to three
  positions: left 45 degrees = easy, up = normal, right 45 degrees = hard. Per level one row of numbers applied through the
  config, from Uli's wishes: how easily a tool is gripped (`INPUT.gripStrengthFloor`, `TOOLS.*.grabRadius`), how easily
  the vial breaks (`TOOLS.vial.breakSpeed`, `TOOLS.vial.crush`) and how narrow its footprint is (its physics box).
  The configs are frozen: the levels are read through a small accessor, not mutated.
- **Shelf (stage 3):** places with outlines, a tool snaps in when let go near it; starts with 1 / 0 / 0 spare vials for
  easy / normal / hard (decided later); later also the place to choose objects from.

## Open questions

- None for stage 1. The numbers in the layout table and the colors are first guesses and live in the config to be tuned.
