import * as THREE from 'three';
import gsap from 'gsap';
import { MOL } from '../data/molecules';
import { C, spectrum } from './world';

const UBQ = MOL.ubiquitin;
export const N = UBQ.chains[0].seq.length;
export const SEQ = UBQ.chains[0].seq;
export const FOLDED = new Float32Array(UBQ.chains[0].ca);
const CA_STEP = 3.8;

/** A straight chain: residue 0 at `origin`, one Cα step at a time along `dir`. */
export function linePose(origin: THREE.Vector3, dir: THREE.Vector3, step = CA_STEP) {
  const out = new Float32Array(N * 3);
  const d = dir.clone().normalize();
  for (let i = 0; i < N; i++) {
    out[i * 3] = origin.x + d.x * step * i;
    out[i * 3 + 1] = origin.y + d.y * step * i;
    out[i * 3 + 2] = origin.z + d.z * step * i;
  }
  return out;
}

const IDQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// ---------------------------------------------------------------------------
// The chain: 76 beads (the Cα atoms of ubiquitin) joined by bonds.
// ---------------------------------------------------------------------------
export class Chain {
  group = new THREE.Group();
  beads: THREE.InstancedMesh;
  bonds: THREE.InstancedMesh;
  pos = new Float32Array(FOLDED);
  scale = Array.from({ length: N }, () => ({ s: 0 }));
  focus = { i: -1, k: 0 };
  radius = 1.38;
  bondR = 0.5;
  spin = true;
  spinSpeed = 0.16;
  private morphTween?: gsap.core.Tween;

