# Alchemist Voxel VR – Project Handoff

Game jam entry (theme: **Magic**). A voxel-style alchemist game in **WebXR VR on Meta Quest**, played standing, with controllers, where the virtual table / wall / floor are calibrated onto the real ones.

## Working conventions
- User: Uli, advanced developer, German is the primary language (English is fine for code and docs).
- Direct and concise. No filler, no invented finished game logic. Technology first, game logic only roughly, and advise instead of presenting made-up content.
- Always deliver consolidated full files, not diffs.
- Do not over-research simple questions.
- Do not mark things as certain that were not verified (see "Unverified assumptions").
- Every tunable value lives in `src/config/` (one file per domain: game rules, layout, input, physics, tools, view), never as a literal in a module. Pure logic is test-first (`npm test`); the real game is checked headless with `npm run smoke` (Chromium, scripted mouse, fails on any console error): run both before pushing.

## Core concept
- The player is an alchemist who combines and transforms materials at work surfaces (table, wall, floor).
- Something becomes alive and then moves to the goal by itself (life is the driver, not the goal).
- Gold exists in three states (solid, liquid, gas). Liquids are mixed to produce gas or other effects.
- The player's tools (handles/"sticks") define abilities and precision. Some tools are unlocked during play.
- Build levels individually first. Extract shared code only after ~3 levels (rule of three).

## Platform decisions
- **Engine:** three.js + WebXR (WebGL2), built with Vite. TypeScript optional.
- **Device:** Meta Quest. Target Quest 3, lower bound Quest 2 (same code path, because there is no passthrough).
- **Mode:** `immersive-vr` (NOT AR/passthrough). The world is aligned to the real room by manual calibration.
- **Reference space:** `local-floor`.
- **Input:** hand tracking is the main input (WebXR `hand-tracking`, joints recognised in `src/tracking.js`), controllers are the fallback. Both fill the same hand fields in `src/vr.js` (`updateInput`): pinch (thumb + index fingertip = trigger) and grip (the other fingers = grip button) as analog 0..1, a pinch point, a grasp point, and a grip frame (origin at the palm, -Z along the fingers, +Y toward the thumb side). Game code never asks which one is active. Tracked hands have no haptics and no reset button: pinch the status panel to reset. All joint distances (`PINCH`, `GRIP_CURL`) are unverified on a real Quest; the status panel shows what the game sees per hand.
- **Player stands.** The world has a fixed 1:1 scale, no zoom, no world dragging.
- **Fallback:** a desktop variant with mouse for jurors without a headset (late stage). **Since 2026-10-11 controllers are the main input** (see "Endspurt"); tracked hands are a fallback that is not maintained.
- Test early on itch.io (iframe needs `xr-spatial-tracking` permission), and on the device.

## Real-world anchoring (calibration)
- Three frames: `TableFrame`, `WallFrame`, `FloorFrame`. Each has a matrix (position, rotation, size). Each level hangs on exactly one frame.
- **Floor:** from `local-floor`, only check the height.
- **Table:** 3 points with the controller on the real surface (corner, corner, opposite corner) gives height, rotation, size. *Built so far: the height and the front edge (position and yaw)* (two sets of three index-finger taps at the front edge, see Current state); position, rotation and size are still fixed values in `config/layout.js`.
- **Wall:** 2–3 points with the controller held flat on the wall.
- Fine adjustment per plane with the stick (2–3 cm error is noticeable).
- **Persistence:** store matrices in `localStorage` / IndexedDB. Do not rely on `anchors` in VR. On start, load the stored calibration and ask for ONE check point (controller on a table corner) to compute a correction offset. Offer "recalibrate" if rotation is off. Reason: the `local-floor` origin is not guaranteed identical between sessions.
- Safety: mark the table edge visibly, show a grid when the player approaches real obstacles. When virtual and real surfaces coincide, the player gets free touch haptics.
- Zones are placed **relative** to the calibrated surface size; check minimum sizes and warn.
- Wall and floor work: a floor level may use a pedestal at hip height instead of the real floor (back strain), to be decided.

