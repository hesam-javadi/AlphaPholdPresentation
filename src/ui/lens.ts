import gsap from 'gsap';
import * as THREE from 'three';
import type { World } from '../three/world';

// A magnifier callout: a soft beam from a box in the 3D scene (one module of the Evoformer
// figure) to a panel on the stage where that box is opened up and explained.

const NS = 'http://www.w3.org/2000/svg';
const scr = { x: 0, y: 0, z: 0 };

export interface LensSpec {
  /** World-space corners of the thing being magnified. */
  from: () => THREE.Vector3[];
  /** Panel on the 1920×1080 stage, in rem: x, y (from top-left), width, height. */
  to: [number, number, number, number];
}

type P = [number, number];

export class Lens {
  private svg: SVGSVGElement;
  private beam: SVGPathElement;
  private edges: SVGPathElement;
  private panel: SVGRectElement;
  private box: SVGRectElement;
  private spec?: LensSpec;
  private o = { v: 0 };

  constructor(private world: World) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lens');
    this.svg.innerHTML = /* svg */ `
      <defs>
        <linearGradient id="lens-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#0053d6" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#0053d6" stop-opacity="0.03"/>
        </linearGradient>
      </defs>
      <path class="lens-beam" fill="url(#lens-fill)"/>
      <path class="lens-edges"/>
      <rect class="lens-panel" rx="18"/>
      <rect class="lens-box" rx="8"/>`;
    document.body.append(this.svg);
    this.beam = this.svg.querySelector('.lens-beam')!;
    this.edges = this.svg.querySelector('.lens-edges')!;
    this.panel = this.svg.querySelector('.lens-panel')!;
    this.box = this.svg.querySelector('.lens-box')!;
    this.svg.style.opacity = '0';
    world.onFrame(() => this.update());
  }

  /** Point the lens somewhere else; it glides there if it is already showing. */
  set(spec: LensSpec) {
    this.spec = spec;
  }

  show(on: boolean, delay = 0) {
    gsap.to(this.o, {
      v: on ? 1 : 0,
      duration: on ? 0.8 : 0.35,
      delay: on ? delay : 0,
      ease: on ? 'power2.out' : 'power2.in',
      overwrite: true,
      onUpdate: () => void (this.svg.style.opacity = String(this.o.v)),
    });
  }

  private update() {
    if (!this.spec || this.o.v < 0.001) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const ox = (innerWidth - 192 * rem) / 2;
    const oy = (innerHeight - 108 * rem) / 2;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of this.spec.from()) {
      this.world.toScreen(c, scr);
      x0 = Math.min(x0, scr.x);
      y0 = Math.min(y0, scr.y);
      x1 = Math.max(x1, scr.x);
      y1 = Math.max(y1, scr.y);
    }
    const pad = 0.5 * rem;
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    const [tx, ty, tw, th] = this.spec.to;
    const px0 = ox + tx * rem;
    const py0 = oy + ty * rem;
    const px1 = px0 + tw * rem;
    const py1 = py0 + th * rem;
    // The panel sits above the box: the beam joins the box's top edge to the panel's bottom
    // edge, so it never crosses the text column beside the panel.
    const quad: P[] = [
      [px0, py1],
      [px1, py1],
      [x1, y0],
      [x0, y0],
    ];
    this.beam.setAttribute('d', `M${quad.map((p) => p.join(',')).join('L')}Z`);
    this.edges.setAttribute('d', `M${px0},${py1}L${x0},${y0}M${px1},${py1}L${x1},${y0}`);
    this.panel.setAttribute('x', String(px0));
    this.panel.setAttribute('y', String(py0));
    this.panel.setAttribute('width', String(px1 - px0));
    this.panel.setAttribute('height', String(py1 - py0));
    this.box.setAttribute('x', String(x0));
    this.box.setAttribute('y', String(y0));
    this.box.setAttribute('width', String(x1 - x0));
    this.box.setAttribute('height', String(y1 - y0));
  }
}
