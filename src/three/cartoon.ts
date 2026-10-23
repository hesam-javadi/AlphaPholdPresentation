import * as THREE from 'three';
import type { Molecule } from '../data/molecules';
import { spectrum } from './world';

// Cartoon (ribbon) representation from the real backbone:
// a centripetal spline through the Cα atoms, oriented by each peptide's carbonyl (C→O),
// with a superellipse cross-section that is a flat ribbon in helices, a slab with an
// arrowhead in strands, and a round tube in loops.

export interface CartoonOptions {
  color?: (chain: number, t: number, out: THREE.Color) => THREE.Color;
  /** Samples per residue along the spline. */
  samples?: number;
  /** Vertices around the cross-section. */
  radial?: number;
  chains?: number[];
}

interface Profile {
  w: number;
  h: number;
  e: number;
}

const COIL: Profile = { w: 0.34, h: 0.34, e: 2 };
const HELIX: Profile = { w: 1.45, h: 0.26, e: 2.4 };
const SHEET: Profile = { w: 1.65, h: 0.36, e: 6 };
const ARROW = 2.7;
const prof = (s: string) => (s === 'H' ? HELIX : s === 'E' ? SHEET : COIL);
const mix = (a: Profile, b: Profile, t: number): Profile => ({ w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t, e: a.e + (b.e - a.e) * t });
const smooth = (t: number) => t * t * (3 - 2 * t);

export function cartoonGeometry(mol: Molecule, opts: CartoonOptions = {}) {
  const S = opts.samples ?? 8;
  const R = opts.radial ?? 14;
  const colorOf = opts.color ?? ((_c: number, t: number, out: THREE.Color) => spectrum(t, out));
  const pos: number[] = [];
  const col: number[] = [];
  const tt: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const T = new THREE.Vector3();
  const Nn = new THREE.Vector3();
  const B = new THREE.Vector3();
  const g = new THREE.Vector3();

  (opts.chains ?? mol.chains.map((_, i) => i)).forEach((ci) => {
    const ch = mol.chains[ci];
    const n = ch.seq.length;
    const P = Array.from({ length: n }, (_, i) => new THREE.Vector3().fromArray(ch.ca, i * 3));
    const D = Array.from({ length: n }, (_, i) =>
      new THREE.Vector3().fromArray(ch.o, i * 3).sub(new THREE.Vector3().fromArray(ch.c, i * 3)).normalize(),
    );
    for (let i = 1; i < n; i++) if (D[i].dot(D[i - 1]) < 0) D[i].negate();
    const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    const base = pos.length / 3;
    let rings = 0;

    const ring = (u: number, p: Profile) => {
      const t = u / (n - 1);
      curve.getPoint(t, v);
      curve.getTangent(t, T);
      const i = Math.min(n - 2, Math.floor(u));
      const f = u - i;
      g.copy(D[i]).lerp(D[i + 1], f);
      Nn.copy(g).addScaledVector(T, -g.dot(T));
      if (Nn.lengthSq() < 1e-6) Nn.set(0, 1, 0).addScaledVector(T, -T.y);
      Nn.normalize();
      B.crossVectors(T, Nn).normalize();
      colorOf(ci, t, c);
      for (let j = 0; j < R; j++) {
        const th = (j / R) * Math.PI * 2;
        const cx = Math.cos(th);
        const sy = Math.sin(th);
        const x = p.w * Math.sign(cx) * Math.pow(Math.abs(cx), 2 / p.e);
        const y = p.h * Math.sign(sy) * Math.pow(Math.abs(sy), 2 / p.e);
        pos.push(v.x + Nn.x * x + B.x * y, v.y + Nn.y * x + B.y * y, v.z + Nn.z * x + B.z * y);
        col.push(c.r, c.g, c.b);
        tt.push(t);
      }
      if (rings > 0) {
        const a = base + (rings - 1) * R;
        const b = base + rings * R;
        for (let j = 0; j < R; j++) {
          const j1 = (j + 1) % R;
          idx.push(a + j, b + j, a + j1, a + j1, b + j, b + j1);
        }
      }
      rings++;
    };

    for (let i = 0; i < n - 1; i++) {
      const s0 = ch.ss[i];
      const s1 = ch.ss[i + 1];
      const arrow = s0 === 'E' && s1 !== 'E';
      for (let k = 0; k < S; k++) {
        const f = k / S;
        if (arrow) {
          if (k === 0) ring(i, SHEET);
          ring(i + f, { w: ARROW * (1 - f) + COIL.w * f, h: SHEET.h + (COIL.h - SHEET.h) * f, e: SHEET.e + (COIL.e - SHEET.e) * f });
        } else ring(i + f, mix(prof(s0), prof(s1), smooth(f)));
      }
    }
    ring(n - 1, prof(ch.ss[n - 1]));

    // End caps.
    const cap = (r: number, flip: boolean) => {
      const start = base + r * R;
      const centre = pos.length / 3;
      const cx = [0, 0, 0];
      for (let j = 0; j < R; j++) for (let a = 0; a < 3; a++) cx[a] += pos[(start + j) * 3 + a] / R;
      pos.push(...cx);
      col.push(col[start * 3], col[start * 3 + 1], col[start * 3 + 2]);
      tt.push(tt[start]);
      for (let j = 0; j < R; j++) {
        const j1 = (j + 1) % R;
        if (flip) idx.push(centre, start + j1, start + j);
        else idx.push(centre, start + j, start + j1);
      }
    };
    cap(0, false);
    cap(rings - 1, true);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Shared uniforms for a molecular material: draw-on progress and a "dim" amount. */
export interface MolUniforms {
  uDraw: { value: number };
  uDim: { value: number };
}

/** A glossy material whose geometry can be drawn on along `aT`, and dimmed toward the backdrop. */
export function cartoonMaterial(extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  const uniforms: MolUniforms = { uDraw: { value: 1 }, uDim: { value: 0 } };
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    ...extra,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aT;\nvarying float vT;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvT = aT;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDraw;\nuniform float uDim;\nvarying float vT;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vT > uDraw + 0.0001) discard;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), uDim * 0.8);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0) * smoothstep(0.025, 0.0, uDraw - vT) * step(uDraw, 0.999) * 0.55;',
      );
  };
  m.customProgramCacheKey = () => 'cartoon';
  return { material: m, uniforms };
}

export class Cartoon {
  mesh: THREE.Mesh;
  uniforms: MolUniforms;

  constructor(mol: Molecule, opts: CartoonOptions = {}, material: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
    const { material: m, uniforms } = cartoonMaterial(material);
    this.uniforms = uniforms;
    this.mesh = new THREE.Mesh(cartoonGeometry(mol, opts), m);
  }

  get draw() {
    return this.uniforms.uDraw.value;
  }
  set draw(v: number) {
    this.uniforms.uDraw.value = v;
    this.mesh.visible = v > 0.001;
  }
  get dim() {
    return this.uniforms.uDim.value;
  }
  set dim(v: number) {
    this.uniforms.uDim.value = v;
  }
}