## Voxel specification
- One uniform voxel size for everything: **1 voxel = 0.75 cm** in the world (`LAYOUT.voxel`; it was 1 cm, changed for more detail at the same size). The code-made models in `assets.js` are described in cm and sampled on the voxel grid, so they keep their size at any voxel size; the vial is `bottle.vox` redrawn at 4/3 the resolution (`npm run relathe-vox`, 9 x 16 -> 12 x 21 voxels, same palette; not idempotent: it scales again on every run).
- Sizes (longest edge, in voxels at 0.75 cm; the old 1 cm numbers x 4/3): drop/coin/grain 3–5; bottle/flask/tool 11–16; frog/cat/ghost 16–25 (target 21); prince/zombie 25–32. Puddle cells follow the voxel grid (`CFG.PUDDLE_CELL`, area per amount kept).
- Table: at least 2 × 1 m (200 × 100 voxels), size is a data value, not a constant.
- Pixel look comes from **geometry**, not from low-res upscaling: flat colors, per-vertex AO from neighbor voxels, MSAA, foveation. No post-processing, no real-time shadows (blob shadows), no transparency except the vial's glass (see-through, drawn after the opaque liquid and metal inside it).
- Game logic does NOT calculate in voxels (fill amounts, drops, weights in own units). Voxels are display only.
- Hand and moving objects have float positions. Only rendering is gridded. Rotation only in 90° steps or re-sampled.
- One shared palette of **24–32 colors** for the whole game.
- Silhouette rules: eyes 1 voxel, features at least 2 voxels wide, 1 voxel margin to the grid, no free rotation inside a model.

## Rendering architecture
- Static scene (table etc.): chunks (e.g. 32 × 32), merged meshes with only visible faces, frustum culling.
- Dynamic objects: per-object mesher (visible faces, vertex color, vertex AO). Moving voxel particles (drops, gas, sparks, morph, decay) as one `InstancedMesh`.
- Active zones: only the area around the hand and vessels is simulated or animated. Everything else sleeps.
- Estimated budget (rough, measure early): about 35k–70k voxels in the scene, Quest 2 target 72–90 Hz, under ~200 draw calls.
- Early stress test: Frog (16) and cat (16) side by side. If not readable, go to 19. That is the single tuning knob.

## Liquids and gas (simplified, decided)
- Vessel has a fill level (number) and a color. Surface = a flat voxel layer or plane with a little sine wave, tilts when the vessel tilts.
- Pouring = a stream of a few drop voxels, the fill moves from vessel A to B.
- Mixing = table lookup: color A + color B gives result (color, gas, effect).
- Gas = rising cube particles, opaque and shrinking. No grid simulation.
- Dosing = fill level with a **target window** (e.g. 40–60 %), shown as a ring on the vessel.

## Interaction model (no physics for the chemistry; rigid bodies only for loose objects, see Current state)
- Tools are "sticks". One tool = one verb. Hold the tip near an object (radius test) and an **hold-progress ring** fills over time, then the object's state changes.
- Objects are state machines (name + number): e.g. lead `solid > hot > liquid > solidified`, cat `straw > figure > warm > alive`.
- A step is one table row: `{tool, object, minState, holdDuration -> newState}`. Failed attempts are rows with different outcomes (they do something funny, they do not block).
- Float: object follows the tip with delay/wobble, level sets delay and wobble.
- Reshape: a few prefab target shapes per material, blended by voxel morph (same technique as frog > prince): match both voxel sets to equal count, sort by height or Hilbert curve, 1:1 interpolation plus noise.
- Precision per tool via input, not physics: motion scaling (tweezers 0.3, paw 1:1 plus strong smoothing), One-Euro filter, grab radius, optional tremor on the **virtual hand only**, never camera jitter.
- Hints as symbols on objects (text is unreadable at 0.75 cm voxels).

## Verbs (6–8, jam scope)
heat, cool, stir, grind, fill, float, reshape, animate. Later/optional: calm/banish, draw runes, light, wind.

## Tools / ingredients (inventory ideas)
- Vessels: flask, test tube, mortar and pestle, crucible, still, funnel, scale, vials, dropper, cork, hourglass.
- Fire: candle, Bunsen burner, match, charcoal, bellows; opposite: ice / frost crystal.
- Ingredients: herbs, mushrooms, roots, bones, feathers, salt, sulfur, mercury, moon dew, spark dust, straw, lead, gold.
- Magic tools: wand levels 1–3 (float), magic gloves types A/B/C (reshape), heat-proof glove + glass (glass forming), bottle (fill/transfer).

