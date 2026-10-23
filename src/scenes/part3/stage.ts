import gsap from 'gsap';
import * as THREE from 'three';
import { shot } from '../../three/world';
import { $, words } from '../../ui/text';
import type { Ctx } from '../ctx';

// A place in the world for one scene of part three: a root group at an anchor, a fixed
// camera (so 3D objects can be laid out in the stage's rem grid with `at`), and an area
// cleanup that runs when another part of the talk takes over.

export interface Stage {
  root: THREE.Group;
  /** World point of a local position. */
  wp: (v: THREE.Vector3) => THREE.Vector3;
  /** Fly in, set the fog, and claim the area. */
  enter(o?: { duration?: number }): void;
}

export function stageAt(ctx: Ctx, anchor: THREE.Vector3, area: string, hide: () => void): Stage {
  const root = new THREE.Group();
  root.position.copy(anchor);
  ctx.world.scene.add(root);
  ctx.register(area, hide);
  const SHOT = shot(anchor, { pz: 300 });
  return {
    root,
    wp: (v) => root.localToWorld(v.clone()),
    enter(o = {}) {
      ctx.area(area);
      ctx.world.fly(SHOT, o.duration ?? 2.6);
      ctx.world.fogTo(380, 900);
    },
  };
}

/** Bring in a section's number, title (word by word) and kicker. */
export function headIn(el: HTMLElement) {
  const num = $('.w-num', el);
  if (num) gsap.fromTo(num, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
  const t = $('.n-title', el);
  if (t?.querySelector('.w')) words(t, 0.3, 0.06);
  else if (t) gsap.fromTo(t, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.3 });
}

/** Grow an object in or out (keeps its own target scale in userData.s). */
export function grow(o: THREE.Object3D, on: boolean, delay = 0, duration?: number) {
  const s = (o.userData.s as number | undefined) ?? 1;
  gsap.killTweensOf(o.scale);
  if (on) o.visible = true;
  return gsap.to(o.scale, {
    x: on ? s : 0.001,
    y: on ? s : 0.001,
    z: on ? s : 0.001,
    duration: duration ?? (on ? 1 : 0.4),
    delay: on ? delay : 0,
    ease: on ? 'back.out(1.5)' : 'power2.in',
    onComplete: () => void (on || (o.visible = false)),
  });
}

/** Prepare an object to be grown in later. */
export function hidden<T extends THREE.Object3D>(o: T, s = o.scale.x): T {
  o.userData.s = s;
  o.scale.setScalar(0.001);
  o.visible = false;
  return o;
}

/** Deterministic pseudo-random numbers (same layout on every run). */
export function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** A canvas label as a texture (for text that must live inside the 3D scene). */
export function labelTexture(text: string, o: { w?: number; h?: number; size?: number; color?: string; weight?: number; font?: string } = {}) {
  const cv = document.createElement('canvas');
  cv.width = o.w ?? 1024;
  cv.height = o.h ?? 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = o.color ?? '#ffffff';
  let size = o.size ?? 110;
  const font = () => `${o.weight ?? 800} ${size}px ${o.font ?? '"Vazirmatn Variable", sans-serif'}`;
  g.font = font();
  // Long labels shrink to fit the plate instead of running off its edges.
  const room = cv.width * 0.92;
  const w = g.measureText(text).width;
  if (w > room) {
    size = Math.floor((size * room) / w);
    g.font = font();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'rtl';
  g.fillText(text, cv.width / 2, cv.height / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A dark rounded block with a label, like the model boxes in the paper's figures. */
export function labelledBox(text: string, w: number, h: number, d = 6, color = '#16294a', size?: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8 }));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, h * 0.8),
    new THREE.MeshBasicMaterial({ map: labelTexture(text, { w: 1024, h: Math.round((1024 * h) / w), size: size ?? Math.min(150, (1024 * h) / w / 2.2) }), transparent: true, toneMapped: false }),
  );
  label.position.z = d / 2 + 0.05;
  g.add(body, label);
  return g;
}
