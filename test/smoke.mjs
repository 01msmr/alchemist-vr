// Headless smoke test: runs the real game in Chromium (software WebGL) and plays a few moves with the mouse.
// Fails on any console error or page error. Run with `npm run smoke` (not part of `npm test`: it is slow).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-smoke-'));
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`); };

const server = await createServer({ root, configFile: false, logLevel: 'error', server: { port: 5199, host: '127.0.0.1' } });
await server.listen();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,800'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  globalThis.__errors = errors; // printed if the game never starts
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto('http://127.0.0.1:5199/?test', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));

  const game = (fn, ...args) => page.evaluate(fn, ...args);
  const shot = async (name) => {
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  };
  const colorsIn = (file) => {
    const png = PNG.sync.read(fs.readFileSync(file));
    const seen = new Set();
    for (let i = 0; i < png.data.length; i += 4 * 97) seen.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
    return seen.size;
  };
  const at = (name) => game((n) => window.__game.screenOf(n), name);
  const moveTo = async (p, steps = 8) => page.mouse.move(p.x, p.y, { steps });

  // 1. it renders something
  const first = await shot('level1');
  check(colorsIn(first) > 40, `the scene renders (${colorsIn(first)} distinct colors sampled)`);
  check((await game(() => window.__game.state.level)) === 1, 'starts in level 1');
  check(await game(() => window.__game.tools.vial.active), 'the vial is on the table');

  // 2. take a match from the box with the mouse, then let go (a dropped match is gone)
  const box = await at('box');
  await moveTo(box);
  await page.mouse.down();
  check((await game(() => window.__game.state.matches)) === 2, 'clicking the matchbox takes a match');
  await moveTo({ x: box.x + 60, y: box.y - 40 });
  await page.mouse.up();
  check(await game(() => window.__game.state.match === null), 'a dropped match is gone');

  // 3. pick up the vial and put it down somewhere else
  const vial = await at('vial');
  await moveTo(vial);
  await page.mouse.down();
  check((await game(() => window.__game.tools.vial.holder)) === 'mouse', 'the vial can be picked up with the mouse');
  await moveTo({ x: vial.x - 140, y: vial.y + 30 }, 15);
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1500));
  const moved = await game(() => { const p = window.__game.tools.vial.pos; return { x: p.x, y: p.y }; });
  check(moved.y < 0.2 && moved.x < 0.2, `the vial fell back to the table (y=${moved.y.toFixed(3)})`);
  await shot('after-vial');

  // 4. level 2: pretend the amalgam exists and wait for the tidy-up
  await game(() => { Object.assign(window.__game.state.crucible, { content: 'amalgam', quality: 0.9, temp: 0.7 }); });
  // the picture fades to black, the level changes in the dark, then it brightens (game time runs slower than the clock here)
  await page.waitForFunction(() => window.__game.fade.dark > 0.95, { timeout: 30000 }).catch(() => {});
  check((await game(() => window.__game.fade.dark)) > 0.95, 'the picture fades to black when a level is done');
  await page.waitForFunction(() => window.__game.fade.card > 0.9, { timeout: 15000 }).catch(() => {});
  check((await game(() => window.__game.fade.card)) > 0.9, 'a title card shows in the dark');
  check(colorsIn(await shot('title-card')) > 2, 'the card renders');
  await page.waitForFunction(() => window.__game.fade.dark < 0.02, { timeout: 30000 }).catch(() => {});
  check((await game(() => window.__game.fade.dark)) < 0.02, 'it brightens again');
  check((await game(() => window.__game.state.level)) === 2, 'level 2 starts after the amalgam exists');
  check(!(await game(() => window.__game.tools.vial.active)), 'the vial is cleared away');
  check(await game(() => window.__game.tools.rod.active), 'the stirring rod appears');
  const level2 = await shot('level2');
  check(colorsIn(level2) > 40, 'level 2 renders');

  // 5. take sulfur from the dish and let it fall over the crucible
  const dish = await at('dish');
  await moveTo(dish);
  await page.mouse.down();
  const crucible = await at('crucible');
  await moveTo({ x: crucible.x, y: crucible.y - 60 }, 15);
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 1500));
  const s = await game(() => ({ sulfur: window.__game.state.crucible.amounts.sulfur ?? 0, wasted: window.__game.state.wasted }));
  check(s.sulfur + s.wasted > 0.04, `sulfur fell (in crucible ${s.sulfur.toFixed(3)}, wasted ${s.wasted.toFixed(3)})`);

  // 6. gold can be taken out as a nugget
  await game(() => { Object.assign(window.__game.state.crucible, { content: 'gold', quality: 0.9 }); });
  await new Promise((r) => setTimeout(r, 300));
  const c2 = await at('crucible');
  await moveTo(c2);
  await page.mouse.down();
  check(await game(() => window.__game.tools.nugget.active), 'clicking the finished gold takes a nugget');
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));
  await shot('nugget');

  // 7. start over from level 2: everything is back as in level 1, the mess is gone
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  const reset = await game(() => ({ level: window.__game.state.level, vial: window.__game.tools.vial.active, rod: window.__game.tools.rod.active, nugget: window.__game.tools.nugget.active, mess: window.__game.puddles.total(), content: window.__game.state.crucible.content }));
  check(reset.level === 1 && reset.vial && !reset.rod && !reset.nugget && reset.mess === 0 && reset.content === 'lead', `R starts over in level 1 (${JSON.stringify(reset)})`);
  await shot('after-reset');

  // 8. the table height: set it like a real table (0.72 m), everything on it moves along, it is remembered after a reload
  const before = await game(() => ({ y: window.__game.tools.vial.pos.y, world: window.__game.worldY, floor: window.__game.floorY }));
  check(Math.abs(before.world - 0.85) < 1e-9 && Math.abs(before.floor + 0.85) < 1e-9, 'the default table is at 0.85 m');
  check(await game(() => window.__game.setTableHeight(0.72)), 'a plausible table height is accepted');
  check(!(await game(() => window.__game.setTableHeight(3))), 'an implausible one is refused');
  await new Promise((r) => setTimeout(r, 1200));
  const after = await game(() => ({ y: window.__game.tools.vial.pos.y, active: window.__game.tools.vial.active, world: window.__game.worldY, floor: window.__game.floorY }));
  check(Math.abs(after.world - 0.72) < 1e-9 && Math.abs(after.floor + 0.72) < 1e-9, 'the world and the floor follow the table height');
  check(after.active && Math.abs(after.y - before.y) < 0.01, 'the vial still stands on the table');
  const lowered = await shot('table-072');
  check(colorsIn(lowered) > 40, 'the lowered table renders');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, { timeout: 15000 });
  check(Math.abs((await game(() => window.__game.tableHeight)) - 0.72) < 1e-9, 'the height is remembered after a reload');

  // 9. the table edge: a turned table, everything on it turns along, it is remembered after a reload
  check(await game(() => window.__game.setTableEdge({ x: 0.1, z: -0.5, yaw: 0.2 })), 'a plausible table edge is accepted');
  check(!(await game(() => window.__game.setTableEdge({ x: 0, z: 0, yaw: 3 }))), 'an implausible one is refused');
  await new Promise((r) => setTimeout(r, 500));
  check(Math.abs((await game(() => window.__game.worldYaw)) - 0.2) < 1e-9, 'the world turns with the edge');
  check(colorsIn(await shot('table-turned')) > 40, 'the turned table renders');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, { timeout: 15000 });
  check(Math.abs((await game(() => window.__game.worldYaw)) - 0.2) < 1e-9, 'the edge is remembered after a reload');

  // 10. a broken vial leaves three or four pieces that stay on the table
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  await game(() => window.__game.breakVial());
  check([3, 4].includes(await game(() => window.__game.shards)), `a broken vial leaves 3 or 4 pieces (${await game(() => window.__game.shards)})`);
  await new Promise((r) => setTimeout(r, 1500));
  check(colorsIn(await shot('shards')) > 40, 'the pieces render');
  check(!(await game(() => window.__game.tools.vial.active)), 'the vial is gone');

  // 11. the settings console on the table's right edge: tap buttons and the pull cord; the choices survive a reload
  await game(() => {
    const g = window.__game;
    g.setTableEdge({ x: 0, z: -0.45, yaw: 0 });
    const o = g.view.world.position; // look at the right edge of the table from farther away
    g.view.controls.target.set(o.x + 0.6, o.y + 0.25, o.z + 0.0);
    g.view.camera.position.set(o.x + 0.6, o.y + 0.55, o.z + 1.0);
    g.view.controls.update();
  });
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  check((await game(() => window.__game.settings.theme)) === 'dark', 'the console starts dark');
  const light = await at('theme:light');
  await page.mouse.click(light.x, light.y);
  check((await game(() => window.__game.settings.theme)) === 'light', 'a click on the sun button switches to the light look');
  const dark = await at('theme:dark');
  await page.mouse.click(dark.x, dark.y);
  check((await game(() => window.__game.settings.theme)) === 'dark', 'a click on the moon button switches back');
  await page.mouse.click(light.x, light.y);
  const bench = await at('background:bench');
  await page.mouse.click(bench.x, bench.y);
  check((await game(() => window.__game.settings.background)) === 'bench', 'a click on a button chooses that background');
  const hard = await at('difficulty:hard');
  await page.mouse.click(hard.x, hard.y);
  check((await game(() => window.__game.settings.difficulty)) === 'hard', 'a click on a button chooses the difficulty');
  check(colorsIn(await shot('console-light')) > 40, 'the console renders');
  await game(() => { window.__game.state.candleLit = true; });
  const bead = await at('bead');
  await moveTo(bead);
  await page.mouse.down();
  await moveTo({ x: bead.x, y: bead.y + 40 }, 6);
  const half = await game(() => window.__game.cordPulled);
  check(half > 0.02 && half < 0.15, `dragging the bead pulls the cord (${half.toFixed(3)} m)`);
  check(await game(() => window.__game.state.candleLit), 'a half pull does not restart');
  await moveTo({ x: bead.x, y: bead.y + 220 }, 12);
  await page.mouse.up();
  check(!(await game(() => window.__game.state.candleLit)), 'a full pull restarts the level');
  await new Promise((r) => setTimeout(r, 1500));
  check((await game(() => window.__game.cordPulled)) === 0, 'the cord springs back up');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, { timeout: 15000 });
  const kept = await game(() => window.__game.settings);
  check(kept.theme === 'light' && kept.background === 'bench' && kept.difficulty === 'hard', `the choices are remembered after a reload (${JSON.stringify(kept)})`);

  // 11a. too hot for too long: the lead burns, the book writes the reason in red, a restart wipes it
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  await game(() => { const g = window.__game; g.state.candleLit = true; g.state.crucible.temp = 0.97; });
  await page.waitForFunction(() => window.__game.state.crucible.content === 'burnt', { timeout: 40000 }).catch(() => {});
  check((await game(() => window.__game.state.crucible.content)) === 'burnt', 'lead held too hot burns');
  const note = await game(() => window.__game.notes[0]);
  check(note && note.step === 1 && /heiß/.test(note.text), `the book writes the reason on the first spread (${JSON.stringify(note)})`);
  await new Promise((r) => setTimeout(r, 500));
  check(colorsIn(await shot('failure')) > 40, 'the failure scene renders (smoke, symbol)');
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  check((await game(() => window.__game.notes[0])) === null, 'a restart wipes the note');

  // 11b. the book of instructions: it turns with the levels, and by hand at its lower corners (mouse click, arrow keys)
  check((await game(() => window.__game.book.shown)) === 0, 'the book is open at the first level');
  await game(() => {
    const g = window.__game;
    const o = g.view.world.position; // look at the book
    g.view.controls.target.set(o.x - 0.5, o.y, o.z - 0.1);
    g.view.camera.position.set(o.x - 0.5, o.y + 0.55, o.z + 0.3);
    g.view.controls.update();
  });
  await new Promise((r) => setTimeout(r, 600)); // a frame must be drawn before screen positions are right
  const nextCorner = await game(() => { const z = window.__game.bookZone(1); const p = window.__game.screenAt(z.x, 0.03, z.z); return p; });
  await page.mouse.click(nextCorner.x, nextCorner.y);
  await page.waitForFunction(() => window.__game.book.shown === 1, { timeout: 10000 }).catch(() => {});
  check((await game(() => window.__game.book.shown)) === 1, 'a click on the lower right corner turns the page');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__game.book.shown === 0, { timeout: 10000 }).catch(() => {});
  check((await game(() => window.__game.book.shown)) === 0, 'the left arrow key turns back');
  await page.keyboard.press('ArrowRight');
  await new Promise((r) => setTimeout(r, 300));
  check(colorsIn(await shot('book-turning')) > 40, 'the turning page renders');
  await page.waitForFunction(() => window.__game.book.shown === 1, { timeout: 10000 }).catch(() => {});
  await game(() => window.__game.goToLevel(3));
  await page.waitForFunction(() => window.__game.book.shown === 2, { timeout: 15000 }).catch(() => {});
  check((await game(() => window.__game.book.shown)) === 2, 'the book opens at the page of the new level');
  check(colorsIn(await shot('book-open')) > 40, 'the book renders');
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));
  await game(() => { // the view of the console again, for what follows
    const g = window.__game;
    const o = g.view.world.position;
    g.view.controls.target.set(o.x + 0.6, o.y + 0.25, o.z + 0.0);
    g.view.camera.position.set(o.x + 0.6, o.y + 0.55, o.z + 1.0);
    g.view.controls.update();
  });
  await new Promise((r) => setTimeout(r, 600));

  // 12a. controllers: the grip button at the shelf takes the tongs, the trigger closes them on the vial, it follows
  await game(() => window.__game.setSetting('difficulty', 'normal'));
  await new Promise((r) => setTimeout(r, 400));
  const lay = await game(() => ({ shelf: window.__game.layout.shelf, vial: window.__game.layout.rest.vial }));
  const fake = (i, tip, pinch = 0, squeeze = 0) => game((i2, t, p, q) => window.__game.fakeController(i2, { tip: t, pinch: p, squeeze: q }), i, tip, pinch, squeeze);
  const tongsAt = { x: lay.shelf.slots[0].x, y: lay.shelf.y + 0.05, z: lay.shelf.z };
  await fake(1, tongsAt);
  await new Promise((r) => setTimeout(r, 400));
  check((await game(() => window.__game.hands[1].handTool)) === null, 'a controller starts with an empty hand');
  await fake(1, tongsAt, 0, 1);
  await new Promise((r) => setTimeout(r, 400));
  check((await game(() => window.__game.hands[1].handTool)) === 'tongs', 'the grip button at the shelf takes the tongs');
  await fake(1, tongsAt, 0, 0);
  const vialCenter = await game(() => { const p = window.__game.tool('vial').pos; return { x: p.x, y: p.y, z: p.z }; });
  const vialTip = vialCenter; // grabbed in the middle of the body
  await fake(1, vialTip);
  await new Promise((r) => setTimeout(r, 500));
  await fake(1, vialTip, 1, 0);
  await new Promise((r) => setTimeout(r, 400));
  check((await game(() => window.__game.tool('vial').holder)) === 1, 'the trigger closes the tongs on the vial');
  const lifted = { x: 0.1, y: 0.35, z: 0.1 };
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const way = [vialTip, { ...vialTip, y: 0.35 }, lifted]; // straight up first, then over the crucible: nothing in the way
  for (let leg = 1; leg < way.length; leg++) {
    for (let i = 1; i <= 30; i++) { // a hand moves, it does not jump: about 1 cm per frame, however slow the frames are here
      const k = i / 30;
      const [a, b] = [way[leg - 1], way[leg]];
      await fake(1, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }, 1, 0);
      await frame();
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  const carried = await game(() => { const p = window.__game.tool('vial').pos; return { x: p.x, y: p.y, z: p.z }; });
  check(Math.hypot(carried.x - lifted.x, carried.y - lifted.y, carried.z - lifted.z) < 0.06, `the vial follows the tongs (${carried.x.toFixed(2)}, ${carried.y.toFixed(2)}, ${carried.z.toFixed(2)})`);
  await fake(1, lifted, 0, 0);
  await new Promise((r) => setTimeout(r, 300));
  check((await game(() => window.__game.tool('vial').holder)) === null, 'letting go of the trigger lets go of the vial');
  const spoonAt = { x: lay.shelf.slots[1].x, y: lay.shelf.y + 0.05, z: lay.shelf.z };
  await fake(0, spoonAt);
  await new Promise((r) => setTimeout(r, 300));
  await fake(0, spoonAt, 0, 1);
  await new Promise((r) => setTimeout(r, 400));
  check((await game(() => window.__game.hands[0].handTool)) === 'spoon', 'the other controller takes the spoon');
  await fake(0, spoonAt, 0, 0);
  await fake(0, { x: 0.1, y: 0.1, z: 0.1 }, 1, 0);
  await new Promise((r) => setTimeout(r, 300));
  check((await game(() => window.__game.hands[0].held)) === null, 'the spoon does not pick up the vial');
  // the console with a controller: tap a button with the tongs' tip; pinch the bead and pull the cord
  const buttonAt = await game(() => { const c = window.__game.consoleCenter('difficulty:easy'); return { x: c.x, y: 0, z: c.z }; });
  const tapPath = [0.1, 0.07, 0.04, 0.01, 0.0, 0.02, 0.05]; // the tip comes down onto the table and goes up again, a centimeter or two per frame
  for (const y of tapPath) { await fake(1, { x: buttonAt.x, y, z: buttonAt.z }); await frame(); await frame(); }
  check((await game(() => window.__game.settings.difficulty)) === 'easy', 'a tap of the controller tip on a button presses it');
  await game(() => window.__game.setSetting('difficulty', 'normal'));
  await game(() => { window.__game.state.candleLit = true; });
  const beadLocal = await game(() => { const b = window.__game.consoleCenter('bead'); return { x: b.x, y: b.y, z: b.z }; });
  await fake(1, beadLocal);
  await frame();
  await frame();
  await fake(1, beadLocal, 1, 0);
  await frame();
  await frame();
  for (let i = 1; i <= 20; i++) { await fake(1, { x: beadLocal.x, y: beadLocal.y - 0.01 * i, z: beadLocal.z }, 1, 0); await frame(); }
  await fake(1, { x: beadLocal.x, y: beadLocal.y - 0.2, z: beadLocal.z }, 0, 0);
  await new Promise((r) => setTimeout(r, 400));
  check(!(await game(() => window.__game.state.candleLit)), 'pinching the bead with the controller and pulling the cord restarts');
  await game(() => { for (const h of window.__game.hands) h.gamepad = null; });
  await new Promise((r) => setTimeout(r, 300));
  await page.keyboard.press('r');
  await new Promise((r) => setTimeout(r, 500));

  // 12. level 3: herbs on the flame, smoke, the ghost, a salt ring around the gold, the inverted vial catches it, the
  // cat gets gold eyes and the open vial, wakes and runs to the cushion
  // on easy a broken vial is replaced from the shelf, once
  await game(() => window.__game.setSetting('difficulty', 'easy'));
  await new Promise((r) => setTimeout(r, 300));
  check((await game(() => window.__game.state.spareVials)) === 1, 'easy has a spare vial on the shelf');
  await game(() => window.__game.breakVial());
  await page.waitForFunction(() => window.__game.tool('vial').active, { timeout: 10000 }).catch(() => {}); // game time runs slower than the clock on a slow machine
  check((await game(() => window.__game.tool('vial').active)) && (await game(() => window.__game.state.spareVials)) === 0 && !(await game(() => window.__game.state.vialBroken)), 'the spare vial takes the place of the broken one');
  check(colorsIn(await shot('shelf')) > 40, 'the shelf renders');
  await game(() => window.__game.setSetting('difficulty', 'normal'));
  await new Promise((r) => setTimeout(r, 300));
  await game(() => {
    const g = window.__game;
    g.goToLevel(3);
    g.state.candleLit = true;
    g.state.crucible.amounts.herb = 0.4; // as if dropped in
    g.spawnNugget('gold', 0.05, -0.2);
  });
  check((await game(() => window.__game.state.level)) === 3 && (await game(() => window.__game.tool('vial').active)), 'level 3 starts with the vial');
  check(Math.abs(await game(() => window.__game.state.vial.fill)) < 1e-9, 'the vial is empty for the ghost');
  await new Promise((r) => setTimeout(r, 3500));
  check((await game(() => window.__game.state.ghost.phase)) === 'visible', 'burning herbs make smoke and the ghost shows');
  check(colorsIn(await shot('ghost')) > 40, 'the ghost scene renders');
  // a salt ring (radius 6 cm) around the gold, with a gap first
  await game(() => {
    const g = window.__game;
    for (let a = 0.4; a < 2 * Math.PI; a += 0.02) g.puddles.add(0.05 + 0.06 * Math.cos(a), -0.2 + 0.06 * Math.sin(a), 0.005, 'salt');
  });
  await new Promise((r) => setTimeout(r, 400));
  check((await game(() => window.__game.state.ring.closed)) === false, 'a ring with a gap is open');
  await game(() => {
    const g = window.__game;
    for (let a = 0; a < 0.45; a += 0.02) g.puddles.add(0.05 + 0.06 * Math.cos(a), -0.2 + 0.06 * Math.sin(a), 0.005, 'salt');
  });
  await new Promise((r) => setTimeout(r, 600));
  check(await game(() => window.__game.state.ring.closed), 'the closed ring is seen');
  check((await game(() => window.__game.state.ghost.phase)) === 'lured', 'real gold in a closed ring lures the ghost');
  // the vial, upside down over the ring, held with the mouse (Shift + drag tilts it)
  const dragVial = async (x, z, seconds) => {
    const v = await at('vial');
    const vialAt = await game(() => { const p = window.__game.tool('vial').pos; return { x: p.x, z: p.z }; });
    const grabbed = await game((px, py) => window.__game.planePoint(px, py, 0.2), v.x, v.y); // the mouse keeps the offset between the pointer and the vial
    await moveTo(v);
    await page.mouse.down();
    const to = await game((px, pz) => window.__game.screenAt(px, 0.2, pz), x - (vialAt.x - grabbed.x), z - (vialAt.z - grabbed.z));
    await moveTo(to, 15);
    await page.keyboard.down('Shift'); // Shift + drag down tilts (the vial stays where it is); 170 px is a full tilt and stays inside the window
    await page.mouse.move(to.x, to.y + 170, { steps: 10 });
    await new Promise((r) => setTimeout(r, seconds * 1000));
    return to;
  };
  const held = await dragVial(0.05, -0.2, 2.2);
  check(await game(() => window.__game.state.ring.vialOver), 'the inverted vial over the ring is seen');
  await page.keyboard.up('Shift');
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  check((await game(() => window.__game.state.ghost.phase)) === 'trapped', 'the ghost is caught');
  await game(() => { const g = window.__game; g.spawnNugget('gold', g.layout.cat.x, g.layout.cat.z); }); // the gold onto the cat's eyes
  await new Promise((r) => setTimeout(r, 600));
  check((await game(() => window.__game.state.finale.eyes)) === 'gold' && !(await game(() => window.__game.tool('nugget').active)), 'gold on the eyes stays as the cat\'s eyes');
  await game(() => { const g = window.__game; g.tool('vial').ph.spawn({ x: 0.3, y: 0.0575, z: -0.2 }, { x: 0, y: 0, z: 0, w: 1 }); });
  await new Promise((r) => setTimeout(r, 500));
  await game(() => { // the cat lies far left: look at the middle of the table so that both it and the vial are well inside the window
    const g = window.__game;
    const o = g.view.world.position;
    g.view.controls.target.set(o.x, o.y + 0.1, o.z - 0.1);
    g.view.camera.position.set(o.x, o.y + 0.6, o.z + 0.9);
    g.view.controls.update();
  });
  await new Promise((r) => setTimeout(r, 600));
  await dragVial(-0.25, -0.28, 1.2);
  check(await game(() => window.__game.state.finale.released), 'the open vial over the cat sets the ghost free');
  await page.keyboard.up('Shift');
  await page.mouse.up();
  await page.waitForFunction(() => window.__game.state.finale.wake > 0.9, { timeout: 30000 }).catch(() => {});
  check(!(await game(() => window.__game.state.finale.alive)) && colorsIn(await shot('morph')) > 40, 'the voxels of the straw cat are walking (the morph renders)');
  await page.waitForFunction(() => window.__game.state.finale.alive, { timeout: 30000 }).catch(() => {});
  check(await game(() => window.__game.state.finale.alive), 'the cat wakes');
  check(colorsIn(await shot('cat')) > 40, 'the living cat renders');
  await new Promise((r) => setTimeout(r, 7000));
  check(await game(() => window.__game.state.finale.done), 'the cat reaches the cushion');

  // 13. the start of the game: black with the card of the first experiment, then it brightens
  await page.goto('http://127.0.0.1:5199/?test&intro', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, { timeout: 15000 });
  check((await game(() => window.__game.fade.dark)) > 0.95, 'the game starts black');
  await page.waitForFunction(() => window.__game.fade.card > 0.9, { timeout: 15000 }).catch(() => {});
  check((await game(() => window.__game.fade.card)) > 0.9, 'with the card of the first experiment');
  await page.waitForFunction(() => window.__game.fade.dark < 0.02, { timeout: 30000 }).catch(() => {});
  check((await game(() => window.__game.fade.dark)) < 0.02, 'and then it brightens');

  check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  console.log(`screenshots in ${outDir}`);
} catch (e) {
  problems.push(`crashed: ${e.message}`);
  console.error(e.message);
  for (const err of globalThis.__errors ?? []) console.error(`  browser: ${err}`);
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log('\nsmoke test passed');