## The three play paths (rough, not final design)
1. **Make gold (table, tutorial path).** Grind sulfur+salt in mortar, light burner with match, melt lead in crucible, add mercury within fill window, add powder, stir (grey to yellow), pour into mold, cool with frost crystal. Failures: too much mercury = fool's gold (bait dummy), too hot = lead burns to smoke, powder forgotten = nothing, hint appears.
2. **Capture a ghost (wall).** Light candle, grind and burn herbs (smoke makes ghost visible), draw salt circle on wall with wand (must close), gold as bait in circle, bottle over circle, cork. Failures: open circle, fool's gold, candle out.
3. **Bring the cat to life (floor, finale).** Magic glove turns straw into cat figure (morph), gold becomes the eyes, frost crystal firms it, candle warms it, open ghost bottle, ghost enters cat, cat wakes and runs to the cushion. Failures: cold figure, fool's gold eyes (cat squints, runs in circles), straw burns.

Order is fixed: gold, ghost, cat (each depends on the previous result). Other earlier ideas (frog to prince, zombie neutralisation, gas gold) are optional extras.

## Development roadmap (build everything yourself)
Every stage ends with something testable in the headset.
0. **Tooling (~1 day):** three.js + Vite, HTTPS for Quest (self-signed cert, `adb reverse`, or tunnel), Git with a tag per stage.
1. **VR skeleton (1–2 days):** empty `immersive-vr` scene, `local-floor`, two controllers with a tip sphere, 3-point table calibration, matrix persisted, check point on restart. Test: a grey box lies exactly on the real table, also after reload.
2. **Voxel pipeline (2–3 days, most important):** own `.vox` parser (chunks `SIZE`, `XYZI`, `RGBA`, ~100 lines, axis conversion Z-up to Y-up), voxel object data structure (size, typed array of palette indices, palette), per-object mesher with vertex colors, vertex AO, `InstancedMesh` for moving voxels. Test: frog (12) and cat (16) side by side.
3. **Assets:** shared palette, placeholders from code first (colored boxes), then real models. Generate boxes, cylinders, spheres, circles, channels, liquid surface, fill layers and flame by code (voxel functions). Animation without skeleton: separate parts wobbling by code, 2–4 frame run cycle, morph for transformations. Asset list for path 1: mortar+pestle, crucible, burner with flame, match, ladle/spoon, mercury bottle, lead bar, mold, frost crystal, gold bar (~12 objects).
4. **Game core (3–4 days):** tip + distance = hold, hold-progress ring, object state machine, vessel with fill window, haptics, tool switching with thumbstick. Test: path 1 playable with placeholders.
5. **Path 1 with real graphics (2–3 days):** models, particles (smoke, sparks, steam), sound, one outside playtest of 5 minutes without explanation.
6. **Paths 2 and 3 (3–4 days each):** wall calibration, circle drawing, ghost; floor, cat morph, merge gold and ghost.
7. **Cleanup and delivery (2 days):** extract what repeated, failure states and hints, desktop fallback, itch.io build test (reserve at least half a day).
- If time runs short, cut from the back: path 3 becomes a short final scene, path 2 simplified, **path 1 stays complete.**

**Roadmap status (2026-10-10, before the endspurt; see "Endspurt" for what changed on 2026-10-11):**
- 0 done: Vite + three.js, HTTPS dev server, deploy to the netcup server through GitHub (see Current state). No tag per stage yet.
- 1 partly: VR session, `local-floor`, hands and controllers, table height set by touch and remembered; no 3-point table calibration, no check point on restart.
- 2 done: `.vox` parser, mesher with vertex AO, own viewer (`viewer.html`), plus the photo-to-voxel tool. Frog and cat side by side were never made (no such models).
- 3 partly: shared palette and models from code, one model from a photo (the vial). Not built: mortar, ladle, mold, frost crystal, animation, morph.
- 4 done and beyond: hold, state machine by reaction rows, dose window, haptics, rigid bodies, grips that slip. Thumbstick tool switching was dropped (tools are held in the hand).
- 5 partly: levels 1 and 2 playable with placeholder graphics; no particles, no sound, no outside playtest yet.
- 6 not started (paths 2 and 3: the ghost on the wall, the cat on the floor).
- 7 partly: desktop fallback and failure states exist; no itch.io test, no hints as symbols yet.

## Image to voxel
`npm run img2vox -- <cut-out.png> <out.vox> --height 13 --colors 10 --crop-top 0.155 --stretch 1.2 --preview preview.png` (`--stretch` makes it taller, not wider; the vial uses 1.2) revolves the silhouette of a transparent-background photo (round objects: bottles, vases, flasks) into a hollow 1-voxel shell with colors picked from the photo (`src/img2vox/`). The mercury vial is such a model (`src/assets/bottle.vox`, from a potion bottle photo, stopper cropped off; made at 1 cm voxels with the command above, then redrawn at 4/3 with `npm run relathe-vox -- bottle.vox bottle.vox --factor 1.3333333` when the voxel became 0.75 cm; to make it finer from the photo, run img2vox again with `--height` 17 and `--stretch` as above): its collision box and grab size come from the model, its liquid window is drawn on the shell (`vesselModel`). Keep source photos out of git (rights); commit only the derived `.vox`. Not built, only when needed: front + side photos as a visual hull for asymmetric objects.

