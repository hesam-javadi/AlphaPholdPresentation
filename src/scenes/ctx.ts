import gsap from 'gsap';
import * as THREE from 'three';
import type { World } from '../three/world';
import type { Chrome } from '../ui/chrome';
import type { Notes } from '../ui/notes';
import type { Pins } from '../ui/pins';
import type { Lens } from '../ui/lens';

// What every scene module receives. Each part of the talk registers an "area" with a hide
// function; entering a scene in one area tidies away the others, so jumping anywhere is safe.

export interface Ctx {
  world: World;
  chrome: Chrome;
  notes: Notes;
  pins: Pins;
  lens: Lens;
  overlay: HTMLElement;
  area(name: string): void;
  register(name: string, hide: () => void): void;
}

export function makeCtx(world: World, chrome: Chrome, notes: Notes, pins: Pins, lens: Lens, overlay: HTMLElement): Ctx {
  const areas = new Map<string, () => void>();
  let current = '';
  return {
    world,
    chrome,
    notes,
    pins,
    lens,
    overlay,
    register: (name, hide) => void areas.set(name, hide),
    area(name) {
      if (name === current) return;
      current = name;
      areas.forEach((hide, n) => n !== name && hide());
    },
  };
}

/** Grow a group in or shrink it away. */
export function pop(obj: THREE.Object3D, on: boolean, o: { duration?: number; delay?: number; scale?: number } = {}) {
  const s = o.scale ?? 1;
  gsap.killTweensOf(obj.scale);
  if (on) obj.visible = true;
  return gsap.to(obj.scale, {
    x: on ? s : 0.001,
    y: on ? s : 0.001,
    z: on ? s : 0.001,
    duration: o.duration ?? (on ? 1.2 : 0.6),
    delay: on ? (o.delay ?? 0) : 0,
    ease: on ? 'back.out(1.4)' : 'power2.in',
    overwrite: 'auto',
    onComplete: () => {
      if (!on) obj.visible = false;
    },
  });
}

/** A numbered point badge, shared by the "why" scenes. */
export const badge = (n: string) => `<span class="badge">${n}</span>`;
