import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { bioinf, msa, msaInfo, fa } from '../../content';
import { GLOBINS } from '../../data/globins';
import { Links } from '../../three/links';
import { Tiles, residueColor } from '../../three/tiles';
import { ANCHOR, C, shot } from '../../three/world';
import { $, $$, words, open, close, section, stepVis, stepReset } from '../../ui/text';
import type { Ctx } from '../ctx';
import { at } from '../net/common';

// ۱-۵ Finding relatives: a query searched against a database (BLASTP, BLASTX, PSI-BLAST,
// HMMER), then the relatives it finds stacked into a multiple sequence alignment.

const AA = 'ACDEFGHIKLMNPQRSTVWY';
const CODON: Record<string, string> = {};
{
  const b = 'TCAG';
  const aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  let n = 0;
  for (const x of b) for (const y of b) for (const z of b) CODON[x + y + z] = aa[n++];
}
const translate = (dna: string) => {
  let out = '';
  for (let i = 0; i + 3 <= dna.length; i += 3) out += CODON[dna.slice(i, i + 3)];
  return out;
};
const revcomp = (dna: string) =>
  [...dna]
    .reverse()
    .map((c) => ({ A: 'T', T: 'A', G: 'C', C: 'G' })[c as 'A'])
    .join('');

// Human HBA1 coding sequence, first 12 codons: M V L S P A D K T N V K.
const DNA = 'ATGGTGCTGTCTCCTGCCGACAAGACCAACGTCAAG';
const NT_COL: Record<string, string> = { A: '#9fe0a8', C: '#9cc4f5', G: '#ffe07a', T: '#ffb59a' };

