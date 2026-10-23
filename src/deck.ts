import gsap from 'gsap';

// Tiny presentation engine. A deck is a list of scenes; each scene owns a number of build steps.
// Works with clickers (PageUp/PageDown), arrows and space. The URL hash keeps your place (#scene.step).

/** `?capture`: headless screenshot runs (software WebGL, very slow frames). */
export const capture = new URLSearchParams(location.search).has('capture');

// In dev (or a capture run) frames can be throttled or slow; keep animations on real time.
if (import.meta.env.DEV || capture) gsap.ticker.lagSmoothing(0);

export type Dir = 1 | -1;

export interface Scene {
  id: string;
  /** Short name for the progress chain. */
  label: string;
  /** Running head shown at the top while this scene is on screen. */
  head?: { num?: string; title: string };
  /** First scene of a chapter: the progress chain leaves a gap before it. */
  chapter?: boolean;
  /** Number of build steps (default 1). */
  steps?: number;
  enter(step: number, dir: Dir): void;
  step?(step: number, dir: Dir): void;
  leave(dir: Dir): void;
}

const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N']);
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P']);

export class Deck {
  scene = -1;
  step = 0;
  onChange?: (scene: number, step: number) => void;
  private blank: HTMLElement;

  constructor(readonly scenes: Scene[]) {
    window.addEventListener('keydown', this.onKey);
    this.blank = document.createElement('div');
    this.blank.className = 'blank';
    document.body.append(this.blank);
    this.idleCursor();
  }

  start() {
    const m = /#(\d+)(?:\.(\d+))?/.exec(location.hash);
    const scene = m ? Math.min(+m[1] - 1, this.scenes.length - 1) : 0;
    const step = m?.[2] ? Math.min(+m[2] - 1, (this.scenes[scene].steps ?? 1) - 1) : 0;
    this.goto(Math.max(0, scene), Math.max(0, step), 1);
  }

  next() {
    const s = this.scenes[this.scene];
    if (this.step < (s.steps ?? 1) - 1) {
      this.step++;
      s.step?.(this.step, 1);
      this.changed();
    } else if (this.scene < this.scenes.length - 1) {
      this.goto(this.scene + 1, 0, 1);
    }
  }

  prev() {
    const s = this.scenes[this.scene];
    if (this.step > 0) {
      this.step--;
      s.step?.(this.step, -1);
      this.changed();
    } else if (this.scene > 0) {
      const p = this.scenes[this.scene - 1];
      this.goto(this.scene - 1, (p.steps ?? 1) - 1, -1);
    }
  }

  goto(i: number, step = 0, dir?: Dir) {
    const d: Dir = dir ?? (i >= this.scene ? 1 : -1);
    if (i === this.scene) {
      if (step === this.step) return;
      this.step = step;
      this.scenes[i].step?.(step, d);
      this.changed();
      return;
    }
    if (this.scene >= 0) this.scenes[this.scene].leave(d);
    this.scene = i;
    this.step = step;
    this.scenes[i].enter(step, d);
    this.changed();
  }

  private changed() {
    history.replaceState(null, '', `#${this.scene + 1}.${this.step + 1}`);
    document.body.dataset.scene = this.scenes[this.scene].id;
    document.body.dataset.step = String(this.step);
    this.onChange?.(this.scene, this.step);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (NEXT.has(e.key)) {
      e.preventDefault();
      this.next();
    } else if (PREV.has(e.key)) {
      e.preventDefault();
      this.prev();
    } else if (e.key === 'Home') {
      this.goto(0, 0, -1);
    } else if (e.key === 'End') {
      const last = this.scenes.length - 1;
      this.goto(last, (this.scenes[last].steps ?? 1) - 1, 1);
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    } else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
      // Clickers' "blank screen" button sends "." or "b".
      this.blank.classList.toggle('is-on');
    }
  };

  private idleCursor() {
    let t = 0;
    const wake = () => {
      document.body.classList.remove('is-idle');
      clearTimeout(t);
      t = window.setTimeout(() => document.body.classList.add('is-idle'), 2500);
    };
    window.addEventListener('pointermove', wake);
    wake();
  }
}

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