## 3D model to voxel
`npm run mesh2vox -- model.glb out.vox --height 21 --colors 24 [--hollow] [--up y|z] [--preview p.png]` (`src/mesh2vox/`, `tools/mesh2vox.mjs`) voxelizes a `.glb` (positions, node transforms, base color factor, vertex colors, PNG textures; no `.gltf` with separate files, no strips or fans, no skins) or `.obj` (+ `.mtl` Kd colors, PNG `map_Kd`) at `--height` voxels (the y extent; width and depth follow), solid by default or a one voxel shell with `--hollow`, `--up z` for Z-up exports (Rhino, CAD), colors reduced to `--colors` with the same k-means as img2vox. Every voxel takes the average color of the triangles in it. Not verified on a real model yet (only on generated cubes and a hand-made GLB in `test/mesh2vox.test.js`); thin parts (handles, ears) can be lost at 16–25 voxels. Keep source models out of git (rights); commit only the `.vox`.
Planned alternative by hand (decided by Uli): any format -> Rhino (scale to the target height in voxels, export OBJ) -> Goxel (import OBJ, export `.vox`). Unverified: Goxel's OBJ import and whether it runs on macOS 27; textures are probably lost; the result needs the game palette (24–32 colors).

## Endspurt (2026-10-11, game jam final day): what changed
Plan: `docs/superpowers/plans/2026-10-11-endspurt-mvp.md`. Decided by Uli: the table is **1.6 x 0.8 m**; **controllers are the main input** (hand tracking stays as an unmaintained fallback); the three levels are gold (1, 2) and the ghost + cat (3), all on the table (no real wall or floor; the cat is a straw model that morphs into the living cat).
- **Settings console** (`config/console.js`, `game/console.js`, `view/console.js`, `runtime/console.js`, `icons.js`): rows of tap buttons set into pockets in the table top along the right edge, options side by side (theme dark/light, background lab/bench/stable, difficulty easy/normal/hard), passive = dark green, active = lit green and pushed in, each with a Font Awesome Free icon (CC BY 4.0): its SVG path drawn at 128 px onto a canvas and used as a texture on a flat plane behind the button (`icons.js`; a picture, finer than the voxels, no image files). Buttons are 4 x 4 voxels (`CONSOLE.buttons.sizeVoxels`; Uli said 2 x 2, 1.5 cm is below tracking jitter: change the number if wanted). Pressed by a tap of a controller's working end (or a tracked fingertip) on the table, or a mouse click. A restart cord with a lamp (take the bead with the trigger and pull 15 cm, or drag with the mouse: the trigger may already be pressed when the hand arrives, the reach is 9 cm from the working end or from the hand, the bead lights up when in reach, a tick when taken). Settings are stored under `alchemist.settings` (`settings.js`). Backgrounds are only ground and sky colors so far.
- **Difficulty** (`config/difficulty.js`, `game/rules.js`): `rules()` is `CFG` plus what the chosen level changes: the mercury and sulfur windows, burn temperature and burn time, heat rate, stirring time, lump time, match strike speed, the vial's break speed (factor), spare vials (easy: 1), the ghost's smoke rate and the time to catch it, the ring gap tolerance. Game code reads `rules().X` where it checks a window or a time (levels use getters for `hold` and `gauge`); changing the difficulty restarts the game. Numbers are first guesses.
- **Hand tools** (`config/handtools.js`, `handtools.js`, `handtoolview.js`, `runtime/handtools.js`): a controller carries one: the **tongs** (trigger closes them: hold the vial, the rod, the gold, a match, pinch out the wick) or the **long spoon** (trigger at a dish scoops; releasing the trigger tips it out; salt trickles out as the spoon moves low over the table). The working end is `HANDTOOLS.x.tipZ` in front of the controller. The grip button does nothing except at the shelf. The tracked-hand and mouse paths are unchanged (the mouse takes everything directly).
- **Shelf** (`LAYOUT.shelf`, `game/shelf.js`, `view/shelf.js`, `runtime/spares.js`): along the far edge on two posts; the left half holds the main tools (the vial and the rod start there), the right half the two hand tools in compartments. The grip button with the working end at a compartment takes the tool lying there or puts the one in hand back (a tool in hand is swapped). Hands start empty. On easy a broken vial is replaced by the spare on the shelf.
- **Level 3** (`game/levels/level3.js`, `game/ghost.js`, `game/finale.js`, `game/ring.js`, `runtime/ghost.js`, `view/ghost.js`): light the candle, put herbs (a dish, scoop with the spoon, drop into the crucible) on the flame: smoke; at enough smoke the ghost shows. Lay a **closed ring of salt** (the spoonful trickles out as the spoon moves) around the gold nugget (4-connected flood fill over the salt puddle cells, `RING_GAP_TOL` closes small gaps); real or dull gold lures the ghost, fool's gold makes it laugh (restart with the cord). Hold the vial **upside down** over the ring for `TRAP_HOLD` s: caught. Then the straw cat: lay the gold on its eyes, tip the open vial over it: the ghost goes in, the cat wakes, runs to the cushion (in circles with fool's gold eyes), the end. The vial is empty in level 3.
- **Book of instructions** (`view/book.js`, `game/book.js`, `runtime/book.js`, `paper.js`, `LAYOUT.book`, `guide` in each level file): a thick old book lying open on the table left of the experiment: leather cover with brass corners, stacks of page edges on both sides (thicker the more pages lie there), a red ribbon with a wax seal (dragon). One spread per level: the picture and the title (German Fraktur, bundled UnifrakturCook, OFL) on the left page, the numbered steps on the right, torn page corners, a soft shadow. The book opens at the page of the level and a leaf turns when the level changes; by hand: tap the lower corners (arrows in the corners; a controller tip, a fingertip or a mouse click) or the arrow keys. A red note can be written on a spread (`setNote`, struck-through step) for what went wrong (not wired to the game yet). **Oak table** (`view/wood.js`): the top is a procedural oak picture (planks, grain, knots), the edges and legs plain dark oak; dark/light theme tints it. Icons are cream with a dark rim so they read on both.
- **Transition** (`game/transition.js` pure, `view/fade.js`, `runtime/transition.js`, `guide.motto`/`guide.end` in the level files): when a level is done the picture fades to black (a black sphere around the head), the next level is set up in the dark, a German Fraktur title card with a motto floats where the player looks, then it brightens. The same at the start of the game (card of the first experiment; the smoke test skips it unless the URL has `&intro`) and at the very end ("Das Ende"). A restart has no fade. `advanceLevel(..., commit = false)` + `commitLevel` let the caller change the level after the fade.
- **Step symbols** (`game/hints.js` pure, `hint(s, info)` in each level file, `view/hints.js`, `runtime/hints.js`, `HAZARD.hint`): a small Font Awesome picture floats over the thing needed next (match over the box, flame at the wick, hourglass at the crucible while it heats, vial, droplet to pour, spoon at the dish, stir arrows, gem, herb leaf, salt ring, eye and vial at the cat). The difficulty decides when it shows (`HINT_DELAY`: easy at once, normal after 12 s without progress, hard never); the warning symbol of a hazard takes its place; none during a fade. The living cat is black (`P.CAT`).
- **Calibration aids and field fixes (2026-10-11):** controllers calibrate too (the working end of the tool taps the table, like a fingertip); the keep-away distance to objects is 4 cm; the protected areas (`game/zones.js` pure, `handInput.zones()`) are drawn as white translucent areas on the table (`view/zones.js`) until the table is set and for 3 s after a blocked tap, and a white bar at the finger shows how far and in which direction it still has to move (`clearance`). The shelf stands 15 cm nearer (`shelfZ` in `config/layout.js`). Heating is slower (`HEAT_RATE` 0.08 on normal) and the step symbols are timed to it: the vial symbol shows as soon as the flame is lit, urgent steps show after 0.5 s, the others after `HINT_DELAY` (6 s); the tool a hint points at, and a tool within reach of a hand that can take it, get a white pulsing outline (`tools.refreshGlow`). The stirring rod is thinner (1.5 cm) with a larger grab radius and is taken **directly** by any controller (`TOOLS.rod.direct`: no tongs; vial, gold and match still need the tongs). The restart cord is easier to take (see above).
- **Perfect preconditions (test aid):** pushing the restart cord **up** (10 cm; the cord turns blue) starts the level whose page is open in the book with its perfect preconditions, as if the levels before had been done perfectly (`preset(s)` in the level files: level 1 melted lead and a lit candle, level 2 a perfect amalgam, level 3 a perfect gold nugget on the table, an empty vial). Turn the book to the level you want (corners or arrow keys), push the cord up: fade, clean table, that level. On the page of the running level it sets that level's preconditions again. `runner.begin(level, { preset })`, `runner.preconditions()`. Pulling down still restarts from level 1.
- **Cat morph** (`game/morph.js` pure, `view/ghost.js`): when the vial is opened over the cat the voxels of the straw cat walk to their places in the living cat (both voxel sets sorted along a Z-order curve, the smaller stretched to the larger, voxel i walks to voxel i with a lift and a swirl, colors blend), over `CFG.WAKE_TIME` (2.2 s); then the cat runs to the cushion. Replaces the model swap.
- **Failure hints** (`config/hazard.js`, `game/hazard.js` pure, `view/hazard.js`, `runtime/hazard.js`, `audio.js`, `failures` in the level files): `hazard(state, rules())` gives how badly it is going wrong (too hot, too long hot, not stirred). Three signs: sparks and smoke (grey to black) and a symbol over the crucible (flame, stir arrows, skull after a failure); controller pulses and synthesized crackles that get faster and stronger, a hiss when it fails (no thud; sound starts only after a click or the VR session start); a red note and a struck-through step in the book (`bookView.setNote`). A restart wipes them. Numbers are first guesses; feel and sound unverified on the headset.
- **Headless controller tests:** `test/smoke.mjs` fakes a controller (`__game.fakeController`) to take the tongs from the shelf, grab and carry the vial, tap a button and pull the cord; level 3 is played through with the mouse. Real controller offsets, trigger feel, tap reliability and all difficulty numbers are **not verified on the headset**. `?trigger` in the URL shows the raw trigger and grip values on the panel.

