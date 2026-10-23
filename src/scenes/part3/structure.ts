import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { chapter2, structure, frames as framesCopy, ipa, sidechain, recycling, fa } from '../../content';
import { MOL, aminoAcidFa } from '../../data/molecules';
import { Chain, ELEMENT, FOLDED, N as NRES } from '../../three/chain';
import { axesGizmo, backboneFrames, FramePlates, LOCAL, Trace, type Frame } from '../../three/frames';
import { Links } from '../../three/links';
import { flowMaterial } from '../../three/props';
import { Tiles } from '../../three/tiles';
import { ANCHOR, C } from '../../three/world';
import { tex } from '../../ui/math';
import { open, close, section, stepVis, stepReset } from '../../ui/text';
import type { Ctx } from '../ctx';
import { at } from '../net/common';
import { grow, headIn, hidden, labelledBox, rng, stageAt } from './stage';

// Chapter ۲, continued: from the Evoformer's numbers to atoms (Structure Module, frames, IPA,
// side chains) and the Recycling loop. Every scene keeps the residue-frame vocabulary:
// one triangle N–Cα–C per residue, taken from the real ubiquitin backbone.

const UBQ = MOL.ubiquitin;
const TRUE = backboneFrames(UBQ);
const easeIO = gsap.parseEase('power2.inOut');

/** Copy a pose. */
const copyFrame = (f: Frame): Frame => ({ t: f.t.clone(), q: f.q.clone() });

/** A text panel with a stepped body (first child of `.swap` per step range). */
function panel(num: string, title: string, body: string, cls = '') {
  return /* html */ `
    <div class="n-panel ${cls}">
      <p class="w-num">${num}</p>
      <h2 class="n-title n-title-sm ltr-mix">${title}</h2>
      <div class="swap">${body}</div>
    </div>`;
}

