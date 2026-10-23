import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { chapter3, training, fape, optimize, distill, fa } from '../../content';
import { MOL } from '../../data/molecules';
import { Cartoon } from '../../three/cartoon';
import { N as NRES } from '../../three/chain';
import { axesGizmo, backboneFrames, FramePlates, Trace, type Frame } from '../../three/frames';
import { Links } from '../../three/links';
import { ANCHOR, C, shot, spectrum } from '../../three/world';
import { rich, tex } from '../../ui/math';
import { $, $$, words, reveal, open, close, section, stepVis, stepReset } from '../../ui/text';
import type { Ctx } from '../ctx';
import { at } from '../net/common';
import { grow, headIn, hidden, labelledBox, rng, stageAt } from './stage';

// Chapter ۳: how the network learns — the objective, FAPE, the optimisation loop and
// self-distillation. Each scene has its own object: a training bench, a pair of structures
// compared frame by frame, a loss landscape, and a data pipeline.

const UBQ = MOL.ubiquitin;
const TRUE = backboneFrames(UBQ);

function panel(num: string, title: string, body: string, cls = '') {
  return /* html */ `
    <div class="n-panel ${cls}">
      <p class="w-num">${num}</p>
      <h2 class="n-title n-title-sm ltr-mix">${title}</h2>
      <div class="swap">${body}</div>
    </div>`;
}

/** Centres of a regular grid of cells inside rendered text (for numerals built of blocks). */
export function glyphCells(text: string, font: string, cols: number) {
  const W = 600;
  const H = 600;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2);
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2)
      if (d[(y * W + x) * 4 + 3] > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const step = (x1 - x0) / cols;
  const out: [number, number][] = [];
  for (let y = y0 + step / 2; y < y1; y += step)
    for (let x = x0 + step / 2; x < x1; x += step) {
      // A cell counts if most of it is ink.
      let ink = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (d[(Math.round(y + (a * step) / 3) * W + Math.round(x + (b * step) / 3)) * 4 + 3] > 128) ink++;
      if (ink >= 5) out.push([(x - (x0 + x1) / 2) / step, -(y - (y0 + y1) / 2) / step]);
    }
  return out;
}

