import * as THREE from 'three';
import type { Molecule } from '../data/molecules';
import { C, spectrum } from './world';

// Backbone frames, as AlphaFold's Structure Module sees a protein: every residue is a rigid
// triangle N–Cα–C, i.e. a local coordinate system with an origin (Cα) and an orientation.

export interface Frame {
  /** Cα position. */
  t: THREE.Vector3;
  /** Rotation from the local frame (x toward C, y in the N side of the plane) to the world. */
  q: THREE.Quaternion;
}

/** Ideal local coordinates of the three backbone atoms (Å). */
export const LOCAL = {
  ca: new THREE.Vector3(0, 0, 0),
  c: new THREE.Vector3(1.52, 0, 0),
  n: new THREE.Vector3(-0.53, 1.36, 0),
};

/** Real backbone frames of one chain: N from the atom list (first N of each residue), Cα and C from the chain. */
export function backboneFrames(mol: Molecule, chain = 0, centre = true): Frame[] {
  const ch = mol.chains[chain];
  const n = ch.seq.length;
  const firstN = new Map<number, THREE.Vector3>();
  for (const [el, ci, ri, x, y, z] of mol.atoms) if (ci === chain && el === 'N' && !firstN.has(ri)) firstN.set(ri, new THREE.Vector3(x, y, z));
  const ctr = new THREE.Vector3();
  if (centre) {
    for (let i = 0; i < n; i++) ctr.add(new THREE.Vector3().fromArray(ch.ca, i * 3));
    ctr.multiplyScalar(1 / n);
  }
  const out: Frame[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const ca = new THREE.Vector3().fromArray(ch.ca, i * 3);
    const c = new THREE.Vector3().fromArray(ch.c, i * 3);
    // Residues whose N is missing borrow the direction of the previous C.
    const nn = firstN.get(i) ?? (i > 0 ? new THREE.Vector3().fromArray(ch.c, (i - 1) * 3) : ca.clone().add(new THREE.Vector3(0, 1, 0)));
    const x = c.clone().sub(ca).normalize();
    const y = nn.clone().sub(ca);
    y.addScaledVector(x, -y.dot(x)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    m.makeBasis(x, y, z);
    out.push({ t: ca.sub(ctr), q: new THREE.Quaternion().setFromRotationMatrix(m) });
  }
  return out;
}

/** A thin triangular plate for one frame, with Cα at the origin. */
function plateGeometry(scale = 1) {
  const s = new THREE.Shape();
  const { c, n } = LOCAL;
  s.moveTo(0, 0);
  s.lineTo(c.x * scale, c.y * scale);
  s.lineTo(n.x * scale, n.y * scale);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16 * scale, bevelEnabled: true, bevelThickness: 0.05 * scale, bevelSize: 0.06 * scale, bevelSegments: 2 });
  g.translate(0, 0, -0.08 * scale);
  return g;
}

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

/** An instanced set of frame plates (one per residue), each with its own pose. */
export class FramePlates {
  mesh: THREE.InstancedMesh;
  pose: Frame[];
  scale: number[];
  readonly n: number;

  constructor(n: number, o: { size?: number; color?: (i: number, out: THREE.Color) => THREE.Color } = {}) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(
      plateGeometry(o.size ?? 1.6),
      new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
      n,
    );
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, o.color ? o.color(i, c) : spectrum(i / Math.max(1, n - 1), c));
    this.mesh.frustumCulled = false;
    this.pose = Array.from({ length: n }, () => ({ t: new THREE.Vector3(), q: new THREE.Quaternion() }));
    this.scale = new Array(n).fill(1);
  }

  color(i: number, c: THREE.ColorRepresentation) {
    this.mesh.setColorAt(i, new THREE.Color(c));
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update() {
    for (let i = 0; i < this.n; i++) {
      _s.setScalar(Math.max(1e-4, this.scale[i]));
      _m.compose(this.pose[i].t, this.pose[i].q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Three arrows (x, y, z) showing a local coordinate system. */
export function axesGizmo(len = 6, r = 0.32) {
  const g = new THREE.Group();
  const cols = [C.ember, C.blue, C.sun];
  const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  dirs.forEach((d, k) => {
    const mat = new THREE.MeshStandardMaterial({ color: cols[k], roughness: 0.35 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.4, r * 6, 18), mat);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    shaft.quaternion.copy(q);
    head.quaternion.copy(q);
    shaft.position.copy(d).multiplyScalar(len / 2);
    head.position.copy(d).multiplyScalar(len + r * 3);
    g.add(shaft, head);
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 2, 20, 14), new THREE.MeshStandardMaterial({ color: C.ink })));
  return g;
}

/** A tube through a list of points (Cα trace), redrawn on demand. */
export class Trace {
  mesh: THREE.Mesh;
  private pts: THREE.Vector3[];

  constructor(
    n: number,
    private radius = 0.4,
    material: THREE.Material = new THREE.MeshStandardMaterial({ color: '#8fa3b8', roughness: 0.5 }),
  ) {
    this.pts = Array.from({ length: n }, () => new THREE.Vector3());
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
  }

  set(points: THREE.Vector3[]) {
    points.forEach((p, i) => this.pts[i].copy(p));
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.pts), this.pts.length * 4, this.radius, 8);
  }
}
