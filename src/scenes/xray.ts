import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../deck';
import { hard } from '../content';
import { MOL } from '../data/molecules';
import { cartoonGeometry, cartoonMaterial } from '../three/cartoon';
import { ANCHOR, C, shot } from '../three/world';
import { beamMaterial, housing, steel, segment } from '../three/props';
import { $, $$, words, reveal, open, close, section } from '../ui/text';
import { pop, type Ctx } from './ctx';

// 1-3 (۱): X-ray crystallography as a working bench — source, crystal, detector.
export function xrayScenes(ctx: Ctx): Scene[] {
  const { world, chrome, notes, overlay } = ctx;
  const X = ANCHOR.xray;
  const root = new THREE.Group();
  root.position.copy(X);
  world.scene.add(root);

  // --- Source: a stylised X-ray tube -------------------------------------------------------
  const source = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 26, 48), housing());
  body.rotation.z = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 7, 6, 48), steel());
  nose.rotation.z = Math.PI / 2;
  nose.position.x = -16;
  const aperture = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.6, 16, 40), new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blue, emissiveIntensity: 0.6 }));
  aperture.rotation.y = Math.PI / 2;
  aperture.position.x = -19.2;
  source.add(body, nose, aperture);
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.5, 10, 48), steel());
    fin.rotation.y = Math.PI / 2;
    fin.position.x = 4 + i * 2;
    source.add(fin);
  }
  source.position.set(84, 0, 0);

  // --- Crystal: identical lysozyme molecules in a lattice --------------------------------------
  const lysoGeo = cartoonGeometry(MOL.lysozyme, { samples: 5, radial: 8 });
  const { material: lysoMat } = cartoonMaterial();
  const cells: THREE.Vector3[] = [];
  const SP = 13;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cells.push(new THREE.Vector3(x * SP, y * SP, z * SP));
  const crystal = new THREE.Group();
  const copies = new THREE.InstancedMesh(lysoGeo, lysoMat, cells.length);
  copies.frustumCulled = false;
  const S = 0.26;
  const loose = cells.map(() => ({
    p: new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 25),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
    seed: Math.random() * 100,
  }));
  const cellLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(SP * 3, SP * 3, SP * 3, 3, 3, 3)),
    new THREE.LineBasicMaterial({ color: '#7d93ad', transparent: true, opacity: 0 }),
  );
  crystal.add(copies, cellLines);
  crystal.rotation.set(0.35, -0.55, 0);
  const order = { t: 0, disorder: 0 };

  // --- Beam and detector ----------------------------------------------------------------------
  const beamA = new THREE.Vector3(64.5, 0, 0);
  const beamB = new THREE.Vector3(0, 0, 0);
  const beam = segment(beamA, beamB, 1.1, 1.1);
  const beamM = beamMaterial(C.blue, { pulses: 5 });
  beam.material = beamM.material;
  const halo = segment(beamA, beamB, 3, 3);
  const haloM = beamMaterial(C.sky, { pulses: 2 });
  halo.material = haloM.material;

  const detector = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 58, 58), housing());
  const face = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), new THREE.MeshStandardMaterial({ color: '#0e1d36', roughness: 0.6 }));
  face.rotation.y = Math.PI / 2;
  face.position.x = 2.05;
  const stop = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: '#05101f' }));
  stop.rotation.y = Math.PI / 2;
  stop.position.x = 2.1;
  detector.add(frame, face, stop);
  detector.position.set(-64, 0, 0);
  detector.rotation.y = -0.75;

  // Diffraction spots: a tilted reciprocal lattice inside a resolution circle.
  const spotPos: number[] = [];
  const spotData: number[] = [];
  const rays: THREE.Vector3[] = [];
  const tilt = 0.21;
  for (let h = -14; h <= 14; h++)
    for (let k = -14; k <= 14; k++) {
      if (!h && !k) continue;
      const x = (h * Math.cos(tilt) - k * Math.sin(tilt)) * 1.75;
      const y = (h * Math.sin(tilt) + k * Math.cos(tilt)) * 1.75;
      const r = Math.hypot(x, y) / 24;
      if (r > 1 || Math.random() < 0.35) continue;
      const I = Math.pow(Math.random(), 2.5) * (1.1 - r * 0.6);
      spotPos.push(2.2, y, -x);
      spotData.push(r, I, Math.random());
      if (I > 0.35 && rays.length < 80) rays.push(new THREE.Vector3(2.2, y, -x));
    }
  const spotGeo = new THREE.BufferGeometry();
  spotGeo.setAttribute('position', new THREE.Float32BufferAttribute(spotPos, 3));
  spotGeo.setAttribute('aData', new THREE.Float32BufferAttribute(spotData, 3));
  const spotU = { uT: { value: 0 }, uDisorder: { value: 0 }, uScale: { value: world.pointScale } };
  const spots = new THREE.Points(
    spotGeo,
    new THREE.ShaderMaterial({
      uniforms: spotU,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aData;
        uniform float uT; uniform float uDisorder; uniform float uScale;
        varying float vA;
        void main() {
          float r = aData.x; float I = aData.y;
          float show = smoothstep(r * 0.8 + aData.z * 0.2, r * 0.8 + aData.z * 0.2 + 0.1, uT);
          // Disorder wipes out high-resolution (outer) spots first and smears the rest.
          float lost = smoothstep(1.0 - uDisorder * 1.1, 1.0 - uDisorder * 1.1 + 0.25, r);
          vA = show * (0.35 + I) * (1.0 - lost) * (1.0 - uDisorder * 0.45);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.55 + I * 0.9) * (1.0 + uDisorder * 1.6) * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(mix(vec3(0.55, 0.85, 1.0), vec3(1.0), smoothstep(0.35, 0.0, d)), vA * smoothstep(0.5, 0.15, d));
          #include <colorspace_fragment>
        }`,
    }),
  );
  spots.frustumCulled = false;
  detector.add(spots);

  // Diffracted rays from the crystal to the brightest spots.
  const rayGeo = new THREE.BufferGeometry();
  const rayMat = new THREE.LineBasicMaterial({ color: C.sky, transparent: true, opacity: 0 });
  const rayLines = new THREE.LineSegments(rayGeo, rayMat);

  root.add(source, crystal, beam, halo, detector, rayLines);
  [source, crystal, detector].forEach((g) => {
    g.userData.scale = g.scale.x;
    g.scale.setScalar(0.001);
    g.visible = false;
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const e = new THREE.Euler();
  const IDENT = new THREE.Quaternion();
  const sc = new THREE.Vector3(S, S, S);
  const easeIn = gsap.parseEase('power3.inOut');
  world.onFrame((_, t) => {
    beamM.uniforms.uTime.value = haloM.uniforms.uTime.value = t;
    spotU.uScale.value = world.pointScale;
    if (!crystal.visible) return;
    crystal.rotation.y += 0.0012;
    cells.forEach((c, i) => {
      const k = easeIn(Math.min(1, Math.max(0, order.t * 1.6 - (i / cells.length) * 0.6)));
      const L = loose[i];
      v.lerpVectors(L.p, c, k);
      q.slerpQuaternions(L.q, IDENT, k);
      // Disorder: molecules wobble out of register.
      const d = order.disorder;
      if (d > 0) {
        v.x += Math.sin(t * 1.3 + L.seed) * 2.2 * d;
        v.y += Math.cos(t * 1.1 + L.seed * 2) * 2.2 * d;
        q.multiply(new THREE.Quaternion().setFromEuler(e.set(Math.sin(t + L.seed) * 0.5 * d, Math.cos(t * 0.8 + L.seed) * 0.6 * d, 0)));
      }
      m.compose(v, q, sc);
      copies.setMatrixAt(i, m);
    });
    copies.instanceMatrix.needsUpdate = true;
    (cellLines.material as THREE.LineBasicMaterial).opacity = Math.max(0, order.t * 1.3 - 0.4) * (1 - order.disorder) * 0.7;
  });

  function buildRays() {
    detector.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const pts: THREE.Vector3[] = [];
    rays.forEach((r) => {
      pts.push(new THREE.Vector3(0, 0, 0));
      pts.push(detector.localToWorld(r.clone()).applyMatrix4(inv));
    });
    rayGeo.setFromPoints(pts);
  }

  function hide() {
    [source, crystal, detector].forEach((g) => pop(g, false));
    gsap.to([beamM.uniforms.uOn, haloM.uniforms.uOn, spotU.uT], { value: 0, duration: 0.4 });
    gsap.to(rayMat, { opacity: 0, duration: 0.3 });
    gsap.to(order, { t: 0, disorder: 0, duration: 0.6 });
    notes.hide('x-crystal', 'x-beam', 'x-pattern', 'x-bad');
  }
  ctx.register('xray', hide);

  const el = section(
    overlay,
    's-xray',
    /* html */ `
    <div class="x-head">
      <p class="w-num">${hard.num}</p>
      <p class="x-section split">${hard.title}</p>
      <h2 class="x-title split"><span>۱. ${hard.xray.name}</span> <span class="ltr x-latin">${hard.xray.latin}</span></h2>
    </div>
    <ol class="stages">
      <li class="step-card rv"><b>۱</b><span>${hard.xray.steps[0]}</span></li>
      <li class="step-card rv"><b>۲</b><span>${hard.xray.steps[1]}</span></li>
    </ol>
    <aside class="callout alarm x-problem rv"><b>${hard.problemLabel}</b><span>${hard.xray.problem}</span></aside>`,
  );

  const wp = (o: THREE.Object3D, p: THREE.Vector3) => () => o.localToWorld(p.clone());
  notes
    .add('x-crystal', { anchor: wp(crystal, new THREE.Vector3(0, 20, 0)), html: '<b>بلور (کریستال) پروتئین</b><span>مولکول‌های یکسان، منظم کنار هم</span>', at: [44, 72], tone: 'ink' })
    .add('x-beam', { anchor: wp(root, new THREE.Vector3(40, 0, 0)), html: '<b>پرتو ایکس</b>', at: [64, 22], tone: 'blue' })
    .add('x-pattern', { anchor: wp(detector, new THREE.Vector3(2, 14, -10)), html: '<b>الگوی پراش</b><span>محاسبه‌ی موقعیت اتم‌ها</span>', at: [4, 72], tone: 'blue' })
    .add('x-bad', { anchor: wp(crystal, new THREE.Vector3(0, -20, 0)), html: '<b>بلور نامنظم</b><span>نقطه‌های الگوی پراش محو می‌شوند</span>', at: [44, 72], tone: 'alarm' });

  const steps = [
    () => {
      gsap.to(order, { t: 1, duration: 3.4, delay: 0.6, ease: 'none' });
      gsap.to(order, { disorder: 0, duration: 1 });
      gsap.to([beamM.uniforms.uOn, haloM.uniforms.uOn, spotU.uT], { value: 0, duration: 0.6 });
      gsap.to(spotU.uDisorder, { value: 0, duration: 0.6 });
      gsap.to(rayMat, { opacity: 0, duration: 0.4 });
      notes.show('x-crystal', true, 2.8);
      notes.hide('x-beam', 'x-pattern', 'x-bad');
      reveal($$('.step-card', el)[0], true, 0.6);
      reveal($$('.step-card', el)[1], false);
      reveal($('.x-problem', el), false);
    },
    () => {
      gsap.to(order, { t: 1, disorder: 0, duration: 0.6 });
      buildRays();
      gsap.fromTo(beamM.uniforms.uOn, { value: 0 }, { value: 1, duration: 0.9, ease: 'power2.in' });
      gsap.fromTo(haloM.uniforms.uOn, { value: 0 }, { value: 1, duration: 0.9, ease: 'power2.in' });
      gsap.to(rayMat, { opacity: 0.22, duration: 0.8, delay: 0.9 });
      gsap.fromTo(spotU.uT, { value: 0 }, { value: 1.15, duration: 2.6, delay: 1, ease: 'power1.inOut' });
      gsap.to(spotU.uDisorder, { value: 0, duration: 0.6 });
      notes.show('x-beam', true, 0.6);
      notes.show('x-pattern', true, 2.2);
      notes.hide('x-bad');
      reveal($$('.step-card', el)[1], true, 0.4);
      reveal($('.x-problem', el), false);
    },
    () => {
      gsap.to(order, { disorder: 1, duration: 2.4, ease: 'power2.inOut' });
      gsap.to(spotU.uDisorder, { value: 1, duration: 2.4, ease: 'power2.inOut' });
      gsap.to(rayMat, { opacity: 0.06, duration: 1.6 });
      notes.hide('x-crystal');
      notes.show('x-bad', true, 1.2);
      reveal($('.x-problem', el), true, 0.6);
    },
  ];

  const sXray: Scene = {
    id: 'xray',
    label: hard.xray.name,
    head: { num: hard.num, title: hard.title },
    steps: 3,
    enter(step) {
      ctx.area('xray');
      open(el);
      world.fly(shot(X, { px: 4, py: 26, pz: 310, tx: 4, ty: 0, ox: -0.22, oy: 0.04 }), 3);
      world.fogTo(240, 600);
      pop(source, true, { delay: 0.8 });
      pop(crystal, true, { delay: 1 });
      pop(detector, true, { delay: 1.2 });
      gsap.set(order, { t: 0, disorder: 0 });
      words($('.x-section', el), 0.3, 0.04);
      words($('.x-title', el), 0.6, 0.08);
      gsap.fromTo($('.w-num', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      chrome.caption({ name: 'طرح‌واره‌ی آزمایش', detail: 'مولکول‌های بلور: لیزوزیم، PDB 1HEW', at: () => crystal.getWorldPosition(new THREE.Vector3()) }, 2);
      steps[0]();
      for (let s = 1; s <= step; s++) gsap.delayedCall(2 + s * 1.2, () => steps[s]());
    },
    step(step) {
      steps[step]();
    },
    leave() {
      close(el);
      reveal($$('.rv', el), false);
    },
  };

  return [sXray];
}
