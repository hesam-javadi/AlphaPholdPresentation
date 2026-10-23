import * as THREE from 'three';
import type { Ligand } from '../data/molecules';

const COLORS: Record<string, string> = {
  N: '#2453d6',
  O: '#e5412d',
  S: '#f2c230',
  Fe: '#b4561c',
  Ca: '#1f9d6b',
  P: '#ff8a1f',
  Cl: '#1fae4a',
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Small molecules (substrates, drugs, haem) as balls and sticks. Atoms can appear one by one. */
export class BallStick {
  group = new THREE.Group();
  atoms: THREE.InstancedMesh;
  bonds: THREE.InstancedMesh;
  centre = new THREE.Vector3();
  private xyz: THREE.Vector3[];
  private links: [number, number][];
  private built = -1;
  build = { p: 1 };

  constructor(
    ligs: Ligand[],
    o: { carbon?: string; atomR?: number; bondR?: number; ions?: number } = {},
  ) {
    this.xyz = [];
    this.links = [];
    const els: string[] = [];
    for (const l of ligs) {
      const base = this.xyz.length;
      l.atoms.forEach(([el, x, y, z]) => {
        this.xyz.push(new THREE.Vector3(x, y, z));
        els.push(el);
      });
      l.bonds.forEach(([i, j]) => this.links.push([base + i, base + j]));
    }
    this.xyz.forEach((v) => this.centre.add(v));
    this.centre.multiplyScalar(1 / Math.max(1, this.xyz.length));

    const atomR = o.atomR ?? 0.46;
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
    this.atoms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(atomR, 3), mat, this.xyz.length);
    const c = new THREE.Color();
    els.forEach((el, i) => {
      this.atoms.setColorAt(i, c.set(el === 'C' ? (o.carbon ?? '#3a4a60') : (COLORS[el] ?? '#9aa6b4')));
      // Lone ions (no bonds) are drawn larger.
      if (!this.links.some(([a, b]) => a === i || b === i)) this.ionScale.set(i, o.ions ?? 3);
    });
    this.bonds = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(o.bondR ?? 0.17, o.bondR ?? 0.17, 1, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: '#56657a', roughness: 0.4 }),
      Math.max(1, this.links.length),
    );
    this.atoms.frustumCulled = this.bonds.frustumCulled = false;
    this.group.add(this.atoms, this.bonds);
    this.update();
  }

  private ionScale = new Map<number, number>();

  /** Rebuild instance matrices when the build progress changes. */
  update() {
    const n = this.xyz.length;
    const shown = this.build.p * n;
    if (Math.abs(shown - this.built) < 1e-3) return;
    this.built = shown;
    this.group.visible = shown > 0.01;
    for (let i = 0; i < n; i++) {
      const s = Math.min(1, Math.max(0, shown - i)) * (this.ionScale.get(i) ?? 1);
      _s.setScalar(Math.max(1e-5, s));
      _m.compose(this.xyz[i], _q.identity(), _s);
      this.atoms.setMatrixAt(i, _m);
    }
    this.links.forEach(([i, j], k) => {
      const s = Math.min(Math.min(1, Math.max(0, shown - i)), Math.min(1, Math.max(0, shown - j)));
      _a.copy(this.xyz[i]);
      _b.copy(this.xyz[j]);
      _v.addVectors(_a, _b).multiplyScalar(0.5);
      _b.sub(_a);
      const len = _b.length();
      _q.setFromUnitVectors(UP, _b.divideScalar(len));
      _s.set(Math.max(1e-5, s), len * (s > 0 ? 1 : 1e-5), Math.max(1e-5, s));
      _m.compose(_v, _q, _s);
      this.bonds.setMatrixAt(k, _m);
    });
    this.atoms.instanceMatrix.needsUpdate = true;
    this.bonds.instanceMatrix.needsUpdate = true;
  }
}