## Planned (decided by Uli, not built)
- Choosing objects from the shelf (later the player picks which things to combine); what a break costs on the harder levels.
- Backgrounds as real scenery (historical alchemist lab, workbench, horse stable): three art scenes.
- The wand/glove, frost crystal and candle-warming steps of the original cat path.
- Wall and floor as real calibrated surfaces for the ghost and the cat (Uli chose the table for the jam).

## Tooling notes
- Voxel editor: **MagicaVoxel** (ephtracy, free, macOS) or **Goxel** (macOS). The game needs **`.vox`** files.
  - Goxel's own save format `.gox` is only for editing in Goxel. `.vxl` is the Voxlap/Ace of Spades format and is useless here.
  - In Goxel use *Export* (not Save) and pick the MagicaVoxel/`.vox` option. Fallbacks: `.qb` or PNG layers (not verified).
  - After the first export check the axes with a test cube that has a marked corner.
- The `VoxQL.qlgenerator` QuickLook plugin is optional. On macOS 27 it most likely does not load (generators are deprecated). Skip it, use the editor or the own three.js viewer instead.
- Dev machine: macOS 27.

## Unverified assumptions (check before relying on them)
- Whether `plane-detection` / `mesh-detection` exist in `immersive-vr` on Quest (assumed no; the plan works without them).
- Whether `local-floor` stays accurate enough between sessions (hence the check point).
- Mesher and instancing performance with many objects on Quest 2 (measure in stage 2).
- Whether itch.io iframe allows `xr-spatial-tracking` for WebXR (fallback: own host link).
- Whether the current MagicaVoxel / Goxel builds run on macOS 27 and what exactly Goxel's export list contains.
- Voxel-count and draw-call budgets are estimates. The see-through glass of the vial and the instanced puddles and drops have not been timed on a Quest.
- That the Quest browser delivers `hand-tracking` joints as assumed in `tracking.js`, and every distance there (`INPUT.hand` in `config/input.js`): pinch 2 to 8 cm, finger curl 5.5 to 12 cm, the grasp point 4.5 cm in front of the palm.
- That a fingertip resting on the real table reads about 1 cm above its surface (`INPUT.calibration.fingerThickness`), and that the tap thresholds are a good gesture (`INPUT.calibration.tap`).
- The controller offsets `INPUT.controller.tipZ` and `palmZ`, the fist filter cutoffs (`INPUT.filter.fist`), the grip forces (`PHYSICS.grip`), the break and strike speeds, and every pour and dose number (`config/game.js`).
- The headless smoke test covers the desktop path only (mouse, levels, restart, table height). Hands and controllers are covered by unit tests with fake joints and gamepads, not by a headset.

