import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../deck';
import { routes, chapter1 } from '../content';
import { MOL } from '../data/molecules';
import { Cartoon } from '../three/cartoon';
import { ANCHOR, C, shot, spectrum } from '../three/world';
import { flowMaterial, copper, housing } from '../three/props';
import { $, $$, words, reveal, open, close, section } from '../ui/text';
import { pop, type Ctx } from './ctx';

// 1-2: two routes from a sequence to a structure — the lab, or AlphaFold.
export function routesScenes(ctx: Ctx): Scene[] {
  const { world, chrome, notes, overlay } = ctx;
  const R = ANCHOR.routes;
  const root = new THREE.Group();
  root.position.copy(R);
  world.scene.add(root);

  // Input: a short straight chain of beads.
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.5, 32, 20),
    new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.16 }),
    14,
  );
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < 14; i++) {
    m.makeTranslation(64 + i * 3.4, 0, 0);
    beads.setMatrixAt(i, m);
    beads.setColorAt(i, spectrum(i / 13, col));
  }
  const input = new THREE.Group();
  input.add(beads);
  const backbone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 13 * 3.4, 12), new THREE.MeshStandardMaterial({ color: C.ink }));
  backbone.position.set(64 + 6.5 * 3.4, 0, 0);
  backbone.rotation.z = Math.PI / 2;
  input.add(backbone);

  // Output: the folded structure.
  const out = new THREE.Group();
  out.position.set(-78, 0, 0);
  const ubq = new Cartoon(MOL.ubiquitin);
  out.add(ubq.mesh);

  // Two routes.
  const from = new THREE.Vector3(58, 0, 0);
  const to = new THREE.Vector3(-58, 0, 0);
  const pathLab = new THREE.CatmullRomCurve3([from, new THREE.Vector3(40, 15, 0), new THREE.Vector3(0, 27, 0), new THREE.Vector3(-40, 15, 0), to]);
  const pathAi = new THREE.CatmullRomCurve3([from, new THREE.Vector3(40, -15, 0), new THREE.Vector3(0, -27, 0), new THREE.Vector3(-40, -15, 0), to]);
  const flowLab = flowMaterial(C.ink, { dashes: 36 });
  const flowAi = flowMaterial(C.blue, { dashes: 36, speed: 1.4 });
  const tubeLab = new THREE.Mesh(new THREE.TubeGeometry(pathLab, 200, 0.7, 12), flowLab.material);
  const tubeAi = new THREE.Mesh(new THREE.TubeGeometry(pathAi, 200, 0.7, 12), flowAi.material);

  // Lab stations on the upper route: a crystal and a cryo-EM grid.
  const crystal = new THREE.Group();
  const cube = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.25, clearcoat: 1 });
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const b = new THREE.Mesh(cube, cubeMat);
    b.position.set(x * 2.9, y * 2.9, z * 2.9);
    crystal.add(b);
  }
  crystal.position.copy(pathLab.getPoint(0.36));
  crystal.rotation.set(0.5, 0.6, 0);
  const grid = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.6, 48), copper());
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 12, 64), housing());
  ring.rotation.x = Math.PI / 2;
  grid.add(disc, ring);
  for (let i = -3; i <= 3; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 13), housing());
    a.position.x = i * 1.8;
    const b = a.clone();
    b.rotation.y = Math.PI / 2;
    b.position.set(0, 0, i * 1.8);
    grid.add(a, b);
  }
  grid.position.copy(pathLab.getPoint(0.64));
  grid.rotation.set(1.1, 0, 0.2);

  // A small neural network on the lower route, with signals passing through.
  const net = new THREE.Group();
  net.position.copy(pathAi.getPoint(0.5));
  const layers = [4, 6, 6, 4];
  const nodes: THREE.Vector3[][] = layers.map((n, li) =>
    Array.from({ length: n }, (_, k) => new THREE.Vector3((1.5 - li) * 11, (k - (n - 1) / 2) * 5.2, 0)),
  );
  const flat = nodes.flat();
  const nodeMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.45, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: C.blue, roughness: 0.25, clearcoat: 1 }),
    flat.length,
  );
  flat.forEach((p, i) => nodeMesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  for (let li = 0; li < layers.length - 1; li++) for (const a of nodes[li]) for (const b of nodes[li + 1]) edges.push([a, b]);
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edges.flat());
  const edgeMat = new THREE.LineBasicMaterial({ color: '#8fa3b8', transparent: true, opacity: 0.5 });
  net.add(nodeMesh, new THREE.LineSegments(edgeGeo, edgeMat));
  const pulses = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.7, 12, 8),
    new THREE.MeshBasicMaterial({ color: C.sun }),
    24,
  );
  const pulseState = Array.from({ length: 24 }, () => ({ e: Math.floor(Math.random() * edges.length), t: Math.random() }));
  net.add(pulses);
  const signal = { on: 0 };

  root.add(input, out, tubeLab, tubeAi, crystal, grid, net);
  [input, out, crystal, grid, net].forEach((g) => {
    g.scale.setScalar(0.001);
    g.visible = false;
  });
  tubeLab.visible = tubeAi.visible = false;

  world.onFrame((dt, t) => {
    flowLab.uniforms.uTime.value = t;
    flowAi.uniforms.uTime.value = t;
    out.rotation.y += dt * 0.25;
    crystal.rotation.y += dt * 0.3;
    grid.rotation.z += dt * 0.2;
    if (!net.visible) return;
    const v = new THREE.Vector3();
    pulseState.forEach((p, i) => {
      p.t += dt * 1.6;
      if (p.t > 1) {
        p.t = 0;
        // Continue from the end node into the next layer.
        const end = edges[p.e][1];
        const next = edges.map((e, k) => [e, k] as const).filter(([e]) => e[0] === end);
        p.e = next.length ? next[Math.floor(Math.random() * next.length)][1] : Math.floor(Math.random() * (layers[0] * layers[1]));
      }
      const [a, b] = edges[p.e];
      v.lerpVectors(a, b, p.t);
      m.makeScale(signal.on, signal.on, signal.on).setPosition(v);
      pulses.setMatrixAt(i, m);
    });
    pulses.instanceMatrix.needsUpdate = true;
  });

  let hideTubes: gsap.core.Tween | undefined;
  function hide() {
    [input, out, crystal, grid, net].forEach((g) => pop(g, false));
    gsap.to([flowLab.uniforms.uOn, flowAi.uniforms.uOn], { value: 0, duration: 0.4 });
    hideTubes = gsap.delayedCall(0.5, () => void (tubeLab.visible = tubeAi.visible = false));
    notes.hide('r-in', 'r-out', 'r-lab', 'r-ai');
  }
  ctx.register('routes', hide);

  const el = section(
    overlay,
    's-routes',
    /* html */ `
    <div class="r-head">
      <p class="w-num">${routes.num}</p>
      <h2 class="r-title split">${routes.title}</h2>
    </div>`,
  );

  const at = (o: THREE.Object3D, v: THREE.Vector3) => () => o.localToWorld(v.clone());
  notes
    .add('r-in', { anchor: () => root.localToWorld(new THREE.Vector3(86, -2, 0)), html: '<b>توالی</b><span>ورودی</span>', at: [150, 73], tone: 'ink' })
    .add('r-out', { anchor: at(out, new THREE.Vector3(0, -16, 0)), html: '<b>ساختار سه‌بعدی</b><span>خروجی</span>', at: [14, 70], tone: 'ink' })
    .add('r-lab', {
      anchor: () => root.localToWorld(pathLab.getPoint(0.5)),
      html: `<b>۱. ${routes.experimental.name}</b>${routes.experimental.methods
        .map((x, i) => `<span>${x} <i class="ltr">(${routes.experimental.latin[i]})</i></span>`)
        .join('')}`,
      at: [104, 31],
      tone: 'ink',
    })
    .add('r-ai', {
      anchor: () => root.localToWorld(pathAi.getPoint(0.5).add(new THREE.Vector3(0, -16, 0))),
      html: `<b>۲. ${routes.ai.name}</b><span class="ltr">${routes.ai.model}</span>`,
      at: [122, 84],
      tone: 'blue',
    });

  const steps = [
    () => {
      gsap.to(flowLab.uniforms.uOn, { value: 0, duration: 0.6 });
      gsap.to(flowAi.uniforms.uOn, { value: 0, duration: 0.6 });
      pop(crystal, false);
      pop(grid, false);
      pop(net, false);
      notes.hide('r-lab', 'r-ai');
    },
    () => {
      gsap.to(flowLab.uniforms.uOn, { value: 1, duration: 1 });
      gsap.to(flowAi.uniforms.uOn, { value: 0, duration: 0.6 });
      pop(crystal, true, { delay: 0.3 });
      pop(grid, true, { delay: 0.6 });
      pop(net, false);
      notes.show('r-lab', true, 0.8);
      notes.hide('r-ai');
    },
    () => {
      gsap.to(flowAi.uniforms.uOn, { value: 1, duration: 1 });
      gsap.to(flowLab.uniforms.uOn, { value: 0.35, duration: 1 });
      pop(net, true, { delay: 0.3 });
      gsap.fromTo(signal, { on: 0 }, { on: 1, duration: 1, delay: 0.8 });
      notes.show('r-ai', true, 0.8);
    },
  ];

  const sRoutes: Scene = {
    id: 'routes',
    label: routes.title,
    head: { num: chapter1.num, title: chapter1.title },
    steps: 3,
    enter(step) {
      ctx.area('routes');
      open(el);
      world.fly(shot(R, { py: 4, pz: 240, oy: -0.06 }), 3);
      world.fogTo(220, 560);
      hideTubes?.kill();
      tubeLab.visible = tubeAi.visible = true;
      pop(input, true, { delay: 0.8 });
      pop(out, true, { delay: 1.2 });
      ubq.draw = 0;
      gsap.to(ubq, { draw: 1, duration: 2, delay: 1.4 });
      words($('.r-title', el), 0.4, 0.06);
      gsap.fromTo($('.w-num', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.3 });
      notes.show('r-in', true, 1.6);
      notes.show('r-out', true, 2);
      chrome.caption(null);
      steps[0]();
      for (let s = 1; s <= step; s++) gsap.delayedCall(1.6 + s * 0.6, () => steps[s]());
    },
    step(step) {
      steps[step]();
    },
    leave() {
      close(el);
      reveal($$('.rv', el), false);
    },
  };

  return [sRoutes];
}
