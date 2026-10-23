import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../../deck';
import { homology, fa } from '../../content';
import { GLOBINS } from '../../data/globins';
import { ANCHOR, C, shot } from '../../three/world';
import { Braces } from '../../ui/braces';
import { $, words, open, close, section, stepVis, stepReset } from '../../ui/text';
import { pop, type Ctx } from '../ctx';
import { at, alphaRibbon } from '../net/common';

// ۱-۴ Homologs: the globin family tree from the PDF figure, grown as a bead chain, with real
// haemoglobin α and β chains on its leaves — then α and β superposed to show the shared fold.

const ALPHA = new THREE.Color('#0053d6');
const ALPHA2 = new THREE.Color('#65cbf3');
const BETA = new THREE.Color('#ff7d45');
const BETA2 = new THREE.Color('#ffc21a');

export function homologyScenes(ctx: Ctx): Scene[] {
  const { world, chrome, overlay, pins } = ctx;
  const H = ANCHOR.homology;
  const root = new THREE.Group();
  root.position.copy(H);
  world.scene.add(root);
  const SHOT = shot(H, { pz: 300 });
  const F = homology.figure;

  // ---------------------------------------------------------------- the tree
  // Node positions on the stage (rem). Topology as in the figure on page 5.
  const P: Record<string, [number, number]> = {
    root: [52, 92],
    dup: [52, 81],
    aG: [26, 69],
    bG: [78, 69],
    aI: [34.5, 57],
    bI: [69.5, 57],
    frogA: [12, 47],
    chickA: [27, 47],
    mouseA: [42, 47],
    mouseB: [62, 47],
    chickB: [77, 47],
    frogB: [92, 47],
  };
  const pos = (id: string, z = 0) => at(P[id][0], P[id][1], z);
  const EDGES: [string, string, 'ink' | 'a' | 'b'][] = [
    ['root', 'dup', 'ink'],
    ['dup', 'aG', 'a'],
    ['dup', 'bG', 'b'],
    ['aG', 'frogA', 'a'],
    ['aG', 'aI', 'a'],
    ['aI', 'chickA', 'a'],
    ['aI', 'mouseA', 'a'],
    ['bG', 'bI', 'b'],
    ['bG', 'frogB', 'b'],
    ['bI', 'mouseB', 'b'],
    ['bI', 'chickB', 'b'],
  ];
  const depth: Record<string, number> = { root: 0 };
  EDGES.forEach(([a, b]) => (depth[b] = depth[a] + pos(a).distanceTo(pos(b))));
  const maxDepth = Math.max(...Object.values(depth));

  // Beads every ~2.3 units along each branch: the lineage drawn as a chain.
  const beadData: { p: THREE.Vector3; k: number; c: THREE.Color }[] = [];
  const colOf = { ink: C.ink, a: ALPHA, b: BETA };
  for (const [a, b, col] of EDGES) {
    const A = pos(a);
    const B = pos(b);
    const len = A.distanceTo(B);
    const n = Math.max(2, Math.round(len / 2.3));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      beadData.push({ p: A.clone().lerp(B, t), k: (depth[a] + len * t) / maxDepth, c: colOf[col] });
    }
  }
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, transparent: true }),
    beadData.length,
  );
  beadData.forEach((b, i) => beads.setColorAt(i, b.c));
  beads.frustumCulled = false;
  // Gene nodes: larger beads at the branch points.
  const NODES = ['root', 'dup', 'aG', 'bG', 'aI', 'bI'];
  const nodeMeshes = NODES.map((id) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(id === 'dup' ? 2.4 : 1.8, 28, 18),
      new THREE.MeshPhysicalMaterial({ color: id === 'dup' ? C.alarm : id === 'root' ? C.ink : id.startsWith('a') ? ALPHA : BETA, roughness: 0.25, clearcoat: 1 }),
    );
    m.position.copy(pos(id, 0.5));
    m.scale.setScalar(0.001);
    return m;
  });
  const dupRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 12, 48), new THREE.MeshBasicMaterial({ color: C.alarm, transparent: true, opacity: 0 }));
  dupRing.position.copy(pos('dup', 0.5));
  root.add(beads, ...nodeMeshes, dupRing);
  const tree = { grow: 0, dim: 0 };
  const _m = new THREE.Matrix4();

  // ---------------------------------------------------------------- leaves: real α / β chains
  const gradA = (_c: number, t: number, out: THREE.Color) => out.copy(ALPHA).lerp(ALPHA2, t);
  const gradB = (_c: number, t: number, out: THREE.Color) => out.copy(BETA2).lerp(BETA, t);
  const cartA = alphaRibbon({ color: gradA });
  const cartB = alphaRibbon({ beta: true, color: gradB });
  const LEAVES = ['frogA', 'chickA', 'mouseA', 'mouseB', 'chickB', 'frogB'];
  const LEAF_S = 0.4;
  const leaves = LEAVES.map((id) => {
    const holder = new THREE.Group();
    holder.add(new THREE.Mesh((id.endsWith('A') ? cartA : cartB).mesh.geometry, (id.endsWith('A') ? cartA : cartB).mesh.material));
    holder.position.copy(pos(id, 2).add(new THREE.Vector3(0, 21, 0)));
    holder.scale.setScalar(0.001);
    holder.visible = false;
    holder.userData.home = holder.position.clone();
    root.add(holder);
    return holder;
  });
  const leafOf = (id: string) => leaves[LEAVES.indexOf(id)];

  // The pair used for the superposition, larger and in front.
  const heroA = new THREE.Group();
  const heroB = new THREE.Group();
  heroA.add(new THREE.Mesh(cartA.mesh.geometry, cartA.mesh.material));
  heroB.add(new THREE.Mesh(cartB.mesh.geometry, cartB.mesh.material));
  [heroA, heroB].forEach((h) => {
    h.visible = false;
    h.scale.setScalar(0.001);
    root.add(h);
  });
  const HERO = at(40, 50, 30);
  const spin = { y: 0 };

  // Sequence strips under the superposition: identical positions lit.
  const AB = GLOBINS.alphaBeta;
  const seqA = GLOBINS.rows[0].seq;
  const seqB = GLOBINS.rows[4].seq;
  const cols: [number, number][] = [];
  {
    let ia = 0;
    let ib = 0;
    for (const [pa, pb] of AB.pairs) {
      while (ia < pa) cols.push([ia++, -1]);
      while (ib < pb) cols.push([-1, ib++]);
      cols.push([ia++, ib++]);
    }
    while (ia < seqA.length) cols.push([ia++, -1]);
    while (ib < seqB.length) cols.push([-1, ib++]);
  }
  // Two bars per alignment column (α above, β below), drawn once into a texture: gold where
  // the residues are identical, pale where they differ, empty at gaps.
  const STRIP_W = 52 * 1.752;
  const STRIP_H = 6;
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = cols.length * 8;
  stripCanvas.height = 96;
  {
    const g = stripCanvas.getContext('2d')!;
    cols.forEach(([a, b], c) => {
      const same = a >= 0 && b >= 0 && seqA[a] === seqB[b];
      [a, b].forEach((r, row) => {
        if (r < 0) return;
        g.fillStyle = same ? '#f2b400' : row === 0 ? '#9fbdf0' : '#ffb894';
        g.fillRect(c * 8 + 1, row * 50, 6, 46);
      });
    });
  }
  const stripTex = new THREE.CanvasTexture(stripCanvas);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  stripTex.anisotropy = 8;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(STRIP_W, STRIP_H), new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, opacity: 0, toneMapped: false }));
  const STRIP_Y = at(0, 86).y;
  strip.position.set(at(40, 0).x, STRIP_Y, 10);
  strip.visible = false;
  const showStrip = (on: boolean, delay = 0) => {
    if (on) strip.visible = true;
    gsap.to(strip.material, { opacity: on ? 1 : 0, duration: on ? 0.8 : 0.3, delay: on ? delay : 0, overwrite: true, onComplete: () => void (on || (strip.visible = false)) });
    gsap.fromTo(strip.scale, { x: on ? 0.2 : strip.scale.x }, { x: 1, duration: on ? 1.2 : 0.01, delay: on ? delay : 0, ease: 'power3.out' });
  };
  const stripPos = (row: number, end: 0 | 1) => new THREE.Vector3(strip.position.x + (end ? STRIP_W / 2 : -STRIP_W / 2), STRIP_Y + (row ? -STRIP_H / 4 : STRIP_H / 4), 10);
  root.add(strip);

  world.onFrame((dt) => {
    // Tree: beads appear root → leaves.
    const g = tree.grow;
    beads.visible = g > 0.001;
    if (beads.visible) {
      const ease = gsap.parseEase('back.out(2)');
      beadData.forEach((b, i) => {
        const a = Math.min(1, Math.max(0, (g * 1.15 - b.k) / 0.15));
        const s = Math.max(1e-4, ease(a) * 0.95);
        _m.makeScale(s, s, s).setPosition(b.p);
        beads.setMatrixAt(i, _m);
      });
      beads.instanceMatrix.needsUpdate = true;
      (beads.material as THREE.MeshPhysicalMaterial).opacity = 1 - tree.dim * 0.75;
    }
    nodeMeshes.forEach((m, i) => {
      const a = Math.min(1, Math.max(0, (g * 1.15 - depth[NODES[i]] / maxDepth) / 0.12));
      m.scale.setScalar(Math.max(1e-4, a));
      m.visible = a > 0;
      const mat = m.material as THREE.MeshPhysicalMaterial;
      mat.transparent = true;
      mat.opacity = 1 - Math.min(1, tree.dim) * 0.85;
    });
    spin.y += dt * 0.35;
    leaves.forEach((l) => (l.rotation.y = spin.y));
    heroA.rotation.y = heroB.rotation.y = spin.y * 0.7;
  });

  // ---------------------------------------------------------------- labels
  const greek = (s: string) => s.replace('α', '<i class="g-a">α</i>').replace('β', '<i class="g-b">β</i>');
  LEAVES.forEach((id, i) => pins.add(`ho-leaf-${id}`, { anchor: () => root.localToWorld(pos(id, 2)), html: greek(F.leaves[i]), cls: 'pin-leaf', align: 'above', dy: -0.8 }));
  pins
    .add('ho-root', { anchor: () => root.localToWorld(pos('root', 1)), html: F.root, cls: 'pin-gene', align: 'below', dy: 1.4 })
    .add('ho-dup', { anchor: () => root.localToWorld(pos('dup', 1)), html: F.duplication, cls: 'pin-dup', align: 'left', dx: 3.4 })
    .add('ho-aG', { anchor: () => root.localToWorld(pos('aG', 1)), html: greek(F.alphaGene), cls: 'pin-gene', align: 'right', dx: -2.4 })
    .add('ho-bG', { anchor: () => root.localToWorld(pos('bG', 1)), html: greek(F.betaGene), cls: 'pin-gene', align: 'left', dx: 2.4 })
    .add('ho-stat-seq', { anchor: () => root.localToWorld(stripPos(1, 1)), html: `<span>توالی: <b>${fa(Math.round(AB.identity * 100))}٪</b> یکسان</span><small>جایگاه‌های زرد: اسید آمینه‌ی یکسان</small>`, cls: 'pin-stat', align: 'left', dx: 1.6, dy: -0.8 })
    .add('ho-stat-3d', { anchor: () => root.localToWorld(HERO.clone().add(new THREE.Vector3(27, 12, 0))), html: `<span>ساختار: تقریباً منطبق</span><small>میانگین فاصله‌ی اتم‌های Cα: ${fa(AB.rmsd.toFixed(1)).replace('.', '٫')} آنگستروم</small>`, cls: 'pin-stat', align: 'left' })
    .add('ho-sa', { anchor: () => root.localToWorld(stripPos(0, 0)), html: '<i class="g-a">α</i>', cls: 'pin-leaf', align: 'right', dx: -1 })
    .add('ho-sb', { anchor: () => root.localToWorld(stripPos(1, 0)), html: '<i class="g-b">β</i>', cls: 'pin-leaf', align: 'right', dx: -1 });

  const braces = new Braces(world);
  const leafX = (id: string) => () => root.localToWorld(pos(id, 2));
  braces
    .add('homologs', { from: leafX('frogA'), to: leafX('frogB'), y: 16, html: F.homologs, color: '#c4122f' })
    .add('orthoA', { from: leafX('frogA'), to: leafX('mouseA'), y: 23.5, html: F.orthologs, color: '#d99a00' })
    .add('orthoB', { from: leafX('mouseB'), to: leafX('frogB'), y: 23.5, html: F.orthologs, color: '#d99a00' })
    .add('paralogs', { from: leafX('mouseA'), to: leafX('mouseB'), y: 27.5, html: F.paralogs, color: '#1d8a4a' });

  const allPinIds = [...LEAVES.map((id) => `ho-leaf-${id}`), 'ho-root', 'ho-dup', 'ho-aG', 'ho-bG'];

  // ---------------------------------------------------------------- overlay
  const item = (h: string, latin: string, body: string, s: string) =>
    `<li class="h-item" data-s="${s}"><h3>${h}${latin ? ` <span class="ltr">(${latin})</span>` : ''}</h3><p>${body}</p></li>`;
  const el = section(
    overlay,
    's-homology',
    /* html */ `
    <p class="h-fig ltr">${F.title}</p>
    <div class="n-panel h-panel">
      <p class="w-num">${homology.num}</p>
      <h2 class="n-title split">${homology.title}</h2>
      <p class="h-latin ltr">${homology.latin}</p>
      <div class="swap">
        <div data-s="0-0">
          <p class="n-body n-strong">${homology.definition}</p>
          <p class="n-body">${homology.simple}</p>
        </div>
        <div data-s="1-1">
          <h3 class="n-sub">${homology.whyTitle}</h3>
          <ul class="h-list">${homology.why.map((w) => item(w.head, w.latin, w.body, '1-1')).join('')}</ul>
        </div>
        <div data-s="2">
          <h3 class="n-sub">${homology.typesTitle}</h3>
          <ul class="h-list">
            ${item(homology.types[0].head, homology.types[0].latin, homology.types[0].body, '2')}
            ${item(homology.types[1].head, homology.types[1].latin, homology.types[1].body, '3')}
          </ul>
        </div>
      </div>
    </div>`,
  );

  // ---------------------------------------------------------------- steps
  const showLeaves = (on: boolean, delay = 0, dim = false) =>
    leaves.forEach((l, i) => {
      if (on) l.visible = true;
      gsap.to(l.scale, { x: on ? LEAF_S : 0.001, y: on ? LEAF_S : 0.001, z: on ? LEAF_S : 0.001, duration: on ? 1 : 0.4, delay: on ? delay + i * 0.12 : 0, ease: on ? 'back.out(1.6)' : 'power2.in', overwrite: 'auto', onComplete: () => void (on || (l.visible = false)) });
      void dim;
    });
  const heroes = (on: boolean) => {
    const pairs: [THREE.Group, string][] = [
      [heroA, 'mouseA'],
      [heroB, 'mouseB'],
    ];
    pairs.forEach(([h, id], k) => {
      const leaf = leafOf(id);
      gsap.killTweensOf([h.position, h.scale]);
      if (on) {
        h.visible = true;
        h.position.copy(leaf.position);
        h.scale.setScalar(LEAF_S);
        leaf.visible = false;
        gsap.to(h.position, { x: HERO.x, y: HERO.y, z: HERO.z, duration: 1.8, delay: 0.3 + k * 0.5, ease: 'power3.inOut' });
        gsap.to(h.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 1.8, delay: 0.3 + k * 0.5, ease: 'power3.inOut' });
      } else if (h.visible) {
        const home = leaf.userData.home as THREE.Vector3;
        gsap.to(h.position, { x: home.x, y: home.y, z: home.z, duration: 1.2, ease: 'power3.inOut' });
        gsap.to(h.scale, {
          x: LEAF_S,
          y: LEAF_S,
          z: LEAF_S,
          duration: 1.2,
          ease: 'power3.inOut',
          onComplete: () => {
            h.visible = false;
            leaf.visible = leaf.scale.x > 0.01;
          },
        });
      }
    });
  };

  const steps = [
    () => {
      gsap.to(tree, { grow: 1, dim: 0, duration: 3, ease: 'power1.inOut' });
      showLeaves(true, 2);
      heroes(false);
      showStrip(false);
      pins.show(allPinIds, true, 1.4, 0.1);
      pins.show(['ho-stat-seq', 'ho-stat-3d', 'ho-sa', 'ho-sb'], false);
      braces.show('homologs', true, 3.2);
      ['orthoA', 'orthoB', 'paralogs'].forEach((b) => braces.show(b, false));
      gsap.to(dupRing.material, { opacity: 0, duration: 0.4 });
      chrome.caption({ name: 'خانواده‌ی گلوبین', detail: 'برگ‌ها: زنجیره‌های α و β هموگلوبین انسان (PDB 4HHB)، نمایشی' }, 2.6);
    },
    () => {
      gsap.to(tree, { grow: 1, dim: 1.2, duration: 1 });
      heroes(true);
      leaves.forEach((l) => {
        if (l !== leafOf('mouseA') && l !== leafOf('mouseB')) gsap.to(l.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, overwrite: 'auto', onComplete: () => void (l.visible = false) });
      });
      showStrip(true, 2);
      pins.show(allPinIds, false);
      pins.show(['ho-sa', 'ho-sb', 'ho-stat-seq'], true, 2.6, 0.15);
      pins.show('ho-stat-3d', true, 3.2);
      braces.hideAll();
      chrome.caption({ name: 'زنجیره‌ی α و β هموگلوبین انسان', detail: `PDB 4HHB، روی هم گذاشته‌شده بر اساس ${fa(AB.aligned)} جایگاه هم‌تراز` }, 1);
    },
    () => {
      gsap.to(tree, { grow: 1, dim: 0, duration: 1 });
      heroes(false);
      leaves.forEach((l) => {
        if (l !== leafOf('mouseA') && l !== leafOf('mouseB')) {
          l.visible = true;
          gsap.to(l.scale, { x: LEAF_S, y: LEAF_S, z: LEAF_S, duration: 0.8, delay: 0.4, ease: 'back.out(1.6)', overwrite: 'auto' });
        }
      });
      showStrip(false);
      pins.show(['ho-stat-seq', 'ho-stat-3d', 'ho-sa', 'ho-sb'], false);
      pins.show(allPinIds, true, 0.6, 0.04);
      braces.show('homologs', true, 0.4);
      braces.show('orthoA', true, 0.9);
      braces.show('orthoB', true, 1.1);
      braces.show('paralogs', false);
      gsap.to(dupRing.material, { opacity: 0, duration: 0.4 });
      chrome.caption({ name: 'خانواده‌ی گلوبین', detail: 'برگ‌ها: زنجیره‌های α و β هموگلوبین انسان (PDB 4HHB)، نمایشی' }, 0.6);
    },
    () => {
      braces.show('paralogs', true, 0.3);
      gsap.fromTo(dupRing.material, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.4 });
      gsap.fromTo(dupRing.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1.25, y: 1.25, z: 1.25, duration: 1.2, repeat: 3, yoyo: true, ease: 'sine.inOut', delay: 0.4 });
    },
  ];

  function hide() {
    gsap.to(tree, { grow: 0, dim: 0, duration: 0.8, ease: 'power2.in' });
    showLeaves(false);
    [heroA, heroB].forEach((h) => pop(h, false));
    showStrip(false);
    pins.hide('ho-');
    braces.hideAll();
    gsap.to(dupRing.material, { opacity: 0, duration: 0.3 });
  }
  ctx.register('homology', hide);

  const sHomology: Scene = {
    id: 'homology',
    label: homology.title,
    head: { num: homology.num, title: homology.title },
    steps: 4,
    enter(step) {
      ctx.area('homology');
      open(el);
      world.fly(SHOT, 3);
      world.fogTo(380, 900);
      words($('.n-title', el), 0.3, 0.08);
      gsap.fromTo([$('.w-num', el), $('.h-latin', el), $('.h-fig', el)], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.3, stagger: 0.15 });
      stepVis(el, step, 0.6);
      steps[0]();
      if (step >= 1) steps[step === 1 ? 1 : 2]();
      if (step === 3) steps[3]();
    },
    step(step) {
      stepVis(el, step);
      steps[step]();
    },
    leave() {
      close(el);
      stepReset(el);
    },
  };

  return [sHomology];
}
