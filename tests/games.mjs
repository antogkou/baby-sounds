// Games smoke test: node tests/games.mjs [url]
import { webkit, devices } from 'playwright';
const url = process.argv[2] || 'http://localhost:8765/';
const out = process.env.SHOTS || '/workspace/screens-baby';
const browser = await webkit.launch();
const ctx = await browser.newContext(devices['iPhone 15 Pro']);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const nodes = () => page.evaluate('window.__baby.activeNodes');
const cur = () => page.evaluate('window.__games.current');
const tapCenter = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

await page.goto(url, { waitUntil: 'networkidle' });
ok(await page.isVisible('#go-games'), 'home has Games card');
await page.click('#go-games');
await page.waitForSelector('#games', { state: 'visible' });
ok((await page.locator('.game-tile').count()) === 6, '6 game tiles');
await page.screenshot({ path: `${out}/5-games-menu.png` });

// toddler lock: a quick tap on back does not leave
await page.click('[data-game=animals]');
ok((await cur()) === 'animals', 'animals game starts');
await page.click('#games-back');
await page.waitForTimeout(300);
ok((await cur()) === 'animals' && await page.isVisible('#hold-tip'), 'quick tap on back stays in game and shows hold tip');
await tapCenter('.animal[data-a=cow]');
await page.waitForTimeout(100);
ok((await nodes()) > 0, `animal sound plays (${await nodes()} nodes)`);
await page.mouse.click(5, 400); // tap the edge of the screen
ok((await cur()) === 'animals', 'tapping elsewhere stays in game');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/6-game-animals.png` });
// long-press back -> menu
const bb = await page.locator('#games-back').boundingBox();
await page.mouse.move(bb.x + 24, bb.y + 24); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();
ok((await cur()) === null && await page.isVisible('#game-menu'), 'press-and-hold back returns to menu');

// balloons
await page.click('[data-game=balloons]');
await page.waitForTimeout(1500);
// find a balloon by sampling taps across the canvas until one pops
const popped = await page.evaluate(() => true);
const cb = await page.locator('.gcv').boundingBox();
let popNodes = 0;
for (let y = cb.y + 40; y < cb.y + cb.height && !popNodes; y += 30) for (let x = cb.x + 30; x < cb.x + cb.width; x += 30) {
  await page.mouse.click(x, y); const n = await nodes(); if (n > 2) { popNodes = n; break; }
}
ok(popNodes > 0, 'balloons: tapping makes sound');
await page.screenshot({ path: `${out}/7-game-balloons.png` });

const hold = async () => { await page.mouse.move(bb.x + 24, bb.y + 24); await page.mouse.down(); await page.waitForTimeout(1150); await page.mouse.up(); };
await hold();

// colours
await page.click('[data-game=colours]');
ok((await page.locator('.choice').count()) === 3, 'colours: 3 choices');
const target = await page.evaluate(() => document.querySelector('.swatch').style.background);
const fills = await page.$$eval('.choice svg', (s) => s.map((x) => x.getAttribute('fill')));
console.log('  target', target, 'choices', fills.join(','));
await page.locator('.choice').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/8-game-colours.png` });
await hold();

// paint
await page.click('[data-game=paint]');
const pb = await page.locator('.paper canvas').boundingBox();
await page.mouse.move(pb.x + 40, pb.y + 60); await page.mouse.down();
for (let i = 0; i < 20; i++) await page.mouse.move(pb.x + 40 + i * 14, pb.y + 60 + Math.sin(i / 3) * 80);
await page.mouse.up();
await page.click('.sw[data-c=blue]');
await page.mouse.move(pb.x + 60, pb.y + 300); await page.mouse.down();
for (let i = 0; i < 20; i++) await page.mouse.move(pb.x + 60 + i * 12, pb.y + 300 - i * 6);
await page.mouse.up();
await page.click('.sw.rainbow');
await page.mouse.move(pb.x + 50, pb.y + 200); await page.mouse.down();
for (let i = 0; i < 30; i++) await page.mouse.move(pb.x + 50 + i * 9, pb.y + 200 + Math.cos(i / 4) * 50);
await page.mouse.up();
const painted = await page.evaluate(() => { const c = document.querySelector('.paper canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
ok(painted > 1000, `paint: strokes drawn (${painted} px)`);
await page.screenshot({ path: `${out}/9-game-paint.png` });
await page.click('.sw.clear');
const cleared = await page.evaluate(() => { const c = document.querySelector('.paper canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
ok(cleared === 0, 'paint: clear empties canvas');
await hold();

// counting
await page.click('[data-game=count]');
const n = await page.locator('.thing').count();
for (let i = 0; i < n; i++) await page.locator('.thing').nth(i).click();
ok((await page.textContent('.count-num')).trim() === String(n), `count: counted ${n}`);
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/10-game-count.png` });
await page.waitForTimeout(2600);
ok((await page.locator('.thing.counted').count()) === 0, 'count: next round starts');
await hold();

// hide & seek
await page.click('[data-game=peekaboo]');
await page.waitForTimeout(400);
const idx = await page.evaluate(() => [...document.querySelectorAll('.critter')].findIndex((c) => c.textContent));
const wrong = (idx + 1) % 3;
await page.locator('.bush').nth(wrong).click();
ok(!(await page.locator('.bush.found').count()), 'hide&seek: wrong bush is gentle (no reveal)');
await page.locator('.bush').nth(idx).click();
await page.waitForTimeout(700);
ok((await page.locator('.bush.found').count()) === 1, 'hide&seek: animal found');
await page.screenshot({ path: `${out}/11-game-hide.png` });
await page.click('[data-lang=el]:visible');
ok((await page.textContent('#games-title')) === 'Κρυφτό', 'Greek title in game');
await page.click('[data-lang=en]:visible');
await hold(); await page.waitForTimeout(200); await hold();
await page.waitForTimeout(300);
ok(await page.isVisible('#home'), 'press-and-hold from menu returns home');
ok((await nodes()) === 0, 'leaving games stops all sound');
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