export function searchScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins } = ctx;
  const S = ANCHOR.search;
  const root = new THREE.Group();
  root.position.copy(S);
  world.scene.add(root);
  const SHOT = shot(S, { pz: 300 });
  const wp = (v: THREE.Vector3) => root.localToWorld(v.clone());
  const rows = GLOBINS.rows;
  const query = rows[0].seq; // human α

  // ---------------------------------------------------------------- query and database
  const QN = 22;
  const qTiles = new Tiles(QN);
  qTiles.unit = 4.8;
  const qPos = (i: number) => at(42 + (i - (QN - 1) / 2) * 2.8, 17, 12);
  for (let i = 0; i < QN; i++) {
    Object.assign(qTiles.t[i], { ...qPos(i) });
    qTiles.char(i, query[i]).color(i, residueColor(query[i]));
  }

  const DR = 16;
  const DC = 26;
  const db = new Tiles(DR * DC);
  db.unit = 3.9;
  const dbPos = (r: number, c: number) => at(40 + (c - (DC - 1) / 2) * 2.3, 33 + r * 3.55, -6);
  // Homologues hidden among random sequences: [db row, globin row, round found by PSI-BLAST].
  const HITS: [number, number, number][] = [
    [2, 1, 1],
    [5, 2, 1],
    [8, 3, 1],
    [11, 4, 2],
    [13, 5, 2],
    [6, 7, 2],
    [15, 8, 3],
  ];
  const hitRow = new Map(HITS.map(([r, g, k]) => [r, { g, k }]));
  const dbText: string[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < DR; r++) {
    const h = hitRow.get(r);
    const text = h ? rows[h.g].seq.slice(0, DC) : Array.from({ length: DC }, () => AA[Math.floor(rnd() * 20)]).join('');
    dbText.push(text);
    for (let c = 0; c < DC; c++) {
      const n = r * DC + c;
      Object.assign(db.t[n], { ...dbPos(r, c) });
      db.char(n, text[c]).color(n, '#f4f6f9').inkColor(n, '#8a9bb0');
    }
  }
  const same = (r: number, c: number) => c < QN && dbText[r][c] === query[c];
  const identity = (r: number) => {
    let k = 0;
    for (let c = 0; c < QN; c++) if (same(r, c)) k++;
    return k / QN;
  };
  const paintRow = (r: number, on: boolean, tint = '#ffd21f') => {
    for (let c = 0; c < DC; c++) {
      const n = r * DC + c;
      const hit = on && same(r, c);
      db.color(n, hit ? tint : on ? '#ffffff' : '#f4f6f9').inkColor(n, on ? '#0b1f3a' : '#8a9bb0');
      gsap.to(db.t[n], { lift: on ? 2.2 : 0, duration: 0.5, overwrite: 'auto' });
    }
  };

  // The scan: a glowing bar that sweeps the database.
  const scanBar = new THREE.Mesh(
    new THREE.PlaneGeometry(DC * 2.3 * 1.752 + 6, 4.6),
    new THREE.MeshBasicMaterial({ color: C.sky, transparent: true, opacity: 0, depthWrite: false }),
  );
  scanBar.position.copy(dbPos(0, (DC - 1) / 2)).add(new THREE.Vector3(0, 0, 1.4));
  const links = new Links();
  root.add(qTiles.group, db.group, scanBar, links.group);

  // BLASTX: a DNA query and its six reading frames.
  const NT = DNA.length;
  const nt = new Tiles(NT);
  nt.unit = 3.9;
  const ntPos = (i: number) => at(52 + (i - (NT - 1) / 2) * 2.2, 15, 12);
  [...DNA].forEach((ch, i) => {
    Object.assign(nt.t[i], { ...ntPos(i) });
    nt.char(i, ch).color(i, NT_COL[ch]);
  });
  const rc = revcomp(DNA);
  const FRAMES: { name: string; aa: string; start: number; rev: boolean }[] = [
    { name: '+1', aa: translate(DNA), start: 0, rev: false },
    { name: '+2', aa: translate(DNA.slice(1)), start: 1, rev: false },
    { name: '+3', aa: translate(DNA.slice(2)), start: 2, rev: false },
    { name: '−1', aa: translate(rc), start: 0, rev: true },
    { name: '−2', aa: translate(rc.slice(1)), start: 1, rev: true },
    { name: '−3', aa: translate(rc.slice(2)), start: 2, rev: true },
  ];
  const frameCount = FRAMES.reduce((a, f) => a + f.aa.length, 0);
  const fr = new Tiles(frameCount, { size: 0.9, depth: 0.4 });
  fr.unit = 6.4;
  const frameTile: { f: number; k: number }[] = [];
  FRAMES.forEach((f, fi) => {
    [...f.aa].forEach((a, k) => {
      const n = frameTile.length;
      frameTile.push({ f: fi, k });
      // Each amino acid sits under its codon (reverse frames read the other strand).
      const ntCentre = f.rev ? NT - 1 - (f.start + k * 3 + 1) : f.start + k * 3 + 1;
      const x = ntPos(ntCentre).x;
      Object.assign(fr.t[n], { x, y: at(0, 21.5 + fi * 4.4).y, z: 10 });
      fr.char(n, a === '*' ? '*' : a).color(n, a === '*' ? '#c4122f' : residueColor(a));
      if (a === '*') fr.inkColor(n, '#ffffff');
    });
  });

  // HMMER: a profile hidden Markov model — match, insert and delete states.
  const HM = 6;
  const hmmOrigin = at(52, 20, 12);
  const mPos = (k: number) => hmmOrigin.clone().add(new THREE.Vector3((k - (HM - 1) / 2) * 20, 0, 0));
  const iPos = (k: number) => mPos(k).add(new THREE.Vector3(10, 13, 0));
  const dPos = (k: number) => mPos(k).add(new THREE.Vector3(0, -13, 0));
  const hm = new Tiles(HM * 2, { size: 0.9, depth: 0.5 });
  hm.unit = 8;
  const consensus = 'LSPADK';
  for (let k = 0; k < HM; k++) {
    Object.assign(hm.t[k], { ...mPos(k) });
    hm.char(k, consensus[k]).color(k, residueColor(consensus[k]));
    Object.assign(hm.t[HM + k], { ...iPos(k), g: 0 });
    hm.color(HM + k, '#e6ecf3');
  }
  const deletes = new THREE.InstancedMesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#dfe6ee', roughness: 0.4, clearcoat: 0.6 }), HM);
  deletes.frustumCulled = false;
  const hmmLinks = new Links();
  const del = { s: 0 };
  root.add(nt.group, fr.group, hm.group, deletes, hmmLinks.group);

  world.onFrame(() => {
    qTiles.update();
    db.update();
    nt.update();
    fr.update();
    hm.update();
    deletes.visible = del.s > 0.001;
    if (deletes.visible) {
      const m = new THREE.Matrix4();
      for (let k = 0; k < HM; k++) {
        const s = Math.max(1e-4, del.s);
        m.makeScale(s, s, s).setPosition(dPos(k));
        deletes.setMatrixAt(k, m);
      }
      deletes.instanceMatrix.needsUpdate = true;
    }
  });

  // ---------------------------------------------------------------- pins
  pins
    .add('se-q', { anchor: () => wp(qPos(QN - 1)), html: 'توالی موردنظر', cls: 'pin-word', align: 'above', dx: -3, dy: -2.4 })
    .add('se-db', { anchor: () => db.group.localToWorld(dbPos(0, DC - 1)), html: 'پایگاه داده', cls: 'pin-word', align: 'above', dx: -3, dy: -2.2 })
    .add('se-dna', { anchor: () => wp(ntPos(NT - 1)), html: 'توالی نوکلئوتیدی', cls: 'pin-word', align: 'above', dx: -3, dy: -2.4 });
  FRAMES.forEach((f, fi) => pins.add(`se-f${fi}`, { anchor: () => wp(new THREE.Vector3(ntPos(0).x, at(0, 21.5 + fi * 4.4).y, 10)), html: f.name, cls: 'pin-seq', align: 'right', dx: -2.6 }));
  HITS.forEach(([r, g]) =>
    pins.add(`se-h${r}`, { anchor: () => db.group.localToWorld(dbPos(r, DC - 1)), html: `${rows[g].label} <b>${fa(Math.round(identity(r) * 100))}٪</b>`, cls: 'pin-hit', align: 'left', dx: 2.2 }),
  );
  [1, 2, 3].forEach((k) => pins.add(`se-r${k}`, { anchor: () => db.group.localToWorld(dbPos(HITS.find((h) => h[2] === k)![0], 0)), html: `تکرار ${fa(k)}`, cls: 'pin-round', align: 'right', dx: -2.2 }));
  pins
    .add('se-M', { anchor: () => wp(mPos(0).add(new THREE.Vector3(-9, 0, 0))), html: 'Match', cls: 'pin-seq', align: 'right' })
    .add('se-I', { anchor: () => wp(iPos(0).add(new THREE.Vector3(-19, 0, 0))), html: 'Insert', cls: 'pin-seq', align: 'right' })
    .add('se-D', { anchor: () => wp(dPos(0).add(new THREE.Vector3(-9, 0, 0))), html: 'Delete', cls: 'pin-seq', align: 'right' });

  // ---------------------------------------------------------------- overlay
  const el = section(
    overlay,
    's-search',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${bioinf.num}</p>
      <h2 class="n-title n-title-sm split">${bioinf.title}</h2>
      <div class="swap">
        <div data-s="0-0">
          <p class="n-body n-strong">${bioinf.lead}</p>
          <p class="n-body">${bioinf.how}</p>
        </div>
        <div data-s="1">
          <h3 class="n-sub">${bioinf.toolsTitle}</h3>
          <ol class="tools">
            ${bioinf.tools.map((t, i) => `<li class="tool" data-tool="${i + 1}"><b class="ltr">${t.name}</b><span>${t.body}</span></li>`).join('')}
          </ol>
        </div>
      </div>
    </div>`,
  );
  const toolEls = $$('.tool', el);

  // ---------------------------------------------------------------- steps
  let tl: gsap.core.Timeline | undefined;
  const showDb = (on: boolean, delay = 0) => db.show(on, { delay, amount: 1.2 });
  const dbHome = () => gsap.to(db.group.position, { x: 0, y: 0, z: 0, duration: 1.2, ease: 'power3.inOut' });
  const resetDb = () => {
    for (let r = 0; r < DR; r++) paintRow(r, false);
  };
  const hitPins = (ids: number[], on: boolean, delay = 0) => pins.show(ids.map((r) => `se-h${r}`), on, delay, 0.15);
  const linkHits = (list: number[], delay = 0, color: THREE.ColorRepresentation = C.blue) =>
    links
      .set(list.map((r) => ({ a: qPos(QN - 1).add(new THREE.Vector3(2, 0, 0)), b: dbPos(r, DC - 1).add(new THREE.Vector3(2.2, 0, 2)), w: 0.4, bend: new THREE.Vector3(18, 0, 6), color, arrow: true, r: 0.22 })))
      .show(true, { delay, stagger: 0.12 });

  const scan = (rowsToHit: number[], delay = 0) => {
    tl?.kill();
    tl = gsap.timeline({ delay });
    tl.set(scanBar.material, { opacity: 0.35 });
    for (let r = 0; r < DR; r++) {
      const y = dbPos(r, 0).y;
      tl.to(scanBar.position, { y, duration: 0.16, ease: 'none' });
      if (rowsToHit.includes(r)) tl.add(() => paintRow(r, true), '<');
    }
    tl.to(scanBar.material, { opacity: 0, duration: 0.4 });
    return tl;
  };

  const blastp = () => [2, 5, 8, 11, 13, 6, 15].filter((r) => identity(r) > 0.3);

  const steps = [
    // Lead: compare the query with every sequence in the database.
    () => {
      tl?.kill();
      dbHome();
      qTiles.show(true, { delay: 0.6, amount: 0.6 });
      showDb(true, 0.8);
      resetDb();
      nt.show(false);
      fr.show(false);
      hm.show(false);
      gsap.to(del, { s: 0, duration: 0.3 });
      hmmLinks.show(false);
      links.show(false);
      scan(blastp(), 2.2);
      pins.show(['se-q', 'se-db'], true, 1.4, 0.2);
      pins.hide('se-h');
      pins.hide('se-f');
      pins.hide('se-r');
      pins.show(['se-dna', 'se-M', 'se-I', 'se-D'], false);
    },
    // BLASTP
    () => {
      tl?.kill();
      dbHome();
      gsap.to(scanBar.material, { opacity: 0, duration: 0.3 });
      qTiles.show(true);
      showDb(true);
      nt.show(false);
      fr.show(false);
      hm.show(false);
      gsap.to(del, { s: 0, duration: 0.3 });
      hmmLinks.show(false);
      pins.show(['se-dna', 'se-M', 'se-I', 'se-D'], false);
      pins.hide('se-f');
      pins.hide('se-r');
      resetDb();
      const hits = blastp();
      hits.forEach((r) => paintRow(r, true));
      linkHits(hits, 0.6);
      hitPins(hits, true, 0.8);
      pins.show(['se-q', 'se-db'], true);
    },
    // BLASTX: translate the DNA query in six frames, then compare.
    () => {
      tl?.kill();
      gsap.to(db.group.position, { x: -34, y: -30, z: -140, duration: 1.4, ease: 'power3.inOut' });
      for (let n = 0; n < frameTile.length; n++) if (frameTile[n].f === 0) fr.color(n, residueColor(FRAMES[0].aa[frameTile[n].k]));
      qTiles.show(false);
      links.show(false);
      hitPins(HITS.map((h) => h[0]), false);
      resetDb();
      nt.show(true, { delay: 0.4, amount: 0.8 });
      fr.show(true, { delay: 1.4, amount: 1.6 });
      hm.show(false);
      gsap.to(del, { s: 0, duration: 0.3 });
      hmmLinks.show(false);
      pins.show('se-q', false);
      pins.show(['se-dna', 'se-db'], true, 0.6);
      pins.show(FRAMES.map((_, i) => `se-f${i}`), true, 1.6, 0.1);
      pins.hide('se-r');
      pins.show(['se-M', 'se-I', 'se-D'], false);
      // Frame +1 is the real protein: it finds the relatives.
      for (let n = 0; n < frameTile.length; n++) if (frameTile[n].f === 0) gsap.to(fr.t[n], { lift: 3, duration: 0.5, delay: 3.4 });
      tl = gsap.timeline({ delay: 3.4 }).add(() => {
        for (let n = 0; n < frameTile.length; n++) if (frameTile[n].f === 0) fr.color(n, '#ffd21f');
        [2, 5, 8].forEach((r) => paintRow(r, true));
      });
      hitPins([2, 5, 8], true, 3.6);
    },
    // PSI-BLAST: each round folds the hits into a profile and reaches further.
    () => {
      tl?.kill();
      dbHome();
      nt.show(false);
      fr.show(false);
      fr.t.forEach((t) => (t.lift = 0));
      hm.show(false);
      gsap.to(del, { s: 0, duration: 0.3 });
      hmmLinks.show(false);
      qTiles.show(true);
      resetDb();
      links.show(false);
      hitPins(HITS.map((h) => h[0]), false);
      pins.hide('se-f');
      pins.show(['se-dna', 'se-M', 'se-I', 'se-D'], false);
      pins.show(['se-q', 'se-db'], true);
      tl = gsap.timeline({ delay: 0.6 });
      const tints = ['#ffd21f', '#ffad7a', '#8fd3f7'];
      [1, 2, 3].forEach((k) => {
        const rs = HITS.filter((h) => h[2] === k).map((h) => h[0]);
        const at = 0.6 + (k - 1) * 1.6;
        tl!.add(() => rs.forEach((r) => paintRow(r, true, tints[k - 1])), (k - 1) * 1.6);
        // Labels and the growing profile are scheduled up front, not from inside the timeline.
        hitPins(rs, true, at);
        pins.show(`se-r${k}`, true, at);
        qTiles.t.forEach((t, i) => gsap.to(t, { d: 1 + k * 0.9 + (i % 3) * 0.3, duration: 0.6, delay: at }));
      });
      tl.to({}, { duration: 1.6 });
    },
    // HMMER: a profile hidden Markov model of the family.
    () => {
      tl?.kill();
      dbHome();
      qTiles.show(false);
      qTiles.t.forEach((t) => (t.d = 1));
      nt.show(false);
      fr.show(false);
      links.show(false);
      pins.hide('se-f');
      pins.hide('se-r');
      pins.show(['se-q', 'se-dna', 'se-db'], false);
      hm.show(true, { delay: 0.4, amount: 1 });
      gsap.to(del, { s: 1, duration: 0.6, delay: 0.8, ease: 'back.out(2)' });
      const L: Parameters<Links['set']>[0] = [];
      // Offsets were drawn for a 1× layout; the model is now 1.6× larger.
      const o = (x: number, y: number) => new THREE.Vector3(x * 1.6, y * 1.6, 1);
      const flat = new THREE.Vector3();
      for (let k = 0; k < HM; k++) {
        if (k < HM - 1) L.push({ a: mPos(k).add(o(2.6, 0)), b: mPos(k + 1).add(o(-2.8, 0)), w: 0.9, bend: flat, color: C.ink, arrow: true, r: 0.32 });
        L.push({ a: mPos(k).add(o(1.5, 2.4)), b: iPos(k).add(o(-1.8, -1.6)), w: 0.5, bend: new THREE.Vector3(-1.6, 0, 0), color: '#7f90a6', arrow: true, r: 0.28 });
        if (k < HM - 1) L.push({ a: iPos(k).add(o(1.8, -1.6)), b: mPos(k + 1).add(o(-1.5, 2.4)), w: 0.5, bend: new THREE.Vector3(1.6, 0, 0), color: '#7f90a6', arrow: true, r: 0.28 });
        if (k < HM - 1) L.push({ a: mPos(k).add(o(1.6, -2.4)), b: dPos(k + 1).add(o(-1.4, 1.4)), w: 0.5, bend: flat, color: '#7f90a6', arrow: true, r: 0.28 });
        if (k < HM - 1) L.push({ a: dPos(k).add(o(2, 0)), b: dPos(k + 1).add(o(-2, 0)), w: 0.5, bend: flat, color: '#7f90a6', arrow: true, r: 0.28 });
      }
      hmmLinks.set(L).show(true, { delay: 1.2, stagger: 0.03 });
      pins.show(['se-M', 'se-I', 'se-D'], true, 1.4, 0.1);
      resetDb();
      HITS.forEach(([r]) => paintRow(r, true, '#c9b8f0'));
      hitPins(HITS.map((h) => h[0]), true, 1.6);
    },
  ];

  function hide() {
    tl?.kill();
    dbHome();
    [qTiles, db, nt, fr, hm].forEach((t) => t.show(false));
    gsap.to(del, { s: 0, duration: 0.3 });
    links.show(false);
    hmmLinks.show(false);
    gsap.to(scanBar.material, { opacity: 0, duration: 0.2 });
    pins.hide('se-');
  }
  const sTools: Scene = {
    id: 'bioinformatics',
    label: bioinf.title,
    head: { num: bioinf.num, title: bioinf.title },
    steps: 5,
    enter(step) {
      ctx.area('search');
      open(el);
      world.fly(SHOT, 3);
      world.fogTo(380, 900);
      chrome.caption(null);
      words($('.n-title', el), 0.3, 0.06);
      gsap.fromTo($('.w-num', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(el, step, 0.6);
      toolEls.forEach((t, i) => t.classList.toggle('is-active', i + 1 === step));
      if (step > 0) {
        qTiles.show(true, { delay: 0.6 });
        showDb(true, 0.8);
      }
      steps[step]();
    },
    step(step) {
      stepVis(el, step);
      toolEls.forEach((t, i) => t.classList.toggle('is-active', i + 1 === step));
      steps[step]();
    },
    leave() {
      close(el);
      stepReset(el);
      tl?.kill();
    },
  };

  // =========================================================================================
  // MSA: the relatives line up, column by column.
  // =========================================================================================
  const W0 = 73;
  const W1 = 104;
  const WC = W1 - W0;
  const RN = rows.length;
  const msaT = new Tiles(RN * WC);
  msaT.unit = 4.9;
  const mPitch = 2.15;
  const msaPos = (r: number, c: number) => at(61 + (c - (WC - 1) / 2) * mPitch, 30 + r * 3.3, 10);
  const winText = rows.map((r) => r.aligned.slice(W0, W1));
  for (let r = 0; r < RN; r++)
    for (let c = 0; c < WC; c++) {
      const n = r * WC + c;
      const ch = winText[r][c];
      Object.assign(msaT.t[n], { ...msaPos(r, c) });
      msaT.char(n, ch).color(n, ch === '-' ? '#ffffff' : residueColor(ch));
      if (ch === '-') msaT.inkColor(n, '#a9b6c6');
    }
  // Before alignment: each sequence is just packed from the left (no gaps).
  const packedPos = (r: number, c: number) => {
    const before = [...winText[r].slice(0, c)].filter((x) => x !== '-').length;
    return msaPos(r, before);
  };
  root.add(msaT.group);
  world.onFrame(() => msaT.update());
  rows.forEach((row, r) =>
    pins.add(`ms-r${r}`, { anchor: () => wp(msaPos(r, 0)), html: row.label.replace('α', '<i class="g-a">α</i>').replace('β', '<i class="g-b">β</i>').replace('myoglobin', 'myoglobin'), cls: 'pin-leaf pin-row', align: 'right', dx: -2.2 }),
  );
  const conservedCols = GLOBINS.conserved.filter((c) => c >= W0 && c < W1).map((c) => c - W0);
  const hisCols = [GLOBINS.distalHis.column - W0, GLOBINS.proximalHis.column - W0];
  hisCols.forEach((c, k) =>
    pins.add(`ms-his${k}`, { anchor: () => wp(msaPos(RN - 1, c)), html: '<span>هیستیدین</span><small>در هر ۹ توالی ثابت</small>', cls: 'pin-stat', align: 'below', dy: 2.4 }),
  );

  const elMsa = section(
    overlay,
    's-msa',
    /* html */ `
    <div class="n-panel">
      <p class="w-num">${msa.num}</p>
      <div class="swap">
        <div data-s="0-0">
          <h2 class="m-big ltr">MSA</h2>
          <p class="m-expand ltr">${msa.expand}</p>
          <p class="m-fa">${msa.fa}</p>
          <p class="n-body n-strong">${msa.body}</p>
        </div>
        <div data-s="1-1">
          <h2 class="n-title n-title-sm">${msaInfo.title}</h2>
          <ul class="h-list">
            ${msaInfo.info.map((w, i) => `<li class="h-item${i ? ' h-item-b' : ''}"><h3>${w.head} <span class="ltr">(${w.latin})</span></h3><p>${w.body}</p></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`,
  );

  const msaSteps = [
    () => {
      // Rows arrive packed, then gaps open and the columns line up.
      for (let r = 0; r < RN; r++)
        for (let c = 0; c < WC; c++) {
          const n = r * WC + c;
          const t = msaT.t[n];
          const gap = winText[r][c] === '-';
          const from = packedPos(r, c);
          const to = msaPos(r, c);
          gsap.killTweensOf(t);
          gsap.set(t, { x: from.x - 30, y: from.y, z: from.z, s: 0, lift: 0 });
          gsap.to(t, { x: from.x, s: gap ? 0 : msaT.unit, duration: 0.8, delay: 0.5 + r * 0.12 + c * 0.01, ease: 'power3.out' });
          gsap.to(t, { x: to.x, s: msaT.unit, duration: 1.1, delay: 2.4 + c * 0.015, ease: 'power3.inOut' });
          const ch = winText[r][c];
          msaT.color(n, ch === '-' ? '#ffffff' : residueColor(ch)).inkColor(n, ch === '-' ? '#a9b6c6' : '#0b1f3a');
        }
      pins.show(rows.map((_, r) => `ms-r${r}`), true, 0.8, 0.08);
      pins.show(['ms-his0', 'ms-his1'], false);
    },
    () => {
      // Conserved columns light up; the rest pales.
      for (let r = 0; r < RN; r++)
        for (let c = 0; c < WC; c++) {
          const n = r * WC + c;
          const ch = winText[r][c];
          const on = conservedCols.includes(c);
          const t = msaT.t[n];
          const to = msaPos(r, c);
          gsap.killTweensOf(t);
          gsap.to(t, { x: to.x, s: msaT.unit, lift: on ? 2.4 : 0, duration: 0.6, delay: on ? 0.4 + r * 0.05 : 0 });
          msaT.color(n, on ? '#ffd21f' : ch === '-' ? '#ffffff' : residueColor(ch).lerp(new THREE.Color('#eef2f6'), 0.6)).inkColor(n, on ? '#0b1f3a' : '#8a9bb0');
        }
      pins.show(['ms-his0', 'ms-his1'], true, 1.2, 0.2);
    },
  ];

  function hideMsa() {
    msaT.show(false);
    pins.hide('ms-');
  }

  const sMsa: Scene = {
    id: 'msa',
    label: msa.title,
    head: { num: msa.num, title: bioinf.title },
    steps: 2,
    enter(step, dir) {
      ctx.area('search');
      open(elMsa);
      chrome.caption({ name: 'خانواده‌ی گلوبین', detail: 'توالی‌ها از UniProt؛ هم‌ترازی ستاره‌ای با BLOSUM62 (بخشی از ستون‌ها)' }, 1.4);
      world.fly(SHOT, 2.4);
      // The database stays, faint, behind the alignment.
      [qTiles, nt, fr, hm].forEach((t) => t.show(false));
      gsap.to(del, { s: 0, duration: 0.3 });
      links.show(false);
      hmmLinks.show(false);
      tl?.kill();
      pins.hide('se-');
      db.show(false);
      gsap.fromTo($('.w-num', elMsa), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      stepVis(elMsa, step, 0.5);
      msaSteps[0]();
      if (step === 1) msaSteps[1]();
      void dir;
    },
    step(step) {
      stepVis(elMsa, step);
      msaSteps[step]();
    },
    leave() {
      close(elMsa);
      stepReset(elMsa);
      hideMsa();
    },
  };
  ctx.register('search', () => {
    hide();
    hideMsa();
  });

  return [sTools, sMsa];
}
