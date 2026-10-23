import gsap from 'gsap';
import * as THREE from 'three';
import { MOL } from '../../data/molecules';
import { betaOntoAlpha } from '../../data/globins';
import { Board } from '../../three/board';
import { Cartoon } from '../../three/cartoon';
import { ANCHOR, C, shot, spectrum } from '../../three/world';
import type { Ctx } from '../ctx';

// Shared stage for the network chapter. The camera stays put in front of the board, so 3D
// objects can be laid out in the same rem grid as the HTML (1rem = 1/108 of the frame height).

export const NET = ANCHOR.network;
export const NET_SHOT = shot(NET, { pz: 300 });
/** World units per rem on the z = 0 plane for NET_SHOT (35° vertical field of view). */
export const U = (2 * 300 * Math.tan(THREE.MathUtils.degToRad(17.5))) / 108;

/** Local position (relative to NET) of a point on the 1920×1080 stage, in rem. */
export const at = (xRem: number, yRem: number, z = 0) => new THREE.Vector3((xRem - 96) * U, (54 - yRem) * U, z);

/** Oblique view that shows the 48 blocks receding behind the docked board. */
export const ORBIT = shot(NET, { px: -260, py: 80, pz: 300, tx: 6, ty: -46, tz: -90, ox: -0.1, oy: -0.075 });

export type Dock = 'dock' | 'figure' | 'low';
const DOCK: Record<Dock, { y: number; s: number }> = {
  /** Lower band, under a text panel and a concept panel. */
  dock: { y: 80, s: 0.82 },
  /** Large and central: the figure is the subject. */
  figure: { y: 66, s: 0.98 },
  /** Smaller strip, when a concept needs most of the frame. */
  low: { y: 86, s: 0.66 },
};

/** A straight bead chain (the talk's protagonist) — n residues along x. */
export class BeadRow {
  group = new THREE.Group();
  beads: THREE.InstancedMesh;
  bonds: THREE.InstancedMesh;
  pos: THREE.Vector3[];
  st: { s: number }[];

