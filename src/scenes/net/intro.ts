import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { chapter2, network, inputs } from '../../content';
import { GLOBINS } from '../../data/globins';
import type { ModId } from '../../three/board';
import { Dust, textPoints } from '../../three/chain';
import { Links } from '../../three/links';
import { flowMaterial } from '../../three/props';
import { Tiles } from '../../three/tiles';
import { ANCHOR, C, shot, spectrum } from '../../three/world';
import { rich, tex } from '../../ui/math';
import { $, $$, words, reveal, open, close, section, stepVis, stepReset } from '../../ui/text';
import { pop, type Ctx } from '../ctx';
import { at, alphaRibbon, BeadRow, NET_SHOT, ORBIT, type Net } from './common';

const PROCESSING: ModId[] = ['row', 'col', 'transM', 'opm', 'triOut', 'triIn', 'triStart', 'triEnd', 'transP'];
const MSA_HUES = ['#fbd5c5', '#f7ab90', '#f48a6c', '#fde6dc', '#f26a4e', '#f9c2ad'];
const PAIR_HUES = ['#cfe4f4', '#9ccbec', '#7db6e0', '#e4f0fa', '#5fa2d6', '#b5d8f1'];

/** A feature tensor drawn as a block of small cubes: rows × cols × depth. */
function tensor(rows: number, cols: number, depth: number, hues: string[]) {
  const t = new Tiles(rows * cols * depth, { size: 0.84, depth: 0.84, radius: 0.12 });
  let n = 0;
  for (let k = 0; k < depth; k++)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const tile = t.t[n];
        tile.x = c - (cols - 1) / 2;
        tile.y = (rows - 1) / 2 - r;
        tile.z = -k;
        tile.g = 0;
        t.color(n++, hues[Math.floor(Math.random() * hues.length)]);
      }
  return t;
}

const idx = (rows: number, cols: number) => (r: number, c: number, k: number) => k * rows * cols + r * cols + c;

