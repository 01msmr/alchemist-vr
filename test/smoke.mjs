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
  await new Promise((r) => setTimeout(r, 4200));
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
