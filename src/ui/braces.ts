import gsap from 'gsap';
import * as THREE from 'three';
import type { World } from '../three/world';

// Curly braces over groups of things in the 3D scene (as in a printed tree figure):
// the ends follow two world points horizontally, the brace sits at a fixed height on the stage.

const NS = 'http://www.w3.org/2000/svg';
const scr = { x: 0, y: 0, z: 0 };

export interface BraceSpec {
  from: () => THREE.Vector3;
  to: () => THREE.Vector3;
  /** Height of the brace's tips on the 1920×1080 stage, in rem from the top. */
  y: number;
  html: string;
  color?: string;
}

interface Item {
  spec: BraceSpec;
  path: SVGPathElement;
  label: HTMLElement;
  o: { v: number };
}

export class Braces {
  private svg: SVGSVGElement;
  private layer: HTMLElement;
  private items = new Map<string, Item>();

  constructor(private world: World) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('braces');
    this.layer = document.createElement('div');
    this.layer.className = 'brace-labels';
    document.body.append(this.svg, this.layer);
    world.onFrame(() => this.update());
  }

  add(id: string, spec: BraceSpec) {
    const path = document.createElementNS(NS, 'path');
    path.style.stroke = spec.color ?? '#34465e';
    path.style.opacity = '0';
    this.svg.append(path);
    const label = document.createElement('div');
    label.className = 'brace-label';
    label.innerHTML = spec.html;
    label.style.color = spec.color ?? '#34465e';
    label.style.opacity = '0';
    label.style.visibility = 'hidden';
    this.layer.append(label);
    this.items.set(id, { spec, path, label, o: { v: 0 } });
    return this;
  }

  show(id: string, on: boolean, delay = 0) {
    const it = this.items.get(id);
    if (!it) return;
    gsap.to(it.o, {
      v: on ? 1 : 0,
      duration: on ? 0.8 : 0.3,
      delay: on ? delay : 0,
      ease: on ? 'power2.out' : 'power2.in',
      overwrite: true,
      onUpdate: () => {
        it.path.style.opacity = String(it.o.v);
        it.label.style.opacity = String(it.o.v);
        it.label.style.visibility = it.o.v > 0.001 ? 'visible' : 'hidden';
      },
    });
  }

  hideAll() {
    this.items.forEach((_, id) => this.show(id, false));
  }

  private update() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const oy = (innerHeight - 108 * rem) / 2;
    for (const it of this.items.values()) {
      if (it.o.v < 0.001) continue;
      this.world.toScreen(it.spec.from(), scr);
      const xa = scr.x;
      this.world.toScreen(it.spec.to(), scr);
      const xb = scr.x;
      // The brace opens from the middle as it appears.
      const mid = (xa + xb) / 2;
      const half = (Math.abs(xb - xa) / 2) * (0.3 + 0.7 * it.o.v);
      const x0 = mid - half;
      const x1 = mid + half;
      const y = oy + it.spec.y * rem;
      const h = 1.4 * rem;
      const r = Math.min(1.4 * rem, half / 3);
      it.path.setAttribute(
        'd',
        `M${x0},${y}Q${x0},${y - h / 2} ${x0 + r},${y - h / 2}L${mid - r},${y - h / 2}Q${mid},${y - h / 2} ${mid},${y - h}` +
          `Q${mid},${y - h / 2} ${mid + r},${y - h / 2}L${x1 - r},${y - h / 2}Q${x1},${y - h / 2} ${x1},${y}`,
      );
      it.label.style.transform = `translate(${mid}px, ${y - h - 0.4 * rem}px) translate(-50%, -100%)`;
    }
  }
}