## Open questions
- Is the order of the three paths fixed? Assumed yes; levels 1 and 2 are the gold path (path 1), the ghost and the cat are not built.
- Is the wall real (calibrated) or a virtual panel placed in front of the player? Floor: pedestal or real floor? Open: decide before level 3.
- Is calibration done once per session (stored) or more often? Stored so far, for the table height only (localStorage); no check point on restart.
- Jam length and team size (alone or not) are unknown.
- Which Quest model is available for testing.

## Current state (what exists, for the next session)
Start here. Run `npm run dev` to play (desktop mouse, or open the Network URL on the Quest), `npm test` for the pure logic (written test-first), `npm run smoke` to run the real game headless in Chromium (scripted mouse: match, vial, both levels, sulfur, nugget, restart, table height; fails on any console error). Run both test commands before every push. `src/main.js` only composes the pieces; see the code map below.

**Playable:** level 1 and level 2 on a 2 x 1 m table, 0.85 m high until the player sets the real table's height (world origin = table top, 45 cm in front of the player).
- Level 1: strike a match (fast stroke on the striker), light the candle, heat the lead to liquid (0.5 < temp < 0.95), pour mercury into the dose window (0.7 to 1.3), hold 1.5 s -> amalgam with a hidden quality.
- About 3 s after the amalgam forms (and while the vial is not held) the used objects are cleared away; the mess on the table stays. Level 2: sulfur grains (pinch from the dish, 0.35 to 0.75 doses), heat, stir the rod in the crucible 3 s -> gold, dull gold or fool's gold by quality (0.4 amalgam + 0.3 sulfur + 0.3 heat). The gold can be taken out as a nugget. Failures are rows too: sludge, burnt, slag, lumps.
- All tuning numbers are in `src/config/` (the rules in `config/game.js`); the reaction tables are in `src/game/levels/`.