export function netIntroScenes(ctx: Ctx, net: Net): Scene[] {
  const { world, chrome, overlay, pins, lens } = ctx;
  const { board, root } = net;
  const head = { num: chapter2.num, title: chapter2.title };

  // =========================================================================================
  // Chapter opener: the numeral «۲» gathers out of loose beads.
  // =========================================================================================
  const C2 = ANCHOR.chapter2;
  const dust = new Dust(1800);
  for (let i = 0; i < dust.count; i++) dust.cur[i * 3] += C2.x;
  world.scene.add(dust.mesh);
  world.onFrame((_, t) => dust.update(t));
  let numeral: Float32Array | null = null;
  const numeralPose = () => {
    if (numeral) return numeral;
    numeral = textPoints('۲', '900 700px "Vazirmatn Variable"', dust.count, 34, C2.clone().add(new THREE.Vector3(13, 0, 0)));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < dust.count; i++) {
      lo = Math.min(lo, numeral[i * 3 + 1]);
      hi = Math.max(hi, numeral[i * 3 + 1]);
    }
    const c = new THREE.Color();
    for (let i = 0; i < dust.count; i++) dust.mesh.setColorAt(i, spectrum((hi - numeral[i * 3 + 1]) / (hi - lo), c));
    dust.mesh.instanceColor!.needsUpdate = true;
    return numeral;
  };
  ctx.register('chapter2', () => {
    if (dust.visible) dust.scatter({ around: C2 });
  });

  const elCh = section(
    overlay,
    's-chapter s-ch2',
    /* html */ `
    <div class="ch-block">
      <h2 class="ch-title split">${chapter2.title}</h2>
      <ol class="toc">
        ${network.stages.map((s) => `<li class="rv"><b>${s.n}</b><span>${s.name}</span></li>`).join('')}
      </ol>
    </div>`,
  );

  const sChapter: Scene = {
    id: 'chapter-2',
    label: `${chapter2.num} ${chapter2.title}`,
    chapter: true,
    enter() {
      ctx.area('chapter2');
      open(elCh);
      chrome.caption(null);
      world.fogTo(150, 520);
      world.fly(shot(C2, { pz: 165, ox: 0.2, oy: 0.04 }), 3);
      dust.flyTo(numeralPose(), 1.9, { duration: 2.4, spread: 1.4, delay: 0.5 });
      words($('.ch-title', elCh), 0.9, 0.1);
      $$('.toc li', elCh).forEach((li, i) => reveal(li, true, 1.5 + i * 0.15));
    },
    leave() {
      close(elCh);
      reveal($$('.rv', elCh), false);
    },
  };

  // =========================================================================================
  // Shared props for the overview and the architecture: the three inputs and the output.
  // =========================================================================================
  const seq = new BeadRow(8, 7, 2.1);
  seq.pos.forEach((p, i) => (p.x = (i - 3.5) * 7 + (i === 7 ? 6 : 0) - 3));
  const seqHolder = new THREE.Group();
  seqHolder.add(seq.group);

  const msaRows = GLOBINS.rows.slice(0, 5).map((r) => r.aligned.slice(96, 105));
  const mini = new Tiles(45);
  msaRows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const i = r * 9 + c;
      const t = mini.t[i];
      t.x = c - 4;
      t.y = 2 - r;
      mini.char(i, ch === '-' ? '-' : ch).color(i, ch === '-' ? '#eef2f6' : '#fde3d6');
    }),
  );
  mini.group.scale.setScalar(3.4);

  const template = alphaRibbon({ ghost: true, beta: true });
  const tplHolder = new THREE.Group();
  tplHolder.add(template.mesh);
  tplHolder.scale.setScalar(0.6);

  const output = alphaRibbon();
  const outHolder = new THREE.Group();
  outHolder.add(output.mesh);
  outHolder.scale.setScalar(0.6);
  output.draw = 0;
  template.draw = 0;

  // Structure Module (stage 3) and the recycling loop (stage 4).
  const smCanvas = document.createElement('canvas');
  smCanvas.width = 1024;
  smCanvas.height = 300;
  const sg = smCanvas.getContext('2d')!;
  sg.fillStyle = '#ffffff';
  sg.font = '700 120px "Vazirmatn Variable", sans-serif';
  sg.textAlign = 'center';
  sg.textBaseline = 'middle';
  sg.fillText('Structure Module', 512, 155);
  const smTex = new THREE.CanvasTexture(smCanvas);
  smTex.colorSpace = THREE.SRGBColorSpace;
  smTex.anisotropy = 8;
  const structure = new THREE.Group();
  const smBody = new THREE.Mesh(
    new THREE.BoxGeometry(36, 11, 4),
    new THREE.MeshPhysicalMaterial({ color: '#16294a', roughness: 0.35, clearcoat: 0.8 }),
  );
  const smLabel = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), new THREE.MeshBasicMaterial({ map: smTex, transparent: true, toneMapped: false }));
  smLabel.position.z = 2.05;
  structure.add(smBody, smLabel);

  const recycleFlow = flowMaterial(C.blue, { dashes: 60, speed: 1.2 });
  const recycle = new THREE.Mesh(new THREE.BufferGeometry(), recycleFlow.material);
  recycle.visible = false;
  const recycleHead = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 20), new THREE.MeshBasicMaterial({ color: C.blue }));
  recycleHead.scale.setScalar(0.001);
  recycle.add(recycleHead);
  // Structure Module → 3D structure.
  const smLink = new Links();
  const showSmLink = (on: boolean, delay = 0) =>
    on
      ? smLink.set([{ a: at(42, 30, 8), b: at(64, 30, 8), w: 0.9, bend: new THREE.Vector3(0, 4, 0), color: C.ink, arrow: true, r: 0.32 }]).show(true, { delay })
      : smLink.show(false);

  const props = [seqHolder, mini.group, tplHolder, outHolder, structure];
  root.add(...props, recycle, smLink.group);
  [seqHolder, tplHolder, outHolder, structure].forEach((g) => {
    g.userData.s = g.scale.x;
    g.scale.setScalar(0.001);
    g.visible = false;
  });
  const popIn = (g: THREE.Object3D, on: boolean, delay = 0) => pop(g, on, { delay, scale: g.userData.s ?? 1 });

  net.onFrame((dt, t) => {
    seq.update(t);
    mini.update();
    recycleFlow.uniforms.uTime.value = t;
    tplHolder.rotation.y += dt * 0.25;
    outHolder.rotation.y += dt * 0.25;
  });

  const showMini = (on: boolean, delay = 0) => mini.show(on, { delay, amount: 0.6 });
  const place = (o: THREE.Object3D, p: THREE.Vector3, s: number, duration = 1.2) => {
    o.userData.s = s;
    gsap.to(o.position, { x: p.x, y: p.y, z: p.z, duration, ease: 'power3.inOut' });
    if (o.visible && o.scale.x > 0.01) gsap.to(o.scale, { x: s, y: s, z: s, duration, ease: 'power3.inOut' });
  };

  // Pins: residue names under the chain, input names, θ on every learned box.
  const seqPin = (i: number) => () => seqHolder.localToWorld(seq.pos[i].clone().add(new THREE.Vector3(0, -4.6, 0)));
  for (let i = 0; i < 8; i++) pins.add(`ov-a${i}`, { anchor: seqPin(i), html: tex(i === 7 ? 'a_{n}' : `a_{${i + 1}}`), cls: 'pin-tex', align: 'below' });
  pins.add('ov-dots', { anchor: () => seqHolder.localToWorld(new THREE.Vector3(24.5 - 3, 0, 0)), html: tex('\\cdots'), cls: 'pin-tex' });
  const termPin = (id: string, o: THREE.Object3D, dy: number, html: string, cls: string) =>
    pins.add(id, { anchor: () => o.localToWorld(new THREE.Vector3(0, dy, 0)), html, cls: `pin-term ${cls}`, align: 'below' });
  termPin('ov-t-seq', seqHolder, -6, 'sequence', 'c-seq');
  termPin('ov-t-evo', mini.group, -3.2, 'evolutionary information', 'c-evo');
  termPin('ov-t-tpl', tplHolder, -34, 'templates', 'c-tpl');
  termPin('ov-t-out', outHolder, -34, '3D structure', 'c-out');
  termPin('ar-t-seq', seqHolder, -6, 'توالی هدف', 'c-seq');
  termPin('ar-t-evo', mini.group, -3.2, 'MSA', 'c-evo');
  termPin('ar-t-tpl', tplHolder, -34, 'template', 'c-tpl');
  pins.add('ar-recycle', { anchor: () => root.localToWorld(at(40, 48, 16)), html: '<b class="ltr">Recycling</b>', cls: 'pin-flag' });
  pins.add('ov-f', {
    anchor: () => board.root.localToWorld(new THREE.Vector3(-117, 38.5, 1)),
    html: `${tex('f_{\\theta}')}<span>بلوک اصلی آن: Evoformer</span>`,
    cls: 'pin-fn',
    align: 'right',
    dx: -1,
    dy: -3.4,
  });
  PROCESSING.forEach((id) =>
    pins.add(`ov-th-${id}`, { anchor: () => board.point(id, 'top').add(new THREE.Vector3(0, 2.2, 0)), html: tex('\\theta'), cls: 'pin-theta', align: 'above' }),
  );

  const hideProps = () => {
    seq.show(false);
    showMini(false);
    [seqHolder, tplHolder, outHolder, structure].forEach((g) => pop(g, false));
    gsap.to([output, template], { draw: 0, duration: 0.4, overwrite: true });
    gsap.to(recycleFlow.uniforms.uOn, { value: 0, duration: 0.4, onComplete: () => void (recycle.visible = false) });
    showSmLink(false);
    pins.hide('ov-');
    pins.hide('ar-');
    lens.show(false);
  };
  net.onHide(hideProps);

  // =========================================================================================
  // کارکرد کلی شبکه: S = (a1 … an), then f_θ(…) → 3D structure, then θ.
  // =========================================================================================
  const fClassed =
    'f_{\\theta}(\\htmlClass{c-seq}{\\text{sequence}},\\ \\htmlClass{c-evo}{\\text{evolutionary information}},\\ \\htmlClass{c-tpl}{\\text{templates}}) \\longrightarrow \\htmlClass{c-out}{\\text{3D structure}}';
  const elOv = section(
    overlay,
    's-net s-ov',
    /* html */ `
    <div class="n-panel">
      <h2 class="n-title split">${network.question}</h2>
      <div class="swap">
        <div data-s="0-0"><p class="n-body">${rich(network.chain)}</p><p class="n-body">${rich(network.where)}</p></div>
        <div data-s="1-1"><p class="n-body n-strong">${network.goal}</p></div>
        <div data-s="2-2"><p class="n-body n-strong">${rich(network.theta)}</p><p class="n-body">${network.inputs}</p></div>
      </div>
    </div>
    <div class="n-concept">
      <div class="n-formula n-big" data-s="0-0">${tex(network.seqTex, true)}</div>
      <div class="n-formula" data-s="1-2">${tex(fClassed, true)}</div>
      <div class="n-arrow ltr" data-s="1-2">⟶</div>
    </div>`,
  );

  const ovSteps = [
    () => {
      place(seqHolder, at(56, 33, 6), 1);
      popIn(seqHolder, true, 0.5);
      seq.show(true, 0.7);
      showMini(false);
      popIn(tplHolder, false);
      popIn(outHolder, false);
      gsap.to([output, template], { draw: 0, duration: 0.4, overwrite: true });
      pins.show([...Array(8).keys()].map((i) => `ov-a${i}`).concat('ov-dots'), true, 1.2, 0.06);
      pins.hide('ov-t-');
      pins.hide('ov-th-');
      pins.show('ov-f', false);
      lens.show(false);
      board.focus(null);
    },
    () => {
      pins.hide('ov-a');
      pins.show('ov-dots', false);
      place(seqHolder, at(19, 35, 6), 0.75);
      popIn(seqHolder, true);
      seq.show(true);
      mini.group.position.copy(at(45, 34, 6));
      showMini(true, 0.4);
      place(tplHolder, at(66, 34, 6), 0.6);
      popIn(tplHolder, true, 0.6);
      gsap.to(template, { draw: 1, duration: 1.6, delay: 0.7, overwrite: true });
      place(outHolder, at(91, 34, 6), 0.6);
      popIn(outHolder, true, 1);
      gsap.to(output, { draw: 1, duration: 2, delay: 1.1, overwrite: true });
      pins.show(['ov-t-seq', 'ov-t-evo', 'ov-t-tpl', 'ov-t-out'], true, 1.2, 0.15);
      pins.show('ov-f', true, 1.6);
      pins.hide('ov-th-');
      lens.show(false);
      board.focus(null);
    },
    () => {
      pins.show(PROCESSING.map((id) => `ov-th-${id}`), true, 0.3, 0.08);
      board.trace(PROCESSING, { step: 0.22, delay: 0.2 });
    },
  ];

  const sOverview: Scene = {
    id: 'net-overview',
    label: network.question,
    head,
    steps: 3,
    enter(step) {
      net.enter('dock');
      open(elOv);
      words($('.n-title', elOv), 0.3, 0.06);
      stepVis(elOv, step, 0.6);
      ovSteps[0]();
      for (let s = 1; s <= step; s++) ovSteps[s]();
    },
    step(step) {
      stepVis(elOv, step);
      if (step === 0) ovSteps[0]();
      else if (step === 1) ovSteps[1]();
      else ovSteps[2]();
    },
    leave() {
      close(elOv);
      stepReset(elOv);
      pins.hide('ov-');
    },
  };

  // =========================================================================================
  // تصویر کلی از معماری: the four stages, each lit on the figure.
  // =========================================================================================
  const elArch = section(
    overlay,
    's-net s-arch',
    /* html */ `
    <div class="n-panel">
      <h2 class="n-title n-title-sm split">${network.archTitle}</h2>
      <ol class="n-stages">
        ${network.stages
          .map(
            (s, i) => `
          <li class="n-stage" data-s="${i}" style="--c:${['#f48a6c', '#c2b0ee', '#16294a', '#0053d6'][i]}">
            <b>${s.n}</b>
            <div><h3>مرحله‌ی ${s.n} — ${s.name}</h3><p>${s.body}</p>${s.badge ? `<em>${s.badge}</em>` : ''}</div>
          </li>`,
          )
          .join('')}
      </ol>
    </div>`,
  );
  const stageEls = $$('.n-stage', elArch);

  const archSteps = [
    // 1. Inputs.
    () => {
      world.fly(NET_SHOT, 1.6);
      board.stack(false, 0.8);
      board.focus(['msaIn', 'pairIn', 'm0', 'p0', 'bias']);
      place(seqHolder, at(21, 30, 6), 0.8);
      popIn(seqHolder, true, 0.3);
      seq.show(true, 0.3);
      mini.group.position.copy(at(50, 30, 6));
      showMini(true, 0.5);
      place(tplHolder, at(82, 30, 6), 0.68);
      popIn(tplHolder, true, 0.6);
      gsap.to(template, { draw: 1, duration: 1.4, delay: 0.7, overwrite: true });
      popIn(outHolder, false);
      popIn(structure, false);
      showSmLink(false);
      gsap.to(recycleFlow.uniforms.uOn, { value: 0, duration: 0.4 });
      pins.show(['ar-t-seq', 'ar-t-evo', 'ar-t-tpl'], true, 1, 0.12);
      pins.show('ar-recycle', false);
      lens.set({ from: () => board.corners('msaIn', 'pairIn'), to: [8, 12, 96, 34] });
      lens.show(true, 0.6);
    },
    // 2. Evoformer: 48 blocks, each with its own weights.
    () => {
      lens.show(false);
      seq.show(false);
      showMini(false);
      popIn(seqHolder, false);
      popIn(tplHolder, false);
      popIn(outHolder, false);
      popIn(structure, false);
      showSmLink(false);
      gsap.to(recycleFlow.uniforms.uOn, { value: 0, duration: 0.4 });
      pins.hide('ar-');
      board.focus(null);
      board.flow(true);
      board.stack(true, 2.6);
      world.fly(ORBIT, 2.4);
    },
    // 3. Structure Module.
    () => {
      world.fly(NET_SHOT, 1.8);
      board.stack(false, 1.2);
      board.flow(false);
      board.focus(['msaOut', 'pairOut', 'm6', 'p11']);
      structure.position.copy(at(30, 30, 6));
      popIn(structure, true, 0.8);
      place(outHolder, at(78, 30, 6), 0.68);
      popIn(outHolder, true, 1.1);
      output.draw = 0;
      gsap.to(output, { draw: 1, duration: 2.2, delay: 1.3, overwrite: true });
      showSmLink(true, 1.1);
      gsap.to(recycleFlow.uniforms.uOn, { value: 0, duration: 0.4 });
      pins.show('ar-recycle', false);
      lens.set({ from: () => board.corners('msaOut', 'pairOut'), to: [8, 12, 96, 36] });
      lens.show(true, 1);
    },
    // 4. Recycling: the prediction goes round again.
    () => {
      world.fly(NET_SHOT, 1.6);
      board.stack(false, 0.8);
      lens.show(false);
      board.focus(['msaIn', 'pairIn', 'msaOut', 'pairOut']);
      structure.position.copy(at(30, 30, 6));
      popIn(structure, true);
      place(outHolder, at(78, 30, 6), 0.68);
      popIn(outHolder, true);
      gsap.to(output, { draw: 1, duration: 1, overwrite: true });
      showSmLink(true);
      root.updateMatrixWorld(true);
      const inv = root.matrixWorld.clone().invert();
      const b = board.point('msaIn', 'top').applyMatrix4(inv);
      const pts = [at(76, 39, 10), at(60, 47, 16), at(30, 47, 16), new THREE.Vector3(b.x, at(0, 52).y, 10), b.clone().add(new THREE.Vector3(0, 5, 2))];
      const curve = new THREE.CatmullRomCurve3(pts);
      recycle.geometry.dispose();
      recycle.geometry = new THREE.TubeGeometry(curve, 160, 0.9, 10);
      recycleHead.position.copy(curve.getPoint(1));
      recycleHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1));
      recycle.visible = true;
      gsap.fromTo(recycleHead.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 0.5, delay: 1.2 });
      gsap.fromTo(recycleFlow.uniforms.uOn, { value: 0 }, { value: 1, duration: 1.2, delay: 0.3 });
      pins.show('ar-recycle', true, 0.9);
      board.trace(['msaOut', 'msaIn', 'm0', 'row'], { step: 0.4, delay: 1.2 });
    },
  ];

  const sArch: Scene = {
    id: 'net-arch',
    label: network.archTitle,
    head,
    steps: 4,
    enter(step) {
      net.enter('dock');
      open(elArch);
      words($('.n-title', elArch), 0.3, 0.06);
      stepVis(elArch, step, 0.5);
      stageEls.forEach((li, i) => li.classList.toggle('is-active', i === step));
      archSteps[step]();
    },
    step(step) {
      stepVis(elArch, step);
      stageEls.forEach((li, i) => li.classList.toggle('is-active', i === step));
      archSteps[step]();
    },
    leave() {
      close(elArch);
      stepReset(elArch);
      hideProps();
      board.stack(false, 0.8);
      board.flow(false);
      world.fly(NET_SHOT, 1.6);
    },
  };

  // =========================================================================================
  // ۱. ورودی شبکه چگونه به اعداد تبدیل می‌شود؟  Letters → features → M and Z.
  // =========================================================================================
  // Letters to numbers.
  const letters = new Tiles(4);
  'AGLK'.split('').forEach((ch, i) => {
    letters.char(i, ch).color(i, '#ffffff');
    letters.t[i].x = (i - 1.5) * 2.6;
  });
  letters.unit = 2;
  letters.group.scale.setScalar(4.2);
  letters.group.position.copy(at(56, 18, 6));
  const feats = new Tiles(4 * 6, { size: 0.84, depth: 0.5, radius: 0.1 });
  for (let i = 0; i < 4; i++)
    for (let k = 0; k < 6; k++) {
      const n = i * 6 + k;
      feats.t[n].x = (i - 1.5) * 2.6;
      feats.t[n].y = -k * 1.6;
      feats.t[n].g = 0;
      feats.color(n, spectrum(Math.random()));
    }
  feats.unit = 1.5;
  feats.group.scale.setScalar(4.2);
  feats.group.position.copy(at(56, 30, 6));

  // M: N_seq × L × c_m, and Z: L × L × c_z.
  const MR = 6;
  const MC = 12;
  const MK = 5;
  const M = tensor(MR, MC, MK, MSA_HUES);
  const mi = idx(MR, MC);
  for (let c = 0; c < MC; c++) M.color(mi(0, c, 0), '#f26a4e');
  const ZL = 12;
  const ZK = 4;
  const Z = tensor(ZL, ZL, ZK, PAIR_HUES);
  const zi = idx(ZL, ZL);
  const ZI = 3;
  const ZJ = 8;
  for (const g of [M.group, Z.group]) {
    g.rotation.set(-0.42, 0.62, 0);
    g.scale.setScalar(2.4);
  }
  root.add(letters.group, feats.group, M.group, Z.group);
  net.onFrame(() => {
    letters.update();
    feats.update();
    M.update();
    Z.update();
  });

  const tiles = (t: Tiles, on: boolean, o: { delay?: number; amount?: number; from?: 'start' | 'end' | 'center' } = {}) =>
    t.show(on, { amount: 0.8, ...o });

  const corner = (g: THREE.Object3D, x: number, y: number, z: number) => () => g.localToWorld(new THREE.Vector3(x, y, z));
  pins
    .add('in-M-n', { anchor: corner(M.group, -MC / 2 - 0.8, 0, 0), html: tex('N_{\\mathrm{seq}}'), cls: 'pin-tex pin-dim', align: 'right' })
    .add('in-M-l', { anchor: corner(M.group, 0, MR / 2 + 0.8, 0), html: tex('L'), cls: 'pin-tex pin-dim', align: 'above' })
    .add('in-M-c', { anchor: corner(M.group, MC / 2 + 0.6, MR / 2 + 0.4, -MK / 2), html: tex('c_m'), cls: 'pin-tex pin-dim', align: 'left' })
    .add('in-M-src', { anchor: corner(M.group, 0, -MR / 2 - 1, 0), html: 'MSA representation <i>(s,r,c)</i>', cls: 'pin-term c-evo', align: 'below' })
    .add('in-M-tex', { anchor: corner(M.group, 0, -MR / 2 - 1, 0), html: tex(inputs.msa.tex), cls: 'pin-tex pin-formula', align: 'below', dy: 4.8 })
    .add('in-Z-tex', { anchor: corner(Z.group, 0, -ZL / 2 - 1, 0), html: tex(inputs.pair.tex), cls: 'pin-tex pin-formula', align: 'below', dy: 4.8 })
    .add('in-Z-l1', { anchor: corner(Z.group, -ZL / 2 - 0.8, 0, 0), html: tex('L'), cls: 'pin-tex pin-dim', align: 'right' })
    .add('in-Z-l2', { anchor: corner(Z.group, 0, ZL / 2 + 0.8, 0), html: tex('L'), cls: 'pin-tex pin-dim', align: 'above' })
    .add('in-Z-c', { anchor: corner(Z.group, ZL / 2 + 0.6, ZL / 2 + 0.4, -ZK / 2), html: tex('c_z'), cls: 'pin-tex pin-dim', align: 'left' })
    .add('in-Z-src', { anchor: corner(Z.group, 0, -ZL / 2 - 1, 0), html: 'Pair representation <i>(r,r,c)</i>', cls: 'pin-term c-pair', align: 'below' })
    .add('in-zij', { anchor: corner(Z.group, ZL / 2 + 1.5, (ZL - 1) / 2 - ZI, 3), html: tex(inputs.pair.cellTex), cls: 'pin-tex pin-call', align: 'left' })
    .add('in-letters', { anchor: corner(letters.group, -5.8, 0, 0), html: 'حروف', cls: 'pin-word', align: 'right' })
    .add('in-feats', { anchor: corner(feats.group, -5.8, -4, 0), html: 'ویژگی‌های عددی', cls: 'pin-word', align: 'right' });

  const elIn = section(
    overlay,
    's-net s-in',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${inputs.num}</p>
      <h2 class="n-title n-title-sm split">${inputs.title}</h2>
      <div class="swap">
        <div data-s="0-0"><p class="n-body n-strong">${inputs.lead}</p></div>
        <div data-s="1-1">
          <h3 class="n-sub"><b>${inputs.msa.label})</b> ${inputs.msa.title}</h3>
          <p class="n-body">${inputs.msa.body}</p>
          <ul class="n-terms">${inputs.msa.terms.map(([t, d]) => `<li>${tex(t)}<span>${d}</span></li>`).join('')}</ul>
        </div>
        <div data-s="2">
          <h3 class="n-sub"><b>${inputs.pair.label})</b> ${inputs.pair.title} <span class="ltr n-latin">(${inputs.pair.latin})</span></h3>
          <div class="swap swap-tight">
            <p class="n-body" data-s="2-2">${inputs.pair.body}</p>
            <div data-s="3">
              <p class="n-body">${rich(inputs.pair.cell)}</p>
              <aside class="callout alarm n-note"><span>${inputs.note}</span></aside>
            </div>
          </div>
        </div>
      </div>
    </div>`,
  );

  const inSteps = [
    () => {
      tiles(letters, true, { delay: 0.6, amount: 0.4 });
      tiles(feats, true, { delay: 1.4, amount: 0.8 });
      gsap.to(letters.t, { lift: 0, duration: 0.4 });
      tiles(M, false);
      tiles(Z, false);
      pins.show(['in-letters', 'in-feats'], true, 1.2, 0.3);
      pins.hide('in-M');
      pins.hide('in-Z');
      pins.show('in-zij', false);
      lens.show(false);
      board.focus(null);
    },
    () => {
      tiles(letters, false);
      tiles(feats, false);
      pins.hide('in-letters');
      pins.show('in-feats', false);
      gsap.to(M.group.position, { ...at(48, 27, 4), duration: 1.2, ease: "power3.inOut" });
      gsap.to(M.group.scale, { x: 3.1, y: 3.1, z: 3.1, duration: 1.2, ease: "power3.inOut" });
      tiles(M, true, { delay: 0.5, amount: 1.4 });
      tiles(Z, false);
      pins.show(['in-M-n', 'in-M-l', 'in-M-c', 'in-M-src', 'in-M-tex'], true, 1.6, 0.15);
      pins.hide('in-Z');
      pins.show('in-zij', false);
      board.focus(['msaIn']);
      lens.set({ from: () => board.corners("msaIn"), to: [8, 9, 84, 42] });
      lens.show(true, 0.6);
    },
    () => {
      tiles(letters, false);
      tiles(feats, false);
      pins.show(['in-letters', 'in-feats'], false);
      gsap.to(M.group.position, { ...at(27, 27, 4), duration: 1.2, ease: "power3.inOut" });
      gsap.to(M.group.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 1.2, ease: "power3.inOut" });
      tiles(M, true, { amount: 0.3 });
      Z.group.position.copy(at(70, 27, 4));
      Z.group.scale.setScalar(2.5);
      Z.t.forEach((t) => (t.lift = 0));
      for (let n = 0; n < Z.n; n++) Z.color(n, PAIR_HUES[n % PAIR_HUES.length]);
      tiles(Z, true, { delay: 0.6, amount: 1.4 });
      pins.show(['in-M-n', 'in-M-l', 'in-M-c', 'in-M-src', 'in-M-tex'], true, 0, 0);
      pins.show(['in-Z-l1', 'in-Z-l2', 'in-Z-c', 'in-Z-src', 'in-Z-tex'], true, 1.8, 0.15);
      pins.show('in-zij', false);
      board.focus(['msaIn', 'pairIn']);
      lens.set({ from: () => board.corners("pairIn"), to: [48, 9, 44, 42] });
      lens.show(true, 0.6);
    },
    () => {
      // One pair (i, j): a whole vector of features, not one number.
      for (let k = 0; k < ZK; k++) {
        const n = zi(ZI, ZJ, k);
        gsap.to(Z.t[n], { lift: 7, duration: 1.2, delay: 0.3 + k * 0.08, ease: 'back.out(1.6)' });
        Z.color(n, '#ffd21f');
      }
      pins.show('in-zij', true, 1.2);
    },
  ];

  const sInputs: Scene = {
    id: 'net-inputs',
    label: inputs.title,
    head,
    steps: 4,
    enter(step) {
      net.enter('dock');
      open(elIn);
      words($('.n-title', elIn), 0.3, 0.06);
      gsap.fromTo($('.w-num', elIn), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elIn, step, 0.5);
      for (let s = 0; s <= step; s++) if (s !== 1 || step === 1) inSteps[s]();
    },
    step(step, dir) {
      stepVis(elIn, step);
      if (step === 2 && dir < 0) {
        for (let k = 0; k < ZK; k++) gsap.to(Z.t[zi(ZI, ZJ, k)], { lift: 0, duration: 0.5 });
      }
      inSteps[step]();
    },
    leave() {
      close(elIn);
      stepReset(elIn);
      tiles(letters, false);
      tiles(feats, false);
      tiles(M, false);
      tiles(Z, false);
      pins.hide('in-');
      lens.show(false);
    },
  };
  net.onHide(() => {
    tiles(letters, false);
    tiles(feats, false);
    tiles(M, false);
    tiles(Z, false);
    pins.hide('in-');
  });

  return [sChapter, sOverview, sArch, sInputs];
}
