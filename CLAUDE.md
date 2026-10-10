# Alchemist Voxel VR – Project Handoff

Game jam entry (theme: **Magic**). A voxel-style alchemist game in **WebXR VR on Meta Quest**, played standing, with controllers, where the virtual table / wall / floor are calibrated onto the real ones.

## Working conventions
- User: Uli, advanced developer, German is the primary language (English is fine for code and docs).
- Direct and concise. No filler, no invented finished game logic. Technology first, game logic only roughly, and advise instead of presenting made-up content.
- Always deliver consolidated full files, not diffs.
- Do not over-research simple questions.
- Do not mark things as certain that were not verified (see "Unverified assumptions").

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
- **Fallback:** a desktop variant with mouse for jurors without a headset (late stage).
- Test early on itch.io (iframe needs `xr-spatial-tracking` permission), and on the device.

## Real-world anchoring (calibration)
- Three frames: `TableFrame`, `WallFrame`, `FloorFrame`. Each has a matrix (position, rotation, size). Each level hangs on exactly one frame.
- **Floor:** from `local-floor`, only check the height.
- **Table:** 3 points with the controller on the real surface (corner, corner, opposite corner) gives height, rotation, size.
- **Wall:** 2–3 points with the controller held flat on the wall.
- Fine adjustment per plane with the stick (2–3 cm error is noticeable).
- **Persistence:** store matrices in `localStorage` / IndexedDB. Do not rely on `anchors` in VR. On start, load the stored calibration and ask for ONE check point (controller on a table corner) to compute a correction offset. Offer "recalibrate" if rotation is off. Reason: the `local-floor` origin is not guaranteed identical between sessions.
- Safety: mark the table edge visibly, show a grid when the player approaches real obstacles. When virtual and real surfaces coincide, the player gets free touch haptics.
- Zones are placed **relative** to the calibrated surface size; check minimum sizes and warn.
- Wall and floor work: a floor level may use a pedestal at hip height instead of the real floor (back strain), to be decided.

## Voxel specification
- One uniform voxel size for everything: **1 voxel = 1 cm** in the world.
- Sizes (longest edge, in voxels): drop/coin/grain 2–4; bottle/flask/tool 8–12; frog/cat/ghost 12–19 (target 16); prince/zombie 19–24.
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
- Hints as symbols on objects (text is unreadable at 1 cm voxels).

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

## Image to voxel
`npm run img2vox -- <cut-out.png> <out.vox> --height 13 --colors 10 --crop-top 0.155 --stretch 1.2 --preview preview.png` (`--stretch` makes it taller, not wider; the vial uses 1.2) revolves the silhouette of a transparent-background photo (round objects: bottles, vases, flasks) into a hollow 1-voxel shell with colors picked from the photo (`src/img2vox/`). The mercury vial is such a model (`src/assets/bottle.vox`, from a potion bottle photo, stopper cropped off): its collision box and grab size come from the model, its liquid window is drawn on the shell (`vesselModel`). Keep source photos out of git (rights); commit only the derived `.vox`. Not built, only when needed: front + side photos as a visual hull for asymmetric objects.

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
- Voxel-count and draw-call budgets are estimates.

## Open questions
- Is the order of the three paths fixed (assumed yes)?
- Is the wall real (calibrated) or a virtual panel placed in front of the player? Floor: pedestal or real floor?
- Is calibration done once per session (stored, with one check point) or more often? Decided so far: stored.
- Jam length and team size (alone or not) are unknown.
- Which Quest model is available for testing.

## Current state (what exists, for the next session)
Run `npm test` (pure logic, TDD) and `npm run dev`; the game is `src/main.js` (render loop, input glue), everything else is small pure modules.

**Playable:** level 1 and level 2 on a 2 x 1 m table at 0.85 m (world origin = table top, 45 cm in front of the player).
- Level 1: strike a match (fast stroke on the striker), light the candle, heat the lead to liquid (0.5 < temp < 0.95), pour mercury into the dose window (0.7 to 1.3), hold 1.5 s -> amalgam with a hidden quality.
- About 3 s after the amalgam forms (and while the vial is not held) the used objects are cleared away; the mess on the table stays. Level 2: sulfur grains (pinch from the dish, 0.35 to 0.75 doses), heat, stir the rod in the crucible 3 s -> gold, dull gold or fool's gold by quality (0.4 amalgam + 0.3 sulfur + 0.3 heat). The gold can be taken out as a nugget. Failures are rows too: sludge, burnt, slag, lumps.
- All tuning numbers are in `src/game/config.js`; the reaction table is `REACTIONS` in `src/game/sim.js`.

**Code map**
- `game/`: `sim.js` (state, reactions, pour, levels), `drops.js` (mercury and sulfur drops fly ballistically), `puddles.js` (persistent mess), `stir.js`, `geometry.js`, `config.js`.
- `physics.js` + `tools.js`: cannon-es rigid bodies for the loose tools (vial, rod, nugget) and dropped matches. A hand holds a tool with a force-limited spring (capacity = weight x contact x press strength), so half grabs and loosened fingers slip; a mouse holds it rigidly. The vial breaks above 2.2 m/s.
- `tracking.js` + `vr.js` + `hand.js`: hand tracking is the main input, controllers the fallback, both fill the same hand fields (`updateInput`); controller visuals and the hands drawn on a held tool are in `hand.js`.
- `img2vox/` + `tools/img2vox.mjs`: photo cut-out to voxel shell (see below); `vox.js` parser, `mesher.js` (visible faces + vertex AO), `assets.js` (code-generated models).
- Deploy: a push to `main` -> GitHub Action builds, tests and force-pushes `dist/` to the `deploy` branch -> a GitHub webhook tells Plesk, which pulls `deploy` into httpdocs. If Plesk's repository is ever deleted and re-added, its webhook UUID changes: update the webhook URL in the GitHub repo settings.

**Vial:** the potion bottle (`src/assets/bottle.vox`, 9 x 16 voxels, 1.2x stretched). Bluish voxels are see-through glass, bronze ones opaque metal, the mercury is real voxels inside (`splitGlass`, `liquidModel` in `img2vox/vessel.js`); a full vial starts pouring at about 45 degrees, an empty one at about 70.

**Unverified on a real Quest (tune with the status panel, which shows per hand `mode pinch grip`):** hand-tracking distances (`PINCH`, `GRIP_CURL` in `tracking.js`), the grasp point in front of the palm, the controller offsets `TIP_Z` and `PALM_Z` in `hand.js`, grip forces (`GRIP` in `physics.js`), the break speed, the strike speed, and every pour and dose number.

**Deliberately not built (YAGNI):** a controller calibration overlay, capacitive-touch poses, a One-Euro filter on the tip, two-photo visual hull for asymmetric objects, per-finger physics, wind or slosh, sound, level 3 (the ghost) and the cat finale.

**Next step candidates:** try the hand tracking on the headset and tune the numbers above; level 3 (ghost on the wall, needs wall calibration); stage 1 calibration of the real table (the table is still a fixed virtual one).
