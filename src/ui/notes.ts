import gsap from 'gsap';
import * as THREE from 'three';
import type { World } from '../three/world';

// Leader-line annotations: an HTML label placed on the stage, tied by an elbowed line to a
// point in the 3D scene. The line follows the camera every frame.

export interface NoteSpec {
  anchor: () => THREE.Vector3;
  html: string;
  /** Label position on the 1920×1080 stage, in rem (x from the left, y from the top). */
  at: [number, number];
  tone?: 'ink' | 'alarm' | 'sun' | 'blue';
}

interface Item {
  spec: NoteSpec;
  label: HTMLElement;
  g: SVGGElement;
  path: SVGPathElement;
  dot: SVGCircleElement;
  ring: SVGCircleElement;
  o: { v: number };
}

const NS = 'http://www.w3.org/2000/svg';
const scr = { x: 0, y: 0, z: 0 };

export class Notes {
  private svg: SVGSVGElement;
  private items = new Map<string, Item>();

  constructor(
    private world: World,
    private stage: HTMLElement,
  ) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('notes-lines');
    document.body.append(this.svg);
    world.onFrame((_, t) => this.update(t));
  }

  add(id: string, spec: NoteSpec) {
    const label = document.createElement('div');
    label.className = `note tone-${spec.tone ?? 'ink'}`;
    label.innerHTML = spec.html;
    label.style.left = `${spec.at[0]}rem`;
    label.style.top = `${spec.at[1]}rem`;
    this.stage.append(label);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `nl tone-${spec.tone ?? 'ink'}`);
    const path = document.createElementNS(NS, 'path');
    const ring = document.createElementNS(NS, 'circle');
    const dot = document.createElementNS(NS, 'circle');
    ring.setAttribute('class', 'ring');
    g.append(path, ring, dot);
    this.svg.append(g);
    const item = { spec, label, g, path, dot, ring, o: { v: 0 } };
    this.items.set(id, item);
    this.apply(item);
    return this;
  }

  show(id: string, on: boolean, delay = 0) {
    const it = this.items.get(id);
    if (!it) return;
    gsap.to(it.o, {
      v: on ? 1 : 0,
      duration: on ? 0.7 : 0.3,
      delay: on ? delay : 0,
      ease: on ? 'power2.out' : 'power2.in',
      overwrite: true,
      onUpdate: () => this.apply(it),
    });
  }

  hide(...ids: string[]) {
    (ids.length ? ids : [...this.items.keys()]).forEach((id) => this.show(id, false));
  }

  private apply(it: Item) {
    const v = it.o.v;
    it.label.style.opacity = String(v);
    it.label.style.visibility = v > 0.001 ? 'visible' : 'hidden';
    it.label.style.transform = `translateY(${(1 - v) * 1.2}rem)`;
    it.g.style.opacity = String(v);
  }

  private update(t: number) {
    for (const it of this.items.values()) {
      if (it.o.v < 0.001) continue;
      this.world.toScreen(it.spec.anchor(), scr);
      const r = it.label.getBoundingClientRect();
      const rem = r.height > 0 ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 10;
      const left = scr.x < r.left + r.width / 2;
      const sx = left ? r.left : r.right;
      const sy = r.top + r.height / 2;
      const kx = sx + (left ? -1 : 1) * 2.4 * rem;
      // Draw the line up to the moving end so it grows in.
      const v = it.o.v;
      const ex = kx + (scr.x - kx) * v;
      const ey = sy + (scr.y - sy) * v;
      it.path.setAttribute('d', `M${sx},${sy} L${kx},${sy} L${ex},${ey}`);
      it.dot.setAttribute('cx', String(scr.x));
      it.dot.setAttribute('cy', String(scr.y));
      it.dot.setAttribute('r', String(0.55 * rem * v));
      it.ring.setAttribute('cx', String(scr.x));
      it.ring.setAttribute('cy', String(scr.y));
      it.ring.setAttribute('r', String((1.1 + 0.5 * Math.sin(t * 3)) * rem * v));
    }
  }
}
