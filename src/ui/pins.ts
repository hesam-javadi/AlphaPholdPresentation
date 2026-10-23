import gsap from 'gsap';
import * as THREE from 'three';
import type { World } from '../three/world';

// Labels pinned to points in the 3D scene (row names, tree leaves, matrix indices…).
// Unlike notes they have no leader line: they sit on, above or beside their point.

export interface PinSpec {
  anchor: () => THREE.Vector3;
  html: string;
  cls?: string;
  /** Which side of the label touches the point. */
  align?: 'center' | 'left' | 'right' | 'above' | 'below';
  /** Extra offset in rem. */
  dx?: number;
  dy?: number;
}

interface Pin {
  spec: PinSpec;
  el: HTMLElement;
  o: { v: number };
}

const scr = { x: 0, y: 0, z: 0 };
const SHIFT: Record<NonNullable<PinSpec['align']>, string> = {
  center: 'translate(-50%, -50%)',
  left: 'translate(0, -50%)',
  right: 'translate(-100%, -50%)',
  above: 'translate(-50%, -100%)',
  below: 'translate(-50%, 0)',
};

export class Pins {
  private layer: HTMLElement;
  private items = new Map<string, Pin>();

  constructor(private world: World) {
    this.layer = document.createElement('div');
    this.layer.className = 'pins';
    this.layer.setAttribute('aria-hidden', 'true');
    document.body.append(this.layer);
    world.onFrame(() => this.update());
  }

  add(id: string, spec: PinSpec) {
    const el = document.createElement('div');
    el.className = `pin ${spec.cls ?? ''}`;
    el.innerHTML = spec.html;
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    this.layer.append(el);
    this.items.set(id, { spec, el, o: { v: 0 } });
    return this;
  }

  el(id: string) {
    return this.items.get(id)?.el;
  }

  html(id: string, html: string) {
    const it = this.items.get(id);
    if (it && it.el.innerHTML !== html) it.el.innerHTML = html;
  }

  show(ids: string | string[], on: boolean, delay = 0, stagger = 0) {
    (Array.isArray(ids) ? ids : [ids]).forEach((id, k) => {
      const it = this.items.get(id);
      if (!it) return;
      gsap.to(it.o, {
        v: on ? 1 : 0,
        duration: on ? 0.6 : 0.3,
        delay: on ? delay + k * stagger : 0,
        ease: on ? 'power2.out' : 'power2.in',
        overwrite: true,
        onUpdate: () => {
          it.el.style.opacity = String(it.o.v);
          it.el.style.visibility = it.o.v > 0.001 ? 'visible' : 'hidden';
        },
      });
    });
  }

  /** Hide every pin whose id starts with `prefix`. */
  hide(prefix: string) {
    this.show(
      [...this.items.keys()].filter((k) => k.startsWith(prefix)),
      false,
    );
  }

  private update() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    for (const it of this.items.values()) {
      if (it.o.v < 0.001) continue;
      this.world.toScreen(it.spec.anchor(), scr);
      const x = scr.x + (it.spec.dx ?? 0) * rem;
      const y = scr.y + (it.spec.dy ?? 0) * rem + (1 - it.o.v) * 0.8 * rem;
      it.el.style.transform = `translate(${x}px, ${y}px) ${SHIFT[it.spec.align ?? 'center']}`;
    }
  }
}