export function trainingScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins } = ctx;
  const head = { num: chapter3.num, title: chapter3.title };

  // =========================================================================================
  // Chapter opener: the numeral «۳» assembles itself out of scattered blocks — learning.
  // =========================================================================================
  const C3 = ANCHOR.chapter3;
  const cells = glyphCells('۳', '900 520px "Vazirmatn Variable"', 9);
  const blocksN = cells.length;
  const vox = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 2.8, 2.8), new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8 }), blocksN);
  vox.frustumCulled = false;
  const ys = cells.map((c) => c[1]);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const col = new THREE.Color();
  cells.forEach((c, i) => vox.setColorAt(i, spectrum((yMax - c[1]) / (yMax - yMin), col)));
  const r3 = rng(11);
  const scatter = cells.map(() => new THREE.Vector3((r3() - 0.5) * 140, (r3() - 0.5) * 90, (r3() - 0.5) * 80));
  const spinA = cells.map(() => new THREE.Euler(r3() * 6, r3() * 6, r3() * 6));
  const voxG = new THREE.Group();
  voxG.position.copy(C3).add(new THREE.Vector3(14, 2, 0));
  voxG.add(vox);
  world.scene.add(voxG);
  const learn = { t: 0 };
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const ease = gsap.parseEase('power3.inOut');
  world.onFrame(() => {
    voxG.visible = learn.t > 0.001;
    if (!voxG.visible) return;
    cells.forEach(([x, y], i) => {
      const k = ease(Math.min(1, Math.max(0, learn.t * 1.5 - (i / blocksN) * 0.5)));
      _p.set(x * 3.05, y * 3.05, 0).lerp(scatter[i], 1 - k);
      _q.setFromEuler(spinA[i]).slerp(new THREE.Quaternion(), k);
      const s = Math.min(1, learn.t * 3);
      _m.compose(_p, _q, new THREE.Vector3(s, s, s));
      vox.setMatrixAt(i, _m);
    });
    vox.instanceMatrix.needsUpdate = true;
  });
  ctx.register('chapter3', () => void gsap.to(learn, { t: 0, duration: 0.6, overwrite: true }));
  const elCh = section(
    overlay,
    's-chapter s-ch3',
    /* html */ `
    <div class="ch-block">
      <h2 class="ch-title split">${chapter3.title}</h2>
      <ol class="toc">
        ${[training, fape, optimize, distill].map((s) => `<li class="rv"><b>${s.num}</b><span>${s.title}</span></li>`).join('')}
      </ol>
    </div>`,
  );
  const sCh: Scene = {
    id: 'chapter-3',
    label: `${chapter3.num} ${chapter3.title}`,
    chapter: true,
    enter() {
      ctx.area('chapter3');
      open(elCh);
      chrome.caption(null);
      world.fogTo(150, 520);
      world.fly(shot(C3, { pz: 165, ox: 0.2, oy: 0.04 }), 3);
      gsap.fromTo(learn, { t: 0 }, { t: 1, duration: 3.2, delay: 0.4, ease: 'none', overwrite: true });
      words($('.ch-title', elCh), 0.9, 0.1);
      $$('.toc li', elCh).forEach((li, i) => reveal(li, true, 1.5 + i * 0.15));
    },
    leave() {
      close(elCh);
      reveal($$('.rv', elCh), false);
    },
  };

  // =========================================================================================
  // ۵. Training — samples (x, y), a model f_θ, a prediction and a loss.
  // =========================================================================================
  const trHide: (() => void)[] = [];
  const tr = stageAt(ctx, ANCHOR.train, 'train', () => trHide.forEach((f) => f()));
  const ribbonGeo = new Cartoon(UBQ).mesh.geometry;
  const green = (op = 1) => new THREE.MeshPhysicalMaterial({ color: '#2fb36b', roughness: 0.35, clearcoat: 0.6, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
  // Dataset cards: each holds a sequence (x) and its known structure (y).
  const cards = hidden(new THREE.Group(), 1);
  cards.position.copy(at(80, 32, 0));
  const cardMeshes: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 0.8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.6, clearcoat: 0.3 }));
    const seq = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: k === 3 ? '#ffb38a' : '#9ccbec' }));
    seq.position.set(0, 7.5, 0.6);
    const mini = new THREE.Mesh(ribbonGeo, green());
    mini.scale.setScalar(0.32);
    mini.position.set(0, -2.5, 2);
    c.add(body, seq, mini);
    c.position.set(-k * 2.2, -k * 2.2, -k * 3);
    c.rotation.set(0.1, -0.3, 0.04 * k);
    cards.add(c);
    cardMeshes.push(c);
  }
  const model = hidden(labelledBox('fθ', 22, 14, 6, '#16294a', 420), 1);
  model.position.copy(at(54, 32, 0));
  const knob = new THREE.Group();
  const knobBody = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 32), new THREE.MeshPhysicalMaterial({ color: '#6c4fd1', roughness: 0.3, clearcoat: 1 }));
  const knobMark = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 2.6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  knobMark.position.set(0, 0.2, 1.6);
  knob.add(knobBody, knobMark);
  knob.position.set(0, 9.5, 0);
  model.add(knob);
  // Prediction (blue) over the reference (green ghost).
  const cmp = hidden(new THREE.Group(), 0.95);
  cmp.position.copy(at(26, 34, 0));
  const refRib = new THREE.Mesh(ribbonGeo, green(0.45));
  const predRib = new THREE.Mesh(ribbonGeo, new THREE.MeshPhysicalMaterial({ color: '#2f6fe4', roughness: 0.3, clearcoat: 0.8 }));
  cmp.add(refRib, predRib);
  const fit = { off: 1 };
  // Loss gauge.
  const gauge = hidden(new THREE.Group(), 1);
  gauge.position.copy(at(26, 80, 0));
  for (let k = 0; k < 24; k++) {
    const a = Math.PI - (k / 23) * Math.PI;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.6, 1), new THREE.MeshStandardMaterial({ color: spectrum(k / 23) }));
    seg.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    seg.rotation.z = a - Math.PI / 2;
    gauge.add(seg);
  }
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 15, 0.8), new THREE.MeshStandardMaterial({ color: C.ink }));
  needle.geometry.translate(0, 7.5, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.4, 24), new THREE.MeshStandardMaterial({ color: C.ink }));
  hub.rotation.x = Math.PI / 2;
  gauge.add(needle, hub);
  // Learning curves.
  const curves = hidden(new THREE.Group(), 1);
  curves.position.copy(at(66, 82, 0));
  const axes = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-26, -12, 0), new THREE.Vector3(26, -12, 0), new THREE.Vector3(-26, -12, 0), new THREE.Vector3(-26, 14, 0)]),
    new THREE.LineBasicMaterial({ color: '#34465e' }),
  );
  const curveLine = (f: (x: number) => number, color: THREE.ColorRepresentation) => {
    const pts = Array.from({ length: 60 }, (_, i) => new THREE.Vector3(-26 + (i / 59) * 52, -12 + f(i / 59) * 24, 0.2));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.45, 6), new THREE.MeshBasicMaterial({ color }));
    m.geometry.setDrawRange(0, 0);
    return m;
  };
  const trainCurve = curveLine((x) => 0.08 + 0.9 * Math.exp(-x * 3.4), C.blue);
  const valCurve = curveLine((x) => 0.16 + 0.82 * Math.exp(-x * 2.8), C.ember);
  curves.add(axes, trainCurve, valCurve);
  const trLinks = new Links();
  tr.root.add(cards, model, cmp, gauge, curves, trLinks.group);
  const loss = { v: 0.85 };
  world.onFrame((dt) => {
    if (!cmp.visible && !gauge.visible) return;
    predRib.position.set(9 * fit.off, -6 * fit.off, 4 * fit.off);
    predRib.rotation.set(0.6 * fit.off, -0.9 * fit.off, 0.3 * fit.off);
    cmp.rotation.y += dt * 0.25;
    needle.rotation.z = Math.PI / 2 - loss.v * Math.PI;
    pins.html('tr-loss', `${tex('\\mathcal{L}')} = ${fa(loss.v.toFixed(2)).replace('.', '٫')}`);
  });
  const drawCurves = (on: boolean, delay = 0) =>
    [trainCurve, valCurve].forEach((m) => {
      const total = (m.geometry.index?.count ?? 0) as number;
      const st = { p: m.geometry.drawRange.count / Math.max(1, total) };
      gsap.to(st, { p: on ? 1 : 0, duration: on ? 3 : 0.3, delay: on ? delay : 0, ease: 'none', onUpdate: () => m.geometry.setDrawRange(0, Math.floor((st.p * total) / 6) * 6) });
    });
  pins
    .add('tr-x', { anchor: () => tr.wp(cards.position.clone().add(new THREE.Vector3(0, 14, 0))), html: `${tex('(x,\\ y)')}<small>نمونه‌های آموزشی</small>`, cls: 'pin-sym', align: 'above' })
    .add('tr-f', { anchor: () => tr.wp(model.position.clone().add(new THREE.Vector3(0, 14, 0))), html: `${tex('f_{\\theta}')}<small>پارامترها: ${tex('\\theta')}</small>`, cls: 'pin-sym', align: 'above' })
    .add('tr-pred', { anchor: () => tr.wp(cmp.position.clone().add(new THREE.Vector3(0, 22, 0))), html: `<span>${tex('f_{\\theta}(x)')} <i class="c-pred">پیش‌بینی</i></span><span>${tex('y')} <i class="c-ref">مرجع</i></span>`, cls: 'pin-sym', align: 'above' })
    .add('tr-loss', { anchor: () => tr.wp(gauge.position.clone().add(new THREE.Vector3(0, -4, 0))), html: '', cls: 'pin-tex pin-call', align: 'below' })
    .add('tr-train', { anchor: () => tr.wp(curves.position.clone().add(new THREE.Vector3(27, -9.4, 0))), html: 'نمونه‌های آموزشی', cls: 'pin-word c-blue', align: 'left', dy: 1.8 })
    .add('tr-val', { anchor: () => tr.wp(curves.position.clone().add(new THREE.Vector3(27, -7, 0))), html: 'نمونه‌های جدید', cls: 'pin-word c-ember', align: 'left', dy: -1.8 })
    .add('tr-axis', { anchor: () => tr.wp(curves.position.clone().add(new THREE.Vector3(0, -12, 0))), html: 'مراحل آموزش ←', cls: 'pin-word', align: 'below', dy: 1 });
  const elTr = section(
    overlay,
    's-net s-train',
    panel(
      training.num,
      training.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${training.p1}</p></div>
      <div data-s="1-1">
        <div class="n-tex n-tex-big">${tex(training.tex, true)}</div>
        <p class="n-body">${training.termsLead}</p>
        <ul class="n-terms">${training.terms.map(([t, d]) => `<li>${tex(t)}<span>${d}</span></li>`).join('')}</ul>
      </div>
      <div data-s="2"><p class="n-body n-strong">${training.goal}</p></div>`,
    ),
  );
  let trTl: gsap.core.Timeline | undefined;
  const trSteps = [
    () => {
      trTl?.kill();
      [cards, model, cmp, gauge].forEach((o, i) => grow(o, true, 0.4 + i * 0.25));
      grow(curves, false);
      drawCurves(false);
      gsap.to(fit, { off: 1, duration: 0.6 });
      gsap.to(loss, { v: 0.85, duration: 0.6 });
      trLinks
        .set([
          { a: at(72, 30, 2), b: at(62, 30, 2), w: 0.8, bend: new THREE.Vector3(0, 3, 2), color: C.ink, arrow: true, r: 0.3 },
          { a: at(46, 30, 2), b: at(36, 30, 2), w: 0.8, bend: new THREE.Vector3(0, 3, 2), color: C.ink, arrow: true, r: 0.3 },
          { a: at(26, 50, 2), b: at(26, 66, 2), w: 0.8, bend: new THREE.Vector3(3, 0, 2), color: C.ink, arrow: true, r: 0.3 },
        ])
        .show(true, { delay: 1.4, stagger: 0.25 });
      pins.show('tr-loss', true, 1.8);
      pins.show(['tr-x', 'tr-f', 'tr-pred', 'tr-train', 'tr-val', 'tr-axis'], false);
    },
    () => {
      trTl?.kill();
      grow(curves, false);
      drawCurves(false);
      gsap.to(fit, { off: 1, duration: 0.6 });
      gsap.to(loss, { v: 0.85, duration: 0.6 });
      pins.show(['tr-x', 'tr-f', 'tr-pred', 'tr-loss'], true, 0.4, 0.15);
      pins.show(['tr-train', 'tr-val', 'tr-axis'], false);
    },
    () => {
      grow(curves, true, 0.2);
      drawCurves(true, 0.6);
      pins.show(['tr-train', 'tr-val', 'tr-axis'], true, 1, 0.15);
      trTl?.kill();
      trTl = gsap.timeline({ delay: 0.5 });
      trTl.to(knob.rotation, { y: knob.rotation.y + Math.PI * 4, duration: 3, ease: 'power2.inOut' }, 0);
      trTl.to(fit, { off: 0.05, duration: 3, ease: 'power2.out' }, 0);
      trTl.to(loss, { v: 0.1, duration: 3, ease: 'power2.out' }, 0);
      // A new, unseen sample: the trained model still predicts it well.
      trTl.add(() => cardMeshes[3].position.set(-6.6, -6.6, -9));
      trTl.to(cardMeshes[3].position, { x: 8, y: 16, z: 4, duration: 0.9, ease: 'power2.out' });
    },
  ];
  trHide.push(() => {
    trTl?.kill();
    [cards, model, cmp, gauge, curves].forEach((o) => grow(o, false));
    trLinks.show(false);
    pins.hide('tr-');
  });
  const sTr: Scene = {
    id: 'training',
    label: training.title,
    head,
    steps: 3,
    enter(step) {
      tr.enter();
      open(elTr);
      headIn(elTr);
      chrome.caption({ name: 'آموزش، به‌صورت طرح‌واره', detail: 'آبی: پیش‌بینی، سبز: ساختار مرجع (یوبیکوئیتین، PDB 1UBQ)' }, 2);
      stepVis(elTr, step, 0.6);
      trSteps[0]();
      if (step) trSteps[step]();
    },
    step(step) {
      stepVis(elTr, step);
      if (step < 2) cardMeshes[3].position.set(-6.6, -6.6, -9);
      trSteps[step]();
    },
    leave() {
      close(elTr);
      stepReset(elTr);
      trTl?.kill();
    },
  };

  // =========================================================================================
  // ۶. FAPE — align on one residue's frame, measure every point, cap the penalty.
  // =========================================================================================
  const faHide: (() => void)[] = [];
  const fa6 = stageAt(ctx, ANCHOR.fape, 'fape', () => faHide.forEach((f) => f()));
  const CLAMP = 10;
  // A predicted structure: the C-terminal half swung about residue 34, plus small noise.
  const hinge = TRUE[34].t.clone();
  const swing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.2, 1, 0.3).normalize(), 0.55);
  const r6 = rng(5);
  const PRED: Frame[] = TRUE.map((f, i) => {
    const t = f.t.clone();
    const q = f.q.clone();
    if (i > 34) {
      t.sub(hinge).applyQuaternion(swing).add(hinge);
      q.premultiply(swing);
    }
    t.add(new THREE.Vector3(r6() - 0.5, r6() - 0.5, r6() - 0.5).multiplyScalar(1.2));
    return { t, q };
  });
  const protF = hidden(new THREE.Group(), 2.2);
  protF.position.copy(at(32, 54, 0));
  protF.rotation.set(0.2, 0.3, 0);
  const truePl = new FramePlates(NRES, { size: 1.7, color: (_i, o) => o.set('#2fb36b') });
  TRUE.forEach((f, i) => {
    truePl.pose[i].t.copy(f.t);
    truePl.pose[i].q.copy(f.q);
  });
  truePl.update();
  const trueTr = new Trace(NRES, 0.3, new THREE.MeshStandardMaterial({ color: '#2fb36b', roughness: 0.5 }));
  trueTr.set(TRUE.map((f) => f.t));
  const predG = new THREE.Group();
  const predPl = new FramePlates(NRES, { size: 1.7, color: (_i, o) => o.set('#2f6fe4') });
  PRED.forEach((f, i) => {
    predPl.pose[i].t.copy(f.t);
    predPl.pose[i].q.copy(f.q);
  });
  predPl.update();
  const predTr = new Trace(NRES, 0.3, new THREE.MeshStandardMaterial({ color: '#2f6fe4', roughness: 0.5 }));
  predTr.set(PRED.map((f) => f.t));
  predG.add(predPl.mesh, predTr.mesh);
  const errGeo = new THREE.BufferGeometry();
  errGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NRES * 6), 3));
  errGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NRES * 6), 3));
  const errLines = new THREE.LineSegments(errGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 }));
  errLines.frustumCulled = false;
  const kAxes = axesGizmo(4, 0.2);
  protF.add(truePl.mesh, trueTr.mesh, predG, errLines, kAxes);
  fa6.root.add(protF);
  // Alignment of the prediction onto frame k of the truth: M = T_k · P_k⁻¹.
  const alignOn = (k: number) => {
    const T = new THREE.Matrix4().compose(TRUE[k].t, TRUE[k].q, new THREE.Vector3(1, 1, 1));
    const P = new THREE.Matrix4().compose(PRED[k].t, PRED[k].q, new THREE.Vector3(1, 1, 1));
    const M = T.multiply(P.invert());
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    M.decompose(p, q, new THREE.Vector3());
    return { p, q };
  };
  const al = { from: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, to: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, t: 1, k: -1 };
  let fapeVal = 0;
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const cc = new THREE.Color();
  world.onFrame(() => {
    if (!protF.visible) return;
    predG.position.lerpVectors(al.from.p, al.to.p, al.t);
    predG.quaternion.slerpQuaternions(al.from.q, al.to.q, al.t);
    predG.updateMatrix();
    const pos = errGeo.getAttribute('position') as THREE.BufferAttribute;
    const colA = errGeo.getAttribute('color') as THREE.BufferAttribute;
    let sum = 0;
    for (let i = 0; i < NRES; i++) {
      v1.copy(PRED[i].t).applyMatrix4(predG.matrix);
      v2.copy(TRUE[i].t);
      const d = v1.distanceTo(v2);
      sum += Math.min(d, CLAMP);
      pos.setXYZ(i * 2, v1.x, v1.y, v1.z);
      pos.setXYZ(i * 2 + 1, v2.x, v2.y, v2.z);
      cc.copy(d < 1 ? C.blue : d < 4 ? C.sky : d < CLAMP ? C.sun : C.alarm);
      colA.setXYZ(i * 2, cc.r, cc.g, cc.b);
      colA.setXYZ(i * 2 + 1, cc.r, cc.g, cc.b);
    }
    pos.needsUpdate = colA.needsUpdate = true;
    fapeVal = sum / NRES;
    if (al.k >= 0) {
      kAxes.position.copy(TRUE[al.k].t);
      kAxes.quaternion.copy(TRUE[al.k].q);
      pins.html('fa-val', `<span>هم‌تراز روی چارچوب باقی‌مانده‌ی ${fa(al.k + 1)}</span><small>میانگین خطای محدودشده: ${fa(fapeVal.toFixed(1)).replace('.', '٫')} Å</small>`);
    }
  });
  const goAlign = (k: number, duration = 1.6) => {
    al.from.p.copy(predG.position);
    al.from.q.copy(predG.quaternion);
    const t = k < 0 ? { p: new THREE.Vector3(), q: new THREE.Quaternion() } : alignOn(k);
    al.to.p.copy(t.p);
    al.to.q.copy(t.q);
    al.k = k;
    kAxes.visible = k >= 0;
    gsap.fromTo(al, { t: 0 }, { t: 1, duration, ease: 'power2.inOut', overwrite: true });
  };
  // The clamped penalty, as a small chart.
  const clampSvg = /* html */ `
    <svg viewBox="0 0 260 150" class="clamp-chart" aria-hidden="true">
      <line x1="30" y1="125" x2="250" y2="125" class="ax"/><line x1="30" y1="125" x2="30" y2="10" class="ax"/>
      <polyline points="30,125 140,30 250,30" class="pen"/>
      <polyline points="140,30 163,10" class="raw"/>
      <line x1="140" y1="125" x2="140" y2="30" class="mark"/>
      <text x="140" y="143" class="t">${fa(10)} Å</text>
      <text x="245" y="143" class="t">فاصله</text>
      <text x="36" y="20" class="t s">جریمه</text>
    </svg>`;
  pins
    .add('fa-true', { anchor: () => protF.localToWorld(TRUE[5].t.clone()), html: 'ساختار واقعی', cls: 'pin-word c-green', align: 'right', dx: -3 })
    .add('fa-pred', { anchor: () => protF.localToWorld(PRED[60].t.clone().applyMatrix4(predG.matrix)), html: 'پیش‌بینی', cls: 'pin-word c-blue', align: 'left', dx: 3 })
    .add('fa-val', { anchor: () => fa6.wp(at(72, 84, 0)), html: '', cls: 'pin-stat', align: 'center' })
    .add('fa-clamp', { anchor: () => fa6.wp(at(76, 34, 0)), html: `<b>تابع جریمه‌ی محدودشده</b>${clampSvg}<small>خطاهای بزرگ‌تر از سقف، جریمه‌ی بیشتری نمی‌گیرند</small>`, cls: 'pin-card', align: 'center' });
  const elFa = section(
    overlay,
    's-net s-fape',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${fape.num}</p>
      <h2 class="n-title n-title-sm">${fape.title}</h2>
      <p class="n-body n-strong fa-def">${rich(fape.def)}</p>
      <ul class="h-list h-list-sm fa-list">${fape.bullets.map((b, i) => `<li class="h-item" data-s="${i + 1}"><p>${b}</p></li>`).join('')}</ul>
    </div>`,
  );
  let faTl: gsap.core.Timeline | undefined;
  const faSteps = [
    () => {
      faTl?.kill();
      grow(protF, true, 0.4);
      goAlign(-1, 0.8);
      gsap.to(errLines.material, { opacity: 0, duration: 0.3 });
      pins.show(['fa-true', 'fa-pred'], true, 1.2, 0.2);
      pins.show(['fa-val', 'fa-clamp'], false);
    },
    () => {
      faTl?.kill();
      goAlign(9);
      gsap.to(errLines.material, { opacity: 0.95, duration: 0.6, delay: 1 });
      pins.show('fa-val', true, 1.2);
      pins.show('fa-clamp', false);
    },
    () => {
      gsap.to(errLines.material, { opacity: 0.95, duration: 0.4 });
      pins.show('fa-val', true);
      pins.show('fa-clamp', false);
      faTl?.kill();
      faTl = gsap.timeline({ repeat: -1 });
      [44, 66, 20, 9].forEach((k) => {
        faTl!.add(() => goAlign(k, 1.4));
        faTl!.to({}, { duration: 3 });
      });
    },
    () => {
      faTl?.kill();
      goAlign(9, 1.2);
      gsap.to(errLines.material, { opacity: 0.95, duration: 0.4 });
      pins.show(['fa-val', 'fa-clamp'], true, 0.4, 0.3);
    },
  ];
  faHide.push(() => {
    faTl?.kill();
    grow(protF, false);
    pins.hide('fa-');
  });
  const sFa: Scene = {
    id: 'fape',
    label: fape.title,
    head,
    steps: 4,
    enter(step) {
      fa6.enter();
      open(elFa);
      headIn(elFa);
      chrome.caption({ name: 'مقایسه در چارچوب‌های محلی', detail: 'سبز: ساختار واقعی (PDB 1UBQ)، آبی: یک پیش‌بینی نمایشی' }, 2);
      stepVis(elFa, step, 0.6);
      faSteps[0]();
      if (step) gsap.delayedCall(0.5, () => faSteps[step]());
    },
    step(step) {
      stepVis(elFa, step);
      faSteps[step]();
    },
    leave() {
      close(elFa);
      stepReset(elFa);
      faTl?.kill();
    },
  };

  // =========================================================================================
  // ۷. Optimisation — one ball rolling down a loss landscape, one loop at a time.
  // =========================================================================================
  const opHide: (() => void)[] = [];
  const op = stageAt(ctx, ANCHOR.optim, 'optim', () => opHide.forEach((f) => f()));
  const h = (x: number, z: number) =>
    15 - 13 * Math.exp(-((x - 14) ** 2 + (z + 10) ** 2) / 260) - 7 * Math.exp(-((x + 20) ** 2 + (z - 16) ** 2) / 110) + 2.2 * Math.sin(x / 7) * Math.cos(z / 9) + 0.0035 * (x * x + z * z);
  const SZ = 84;
  const land = new THREE.PlaneGeometry(SZ, SZ, 84, 84);
  land.rotateX(-Math.PI / 2);
  const lp = land.getAttribute('position') as THREE.BufferAttribute;
  const lc = new Float32Array(lp.count * 3);
  let hMin = Infinity;
  let hMax = -Infinity;
  for (let i = 0; i < lp.count; i++) {
    const y = h(lp.getX(i), lp.getZ(i));
    lp.setY(i, y);
    hMin = Math.min(hMin, y);
    hMax = Math.max(hMax, y);
  }
  for (let i = 0; i < lp.count; i++) spectrum((lp.getY(i) - hMin) / (hMax - hMin), col).toArray(lc, i * 3);
  land.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  land.computeVertexNormals();
  const landMesh = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ vertexColors: true, color: '#c3cad4', roughness: 0.85, envMapIntensity: 0.35, side: THREE.DoubleSide }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(SZ, SZ, 28, 28)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 }));
  {
    const wp = wire.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i);
      const z = -wp.getY(i);
      wp.setXYZ(i, x, h(x, z) + 0.12, z);
    }
  }
  const landG = hidden(new THREE.Group(), 0.92);
  landG.position.copy(at(50, 58, 0));
  landG.rotation.set(0.62, -0.5, 0);
  // Gradient descent with momentum from a poor start.
  const path: THREE.Vector3[] = [];
  {
    let x = -32;
    let z = 30;
    let vx = 0;
    let vz = 0;
    for (let i = 0; i < 90; i++) {
      path.push(new THREE.Vector3(x, h(x, z), z));
      const e = 0.01;
      const gx = (h(x + e, z) - h(x - e, z)) / (2 * e);
      const gz = (h(x, z + e) - h(x, z - e)) / (2 * e);
      vx = 0.82 * vx - 1.6 * gx;
      vz = 0.82 * vz - 1.6 * gz;
      x += vx * 0.6;
      z += vz * 0.6;
    }
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1, emissive: '#ffd21f', emissiveIntensity: 0.25 }));
  const trail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map((p) => p.clone().add(new THREE.Vector3(0, 0.6, 0)))), 400, 0.4, 6), new THREE.MeshBasicMaterial({ color: C.ink }));
  trail.geometry.setDrawRange(0, 0);
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 8), new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0 }));
  const grad = new THREE.Group();
  const gShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 12), new THREE.MeshStandardMaterial({ color: C.alarm }));
  gShaft.position.y = 4.5;
  const gHead = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 18), new THREE.MeshStandardMaterial({ color: C.alarm }));
  gHead.position.y = 10.5;
  grad.add(gShaft, gHead);
  grad.scale.setScalar(0.001);
  landG.add(landMesh, wire, trail, drop, ball, grad);
  op.root.add(landG);
  const roll = { s: 0, pulse: 0 };
  const trailIdx = (s: number) => Math.floor((Math.min(s, path.length - 1) / (path.length - 1)) * ((trail.geometry.index?.count ?? 0) / 6)) * 6;
  world.onFrame(() => {
    if (!landG.visible) return;
    const s = roll.s;
    const i0 = Math.floor(s);
    const i1 = Math.min(path.length - 1, i0 + 1);
    const p = path[i0].clone().lerp(path[i1], s - i0);
    ball.position.copy(p).add(new THREE.Vector3(0, 2.2 + roll.pulse * 1.5, 0));
    ball.scale.setScalar(1 + roll.pulse * 0.25);
    trail.geometry.setDrawRange(0, trailIdx(s));
    drop.position.set(p.x, (p.y + hMin - 4) / 2, p.z);
    drop.scale.set(1, Math.max(0.01, p.y - hMin + 4), 1);
    // Downhill direction, drawn along the surface.
    const e = 0.01;
    const gx = (h(p.x + e, p.z) - h(p.x - e, p.z)) / (2 * e);
    const gz = (h(p.x, p.z + e) - h(p.x, p.z - e)) / (2 * e);
    const dir = new THREE.Vector3(-gx, -(gx * gx + gz * gz), -gz).normalize();
    grad.position.copy(ball.position);
    grad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    pins.html('op-loss', `${tex('\\mathcal{L}')} = ${fa(((p.y - hMin) / (hMax - hMin)).toFixed(2)).replace('.', '٫')}`);
  });
  pins
    .add('op-start', { anchor: () => landG.localToWorld(path[0].clone().add(new THREE.Vector3(0, 6, 0))), html: 'پارامترهای اولیه', cls: 'pin-word', align: 'above' })
    .add('op-loss', { anchor: () => ball.getWorldPosition(new THREE.Vector3()), html: '', cls: 'pin-tex pin-call', align: 'left', dx: 3 })
    .add('op-min', { anchor: () => landG.localToWorld(path[path.length - 1].clone().add(new THREE.Vector3(0, 2, 0))), html: 'کمینه‌ی زیان', cls: 'pin-flag', align: 'below', dy: 3 })
    .add('op-axis', { anchor: () => op.wp(at(40, 98, 0)), html: 'سطح زیان روی فضای پارامترها (نمایشی)', cls: 'pin-word', align: 'center' });
  const elOp = section(
    overlay,
    's-net s-optim',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${optimize.num}</p>
      <h2 class="n-title n-title-sm">${optimize.title}</h2>
      <p class="n-body op-lead">${optimize.lead}</p>
      <ol class="n-stages op-steps">
        ${optimize.steps.map((s, i) => `<li class="n-stage" style="--c:${['#0053d6', '#1f8fc2', '#c4122f', '#6c4fd1', '#1fae5b'][i]}"><b>${fa(i + 1)}</b><div><p>${rich(s)}</p></div></li>`).join('')}
      </ol>
    </div>`,
  );
  const opStages = $$('.n-stage', elOp);
  let opTl: gsap.core.Timeline | gsap.core.Tween | undefined;
  const opSteps = [
    () => {
      opTl?.kill();
      grow(landG, true, 0.3);
      gsap.to(roll, { s: 0, pulse: 0, duration: 0.6 });
      gsap.to(grad.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
      gsap.to(drop.material, { opacity: 0, duration: 0.3 });
      pins.show(['op-start', 'op-axis'], true, 1, 0.2);
      pins.show(['op-loss', 'op-min'], false);
    },
    () => {
      opTl?.kill();
      gsap.to(roll, { s: 0, duration: 0.4 });
      opTl = gsap.fromTo(roll, { pulse: 0 }, { pulse: 1, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      gsap.to(drop.material, { opacity: 0, duration: 0.3 });
      gsap.to(grad.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
      pins.show('op-loss', false);
    },
    () => {
      opTl?.kill();
      pins.show('op-loss', true, 0.4);
      gsap.to(grad.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
    },
    () => {
      opTl?.kill();
      gsap.to(roll, { s: 0, duration: 0.4 });
      gsap.to(grad.scale, { x: 1, y: 1, z: 1, duration: 0.8, delay: 0.3, ease: 'back.out(2)' });
    },
    () => {
      opTl?.kill();
      opTl = gsap.fromTo(roll, { s: 0 }, { s: 3, duration: 1.6, ease: 'power2.inOut' });
    },
    () => {
      opTl?.kill();
      opTl = gsap.to(roll, { s: path.length - 1, duration: 8, ease: 'power1.inOut' });
      pins.show('op-start', false);
      pins.show('op-min', true, 7.5);
    },
  ];
  opHide.push(() => {
    opTl?.kill();
    grow(landG, false);
    pins.hide('op-');
  });
  const sOp: Scene = {
    id: 'optimize',
    label: optimize.title,
    head,
    steps: 6,
    enter(step) {
      op.enter();
      open(elOp);
      headIn(elOp);
      gsap.fromTo($('.op-lead', elOp), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.5 });
      chrome.caption(null);
      opStages.forEach((li, i) => li.classList.toggle('is-active', i === step - 1));
      opSteps[0]();
      for (let s = 2; s <= Math.min(step, 4); s++) if (s !== 4) opSteps[s]();
      if (step) opSteps[step]();
    },
    step(step) {
      opStages.forEach((li, i) => li.classList.toggle('is-active', i === step - 1));
      opSteps[step]();
    },
    leave() {
      close(elOp);
      opTl?.kill();
    },
  };

  // =========================================================================================
  // ۸. Self-distillation — predict many sequences, keep the confident ones, retrain.
  // =========================================================================================
  const dsHide: (() => void)[] = [];
  const ds = stageAt(ctx, ANCHOR.distill, 'distill', () => dsHide.forEach((f) => f()));
  const NP = 420;
  const r8 = rng(21);
  const sph = (c: THREE.Vector3, rad: number) => {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(r8()) * rad);
    return v.add(c);
  };
  const P = {
    cloud: at(84, 30, 0),
    teacher: at(60, 30, 0),
    pred: at(36, 30, 0),
    gate: at(36, 55, 0),
    sel: at(36, 80, 0),
    pdb: at(12, 80, 0),
    final: at(62, 80, 0),
  };
  const conf = Array.from({ length: NP }, () => {
    const u = r8();
    return u < 0.55 ? 0 : u < 0.72 ? 1 : u < 0.86 ? 2 : 3;
  });
  const parts = Array.from({ length: NP }, (_, i) => ({
    home: sph(P.cloud, 11),
    pred: sph(P.pred, 11),
    sel: sph(P.sel, 8),
    off: r8(),
    pass: conf[i] <= 1,
  }));
  const dots = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), NP);
  dots.frustumCulled = false;
  const BAND = [C.blue, C.sky, C.sun, C.ember];
  const GREY = new THREE.Color('#9aa8ba');
  const pdbN = 90;
  const pdb = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: '#2fb36b', roughness: 0.4 }), pdbN);
  pdb.frustumCulled = false;
  const pdbHome = Array.from({ length: pdbN }, () => sph(P.pdb, 8));
  const teacher = hidden(labelledBox('مدل آموزش‌دیده', 26, 11, 5, '#16294a', 200), 1);
  teacher.position.copy(P.teacher);
  const finalM = hidden(labelledBox('مدل نهایی', 26, 11, 5, '#1d6b45', 230), 1);
  finalM.position.copy(P.final);
  const gate = hidden(new THREE.Group(), 1);
  gate.position.copy(P.gate);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(8, 0.9, 16, 64), new THREE.MeshPhysicalMaterial({ color: '#16294a', roughness: 0.3, clearcoat: 1 }));
  gate.add(ringMesh);
  ds.root.add(dots, pdb, teacher, finalM, gate);
  const st = { a: 0, b: 0, c: 0, on: 0 };
  const glow = (finalM.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
  const pv = new THREE.Vector3();
  const dc = new THREE.Color();
  const sm = (x: number) => x * x * (3 - 2 * x);
  world.onFrame((_, t) => {
    const vis = st.on > 0.001;
    dots.visible = pdb.visible = vis;
    if (!vis) return;
    parts.forEach((p, i) => {
      const a = Math.min(1, Math.max(0, st.a * 1.6 - p.off * 0.6));
      const b = Math.min(1, Math.max(0, st.b * 1.5 - p.off * 0.5));
      const c = Math.min(1, Math.max(0, st.c * 1.5 - p.off * 0.5));
      let s = 0.9 * st.on;
      if (a < 0.5) pv.lerpVectors(p.home, P.teacher, sm(a * 2));
      else pv.lerpVectors(P.teacher, p.pred, sm((a - 0.5) * 2));
      if (b > 0) {
        if (b < 0.5) pv.lerpVectors(p.pred, P.gate, sm(b * 2));
        else if (p.pass) pv.lerpVectors(P.gate, p.sel, sm((b - 0.5) * 2));
        else {
          pv.copy(P.gate).add(new THREE.Vector3((p.off - 0.5) * 30, -(b - 0.5) * 30, 10));
          s *= 1 - (b - 0.5) * 2;
        }
      }
      if (c > 0 && p.pass) {
        pv.lerp(P.final, sm(c));
        s *= 1 - c * 0.7;
      }
      if (a > 0.05 && a < 0.95) pv.y += Math.sin(t * 3 + i) * 0.4;
      _m.makeScale(s, s, s).setPosition(pv);
      dots.setMatrixAt(i, _m);
      dots.setColorAt(i, a < 0.5 ? GREY : dc.copy(BAND[conf[i]]));
    });
    dots.instanceMatrix.needsUpdate = true;
    dots.instanceColor!.needsUpdate = true;
    pdbHome.forEach((hm, i) => {
      const c = Math.min(1, Math.max(0, st.c * 1.5 - (i / pdbN) * 0.5));
      pv.lerpVectors(hm, P.final, sm(c));
      const s = st.on * (1 - c * 0.7);
      _m.makeScale(s, s, s).setPosition(pv);
      pdb.setMatrixAt(i, _m);
    });
    pdb.instanceMatrix.needsUpdate = true;
    glow.emissive.set('#2fb36b');
    glow.emissiveIntensity = st.c * (0.5 + 0.3 * Math.sin(t * 4));
  });
  pins
    .add('ds-cloud', { anchor: () => ds.wp(P.cloud.clone().add(new THREE.Vector3(0, -13, 0))), html: 'Uniclust30<small>توالی‌های بدون ساختار</small>', cls: 'pin-term pin-stack ltr-mix', align: 'below' })
    .add('ds-count', { anchor: () => ds.wp(P.cloud.clone().add(new THREE.Vector3(0, 13, 0))), html: '<b class="ds-n">۰</b><small>توالی</small>', cls: 'pin-count', align: 'above' })
    .add('ds-pred', { anchor: () => ds.wp(P.pred.clone().add(new THREE.Vector3(0, 13, 0))), html: 'پیش‌بینی‌ها<small>رنگ: میزان اطمینان</small>', cls: 'pin-term pin-stack', align: 'above' })
    .add('ds-gate', { anchor: () => ds.wp(P.gate.clone().add(new THREE.Vector3(10, 0, 0))), html: 'فقط پیش‌بینی‌های مطمئن', cls: 'pin-flag', align: 'left', dx: 1 })
    .add('ds-pdb', { anchor: () => ds.wp(P.pdb.clone().add(new THREE.Vector3(0, -10, 0))), html: 'PDB<small>ساختارهای تجربی</small>', cls: 'pin-term pin-stack c-green', align: 'below' })
    .add('ds-sel', { anchor: () => ds.wp(P.sel.clone().add(new THREE.Vector3(0, -10, 0))), html: 'پیش‌بینی‌های انتخاب‌شده', cls: 'pin-term', align: 'below' });
  const elDs = section(
    overlay,
    's-net s-distill',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${distill.num}</p>
      <h2 class="n-title n-title-sm">${distill.title} <span class="ltr n-latin blk">${distill.latin}</span></h2>
      <p class="n-body ds-lead">${distill.lead}</p>
      <p class="n-body ds-sublead" data-s="1">${distill.stepsLead}</p>
      <ol class="n-list ds-steps">${distill.steps.map((s, i) => `<li data-s="${i + 1}"><b>${fa(i + 1)}</b><span>${s}</span></li>`).join('')}</ol>
    </div>`,
  );
  const counter = { n: 0 };
  const dsSteps = [
    () => {
      gsap.to(st, { a: 0, b: 0, c: 0, on: 1, duration: 0.8, overwrite: true });
      [teacher, gate, finalM].forEach((o, i) => grow(o, true, 0.4 + i * 0.2));
      pins.show(['ds-cloud', 'ds-pdb'], true, 1, 0.2);
      pins.show(['ds-count', 'ds-pred', 'ds-gate', 'ds-sel'], false);
    },
    () => {
      gsap.to(st, { b: 0, c: 0, duration: 0.5, overwrite: 'auto' });
      gsap.fromTo(st, { a: 0 }, { a: 1, duration: 3.6, delay: 0.3, ease: 'none', overwrite: 'auto' });
      pins.show('ds-pred', true, 3);
      pins.show(['ds-gate', 'ds-sel'], false);
    },
    () => {
      gsap.to(st, { a: 1, b: 0, c: 0, duration: 0.5, overwrite: 'auto' });
      pins.show('ds-count', true, 0.2);
      gsap.fromTo(counter, { n: 0 }, {
        n: 356000,
        duration: 2.4,
        delay: 0.3,
        ease: 'power2.out',
        onUpdate: () => {
          const el = pins.el('ds-count')?.querySelector('.ds-n');
          if (el) el.textContent = fa(Math.round(counter.n / 1000) * 1000);
        },
      });
    },
    () => {
      gsap.to(st, { a: 1, c: 0, duration: 0.4, overwrite: 'auto' });
      gsap.fromTo(st, { b: 0 }, { b: 1, duration: 3, delay: 0.3, ease: 'none', overwrite: 'auto' });
      pins.show('ds-gate', true, 0.4);
      pins.show('ds-sel', true, 2.6);
    },
    () => {
      gsap.to(st, { a: 1, b: 1, duration: 0.4, overwrite: 'auto' });
      gsap.fromTo(st, { c: 0 }, { c: 1, duration: 3, delay: 0.3, ease: 'none', overwrite: 'auto' });
    },
  ];
  dsHide.push(() => {
    gsap.to(st, { on: 0, duration: 0.5, overwrite: true });
    [teacher, gate, finalM].forEach((o) => grow(o, false));
    pins.hide('ds-');
  });
  const sDs: Scene = {
    id: 'distill',
    label: distill.title,
    head,
    steps: 5,
    enter(step) {
      ds.enter();
      open(elDs);
      headIn(elDs);
      gsap.fromTo($('.ds-lead', elDs), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.5 });
      chrome.caption({ name: 'خودتقطیری، به‌صورت طرح‌واره', detail: 'هر نقطه: یک توالی؛ رنگ‌ها مانند معیار اطمینان AlphaFold' }, 2);
      stepVis(elDs, step, 0.6);
      dsSteps[0]();
      for (let s = 1; s <= step; s++) dsSteps[s]();
    },
    step(step, dir) {
      stepVis(elDs, step);
      if (dir < 0) {
        dsSteps[0]();
        for (let s = 1; s <= step; s++) dsSteps[s]();
      } else dsSteps[step]();
    },
    leave() {
      close(elDs);
      stepReset(elDs);
    },
  };

  return [sCh, sTr, sFa, sOp, sDs];
}
