import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { chapter2, evoformer, attention, rowcol, transition, opm, triangle, fa } from '../../content';
import { ATTENTION, MSA_TRACK, PAIR_TRACK, PLUS, RESIDUALS, type ModId } from '../../three/board';
import { Links } from '../../three/links';
import { Tiles, residueColor } from '../../three/tiles';
import { C, spectrum } from '../../three/world';
import { rich, tex } from '../../ui/math';
import { $, words, open, close, section, stepVis, stepReset } from '../../ui/text';
import type { Ctx } from '../ctx';
import { at, BeadRow, NET_SHOT, ORBIT, type Net } from './common';

// -------------------------------------------------------------------------------------------
// Small 3D vocabulary for the concept panels
// -------------------------------------------------------------------------------------------

const tilesIn = (t: Tiles, on: boolean, o: { delay?: number; amount?: number } = {}) => t.show(on, o);

const faNum = (x: number) => fa(x.toFixed(2)).replace('.', '٫');

export function netEvoScenes(ctx: Ctx, net: Net): Scene[] {
  const { world, overlay, pins, lens } = ctx;
  const { board, root } = net;
  const head = { num: chapter2.num, title: chapter2.title };
  const lensOn = (ids: ModId[], to: [number, number, number, number], delay = 0.6) => {
    lens.set({ from: () => board.corners(...ids), to });
    lens.show(true, delay);
  };

  // =========================================================================================
  // ۲. Evoformer — two representations, talking to each other, 48 times.
  // =========================================================================================
  const elEvo = section(
    overlay,
    's-net s-evo',
    /* html */ `
    <div class="n-panel n-wide">
      <p class="w-num">${evoformer.num}</p>
      <h2 class="n-title split">${evoformer.title}</h2>
      <p class="n-body" data-s="0">${evoformer.body}</p>
      <p class="n-body n-strong" data-s="2">${evoformer.repeat}</p>
    </div>`,
  );
  pins
    .add('ev-msa', { anchor: () => board.point('msaOut', 'left').add(new THREE.Vector3(-46, 6, 0)), html: 'نمایش MSA', cls: 'pin-track c-evo' })
    .add('ev-pair', { anchor: () => board.point('pairIn', 'right').add(new THREE.Vector3(36, -6, 0)), html: 'نمایش Pair', cls: 'pin-track c-pair' })
    .add('ev-bias', { anchor: () => board.point('row', 'bottom').add(new THREE.Vector3(5, -10, 0)), html: '<b>Pair → MSA</b>', cls: 'pin-flag', align: 'left' })
    .add('ev-opm', { anchor: () => board.point('opm', 'right').add(new THREE.Vector3(3, 0, 0)), html: '<b>MSA → Pair</b>', cls: 'pin-flag', align: 'left' })
    .add('ev-48', { anchor: () => board.root.localToWorld(new THREE.Vector3(-117, 38.5, -47 * 7 - 3.5)), html: '<b>× ۴۸</b>', cls: 'pin-flag pin-big', align: 'above', dy: -1 });
  const EXCHANGE = ['bias', 'opmIn', 'opm', 'opmOut', 'p-opm', 'row'];
  const evoSteps = [
    () => {
      world.fly(NET_SHOT, 1.6);
      net.dock('figure');
      board.stack(false, 0.8);
      board.focus(null);
      board.flow(true, [...MSA_TRACK, ...PAIR_TRACK]);
      pins.show(['ev-msa', 'ev-pair'], true, 1, 0.2);
      pins.show(['ev-bias', 'ev-opm', 'ev-48'], false);
    },
    () => {
      world.fly(NET_SHOT, 1.6);
      net.dock('figure');
      board.stack(false, 0.8);
      board.focus(EXCHANGE, { dim: 0.55 });
      board.flow(true, EXCHANGE);
      pins.show(['ev-bias', 'ev-opm'], true, 0.6, 0.3);
      pins.show('ev-48', false);
    },
    () => {
      net.dock('dock');
      board.focus(null);
      board.flow(true);
      board.stack(true, 2.8);
      world.fly(ORBIT, 2.6);
      pins.show(['ev-msa', 'ev-pair', 'ev-bias', 'ev-opm'], false);
      pins.show('ev-48', true, 2.2);
    },
  ];
  const sEvo: Scene = {
    id: 'net-evoformer',
    label: evoformer.title,
    head,
    steps: 3,
    enter(step) {
      net.enter('figure');
      open(elEvo);
      words($('.n-title', elEvo), 0.3, 0.06);
      gsap.fromTo($('.w-num', elEvo), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elEvo, step, 0.6);
      evoSteps[step]();
    },
    step(step) {
      stepVis(elEvo, step);
      evoSteps[step]();
    },
    leave() {
      close(elEvo);
      stepReset(elEvo);
      pins.hide('ev-');
      board.flow(false);
      board.stack(false, 0.8);
      world.fly(NET_SHOT, 1.6);
    },
  };

  // =========================================================================================
  // ۲-۱ Self-attention: one position looks at all the others.
  // =========================================================================================
  const TOK = 6;
  const Q = 2;
  const W = [0.06, 0.13, 0.27, 0.07, 0.41, 0.06];
  const QKV_COL = ['#65cbf3', '#ffd21f', '#ff9a6a'];
  const tokens = new BeadRow(TOK, 17, 3.3);
  tokens.group.position.copy(at(37, 45, 6));
  /** Token position, local to the chapter root. */
  const tokPos = (i: number) => tokens.group.position.clone().add(tokens.pos[i]);
  const wp = (v: THREE.Vector3) => root.localToWorld(v);

  const qkv = new Tiles(TOK * 3);
  qkv.unit = 6;
  for (let i = 0; i < TOK; i++)
    for (let k = 0; k < 3; k++) {
      const n = i * 3 + k;
      const p = tokPos(i);
      qkv.char(n, 'QKV'[k]).color(n, QKV_COL[k]);
      Object.assign(qkv.t[n], { x: p.x, y: p.y + 8.5 + k * 6.2, z: p.z });
    }
  const heat = new Tiles(TOK * TOK, { size: 0.9, depth: 0.4 });
  heat.unit = 5.2;
  const heatOrigin = at(82, 28, 4);
  const rowsW: number[][] = Array.from({ length: TOK }, (_, r) => {
    if (r === Q) return W;
    const raw = Array.from({ length: TOK }, (_, c) => Math.exp((c === r ? 1.4 : 0) + Math.random() * 1.6));
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((x) => x / sum);
  });
  for (let r = 0; r < TOK; r++)
    for (let c = 0; c < TOK; c++) {
      const n = r * TOK + c;
      Object.assign(heat.t[n], { x: heatOrigin.x + (c - 2.5) * 5, y: heatOrigin.y - (r - 2.5) * 5, z: heatOrigin.z, g: 0 });
      heat.color(n, new THREE.Color('#eef4fb').lerp(C.blue, Math.min(1, rowsW[r][c] * 2.2)));
    }
  const flyV = new Tiles(TOK);
  flyV.unit = 6;
  for (let i = 0; i < TOK; i++) flyV.char(i, 'V').color(i, QKV_COL[2]);
  const yTile = new Tiles(1);
  yTile.unit = 8;
  yTile.char(0, 'Y').color(0, '#ffd21f');
  const yPos = () => tokPos(Q).add(new THREE.Vector3(0, 36, 0));
  Object.assign(yTile.t[0], { ...yPos() });
  const attnLinks = new Links();
  root.add(tokens.group, qkv.group, heat.group, flyV.group, yTile.group, attnLinks.group);
  net.onFrame((_, t) => {
    tokens.update(t);
    qkv.update();
    heat.update();
    flyV.update();
    yTile.update();
  });

  for (let i = 0; i < TOK; i++)
    pins.add(`at-w${i}`, {
      anchor: () => wp(tokPos(i).add(new THREE.Vector3(0, -4.4, 0))),
      html: i === Q ? '<b>موقعیت فعلی</b>' : faNum(W[i]),
      cls: i === Q ? 'pin-flag' : 'pin-num',
      align: 'below',
      dy: i === Q ? 3.4 : 0,
    });
  pins
    .add('at-X', { anchor: () => wp(tokPos(0).add(new THREE.Vector3(-5, 0, 0))), html: tex('X'), cls: 'pin-tex', align: 'right' })
    .add('at-A', { anchor: () => wp(heatOrigin.clone().add(new THREE.Vector3(0, 16, 0))), html: tex('A'), cls: 'pin-tex', align: 'above' })
    .add('at-row', { anchor: () => wp(heatOrigin.clone().add(new THREE.Vector3(-16.5, (2.5 - Q) * 5, 0))), html: 'موقعیت فعلی', cls: 'pin-word', align: 'right' })
    .add('at-Y', { anchor: () => wp(yPos().add(new THREE.Vector3(3.4, 0, 0))), html: tex('Y = AV'), cls: 'pin-tex pin-call', align: 'left' });

  const qWeights = (delay = 0.6) =>
    attnLinks
      .set(
        [...Array(TOK).keys()]
          .filter((i) => i !== Q)
          .map((i) => ({
            a: tokPos(Q).add(new THREE.Vector3(0, 2.6, 0)),
            b: tokPos(i).add(new THREE.Vector3(0, 2.6, 0)),
            w: W[i] * 2.2,
            bend: new THREE.Vector3(0, 5 + Math.abs(i - Q) * 3, 4),
            color: C.blue,
            arrow: true,
            r: 0.28,
          })),
      )
      .show(true, { delay, stagger: 0.12 });

  const elAt = section(
    overlay,
    's-net s-attn',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${attention.num} <span class="n-kick">${attention.section}</span></p>
      <h2 class="n-title ltr-mix">${attention.title}</h2>
      <div class="swap">
        <div data-s="0-0"><p class="n-body n-strong">${attention.def}</p></div>
        <div data-s="1-1">
          <p class="n-body">${attention.qkvLead}</p>
          <div class="n-tex">${tex(attention.qkvTex, true)}</div>
          <ul class="n-terms n-qkv">${attention.terms.map(([s, en, d], i) => `<li style="--c:${QKV_COL[i]}">${tex(s)}<span><b class="ltr">${en}</b>؛ ${d}</span></li>`).join('')}</ul>
        </div>
        <div data-s="2-2"><p class="n-body">${attention.scoreLead}</p><div class="n-tex n-tex-big">${tex(attention.scoreTex, true)}</div></div>
        <div data-s="3-3"><p class="n-body">${attention.outLead}</p><div class="n-tex n-tex-big">${tex(attention.outTex, true)}</div></div>
      </div>
    </div>`,
  );

  const attnSteps = [
    () => {
      tokens.show(true, 0.4);
      [qkv, heat, flyV, yTile].forEach((t) => tilesIn(t, false));
      qWeights(1);
      pins.show([...Array(TOK).keys()].map((i) => `at-w${i}`).concat('at-X'), true, 1.2, 0.08);
      pins.show(['at-A', 'at-row', 'at-Y'], false);
    },
    () => {
      tokens.show(true);
      attnLinks.show(false);
      pins.hide('at-w');
      pins.show([`at-w${Q}`, 'at-X'], true);
      tilesIn(qkv, true, { delay: 0.3, amount: 1 });
      [heat, flyV, yTile].forEach((t) => tilesIn(t, false));
      pins.show(['at-A', 'at-row', 'at-Y'], false);
    },
    () => {
      tokens.show(true);
      tilesIn(qkv, true, { amount: 0.2 });
      attnLinks.show(false);
      pins.show([...Array(TOK).keys()].map((i) => `at-w${i}`), true, 0.8, 0.06);
      tilesIn(heat, true, { delay: 0.4, amount: 1.2 });
      pins.show(['at-A', 'at-row'], true, 1.2, 0.2);
      tilesIn(flyV, false);
      tilesIn(yTile, false);
      pins.show('at-Y', false);
    },
    () => {
      // Every value travels to the current position, weighted by its attention.
      const target = yPos();
      for (let i = 0; i < TOK; i++) {
        const from = qkv.t[i * 3 + 2];
        const t = flyV.t[i];
        gsap.killTweensOf(t);
        gsap.set(t, { x: from.x, y: from.y, z: from.z + 0.4, s: flyV.unit });
        gsap.to(t, { x: target.x, y: target.y, z: target.z, s: flyV.unit * (0.4 + W[i] * 2), duration: 1.4, delay: 0.3 + i * 0.12, ease: 'power2.inOut' });
        gsap.to(t, { s: 0, duration: 0.3, delay: 1.7 + i * 0.12 });
      }
      gsap.killTweensOf(yTile.t);
      gsap.fromTo(yTile.t[0], { s: 0 }, { s: yTile.unit, duration: 0.7, delay: 2.2, ease: 'back.out(2)' });
      pins.show('at-Y', true, 2.6);
    },
  ];

  const sAttn: Scene = {
    id: 'net-attention',
    label: attention.title,
    head,
    steps: 4,
    enter(step) {
      net.enter('dock', { focus: ATTENTION });
      open(elAt);
      gsap.fromTo($('.w-num', elAt), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      gsap.fromTo($('.n-title', elAt), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.3 });
      stepVis(elAt, step, 0.6);
      attnSteps[step === 3 ? 2 : step]();
      if (step === 3) attnSteps[3]();
    },
    step(step) {
      stepVis(elAt, step);
      attnSteps[step]();
    },
    leave() {
      close(elAt);
      stepReset(elAt);
      hideAttn();
    },
  };
  function hideAttn() {
    tokens.show(false);
    [qkv, heat, flyV, yTile].forEach((t) => tilesIn(t, false));
    attnLinks.show(false);
    pins.hide('at-');
  }
  net.onHide(hideAttn);

  // =========================================================================================
  // ۲-۱-۱ / ۲-۱-۲ Row-wise and column-wise attention over an MSA.
  // =========================================================================================
  // Positions 20 and 80 co-vary (K…D / E…R); position 50 is mostly cysteine — the PDF's examples.
  const COLS: (number | null)[] = [18, 19, 20, 21, null, 49, 50, 51, null, 79, 80, 81, 82];
  const ROWS = ['LVKA…FCA…PDRA', 'LVKS…FCA…HDKS', 'IVEA…YSA…PRRA', 'LIEA…FCS…ARKS', 'LVKS…FCA…PDKA'];
  const RC = COLS.length;
  const RR = ROWS.length;
  const msaT = new Tiles(RR * RC);
  msaT.unit = 8.2;
  const msaOrigin = at(57, 31, 4);
  const PITCH = 8;
  const cellPos = (r: number, c: number) => new THREE.Vector3(msaOrigin.x + (c - (RC - 1) / 2) * PITCH, msaOrigin.y - (r - (RR - 1) / 2) * PITCH, msaOrigin.z);
  ROWS.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const n = r * RC + c;
      Object.assign(msaT.t[n], { ...cellPos(r, c) });
      msaT.char(n, ch);
    }),
  );
  const rcLinks = new Links();
  root.add(msaT.group, rcLinks.group);
  net.onFrame(() => msaT.update());
  COLS.forEach((c, i) => {
    if (c !== null)
      pins.add(`rc-c${i}`, { anchor: () => root.localToWorld(cellPos(0, i).add(new THREE.Vector3(0, 5.6, 0))), html: fa(c), cls: 'pin-num', align: 'above' });
  });
  ROWS.forEach((_, r) =>
    pins.add(`rc-r${r}`, { anchor: () => root.localToWorld(cellPos(r, 0).add(new THREE.Vector3(-5.6, 0, 0))), html: `Seq ${r + 1}`, cls: 'pin-seq', align: 'right' }),
  );
  const c20 = COLS.indexOf(20);
  const c80 = COLS.indexOf(80);
  const c50 = COLS.indexOf(50);
  const ROW = 2;
  const PALE = new THREE.Color('#eef2f6');

  const elRc = section(
    overlay,
    's-net s-rc',
    /* html */ `
    <div class="n-panel">
      <div class="swap">
        <div data-s="0-0">
          <p class="w-num">${rowcol.row.num}</p>
          <h2 class="n-title n-title-sm ltr-mix">${rowcol.row.title}</h2>
          <p class="n-body n-strong">${rowcol.row.body}</p>
          <p class="n-body">${rowcol.row.example}</p>
        </div>
        <div data-s="1-1">
          <p class="w-num">${rowcol.col.num}</p>
          <h2 class="n-title n-title-sm ltr-mix">${rowcol.col.title}</h2>
          <p class="n-body n-strong">${rowcol.col.body}</p>
          <p class="n-body">${rowcol.col.example}</p>
        </div>
      </div>
    </div>`,
  );

  /** Lift and colour the selected cells; the rest of the alignment pales. */
  const setMsaFocus = (sel: (r: number, c: number) => boolean, delay = 0) => {
    for (let r = 0; r < RR; r++)
      for (let c = 0; c < RC; c++) {
        const n = r * RC + c;
        const gap = COLS[c] === null;
        const on = !gap && sel(r, c);
        gsap.to(msaT.t[n], {
          lift: on ? 2.5 : 0,
          s: gap ? msaT.unit * 0.6 : on ? msaT.unit * 1.06 : msaT.unit * 0.86,
          duration: 0.7,
          delay: delay + c * 0.03,
          ease: 'back.out(1.6)',
          overwrite: 'auto',
        });
        msaT.inkColor(n, gap ? '#8a9bb0' : on ? '#0b1f3a' : '#7f90a6');
        msaT.color(n, gap ? '#ffffff' : on ? residueColor(ROWS[r][c]) : residueColor(ROWS[r][c]).lerp(PALE, 0.7));
      }
  };

  const rcSteps = [
    (delay = 0) => {
      setMsaFocus((r) => r === ROW, delay);
      board.focus(['row']);
      lensOn(['row'], [8, 9, 88, 45]);
      rcLinks
        .set(
          COLS.map((c, i) => ({ c, i }))
            .filter(({ c, i }) => c !== null && i !== c20)
            .map(({ i }) => ({
              a: cellPos(ROW, c20).add(new THREE.Vector3(0, 2, 3)),
              b: cellPos(ROW, i).add(new THREE.Vector3(0, 2, 3)),
              w: i === c80 ? 1.2 : 0.18,
              bend: new THREE.Vector3(0, 5 + Math.abs(i - c20) * 1.3, 6),
              color: i === c80 ? '#c4122f' : C.blue,
              arrow: true,
              r: 0.26,
            })),
        )
        .show(true, { delay: delay + 0.8, stagger: 0.06 });
    },
    (delay = 0) => {
      setMsaFocus((_, c) => c === c50, delay);
      board.focus(['col']);
      lensOn(['col'], [8, 9, 88, 45]);
      rcLinks
        .set(
          [1, 2, 3, 4].map((r) => ({
            a: cellPos(0, c50).add(new THREE.Vector3(3, 0, 3)),
            b: cellPos(r, c50).add(new THREE.Vector3(3, 0, 3)),
            w: ROWS[r][c50] === 'C' ? 0.45 : 1.1,
            bend: new THREE.Vector3(5 + r * 3, 0, 6),
            color: ROWS[r][c50] === 'C' ? C.blue : '#c4122f',
            arrow: true,
            r: 0.26,
          })),
        )
        .show(true, { delay: delay + 0.8, stagger: 0.12 });
    },
  ];

  const sRc: Scene = {
    id: 'net-rowcol',
    label: 'Row-wise / Column-wise Attention',
    head,
    steps: 2,
    enter(step) {
      net.enter('dock');
      open(elRc);
      stepVis(elRc, step, 0.4);
      msaT.t.forEach((t) => (t.s = 0));
      rcSteps[step](0.5);
      pins.show(COLS.flatMap((c, i) => (c === null ? [] : [`rc-c${i}`])), true, 1.2, 0.04);
      pins.show(ROWS.map((_, r) => `rc-r${r}`), true, 1.2, 0.06);
    },
    step(step) {
      stepVis(elRc, step);
      rcSteps[step]();
    },
    leave() {
      close(elRc);
      stepReset(elRc);
      hideRc();
    },
  };
  function hideRc() {
    tilesIn(msaT, false);
    rcLinks.show(false);
    pins.hide('rc-');
  }
  net.onHide(hideRc);

  // =========================================================================================
  // ۲-۲ Transition: a small feed-forward network per position; residual joins everywhere.
  // =========================================================================================
  const FIN = 6;
  const FHID = 12;
  const ff = new Tiles(FIN * 2 + FHID, { size: 0.9, depth: 0.5 });
  ff.unit = 4.6;
  const ffOrigin = at(48, 31, 4);
  const ffPos = (layer: number, i: number) => {
    const n = layer === 1 ? FHID : FIN;
    return new THREE.Vector3(ffOrigin.x + (layer - 1) * 44, ffOrigin.y + ((n - 1) / 2 - i) * 4.6, ffOrigin.z);
  };
  const ffIndex: [number, number][] = [];
  for (let i = 0; i < FIN; i++) ffIndex.push([0, i]);
  for (let i = 0; i < FHID; i++) ffIndex.push([1, i]);
  for (let i = 0; i < FIN; i++) ffIndex.push([2, i]);
  const IN_HUES = ['#f7ab90', '#f48a6c', '#fbd5c5', '#f26a4e', '#fde6dc', '#f9c2ad'];
  ffIndex.forEach(([l, i], n) => {
    Object.assign(ff.t[n], { ...ffPos(l, i), g: 0 });
    ff.color(n, l === 1 ? spectrum(0.05 + Math.random() * 0.3) : new THREE.Color(IN_HUES[(i + l) % IN_HUES.length]));
  });
  const ffLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(
      (() => {
        const pts: THREE.Vector3[] = [];
        for (let a = 0; a < FIN; a++) for (let b = 0; b < FHID; b++) pts.push(ffPos(0, a), ffPos(1, b));
        for (let a = 0; a < FHID; a++) for (let b = 0; b < FIN; b++) pts.push(ffPos(1, a), ffPos(2, b));
        return pts;
      })(),
    ),
    new THREE.LineBasicMaterial({ color: '#8fa3b8', transparent: true, opacity: 0 }),
  );
  // Residual: x skips around f and joins at a (+).
  const resLinks = new Links();
  const plusNode = new THREE.Group();
  {
    const ink = new THREE.MeshBasicMaterial({ color: '#1f43a6' });
    plusNode.add(
      new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' })),
      new THREE.Mesh(new THREE.TorusGeometry(3, 0.45, 10, 40), ink),
      new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 0.3), ink),
      new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.6, 0.3), ink),
    );
    plusNode.position.copy(ffPos(2, 0).add(new THREE.Vector3(18, -(FIN - 1) * 2.3, 0)));
    plusNode.scale.setScalar(0.001);
    plusNode.visible = false;
  }
  root.add(ff.group, ffLines, resLinks.group, plusNode);
  net.onFrame(() => ff.update());
  pins
    .add('tr-x', { anchor: () => root.localToWorld(ffPos(0, FIN - 1).add(new THREE.Vector3(0, -4.4, 0))), html: 'ویژگی‌های یک موقعیت', cls: 'pin-word', align: 'below' })
    .add('tr-h', { anchor: () => root.localToWorld(ffPos(1, FHID - 1).add(new THREE.Vector3(0, -4.4, 0))), html: 'شبکه‌ی پیش‌خور، تبدیل غیرخطی', cls: 'pin-word', align: 'below' })
    .add('tr-y', { anchor: () => root.localToWorld(ffPos(2, FIN - 1).add(new THREE.Vector3(0, -4.4, 0))), html: 'نمایش به‌روزشده', cls: 'pin-word', align: 'below' })
    .add('tr-res', { anchor: () => root.localToWorld(plusNode.position.clone().add(new THREE.Vector3(0, -4.4, 0))), html: tex('x + f(x)'), cls: 'pin-tex pin-call', align: 'below' })
    .add('tr-skip', { anchor: () => root.localToWorld(ffPos(1, 0).add(new THREE.Vector3(0, 9, 0))), html: '<b class="ltr">residual connection</b>', cls: 'pin-flag', align: 'above' });

  const elTr = section(
    overlay,
    's-net s-tr',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${transition.num}</p>
      <h2 class="n-title split">${transition.title}</h2>
      <div class="swap">
        <div data-s="0-0"><p class="n-body n-strong">${transition.body}</p></div>
        <div data-s="1-1"><p class="n-body n-strong">${transition.residual}</p></div>
        <div data-s="2-2"><p class="n-body n-strong">${transition.chain}</p></div>
      </div>
    </div>`,
  );
  let loop: gsap.core.Timeline | gsap.core.Tween | undefined;
  const TRACE = ['m0', 'row', 'm1', 'p-row', 'm2', 'col', 'm3', 'p-col', 'm4', 'transM', 'm5', 'p-transM', 'opmIn', 'opm', 'opmOut', 'p-opm', 'p1', 'triOut', 'p2', 'p-triOut', 'p3', 'triIn', 'p4', 'p-triIn', 'p5', 'triStart', 'p6', 'p-triStart', 'p7', 'triEnd', 'p8', 'p-triEnd', 'p9', 'transP', 'p10', 'p-transP', 'p11'];
  const traceLoop = () => {
    loop?.kill();
    const tl = board.trace(TRACE, { step: 0.24, delay: 0.6 });
    tl.eventCallback('onComplete', () => void (loop = gsap.delayedCall(1.2, traceLoop)));
    loop = tl;
  };
  const showFF = (on: boolean, delay = 0) => {
    tilesIn(ff, on, { delay, amount: 1.2 });
    gsap.to(ffLines.material, { opacity: on ? 0.35 : 0, duration: on ? 1 : 0.3, delay: on ? delay + 0.6 : 0 });
  };
  const showRes = (on: boolean) => {
    if (!on) {
      resLinks.show(false);
      gsap.to(plusNode.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, onComplete: () => void (plusNode.visible = false) });
      pins.show(['tr-res', 'tr-skip'], false);
      return;
    }
    const a = ffPos(0, 0).add(new THREE.Vector3(0, 2.4, 2));
    const b = plusNode.position.clone().add(new THREE.Vector3(0, 3, 0));
    const o = ffPos(2, 0).add(new THREE.Vector3(3.2, -(FIN - 1) * 2.3, 1));
    resLinks
      .set([
        { a, b, w: 0.9, bend: new THREE.Vector3(0, 20, 4), color: '#1f43a6', arrow: true, r: 0.32 },
        { a: o, b: plusNode.position.clone().add(new THREE.Vector3(-3, 0, 0)), w: 0.9, bend: new THREE.Vector3(0, 0, 0), color: '#1f43a6', arrow: true, r: 0.32 },
      ])
      .show(true, { delay: 0.6, stagger: 0.3 });
    plusNode.visible = true;
    gsap.to(plusNode.scale, { x: 1, y: 1, z: 1, duration: 0.8, delay: 1.2, ease: 'back.out(2)' });
    pins.show(['tr-res', 'tr-skip'], true, 1.6, 0.2);
  };
  const trSteps = [
    () => {
      loop?.kill();
      net.dock('dock');
      board.focus(['transM', 'transP']);
      board.flow(false);
      lensOn(['transM'], [8, 9, 96, 45]);
      showFF(true, 0.6);
      showRes(false);
      pins.show(['tr-x', 'tr-h', 'tr-y'], true, 1.4, 0.2);
    },
    () => {
      loop?.kill();
      net.dock('dock');
      board.focus([...RESIDUALS, ...PLUS], { dim: 0.6 });
      board.flow(true, RESIDUALS);
      lensOn(['transM'], [8, 9, 96, 45]);
      showFF(true);
      showRes(true);
      pins.show(['tr-x', 'tr-h', 'tr-y'], true);
    },
    () => {
      lens.show(false);
      showFF(false);
      showRes(false);
      pins.hide('tr-');
      board.focus(null);
      board.flow(false);
      net.dock('figure');
      traceLoop();
    },
  ];
  const sTr: Scene = {
    id: 'net-transition',
    label: transition.title,
    head,
    steps: 3,
    enter(step) {
      net.enter(step === 2 ? 'figure' : 'dock');
      open(elTr);
      words($('.n-title', elTr), 0.3, 0.06);
      gsap.fromTo($('.w-num', elTr), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elTr, step, 0.6);
      trSteps[step]();
    },
    step(step) {
      stepVis(elTr, step);
      trSteps[step]();
    },
    leave() {
      close(elTr);
      stepReset(elTr);
      hideTr();
    },
  };
  function hideTr() {
    loop?.kill();
    showFF(false);
    showRes(false);
    pins.hide('tr-');
  }
  net.onHide(hideTr);

  // =========================================================================================
  // ۲-۳ Outer product mean: columns i and j of the MSA become one pair feature z_ij.
  // =========================================================================================
  const S = 5;
  const OC = 7;
  const OI = 1;
  const OJ = 5;
  const D = 4;
  const om = new Tiles(S * OC);
  om.unit = 6.2;
  const omOrigin = at(20, 31, 4);
  const omPos = (r: number, c: number) => new THREE.Vector3(omOrigin.x + (c - (OC - 1) / 2) * 6, omOrigin.y - (r - (S - 1) / 2) * 6, omOrigin.z);
  const omRows = ['MKLCATQ', 'MRLCGSQ', 'IKVSATE', 'MRLCGTQ', 'LKICASE'];
  omRows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const n = r * OC + c;
      Object.assign(om.t[n], { ...omPos(r, c), d: 1 });
      om.char(n, ch).color(n, residueColor(ch));
    }),
  );
  // Per sequence: f(m_si) (a column) ⊗ g(m_sj) (a row) = a D×D sheet.
  const vals = Array.from({ length: S }, () => ({ f: Array.from({ length: D }, () => Math.random()), g: Array.from({ length: D }, () => Math.random()) }));
  const sheets = new Tiles(S * D * D, { size: 0.92, depth: 0.25 });
  sheets.unit = 4.2;
  const sheetOrigin = at(52, 33, 4);
  const sheetPos = (s: number, a: number, b: number) =>
    new THREE.Vector3(sheetOrigin.x + (b - (D - 1) / 2) * 4.2 + s * 3, sheetOrigin.y + ((D - 1) / 2 - a) * 4.2 + s * 3, sheetOrigin.z - s * 7);
  for (let s = 0; s < S; s++)
    for (let a = 0; a < D; a++)
      for (let b = 0; b < D; b++) {
        const n = (s * D + a) * D + b;
        Object.assign(sheets.t[n], { ...sheetPos(s, a, b), g: 0 });
        sheets.color(n, new THREE.Color('#f6f8fb').lerp(new THREE.Color('#7a5bd6'), vals[s].f[a] * vals[s].g[b]));
      }
  const meanSheet = new Tiles(D * D, { size: 0.92, depth: 0.3 });
  meanSheet.unit = 4.2;
  for (let a = 0; a < D; a++)
    for (let b = 0; b < D; b++) {
      const n = a * D + b;
      let m = 0;
      for (let s = 0; s < S; s++) m += vals[s].f[a] * vals[s].g[b];
      Object.assign(meanSheet.t[n], { ...sheetPos(0, a, b), g: 0 });
      meanSheet.color(n, new THREE.Color('#f6f8fb').lerp(new THREE.Color('#7a5bd6'), (m / S) * 1.8));
    }
  const PZ = 8;
  const pz = new Tiles(PZ * PZ, { size: 0.9, depth: 0.4 });
  pz.unit = 3.8;
  const pzOrigin = at(80, 31, 4);
  const pzPos = (r: number, c: number) => new THREE.Vector3(pzOrigin.x + (c - (PZ - 1) / 2) * 3.8, pzOrigin.y - (r - (PZ - 1) / 2) * 3.8, pzOrigin.z);
  for (let r = 0; r < PZ; r++)
    for (let c = 0; c < PZ; c++) {
      const n = r * PZ + c;
      Object.assign(pz.t[n], { ...pzPos(r, c), g: 0 });
      pz.color(n, ['#cfe4f4', '#9ccbec', '#e4f0fa', '#b5d8f1'][(r * 7 + c * 3) % 4]);
    }
  const zCell = OI * PZ + OJ;
  const omLinks = new Links();
  root.add(om.group, sheets.group, meanSheet.group, pz.group, omLinks.group);
  net.onFrame(() => {
    om.update();
    sheets.update();
    meanSheet.update();
    pz.update();
  });
  pins
    .add('om-i', { anchor: () => root.localToWorld(omPos(0, OI).add(new THREE.Vector3(0, 5, 0))), html: tex('i'), cls: 'pin-tex pin-col-i', align: 'above' })
    .add('om-j', { anchor: () => root.localToWorld(omPos(0, OJ).add(new THREE.Vector3(0, 5, 0))), html: tex('j'), cls: 'pin-tex pin-col-j', align: 'above' })
    .add('om-s', { anchor: () => root.localToWorld(omPos(0, 0).add(new THREE.Vector3(-5, 0, 0))), html: tex('s'), cls: 'pin-tex', align: 'right' })
    .add('om-outer', { anchor: () => root.localToWorld(sheetPos(S - 1, 0, D - 1).add(new THREE.Vector3(2, 3, 0))), html: tex('f(m_{si}) \\otimes g(m_{sj})'), cls: 'pin-tex', align: 'above' })
    .add('om-mean', { anchor: () => root.localToWorld(sheetPos(0, D - 1, 1.5).add(new THREE.Vector3(0, -3.5, 0))), html: tex('\\operatorname{Mean}_s'), cls: 'pin-tex pin-call', align: 'below' })
    .add('om-z', { anchor: () => root.localToWorld(pzPos(OI, OJ).add(new THREE.Vector3(0, 3, 6))), html: tex('z_{ij}'), cls: 'pin-tex pin-call', align: 'above' })
    .add('om-pair', { anchor: () => root.localToWorld(pzPos(PZ - 1, 3.5).add(new THREE.Vector3(0, -3, 0))), html: 'Pair representation', cls: 'pin-term c-pair', align: 'below' })
    .add('om-msa', { anchor: () => root.localToWorld(omPos(S - 1, 3).add(new THREE.Vector3(0, -4.4, 0))), html: 'MSA', cls: 'pin-term c-evo', align: 'below' });

  const elOm = section(
    overlay,
    's-net s-om',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${opm.num}</p>
      <h2 class="n-title split">${opm.title}</h2>
      <p class="n-sub2">(${opm.sub})</p>
      <div class="swap">
        <div data-s="0-0"><p class="n-body n-strong">${opm.body}</p></div>
        <div data-s="1-1"><p class="n-body">${rich(opm.example)}</p></div>
        <div data-s="2">
          <p class="n-body om-schem">${opm.schematic}</p>
          <div class="n-tex">${tex(opm.tex, true)}</div>
          <ul class="n-terms n-terms-sm" data-s="3">${opm.terms.map(([t, d]) => `<li>${tex(t)}<span>${rich(d)}</span></li>`).join('')}</ul>
        </div>
      </div>
    </div>`,
  );
  const colFocus = (on: boolean) => {
    for (let r = 0; r < S; r++)
      for (let c = 0; c < OC; c++) {
        const n = r * OC + c;
        const sel = c === OI || c === OJ;
        gsap.to(om.t[n], { lift: on && sel ? 2 : 0, s: on && !sel ? om.unit * 0.82 : om.unit * 0.94, duration: 0.6, overwrite: 'auto' });
        om.color(n, on && sel ? (c === OI ? '#65cbf3' : '#ffb38a') : on ? '#eef2f6' : residueColor(omRows[r][c]));
      }
  };
  const omSteps = [
    () => {
      board.focus(['opm', 'opmIn', 'opmOut', 'p-opm']);
      board.flow(true, ['opmIn', 'opmOut']);
      lensOn(['opm'], [6, 9, 86, 45]);
      tilesIn(om, true, { delay: 0.6, amount: 0.8 });
      colFocus(false);
      tilesIn(sheets, false);
      tilesIn(meanSheet, false);
      tilesIn(pz, true, { delay: 1, amount: 0.8 });
      gsap.to(pz.t[zCell], { lift: 0, duration: 0.3 });
      omLinks.show(false);
      pins.show(['om-msa', 'om-pair'], true, 1.4, 0.2);
      pins.show(['om-i', 'om-j', 'om-s', 'om-outer', 'om-mean', 'om-z'], false);
    },
    () => {
      colFocus(true);
      tilesIn(sheets, true, { delay: 0.8, amount: 2 });
      sheets.t.forEach((t, n) => {
        const s = Math.floor(n / (D * D));
        const a = Math.floor((n % (D * D)) / D);
        const b = n % D;
        const p = sheetPos(s, a, b);
        gsap.to(t, { x: p.x, y: p.y, z: p.z, duration: 0.6 });
      });
      tilesIn(meanSheet, false);
      gsap.to(pz.t[zCell], { lift: 0, duration: 0.3 });
      pz.color(zCell, '#cfe4f4');
      omLinks
        .set([
          { a: omPos(0, OI).add(new THREE.Vector3(0, 2.5, 2)), b: sheetPos(S - 1, 0, 0).add(new THREE.Vector3(-2, 2, 0)), w: 0.6, color: '#1f8fc2', arrow: true, r: 0.25 },
          { a: omPos(0, OJ).add(new THREE.Vector3(0, 2.5, 2)), b: sheetPos(S - 1, 0, D - 1).add(new THREE.Vector3(0, 3, 0)), w: 0.6, color: '#e0612f', arrow: true, r: 0.25 },
        ])
        .show(true, { delay: 0.6, stagger: 0.2 });
      pins.show(['om-i', 'om-j', 'om-s', 'om-outer'], true, 0.8, 0.12);
      pins.show(['om-mean', 'om-z'], false);
    },
    () => {
      // Average over sequences, then add into the pair cell (i, j).
      sheets.t.forEach((t, n) => {
        const a = Math.floor((n % (D * D)) / D);
        const b = n % D;
        const p = sheetPos(0, a, b);
        gsap.to(t, { x: p.x, y: p.y, z: p.z, duration: 1.2, ease: 'power3.inOut' });
      });
      gsap.to(sheets.t, { s: 0, duration: 0.3, delay: 1.2 });
      tilesIn(meanSheet, true, { delay: 1.2, amount: 0.3 });
      omLinks
        .set([{ a: sheetPos(0, 1.5, D - 1).add(new THREE.Vector3(3, 0, 1)), b: pzPos(OI, OJ).add(new THREE.Vector3(0, 0, 2)), w: 1, bend: new THREE.Vector3(0, 10, 4), color: '#7a5bd6', arrow: true, r: 0.32 }])
        .show(true, { delay: 1.8 });
      gsap.to(pz.t[zCell], { lift: 3.5, duration: 0.8, delay: 2.2, ease: 'back.out(2)' });
      gsap.delayedCall(2.2, () => pz.color(zCell, '#ffd21f'));
      pins.show(['om-mean', 'om-z'], true, 1.8, 0.4);
      pins.show('om-outer', false);
    },
  ];
  const sOm: Scene = {
    id: 'net-opm',
    label: opm.title,
    head,
    steps: 4,
    enter(step) {
      net.enter('dock');
      open(elOm);
      words($('.n-title', elOm), 0.3, 0.06);
      gsap.fromTo($('.w-num', elOm), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elOm, step, 0.6);
      omSteps[0]();
      for (let s = 1; s <= Math.min(step, 2); s++) omSteps[s]();
    },
    step(step, dir) {
      stepVis(elOm, step);
      if (step === 3) return;
      if (dir < 0) omSteps[0]();
      for (let s = dir < 0 ? 1 : step; s <= step; s++) omSteps[s]();
    },
    leave() {
      close(elOm);
      stepReset(elOm);
      hideOm();
    },
  };
  function hideOm() {
    [om, sheets, meanSheet, pz].forEach((t) => tilesIn(t, false));
    omLinks.show(false);
    pins.hide('om-');
  }
  net.onHide(hideOm);

  // =========================================================================================
  // ۲-۴ Triangle updates: three residues, three pair relations that must agree.
  // =========================================================================================
  const triOrigin = at(34, 31, 8);
  const NODE: Record<string, THREE.Vector3> = {
    i: triOrigin.clone().add(new THREE.Vector3(-23, -13, 0)),
    j: triOrigin.clone().add(new THREE.Vector3(23, -13, 0)),
    k: triOrigin.clone().add(new THREE.Vector3(0, 20, 0)),
    k1: triOrigin.clone().add(new THREE.Vector3(-30, 17, -4)),
    k2: triOrigin.clone().add(new THREE.Vector3(30, 17, -4)),
    k3: triOrigin.clone().add(new THREE.Vector3(0, -30, 2)),
  };
  const NODE_COL: Record<string, string> = { i: '#0053d6', j: '#ff7d45', k: '#d99a00', k1: '#d99a00', k2: '#d99a00', k3: '#d99a00' };
  const nodes = new THREE.Group();
  const nodeMeshes: Record<string, THREE.Mesh> = {};
  for (const [id, p] of Object.entries(NODE)) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 20), new THREE.MeshPhysicalMaterial({ color: NODE_COL[id], roughness: 0.28, clearcoat: 1 }));
    m.position.copy(p);
    m.scale.setScalar(0.001);
    m.visible = false;
    nodes.add(m);
    nodeMeshes[id] = m;
  }
  const edgeIJ = new Links();
  const triLinks = new Links();
  root.add(nodes, edgeIJ.group, triLinks.group);
  // The pair matrix with the cells for (i,j), (i,k), (j,k).
  const L6 = 6;
  const IDX: Record<string, number> = { i: 1, j: 4, k: 2, k1: 0, k2: 3, k3: 5 };
  const tm = new Tiles(L6 * L6, { size: 0.9, depth: 0.4 });
  tm.unit = 5.4;
  const tmOrigin = at(82, 31, 4);
  const tmPos = (r: number, c: number) => new THREE.Vector3(tmOrigin.x + (c - (L6 - 1) / 2) * 5.6, tmOrigin.y - (r - (L6 - 1) / 2) * 5.6, tmOrigin.z);
  for (let r = 0; r < L6; r++)
    for (let c = 0; c < L6; c++) {
      const n = r * L6 + c;
      Object.assign(tm.t[n], { ...tmPos(r, c), g: 0 });
    }
  root.add(tm.group);
  net.onFrame(() => tm.update());
  const tmPaint = (cells: [number, number, string][]) => {
    for (let n = 0; n < tm.n; n++) tm.color(n, '#e4eef8');
    tm.t.forEach((t) => gsap.to(t, { lift: 0, duration: 0.4, overwrite: 'auto' }));
    cells.forEach(([r, c, col]) => {
      tm.color(r * L6 + c, col);
      gsap.to(tm.t[r * L6 + c], { lift: 2, duration: 0.6, ease: 'back.out(2)', overwrite: 'auto' });
    });
  };
  const nodePin = (id: string) => pins.add(`tri-n-${id}`, { anchor: () => root.localToWorld(NODE[id].clone().add(new THREE.Vector3(0, 0, 3))), html: tex(id.replace(/k(\d)/, 'k_$1')), cls: 'pin-tex pin-node' });
  Object.keys(NODE).forEach(nodePin);
  for (let c = 0; c < L6; c++) {
    const name = Object.keys(IDX).find((k) => IDX[k] === c)!;
    pins.add(`tri-c${c}`, { anchor: () => root.localToWorld(tmPos(0, c).add(new THREE.Vector3(0, 4.4, 0))), html: tex(name.replace(/k(\d)/, 'k_$1')), cls: 'pin-tex pin-small', align: 'above' });
    pins.add(`tri-r${c}`, { anchor: () => root.localToWorld(tmPos(c, 0).add(new THREE.Vector3(-4.4, 0, 0))), html: tex(name.replace(/k(\d)/, 'k_$1')), cls: 'pin-tex pin-small', align: 'right' });
  }
  pins.add('tri-bad', { anchor: () => root.localToWorld(triOrigin.clone().add(new THREE.Vector3(0, -15, 0))), html: '<b>ناسازگار با هندسه‌ی مثلث</b>', cls: 'pin-flag pin-alarm', align: 'below' });

  const showNodes = (ids: string[]) =>
    Object.entries(nodeMeshes).forEach(([id, m], n) => {
      const on = ids.includes(id);
      if (on) m.visible = true;
      gsap.to(m.scale, { x: on ? 1 : 0.001, y: on ? 1 : 0.001, z: on ? 1 : 0.001, duration: on ? 0.7 : 0.3, delay: on ? 0.2 + n * 0.08 : 0, ease: on ? 'back.out(2)' : 'power2.in', overwrite: true, onComplete: () => void (on || (m.visible = false)) });
      pins.show(`tri-n-${id}`, on, on ? 0.6 + n * 0.08 : 0);
    });
  const ij = () => edgeIJ.set([{ a: NODE.i, b: NODE.j, w: 1.1, bend: new THREE.Vector3(0, -3, 0), color: '#0b1f3a', arrow: true, r: 0.32 }]);
  const KS = ['k', 'k1', 'k2', 'k3'];

  const elTri = section(
    overlay,
    's-net s-tri',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${triangle.num}</p>
      <h2 class="n-title n-title-sm ltr-mix">${triangle.title}</h2>
      <div class="swap">
        <div data-s="0-1">
          <div class="swap swap-tight">
            <p class="n-body" data-s="0-0">${rich(triangle.lead)}</p>
            <p class="n-body n-strong" data-s="1-1">${triangle.consistency}</p>
          </div>
          <ul class="n-pairs">${triangle.pairs.map(([a, b]) => `<li>رابطه‌ی ${tex(a)} و ${tex(b)}</li>`).join('')}</ul>
        </div>
        <div data-s="2-3">
          <p class="n-body">${triangle.families}</p>
          <h3 class="n-sub"><b>${triangle.mult.label})</b> <span class="ltr">${triangle.mult.title}</span></h3>
          <p class="n-body">${rich(triangle.mult.body)}</p>
          <p class="n-body n-strong" data-s="3-3">${triangle.mult.incoming}</p>
        </div>
        <div data-s="4-5">
          <h3 class="n-sub"><b>${triangle.attn.label})</b> <span class="ltr">${triangle.attn.title}</span></h3>
          <p class="n-body">${triangle.attn.body}</p>
          <p class="n-body n-strong">${triangle.attn.kinds}</p>
          <div class="swap swap-tight">
            <p class="n-kind" data-s="4-4"><span class="ltr">around starting node</span> — رأس شروع: ${tex('i')}</p>
            <p class="n-kind" data-s="5-5"><span class="ltr">around ending node</span> — رأس پایان: ${tex('j')}</p>
          </div>
        </div>
      </div>
    </div>`,
  );

  const I = IDX.i;
  const J = IDX.j;
  const ks = KS.map((k) => IDX[k]);
  const triSteps = [
    () => {
      board.focus(['triOut', 'triIn', 'triStart', 'triEnd']);
      lens.show(false);
      showNodes(['i', 'j', 'k']);
      ij().show(true, { delay: 0.8 });
      triLinks
        .set([
          { a: NODE.i, b: NODE.k, w: 0.8, bend: new THREE.Vector3(-2, 0, 0), color: '#0053d6', r: 0.3 },
          { a: NODE.j, b: NODE.k, w: 0.8, bend: new THREE.Vector3(2, 0, 0), color: '#ff7d45', r: 0.3 },
        ])
        .show(true, { delay: 1, stagger: 0.2 });
      tilesIn(tm, true, { delay: 0.6, amount: 0.8 });
      tmPaint([
        [I, J, '#0b1f3a'],
        [I, IDX.k, '#0053d6'],
        [J, IDX.k, '#ff7d45'],
      ]);
      pins.show([...Array(L6).keys()].flatMap((c) => [`tri-c${c}`, `tri-r${c}`]), true, 1, 0.03);
    },
    () => {
      triSteps[0]();
      // Inconsistent geometry: i–j stretched beyond i–k + k–j breaks the triangle.
      triTl?.kill();
      const tl = (triTl = gsap.timeline({ delay: 1 }));
      tl.to(nodeMeshes.j.position, { x: NODE.j.x + 22, duration: 1.2, ease: 'power2.inOut', onUpdate: () => stretch() })
        .to(nodeMeshes.j.position, { x: NODE.j.x, duration: 1.2, delay: 1.4, ease: 'power2.inOut', onUpdate: () => stretch() })
        .add(() => restore());
      pins.show('tri-bad', true, 1 + 1.2);
      gsap.delayedCall(1 + 2.6, () => pins.show('tri-bad', false));
    },
    () => {
      board.focus(['triOut']);
      lensOn(['triOut'], [8, 9, 90, 45]);
      showNodes(['i', 'j', ...KS]);
      ij().show(true);
      triLinks
        .set(KS.flatMap((k) => [
          { a: NODE.i, b: NODE[k], w: 0.55, bend: new THREE.Vector3(0, 0, 3), color: '#0053d6', arrow: true, r: 0.24 },
          { a: NODE.j, b: NODE[k], w: 0.55, bend: new THREE.Vector3(0, 0, 3), color: '#ff7d45', arrow: true, r: 0.24 },
        ]))
        .show(true, { delay: 0.6, stagger: 0.08 });
      tmPaint([[I, J, '#0b1f3a'], ...ks.map((k): [number, number, string] => [I, k, '#0053d6']), ...ks.map((k): [number, number, string] => [J, k, '#ff7d45'])]);
    },
    () => {
      board.focus(['triIn']);
      lensOn(['triIn'], [8, 9, 90, 45]);
      showNodes(['i', 'j', ...KS]);
      ij().show(true);
      triLinks
        .set(KS.flatMap((k) => [
          { a: NODE[k], b: NODE.i, w: 0.55, bend: new THREE.Vector3(0, 0, 3), color: '#0053d6', arrow: true, r: 0.24 },
          { a: NODE[k], b: NODE.j, w: 0.55, bend: new THREE.Vector3(0, 0, 3), color: '#ff7d45', arrow: true, r: 0.24 },
        ]))
        .show(true, { delay: 0.6, stagger: 0.08 });
      tmPaint([[I, J, '#0b1f3a'], ...ks.map((k): [number, number, string] => [k, I, '#0053d6']), ...ks.map((k): [number, number, string] => [k, J, '#ff7d45'])]);
    },
    () => {
      board.focus(['triStart']);
      lensOn(['triStart'], [8, 9, 90, 45]);
      showNodes(['i', 'j', ...KS]);
      ij().show(true);
      const w = [0.9, 0.35, 0.6, 0.2];
      triLinks
        .set(KS.map((k, n) => ({ a: NODE.i, b: NODE[k], w: w[n], bend: new THREE.Vector3(0, 0, 3), color: '#0053d6', arrow: true, r: 0.26 })))
        .show(true, { delay: 0.6, stagger: 0.12 });
      tmPaint([[I, J, '#0b1f3a'], ...ks.map((k, n): [number, number, string] => [I, k, `#${new THREE.Color('#e4eef8').lerp(C.blue, 0.3 + w[n] * 0.7).getHexString()}`])]);
    },
    () => {
      board.focus(['triEnd']);
      lensOn(['triEnd'], [8, 9, 90, 45]);
      showNodes(['i', 'j', ...KS]);
      ij().show(true);
      const w = [0.3, 0.8, 0.25, 0.65];
      triLinks
        .set(KS.map((k, n) => ({ a: NODE[k], b: NODE.j, w: w[n], bend: new THREE.Vector3(0, 0, 3), color: '#ff7d45', arrow: true, r: 0.26 })))
        .show(true, { delay: 0.6, stagger: 0.12 });
      tmPaint([[I, J, '#0b1f3a'], ...ks.map((k, n): [number, number, string] => [k, J, `#${new THREE.Color('#e4eef8').lerp(new THREE.Color('#ff7d45'), 0.3 + w[n] * 0.7).getHexString()}`])]);
    },
  ];
  // While j is dragged away the i–j edge follows and turns red.
  function stretch() {
    const p = nodeMeshes.j.position;
    const long = p.distanceTo(NODE.i) > NODE.i.distanceTo(NODE.k) + NODE.k.distanceTo(p) - 6;
    edgeIJ.set([{ a: NODE.i, b: p.clone(), w: 1.1, bend: new THREE.Vector3(0, -3, 0), color: long ? '#c4122f' : '#0b1f3a', arrow: true, r: 0.32 }]).show(true, { opacity: 0.9, instant: true });
    triLinks.set([
      { a: NODE.i, b: NODE.k, w: 0.8, bend: new THREE.Vector3(-2, 0, 0), color: '#0053d6', r: 0.3 },
      { a: p.clone(), b: NODE.k, w: 0.8, bend: new THREE.Vector3(2, 0, 0), color: '#ff7d45', r: 0.3 },
    ]);
    triLinks.show(true, { opacity: 0.9, instant: true });
  }
  function restore() {
    nodeMeshes.j.position.copy(NODE.j);
  }

  let triTl: gsap.core.Timeline | undefined;
  const sTri: Scene = {
    id: 'net-triangle',
    label: 'Triangle Updates',
    head,
    steps: 6,
    enter(step) {
      net.enter('dock');
      open(elTri);
      gsap.fromTo($('.w-num', elTri), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elTri, step, 0.6);
      tilesIn(tm, true, { delay: 0.6 });
      pins.show([...Array(L6).keys()].flatMap((c) => ['tri-c' + c, 'tri-r' + c]), true, 1, 0.03);
      triSteps[step]();
    },
    step(step) {
      stepVis(elTri, step);
      triTl?.kill();
      gsap.killTweensOf(nodeMeshes.j.position);
      restore();
      pins.show('tri-bad', false);
      triSteps[step]();
    },
    leave() {
      close(elTri);
      stepReset(elTri);
      hideTri();
    },
  };
  function hideTri() {
    triTl?.kill();
    gsap.killTweensOf(nodeMeshes.j.position);
    restore();
    showNodes([]);
    edgeIJ.show(false);
    triLinks.show(false);
    tilesIn(tm, false);
    pins.hide('tri-');
  }
  net.onHide(hideTri);

  return [sEvo, sAttn, sRc, sTr, sOm, sTri];
}