**Code map** (`src/`; `main.js` only composes the pieces and runs the loop, they share one `ctx`)
- `config/`: all numbers. `game.js` rules (`CFG`), `layout.js` where things are, `input.js` hands/controllers/mouse (`INPUT`), `physics.js`, `tools.js` (`TOOLS`: size, mass, grab radius, break speed), `view.js` colors and sizes; `index.js` re-exports them frozen. Voxel colors are the palette in `palette.js`.
- `game/` (pure, tested): `sim.js` the state and generic rules (matches, candle, `landSubstance`, `advanceLevel`, `step`), `levels/` one file per level, `pouring.js`, `scoring.js`, `drops.js` (drops fly ballistically), `puddles.js` (persistent mess, per material), `stir.js`, `geometry.js`.
- `view/`: `scene.js` (renderer, table, camera, static parts), `effects.js` (rings, drops, puddles, grains), `hud.js` (status panel; also the "pinch to reset" target).
- `runtime/`: `tools.js` (vial, rod, nugget: held by mouse or hand, physics sync), `hands.js` (grabbing, pinch actions), `mouse.js`, `matches.js`, `drops.js` (pouring, grains, spills, puddles), `stirring.js`, `runner.js` (reset and level changes).
- `physics.js`: cannon-es rigid bodies for the loose tools and dropped matches; a hand holds a tool with a force-limited spring (capacity = weight x contact x press strength), a mouse holds it rigidly; the vial breaks above 2.2 m/s.
- `calibration.js` + `runtime/calibration.js`: the virtual table stands at the height of the real one. Tap the real table's top with the index finger of a tracked hand (controllers calibrate with the working end of their tool; not next to anything you could pick up): two sets of three quick taps at the front edge (a tap drops 2 cm and lifts 1.5 cm, taps at most 0.75 s apart and within 5 cm height of each other). The lowest tap of the six is the table top (`view.setTableHeight` moves the world, the floor body and the legs; remembered in localStorage); the two places (mean of each set) make the front-edge line, `edgeFromPoints` moves and turns the world group (`view.setTableEdge`; the origin sits `tableBounds.maxZ` behind the middle between the two places, remembered in localStorage). The status panel shows live finger numbers `[hand cm-above-top dip]` and why taps are not counted. The table's size is still the fixed value in `config/layout.js`. Default 0.85 m; plausible range in `LAYOUT.table.heightRange`. Then tap the front edge three times at a left and three times at a right place: the two points (mean of each three taps) make a line, `edgeFromPoints` turns and moves the world group (`view.setTableEdge`; the origin sits `tableBounds.maxZ` behind the middle of the edge, remembered in localStorage). The steps loop (top, edge 1, edge 2), the status panel says which is next. Position and rotation come from the edge only; the table's size is still the fixed value in `config/layout.js`, and the lateral position is the middle of the two points. Real plane detection is not used: it is not available in a plain `immersive-vr` session (unverified).
- `filters.js`: One-Euro filters. A fist's target pose for a held tool goes through them (`INPUT.filter.fist`): measured with simulated tracking noise the held vial shakes about 4x less, and it still follows a deliberate move. A pinch is not filtered (precision). Smoothing the grip strength was tried and dropped: it did not help.
- `tracking.js` + `vr.js` + `hand.js`: hand tracking is the main input, controllers the fallback, both fill the same hand fields (`updateInput`); `props.js` static props (the dish, a source of sulfur); `img2vox/` + `tools/img2vox.mjs` photo to voxel shell; `vox.js`, `mesher.js`, `assets.js` voxel models; `testhook.js` the `?test` hook for the smoke test.
- Deploy: a push to `main` -> GitHub Action builds, tests and force-pushes `dist/` to the `deploy` branch -> a GitHub webhook tells Plesk, which pulls `deploy` into httpdocs. If Plesk's repository is ever deleted and re-added, its webhook UUID changes: update the webhook URL in the GitHub repo settings.

