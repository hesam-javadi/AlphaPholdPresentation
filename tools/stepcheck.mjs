// Step through every scene and step (forward, backward and random jumps) and report runtime errors.
// Setup once:  cd tools && npm i
// Usage:       node stepcheck.mjs URL [PAUSE_MS]
// Example:     node stepcheck.mjs http://localhost:5173/ 120
// Exits with code 1 if the page logs any error.
import puppeteer from 'puppeteer-core';

const [url, pauseArg = '120'] = process.argv.slice(2);
const pause = Number(pauseArg);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,900',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
  protocolTimeout: 600000,
});
const page = await browser.newPage();
const errors = [];
let where = 'boot';
page.on('pageerror', (e) => errors.push(`[${where}] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`[${where}] ${m.text()}`));
await page.goto(`${url}?capture#1.1`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.deck && document.querySelector('.loader') === null, { timeout: 300000 });

const at = () => page.evaluate(() => `#${window.deck.scene + 1}.${window.deck.step + 1}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const total = await page.evaluate(() => window.deck.scenes.reduce((n, s) => n + (s.steps ?? 1), 0));
console.log('steps in deck:', total);

// Forward, one step at a time, like a presenter.
for (let i = 1; i < total; i++) {
  await page.evaluate(() => window.deck.next());
  where = `next → ${await at()}`;
  await wait(pause);
}
console.log('forward done at', await at());

// Backward to the start.
for (let i = 1; i < total; i++) {
  await page.evaluate(() => window.deck.prev());
  where = `prev → ${await at()}`;
  await wait(pause);
}
console.log('backward done at', await at());

// Every scene/step by direct goto, from wherever the deck happens to be.
const list = await page.evaluate(() => window.deck.scenes.flatMap((s, i) => Array.from({ length: s.steps ?? 1 }, (_, k) => [i, k])));
for (const [i, k] of list) {
  await page.evaluate((i, k) => window.deck.goto(i, k), i, k);
  where = `goto → #${i + 1}.${k + 1}`;
  await wait(pause);
}
// Random jumps (seeded), including into the middle of scenes and backwards.
let seed = 7;
const rnd = (n) => ((seed = (seed * 16807) % 2147483647) % n);
for (let j = 0; j < 120; j++) {
  const [i, k] = list[rnd(list.length)];
  await page.evaluate((i, k) => window.deck.goto(i, k), i, k);
  where = `jump → #${i + 1}.${k + 1}`;
  await wait(pause);
}
await wait(3000);
await browser.close();
console.log(errors.length ? `ERRORS (${errors.length}):\n${errors.join('\n')}` : 'no runtime errors');
process.exit(errors.length ? 1 : 0);
