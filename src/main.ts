import './style/base.css';
import '@fontsource/aref-ruqaa/700.css';
import '@fontsource-variable/jetbrains-mono';
import './style/theme.css';
import './style/part2.css';
import './style/part3.css';
import gsap from 'gsap';
import { Deck, reducedMotion, capture } from './deck';
import { cover } from './content';
import { World } from './three/world';
import { Chrome } from './ui/chrome';
import { Notes } from './ui/notes';
import { Pins } from './ui/pins';
import { Lens } from './ui/lens';
import { $ } from './ui/text';
import { makeCtx } from './scenes/ctx';
import { introScenes } from './scenes/intro';
import { whyScenes } from './scenes/why';
import { routesScenes } from './scenes/routes';
import { xrayScenes } from './scenes/xray';
import { cryoScenes } from './scenes/cryo';
import { networkScenes } from './scenes/net';
import { structureScenes } from './scenes/part3/structure';
import { trainingScenes } from './scenes/part3/training';
import { evaluationScenes } from './scenes/part3/evaluation';
import { homologyScenes } from './scenes/part1b/homology';
import { searchScenes } from './scenes/part1b/search';
import { conceptScenes } from './scenes/part1b/concepts';

if (reducedMotion) gsap.globalTimeline.timeScale(2.5);

const frame = () => new Promise((r) => setTimeout(r, 30));
const loader = $('.loader');
const bar = $('.loader i');
const progress = (p: number) => (bar.style.width = `${p * 100}%`);

async function boot() {
  const t0 = performance.now();
  const lap = (what: string) => import.meta.env.DEV && console.info(`[boot] ${what}: ${Math.round(performance.now() - t0)} ms`);
  await Promise.all([
    document.fonts.load('700 40px "Vazirmatn Variable"', 'آلفا'),
    document.fonts.load('900 40px "Vazirmatn Variable"', cover.name),
    document.fonts.load('700 40px "Aref Ruqaa"', 'سپاس'),
    document.fonts.load('700 40px "JetBrains Mono Variable"', 'MQ'),
  ]).catch(() => {});
  progress(0.15);
  await frame();

  const world = new World($<HTMLCanvasElement>('#gl'));
  // Headless capture runs use software WebGL: skip the ambient-occlusion pass to keep them quick.
  if (capture) world.setQuality('low');
  const chrome = new Chrome(world);
  const notes = new Notes(world, $('#overlay'));
  const ctx = makeCtx(world, chrome, notes, new Pins(world), new Lens(world), $('#overlay'));

  // Building surfaces and ribbons takes a moment; let the loader breathe between parts.
  const intro = introScenes(ctx);
  lap('intro');
  progress(0.3);
  await frame();
  const why = whyScenes(ctx);
  lap('why (surfaces)');
  progress(0.65);
  await frame();
  const rest = [...routesScenes(ctx), ...xrayScenes(ctx), ...cryoScenes(ctx)];
  lap('routes, x-ray, cryo');
  progress(0.75);
  await frame();
  const part1b = [...homologyScenes(ctx), ...searchScenes(ctx), ...conceptScenes(ctx)];
  lap('homology, search, concepts');
  await frame();
  const part2 = networkScenes(ctx);
  await frame();
  const part3 = [...structureScenes(ctx), ...trainingScenes(ctx), ...evaluationScenes(ctx)];
  lap('network');
  progress(0.85);
  await intro.prepare();
  await frame();
  world.warm();
  lap('shaders');
  progress(1);

  const deck = new Deck([...intro, ...why, ...rest, ...part1b, ...part2, ...part3]);
  chrome.bind(deck);
  deck.onChange = (s, step) => chrome.update(s, step);
  world.onQuality = (q) => chrome.toast(q === 'low' ? 'حالت سبک فعال شد؛ برای بازگشت کلید Q' : 'کیفیت کامل');
  addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'Q') world.setQuality(world.quality === 'high' ? 'low' : 'high');
  });

  gsap.to(loader, { autoAlpha: 0, duration: 0.8, delay: 0.2, onComplete: () => loader.remove() });
  deck.start();
  if (!capture) chrome.toast('فاصله یا PageDown: بعدی   |   F: تمام‌صفحه   |   B: صفحه‌ی خالی');

  if (import.meta.env.DEV) Object.assign(window, { world, deck });
}

boot();