**Levels are data.** A level file (`game/levels/levelN.js`) holds: `accepts` (which substances the crucible takes from falling drops, as functions of the crucible), `reactions` (rows: `when`, `hold` seconds, `apply`; failures are rows too), `stirs` (optional), `complete(state)`, `scene: { tools, props }` (what the level shows; what the previous level showed and this one does not is cleared away, the mess on the table stays; drops of a substance this level does not accept are cleared too), `gauge` (the rings around the crucible mouth) and `status(state, info)` (its lines of the panel). To add a level: write the file, add it to `levels/index.js`, add numbers to `config/game.js`, new tools to `config/tools.js` + `runtime/tools.js`, new props to `props.js`. Substances are keys of `crucible.amounts`; a prop with a `source` gives out a substance when pinched. The crucible is the only vessel so far; level 3 (a ghost on the wall) will need calibrated surfaces first.

**Vial:** the potion bottle (`src/assets/bottle.vox`, 9 x 16 voxels, 1.2x stretched). Bluish voxels are see-through glass, bronze ones opaque metal, the mercury is real voxels inside (`splitGlass`, `liquidModel` in `img2vox/vessel.js`); a full vial starts pouring at about 45 degrees, an empty one at about 70.

**How a tool is grabbed:** anywhere on its volume holds (almost) fully (`gripContact`, `INPUT.contact`; a fist over the end holds less and less); the firmness is the closing of the fingers relative to how far they closed at the grab (`holdStrength`), because a hand around a bottle cannot close as far as around nothing. The fist holds the vial by its center and turns it with the grip frame, so rolling the forearm tilts it. A fist that squeezes the vial at a closure of `TOOLS.vial.crush` (0.97) for `INPUT.crushSeconds` (0.2 s) crushes it like an impact (`breakNow`, the same break as a fall); a pinch never crushes (two fingertips meet whatever the tool, nothing stops them in VR). Unverified: whether a firm, normal fist stays below 0.97 on the Quest.

**A broken vial** (impact or crush) leaves 3 or 4 voxel pieces (`src/shards.js` cuts the bottle model along two diagonal planes, every voxel in one piece, glass see-through and metal opaque as before) next to the mercury drops: they burst outward and up with half the vial's speed, tumble as rigid boxes (`physics.addDebris` with `PHYSICS.shard`), lie on the table until the next reset (R, or the panel).

**Grip stability, measured (see `test/physics.test.js`):** a firm fist holds through a 40 cm swing in 0.3 s and a 30 cm lift in 0.25 s; a flick of 2 m/s or more is let go (the grip cannot accelerate the vial that hard, by design); a half grab (contact 0.3) still slips. The torque cap is not the limit (the needed torque is about 15x below it).

**Unverified on a real Quest:** see the section "Unverified assumptions" above. Tune with the status panel, which shows per hand `mode pinch grip` and the table height.

**Deliberately not built (YAGNI):** a controller calibration overlay, capacitive-touch poses, a filter on the pinch tip (only the fist's target is filtered), smoothing of the grip strength (tried, did not help), two-photo visual hull for asymmetric objects, per-finger physics, wind or slosh, sound, the smoke test in the GitHub build (Chromium on the runner could be slow or flaky and block deploys), level 3 (the ghost) and the cat finale.

**Next step candidates, in this order:** (1) try hands, controllers and the table height on the headset and tune the numbers listed under Unverified assumptions; (2) detect the real table's position and rotation, not only its height; (3) level 3, the ghost on the wall (decide first whether the wall is real or a virtual panel); (4) particles and sound for level 1; (5) an itch.io build test.