export function structureScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins, notes } = ctx;
  const head = { num: chapter2.num, title: chapter2.title };

  // =========================================================================================
  // ۳. Structure Module — eight shared-weight blocks turn a "residue gas" into a fold.
  // =========================================================================================
  const smHide: (() => void)[] = [];
  const sm = stageAt(ctx, ANCHOR.structure, 'structure', () => smHide.forEach((f) => f()));
  const prot = new THREE.Group();
  prot.position.copy(at(30, 50, 0));
  prot.scale.setScalar(2.2);
  const plates = new FramePlates(NRES, { size: 1.7 });
  const trace = new Trace(NRES, 0.35);
  trace.set(TRUE.map((f) => f.t));
  (trace.mesh.material as THREE.MeshStandardMaterial).transparent = true;
  (trace.mesh.material as THREE.MeshStandardMaterial).opacity = 0;
  prot.add(plates.mesh, trace.mesh);
  // Pose of every frame after k blocks: the gas starts at the origin ("black hole"
  // initialisation) and settles into the fold, with noise that dies away block by block.
  const r = rng(7);
  const noise = Array.from({ length: 9 }, (_, k) => TRUE.map(() => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(k === 0 ? 34 : 14)));
  const twist = Array.from({ length: 9 }, () => TRUE.map(() => new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2))));
  const stateAt = (k: number, i: number, out: Frame) => {
    const f = Math.min(1, k / 8);
    const e = easeIO(f);
    const amp = 1 - f;
    out.t.copy(TRUE[i].t).multiplyScalar(e).addScaledVector(noise[Math.round(k)][i], amp);
    out.q.identity().slerp(TRUE[i].q, e).multiply(new THREE.Quaternion().slerp(twist[Math.round(k)][i], amp));
  };
  const asm = { k: 0 };
  const tmp: Frame = { t: new THREE.Vector3(), q: new THREE.Quaternion() };
  const tmp2: Frame = { t: new THREE.Vector3(), q: new THREE.Quaternion() };
  const applyAsm = () => {
    const k0 = Math.floor(asm.k);
    const k1 = Math.min(8, k0 + 1);
    const f = asm.k - k0;
    for (let i = 0; i < NRES; i++) {
      stateAt(k0, i, tmp);
      stateAt(k1, i, tmp2);
      plates.pose[i].t.lerpVectors(tmp.t, tmp2.t, f);
      plates.pose[i].q.slerpQuaternions(tmp.q, tmp2.q, f);
    }
  };

  // Inputs from the Evoformer.
  const single = new Tiles(12, { size: 0.9, depth: 0.5 });
  single.unit = 3.6;
  const SH = ['#f7ab90', '#f48a6c', '#fbd5c5', '#f26a4e', '#fde6dc', '#f9c2ad'];
  for (let i = 0; i < 12; i++) {
    Object.assign(single.t[i], { ...at(80 + (i - 5.5) * 2.4, 22, 4), g: 0 });
    single.color(i, SH[(i * 5) % SH.length]);
  }
  const pairT = new Tiles(64, { size: 0.9, depth: 0.4 });
  pairT.unit = 2.9;
  const PH = ['#cfe4f4', '#9ccbec', '#7db6e0', '#e4f0fa', '#5fa2d6', '#b5d8f1'];
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 8; b++) {
      Object.assign(pairT.t[a * 8 + b], { ...at(80 + (b - 3.5) * 1.9, 44 + (a - 3.5) * 1.9, 4), g: 0 });
      pairT.color(a * 8 + b, PH[(a * 3 + b * 7) % PH.length]);
    }
  const fRow = new FramePlates(7, { size: 1.7 });
  const fRowG = hidden(new THREE.Group(), 2.4);
  fRowG.position.copy(at(80, 68, 4));
  for (let i = 0; i < 7; i++) {
    fRow.pose[i].t.set((i - 3) * 5, Math.sin(i) * 0.8, 0);
    fRow.pose[i].q.setFromEuler(new THREE.Euler(0.4 * Math.sin(i * 2), 0.6 * Math.cos(i), i * 0.5));
  }
  fRowG.add(fRow.mesh);

  // The eight blocks: one learned set of parameters θ used eight times.
  const blocks = Array.from({ length: 8 }, (_, k) => {
    const b = hidden(labelledBox(fa(k + 1), 7.5, 7.5, 3, '#6c4fd1', 700));
    b.position.copy(at(97 - k * 6.4, 80, 4));
    return b;
  });
  const blockMats = blocks.map((b) => (b.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial);
  sm.root.add(prot, single.group, pairT.group, fRowG, ...blocks);

  world.onFrame(() => {
    if (!prot.visible) return;
    applyAsm();
    plates.update();
    single.update();
    pairT.update();
    fRow.update();
    const active = Math.min(7, Math.floor(asm.k));
    blockMats.forEach((m, k) => m.emissive.set(asm.k > 0 && k === active && asm.k < 8 ? '#ffd21f' : k < asm.k ? '#2a1d6b' : '#000000'));
  });

  pins
    .add('sm-q', { anchor: () => sm.wp(prot.position), html: 'هنوز مختصات سه‌بعدی نیست', cls: 'pin-flag', align: 'above', dy: -22 })
    .add('sm-single', { anchor: () => sm.wp(at(80, 22, 4)), html: 'Single representation', cls: 'pin-term c-evo', align: 'above', dy: -2.6 })
    .add('sm-pair', { anchor: () => sm.wp(at(80, 44, 4)), html: 'Pair representation', cls: 'pin-term c-pair', align: 'above', dy: -9 })
    .add('sm-frames', { anchor: () => sm.wp(at(80, 68, 4)), html: 'Backbone frames', cls: 'pin-term', align: 'above', dy: -4.6 })
    .add('sm-blocks', { anchor: () => sm.wp(at(74.6, 80, 4)), html: `۸ بلوک • پارامترهای مشترک ${tex('\\theta')}`, cls: 'pin-flag', align: 'above', dy: -4 })
    .add('sm-out', { anchor: () => sm.wp(prot.position), html: 'ساختار سه‌بعدی', cls: 'pin-term', align: 'below', dy: 19 });

  const elSm = section(
    overlay,
    's-net s-sm',
    panel(
      structure.num,
      structure.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${structure.lead}</p></div>
      <div data-s="1-1">
        <p class="n-body">${structure.uses}</p>
        <ul class="h-list h-list-sm">${structure.inputs.map((it) => `<li class="h-item"><h3 class="ltr">${it.name}</h3><p>${it.body}</p></li>`).join('')}</ul>
      </div>
      <div data-s="2"><p class="n-body n-strong">${structure.blocks}</p></div>`,
    ),
  );

  const smSteps = [
    () => {
      gsap.killTweensOf(asm);
      gsap.to(asm, { k: 0, duration: 0.8 });
      grow(prot, true, 0.4);
      single.show(true, { delay: 0.6, amount: 0.5 });
      pairT.show(true, { delay: 0.9, amount: 0.6 });
      grow(fRowG, false);
      blocks.forEach((b) => grow(b, false));
      gsap.to(trace.mesh.material, { opacity: 0, duration: 0.4 });
      pins.show('sm-q', true, 1.2);
      pins.show(['sm-single', 'sm-pair', 'sm-frames', 'sm-blocks', 'sm-out'], false);
    },
    () => {
      gsap.killTweensOf(asm);
      gsap.to(asm, { k: 0, duration: 0.8 });
      single.show(true);
      pairT.show(true);
      grow(fRowG, true, 0.3);
      blocks.forEach((b) => grow(b, false));
      gsap.to(trace.mesh.material, { opacity: 0, duration: 0.4 });
      pins.show(['sm-single', 'sm-pair', 'sm-frames'], true, 0.4, 0.2);
      pins.show(['sm-q', 'sm-blocks', 'sm-out'], false);
    },
    () => {
      blocks.forEach((b, k) => grow(b, true, 0.2 + k * 0.08, 0.6));
      pins.show('sm-blocks', true, 0.8);
      pins.show('sm-q', false);
      gsap.killTweensOf(asm);
      asm.k = 0;
      gsap.to(asm, { k: 8, duration: 6.4, delay: 1, ease: 'none' });
      gsap.to(trace.mesh.material, { opacity: 0.85, duration: 1, delay: 7 });
      pins.show('sm-out', true, 7.4);
    },
  ];
  smHide.push(() => {
    grow(prot, false);
    single.show(false);
    pairT.show(false);
    grow(fRowG, false);
    blocks.forEach((b) => grow(b, false));
    pins.hide('sm-');
  });

  const sSm: Scene = {
    id: 'net-structure',
    label: 'Structure Module',
    head,
    steps: 3,
    enter(step) {
      sm.enter();
      open(elSm);
      headIn(elSm);
      chrome.caption({ name: 'چارچوب‌های ستون فقرات یوبیکوئیتین', detail: 'PDB 1UBQ؛ یک مثلث N–Cα–C برای هر باقی‌مانده' }, 2);
      stepVis(elSm, step, 0.6);
      smSteps[0]();
      if (step >= 1) smSteps[1]();
      if (step >= 2) smSteps[2]();
    },
    step(step) {
      stepVis(elSm, step);
      smSteps[step]();
    },
    leave() {
      close(elSm);
      stepReset(elSm);
      gsap.killTweensOf(asm);
    },
  };

  // =========================================================================================
  // ۳-۱ Why frames: one frame is a local coordinate system; the whole can turn freely.
  // =========================================================================================
  const frHide: (() => void)[] = [];
  const fr = stageAt(ctx, ANCHOR.frames, 'frames', () => frHide.forEach((f) => f()));
  const RI = 11;
  const RJ = 39;
  const prot2 = hidden(new THREE.Group(), 2);
  prot2.position.copy(at(28, 56, 0));
  const plates2 = new FramePlates(NRES, { size: 1.7 });
  plates2.color(RI, '#ffd21f');
  plates2.color(RJ, '#ffd21f');
  const trace2 = new Trace(NRES, 0.3);
  trace2.set(TRUE.map((f) => f.t));
  const smallAxes = axesGizmo(3.2, 0.18);
  smallAxes.position.copy(TRUE[RI].t);
  smallAxes.quaternion.copy(TRUE[RI].q);
  const pairLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([TRUE[RI].t, TRUE[RJ].t]),
    new THREE.LineDashedMaterial({ color: '#0b1f3a', dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0 }),
  );
  pairLine.computeLineDistances();
  prot2.add(plates2.mesh, trace2.mesh, smallAxes, pairLine);
  const pose2 = TRUE.map(copyFrame);
  // The giant frame: one residue blown up, with its own axes.
  const big = hidden(new THREE.Group(), 7);
  big.position.copy(at(66, 30, 10));
  big.rotation.set(0.35, -0.5, 0.1);
  const bigPlate = new FramePlates(1, { size: 1.7, color: (_i, out) => out.set('#ffd21f') });
  bigPlate.update();
  big.add(bigPlate.mesh, axesGizmo(2.6, 0.08));
  const worldAxes = hidden(axesGizmo(9, 0.45), 1);
  worldAxes.position.copy(at(90, 82, 0));
  worldAxes.rotation.set(0.35, -0.6, 0);
  const frLinks = new Links();
  fr.root.add(prot2, big, worldAxes, frLinks.group);
  const corr = { k: 1 };
  const r2 = rng(3);
  const offs = TRUE.map(() => ({ t: new THREE.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).multiplyScalar(7), q: new THREE.Quaternion().setFromEuler(new THREE.Euler((r2() - 0.5) * 1.6, (r2() - 0.5) * 1.6, (r2() - 0.5) * 1.6)) }));
  const spin = { a: 0 };
  world.onFrame(() => {
    if (!prot2.visible) return;
    const k = corr.k;
    for (let i = 0; i < NRES; i++) {
      pose2[i].t.copy(TRUE[i].t).addScaledVector(offs[i].t, 1 - k);
      pose2[i].q.copy(TRUE[i].q).multiply(new THREE.Quaternion().slerp(offs[i].q, 1 - k));
      plates2.pose[i].t.copy(pose2[i].t);
      plates2.pose[i].q.copy(pose2[i].q);
    }
    plates2.update();
    prot2.rotation.set(0.15, spin.a, 0);
    if (spin.a !== 0 || pins.el('fr-xyz')?.style.visibility === 'visible') {
      const p = TRUE[RI].t.clone().applyEuler(prot2.rotation);
      const f = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
      pins.html('fr-xyz', `<span class="ltr">Cα<sub>${RI + 1}</sub> = (${f(p.x)}, ${f(p.y)}, ${f(p.z)})</span><small>مختصات کلی: تغییر می‌کند</small>`);
    }
  });
  const dist = TRUE[RI].t.distanceTo(TRUE[RJ].t);
  pins
    .add('fr-n', { anchor: () => big.localToWorld(LOCAL.n.clone()), html: 'N', cls: 'pin-res', align: 'above', dy: -1 })
    .add('fr-ca', { anchor: () => big.localToWorld(LOCAL.ca.clone()), html: 'Cα', cls: 'pin-res', align: 'below', dy: 1.2 })
    .add('fr-c', { anchor: () => big.localToWorld(LOCAL.c.clone()), html: 'C', cls: 'pin-res', align: 'below', dy: 1.2 })
    .add('fr-local', { anchor: () => big.localToWorld(new THREE.Vector3(0.6, 2.8, 0)), html: 'دستگاه مختصات محلی<small>جایگاه + جهت</small>', cls: 'pin-stat', align: 'left', dx: 2 })
    .add('fr-fix', { anchor: () => fr.wp(prot2.position), html: 'شبکه چارچوب‌ها را اصلاح می‌کند', cls: 'pin-flag', align: 'below', dy: 21 })
    .add('fr-world', { anchor: () => fr.wp(worldAxes.position), html: 'دستگاه مختصات کلی', cls: 'pin-word', align: 'right', dx: -3 })
    .add('fr-xyz', { anchor: () => fr.wp(at(66, 66, 0)), html: '', cls: 'pin-stat pin-xyz-live', align: 'center' })
    .add('fr-dist', { anchor: () => prot2.localToWorld(TRUE[RI].t.clone().lerp(TRUE[RJ].t, 0.5)), html: `<span>فاصله‌ی Cα<sub>${fa(RI + 1)}</sub> تا Cα<sub>${fa(RJ + 1)}</sub>: ${fa(dist.toFixed(1)).replace('.', '٫')} Å</span><small>روابط داخلی: ثابت</small>`, cls: 'pin-stat', align: 'left', dx: 22 });

  const elFr = section(
    overlay,
    's-net s-fr',
    panel(
      framesCopy.num,
      framesCopy.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${framesCopy.p1}</p></div>
      <div data-s="1-1"><p class="n-body n-strong">${framesCopy.p2}</p></div>
      <div data-s="2"><p class="n-body n-strong">${framesCopy.p3}</p></div>`,
    ),
  );
  let corrTl: gsap.core.Timeline | undefined;
  let spinTw: gsap.core.Tween | undefined;
  const frSteps = [
    () => {
      corrTl?.kill();
      spinTw?.kill();
      gsap.to(spin, { a: 0, duration: 0.8 });
      gsap.to(corr, { k: 1, duration: 0.6 });
      grow(prot2, true, 0.4);
      grow(big, true, 0.9);
      grow(worldAxes, false);
      gsap.to(pairLine.material, { opacity: 0, duration: 0.3 });
      frLinks
        .set([{ a: TRUE[RI].t.clone().multiplyScalar(2).add(prot2.position), b: big.position.clone().add(new THREE.Vector3(4, -3, 0)), w: 0.6, bend: new THREE.Vector3(0, 10, 4), color: '#d99a00', arrow: true, r: 0.24 }])
        .show(true, { delay: 1.4 });
      pins.show(['fr-n', 'fr-ca', 'fr-c', 'fr-local'], true, 1.6, 0.12);
      pins.show(['fr-fix', 'fr-world', 'fr-xyz', 'fr-dist'], false);
    },
    () => {
      spinTw?.kill();
      gsap.to(spin, { a: 0, duration: 0.8 });
      grow(worldAxes, false);
      gsap.to(pairLine.material, { opacity: 0, duration: 0.3 });
      pins.show(['fr-world', 'fr-xyz', 'fr-dist'], false);
      corrTl?.kill();
      corrTl = gsap.timeline({ delay: 0.4, repeat: 1, repeatDelay: 0.8 });
      corrTl.set(corr, { k: 0 }).to(corr, { k: 1, duration: 2.6, ease: 'power2.inOut' });
      pins.show('fr-fix', true, 0.6);
    },
    () => {
      corrTl?.kill();
      gsap.to(corr, { k: 1, duration: 0.5 });
      pins.show('fr-fix', false);
      grow(worldAxes, true, 0.3);
      gsap.to(pairLine.material, { opacity: 0.9, duration: 0.6, delay: 0.5 });
      pins.show(['fr-world', 'fr-xyz', 'fr-dist'], true, 0.8, 0.2);
      spinTw?.kill();
      spin.a = 0;
      spinTw = gsap.to(spin, { a: Math.PI * 2, duration: 12, delay: 1, ease: 'none', repeat: -1 });
    },
  ];
  frHide.push(() => {
    corrTl?.kill();
    spinTw?.kill();
    spin.a = 0;
    [prot2, big, worldAxes].forEach((o) => grow(o, false));
    frLinks.show(false);
    pins.hide('fr-');
  });
  const sFr: Scene = {
    id: 'net-frames',
    label: framesCopy.title,
    head,
    steps: 3,
    enter(step) {
      fr.enter();
      open(elFr);
      headIn(elFr);
      chrome.caption({ name: 'چارچوب‌های محلی یوبیکوئیتین', detail: 'PDB 1UBQ؛ هر مثلث: یک دستگاه مختصات محلی' }, 2);
      stepVis(elFr, step, 0.6);
      frSteps[0]();
      if (step) frSteps[step]();
    },
    step(step) {
      stepVis(elFr, step);
      frSteps[step]();
    },
    leave() {
      close(elFr);
      stepReset(elFr);
      corrTl?.kill();
      spinTw?.kill();
      spin.a = 0;
    },
  };

  // =========================================================================================
  // ۳-۲ IPA — attention that also measures distances between points carried by the frames.
  // =========================================================================================
  const ipHide: (() => void)[] = [];
  const ip = stageAt(ctx, ANCHOR.ipa, 'ipa', () => ipHide.forEach((f) => f()));
  const pair = hidden(new THREE.Group(), 1.7);
  pair.position.copy(at(44, 54, 0));
  const mkFrame = (color: string) => {
    const g = new THREE.Group();
    const pl = new FramePlates(1, { size: 1.7, color: (_i, out) => out.set(color) });
    pl.update();
    pl.mesh.scale.setScalar(5);
    g.add(pl.mesh, axesGizmo(9, 0.32));
    // Four points carried rigidly by the frame (local coordinates).
    const pts = [new THREE.Vector3(6, 4, 2), new THREE.Vector3(-3, 7, -2), new THREE.Vector3(4, -4, 4), new THREE.Vector3(-4, -2, -5)];
    const balls = pts.map((p) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1 }));
      b.position.copy(p);
      g.add(b);
      return b;
    });
    return { g, balls };
  };
  const Fi = mkFrame('#0053d6');
  const Fj = mkFrame('#ff7d45');
  const homeI = new THREE.Vector3(-20, 0, 0);
  const homeJ = new THREE.Vector3(20, -2, 0);
  Fi.g.position.copy(homeI);
  Fi.g.rotation.set(0.3, 0.6, 0.2);
  Fj.g.position.copy(homeJ);
  Fj.g.rotation.set(-0.4, -0.5, 0.9);
  const linesGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3()));
  const lines = new THREE.LineSegments(linesGeo, new THREE.LineDashedMaterial({ color: '#34465e', dashSize: 1, gapSize: 0.7, transparent: true, opacity: 0 }));
  lines.frustumCulled = false;
  pair.add(Fi.g, Fj.g, lines);
  // Feature vectors (ordinary attention) and the pair feature z_ij.
  const featI = new Tiles(6, { size: 0.9, depth: 0.4 });
  const featJ = new Tiles(6, { size: 0.9, depth: 0.4 });
  featI.unit = featJ.unit = 3.2;
  for (let k = 0; k < 6; k++) {
    Object.assign(featI.t[k], { ...at(22 + (k - 2.5) * 2, 22, 6), g: 0 });
    Object.assign(featJ.t[k], { ...at(62 + (k - 2.5) * 2, 22, 6), g: 0 });
    featI.color(k, new THREE.Color('#cfe0fb').lerp(C.blue, (k * 37) % 6 / 6));
    featJ.color(k, new THREE.Color('#ffe2d3').lerp(C.ember, (k * 23) % 6 / 6));
  }
  const zij = new Tiles(1, { size: 0.9, depth: 0.5 });
  zij.unit = 5;
  zij.char(0, '·');
  zij.color(0, '#ffd21f');
  Object.assign(zij.t[0], { ...at(42, 18, 6) });
  const ipaBox = hidden(labelledBox('IPA', 20, 9, 4, '#16294a', 300), 1);
  ipaBox.position.copy(at(42, 90, 4));
  const ipLinks = new Links();
  ip.root.add(pair, featI.group, featJ.group, zij.group, ipaBox, ipLinks.group);
  const score = { v: 0 };
  const motion = { j: 0, rot: 0, nudge: 0 };
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  world.onFrame(() => {
    if (!pair.visible) return;
    featI.update();
    featJ.update();
    zij.update();
    // j approaches (motion.j > 0) or recedes; the pair turns together (motion.rot).
    Fj.g.position.copy(homeJ).lerp(new THREE.Vector3(6, -1, 4), Math.max(0, motion.j)).add(new THREE.Vector3(Math.max(0, -motion.j) * 14, 0, 0));
    Fj.g.rotation.z = 0.9 + motion.nudge * 0.5;
    pair.rotation.set(0, motion.rot, motion.rot * 0.3);
    const pos = linesGeo.getAttribute('position') as THREE.BufferAttribute;
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      Fi.balls[k].getWorldPosition(pA);
      Fj.balls[k].getWorldPosition(pB);
      sum += pA.distanceTo(pB);
      pair.worldToLocal(pA);
      pair.worldToLocal(pB);
      pos.setXYZ(k * 2, pA.x, pA.y, pA.z);
      pos.setXYZ(k * 2 + 1, pB.x, pB.y, pB.z);
    }
    pos.needsUpdate = true;
    lines.computeLineDistances();
    const s = Math.exp(-sum / 4 / 60);
    if (Math.abs(s - score.v) > 0.002) {
      score.v = s;
      const pct = Math.round(s * 100);
      pins.html('ip-score', `<span>امتیاز هندسی</span><i class="bar"><b style="width:${pct}%"></b></i><small>${fa(pct)}٪ — بر پایه‌ی فاصله‌ی نقاط</small>`);
    }
  });
  pins
    .add('ip-i', { anchor: () => Fi.g.getWorldPosition(new THREE.Vector3()), html: tex('i'), cls: 'pin-tex pin-node-l', align: 'below', dy: 13 })
    .add('ip-j', { anchor: () => Fj.g.getWorldPosition(new THREE.Vector3()), html: tex('j'), cls: 'pin-tex pin-node-l', align: 'below', dy: 13 })
    .add('ip-feat', { anchor: () => ip.wp(at(42, 22, 6)), html: 'در attention معمولی: بردار ویژگی', cls: 'pin-word', align: 'below', dy: 3 })
    .add('ip-z', { anchor: () => ip.wp(at(42, 18, 6)), html: tex('z_{ij}'), cls: 'pin-tex', align: 'right', dx: -2.4 })
    .add('ip-score', { anchor: () => ip.wp(at(80, 84, 0)), html: '', cls: 'pin-stat pin-score', align: 'center' })
    .add('ip-inv', { anchor: () => ip.wp(at(44, 84, 0)), html: 'چرخش هم‌زمان هر دو چارچوب ← امتیاز ثابت', cls: 'pin-flag', align: 'center' })
    .add('ip-s1', { anchor: () => ip.wp(at(22, 22, 6)), html: '۱', cls: 'pin-num-badge', align: 'above', dy: -3 })
    .add('ip-s2', { anchor: () => ip.wp(at(42, 18, 6)), html: '۲', cls: 'pin-num-badge', align: 'above', dy: -4 })
    .add('ip-s3', { anchor: () => ip.wp(at(42, 60, 0)), html: '۳', cls: 'pin-num-badge', align: 'center' })
    .add('ip-loop', { anchor: () => ip.wp(at(42, 90, 4)), html: 'در هر یک از ۸ بلوک تکرار می‌شود', cls: 'pin-word', align: 'below', dy: 5 });

  const elIp = section(
    overlay,
    's-net s-ipa',
    panel(
      ipa.num,
      ipa.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${ipa.p1}</p></div>
      <div data-s="1-1"><p class="n-body n-strong">${ipa.p2}</p></div>
      <div data-s="2-2">
        <p class="n-body">${ipa.sourcesLead}</p>
        <ol class="n-list">${ipa.sources.map((s, i) => `<li><b>${fa(i + 1)}</b><span>${s}</span></li>`).join('')}</ol>
      </div>
      <div data-s="3"><p class="n-body n-strong">${ipa.p4}</p></div>`,
    ),
  );
  let ipTl: gsap.core.Timeline | undefined;
  const ipSteps = [
    () => {
      ipTl?.kill();
      gsap.to(motion, { j: 0, rot: 0, nudge: 0, duration: 0.6 });
      grow(pair, true, 0.4);
      featI.show(true, { delay: 1, amount: 0.4 });
      featJ.show(true, { delay: 1.1, amount: 0.4 });
      zij.show(false);
      grow(ipaBox, false);
      gsap.to(lines.material, { opacity: 0, duration: 0.3 });
      ipLinks.show(false);
      pins.show(['ip-i', 'ip-j'], true, 1, 0.1);
      pins.show(['ip-feat', 'ip-score', 'ip-inv', 'ip-s1', 'ip-s2', 'ip-s3', 'ip-loop', 'ip-z'], false);
    },
    () => {
      grow(ipaBox, false);
      zij.show(false);
      pins.show(['ip-s1', 'ip-s2', 'ip-s3', 'ip-loop', 'ip-z'], false);
      ipLinks
        .set([{ a: at(26, 22, 7), b: at(58, 22, 7), w: 0.6, bend: new THREE.Vector3(0, 7, 3), color: '#7f90a6', arrow: false, r: 0.22 }])
        .show(true, { delay: 0.3 });
      pins.show('ip-feat', true, 0.4);
      gsap.to(lines.material, { opacity: 0.9, duration: 0.6, delay: 1 });
      pins.show('ip-score', true, 1.2);
      ipTl?.kill();
      ipTl = gsap.timeline({ delay: 1.8 });
      ipTl
        .to(motion, { j: 1, duration: 1.8, ease: 'power2.inOut' })
        .to(motion, { j: -1, duration: 2.4, ease: 'power2.inOut' }, '+=0.6')
        .to(motion, { j: 0, duration: 1.4, ease: 'power2.inOut' }, '+=0.4')
        .add(() => pins.show('ip-inv', true))
        .to(motion, { rot: Math.PI * 2, duration: 6, ease: 'power1.inOut' })
        .add(() => pins.show('ip-inv', false));
    },
    () => {
      ipTl?.kill();
      gsap.to(motion, { j: 0, rot: 0, duration: 0.6 });
      pins.show(['ip-inv', 'ip-feat'], false);
      zij.show(true, { delay: 0.3 });
      pins.show('ip-z', true, 0.5);
      grow(ipaBox, true, 0.4);
      gsap.to(lines.material, { opacity: 0.9, duration: 0.4 });
      ipLinks
        .set([
          { a: at(22, 24, 7), b: at(36, 86, 6), w: 0.7, bend: new THREE.Vector3(-14, 0, 6), color: C.blue, arrow: true, r: 0.26 },
          { a: at(62, 24, 7), b: at(48, 86, 6), w: 0.7, bend: new THREE.Vector3(14, 0, 6), color: C.ember, arrow: true, r: 0.26 },
          { a: at(42, 21, 7), b: at(42, 85, 6), w: 0.7, bend: new THREE.Vector3(0, 0, 10), color: '#d99a00', arrow: true, r: 0.26 },
          { a: at(42, 62, 4), b: at(42, 86, 6), w: 0.9, bend: new THREE.Vector3(3, 0, 2), color: '#34465e', arrow: true, r: 0.26 },
        ])
        .show(true, { delay: 0.8, stagger: 0.2 });
      pins.show(['ip-s1', 'ip-s2', 'ip-s3', 'ip-score'], true, 1, 0.15);
      pins.show('ip-loop', false);
    },
    () => {
      ipTl?.kill();
      pins.show(['ip-s1', 'ip-s2', 'ip-s3'], false);
      ipLinks
        .set([{ a: at(50, 88, 6), b: at(52, 56, 6), w: 1, bend: new THREE.Vector3(10, 0, 6), color: '#6c4fd1', arrow: true, r: 0.32 }])
        .show(true, { delay: 0.3 });
      ipTl = gsap.timeline({ delay: 1, repeat: -1, repeatDelay: 0.6 });
      ipTl.to(motion, { nudge: 1, duration: 0.9, ease: 'power2.inOut' }).to(motion, { nudge: 0, duration: 0.9, ease: 'power2.inOut' });
      pins.show('ip-loop', true, 0.8);
    },
  ];
  ipHide.push(() => {
    ipTl?.kill();
    Object.assign(motion, { j: 0, rot: 0, nudge: 0 });
    [pair, ipaBox].forEach((o) => grow(o, false));
    [featI, featJ, zij].forEach((t) => t.show(false));
    ipLinks.show(false);
    pins.hide('ip-');
  });
  const sIp: Scene = {
    id: 'net-ipa',
    label: 'Invariant Point Attention',
    head,
    steps: 4,
    enter(step) {
      ip.enter();
      open(elIp);
      headIn(elIp);
      chrome.caption(null);
      stepVis(elIp, step, 0.6);
      ipSteps[0]();
      if (step) ipSteps[step]();
    },
    step(step) {
      stepVis(elIp, step);
      ipSteps[step]();
    },
    leave() {
      close(elIp);
      stepReset(elIp);
      ipTl?.kill();
    },
  };

  // =========================================================================================
  // ۳-۳ Side chains: from the backbone to every heavy atom of ubiquitin.
  // =========================================================================================
  const scHide: (() => void)[] = [];
  const sc = stageAt(ctx, ANCHOR.sidechain, 'sidechain', () => scHide.forEach((f) => f()));
  const ch = UBQ.chains[0];
  const ctr = new THREE.Vector3();
  for (let i = 0; i < NRES; i++) ctr.add(new THREE.Vector3().fromArray(ch.ca, i * 3));
  ctr.multiplyScalar(1 / NRES);
  type Atom = { el: string; r: number; p: THREE.Vector3; bb: boolean };
  const atoms: Atom[] = [];
  {
    const seenN = new Set<number>();
    for (const [el, ci, ri, x, y, z] of UBQ.atoms) {
      if (ci !== 0) continue;
      const p = new THREE.Vector3(x, y, z);
      const ca = new THREE.Vector3().fromArray(ch.ca, ri * 3);
      const cc = new THREE.Vector3().fromArray(ch.c, ri * 3);
      const oo = new THREE.Vector3().fromArray(ch.o, ri * 3);
      let bb = p.distanceTo(ca) < 0.05 || p.distanceTo(cc) < 0.05 || p.distanceTo(oo) < 0.05;
      if (el === 'N' && !seenN.has(ri)) {
        seenN.add(ri);
        bb = true;
      }
      atoms.push({ el, r: ri, p: p.sub(ctr), bb });
    }
  }
  const bondsIdx: [number, number][] = [];
  for (let a = 0; a < atoms.length; a++)
    for (let b = a + 1; b < atoms.length; b++) {
      if (Math.abs(atoms[a].r - atoms[b].r) > 1) continue;
      if (atoms[a].p.distanceTo(atoms[b].p) < 1.9) bondsIdx.push([a, b]);
    }
  const atomMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.4 }), atoms.length);
  const bondMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#56657a', roughness: 0.45 }), bondsIdx.length);
  atomMesh.frustumCulled = bondMesh.frustumCulled = false;
  const HL = [5, 9, 44];
  atoms.forEach((a, i) => atomMesh.setColorAt(i, new THREE.Color((ELEMENT[a.el] ?? ELEMENT.C).c)));
  const prot3 = hidden(new THREE.Group(), 2.4);
  prot3.position.copy(at(30, 54, 0));
  prot3.rotation.set(0.2, -0.3, 0);
  prot3.add(atomMesh, bondMesh);
  sc.root.add(prot3);
  const grown = { all: 0, hl: 0 };
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const sizeOf = (a: Atom) => {
    if (a.bb) return 0.45;
    const g = HL.includes(a.r) ? Math.max(grown.hl, grown.all * 1.2 - (a.r / NRES) * 0.2) : grown.all * 1.25 - (a.r / NRES) * 0.25;
    return 0.45 * Math.min(1, Math.max(0, g));
  };
  world.onFrame((dt) => {
    if (!prot3.visible) return;
    prot3.rotation.y += dt * 0.12;
    atoms.forEach((a, i) => {
      const s = Math.max(1e-4, sizeOf(a));
      _m.makeScale(s, s, s).setPosition(a.p);
      atomMesh.setMatrixAt(i, _m);
    });
    bondsIdx.forEach(([a, b], k) => {
      const s = Math.min(sizeOf(atoms[a]), sizeOf(atoms[b])) / 0.45;
      _v.addVectors(atoms[a].p, atoms[b].p).multiplyScalar(0.5);
      _d.subVectors(atoms[b].p, atoms[a].p);
      const len = _d.length();
      _q.setFromUnitVectors(UP, _d.normalize());
      _m.compose(_v, _q, new THREE.Vector3(Math.max(1e-4, s), len, Math.max(1e-4, s)));
      bondMesh.setMatrixAt(k, _m);
    });
    atomMesh.instanceMatrix.needsUpdate = true;
    bondMesh.instanceMatrix.needsUpdate = true;
  });
  const caOf = (i: number) => () => prot3.localToWorld(new THREE.Vector3().fromArray(ch.ca, i * 3).sub(ctr));
  const HL_TXT = ['زنجیره‌ی جانبی بلند و باردار', 'بدون زنجیره‌ی جانبی', 'حلقه‌ی آروماتیک'];
  const HL_IDS = HL.map((_, k) => `sc-h${k}`);
  HL.forEach((i, k) =>
    notes.add(HL_IDS[k], { anchor: caOf(i), html: `<b>${aminoAcidFa[ch.seq[i]]} <i class="ltr">${ch.seq[i]}${i + 1}</i></b><span>${HL_TXT[k]}</span>`, at: [60, 24 + k * 15], tone: 'sun' }),
  );
  // A few lines of the output: element, residue and coordinates (Å).
  const sample = atoms.filter((a) => a.r === 5).slice(0, 7);
  const f1 = (v: number) => ((v < 0 ? '−' : '') + Math.abs(v).toFixed(2)).padStart(6, ' ');
  pins.add('sc-out', {
    anchor: () => sc.wp(at(74, 74, 0)),
    html: `<b>خروجی: مختصات سه‌بعدی اتم‌ها</b><pre class="ltr">${sample.map((a) => `${(ch.seq[a.r] + (a.r + 1)).padEnd(4)} ${a.el}  ${f1(a.p.x)} ${f1(a.p.y)} ${f1(a.p.z)}`).join('\n')}\n…</pre>`,
    cls: 'pin-file',
    align: 'center',
  });
  const elSc = section(
    overlay,
    's-net s-sc',
    panel(
      sidechain.num,
      sidechain.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${sidechain.p1}</p></div>
      <div data-s="1"><p class="n-body n-strong">${sidechain.p2}</p></div>`,
    ),
  );
  const scSteps = [
    () => {
      grow(prot3, true, 0.4);
      gsap.to(grown, { all: 0, duration: 0.6, overwrite: 'auto' });
      gsap.fromTo(grown, { hl: 0 }, { hl: 1, duration: 1.4, delay: 1.2 });
      HL_IDS.forEach((id, k) => notes.show(id, true, 2 + k * 0.2));
      pins.show('sc-out', false);
    },
    () => {
      notes.hide(...HL_IDS);
      gsap.to(grown, { all: 1, duration: 3.2, delay: 0.3, ease: 'power1.inOut', overwrite: 'auto' });
      pins.show('sc-out', true, 3.2);
    },
  ];
  scHide.push(() => {
    grow(prot3, false);
    gsap.to(grown, { all: 0, hl: 0, duration: 0.4 });
    pins.hide('sc-');
    notes.hide(...HL_IDS);
  });
  const sSc: Scene = {
    id: 'net-sidechain',
    label: sidechain.title,
    head,
    steps: 2,
    enter(step) {
      sc.enter();
      open(elSc);
      headIn(elSc);
      chrome.caption({ name: 'یوبیکوئیتین، همه‌ی اتم‌های سنگین', detail: 'PDB 1UBQ؛ ستون فقرات، سپس زنجیره‌های جانبی' }, 2);
      stepVis(elSc, step, 0.6);
      scSteps[0]();
      if (step) scSteps[1]();
    },
    step(step) {
      stepVis(elSc, step);
      scSteps[step]();
    },
    leave() {
      close(elSc);
      stepReset(elSc);
    },
  };

  // =========================================================================================
  // ۴. Recycling — the prediction goes round the loop and comes back better.
  // =========================================================================================
  const rcHide: (() => void)[] = [];
  const rc = stageAt(ctx, ANCHOR.recycle, 'recycle', () => rcHide.forEach((f) => f()));
  const chain = new Chain();
  chain.spinSpeed = 0.1;
  const holder = new THREE.Group();
  holder.position.copy(at(36, 56, 0));
  holder.scale.setScalar(1.45);
  holder.add(chain.group);
  // Three successive predictions: two misplaced regions, corrected in turn.
  const poseOf = (amount: number) => {
    const out = new Float32Array(FOLDED);
    const pivot = new THREE.Vector3().fromArray(FOLDED, 22 * 3);
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.3, 1, 0.2).normalize(), 0.75 * amount);
    const v = new THREE.Vector3();
    for (let i = 0; i < NRES; i++) {
      v.fromArray(FOLDED, i * 3);
      if (i >= 22 && i <= 34) v.sub(pivot).applyQuaternion(rot).add(pivot);
      if (i >= 60) v.add(new THREE.Vector3(7, -5, 6).multiplyScalar(amount * Math.min(1, (i - 59) / 6)));
      v.add(new THREE.Vector3(Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 2.1)).multiplyScalar(0.5 * amount));
      v.toArray(out, i * 3);
    }
    return out;
  };
  const POSES = [poseOf(1), poseOf(0.45), poseOf(0)];
  const errColor = (d: number, out: THREE.Color) => out.copy(d < 1 ? C.blue : d < 2.5 ? C.sky : d < 4.5 ? C.sun : C.ember);
  const colorBy = (pose: Float32Array) => {
    const c = new THREE.Color();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i < NRES; i++) chain.beads.setColorAt(i, errColor(a.fromArray(pose, i * 3).distanceTo(b.fromArray(FOLDED, i * 3)), c));
    chain.beads.instanceColor!.needsUpdate = true;
  };
  // The loop: a ring around the protein with a pulse running along it.
  const RING_R = 40;
  const ringCurve = new THREE.EllipseCurve(0, 0, RING_R, RING_R * 0.82, 0, Math.PI * 2, false, 0);
  const ringPts = ringCurve.getPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const ringFlow = flowMaterial(C.blue, { dashes: 60, speed: 1.4 });
  const ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 240, 0.8, 10, true), ringFlow.material);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: C.sun }));
  const ringG = hidden(new THREE.Group(), 1);
  ringG.position.copy(holder.position);
  ringG.add(ring, pulse);
  rc.root.add(holder, ringG);
  const lap = { t: 0 };
  world.onFrame((dt, t) => {
    ringFlow.uniforms.uTime.value = t;
    chain.update(dt);
    const a = lap.t * Math.PI * 2 + Math.PI / 2;
    pulse.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R * 0.82, 0);
    pulse.visible = lap.t % 1 > 0.001 && lap.t % 1 < 0.999;
  });
  const bead = (i: number) => () => chain.worldPos(i);
  pins
    .add('rc-lap', { anchor: () => rc.wp(holder.position.clone().add(new THREE.Vector3(0, RING_R * 0.82 + 3, 0))), html: '', cls: 'pin-flag', align: 'above' })
    .add('rc-ok', { anchor: bead(4), html: 'این بخش مناسب است', cls: 'pin-word', align: 'right', dx: -3 })
    .add('rc-bad1', { anchor: bead(28), html: 'روابط ناسازگار', cls: 'pin-flag pin-alarm', align: 'left', dx: 3 })
    .add('rc-bad2', { anchor: bead(70), html: 'روابط ناسازگار', cls: 'pin-flag pin-alarm', align: 'left', dx: 3 })
    .add('rc-in', { anchor: () => rc.wp(holder.position.clone().add(new THREE.Vector3(RING_R + 2, 0, 0))), html: 'خروجی ← دوباره ورودی', cls: 'pin-word', align: 'left', dx: 2 });
  const lapLabel = (k: number) => `دور ${fa(k)} از ۳`;
  const elRc = section(
    overlay,
    's-net s-rc4',
    panel(
      recycling.num,
      recycling.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${recycling.p1}</p></div>
      <div data-s="1"><p class="n-body n-strong">${recycling.p2}</p></div>`,
    ) + `<p class="legend rc-legend"><i class="sw" style="background:#0053d6"></i>نزدیک به ساختار نهایی<i class="sw" style="background:#ff7d45"></i>دور از آن</p>`,
  );
  let rcTl: gsap.core.Timeline | undefined;
  const runLap = (tl: gsap.core.Timeline, k: number) => {
    tl.add(() => pins.html('rc-lap', lapLabel(k + 1)));
    tl.fromTo(lap, { t: 0 }, { t: 1, duration: 1.8, ease: 'power1.inOut' });
    tl.add(() => {
      chain.morph(POSES[k], { duration: 1.4, stagger: 0.3 });
      colorBy(POSES[k]);
    });
    tl.to({}, { duration: 1.6 });
  };
  const rcSteps = [
    () => {
      rcTl?.kill();
      grow(ringG, true, 0.3);
      gsap.to(ringFlow.uniforms.uOn, { value: 1, duration: 1 });
      chain.place(POSES[0]);
      colorBy(POSES[0]);
      chain.show(false, { duration: 0.01, stagger: 0 });
      pins.show(['rc-lap', 'rc-in'], true, 0.8, 0.2);
      pins.show(['rc-ok', 'rc-bad1', 'rc-bad2'], false);
      rcTl = gsap.timeline({ delay: 0.8 });
      rcTl.add(() => pins.html('rc-lap', lapLabel(1)));
      rcTl.fromTo(lap, { t: 0 }, { t: 1, duration: 1.8, ease: 'power1.inOut' });
      rcTl.add(() => void chain.show(true, { stagger: 0.6 }));
    },
    () => {
      rcTl?.kill();
      chain.show(true, { stagger: 0.2 });
      chain.place(POSES[0]);
      colorBy(POSES[0]);
      pins.html('rc-lap', lapLabel(1));
      pins.show(['rc-ok', 'rc-bad1', 'rc-bad2'], true, 0.3, 0.2);
      rcTl = gsap.timeline({ delay: 2.6 });
      rcTl.add(() => pins.show(['rc-ok', 'rc-bad1', 'rc-bad2'], false));
      runLap(rcTl, 1);
      runLap(rcTl, 2);
    },
  ];
  rcHide.push(() => {
    rcTl?.kill();
    grow(ringG, false);
    gsap.to(ringFlow.uniforms.uOn, { value: 0, duration: 0.4 });
    chain.show(false, { duration: 0.4, stagger: 0.3 });
    pins.hide('rc-');
  });
  const sRc: Scene = {
    id: 'net-recycling',
    label: 'Recycling',
    head,
    steps: 2,
    enter(step) {
      rc.enter();
      open(elRc);
      headIn(elRc);
      chrome.caption({ name: 'یوبیکوئیتین، سه دور پیش‌بینی', detail: 'نمایشی؛ رنگ: فاصله‌ی هر باقی‌مانده تا ساختار نهایی' }, 2);
      stepVis(elRc, step, 0.6);
      rcSteps[step]();
      if (step) chain.show(true, { stagger: 0.4 });
    },
    step(step) {
      stepVis(elRc, step);
      rcSteps[step]();
    },
    leave() {
      close(elRc);
      stepReset(elRc);
      rcTl?.kill();
    },
  };

  return [sSm, sFr, sIp, sSc, sRc];
}
