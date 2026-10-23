import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { chapter4, casp, caspResults, metrics, confidence, closing, cover, fa } from '../../content';
import { GLOBINS } from '../../data/globins';
import { AF, MOL, type Molecule } from '../../data/molecules';
import { Cartoon } from '../../three/cartoon';
import { Dust, textPoints } from '../../three/chain';
import { Trace } from '../../three/frames';
import { ANCHOR, C, shot, spectrum } from '../../three/world';
import { $, $$, words, reveal, open, close, section, stepVis, stepReset } from '../../ui/text';
import type { Ctx } from '../ctx';
import { at } from '../net/common';
import { grow, headIn, hidden, labelTexture, rng, stageAt } from './stage';
import { glyphCells } from './training';
import imgT1037 from '../../assets/casp14_t1037.jpg';
import imgT1049 from '../../assets/casp14_t1049.jpg';

// Chapter ۴: how good is it? CASP14 (blind test, history, headline numbers), the accuracy
// metrics computed on a real pair of structures, AlphaFold's own confidence, and the close.

/** AlphaFold DB confidence colours — the same four hues the whole talk is painted with. */
export const plddtColor = (v: number, out = new THREE.Color()) => out.copy(v > 90 ? C.blue : v > 70 ? C.sky : v > 50 ? C.sun : C.ember);
const SERIES = ['#4a72c4', '#ecb31c', '#86c04f'];

function panel(num: string, title: string, body: string, cls = '') {
  return /* html */ `
    <div class="n-panel ${cls}">
      <p class="w-num">${num}</p>
      <h2 class="n-title n-title-sm ltr-mix">${title}</h2>
      <div class="swap">${body}</div>
    </div>`;
}

/** A sub-molecule made of residues [from, to) of chain 0 (for moving domains separately). */
function slice(mol: Molecule, from: number, to: number): Molecule {
  const c = mol.chains[0];
  return {
    id: `${mol.id}:${from}-${to}`,
    chains: [{ id: c.id, seq: c.seq.slice(from, to), ss: c.ss.slice(from, to), ca: c.ca.slice(from * 3, to * 3), c: c.c.slice(from * 3, to * 3), o: c.o.slice(from * 3, to * 3) }],
    atoms: [],
    ligands: [],
  };
}

/** Accuracy metrics for two Cα sets over aligned pairs (already superposed). */
function compare(ref: THREE.Vector3[], mod: THREE.Vector3[], pairs: [number, number][], refLen: number) {
  const d = pairs.map(([a, b]) => ref[a].distanceTo(mod[b]));
  const gdtCut = [1, 2, 4, 8].map((c) => d.filter((x) => x <= c).length / refLen);
  const rmsd = Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
  // lDDT on Cα: for each residue, distances to neighbours within 15 Å in the reference,
  // the fraction preserved within 0.5, 1, 2 and 4 Å — no superposition involved.
  let kept = 0;
  let total = 0;
  for (const [a, b] of pairs)
    for (const [a2, b2] of pairs) {
      if (a2 === a) continue;
      const dr = ref[a].distanceTo(ref[a2]);
      if (dr >= 15) continue;
      const dm = mod[b].distanceTo(mod[b2]);
      const diff = Math.abs(dr - dm);
      for (const t of [0.5, 1, 2, 4]) {
        total++;
        if (diff < t) kept++;
      }
    }
  return { d, gdtCut, gdt: (gdtCut.reduce((s, x) => s + x, 0) / 4) * 100, rmsd, lddt: (kept / total) * 100 };
}

