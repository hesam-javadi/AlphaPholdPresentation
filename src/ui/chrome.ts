import gsap from 'gsap';
import * as THREE from 'three';
import type { Deck } from '../deck';
import { fa } from '../content';
import { spectrum, type World } from '../three/world';

// Persistent design chrome: a running head, the progress chain, and a figure caption
// with a live scale bar measured from the 3D camera.

export interface CaptionSpec {
  name: string;
  detail?: string;
  /** World point the scale bar is measured at (usually the molecule's centre). */
  at?: () => THREE.Vector3;
}

const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500];

export class Chrome {
  private head: HTMLElement;
  private beads: HTMLElement[] = [];
  private cap: HTMLElement;
  private bar: HTMLElement;
  private barLabel: HTMLElement;
  private capAt?: () => THREE.Vector3;
  private toastEl: HTMLElement;
  private deck!: Deck;

  constructor(private world: World) {
    document.body.insertAdjacentHTML(
      'beforeend',
      /* html */ `
      <div class="stage chrome">
        <header class="runhead" aria-live="polite"><b class="rh-num"></b><span class="rh-title"></span></header>
        <nav class="progress" aria-label="بخش‌های ارائه"></nav>
        <figure class="caption">
          <div class="cap-scale"><i></i><span></span></div>
          <figcaption><b></b><span></span></figcaption>
        </figure>
      </div>
      <div class="toast" role="status"></div>`,
    );
    this.head = document.querySelector('.runhead')!;
    this.cap = document.querySelector('.caption')!;
    this.bar = this.cap.querySelector('.cap-scale i')!;
    this.barLabel = this.cap.querySelector('.cap-scale span')!;
    this.toastEl = document.querySelector('.toast')!;
    gsap.set([this.head, this.cap], { autoAlpha: 0 });
    world.onFrame(() => this.measure());
  }

  /** Build the progress chain once the deck exists. */
  bind(deck: Deck) {
    this.deck = deck;
    const nav = document.querySelector('.progress')!;
    deck.scenes.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = `pg-bead${s.chapter ? ' is-chapter' : ''}`;
      b.title = s.label;
      b.setAttribute('aria-label', s.label);
      b.style.setProperty('--c', `#${spectrum(i / (deck.scenes.length - 1)).getHexString()}`);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        b.blur();
        deck.goto(i, 0);
      });
      nav.append(b);
      this.beads.push(b);
    });
  }

  /** Called on every scene or step change. */
  update(scene: number, step: number) {
    const steps = this.deck.scenes[scene].steps ?? 1;
    this.beads.forEach((b, i) => {
      b.classList.toggle('is-done', i < scene);
      b.classList.toggle('is-current', i === scene);
      b.style.setProperty('--p', String(i === scene ? (step + 1) / steps : i < scene ? 1 : 0));
    });
    const head = this.deck.scenes[scene].head;
    const num = this.head.querySelector('.rh-num')!;
    const title = this.head.querySelector('.rh-title')!;
    if (!head) {
      gsap.to(this.head, { autoAlpha: 0, duration: 0.4 });
      return;
    }
    if (title.textContent === head.title && num.textContent === (head.num ?? '')) return;
    gsap
      .timeline()
      .to(this.head, { autoAlpha: 0, x: 20, duration: 0.25 })
      .add(() => {
        num.textContent = head.num ?? '';
        num.toggleAttribute('hidden', !head.num);
        title.textContent = head.title;
      })
      .to(this.head, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' });
  }

  caption(spec: CaptionSpec | null, delay = 0.6) {
    if (!spec) {
      gsap.to(this.cap, { autoAlpha: 0, duration: 0.3, overwrite: true });
      this.capAt = undefined;
      return;
    }
    gsap
      .timeline()
      .to(this.cap, { autoAlpha: 0, duration: 0.2, overwrite: true })
      .add(() => {
        this.cap.querySelector('b')!.textContent = spec.name;
        // Keep "PDB 1ABC" together when a long caption wraps in right-to-left text.
        this.cap.querySelector('figcaption span')!.textContent = (spec.detail ?? '').replace(/PDB /g, 'PDB ');
        this.capAt = spec.at;
        this.cap.classList.toggle('has-scale', !!spec.at);
      })
      .to(this.cap, { autoAlpha: 1, duration: 0.6, delay }, '>');
  }

  /** A scale bar that stays honest while the camera moves. */
  private measure() {
    if (!this.capAt) return;
    const p = this.capAt();
    const perA = this.world.pixelSize(p, 1);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const target = 14 * rem;
    let best = NICE[0];
    for (const n of NICE) if (n * perA <= target) best = n;
    this.bar.style.width = `${best * perA}px`;
    const label = `${fa(best)} آنگستروم`;
    if (this.barLabel.textContent !== label) this.barLabel.textContent = label;
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    gsap.fromTo(this.toastEl, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.4 });
    gsap.to(this.toastEl, { autoAlpha: 0, duration: 0.6, delay: 3 });
  }
}
