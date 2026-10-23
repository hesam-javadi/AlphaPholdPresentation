import gsap from 'gsap';

export const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

// Consecutive Latin words (e.g. "Google DeepMind") stay in one span: separate inline-blocks
// would be reordered right-to-left by the bidi algorithm. Persian words are never split into
// letters, which would break their joining.
const PERSIAN = /[؀-ۿ]/;

export function splitWords(el: HTMLElement): HTMLElement[] {
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const tokens = (node.textContent ?? '').split(/(\s+)/).filter(Boolean);
      const merged: string[] = [];
      for (const t of tokens) {
        const prev = merged.length - 1;
        const prevWord = merged[prev - 1];
        if (/^\s+$/.test(t) || PERSIAN.test(t) || prev < 1 || !/^\s+$/.test(merged[prev]) || !prevWord || PERSIAN.test(prevWord)) {
          merged.push(t);
        } else {
          merged[prev - 1] = prevWord + merged[prev] + t;
          merged.pop();
        }
      }
      const frag = document.createDocumentFragment();
      for (const p of merged) {
        if (/^\s+$/.test(p)) frag.append(p);
        else {
          const span = document.createElement('span');
          span.className = PERSIAN.test(p) ? 'w' : 'w ltr';
          span.textContent = p;
          frag.append(span);
          words.push(span);
        }
      }
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && !(node as HTMLElement).classList.contains('w')) {
      [...node.childNodes].forEach(walk);
    }
  };
  [...el.childNodes].forEach(walk);
  return words;
}

/** Words rise into place one after another. */
export function words(el: HTMLElement, delay = 0, stagger = 0.04) {
  const ws = $$('.w', el);
  gsap.killTweensOf(ws);
  gsap.set(el, { autoAlpha: 1 });
  return gsap.fromTo(
    ws,
    { autoAlpha: 0, y: '0.35em' },
    { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger, delay },
  );
}

export function reveal(el: Element | Element[] | string, on: boolean, delay = 0) {
  if (Array.isArray(el) && !el.length) return;
  return gsap.to(el, {
    autoAlpha: on ? 1 : 0,
    y: on ? 0 : 24,
    duration: on ? 0.8 : 0.35,
    delay: on ? delay : 0,
    ease: on ? 'power3.out' : 'power2.in',
    overwrite: true,
  });
}

export function open(el: HTMLElement) {
  gsap.killTweensOf(el);
  gsap.set(el, { autoAlpha: 1 });
}

export function close(el: HTMLElement) {
  gsap.to(el, { autoAlpha: 0, duration: 0.45, ease: 'power2.out', overwrite: true });
}

/**
 * Build-step visibility for markup: an element with data-s="2" shows from step 2 on,
 * data-s="1-3" only for steps 1 to 3.
 */
export function stepVis(root: HTMLElement, step: number, delay = 0.15) {
  let k = 0;
  $$('[data-s]', root).forEach((el) => {
    const [a, b] = el.dataset.s!.split('-').map(Number);
    const on = step >= a && step <= (Number.isNaN(b) || b === undefined ? 99 : b);
    const shown = el.dataset.on === '1';
    if (on === shown) return;
    el.dataset.on = on ? '1' : '0';
    reveal(el, on, on ? delay + k++ * 0.12 : 0);
  });
}

/** Hide every stepped element (on leaving a scene). */
export function stepReset(root: HTMLElement) {
  const els = $$('[data-s]', root);
  els.forEach((e) => (e.dataset.on = '0'));
  reveal(els, false);
}

/** Make a <section> in the overlay from markup; words of `.split` elements get their own spans. */
export function section(root: HTMLElement, cls: string, html: string) {
  root.insertAdjacentHTML('beforeend', `<section class="scene ${cls}">${html}</section>`);
  const el = root.lastElementChild as HTMLElement;
  $$('.split', el).forEach(splitWords);
  gsap.set(el, { autoAlpha: 0 });
  const rv = $$('.rv, [data-s]', el);
  if (rv.length) gsap.set(rv, { autoAlpha: 0 });
  return el;
}