  constructor(
    readonly n: number,
    readonly pitch = 6,
    readonly radius = 1.9,
  ) {
    this.beads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 32, 20),
      new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.16 }),
      n,
    );
    this.bonds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 12), new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.4 }), n - 1);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) this.beads.setColorAt(i, spectrum(i / (n - 1), c));
    this.pos = Array.from({ length: n }, (_, i) => new THREE.Vector3((i - (n - 1) / 2) * pitch, 0, 0));
    this.st = Array.from({ length: n }, () => ({ s: 0 }));
    this.beads.frustumCulled = this.bonds.frustumCulled = false;
    this.group.add(this.beads, this.bonds);
  }

  private tween?: gsap.core.Tween;

  show(on: boolean, delay = 0) {
    this.tween?.kill();
    gsap.killTweensOf(this.st);
    this.tween = gsap.to(this.st, { s: on ? 1 : 0, duration: on ? 0.6 : 0.35, delay: on ? delay : 0, stagger: on ? 0.06 : 0.02, ease: on ? 'back.out(2)' : 'power2.in' });
    return this.tween;
  }

  get visible() {
    return this.st.some((s) => s.s > 0.001);
  }

  update(t: number) {
    this.group.visible = this.visible;
    if (!this.group.visible) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const wave = (i: number) => Math.sin(t * 1.4 + i * 0.7) * 0.6;
    for (let i = 0; i < this.n; i++) {
      const s = Math.max(1e-4, this.st[i].s * this.radius);
      m.makeScale(s, s, s).setPosition(this.pos[i].x, this.pos[i].y + wave(i), this.pos[i].z);
      this.beads.setMatrixAt(i, m);
    }
    for (let i = 0; i < this.n - 1; i++) {
      const a = this.pos[i].clone().setY(this.pos[i].y + wave(i));
      const b = this.pos[i + 1].clone().setY(this.pos[i + 1].y + wave(i + 1));
      v.addVectors(a, b).multiplyScalar(0.5);
      const d = b.sub(a);
      const len = d.length();
      q.setFromUnitVectors(up, d.normalize());
      const k = Math.min(this.st[i].s, this.st[i + 1].s);
      m.compose(v, q, new THREE.Vector3(Math.max(1e-4, k), len, Math.max(1e-4, k)));
      this.bonds.setMatrixAt(i, m);
    }
    this.beads.instanceMatrix.needsUpdate = true;
    this.bonds.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Human haemoglobin α chain, centred on itself (the protein the second half follows).
 * With `beta`, the β chain superposed onto it (a real homologue, used as a template).
 */
export function alphaRibbon(o: { ghost?: boolean; beta?: boolean; color?: (chain: number, t: number, out: THREE.Color) => THREE.Color } = {}) {
  const mol = MOL.haemoglobin;
  const ci = o.beta ? 1 : 0;
  const ribbon = new Cartoon(
    mol,
    { chains: [ci], color: o.color ?? (o.ghost ? (_c, _t, out) => out.set('#6cc2ee') : undefined) },
    o.ghost ? { transparent: true, opacity: 0.8, depthWrite: false } : {},
  );
  if (o.beta) ribbon.mesh.geometry.applyMatrix4(new THREE.Matrix4().fromArray(betaOntoAlpha()).transpose());
  const ca = mol.chains[0].ca;
  const ctr = new THREE.Vector3();
  for (let i = 0; i < ca.length; i += 3) ctr.x += ca[i] / (ca.length / 3);
  for (let i = 1; i < ca.length; i += 3) ctr.y += ca[i] / (ca.length / 3);
  for (let i = 2; i < ca.length; i += 3) ctr.z += ca[i] / (ca.length / 3);
  ribbon.mesh.geometry.translate(-ctr.x, -ctr.y, -ctr.z);
  return ribbon;
}

export interface Net {
  board: Board;
  root: THREE.Group;
  /** Move the board to one of its stations. */
  dock(mode: Dock, duration?: number): void;
  /** Common entry for every scene of the chapter. */
  enter(mode: Dock, o?: { focus?: string[] | null }): void;
  /** Called every frame by the chapter's scenes. */
  onFrame(fn: (dt: number, t: number) => void): void;
  /** Register a cleanup that runs when the chapter's area is left. */
  onHide(fn: () => void): void;
}

export function makeNet(ctx: Ctx): Net {
  const { world } = ctx;
  const root = new THREE.Group();
  root.position.copy(NET);
  world.scene.add(root);
  const board = new Board();
  root.add(board.group);
  const place = DOCK.dock;
  board.group.position.copy(at(96, place.y));
  board.group.scale.setScalar(place.s);

  const hides: (() => void)[] = [];
  const frames: ((dt: number, t: number) => void)[] = [];
  world.onFrame((dt, t) => {
    board.update(t);
    frames.forEach((f) => f(dt, t));
  });

  const net: Net = {
    board,
    root,
    dock(mode, duration = 1.6) {
      const p = DOCK[mode];
      const target = at(96, p.y);
      gsap.to(board.group.position, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut', overwrite: 'auto' });
      gsap.to(board.group.scale, { x: p.s, y: p.s, z: p.s, duration, ease: 'power3.inOut', overwrite: 'auto' });
    },
    enter(mode, o = {}) {
      ctx.area('network');
      world.fly(NET_SHOT, 2.6);
      world.fogTo(380, 900);
      ctx.chrome.caption(null);
      net.dock(mode);
      if (!board.visible || board.st.build < 1) board.show(true, { delay: 0.4 });
      board.focus(o.focus ?? null);
    },
    onFrame: (fn) => void frames.push(fn),
    onHide: (fn) => void hides.push(fn),
  };

  ctx.register('network', () => {
    board.show(false);
    board.flow(false);
    board.stack(false, 0.6);
    board.focus(null);
    ctx.lens.show(false);
    hides.forEach((h) => h());
  });
  return net;
}