  constructor() {
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.16 });
    this.beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 40, 24), mat, N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) this.beads.setColorAt(i, spectrum(i / (N - 1), c));
    this.bonds = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.4 }),
      N - 1,
    );
    this.beads.frustumCulled = this.bonds.frustumCulled = false;
    this.group.add(this.beads, this.bonds);
  }

  /** Move every bead to `target`; the wave travels along the chain. */
  morph(
    target: Float32Array,
    o: { duration?: number; stagger?: number; swirl?: number; ease?: string; reverse?: boolean; delay?: number } = {},
  ) {
    this.morphTween?.kill();
    const from = this.pos.slice();
    const S = o.stagger ?? 0.6;
    const ease = gsap.parseEase(o.ease ?? 'power3.inOut');
    const swirl = Array.from({ length: N }, () => new THREE.Vector3().randomDirection().multiplyScalar(o.swirl ?? 0));
    const st = { p: 0 };
    this.morphTween = gsap.to(st, {
      p: 1,
      duration: o.duration ?? 2.2,
      delay: o.delay ?? 0,
      ease: 'none',
      onUpdate: () => {
        for (let i = 0; i < N; i++) {
          const k = o.reverse ? (N - 1 - i) / (N - 1) : i / (N - 1);
          const t = Math.min(1, Math.max(0, st.p * (1 + S) - k * S));
          const e = ease(t);
          const arc = Math.sin(Math.PI * e);
          const w = swirl[i];
          this.pos[i * 3] = from[i * 3] + (target[i * 3] - from[i * 3]) * e + w.x * arc;
          this.pos[i * 3 + 1] = from[i * 3 + 1] + (target[i * 3 + 1] - from[i * 3 + 1]) * e + w.y * arc;
          this.pos[i * 3 + 2] = from[i * 3 + 2] + (target[i * 3 + 2] - from[i * 3 + 2]) * e + w.z * arc;
        }
      },
    });
    return this.morphTween;
  }

  place(target: Float32Array) {
    this.morphTween?.kill();
    this.pos.set(target);
  }

  private showTween?: gsap.core.Tween;

  show(on: boolean, o: { duration?: number; stagger?: number; delay?: number; from?: 'start' | 'end' } = {}) {
    // Kill the last tween by reference: killTweensOf misses delayed tweens with an object stagger.
    this.showTween?.kill();
    gsap.killTweensOf(this.scale);
    return (this.showTween = gsap.to(this.scale, {
      s: on ? 1 : 0,
      duration: o.duration ?? 0.7,
      delay: o.delay ?? 0,
      ease: on ? 'back.out(2.2)' : 'power2.in',
      stagger: { amount: o.stagger ?? 0.8, from: o.from ?? 'start' },
    }));
  }

  get visible() {
    return this.scale.some((b) => b.s > 0.01);
  }

  /** Straighten the chain's own rotation (used before showing a line). */
  settle(duration = 1.6) {
    this.spin = false;
    const r = this.group.rotation;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    r.set(wrap(r.x), wrap(r.y), wrap(r.z));
    return gsap.to(r, { x: 0, y: 0, z: 0, duration, ease: 'power3.inOut', overwrite: 'auto' });
  }

  worldPos(i: number, out = new THREE.Vector3()) {
    return this.group.localToWorld(out.fromArray(this.pos, i * 3));
  }

  /** Centre of the beads in world space. */
  centre(out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    for (let i = 0; i < N; i++) out.add(_v.fromArray(this.pos, i * 3));
    return this.group.localToWorld(out.multiplyScalar(1 / N));
  }

  update(dt: number) {
    if (this.spin) this.group.rotation.y += dt * this.spinSpeed;
    // Only the beads hide; ribbons and atoms hung on the same group keep their own visibility.
    const vis = this.visible;
    this.beads.visible = this.bonds.visible = vis;
    if (!vis) return;
    for (let i = 0; i < N; i++) {
      _v.fromArray(this.pos, i * 3);
      const boost = i === this.focus.i ? 1 + this.focus.k * 0.9 : 1;
      _s.setScalar(Math.max(1e-5, this.radius * this.scale[i].s * boost));
      _m.compose(_v, IDQ, _s);
      this.beads.setMatrixAt(i, _m);
    }
    for (let i = 0; i < N - 1; i++) {
      _a.fromArray(this.pos, i * 3);
      _b.fromArray(this.pos, (i + 1) * 3);
      _v.addVectors(_a, _b).multiplyScalar(0.5);
      _b.sub(_a);
      const len = _b.length() || 1e-5;
      _q.setFromUnitVectors(UP, _b.divideScalar(len));
      const k = Math.min(this.scale[i].s, this.scale[i + 1].s);
      _s.set(Math.max(1e-5, this.bondR * k), len, Math.max(1e-5, this.bondR * k));
      _m.compose(_v, _q, _s);
      this.bonds.setMatrixAt(i, _m);
    }
    this.beads.instanceMatrix.needsUpdate = true;
    this.bonds.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Full-atom model: every bead opens up into the atoms of its residue.
// ---------------------------------------------------------------------------
export const ELEMENT: Record<string, { c: string; r: number }> = {
  C: { c: '#7d8a99', r: 1.05 },
  N: { c: '#2453d6', r: 1.0 },
  O: { c: '#e5412d', r: 0.98 },
  S: { c: '#f2c230', r: 1.25 },
};

export class Atoms {
  mesh: THREE.InstancedMesh;
  state = { t: 0 };
  private ease = gsap.parseEase('power3.out');

  constructor(private chain: Chain) {
    const atoms = UBQ.atoms;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.35 }),
      atoms.length,
    );
    const c = new THREE.Color();
    atoms.forEach(([el], i) => this.mesh.setColorAt(i, c.set((ELEMENT[el] ?? ELEMENT.C).c)));
    this.mesh.frustumCulled = false;
    chain.group.add(this.mesh);
  }

  reveal(on: boolean) {
    gsap.killTweensOf(this.state);
    return gsap.to(this.state, { t: on ? 1 : 0, duration: on ? 2.4 : 1.1, ease: 'none' });
  }

  update() {
    const t = this.state.t;
    this.mesh.visible = t > 0.001;
    if (!this.mesh.visible) return;
    const atoms = UBQ.atoms;
    for (let i = 0; i < atoms.length; i++) {
      const [el, , r, x, y, z] = atoms[i];
      const local = Math.min(1, Math.max(0, t * 1.5 - (r / N) * 0.5));
      const e = this.ease(local);
      _a.fromArray(this.chain.pos, r * 3);
      _v.set(_a.x + (x - _a.x) * e, _a.y + (y - _a.y) * e, _a.z + (z - _a.z) * e);
      _s.setScalar(Math.max(1e-5, (ELEMENT[el] ?? ELEMENT.C).r * e));
      _m.compose(_v, IDQ, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Dust: loose particles that draw words and numerals, then become the chain.
// ---------------------------------------------------------------------------
export class Dust {
  mesh: THREE.InstancedMesh;
  readonly count: number;
  cur: Float32Array;
  size: Float32Array;
  private from: Float32Array;
  private to: Float32Array;
  private sFrom: Float32Array;
  private sTo: Float32Array;
  private delay: Float32Array;
  private st = { p: 1 };
  private lastP = 1;
  private dur = 1;
  private ease = gsap.parseEase('expo.out');
  private tween?: gsap.core.Tween;
  radius = 0.38;

  constructor(count: number) {
    this.count = count;
    this.cur = new Float32Array(count * 3);
    this.from = new Float32Array(count * 3);
    this.to = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.sFrom = new Float32Array(count);
    this.sTo = new Float32Array(count);
    this.delay = new Float32Array(count);
    for (let i = 0; i < count; i++) _v.randomDirection().multiplyScalar(90 + Math.random() * 90).toArray(this.cur, i * 3);
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      count,
    );
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      this.mesh.setColorAt(i, r < 0.78 ? c.copy(C.ink) : r < 0.94 ? c.copy(C.blue) : c.copy(C.sky));
    }
    this.mesh.frustumCulled = false;
  }

  /** Fly every particle to `targets` (count×3), growing or shrinking to `scale`. */
  flyTo(
    targets: Float32Array,
    scale: number,
    o: { duration?: number; spread?: number; ease?: string; delay?: number; order?: Float32Array } = {},
  ) {
    this.tween?.kill();
    this.from.set(this.cur);
    this.sFrom.set(this.size);
    this.to.set(targets);
    this.sTo.fill(scale);
    const spread = o.spread ?? 1;
    for (let i = 0; i < this.count; i++) this.delay[i] = (o.order ? o.order[i] : Math.random()) * spread;
    this.dur = o.duration ?? 2;
    this.ease = gsap.parseEase(o.ease ?? 'expo.out');
    this.st.p = 0;
    this.tween = gsap.to(this.st, { p: this.dur + spread, duration: this.dur + spread, delay: o.delay ?? 0, ease: 'none' });
    return this.tween;
  }

  scatter(o: { duration?: number; around?: THREE.Vector3 } = {}) {
    const t = new Float32Array(this.count * 3);
    const c = o.around ?? new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      _v.fromArray(this.cur, i * 3).sub(c);
      if (_v.lengthSq() < 1) _v.randomDirection();
      _v.normalize().multiplyScalar(110 + Math.random() * 80).add(c);
      _v.toArray(t, i * 3);
    }
    return this.flyTo(t, 0, { duration: o.duration ?? 1.4, spread: 0.4, ease: 'power3.in' });
  }

  get visible() {
    return this.mesh.visible;
  }

  update(time: number) {
    const p = this.st.p;
    const animating = p !== this.lastP;
    this.lastP = p;
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (animating) {
        const t = Math.min(1, Math.max(0, (p - this.delay[i]) / this.dur));
        const e = this.ease(t);
        for (let a = 0; a < 3; a++) this.cur[i * 3 + a] = this.from[i * 3 + a] + (this.to[i * 3 + a] - this.from[i * 3 + a]) * e;
        this.size[i] = this.sFrom[i] + (this.sTo[i] - this.sFrom[i]) * e;
      }
      if (this.size[i] > 0.001) any = true;
      const wob = Math.sin(time * 0.9 + i * 1.7) * 0.07;
      _v.set(this.cur[i * 3] + wob, this.cur[i * 3 + 1] + Math.cos(time * 0.7 + i) * 0.07, this.cur[i * 3 + 2]);
      _s.setScalar(Math.max(1e-5, this.size[i] * this.radius));
      _m.compose(_v, IDQ, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.visible = any;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Sample points evenly inside rendered text. Returns world-space xyz triples centred on `at`. */
export function textPoints(text: string, font: string, count: number, worldWidth: number, at = new THREE.Vector3()) {
  const W = 1800;
  const H = 900;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.fillText(text, W / 2, H / 2);
  const data = ctx.getImageData(0, 0, W, H).data;
  const inside = (x: number, y: number) => data[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 140;
  let ink = 0;
  let minX = W;
  let maxX = 0;
  let minY = H;
  let maxY = 0;
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2)
      if (inside(x, y)) {
        ink++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  const step = 2 * Math.sqrt(ink / count);
  const hits: number[] = [];
  for (let y = step / 2; y < H; y += step)
    for (let x = step / 2; x < W; x += step) {
      const jx = x + (Math.random() - 0.5) * step * 0.6;
      const jy = y + (Math.random() - 0.5) * step * 0.6;
      if (jx >= 0 && jx < W && jy >= 0 && jy < H && inside(jx, jy)) hits.push(jx, jy);
    }
  const k = worldWidth / Math.max(1, maxX - minX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const out = new Float32Array(count * 3);
  const n = hits.length / 2;
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    const j = order[i % n];
    const extra = i >= n ? step * 0.35 : 0;
    out[i * 3] = at.x + (hits[j * 2] + (Math.random() - 0.5) * extra - cx) * k;
    out[i * 3 + 1] = at.y - (hits[j * 2 + 1] + (Math.random() - 0.5) * extra - cy) * k;
    out[i * 3 + 2] = at.z + (Math.random() - 0.5) * 1.4;
  }
  return out;
}
