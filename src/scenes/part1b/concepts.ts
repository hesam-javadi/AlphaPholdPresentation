import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { conserved, coevo, msaInfo, pipeline, fa } from '../../content';
import { GLOBINS } from '../../data/globins';
import { MOL, type Ligand } from '../../data/molecules';
import { BallStick } from '../../three/ballstick';
import { Cartoon } from '../../three/cartoon';
import { Links } from '../../three/links';
import { flowMaterial, housing } from '../../three/props';
import { Tiles, residueColor } from '../../three/tiles';
import { ANCHOR, C, shot, spectrum } from '../../three/world';
import { $, $$, words, open, close, section, stepVis, stepReset } from '../../ui/text';
import { pop, type Ctx } from '../ctx';
import { at, alphaRibbon } from '../net/common';

// ۱-۶ What an alignment tells us: a conserved position (and the metal it holds),
// co-varying positions (a salt bridge that survives by compensation), and how AlphaFold uses both.

const GREEN = '#1fae5b';
const CHARGE: Record<string, { c: string; s: string }> = {
  K: { c: '#2f6fe4', s: '+' },
  R: { c: '#8b5cf6', s: '+' },
  D: { c: '#e23b3b', s: '−' },
  E: { c: '#f07a1a', s: '−' },
};

export function conceptScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins } = ctx;
  const head = { num: msaInfo.num, title: msaInfo.title };

  // =========================================================================================
  // Concept 1: conserved residues.
  // =========================================================================================
  const A1 = ANCHOR.concepts;
  const r1 = new THREE.Group();
  r1.position.copy(A1);
  world.scene.add(r1);
  const w1 = (v: THREE.Vector3) => r1.localToWorld(v.clone());

  const CR = conserved.rows.length;
  const CC = conserved.rows[0][1].length;
  const cm = new Tiles(CR * CC);
  cm.unit = 8.6;
  const cmPos = (r: number, c: number) => at(62 + (c - (CC - 1) / 2) * 5, 22 + r * 5.2, 8);
  conserved.rows.forEach(([, s], r) =>
    [...s].forEach((ch, c) => {
      const n = r * CC + c;
      Object.assign(cm.t[n], { ...cmPos(r, c) });
      cm.char(n, ch);
      if (c === conserved.col) cm.color(n, GREEN).inkColor(n, '#ffffff');
      else cm.color(n, '#ffffff');
    }),
  );
  r1.add(cm.group);
  conserved.rows.forEach(([name], r) => pins.add(`cs-r${r}`, { anchor: () => w1(cmPos(r, 0)), html: `${name}:`, cls: 'pin-seq', align: 'right', dx: -2.4 }));
  for (let c = 0; c < CC; c++) pins.add(`cs-c${c}`, { anchor: () => w1(cmPos(0, c)), html: fa(46 + c), cls: `pin-num${c === conserved.col ? ' pin-hot' : ''}`, align: 'above', dy: -3 });

  // A real zinc finger: two cysteines and two histidines hold one zinc ion (PDB 1ZNF).
  const ZF = MOL.zincFinger;
  const zf = new THREE.Group();
  zf.position.copy(at(44, 66, 10));
  zf.scale.setScalar(2.9);
  const zfCartoon = new Cartoon(ZF, { color: (_c, t, out) => out.copy(C.blue).lerp(C.sky, t) });
  const LIG = [2, 5, 18, 22];
  const chain = ZF.chains[0];
  const zn = ZF.ligands[0].atoms[0];
  const znPos = new THREE.Vector3(zn[1], zn[2], zn[3]);
  const sideAtoms: [string, number, number, number][] = [];
  for (const ri of LIG) {
    const ca = new THREE.Vector3().fromArray(chain.ca, ri * 3);
    const c = new THREE.Vector3().fromArray(chain.c, ri * 3);
    const o = new THREE.Vector3().fromArray(chain.o, ri * 3);
    const prevC = ri > 0 ? new THREE.Vector3().fromArray(chain.c, (ri - 1) * 3) : null;
    void ca;
    for (const [el, , r, x, y, z] of ZF.atoms) {
      if (r !== ri) continue;
      const p = new THREE.Vector3(x, y, z);
      if (p.distanceTo(c) < 0.05 || p.distanceTo(o) < 0.05) continue;
      if (prevC && el === 'N' && p.distanceTo(prevC) < 1.5) continue;
      sideAtoms.push([el, x, y, z]);
    }
  }
  const bonds: [number, number][] = [];
  for (let i = 0; i < sideAtoms.length; i++)
    for (let j = i + 1; j < sideAtoms.length; j++) {
      const d = Math.hypot(sideAtoms[i][1] - sideAtoms[j][1], sideAtoms[i][2] - sideAtoms[j][2], sideAtoms[i][3] - sideAtoms[j][3]);
      if (d < 1.95) bonds.push([i, j]);
    }
  const sides = new BallStick([{ name: 'site', atoms: sideAtoms, bonds } as Ligand], { carbon: '#3a4a60', atomR: 0.42, bondR: 0.16 });
  const znBall = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#8d9db3', metalness: 0.9, roughness: 0.25, clearcoat: 1, emissive: '#6b7f99', emissiveIntensity: 0.2 }));
  znBall.position.copy(znPos);
  // Coordination: dashed lines from the zinc to the S and N atoms that hold it.
  const coord: THREE.Vector3[] = [];
  sideAtoms.forEach(([el, x, y, z]) => {
    const p = new THREE.Vector3(x, y, z);
    if ((el === 'S' || el === 'N') && p.distanceTo(znPos) < 2.6) coord.push(znPos.clone(), p);
  });
  const coordLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(coord), new THREE.LineDashedMaterial({ color: '#56657a', dashSize: 0.25, gapSize: 0.18, transparent: true }));
  coordLines.computeLineDistances();
  zf.add(zfCartoon.mesh, sides.group, znBall, coordLines);
  zf.visible = false;
  zf.rotation.set(0.25, -0.5, 0);
  zfCartoon.draw = 0;
  r1.add(zf);
  const zfState = { site: 0, lost: 0 };
  const cysWorld = () => {
    const ri = 2;
    const sg = sideAtoms.find(([el]) => el === 'S');
    void ri;
    return zf.localToWorld(sg ? new THREE.Vector3(sg[1], sg[2], sg[3]) : znPos.clone());
  };
  pins
    .add('cs-zn', { anchor: () => zf.localToWorld(znBall.position.clone().add(new THREE.Vector3(0, 1.6, 0))), html: 'Zn<sup>2+</sup>', cls: 'pin-tex pin-ion', align: 'above' })
    .add('cs-lost', { anchor: () => zf.localToWorld(znBall.position.clone()), html: 'بدون یون، ساختار از هم می‌پاشد', cls: 'pin-flag pin-alarm', align: 'left', dx: 3 });
  const csLinks = new Links();
  r1.add(csLinks.group);

  world.onFrame(() => {
    cm.update();
    sides.build.p = zfState.site;
    sides.update();
    const lost = zfState.lost;
    znBall.position.copy(znPos).add(new THREE.Vector3(lost * 14, lost * 10, lost * 6));
    znBall.visible = zfState.site > 0.5;
    (coordLines.material as THREE.LineDashedMaterial).opacity = zfState.site * (1 - lost);
    coordLines.visible = zfState.site > 0.01;
    zfCartoon.dim = lost * 0.85;
  });

  const el1 = section(
    overlay,
    's-concept s-cons',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${conserved.kicker}</p>
      <h2 class="n-title n-title-sm">${conserved.title} <span class="ltr n-latin blk">${conserved.latin}</span></h2>
      <p class="n-body n-strong">${msaInfo.info[0].body}</p>
      <div class="c-cards">
        ${conserved.cards.map((c, i) => `<div class="c-card${i === 1 ? ' c-card-green' : ''}" data-s="${i + 1}"><h3>${c.head}</h3><p>${c.body}</p></div>`).join('')}
      </div>
    </div>
    <p class="c-view ltr">${conserved.view}</p>
    <p class="c-conclusion" data-s="3"><b>💡 ${conserved.conclusion.label}:</b> ${conserved.conclusion.body}</p>`,
  );

  const colFocus = (on: boolean) => {
    for (let r = 0; r < CR; r++)
      for (let c = 0; c < CC; c++) {
        const n = r * CC + c;
        const hot = c === conserved.col;
        gsap.to(cm.t[n], { lift: on && hot ? 3 : 0, s: on && !hot ? cm.unit * 0.9 : cm.unit, duration: 0.7, ease: 'back.out(1.6)', overwrite: 'auto' });
        if (!hot) cm.color(n, on ? '#eef2f6' : '#ffffff').inkColor(n, on ? '#8a9bb0' : '#0b1f3a');
      }
  };
  const showZf = (on: boolean) => {
    if (on) {
      zf.visible = true;
      gsap.to(zfCartoon, { draw: 1, duration: 1.6, delay: 0.3, overwrite: true });
      gsap.to(zfState, { site: 1, duration: 1.4, delay: 1.2, overwrite: true });
    } else {
      gsap.to(zfCartoon, { draw: 0, duration: 0.5, overwrite: true, onComplete: () => void (zf.visible = false) });
      gsap.to(zfState, { site: 0, lost: 0, duration: 0.4, overwrite: true });
    }
  };
  const consSteps = [
    () => {
      colFocus(false);
      showZf(false);
      csLinks.show(false);
      pins.show(['cs-zn', 'cs-lost'], false);
    },
    () => {
      colFocus(true);
      showZf(false);
      csLinks.show(false);
      pins.show(['cs-zn', 'cs-lost'], false);
    },
    () => {
      colFocus(true);
      showZf(true);
      gsap.set(zfState, { lost: 0 });
      pins.show('cs-zn', true, 2.4);
      pins.show('cs-lost', false);
      // From the conserved column to the cysteine that holds the metal.
      r1.updateMatrixWorld(true);
      zf.updateMatrixWorld(true);
      const inv = r1.matrixWorld.clone().invert();
      csLinks.set([{ a: cmPos(CR - 1, conserved.col).add(new THREE.Vector3(0, -3, 3)), b: cysWorld().applyMatrix4(inv), w: 0.7, bend: new THREE.Vector3(-10, 0, 6), color: GREEN, arrow: true, r: 0.26 }]).show(true, { delay: 2.6 });
    },
    () => {
      colFocus(true);
      if (!zf.visible) showZf(true);
      csLinks.show(false);
      pins.show('cs-zn', false);
      // A mutation here costs the metal — and the fold.
      gsap.to(zfState, { lost: 1, duration: 1.6, delay: 0.6, ease: 'power2.in' });
      pins.show('cs-lost', true, 1.8);
    },
  ];

  function hide1() {
    cm.show(false);
    showZf(false);
    csLinks.show(false);
    pins.hide('cs-');
  }
  ctx.register('concepts', hide1);

  const sCons: Scene = {
    id: 'conserved',
    label: conserved.title,
    head,
    steps: 4,
    enter(step) {
      ctx.area('concepts');
      open(el1);
      world.fly(shot(A1, { pz: 300 }), 3);
      world.fogTo(380, 900);
      chrome.caption(null);
      gsap.fromTo([$('.w-num', el1), $('.n-title', el1), $('.n-strong', el1)], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.3, stagger: 0.15 });
      stepVis(el1, step, 0.6);
      cm.show(true, { delay: 0.6, amount: 1 });
      pins.show(conserved.rows.map((_, r) => `cs-r${r}`), true, 1, 0.1);
      pins.show([...Array(CC).keys()].map((c) => `cs-c${c}`), true, 1.2, 0.03);
      consSteps[step]();
      if (step === 2) chrome.caption({ name: 'انگشت روی (Zinc finger)', detail: 'PDB 1ZNF: دو سیستئین و دو هیستیدین یون روی را نگه می‌دارند' }, 2);
    },
    step(step) {
      stepVis(el1, step);
      consSteps[step]();
      if (step === 2) chrome.caption({ name: 'انگشت روی (Zinc finger)', detail: 'PDB 1ZNF: دو سیستئین و دو هیستیدین یون روی را نگه می‌دارند' }, 1);
      if (step !== 2) chrome.caption(null);
    },
    leave() {
      close(el1);
      stepReset(el1);
      hide1();
      chrome.caption(null);
    },
  };

  // =========================================================================================
  // Concept 2: co-evolution — a salt bridge kept by a compensating mutation.
  // =========================================================================================
  const A2 = A1.clone().add(new THREE.Vector3(-400, 0, 0));
  const r2 = new THREE.Group();
  r2.position.copy(A2);
  world.scene.add(r2);
  const w2 = (v: THREE.Vector3) => r2.localToWorld(v.clone());

  // MSA rows: … K … D … as in the PDF.
  const ROW_TILES = 5;
  const ct = new Tiles(4 * ROW_TILES);
  ct.unit = 7.6;
  const ctPos = (r: number, c: number) => at(40 + (c - 2) * 8.5, 20 + r * 5.2, 8);
  coevo.rows.forEach((row, r) => {
    const cells = ['…', row.a, '…', row.b, '…'];
    cells.forEach((ch, c) => {
      const n = r * ROW_TILES + c;
      Object.assign(ct.t[n], { ...ctPos(r, c) });
      ct.char(n, ch);
      if (CHARGE[ch]) ct.color(n, CHARGE[ch].c).inkColor(n, '#ffffff');
      else ct.color(n, '#ffffff').inkColor(n, '#8a9bb0');
      if (!CHARGE[ch]) ct.t[n].d = 0.4;
    });
  });
  r2.add(ct.group);
  coevo.rows.forEach((row, r) => {
    pins.add(`co-r${r}`, { anchor: () => w2(ctPos(r, 0)), html: `Seq ${r + 1}:`, cls: 'pin-seq', align: 'right', dx: -2.6 });
    pins.add(`co-n${r}`, { anchor: () => w2(ctPos(r, 4)), html: `(${row.note})`, cls: 'pin-seq pin-note', align: 'left', dx: 2.6 });
    pins.add(`co-ca${r}`, { anchor: () => w2(ctPos(r, 1)), html: CHARGE[row.a].s, cls: 'pin-charge', align: 'left', dx: 1.4, dy: -1.4 });
    pins.add(`co-cb${r}`, { anchor: () => w2(ctPos(r, 3)), html: CHARGE[row.b].s, cls: 'pin-charge', align: 'left', dx: 1.4, dy: -1.4 });
    // The elided stretches are just dots, not tiles.
    for (const c of [0, 2, 4]) pins.add(`co-e${r}-${c}`, { anchor: () => w2(ctPos(r, c)), html: '…', cls: 'pin-gap' });
  });
  pins
        .add('co-p20', { anchor: () => w2(ctPos(0, 1)), html: 'Pos 20', cls: 'pin-seq pin-pos', align: 'above', dy: -2.6 })
    .add('co-p80', { anchor: () => w2(ctPos(0, 3)), html: 'Pos 80', cls: 'pin-seq pin-pos', align: 'above', dy: -2.6 });

  // A schematic hairpin of 100 residues; 20 and 80 face each other across the gap.
  const NB = 100;
  const I20 = 19;
  const I80 = 79;
  const hp = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1 }), NB);
  const hpBonds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 8), new THREE.MeshStandardMaterial({ color: C.ink }), NB - 1);
  const col = new THREE.Color();
  for (let i = 0; i < NB; i++) hp.setColorAt(i, spectrum(i / (NB - 1), col));
  hp.frustumCulled = hpBonds.frustumCulled = false;
  const hairpin = new THREE.Group();
  hairpin.position.copy(at(40, 63, 4));
  hairpin.scale.setScalar(1.12);
  hairpin.add(hp, hpBonds);
  const bridge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineDashedMaterial({ color: '#0b1f3a', dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0 }));
  hairpin.add(bridge);
  r2.add(hairpin);
  const hs = { open: 0, shake: 0, on: 0, a: 'K', b: 'D', bridge: 1 };
  const STEP = 1.2;
  const bead = (i: number, out: THREE.Vector3, t: number) => {
    const gap = 3.6 + hs.open * 9;
    const top = 26;
    let x: number;
    let y: number;
    if (i < 48) {
      x = -gap;
      y = top - i * STEP;
    } else if (i < 51) {
      const a = ((i - 47) / 4) * Math.PI;
      x = -gap * Math.cos(a);
      y = top - 47 * STEP - Math.sin(a) * 2.4;
    } else {
      x = gap;
      y = top - 47 * STEP + (i - 51) * STEP;
    }
    const k = i * 1.7;
    x += Math.sin(k) * 1.3;
    const z = Math.cos(k) * 1.3;
    // Residues 20 and 80 reach toward each other.
    if (i === I20) x += 1.8 - hs.open * 0.5;
    if (i === I80) x -= 1.8 - hs.open * 0.5;
    const jit = hs.shake * 0.5;
    return out.set(x + Math.sin(t * 40 + i) * jit, y + Math.cos(t * 37 + i * 2) * jit, z);
  };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const mm = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  world.onFrame((_, t) => {
    ct.update();
    hairpin.visible = hs.on > 0.001;
    if (!hairpin.visible) return;
    for (let i = 0; i < NB; i++) {
      bead(i, tmpA, t);
      const big = i === I20 || i === I80;
      const s = Math.max(1e-4, hs.on * (big ? 2.1 : 0.85));
      mm.makeScale(s, s, s).setPosition(tmpA);
      hp.setMatrixAt(i, mm);
    }
    for (let i = 0; i < NB - 1; i++) {
      bead(i, tmpA, t);
      bead(i + 1, tmpB, t);
      const mid = tmpA.clone().add(tmpB).multiplyScalar(0.5);
      const d = tmpB.sub(tmpA);
      const len = d.length();
      qq.setFromUnitVectors(UP, d.normalize());
      mm.compose(mid, qq, new THREE.Vector3(hs.on, len, hs.on));
      hpBonds.setMatrixAt(i, mm);
    }
    hp.instanceMatrix.needsUpdate = true;
    hpBonds.instanceMatrix.needsUpdate = true;
    bead(I20, tmpA, t);
    bead(I80, tmpB, t);
    const pos = bridge.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, tmpA.x, tmpA.y, tmpA.z);
    pos.setXYZ(1, tmpB.x, tmpB.y, tmpB.z);
    pos.needsUpdate = true;
    bridge.computeLineDistances();
    (bridge.material as THREE.LineDashedMaterial).opacity = hs.bridge * hs.on;
  });
  const setCharges = (a: string, b: string) => {
    hp.setColorAt(I20, col.set(CHARGE[a].c));
    hp.setColorAt(I80, col.set(CHARGE[b].c));
    hp.instanceColor!.needsUpdate = true;
    pins.html('co-b20', `${a} <b>(${CHARGE[a].s})</b>`);
    pins.html('co-b80', `${b} <b>(${CHARGE[b].s})</b>`);
  };
  const hpPin = (i: number) => () => hairpin.localToWorld(bead(i, new THREE.Vector3(), 0));
  pins
    .add('co-b20', { anchor: hpPin(I20), html: 'K', cls: 'pin-res', align: 'right', dx: -4.6 })
    .add('co-b80', { anchor: hpPin(I80), html: 'D', cls: 'pin-res', align: 'left', dx: 4.6 })
    .add('co-n20', { anchor: hpPin(I20), html: 'جایگاه ۲۰', cls: 'pin-word', align: 'right', dx: -4.6, dy: 3.8 })
    .add('co-n80', { anchor: hpPin(I80), html: 'جایگاه ۸۰', cls: 'pin-word', align: 'left', dx: 4.6, dy: 3.8 })
    .add('co-bridge', { anchor: () => hairpin.localToWorld(new THREE.Vector3(0, 26 - 19 * STEP + 3.4, 0)), html: 'پل نمکی', cls: 'pin-flag', align: 'above' })
    .add('co-repel', { anchor: () => hairpin.localToWorld(new THREE.Vector3(0, 26 - 19 * STEP + 3.4, 0)), html: 'دفع الکتریکی', cls: 'pin-flag pin-alarm', align: 'above' });
  const coLinks = new Links();
  r2.add(coLinks.group);

  const el2 = section(
    overlay,
    's-concept s-coevo',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${coevo.kicker}</p>
      <h2 class="n-title n-title-sm">${coevo.title} <span class="ltr n-latin blk">${coevo.latin}</span></h2>
      <div class="c-cards">
        ${coevo.cards.map((c, i) => `<div class="c-card c-k${i}" data-s="${i}"><small>${c.kicker}</small><h3>${c.head}</h3><p>${c.body}</p></div>`).join('')}
      </div>
    </div>
    <p class="c-view ltr">${coevo.view}</p>
    <p class="c-conclusion c-analysis" data-s="3"><b>${coevo.analysis.label}:</b> ${coevo.analysis.body}</p>`,
  );
  const cards2 = $$('.c-card', el2);
  const rowsOn = (n: number, delay = 0) => {
    for (let r = 0; r < 4; r++) {
      const on = r < n;
      for (let c = 0; c < ROW_TILES; c++) {
        const tile = c === 1 || c === 3;
        gsap.to(ct.t[r * ROW_TILES + c], { s: on && tile ? ct.unit : 0, duration: on ? 0.5 : 0.3, delay: on ? delay + r * 0.2 + c * 0.05 : 0, ease: on ? 'back.out(1.8)' : 'power2.in', overwrite: 'auto' });
      }
      pins.show([`co-r${r}`, `co-n${r}`, `co-ca${r}`, `co-cb${r}`, `co-e${r}-0`, `co-e${r}-2`, `co-e${r}-4`], on, delay + r * 0.2 + 0.4);
    }
  };
  const colGlow = (on: boolean) => {
    for (let r = 0; r < 4; r++)
      for (const c of [1, 3]) gsap.to(ct.t[r * ROW_TILES + c], { lift: on ? 2.6 : 0, duration: 0.6, delay: on ? 0.2 + r * 0.08 : 0, overwrite: 'auto' });
  };

  const coSteps = [
    () => {
      rowsOn(2, 0.6);
      colGlow(false);
      setCharges('K', 'D');
      gsap.to(hs, { on: 1, open: 0, shake: 0, bridge: 1, duration: 1.2, delay: 0.4 });
      pins.show(['co-b20', 'co-b80', 'co-n20', 'co-n80'], true, 1.4, 0.1);
      pins.show('co-bridge', true, 1.8);
      pins.show('co-repel', false);
      coLinks.show(false);
    },
    () => {
      rowsOn(2);
      colGlow(false);
      setCharges('E', 'D');
      gsap.to(hs, { on: 1, duration: 0.8 });
      pins.show(['co-b20', 'co-b80', 'co-n20', 'co-n80'], true, 0.6, 0.1);
      gsap.to(hs, { open: 1, bridge: 0, duration: 1.2, delay: 0.5, ease: 'power3.out' });
      gsap.fromTo(hs, { shake: 1 }, { shake: 0.15, duration: 2.4, delay: 0.5 });
      pins.show('co-bridge', false);
      pins.show('co-repel', true, 0.8);
      coLinks.show(false);
    },
    () => {
      rowsOn(4, 0.3);
      colGlow(false);
      setCharges('E', 'R');
      gsap.to(hs, { on: 1, duration: 0.8 });
      pins.show(['co-b20', 'co-b80', 'co-n20', 'co-n80'], true, 0.6, 0.1);
      gsap.to(hs, { open: 0, shake: 0, bridge: 1, duration: 1.4, delay: 0.6, ease: 'power3.inOut' });
      pins.show('co-repel', false);
      pins.show('co-bridge', true, 1.6);
      coLinks.show(false);
    },
    () => {
      rowsOn(4);
      colGlow(true);
      setCharges('E', 'R');
      gsap.to(hs, { on: 1, open: 0, shake: 0, bridge: 1, duration: 0.6 });
      pins.show(['co-b20', 'co-b80', 'co-n20', 'co-n80'], true, 0.4, 0.1);
      pins.show(['co-repel', 'co-bridge'], false);
      // The two co-varying columns point to two residues in contact.
      r2.updateMatrixWorld(true);
      const inv = r2.matrixWorld.clone().invert();
      coLinks
        .set([
          { a: ctPos(3, 1).add(new THREE.Vector3(0, -4.4, 3)), b: hpPin(I20)().applyMatrix4(inv).add(new THREE.Vector3(-1, 2, 0)), w: 0.7, bend: new THREE.Vector3(-3, 0, 6), color: '#0053d6', arrow: true, r: 0.26 },
          { a: ctPos(3, 3).add(new THREE.Vector3(0, -4.4, 3)), b: hpPin(I80)().applyMatrix4(inv).add(new THREE.Vector3(1, 2, 0)), w: 0.7, bend: new THREE.Vector3(3, 0, 6), color: '#0053d6', arrow: true, r: 0.26 },
        ])
        .show(true, { delay: 0.8, stagger: 0.3 });
    },
  ];

  function hide2() {
    ct.show(false);
    gsap.to(hs, { on: 0, duration: 0.5 });
    coLinks.show(false);
    pins.hide('co-');
  }
  ctx.register('coevo', hide2);

  const sCoevo: Scene = {
    id: 'coevolution',
    label: coevo.title,
    head,
    steps: 4,
    enter(step) {
      ctx.area('coevo');
      open(el2);
      world.fly(shot(A2, { pz: 300 }), 3);
      world.fogTo(380, 900);
      if (step < 3) chrome.caption({ name: 'زنجیره‌ی ۱۰۰ اسید آمینه‌ای', detail: 'طرح‌واره؛ جایگاه‌های ۲۰ و ۸۰ در فضای سه‌بعدی کنار هم‌اند' }, 2);
      else chrome.caption(null);
      gsap.fromTo([$('.w-num', el2), $('.n-title', el2)], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.3, stagger: 0.15 });
      stepVis(el2, step, 0.6);
      cards2.forEach((c, i) => c.classList.toggle('is-active', i === Math.min(step, 2)));
      pins.show(['co-p20', 'co-p80'], true, 0.8, 0.1);
      ct.t.forEach((t) => (t.s = 0));
      coSteps[step]();
    },
    step(step) {
      stepVis(el2, step);
      cards2.forEach((c, i) => c.classList.toggle('is-active', i === Math.min(step, 2)));
      coSteps[step]();
      // The analysis bar takes the bottom of the frame.
      if (step === 3) chrome.caption(null);
      else chrome.caption({ name: 'زنجیره‌ی ۱۰۰ اسید آمینه‌ای', detail: 'طرح‌واره؛ جایگاه‌های ۲۰ و ۸۰ در فضای سه‌بعدی کنار هم‌اند' }, 0.4);
    },
    leave() {
      close(el2);
      stepReset(el2);
      chrome.caption(null);
    },
  };

  // =========================================================================================
  // How AlphaFold uses it: two inputs, one model, one 3D structure.
  // =========================================================================================
  const A3 = ANCHOR.pipeline;
  const r3 = new THREE.Group();
  r3.position.copy(A3);
  world.scene.add(r3);
  const w3 = (v: THREE.Vector3) => r3.localToWorld(v.clone());
  const query = GLOBINS.rows[0].seq;
  const SN = 16;
  const seqT = new Tiles(SN);
  seqT.unit = 5.6;
  const seqPos = (i: number) => at(32 + (i - (SN - 1) / 2) * 3.1, 17, 8);
  for (let i = 0; i < SN; i++) {
    Object.assign(seqT.t[i], { ...seqPos(i) });
    seqT.char(i, query[i]).color(i, residueColor(query[i]));
  }
  const MRN = 6;
  const MCN = 16;
  const msaT = new Tiles(MRN * MCN);
  msaT.unit = 4.1;
  const msaP = (r: number, c: number) => at(78 + (c - (MCN - 1) / 2) * 2.3, 13 + r * 2.3, 8);
  for (let r = 0; r < MRN; r++)
    for (let c = 0; c < MCN; c++) {
      const n = r * MCN + c;
      const ch = GLOBINS.rows[r].aligned[c] ?? '-';
      Object.assign(msaT.t[n], { ...msaP(r, c) });
      msaT.char(n, ch).color(n, ch === '-' ? '#ffffff' : residueColor(ch));
    }
  // The model: a dark block with light moving inside.
  const model = new THREE.Group();
  model.position.copy(at(53, 47, 0));
  const mBody = new THREE.Mesh(new THREE.BoxGeometry(76, 20, 10), housing());
  const mCanvas = document.createElement('canvas');
  mCanvas.width = 1024;
  mCanvas.height = 270;
  const mg = mCanvas.getContext('2d')!;
  mg.fillStyle = '#fff';
  mg.font = '800 130px "Vazirmatn Variable", sans-serif';
  mg.textAlign = 'center';
  mg.textBaseline = 'middle';
  mg.fillText('AlphaFold2', 512, 140);
  const mTex = new THREE.CanvasTexture(mCanvas);
  mTex.colorSpace = THREE.SRGBColorSpace;
  mTex.anisotropy = 8;
  const mLabel = new THREE.Mesh(new THREE.PlaneGeometry(56, 15), new THREE.MeshBasicMaterial({ map: mTex, transparent: true, toneMapped: false }));
  mLabel.position.z = 5.05;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(74, 18),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uOn; varying vec2 vUv;
        void main() {
          vec2 g = abs(fract(vUv * vec2(24.0, 6.0)) - 0.5);
          float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
          float wave = 0.5 + 0.5 * sin(vUv.x * 18.0 - uTime * 3.0 + sin(vUv.y * 6.0 + uTime) * 1.5);
          vec3 c = mix(vec3(0.0, 0.33, 0.84), vec3(0.4, 0.8, 0.95), wave);
          gl_FragColor = vec4(c, (grid * 0.55 + wave * 0.12) * uOn);
        }`,
    }),
  );
  glow.position.z = 5.02;
  model.add(mBody, glow, mLabel);
  model.scale.setScalar(0.001);
  model.visible = false;
  const out = alphaRibbon();
  const outH = new THREE.Group();
  outH.add(out.mesh);
  outH.position.copy(at(50, 78, 6));
  outH.scale.setScalar(1.05);
  out.draw = 0;
  // Flows: inputs → model → structure.
  const f1 = flowMaterial(C.blue, { dashes: 22, speed: 1 });
  const f2 = flowMaterial('#d9541e', { dashes: 22, speed: 1 });
  const f3 = flowMaterial(C.ink, { dashes: 22, speed: 1 });
  const tube = (pts: THREE.Vector3[], m: THREE.ShaderMaterial) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.7, 10), m);
  const t1 = tube([at(32, 20, 6), at(34, 30, 4), at(45, 38, 2)], f1.material);
  const t2 = tube([at(78, 27.5, 6), at(74, 33, 4), at(62, 38, 2)], f2.material);
  const t3 = tube([at(53, 56, 2), at(52, 61, 4), at(50, 64, 6)], f3.material);
  r3.add(seqT.group, msaT.group, model, outH, t1, t2, t3);
  world.onFrame((dt, t) => {
    seqT.update();
    msaT.update();
    f1.uniforms.uTime.value = f2.uniforms.uTime.value = f3.uniforms.uTime.value = t;
    (glow.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    outH.rotation.y += dt * 0.3;
  });
  // Atom coordinates: three real Cα positions of the α chain (Å, centred).
  const caA = MOL.haemoglobin.chains[0].ca;
  const ctr = new THREE.Vector3();
  for (let i = 0; i < caA.length; i += 3) ctr.add(new THREE.Vector3(caA[i], caA[i + 1], caA[i + 2]));
  ctr.multiplyScalar(3 / caA.length);
  const XYZ = [0, 57, 86].map((i) => new THREE.Vector3().fromArray(caA, i * 3).sub(ctr));
  const fmt = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  XYZ.forEach((p, k) =>
    pins.add(`pl-xyz${k}`, {
      anchor: () => out.mesh.localToWorld(p.clone()),
      html: `<span class="ltr">(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)})</span>`,
      cls: 'pin-xyz',
      align: k === 1 ? 'right' : 'left',
      dx: k === 1 ? -3.4 : 2.4,
      dy: [-1.4, 3.2, 1.2][k],
    }),
  );
  pins
    .add('pl-seq', { anchor: () => w3(seqPos(SN - 1)), html: '…', cls: 'pin-num', align: 'left', dx: 2.4 })
    .add('pl-in1', { anchor: () => w3(seqPos((SN - 1) / 2)), html: 'ورودی ۱', cls: 'pin-flag', align: 'above', dy: -2.6 })
    .add('pl-in2', { anchor: () => w3(msaP(0, (MCN - 1) / 2)), html: 'ورودی ۲', cls: 'pin-flag', align: 'above', dy: -2 });

  const el3 = section(
    overlay,
    's-concept s-pipe',
    /* html */ `
    <div class="n-panel">
      <p class="n-body n-strong p-lead">${pipeline.lead}</p>
      <ol class="n-stages p-steps">
        ${pipeline.steps
          .map(
            (s, i) => `
          <li class="n-stage" data-s="${i}" style="--c:${['#0053d6', '#d9541e', '#16294a', '#1fae5b'][i]}">
            <b>${fa(i + 1)}</b><div><h3>${s.head}</h3><p>${s.body}</p></div>
          </li>`,
          )
          .join('')}
      </ol>
    </div>`,
  );
  const stagesP = $$('.n-stage', el3);
  const flowOn = (m: { uniforms: { uOn: { value: number } } }, on: boolean, delay = 0) => gsap.to(m.uniforms.uOn, { value: on ? 1 : 0, duration: 0.8, delay: on ? delay : 0 });
  const plSteps = [
    () => {
      seqT.show(true, { delay: 0.6, amount: 0.8 });
      msaT.show(false);
      pop(model, false);
      gsap.to(out, { draw: 0, duration: 0.4, overwrite: true });
      flowOn(f1, false);
      flowOn(f2, false);
      flowOn(f3, false);
      t1.visible = t2.visible = t3.visible = false;
      pins.show(['pl-seq', 'pl-in1'], true, 1.2, 0.2);
      pins.show('pl-in2', false);
      pins.hide('pl-xyz');
    },
    () => {
      seqT.show(true);
      msaT.show(true, { delay: 0.3, amount: 1.2 });
      pop(model, false);
      gsap.to(out, { draw: 0, duration: 0.4, overwrite: true });
      flowOn(f3, false);
      pins.show(['pl-seq', 'pl-in1'], true);
      pins.show('pl-in2', true, 1);
      pins.hide('pl-xyz');
    },
    () => {
      seqT.show(true);
      msaT.show(true);
      pop(model, true, { delay: 0.2 });
      t1.visible = t2.visible = t3.visible = true;
      gsap.to((glow.material as THREE.ShaderMaterial).uniforms.uOn, { value: 1, duration: 1, delay: 0.8 });
      flowOn(f1, true, 0.6);
      flowOn(f2, true, 0.8);
      flowOn(f3, false);
      gsap.to(out, { draw: 0, duration: 0.4, overwrite: true });
      pins.show(['pl-seq', 'pl-in1', 'pl-in2'], true);
      pins.hide('pl-xyz');
    },
    () => {
      pop(model, true);
      t1.visible = t2.visible = t3.visible = true;
      gsap.to((glow.material as THREE.ShaderMaterial).uniforms.uOn, { value: 1, duration: 0.6 });
      flowOn(f1, true);
      flowOn(f2, true);
      flowOn(f3, true, 0.3);
      gsap.to(out, { draw: 1, duration: 2.2, delay: 0.8, overwrite: true });
      pins.show(XYZ.map((_, k) => `pl-xyz${k}`), true, 2.6, 0.25);
    },
  ];
  function hide3() {
    seqT.show(false);
    msaT.show(false);
    pop(model, false);
    gsap.to(out, { draw: 0, duration: 0.4, overwrite: true });
    [f1, f2, f3].forEach((f) => flowOn(f, false));
    pins.hide('pl-');
  }
  ctx.register('pipeline', hide3);

  const sPipe: Scene = {
    id: 'pipeline',
    label: 'ورودی‌ها و خروجی AlphaFold',
    head,
    steps: 4,
    enter(step) {
      ctx.area('pipeline');
      open(el3);
      world.fly(shot(A3, { pz: 300 }), 3);
      world.fogTo(380, 900);
      chrome.caption(null);
      gsap.fromTo($('.p-lead', el3), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.3 });
      stepVis(el3, step, 0.6);
      stagesP.forEach((li, i) => li.classList.toggle('is-active', i === step));
      for (let s = 0; s <= step; s++) plSteps[s]();
      if (step === 3) chrome.caption({ name: 'زنجیره‌ی α هموگلوبین انسان', detail: 'نمونه‌ی خروجی: PDB 4HHB؛ مختصات Cα بر حسب آنگستروم' }, 2.4);
    },
    step(step) {
      stepVis(el3, step);
      stagesP.forEach((li, i) => li.classList.toggle('is-active', i === step));
      plSteps[step]();
      if (step === 3) chrome.caption({ name: 'زنجیره‌ی α هموگلوبین انسان', detail: 'نمونه‌ی خروجی: PDB 4HHB؛ مختصات Cα بر حسب آنگستروم' }, 1.4);
      else chrome.caption(null);
    },
    leave() {
      close(el3);
      stepReset(el3);
    },
  };

  void words;
  return [sCons, sCoevo, sPipe];
}
