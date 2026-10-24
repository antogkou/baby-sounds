// Smoke test: node tests/smoke.mjs [url] [engine]
import { webkit, chromium, devices } from 'playwright';
const url = process.argv[2] || 'http://localhost:8765/';
const engine = process.argv[3] || 'webkit';
const out = process.env.SHOTS || '/workspace/screens-baby';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], ...(engine === 'chromium' ? {} : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const B = (expr) => page.evaluate(`window.__baby.${expr}`);

await page.goto(url, { waitUntil: 'networkidle' });
ok(await page.isVisible('#home'), 'home renders');
await page.screenshot({ path: `${out}/1-home-${engine}.png` });

await page.click('#go-play');
await page.waitForSelector('#play', { state: 'visible', timeout: 3000 }).catch(() => {});
ok(await page.isVisible('#play') && !(await page.isVisible('#home')), 'play mode renders');
await page.waitForTimeout(600);
await page.click('[data-play=rattle]');
ok((await B('activeNodes')) > 0, `rattle starts audio nodes (${await B('activeNodes')}, ctx=${await B('ctxState')})`);
await page.click('[data-play=song]');
const n1 = await B('activeNodes');
ok(n1 > 10, `song schedules notes (${n1})`);
await page.click('[data-play=stop]');
ok((await B('activeNodes')) === 0, 'Quiet stops all nodes');
// tap a shape on the canvas
const box = await page.locator('#shapes').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.click('[data-play=chime]');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/2-play-${engine}.png` });
await page.click('#btn-peek');
await page.waitForTimeout(2600);
ok(await page.isVisible('#peek'), 'peekaboo overlay shows');
await page.screenshot({ path: `${out}/3-peekaboo-${engine}.png` });
await page.click('[data-lang=el]');
ok((await page.getAttribute('[data-lang=el]', 'aria-pressed')) === 'true', 'Greek toggle');
await page.click('[data-lang=en]');

await page.click('[data-back]:visible');
await page.waitForTimeout(300);
ok(await page.isVisible('#home'), 'back to home');
ok((await B('activeNodes')) === 0, 'leaving play stops audio');

await page.click('#go-sleep');
await page.waitForSelector('#sleep', { state: 'visible', timeout: 3000 }).catch(() => {});
ok(await page.isVisible('#sleep'), 'sleep mode renders');
const t0 = Date.now();
await page.click('[data-sound=brown]');
console.log('  brown noise built+started in', Date.now() - t0, 'ms');
await page.waitForTimeout(800);
ok(await B('mediaPlaying'), `brown noise playing via <audio> (${await B('mediaSrcKind')})`);
ok((await page.textContent('#now-timer')).includes('Stops in'), 'timer shows: ' + await page.textContent('#now-timer'));
for (const s of ['white', 'pink', 'womb', 'shush', 'waves', 'brahms', 'twinkle']) {
  const t = Date.now();
  await page.click(`[data-sound=${s}]`);
  await page.waitForTimeout(400);
  ok(await B('mediaPlaying'), `${s} plays (built in ${Date.now() - t - 400} ms)`);
}
await page.click('[data-timer="15"]');
const st = await B('sleep');
ok(Math.abs(st.endAt - Date.now() - 15 * 60000) < 5000, 'timer 15 min set');
await page.screenshot({ path: `${out}/4-sleep-${engine}.png`, fullPage: true });
// short timer: fade then stop
await page.evaluate('window.__baby.setTimerSeconds(4)');
await page.waitForTimeout(1500);
ok((await B('sleep')).fading, 'fade-out starts near the end: ' + await page.textContent('#now-timer'));
await page.waitForTimeout(5000);
ok(!(await B('mediaPlaying')) && (await B('sleep')).sound === null, 'timer stops sound');
await page.click('[data-timer="0"]');
await page.click('[data-sound=pink]');
await page.waitForTimeout(500);
ok((await page.textContent('#now-timer')).includes('no timer'), 'timer off');
await page.click('#btn-stop');
ok(!(await B('mediaPlaying')), 'Stop button stops');
await page.click('[data-sound=twinkle]');
await page.click('#btn-dim');
ok(await page.isVisible('#dimmer'), 'dimmer shows');
await page.click('#dimmer');
// service worker
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker?.getRegistration(); return r ? (r.active || r.installing || r.waiting)?.scriptURL : null; });
console.log('  service worker:', sw);
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
