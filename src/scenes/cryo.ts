import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../deck';
import { hard } from '../content';
import { MOL } from '../data/molecules';
import { cartoonGeometry, cartoonMaterial } from '../three/cartoon';
import { ANCHOR, C, shot } from '../three/world';
import { beamMaterial, copper, housing, steel, segment } from '../three/props';
import { $, $$, words, reveal, open, close, section } from '../ui/text';
import { pop, type Ctx } from './ctx';

/** A grainy electron micrograph: noisy grey with faint particle shadows. */
function micrograph(spots: { x: number; y: number; r: number; a: number }[]) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#9ba3ad';
  g.fillRect(0, 0, S, S);
  for (const s of spots) {
    const grad = g.createRadialGradient(s.x * S, s.y * S, 0, s.x * S, s.y * S, s.r * S);
    grad.addColorStop(0, `rgba(30,38,50,${s.a})`);
    grad.addColorStop(0.7, `rgba(40,48,60,${s.a * 0.6})`);
    grad.addColorStop(1, 'rgba(40,48,60,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(s.x * S, s.y * S, s.r * S, s.r * S * (0.7 + Math.random() * 0.3), Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 90;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 1-3 (۲): Cryo-EM — freeze, image, and then drown in data.
export function cryoScenes(ctx: Ctx): Scene[] {
  const { world, chrome, notes, overlay } = ctx;
  const Y = ANCHOR.cryo;
  const root = new THREE.Group();
  root.position.copy(Y);
  world.scene.add(root);

  // --- Microscope column (only its lower end is in view) ---------------------------------------
  const column = new THREE.Group();
  const profile = [
    [0, 0], [4, 0], [5.5, 3], [9, 4.5], [9, 14], [12, 16], [12, 30], [8.5, 32], [8.5, 46], [13, 48], [13, 70], [9.5, 72], [9.5, 120], [0, 120],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  column.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), housing()));
  for (const y of [4.5, 16, 32, 48, 72]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(y === 4.5 ? 9 : y === 32 ? 8.5 : y === 72 ? 9.5 : 12.4, 0.7, 12, 64), steel());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    column.add(ring);
  }
  column.position.set(-24, 34, 0);

  // --- Sample: a thin layer of ice in a copper grid, with molecules inside -----------------------
  const sample = new THREE.Group();
  sample.position.set(-24, 0, 0);
  const hbGeo = cartoonGeometry(MOL.haemoglobin, { samples: 3, radial: 6 });
  const { material: hbMat } = cartoonMaterial();
  const N = 14;
  const parts = new THREE.InstancedMesh(hbGeo, hbMat, N);
  parts.frustumCulled = false;
  const pdata = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const r = 6 + Math.random() * 14;
    return {
      p: new THREE.Vector3(Math.cos(a) * r, (Math.random() - 0.5) * 2, Math.sin(a) * r),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
      w: new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random()),
    };
  });
  const ice = new THREE.Mesh(
    new THREE.CylinderGeometry(25, 25, 9, 96),
    new THREE.MeshPhysicalMaterial({ color: '#cfeeff', transparent: true, opacity: 0.12, roughness: 0.08, clearcoat: 1, depthWrite: false }),
  );
  const rim = new THREE.Mesh(new THREE.TorusGeometry(26.2, 1.4, 16, 96), copper());
  rim.rotation.x = Math.PI / 2;
  sample.add(parts, ice, rim);
  for (let k = 0; k < 4; k++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 2.4), copper());
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    bar.position.set(Math.cos(a) * 37, 0, Math.sin(a) * 37);
    bar.rotation.y = -a;
    sample.add(bar);
  }
  sample.rotation.x = 0.32;
  const frostPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 25;
    frostPos.set([Math.cos(a) * r, 4.6 + Math.random() * 0.6, Math.sin(a) * r], i * 3);
  }
  const frostGeo = new THREE.BufferGeometry();
  frostGeo.setAttribute('position', new THREE.BufferAttribute(frostPos, 3));
  const frostMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.6, transparent: true, opacity: 0, depthWrite: false });
  sample.add(new THREE.Points(frostGeo, frostMat));
  const freeze = { t: 0 };

  // --- Electron beam --------------------------------------------------------------------------
  const beam = segment(new THREE.Vector3(-24, 33, 0), new THREE.Vector3(-24, 2, 0), 1.4, 17);
  const beamM = beamMaterial(C.sky, { pulses: 4 });
  beam.material = beamM.material;

  // --- Micrograph -------------------------------------------------------------------------------
  const spots = Array.from({ length: 34 }, () => ({ x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84, r: 0.035 + Math.random() * 0.02, a: 0.35 + Math.random() * 0.3 }));
  const micro = micrograph(spots);
  const shotU = { uMap: { value: micro }, uReveal: { value: 0 } };
  const photo = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(48, 48, 1.6), housing());
  const img = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 44),
    new THREE.ShaderMaterial({
      uniforms: shotU,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uReveal; varying vec2 vUv;
        void main() {
          float edge = 1.0 - uReveal;
          if (vUv.y < edge) discard;
          vec3 c = texture2D(uMap, vUv).rgb;
          c = mix(c, vec3(0.7, 0.9, 1.0), smoothstep(0.02, 0.0, vUv.y - edge) * step(uReveal, 0.999));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  img.position.z = 0.85;
  photo.add(plate, img);
  photo.position.set(-96, 4, 0);
  photo.rotation.y = 0.28;

  // --- Data: thousands of particle images pile up --------------------------------------------
  const COLS = 26;
  const ROWS = 16;
  const NT = COLS * ROWS;
  const tileGeo = new THREE.PlaneGeometry(2.7, 2.7);
  const crop = new Float32Array(NT * 2);
  for (let i = 0; i < NT; i++) {
    const s = spots[i % spots.length];
    crop[i * 2] = s.x - 0.04 + (Math.random() - 0.5) * 0.01;
    crop[i * 2 + 1] = 1 - s.y - 0.04 + (Math.random() - 0.5) * 0.01;
  }
  tileGeo.setAttribute('aCrop', new THREE.InstancedBufferAttribute(crop, 2));
  const tiles = new THREE.InstancedMesh(
    tileGeo,
    new THREE.ShaderMaterial({
      uniforms: { uMap: { value: micro } },
      vertexShader: /* glsl */ `
        attribute vec2 aCrop; varying vec2 vUv;
        void main(){ vUv = aCrop + uv * 0.08; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
    NT,
  );
  tiles.frustumCulled = false;
  const slots = Array.from({ length: NT }, (_, i) => new THREE.Vector3(-128 + (i % COLS) * 3.05, 30 + Math.floor(i / COLS) * 3.05, -60));
  const flow = { t: 0 };

  root.add(column, sample, beam, photo, tiles);
  [column, sample, photo].forEach((g) => {
    g.scale.setScalar(0.001);
    g.visible = false;
  });
  tiles.visible = false;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const dq = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(0.17, 0.17, 0.17);
  const src = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  world.onFrame((dt, t) => {
    beamM.uniforms.uTime.value = t;
    if (sample.visible) {
      sample.rotation.y += dt * 0.08;
      pdata.forEach((d, i) => {
        // Molecules tumble in liquid; the frost front (moving right to left) stops them.
        const local = Math.min(1, Math.max(0, freeze.t * 1.4 - (0.5 - d.p.x / 50) * 0.4));
        const speed = 1 - local;
        if (speed > 0.001) {
          dq.setFromAxisAngle(v.copy(d.w).normalize(), d.w.length() * dt * speed * 1.4);
          d.q.premultiply(dq);
        }
        m.compose(v.copy(d.p).add(new THREE.Vector3(Math.sin(t + i) * speed, Math.cos(t * 0.8 + i) * speed * 0.6, 0)), d.q, sc);
        parts.setMatrixAt(i, m);
      });
      parts.instanceMatrix.needsUpdate = true;
      (ice.material as THREE.MeshPhysicalMaterial).opacity = 0.08 + freeze.t * 0.2;
      frostMat.opacity = freeze.t * (0.4 + 0.2 * Math.sin(t * 3));
    }
    if (tiles.visible) {
      for (let i = 0; i < NT; i++) {
        const k = Math.min(1, Math.max(0, flow.t * 1.8 - (i / NT) * 0.8));
        const s = spots[i % spots.length];
        src.set(photo.position.x + (s.x - 0.5) * 44, photo.position.y + (0.5 - s.y) * 44, 1);
        v.lerpVectors(src, slots[i], k * k * (3 - 2 * k));
        v.y += Math.sin(k * Math.PI) * 18;
        m.compose(v, q.identity(), one.setScalar(k > 0 ? 0.4 + k * 0.6 : 0.0001));
        tiles.setMatrixAt(i, m);
      }
      tiles.instanceMatrix.needsUpdate = true;
    }
  });

  function hide() {
    [column, sample, photo].forEach((g) => pop(g, false));
    gsap.to([beamM.uniforms.uOn, shotU.uReveal], { value: 0, duration: 0.4 });
    gsap.to(freeze, { t: 0, duration: 0.5 });
    gsap.to(flow, { t: 0, duration: 0.4, overwrite: true, onComplete: () => void (tiles.visible = false) });
    notes.hide('c-scope', 'c-ice', 'c-photo', 'c-data');
  }
  ctx.register('cryo', hide);

  const el = section(
    overlay,
    's-cryo',
    /* html */ `
    <div class="x-head">
      <p class="w-num">${hard.num}</p>
      <p class="x-section split">${hard.title}</p>
      <h2 class="x-title split"><span>۲. ${hard.cryo.name}</span> <span class="ltr x-latin">${hard.cryo.latin}</span></h2>
    </div>
    <ol class="stages">
      <li class="step-card rv"><b>۱</b><span>${hard.cryo.steps[0]}</span></li>
      <li class="step-card rv"><b>۲</b><span>${hard.cryo.steps[1]}</span></li>
    </ol>
    <aside class="callout alarm x-problem rv"><b>${hard.problemLabel}</b><span>${hard.cryo.problem.join(' ')}</span></aside>`,
  );

  const wp = (o: THREE.Object3D, p: THREE.Vector3) => () => o.localToWorld(p.clone());
  notes
    .add('c-scope', { anchor: wp(column, new THREE.Vector3(12, 22, 0)), html: '<b>میکروسکوپ الکترونی</b>', at: [79, 31], tone: 'ink' })
    .add('c-ice', { anchor: wp(sample, new THREE.Vector3(18, 4, 0)), html: '<b>لایه‌ی نازک یخ</b><span>نمونه‌های منجمد</span>', at: [80, 76], tone: 'blue' })
    .add('c-photo', { anchor: wp(photo, new THREE.Vector3(6, -22, 1)), html: '<b>تصویر میکروسکوپی</b><span>پرنویز و کم‌کنتراست</span>', at: [4, 76], tone: 'ink' })
    .add('c-data', { anchor: () => root.localToWorld(new THREE.Vector3(-127, 31, -60)), html: '<b>انبوه داده‌ی تصویری</b><span>پردازش بسیار سنگین</span>', at: [4, 78], tone: 'alarm' });

  const steps = [
    () => {
      gsap.fromTo(freeze, { t: 0 }, { t: 1, duration: 3, delay: 1.6, ease: 'power1.inOut' });
      gsap.to([beamM.uniforms.uOn, shotU.uReveal], { value: 0, duration: 0.5 });
      pop(photo, false);
      gsap.to(flow, { t: 0, duration: 0.4, overwrite: true, onComplete: () => void (tiles.visible = false) });
      notes.show('c-ice', true, 3.2);
      notes.hide('c-photo', 'c-data');
      reveal($$('.step-card', el)[0], true, 0.8);
      reveal($$('.step-card', el)[1], false);
      reveal($('.x-problem', el), false);
    },
    () => {
      gsap.to(freeze, { t: 1, duration: 0.6 });
      gsap.fromTo(beamM.uniforms.uOn, { value: 0 }, { value: 1, duration: 1, ease: 'power2.in' });
      pop(photo, true, { delay: 0.6 });
      gsap.fromTo(shotU.uReveal, { value: 0 }, { value: 1, duration: 2.4, delay: 1.4, ease: 'none' });
      notes.show('c-scope', true, 0.4);
      notes.show('c-photo', true, 2.2);
      notes.hide('c-data');
      gsap.to(flow, { t: 0, duration: 0.4, overwrite: true, onComplete: () => void (tiles.visible = false) });
      reveal($$('.step-card', el)[1], true, 0.4);
      reveal($('.x-problem', el), false);
    },
    () => {
      gsap.killTweensOf(flow);
      tiles.visible = true;
      gsap.fromTo(flow, { t: 0 }, { t: 1, duration: 4, ease: 'power1.in' });
      notes.hide('c-ice', 'c-photo');
      notes.show('c-data', true, 2);
      reveal($('.x-problem', el), true, 0.6);
    },
  ];

  const sCryo: Scene = {
    id: 'cryo',
    label: hard.cryo.name,
    head: { num: hard.num, title: hard.title },
    steps: 3,
    enter(step) {
      ctx.area('cryo');
      open(el);
      world.fly(shot(Y, { px: -50, py: 30, pz: 250, tx: -52, ty: 4, ox: -0.24, oy: 0 }), 3);
      world.fogTo(240, 640);
      pop(column, true, { delay: 0.8 });
      pop(sample, true, { delay: 1 });
      gsap.set(freeze, { t: 0 });
      words($('.x-section', el), 0.3, 0.04);
      words($('.x-title', el), 0.6, 0.08);
      gsap.fromTo($('.w-num', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
      chrome.caption({ name: 'طرح‌واره‌ی آزمایش', detail: 'ذره‌ها: هموگلوبین، PDB 4HHB', at: () => sample.getWorldPosition(new THREE.Vector3()) }, 2);
      steps[0]();
      for (let s = 1; s <= step; s++) gsap.delayedCall(2.4 + s * 1.4, () => steps[s]());
    },
    step(step) {
      steps[step]();
    },
    leave() {
      close(el);
      reveal($$('.rv', el), false);
    },
  };

  return [sCryo];
}