export function evaluationScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins, notes } = ctx;
  const head = { num: chapter4.num, title: chapter4.title };
  const pf = (v: number, d = 1) => fa(v.toFixed(d)).replace('.', '٫');

  // =========================================================================================
  // Chapter opener: the numeral «۴» as a field of rising bars — evaluation.
  // =========================================================================================
  const C4 = ANCHOR.chapter4;
  const cells = glyphCells('۴', '900 520px "Vazirmatn Variable"', 9);
  const r4 = rng(13);
  const heights = cells.map(() => 3 + r4() * 13);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 1, 2.7), new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8 }), cells.length);
  bars.frustumCulled = false;
  const hc = new THREE.Color();
  heights.forEach((h, i) => bars.setColorAt(i, spectrum(1 - (h - 3) / 13, hc)));
  const barG = new THREE.Group();
  barG.position.copy(C4).add(new THREE.Vector3(14, -2, 0));
  barG.rotation.set(1.2, -0.18, 0);
  barG.add(bars);
  world.scene.add(barG);
  const rise = { t: 0 };
  const _m = new THREE.Matrix4();
  world.onFrame(() => {
    barG.visible = rise.t > 0.001;
    if (!barG.visible) return;
    cells.forEach(([x, y], i) => {
      const k = Math.min(1, Math.max(0, rise.t * 1.6 - (i / cells.length) * 0.6));
      const hh = Math.max(0.01, heights[i] * gsap.parseEase('back.out(1.6)')(k));
      _m.makeScale(1, hh, 1).setPosition(x * 3.1, hh / 2, -y * 3.1);
      bars.setMatrixAt(i, _m);
    });
    bars.instanceMatrix.needsUpdate = true;
  });
  ctx.register('chapter4', () => void gsap.to(rise, { t: 0, duration: 0.6, overwrite: true }));
  const elCh = section(
    overlay,
    's-chapter s-ch4',
    /* html */ `
    <div class="ch-block">
      <h2 class="ch-title split">${chapter4.title}</h2>
      <ol class="toc">
        ${[casp, metrics, confidence].map((s) => `<li class="rv"><b>${s.num}</b><span>${s.title}</span></li>`).join('')}
      </ol>
    </div>`,
  );
  const sCh: Scene = {
    id: 'chapter-4',
    label: `${chapter4.num} ${chapter4.title}`,
    chapter: true,
    enter() {
      ctx.area('chapter4');
      open(elCh);
      chrome.caption(null);
      world.fogTo(150, 520);
      world.fly(shot(C4, { pz: 165, ox: 0.2, oy: 0.04 }), 3);
      gsap.fromTo(rise, { t: 0 }, { t: 1, duration: 2.8, delay: 0.4, ease: 'none', overwrite: true });
      words($('.ch-title', elCh), 0.9, 0.1);
      $$('.toc li', elCh).forEach((li, i) => reveal(li, true, 1.5 + i * 0.15));
    },
    leave() {
      close(elCh);
      reveal($$('.rv', elCh), false);
    },
  };

  // =========================================================================================
  // ۹. CASP14 — sealed targets, blind predictions, and fourteen rounds of results.
  // =========================================================================================
  const csHide: (() => void)[] = [];
  const cs = stageAt(ctx, ANCHOR.casp, 'casp', () => csHide.forEach((f) => f()));
  // Sealed targets.
  const TARGETS = [MOL.ubiquitin, MOL.lysozyme, MOL.calmodulin, MOL.ubiquitin];
  const crateRow = hidden(new THREE.Group(), 1);
  crateRow.position.copy(at(42, 56, 0));
  const lids: THREE.Mesh[] = [];
  const reveals: THREE.Group[] = [];
  const preds: THREE.Group[] = [];
  const qTex = labelTexture('؟', { w: 256, h: 256, size: 190, color: '#ffffff' });
  TARGETS.forEach((mol, k) => {
    const x = (k - 1.5) * 22;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), new THREE.MeshPhysicalMaterial({ color: '#16294a', roughness: 0.35, clearcoat: 0.8, transparent: true, opacity: 1 }));
    housing.position.set(x, 0, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: qTex, transparent: true }));
    face.position.set(x, 0, 7.05);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 15), new THREE.MeshPhysicalMaterial({ color: '#34465e', roughness: 0.3, clearcoat: 1 }));
    lid.position.set(x, 6.8, 0);
    const exp = new THREE.Group();
    const geo = new Cartoon(mol).mesh.geometry;
    const scale = 7 / (geo.boundingSphere?.radius ?? 20);
    const g1 = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#2fb36b', roughness: 0.35, clearcoat: 0.6 }));
    exp.add(g1);
    exp.scale.setScalar(scale);
    const pred = new THREE.Group();
    const g2 = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#2f6fe4', roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.85 }));
    pred.add(g2);
    pred.scale.setScalar(scale);
    exp.position.set(x, 0, 0);
    pred.position.set(x, 34, 0);
    exp.visible = pred.visible = false;
    crateRow.add(housing, face, lid, exp, pred);
    lids.push(lid);
    reveals.push(exp);
    preds.push(pred);
  });
  // History chart.
  const chart = hidden(new THREE.Group(), 1);
  chart.position.copy(at(50, 82, 0));
  const H = 44;
  const GW = 6.6;
  const barMeshes: { m: THREE.Mesh; v: number; g: number }[] = [];
  const barMats = SERIES.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.4 }));
  casp.history.forEach((vals, g) =>
    vals.forEach((v, s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), barMats[s]);
      m.position.set((g - 6.5) * GW + (s - 1) * 2.15, 0, 0);
      m.scale.y = 0.001;
      chart.add(m);
      barMeshes.push({ m, v, g });
    }),
  );
  const gridPts: THREE.Vector3[] = [];
  for (const v of [0, 25, 50, 75, 100]) gridPts.push(new THREE.Vector3(-7 * GW - 2, (v / 100) * H, -1.2), new THREE.Vector3(7 * GW, (v / 100) * H, -1.2));
  chart.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts), new THREE.LineBasicMaterial({ color: '#b8c6d6' })));
  const halo = new THREE.Mesh(new THREE.BoxGeometry(GW * 0.95, H * 1.04, 0.4), new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: 0 }));
  halo.position.set(6.5 * GW, (H * 1.04) / 2, -1.6);
  chart.add(halo);
  // Panel b: CASP14 with and without AlphaFold2.
  const chartB = hidden(new THREE.Group(), 1);
  chartB.position.copy(at(50, 82, 0));
  const barsB: { m: THREE.Mesh; v: number }[] = [];
  casp.withAf2.forEach((vals, g) =>
    vals.forEach((v, s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 4), barMats[s]);
      m.position.set((g - 0.5) * 34 + (s - 1) * 6, 0, 0);
      m.scale.y = 0.001;
      chartB.add(m);
      barsB.push({ m, v });
    }),
  );
  const gridB: THREE.Vector3[] = [];
  for (const v of [50, 60, 70, 80, 90, 100]) gridB.push(new THREE.Vector3(-30, ((v - 50) / 50) * H, -2.2), new THREE.Vector3(30, ((v - 50) / 50) * H, -2.2));
  chartB.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridB), new THREE.LineBasicMaterial({ color: '#b8c6d6' })));
  cs.root.add(crateRow, chart, chartB);
  const growBars = (on: boolean, delay = 0) =>
    barMeshes.forEach(({ m, v, g }, i) => {
      const hgt = (v / 100) * H;
      gsap.to(m.scale, { y: on ? hgt : 0.001, duration: on ? 0.7 : 0.3, delay: on ? delay + g * 0.12 + (i % 3) * 0.04 : 0, ease: on ? 'power3.out' : 'power2.in', overwrite: true });
      gsap.to(m.position, { y: on ? hgt / 2 : 0, duration: on ? 0.7 : 0.3, delay: on ? delay + g * 0.12 + (i % 3) * 0.04 : 0, ease: on ? 'power3.out' : 'power2.in', overwrite: true });
    });
  const growBarsB = (on: boolean, delay = 0) =>
    barsB.forEach(({ m, v }, i) => {
      const hgt = ((v - 50) / 50) * H;
      gsap.to(m.scale, { y: on ? hgt : 0.001, duration: on ? 0.8 : 0.3, delay: on ? delay + i * 0.1 : 0, ease: on ? 'power3.out' : 'power2.in', overwrite: true });
      gsap.to(m.position, { y: on ? hgt / 2 : 0, duration: on ? 0.8 : 0.3, delay: on ? delay + i * 0.1 : 0, ease: on ? 'power3.out' : 'power2.in', overwrite: true });
    });
  const legend = SERIES.map((c, i) => `<span><i style="background:${c}"></i>${casp.difficulty[i]}</span>`).join('');
  casp.history.forEach((_, g) =>
    pins.add(`cs-g${g}`, { anchor: () => chart.localToWorld(new THREE.Vector3((g - 6.5) * GW, -1.5, 0)), html: fa(g + 1), cls: `pin-num${g === 13 ? ' pin-hot14' : ''}`, align: 'below' }),
  );
  [0, 50, 100].forEach((v) => pins.add(`cs-y${v}`, { anchor: () => chart.localToWorld(new THREE.Vector3(-7 * GW - 2, (v / 100) * H, 0)), html: fa(v), cls: 'pin-num', align: 'right', dx: -0.8 }));
  [50, 75, 100].forEach((v) => pins.add(`cs-b${v}`, { anchor: () => chartB.localToWorld(new THREE.Vector3(-30, ((v - 50) / 50) * H, 0)), html: fa(v), cls: 'pin-num', align: 'right', dx: -0.8 }));
  pins
    .add('cs-axis', { anchor: () => chart.localToWorld(new THREE.Vector3(0, -1.5, 0)), html: 'دوره‌های CASP', cls: 'pin-word', align: 'below', dy: 3.4 })
    .add('cs-yt', { anchor: () => chart.localToWorld(new THREE.Vector3(-7 * GW - 2, H + 6, 0)), html: 'GDT_TS ٪', cls: 'pin-word ltr-mix', align: 'right', dx: -0.6 })
    .add('cs-leg', { anchor: () => chart.localToWorld(new THREE.Vector3(-7 * GW, H + 6, 0)), html: `<span class="cs-legend ltr">${legend}</span>`, cls: 'pin-plain', align: 'left', dy: -1 })
    .add('cs-14', { anchor: () => chart.localToWorld(new THREE.Vector3(6.5 * GW, H * 1.06, 0)), html: 'CASP14 · AlphaFold2', cls: 'pin-flag ltr-mix', align: 'above', dy: -0.6 })
    .add('cs-bl', { anchor: () => chartB.localToWorld(new THREE.Vector3(-17, -1.5, 0)), html: 'CASP14 بدون AF2', cls: 'pin-term ltr-mix', align: 'below' })
    .add('cs-br', { anchor: () => chartB.localToWorld(new THREE.Vector3(17, -1.5, 0)), html: 'CASP14 با AF2', cls: 'pin-term ltr-mix', align: 'below' })
    .add('cs-legb', { anchor: () => chartB.localToWorld(new THREE.Vector3(0, H + 4, 0)), html: `<span class="cs-legend ltr">${legend}</span>`, cls: 'pin-plain', align: 'above' })
    .add('cs-seal', { anchor: () => crateRow.localToWorld(new THREE.Vector3(0, -9, 0)), html: 'ساختار تجربی: هنوز منتشر نشده', cls: 'pin-flag', align: 'below' })
    .add('cs-pred', { anchor: () => crateRow.localToWorld(new THREE.Vector3(0, 43, 0)), html: 'پیش‌بینی‌های شرکت‌کنندگان', cls: 'pin-term c-blue', align: 'above' })
    .add('cs-cmp', { anchor: () => crateRow.localToWorld(new THREE.Vector3(0, -9, 0)), html: 'مقایسه: سبز تجربی، آبی پیش‌بینی', cls: 'pin-flag', align: 'below' });
  const elCs = section(
    overlay,
    's-net s-casp',
    panel(
      casp.num,
      casp.title,
      /* html */ `
      <div data-s="0-0"><p class="n-body n-strong">${casp.def}</p></div>
      <div data-s="1-1"><p class="n-body n-strong">${casp.blind}</p></div>
      <div data-s="2"><p class="n-body n-strong">${casp.result}</p></div>`,
    ),
  );
  let csTl: gsap.core.Timeline | undefined;
  const closeCrates = () => {
    lids.forEach((l) => gsap.to(l.position, { y: 6.8, duration: 0.4, overwrite: true }));
    reveals.forEach((r) => {
      gsap.killTweensOf(r.position);
      r.visible = false;
      r.position.y = 0;
    });
    preds.forEach((p) => {
      gsap.killTweensOf(p.position);
      p.visible = false;
      p.position.y = 34;
    });
  };
  const csSteps = [
    () => {
      csTl?.kill();
      closeCrates();
      grow(crateRow, true, 0.4);
      grow(chart, false);
      grow(chartB, false);
      growBars(false);
      growBarsB(false);
      pins.show('cs-seal', true, 1.2);
      pins.hide('cs-g');
      pins.hide('cs-y');
      pins.hide('cs-b');
      pins.show(['cs-axis', 'cs-yt', 'cs-leg', 'cs-14', 'cs-bl', 'cs-br', 'cs-legb', 'cs-pred', 'cs-cmp'], false);
    },
    () => {
      csTl?.kill();
      closeCrates();
      grow(crateRow, true);
      grow(chart, false);
      growBars(false);
      pins.show('cs-seal', false);
      csTl = gsap.timeline({ delay: 0.3 });
      csTl.add(() => {
        preds.forEach((p) => (p.visible = true));
        pins.show('cs-pred', true);
      });
      lids.forEach((l, k) => csTl!.to(l.position, { y: 22, duration: 0.8, ease: 'power2.out' }, 1.2 + k * 0.1));
      csTl.add(() => reveals.forEach((r) => (r.visible = true)), 1.4);
      reveals.forEach((r, k) => csTl!.to(r.position, { y: 16, duration: 1, ease: 'power2.out' }, 1.4 + k * 0.1));
      csTl.add(() => pins.show('cs-pred', false), 2.4);
      preds.forEach((p, k) => csTl!.to(p.position, { y: 16, duration: 1, ease: 'power2.inOut' }, 2.4 + k * 0.12));
      csTl.add(() => pins.show('cs-cmp', true), 3.4);
    },
    () => {
      csTl?.kill();
      grow(crateRow, false);
      grow(chartB, false);
      growBarsB(false);
      pins.show(['cs-seal', 'cs-pred', 'cs-cmp', 'cs-bl', 'cs-br', 'cs-legb'], false);
      pins.hide('cs-b');
      grow(chart, true, 0.3);
      growBars(true, 0.6);
      gsap.to(halo.material, { opacity: 0.25, duration: 0.8, delay: 2.6 });
      pins.show(casp.history.map((_, g) => `cs-g${g}`), true, 0.6, 0.04);
      pins.show(['cs-y0', 'cs-y50', 'cs-y100', 'cs-axis', 'cs-yt', 'cs-leg'], true, 0.8, 0.05);
      pins.show('cs-14', true, 2.8);
    },
    () => {
      csTl?.kill();
      grow(chart, false);
      growBars(false);
      gsap.to(halo.material, { opacity: 0, duration: 0.3 });
      pins.hide('cs-g');
      pins.hide('cs-y');
      pins.show(['cs-axis', 'cs-yt', 'cs-leg', 'cs-14'], false);
      grow(chartB, true, 0.3);
      growBarsB(true, 0.6);
      pins.show(['cs-b50', 'cs-b75', 'cs-b100', 'cs-bl', 'cs-br', 'cs-legb'], true, 0.8, 0.08);
    },
  ];
  csHide.push(() => {
    csTl?.kill();
    [crateRow, chart, chartB].forEach((o) => grow(o, false));
    growBars(false);
    growBarsB(false);
    pins.hide('cs-');
  });
  const sCs: Scene = {
    id: 'casp14',
    label: 'CASP14',
    head,
    steps: 4,
    enter(step) {
      cs.enter();
      open(elCs);
      headIn(elCs);
      chrome.caption(
        step >= 2 ? { name: 'GDT_TS در دوره‌های CASP', detail: 'مقادیر از روی نمودار مقاله خوانده شده‌اند (تقریبی)' } : { name: 'آزمون کور، به‌صورت طرح‌واره', detail: 'مولکول‌ها نمایشی‌اند' },
        2,
      );
      stepVis(elCs, step, 0.6);
      csSteps[step]();
    },
    step(step) {
      stepVis(elCs, step);
      csSteps[step]();
      if (step === 2) chrome.caption({ name: 'GDT_TS در دوره‌های CASP', detail: 'مقادیر از روی نمودار مقاله خوانده شده‌اند (تقریبی)' }, 0.4);
      if (step === 1) chrome.caption({ name: 'آزمون کور، به‌صورت طرح‌واره', detail: 'مولکول‌ها نمایشی‌اند' }, 0.4);
    },
    leave() {
      close(elCs);
      stepReset(elCs);
      csTl?.kill();
    },
  };

  // =========================================================================================
  // CASP14 results — two examples from the paper, 92 domains, and the RMSD to scale.
  // =========================================================================================
  const rsHide: (() => void)[] = [];
  const rs = stageAt(ctx, ANCHOR.results, 'results', () => rsHide.forEach((f) => f()));
  const loader = new THREE.TextureLoader();
  const card = (url: string, x: number, ry: number) => {
    const g = hidden(new THREE.Group(), 1);
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const w = 40;
    const hgt = w * (515 / 370);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, hgt + 2.4, 1), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, clearcoat: 0.4 }));
    back.position.z = -0.6;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    g.add(back, face);
    g.position.copy(at(x, 52, 0));
    g.rotation.y = ry;
    return g;
  };
  const card1 = card(imgT1037, 24, 0.22);
  const card2 = card(imgT1049, 64, -0.22);
  // 92 domains, coloured by their GDT_TS band.
  const DOM = 92;
  const doms = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6 }), DOM);
  doms.frustumCulled = false;
  const domG = hidden(new THREE.Group(), 1);
  domG.position.copy(at(34, 50, 0));
  domG.rotation.set(0.2, -0.22, 0);
  const dc = new THREE.Color();
  for (let i = 0; i < DOM; i++) {
    const x = i % 12;
    const y = Math.floor(i / 12);
    doms.setMatrixAt(i, new THREE.Matrix4().makeTranslation((x - 5.5) * 4.4, (3.5 - y) * 4.4, 0));
    doms.setColorAt(i, dc.copy(i < 58 ? C.blue : i < 87 ? C.sky : new THREE.Color('#b7c2cf')));
  }
  domG.add(doms);
  // RMSD to scale: 1 Å = 14 units, next to a carbon–carbon bond.
  const A = 14;
  const rulers = hidden(new THREE.Group(), 1);
  rulers.position.copy(at(42, 56, 0));
  const rulerBar = (len: number, y: number, color: THREE.ColorRepresentation) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 2), new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8 }));
    m.position.set(-20 + len / 2, y, 0);
    return m;
  };
  rulers.add(rulerBar(0.96 * A, 20, C.blue), rulerBar(2.8 * A, 0, '#8fa3b8'));
  const cAtom = (x: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#7d8a99', roughness: 0.4, clearcoat: 0.6 }));
    m.position.set(x, -20, 0);
    return m;
  };
  const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.54 * A, 16), new THREE.MeshStandardMaterial({ color: '#56657a' }));
  bond.rotation.z = Math.PI / 2;
  bond.position.set(-20 + (1.54 * A) / 2, -20, 0);
  rulers.add(bond, cAtom(-20), cAtom(-20 + 1.54 * A));
  const tick = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-20, 26, 0), new THREE.Vector3(-20, -26, 0)]),
    new THREE.LineBasicMaterial({ color: '#34465e' }),
  );
  rulers.add(tick);
  rs.root.add(card1, card2, domG, rulers);
  world.onFrame((_, t) => {
    if (card1.visible) card1.rotation.y = 0.22 + Math.sin(t * 0.5) * 0.05;
    if (card2.visible) card2.rotation.y = -0.22 - Math.sin(t * 0.5) * 0.05;
  });
  pins
    .add('rs-c1', { anchor: () => card1.localToWorld(new THREE.Vector3(0, 31, 1)), html: '<b class="ltr">90.7</b><small>GDT</small>', cls: 'pin-gdt', align: 'above' })
    .add('rs-c2', { anchor: () => card2.localToWorld(new THREE.Vector3(0, 31, 1)), html: '<b class="ltr">93.3</b><small>GDT</small>', cls: 'pin-gdt', align: 'above' })
    .add('rs-leg', { anchor: () => rs.wp(at(44, 92, 0)), html: '<span><i style="background:#3ec84a"></i>ساختار تجربی</span><span><i style="background:#1f2fd0"></i>پیش‌بینی AlphaFold2</span>', cls: 'pin-legend', align: 'center' })
    .add('rs-d90', { anchor: () => domG.localToWorld(new THREE.Vector3(26.5, 11, 0)), html: `<b>${fa(58)}</b> دامنه: GDT_TS بیشتر از ${fa(90)}`, cls: 'pin-key k-blue', align: 'left', dx: 2 })
    .add('rs-d70', { anchor: () => domG.localToWorld(new THREE.Vector3(26.5, -4.4, 0)), html: `<b>${fa(29)}</b> دامنه: بین ${fa(70)} و ${fa(90)}`, cls: 'pin-key k-sky', align: 'left', dx: 2 })
    .add('rs-dlo', { anchor: () => domG.localToWorld(new THREE.Vector3(26.5, -17, 0)), html: `<b>${fa(5)}</b> دامنه: کمتر از ${fa(70)}`, cls: 'pin-key k-grey', align: 'left', dx: 2 })
    .add('rs-dsum', { anchor: () => domG.localToWorld(new THREE.Vector3(0, -20, 0)), html: `${fa(87)} از ${fa(92)} دامنه بالاتر از ${fa(70)}`, cls: 'pin-flag', align: 'below' })
    .add('rs-r1', { anchor: () => rulers.localToWorld(new THREE.Vector3(-20 + 0.96 * A, 20, 0)), html: '<b>AlphaFold2</b><small>حدود ۰٫۹۶ آنگستروم</small>', cls: 'pin-stat ltr-mix', align: 'left', dx: 2 })
    .add('rs-r2', { anchor: () => rulers.localToWorld(new THREE.Vector3(-20 + 2.8 * A, 0, 0)), html: '<b>بهترین روش بعدی</b><small>حدود ۲٫۸ آنگستروم</small>', cls: 'pin-stat', align: 'left', dx: 2 })
    .add('rs-cc', { anchor: () => rulers.localToWorld(new THREE.Vector3(-20 + 1.54 * A, -20, 0)), html: '<b>برای مقایسه: پیوند C–C</b><small>حدود ۱٫۵ آنگستروم</small>', cls: 'pin-stat', align: 'left', dx: 5 })
    .add('rs-scale', { anchor: () => rulers.localToWorld(new THREE.Vector3(-20, 28, 0)), html: 'به مقیاس واقعی (۱ آنگستروم = ۱۴ واحد)', cls: 'pin-word', align: 'above' });
  const elRs = section(
    overlay,
    's-net s-results',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${casp.num}</p>
      <h2 class="n-title n-title-sm">${caspResults.title}</h2>
      <div class="swap">
        <p class="n-body n-strong" data-s="0-0">${casp.result}</p>
        <table class="r-table" data-s="1">
          <thead><tr><th>${caspResults.head[0]}</th><th>${caspResults.head[1]}</th></tr></thead>
          <tbody>${caspResults.rows.map(([a, b], i) => `<tr class="r${i}"><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`,
  );
  const rows = $$('tbody tr', elRs);
  const rsSteps = [
    () => {
      grow(card1, true, 0.4);
      grow(card2, true, 0.6);
      grow(domG, false);
      grow(rulers, false);
      pins.show(['rs-c1', 'rs-c2', 'rs-leg'], true, 1.2, 0.15);
      pins.hide('rs-d');
      pins.hide('rs-r');
      pins.show(['rs-cc', 'rs-scale'], false);
    },
    () => {
      [card1, card2, rulers].forEach((o) => grow(o, false));
      grow(domG, true, 0.4);
      pins.show(['rs-c1', 'rs-c2', 'rs-leg'], false);
      pins.hide('rs-r');
      pins.show(['rs-cc', 'rs-scale'], false);
      pins.show(['rs-d90', 'rs-d70', 'rs-dlo', 'rs-dsum'], true, 1, 0.2);
      rows.forEach((r, i) => r.classList.toggle('is-hot', i < 3));
    },
    () => {
      [card1, card2, domG].forEach((o) => grow(o, false));
      grow(rulers, true, 0.4);
      pins.hide('rs-d');
      pins.show(['rs-r1', 'rs-r2', 'rs-cc', 'rs-scale'], true, 1, 0.2);
      rows.forEach((r, i) => r.classList.toggle('is-hot', i >= 3));
    },
  ];
  rsHide.push(() => {
    [card1, card2, domG, rulers].forEach((o) => grow(o, false));
    pins.hide('rs-');
  });
  const sRs: Scene = {
    id: 'casp14-results',
    label: caspResults.title,
    head,
    steps: 3,
    enter(step) {
      rs.enter();
      open(elRs);
      headIn(elRs);
      chrome.caption(step === 0 ? { name: 'دو نمونه از CASP14', detail: 'تصویر از مقاله‌ی AlphaFold2' } : null, 2);
      stepVis(elRs, step, 0.6);
      rsSteps[step]();
    },
    step(step) {
      stepVis(elRs, step);
      rsSteps[step]();
      chrome.caption(step === 0 ? { name: 'دو نمونه از CASP14', detail: 'تصویر از مقاله‌ی AlphaFold2' } : null, 0.4);
    },
    leave() {
      close(elRs);
      stepReset(elRs);
    },
  };

  // =========================================================================================
  // ۱۰. Accuracy metrics on a real pair: haemoglobin α (reference) and β (model).
  // =========================================================================================
  const mtHide: (() => void)[] = [];
  const mt = stageAt(ctx, ANCHOR.metrics, 'metrics', () => mtHide.forEach((f) => f()));
  const hb = MOL.haemoglobin;
  const caA = Array.from({ length: hb.chains[0].seq.length }, (_, i) => new THREE.Vector3().fromArray(hb.chains[0].ca, i * 3));
  const Mb = new THREE.Matrix4().fromArray(GLOBINS.alphaBeta.matrixRefit).transpose();
  const caB = Array.from({ length: hb.chains[1].seq.length }, (_, i) => new THREE.Vector3().fromArray(hb.chains[1].ca, i * 3).applyMatrix4(Mb));
  const ctr = caA.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / caA.length);
  caA.forEach((v) => v.sub(ctr));
  caB.forEach((v) => v.sub(ctr));
  const PAIRS = GLOBINS.alphaBeta.pairs;
  const R = compare(caA, caB, PAIRS, caA.length);
  const mtG = hidden(new THREE.Group(), 1.6);
  mtG.position.copy(at(36, 56, 0));
  mtG.rotation.set(0.2, -0.4, 0);
  const trA = new Trace(caA.length, 0.42, new THREE.MeshStandardMaterial({ color: '#2fb36b', roughness: 0.5 }));
  trA.set(caA);
  const bG = new THREE.Group();
  const trB = new Trace(caB.length, 0.42, new THREE.MeshStandardMaterial({ color: '#2f6fe4', roughness: 0.5 }));
  trB.set(caB);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshStandardMaterial({ roughness: 0.4 }), PAIRS.length);
  beads.frustumCulled = false;
  const BIN = [C.blue, C.sky, C.sun, C.ember, new THREE.Color('#c4122f')];
  PAIRS.forEach(([, b], i) => {
    beads.setMatrixAt(i, new THREE.Matrix4().makeTranslation(caB[b].x, caB[b].y, caB[b].z));
    const d = R.d[i];
    beads.setColorAt(i, BIN[d <= 1 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d <= 8 ? 3 : 4]);
  });
  beads.visible = false;
  bG.add(trB.mesh, beads);
  const devGeo = new THREE.BufferGeometry().setFromPoints(PAIRS.flatMap(([a, b]) => [caA[a], caB[b]]));
  const devLines = new THREE.LineSegments(devGeo, new THREE.LineBasicMaterial({ color: C.alarm, transparent: true, opacity: 0 }));
  bG.add(devLines);
  // Distance shells around one residue (GDT cut-offs) and the lDDT inclusion sphere.
  const RES = PAIRS[60][0];
  const shells = new THREE.Group();
  [1, 2, 4, 8].forEach((r, k) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshBasicMaterial({ color: spectrum(k / 3), transparent: true, opacity: 0.18, depthWrite: false }));
    shells.add(m);
  });
  shells.position.copy(caA[RES]);
  shells.scale.setScalar(0.001);
  const incl = new THREE.Mesh(new THREE.SphereGeometry(15, 40, 28), new THREE.MeshBasicMaterial({ color: '#65cbf3', transparent: true, opacity: 0, depthWrite: false, wireframe: true }));
  incl.position.copy(caA[RES]);
  const nbA: THREE.Vector3[] = [];
  const nbB: THREE.Vector3[] = [];
  const pairB = new Map(PAIRS.map(([a, b]) => [a, b]));
  caA.forEach((v, j) => {
    if (j !== RES && v.distanceTo(caA[RES]) < 15 && pairB.has(j)) {
      nbA.push(caA[RES], v);
      nbB.push(caB[pairB.get(RES)!], caB[pairB.get(j)!]);
    }
  });
  const nbLinesA = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(nbA), new THREE.LineBasicMaterial({ color: '#1d6b45', transparent: true, opacity: 0 }));
  const nbLinesB = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(nbB), new THREE.LineBasicMaterial({ color: '#1f43a6', transparent: true, opacity: 0 }));
  bG.add(nbLinesB);
  mtG.add(trA.mesh, bG, shells, incl, nbLinesA);
  mt.root.add(mtG);
  const sep = { t: 0 };
  world.onFrame(() => {
    if (!mtG.visible) return;
    bG.position.set(sep.t * 46, sep.t * -6, sep.t * -10);
    bG.rotation.set(sep.t * 0.6, sep.t * 1.4, sep.t * -0.4);
  });
  const gdtBars = R.gdtCut.map((v, i) => `<div class="g-bar"><i style="height:${(v * 100).toFixed(0)}%"></i><b>${fa(Math.round(v * 100))}٪</b><span>≤ ${fa([1, 2, 4, 8][i])} Å</span></div>`).join('');
  pins
    .add('mt-gdt', { anchor: () => mt.wp(at(88, 62, 0)), html: `<div class="g-bars">${gdtBars}</div><p>GDT_TS ≈ <b>${pf(R.gdt)}</b></p>`, cls: 'pin-card pin-gdtcard', align: 'center' })
    .add('mt-shell', { anchor: () => mtG.localToWorld(caA[RES].clone().add(new THREE.Vector3(0, 15, 0))), html: 'آستانه‌های ۱، ۲، ۴ و ۸ آنگستروم', cls: 'pin-word', align: 'above', dy: -0.6 })
    .add('mt-rmsd', { anchor: () => mt.wp(at(84, 86, 0)), html: `<b>RMSD ≈ ${pf(R.rmsd, 2)} Å</b><small>روی ${fa(PAIRS.length)} جفت Cα هم‌تراز</small>`, cls: 'pin-stat pin-big-stat ltr-mix', align: 'center' })
    .add('mt-lddt', { anchor: () => mt.wp(at(84, 86, 0)), html: `<b>lDDT ≈ ${pf(R.lddt)}</b><small>با جابه‌جایی کل مدل تغییر نمی‌کند</small>`, cls: 'pin-stat pin-big-stat ltr-mix', align: 'center' })
    .add('mt-sphere', { anchor: () => mtG.localToWorld(caA[RES].clone().add(new THREE.Vector3(0, 15, 0))), html: 'همسایه‌های تا ۱۵ آنگستروم', cls: 'pin-word', align: 'above' })
    .add('mt-a', { anchor: () => mtG.localToWorld(caA[5].clone()), html: 'مرجع', cls: 'pin-word c-green', align: 'right', dx: -3 })
    .add('mt-b', { anchor: () => bG.localToWorld(caB[110].clone()), html: 'مدل', cls: 'pin-word c-blue', align: 'left', dx: 3 });
  const item = (k: number) => {
    const it = metrics.items[k];
    return /* html */ `
      <div data-s="${k}-${k}">
        <h3 class="n-sub"><b>${it.num}</b> <span class="ltr">${it.name}</span></h3>
        <p class="n-body n-strong">${it.body}</p>
        <ul class="n-bul">${it.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
      </div>`;
  };
  const elMt = section(overlay, 's-net s-metrics', panel(metrics.num, metrics.title, item(0) + item(1) + item(2)));
  let mtTl: gsap.core.Timeline | undefined;
  const mtSteps = [
    () => {
      mtTl?.kill();
      gsap.to(sep, { t: 0, duration: 0.8 });
      grow(mtG, true, 0.4);
      beads.visible = true;
      gsap.to(shells.scale, { x: 1, y: 1, z: 1, duration: 1, delay: 1, ease: 'back.out(1.6)' });
      gsap.to([devLines.material, nbLinesA.material, nbLinesB.material, incl.material], { opacity: 0, duration: 0.3 });
      pins.show(['mt-gdt', 'mt-shell', 'mt-a', 'mt-b'], true, 1.2, 0.15);
      pins.show(['mt-rmsd', 'mt-lddt', 'mt-sphere'], false);
    },
    () => {
      mtTl?.kill();
      gsap.to(sep, { t: 0, duration: 0.8 });
      beads.visible = false;
      gsap.to(shells.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
      gsap.to(devLines.material, { opacity: 0.9, duration: 0.8, delay: 0.4 });
      gsap.to([nbLinesA.material, nbLinesB.material, incl.material], { opacity: 0, duration: 0.3 });
      pins.show(['mt-gdt', 'mt-shell', 'mt-lddt', 'mt-sphere'], false);
      pins.show(['mt-rmsd', 'mt-a', 'mt-b'], true, 0.8, 0.1);
    },
    () => {
      beads.visible = false;
      gsap.to(shells.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 });
      gsap.to(devLines.material, { opacity: 0, duration: 0.3 });
      gsap.to(incl.material, { opacity: 0.25, duration: 0.8, delay: 0.3 });
      gsap.to([nbLinesA.material, nbLinesB.material], { opacity: 0.9, duration: 0.8, delay: 0.6 });
      pins.show(['mt-gdt', 'mt-shell', 'mt-rmsd'], false);
      pins.show(['mt-lddt', 'mt-sphere', 'mt-a', 'mt-b'], true, 0.8, 0.1);
      mtTl?.kill();
      mtTl = gsap.timeline({ delay: 2, repeat: -1, repeatDelay: 1 });
      mtTl.to(sep, { t: 1, duration: 2.4, ease: 'power2.inOut' }).to(sep, { t: 0, duration: 2.4, ease: 'power2.inOut' }, '+=1.6');
    },
  ];
  mtHide.push(() => {
    mtTl?.kill();
    grow(mtG, false);
    pins.hide('mt-');
  });
  const sMt: Scene = {
    id: 'metrics',
    label: metrics.title,
    head,
    steps: 3,
    enter(step) {
      mt.enter();
      open(elMt);
      headIn(elMt);
      chrome.caption({ name: 'زنجیره‌ی α (مرجع) و β (مدل) هموگلوبین', detail: 'PDB 4HHB؛ مقادیر روی Cα و یک هم‌ترازی محاسبه شده‌اند' }, 2);
      stepVis(elMt, step, 0.6);
      mtSteps[step]();
    },
    step(step) {
      stepVis(elMt, step);
      mtSteps[step]();
    },
    leave() {
      close(elMt);
      stepReset(elMt);
      mtTl?.kill();
    },
  };

  // =========================================================================================
  // ۱۱. Confidence — pLDDT painted on a real AlphaFold model; PAE between two domains.
  // =========================================================================================
  const cfHide: (() => void)[] = [];
  const cf = stageAt(ctx, ANCHOR.confidence, 'confidence', () => cfHide.forEach((f) => f()));
  const p53 = AF.p53;
  const nP = p53.chains[0].seq.length;
  const p53Rib = new Cartoon(p53, { color: (_c, t, out) => plddtColor(p53.plddt[Math.round(t * (nP - 1))], out) });
  const p53R = Math.max(...Array.from({ length: nP }, (_, i) => Math.hypot(p53.chains[0].ca[i * 3], p53.chains[0].ca[i * 3 + 1], p53.chains[0].ca[i * 3 + 2])));
  const p53G = hidden(new THREE.Group(), 44 / p53R);
  p53G.position.copy(at(38, 56, 0));
  p53G.add(p53Rib.mesh);
  // The two lobes of calmodulin as separate rigid bodies.
  const cam = AF.calmodulin;
  const nC = cam.chains[0].seq.length;
  const HINGE = 78;
  const lobeN = new Cartoon(slice(cam, 0, HINGE), { color: (_c, t, out) => plddtColor(cam.plddt[Math.round(t * (HINGE - 1))], out) });
  const lobeC = new Cartoon(slice(cam, HINGE, nC), { color: (_c, t, out) => plddtColor(cam.plddt[HINGE + Math.round(t * (nC - HINGE - 1))], out) });
  const camG = hidden(new THREE.Group(), 1.2);
  camG.position.copy(at(28, 56, 0));
  const pivot = new THREE.Vector3().fromArray(cam.chains[0].ca, (HINGE - 1) * 3);
  const cPivot = new THREE.Group();
  cPivot.position.copy(pivot);
  lobeC.mesh.position.copy(pivot).multiplyScalar(-1);
  cPivot.add(lobeC.mesh);
  camG.add(lobeN.mesh, cPivot);
  // A schematic PAE map (the real matrix was not available): low error inside each lobe,
  // high error between them.
  const PAE_N = 149;
  const paeCanvas = document.createElement('canvas');
  paeCanvas.width = paeCanvas.height = PAE_N;
  {
    const g = paeCanvas.getContext('2d')!;
    const img = g.createImageData(PAE_N, PAE_N);
    const lo = new THREE.Color('#0d5b2a');
    const hi = new THREE.Color('#ffffff');
    const r = rng(31);
    const c = new THREE.Color();
    for (let i = 0; i < PAE_N; i++)
      for (let j = 0; j < PAE_N; j++) {
        const li = i < HINGE - 4 ? 0 : i > HINGE + 3 ? 2 : 1;
        const lj = j < HINGE - 4 ? 0 : j > HINGE + 3 ? 2 : 1;
        let v = li === lj && li !== 1 ? 3 + Math.abs(i - j) * 0.04 : li === 1 || lj === 1 ? 14 : 24;
        v += (r() - 0.5) * 3;
        if (i === j) v = 0;
        c.copy(lo).lerp(hi, Math.min(1, Math.max(0, v / 30)));
        const k = (i * PAE_N + j) * 4;
        img.data[k] = c.r * 255;
        img.data[k + 1] = c.g * 255;
        img.data[k + 2] = c.b * 255;
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }
  const paeTex = new THREE.CanvasTexture(paeCanvas);
  paeTex.colorSpace = THREE.SRGBColorSpace;
  paeTex.magFilter = THREE.NearestFilter;
  const heat = hidden(new THREE.Group(), 1);
  heat.position.copy(at(76, 58, 0));
  const PS = 40;
  const heatFrame = new THREE.Mesh(new THREE.BoxGeometry(PS + 2, PS + 2, 1), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  heatFrame.position.z = -0.6;
  const heatPlane = new THREE.Mesh(new THREE.PlaneGeometry(PS, PS), new THREE.MeshBasicMaterial({ map: paeTex, toneMapped: false }));
  const offBlock = (x0: number, x1: number, y0: number, y1: number) => {
    const s = PS / PAE_N;
    const pts = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ].map(([x, y]) => new THREE.Vector3(-PS / 2 + x * s, PS / 2 - y * s, 0.2));
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.alarm, transparent: true, opacity: 0 }));
  };
  const blockA = offBlock(HINGE + 4, PAE_N, 0, HINGE - 4);
  const blockB = offBlock(0, HINGE - 4, HINGE + 4, PAE_N);
  heat.add(heatFrame, heatPlane, blockA, blockB);
  cf.root.add(p53G, camG, heat);
  const wob = { a: 0 };
  world.onFrame((dt) => {
    if (p53G.visible) p53G.rotation.y += dt * 0.15;
    if (camG.visible) {
      camG.rotation.y += dt * 0.08;
      cPivot.rotation.set(Math.sin(wob.a) * 0.5, Math.cos(wob.a * 0.7) * 0.45, Math.sin(wob.a * 1.3) * 0.3);
    }
  });
  const hiP = p53.plddt.indexOf(Math.max(...p53.plddt.slice(100, 290)));
  let loP = 0;
  for (let i = 0, best = -1; i < nP; i++) {
    const r = Math.hypot(p53.chains[0].ca[i * 3], p53.chains[0].ca[i * 3 + 1], p53.chains[0].ca[i * 3 + 2]);
    if (p53.plddt[i] < 50 && r > best) {
      best = r;
      loP = i;
    }
  }
  pins
    .add('cf-scale', {
      anchor: () => cf.wp(at(40, 14, 0)),
      html: '<div class="pl-scale"><span style="--c:#ff7d45">کمتر از ۵۰</span><span style="--c:#ffdb13">۵۰ تا ۷۰</span><span style="--c:#65cbf3">۷۰ تا ۹۰</span><span style="--c:#0053d6">بیشتر از ۹۰</span></div>',
      cls: 'pin-plain',
      align: 'center',
    })
    .add('cf-hi', { anchor: () => p53Rib.mesh.localToWorld(new THREE.Vector3().fromArray(p53.chains[0].ca, hiP * 3)), html: 'هسته‌ی تاخورده<small>اطمینان بالا</small>', cls: 'pin-stat k-blue', align: 'right', dx: -6 })
    .add('cf-lo', { anchor: () => p53Rib.mesh.localToWorld(new THREE.Vector3().fromArray(p53.chains[0].ca, loP * 3)), html: 'انتهای منعطف<small>اطمینان پایین</small>', cls: 'pin-stat k-ember', align: 'left', dx: 3 })
    .add('cf-axis', { anchor: () => heat.localToWorld(new THREE.Vector3(0, -PS / 2 - 1, 0)), html: 'باقی‌مانده‌ی هم‌ترازشده', cls: 'pin-word', align: 'below' })
    .add('cf-axis2', { anchor: () => heat.localToWorld(new THREE.Vector3(PS / 2 + 1, 0, 0)), html: 'باقی‌مانده‌ی ارزیابی‌شده', cls: 'pin-word pin-vert', align: 'left' })
    .add('cf-heat', { anchor: () => heat.localToWorld(new THREE.Vector3(0, PS / 2 + 1, 0)), html: 'نقشه‌ی PAE (نمایشی)<small>سبز تیره: خطای کم — سفید: خطای زیاد</small>', cls: 'pin-stat', align: 'above' })
    .add('cf-lobes', { anchor: () => heat.localToWorld(new THREE.Vector3(0, -PS / 2 - 1, 0)), html: 'جای نسبی دو دامنه: نامطمئن', cls: 'pin-flag pin-alarm', align: 'below', dy: 5 });
  const lobeMid = (from: number, to: number) => {
    const v = new THREE.Vector3();
    for (let i = from; i < to; i++) v.add(new THREE.Vector3().fromArray(cam.chains[0].ca, i * 3));
    return v.multiplyScalar(1 / (to - from));
  };
  const midN = lobeMid(0, HINGE);
  const midC = lobeMid(HINGE, nC);
  notes
    .add('cf-n', { anchor: () => lobeN.mesh.localToWorld(midN.clone()), html: '<b>دامنه‌ی ۱</b>', at: [12, 28], tone: 'blue' })
    .add('cf-c', { anchor: () => lobeC.mesh.localToWorld(midC.clone()), html: '<b>دامنه‌ی ۲</b>', at: [40, 76], tone: 'blue' });
  const domains = (on: boolean, delay = 0) => ['cf-n', 'cf-c'].forEach((id, k) => notes.show(id, on, delay + k * 0.15));
  const cfItem = (it: typeof confidence.plddt, s: string, from: number) => /* html */ `
      <div data-s="${s}">
        <h3 class="n-sub"><b>${it.num}</b> <span class="ltr">${it.name}</span></h3>
        <p class="n-body n-strong">${it.body.replace(/(predicted Local Distance Difference Test|Predicted Aligned Error)/, '<span class="ltr">$1</span>')}</p>
        <ul class="n-bul">${it.bullets.map((b, i) => `<li data-s="${from + i}-${s.split('-')[1]}">${b}</li>`).join('')}</ul>
      </div>`;
  const elCf = section(overlay, 's-net s-conf', panel(confidence.num, confidence.title, cfItem(confidence.plddt, '0-1', 0) + cfItem(confidence.pae, '2-3', 2)));
  let cfTl: gsap.core.Tween | undefined;
  const capFor = (s: number) =>
    s < 2
      ? { name: 'پروتئین p53 انسان، مدل AlphaFold', detail: 'AF-P04637-F1 (نسخه‌ی ۴)؛ رنگ: pLDDT هر باقی‌مانده' }
      : { name: 'کالمودولین انسان، مدل AlphaFold', detail: 'AF-P0DP23-F1 (نسخه‌ی ۴)؛ نقشه‌ی PAE نمایشی است' };
  const cfSteps = [
    () => {
      cfTl?.kill();
      grow(p53G, true, 0.4);
      grow(camG, false);
      grow(heat, false);
      pins.show('cf-scale', true, 1.2);
      pins.show(['cf-hi', 'cf-lo', 'cf-axis', 'cf-axis2', 'cf-heat', 'cf-lobes'], false);
      domains(false);
    },
    () => {
      cfTl?.kill();
      grow(p53G, true);
      pins.show(['cf-scale'], true);
      pins.show(['cf-hi', 'cf-lo'], true, 0.4, 0.3);
    },
    () => {
      cfTl?.kill();
      wob.a = 0;
      grow(p53G, false);
      grow(camG, true, 0.4);
      grow(heat, true, 0.6);
      gsap.to([blockA.material, blockB.material], { opacity: 0, duration: 0.3 });
      pins.show(['cf-hi', 'cf-lo', 'cf-lobes'], false);
      pins.show(['cf-scale', 'cf-axis', 'cf-axis2', 'cf-heat'], true, 1, 0.1);
      domains(true, 1.4);
    },
    () => {
      gsap.to([blockA.material, blockB.material], { opacity: 1, duration: 0.6, delay: 0.3 });
      pins.show('cf-lobes', true, 0.8);
      cfTl?.kill();
      cfTl = gsap.to(wob, { a: Math.PI * 8, duration: 16, ease: 'none', repeat: -1 });
    },
  ];
  cfHide.push(() => {
    cfTl?.kill();
    [p53G, camG, heat].forEach((o) => grow(o, false));
    pins.hide('cf-');
    domains(false);
  });
  const sCf: Scene = {
    id: 'confidence',
    label: confidence.title,
    head,
    steps: 4,
    enter(step) {
      cf.enter();
      open(elCf);
      headIn(elCf);
      stepVis(elCf, step, 0.6);
      chrome.caption(capFor(step), 2);
      cfSteps[0]();
      for (let s = 1; s <= step; s++) cfSteps[s]();
    },
    step(st) {
      stepVis(elCf, st);
      if (st < 2) cfSteps[0]();
      for (let s = st < 2 ? 1 : 2; s <= st; s++) cfSteps[s]();
      chrome.caption(capFor(st), 0.4);
    },
    leave() {
      close(elCf);
      stepReset(elCf);
      cfTl?.kill();
    },
  };

  // =========================================================================================
  // Closing: thanks, written by the same particles that opened the talk.
  // =========================================================================================
  const CL = ANCHOR.closing;
  const dust = new Dust(3000);
  for (let i = 0; i < dust.count; i++) dust.cur[i * 3] += CL.x;
  world.scene.add(dust.mesh);
  world.onFrame((_, t) => dust.update(t));
  let thanks: Float32Array | null = null;
  const thanksPose = () => {
    if (thanks) return thanks;
    thanks = textPoints(closing.thanks, '700 300px "Aref Ruqaa"', dust.count, 120, CL.clone().add(new THREE.Vector3(0, 10, 0)));
    const c = new THREE.Color();
    for (let i = 0; i < dust.count; i++) dust.mesh.setColorAt(i, spectrum(1 - ((thanks[i * 3] - CL.x) / 120 + 0.5), c));
    dust.mesh.instanceColor!.needsUpdate = true;
    return thanks;
  };
  ctx.register('closing', () => {
    if (dust.visible) dust.scatter({ around: CL });
  });
  const elEnd = section(
    overlay,
    's-cover s-closing',
    /* html */ `
    <div class="cv-credits">
      <p class="cv-name ltr rv">${cover.name}</p>
      <p class="cv-by rv">${cover.by}</p>
      <p class="cv-row rv"><span>${cover.teacher}</span><i></i><span>${cover.course}</span></p>
    </div>`,
  );
  const sEnd: Scene = {
    id: 'closing',
    label: closing.thanks,
    enter() {
      ctx.area('closing');
      open(elEnd);
      chrome.caption(null);
      world.fogTo(150, 420);
      world.fly(shot(CL, { pz: 165 }), 3);
      const pose = thanksPose();
      const order = new Float32Array(dust.count);
      for (let i = 0; i < dust.count; i++) order[i] = 1 - ((pose[i * 3] - CL.x) / 120 + 0.5) + Math.random() * 0.2;
      dust.flyTo(pose, 1, { duration: 2.6, spread: 1.4, ease: 'expo.out', delay: 0.8, order });
      $$('.rv', elEnd).forEach((el, i) => reveal(el, true, 3 + i * 0.25));
    },
    leave() {
      close(elEnd);
      reveal($$('.rv', elEnd), false);
    },
  };

  return [sCh, sCs, sRs, sMt, sCf, sEnd];
}
