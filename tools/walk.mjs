// Walk the whole deck like a presenter (one PageDown at a time) and screenshot every step.
// Setup once:  cd tools && npm i puppeteer-core@23.11.1
// Usage:       node walk.mjs URL OUTDIR [WIDTHxHEIGHT] [FROM_SCENE] [TO_SCENE] [WAIT_MS]
// Example:     node walk.mjs http://localhost:5173/ ../.shots/all 1600x900 1 999 4800
// Uses the installed Chrome with software WebGL; the page is opened with ?capture
// (disables lag smoothing, auto-quality fallback and ambient occlusion for reliable captures).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const [url, outDir, size = '1600x900', from = '1', to = '999', waitArg = '4800'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const wait = Number(waitArg);
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  userDataDir: path.join(outDir, '.profile'),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--window-size=${W},${H}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  protocolTimeout: 600000,
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${url}?capture#${from}.1`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.deck && document.querySelector('.loader') === null, { timeout: 300000 });
await new Promise((r) => setTimeout(r, wait));

const total = await page.evaluate(() => window.deck.scenes.length);
const last = Math.min(Number(to), total);
for (;;) {
  const { scene, step, id } = await page.evaluate(() => ({ scene: window.deck.scene, step: window.deck.step, id: window.deck.scenes[window.deck.scene].id }));
  const name = `${String(scene + 1).padStart(2, '0')}.${step + 1}_${id}.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  console.log('shot', name, errors.length ? `errors: ${errors.splice(0).join(' | ')}` : '');
  const done = await page.evaluate((last) => {
    const d = window.deck;
    return d.scene + 1 >= last && d.step >= (d.scenes[d.scene].steps ?? 1) - 1;
  }, last);
  if (done) break;
  await page.keyboard.press('PageDown');
  await new Promise((r) => setTimeout(r, wait));
}
await browser.close();
console.log('done');
