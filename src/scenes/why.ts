import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene } from '../deck';
import { why, chapter1 } from '../content';
import { MOL, atomXYZ, type Ligand, type Molecule } from '../data/molecules';
import { Cartoon } from '../three/cartoon';
import { Surface } from '../three/surface';
import { BallStick } from '../three/ballstick';
import { ANCHOR, C, shot } from '../three/world';
import { $, $$, words, reveal, open, close, section } from '../ui/text';
import { badge, type Ctx } from './ctx';

const centroid = (l: Ligand) => {
  const c = new THREE.Vector3();
  l.atoms.forEach(([, x, y, z]) => c.add(new THREE.Vector3(x, y, z)));
  return c.multiplyScalar(1 / l.atoms.length);
};
const ligandXYZ = (l: Ligand) => new Float32Array(l.atoms.flatMap(([, x, y, z]) => [x, y, z]));
const elements = (m: Molecule) => m.atoms.map((a) => a[0]);
/** A copy of a ligand moved so its centroid sits at the origin. */
const recentred = (l: Ligand): Ligand => {
  const c = centroid(l);
  return { ...l, atoms: l.atoms.map(([e, x, y, z]) => [e, x - c.x, y - c.y, z - c.z]) };
};
/**
 * The direction in which a pocket opens: from its centre, the ray that passes closest to the
 * fewest protein atoms. Used to face pockets toward the camera and to aim docking paths.
 */
function openingOf(centre: THREE.Vector3, m: Molecule) {
  const atoms = m.atoms.map(([, , , x, y, z]) => new THREE.Vector3(x, y, z).sub(centre)).filter((a) => a.lengthSq() < 30 * 30);
  const d = new THREE.Vector3();
  let best = new THREE.Vector3(0, 0, 1);
  let bestScore = Infinity;
  for (let i = 0; i < 400; i++) {
    // Fibonacci sphere for an even spread of directions.
    const y = 1 - (2 * (i + 0.5)) / 400;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    d.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
    let score = 0;
    for (const a of atoms) {
      const along = a.dot(d);
      if (along <= 0) continue;
      const off2 = a.lengthSq() - along * along;
      if (off2 < 36) score += 1 / (1 + along * 0.1);
    }
    if (score < bestScore) {
      bestScore = score;
      best = d.clone();
    }
  }
  return best;
}

/** The rotation that turns `dir` toward the camera (slightly upward). */
const facing = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(dir.clone().normalize(), new THREE.Vector3(0.12, 0.18, 1).normalize());

function turnTo(group: THREE.Group, q: THREE.Quaternion, duration = 2.2) {
  const from = group.quaternion.clone();
  const st = { t: 0 };
  return gsap.to(st, {
    t: 1,
    duration,
    ease: 'power3.inOut',
    onUpdate: () => void group.quaternion.slerpQuaternions(from, q, st.t),
  });
}

export function whyScenes(ctx: Ctx): Scene[] {
  const { world, chrome, notes, overlay } = ctx;
  const F = ANCHOR.function;
  const D = ANCHOR.drug;
  const head = { num: why.num, title: why.title };

  // -------------------------------------------------------------------------
  // Gallery: three real proteins, three jobs.
  // -------------------------------------------------------------------------
  const lyso = MOL.lysozyme;
  const nag = lyso.ligands[0];
  const pocketC = centroid(nag);
  const pocketDir = openingOf(pocketC, lyso);

  const lysoGroup = new THREE.Group();
  lysoGroup.position.copy(F).add(new THREE.Vector3(72, 0, 0));
  const lysoCartoon = new Cartoon(lyso);
  const lysoSurface = new Surface(atomXYZ(lyso), elements(lyso), { pocket: ligandXYZ(nag), pocketReach: 3.6 });
  const substrate = new BallStick([nag], { carbon: '#ff7d45' });
  const wrongLig = recentred(MOL.abl.ligands[0]);
  const wrong = new BallStick([wrongLig], { carbon: '#5c6b80' });
  // Ligands hang on pivots at their own centroid so they turn in place while docking.
  const subPivot = new THREE.Group();
  subPivot.position.copy(pocketC);
  substrate.group.position.copy(pocketC).negate();
  subPivot.add(substrate.group);
  lysoGroup.add(lysoCartoon.mesh, lysoSurface.mesh, subPivot, wrong.group);

  const HB = ['#0053d6', '#65cbf3', '#2f7fe6', '#9adcf7'].map((c) => new THREE.Color(c));
  const hbGroup = new THREE.Group();
  hbGroup.position.copy(F);
  const hbCartoon = new Cartoon(MOL.haemoglobin, { color: (ci, _t, out) => out.copy(HB[ci]) });
  const haem = new BallStick(MOL.haemoglobin.ligands, { carbon: '#c0392b', atomR: 0.5 });
  hbGroup.add(hbCartoon.mesh, haem.group);

  const camGroup = new THREE.Group();
  camGroup.position.copy(F).add(new THREE.Vector3(-78, 0, 0));
  const camCartoon = new Cartoon(MOL.calmodulin);
  const calcium = new BallStick(MOL.calmodulin.ligands, { ions: 3.2 });
  camGroup.add(camCartoon.mesh, calcium.group);
  camGroup.rotation.z = 0.5;

  [lysoCartoon, hbCartoon, camCartoon].forEach((c) => (c.draw = 0));
  lysoSurface.reveal = 0;
  substrate.build.p = 0;
  wrong.build.p = 0;
  haem.build.p = 0;
  calcium.build.p = 0;
  world.scene.add(lysoGroup, hbGroup, camGroup);

  // -------------------------------------------------------------------------
  // Drug design: ABL kinase and imatinib.
  // -------------------------------------------------------------------------
  const abl = MOL.abl;
  const sti = abl.ligands[0];
  const drugC = centroid(sti);
  const drugDir = openingOf(drugC, MOL.abl);
  const ablGroup = new THREE.Group();
  ablGroup.position.copy(D);
  const ablCartoon = new Cartoon(abl);
  const ablSurface = new Surface(atomXYZ(abl), elements(abl), { pocket: ligandXYZ(sti), pocketReach: 4 });
  ablSurface.uniforms.uPocketColor.value.set('#7fd3f7');
  const drug = new BallStick([sti], { carbon: '#ffb000' });
  const drugPivot = new THREE.Group();
  drugPivot.position.copy(drugC);
  drug.group.position.copy(drugC).negate();
  drugPivot.add(drug.group);
  ablGroup.add(ablCartoon.mesh, ablSurface.mesh, drugPivot);
  ablCartoon.draw = 0;
  ablSurface.reveal = 0;
  drug.build.p = 0;
  ablGroup.quaternion.copy(facing(drugDir));
  world.scene.add(ablGroup);

  let gallerySpin = false;
  world.onFrame((dt, t) => {
    if (gallerySpin) {
      lysoGroup.rotation.y += dt * 0.18;
      hbGroup.rotation.y += dt * 0.12;
      camGroup.rotation.y += dt * 0.16;
    }
    for (const s of [lysoSurface, ablSurface]) s.uniforms.uTime.value = t;
    for (const b of [substrate, wrong, haem, calcium, drug]) b.update();
  });

  const all = [lysoCartoon, hbCartoon, camCartoon, ablCartoon];
  function hideAll() {
    gallerySpin = false;
    all.forEach((c) => gsap.to(c, { draw: 0, duration: 0.8, overwrite: true }));
    [lysoSurface, ablSurface].forEach((s) => gsap.to(s, { reveal: 0, duration: 0.8, overwrite: true }));
    [substrate, wrong, haem, calcium, drug].forEach((b) => gsap.to(b.build, { p: 0, duration: 0.5, overwrite: true }));
    notes.hide('g-lyso', 'g-hb', 'g-cam', 'pocket', 'wrong', 'substrate', 'lost', 'abl-pocket', 'drug');
  }
  ctx.register('why', hideAll);

  const pocketWorld = () => lysoGroup.localToWorld(pocketC.clone());
  const drugWorld = () => ablGroup.localToWorld(drugC.clone());
  const below = (g: THREE.Object3D, r: number) => () => g.position.clone().add(new THREE.Vector3(0, -r, 0));

  notes
    .add('g-lyso', { anchor: below(lysoGroup, 16), html: `<b>لیزوزیم</b><span>${why.function.roles[0]}</span>`, at: [134, 82], tone: 'blue' })
    .add('g-hb', { anchor: below(hbGroup, 22), html: `<b>هموگلوبین</b><span>${why.function.roles[1]} (اکسیژن)</span>`, at: [82, 86], tone: 'blue' })
    .add('g-cam', { anchor: below(camGroup, 14), html: `<b>کالمودولین</b><span>${why.function.roles[2]}</span>`, at: [30, 80], tone: 'blue' })
    .add('pocket', {
      anchor: pocketWorld,
      html: `<b>جایگاه فعال</b><span class="ltr">Active Site / Binding Pocket</span>`,
      at: [78, 16],
      tone: 'sun',
    })
    .add('wrong', { anchor: () => wrong.group.localToWorld(new THREE.Vector3()), html: '<b>این مولکول در جیب جا نمی‌شود</b>', at: [8, 14], tone: 'alarm' })
    .add('substrate', {
      anchor: () => subPivot.localToWorld(new THREE.Vector3()),
      html: '<b>پیش‌ماده جا افتاد</b><span>کمپلکس آنزیم و پیش‌ماده</span>',
      at: [74, 86],
      tone: 'ink',
    })
    .add('lost', { anchor: () => subPivot.localToWorld(new THREE.Vector3()), html: '<b>اتصال از بین رفت</b>', at: [74, 86], tone: 'alarm' })
    .add('abl-pocket', { anchor: drugWorld, html: '<b>جیب اتصال پیدا شد</b>', at: [74, 16], tone: 'blue' })
    .add('drug', { anchor: () => drugPivot.localToWorld(new THREE.Vector3()), html: '<b>مولکول دارو</b><span>ایماتینیب، داروی ضدسرطان</span>', at: [70, 86], tone: 'ink' });

  // -------------------------------------------------------------------------
  // Overlay
  // -------------------------------------------------------------------------
  const elFunction = section(
    overlay,
    's-function',
    /* html */ `
    <div class="w-head">
      <p class="w-num">${why.num}</p>
      <h2 class="w-title split">${why.title}</h2>
    </div>
    <div class="w-point rv">${badge('۱')}<div><h3>${why.function.head}</h3><p>${why.function.body}</p></div></div>`,
  );

  const elActive = section(
    overlay,
    's-active w-col-scene',
    /* html */ `
    <div class="w-col">
      <div class="w-pt">${badge('۲')}<h3 class="split">${why.activeSite.head}</h3></div>
      <p class="w-term ltr">${why.activeSite.term}</p>
      <p class="w-body split">${why.activeSite.body}</p>
      <p class="w-rule rv">${why.activeSite.rule}</p>
    </div>`,
  );

  const elRegulation = section(
    overlay,
    's-regulation w-col-scene',
    /* html */ `
    <div class="w-col">
      <div class="w-pt">${badge('۳')}<h3 class="split">${why.regulation.head}</h3></div>
      <p class="w-body split">${why.regulation.body}</p>
      <aside class="callout alarm rv"><b>اگر شکل تغییر کند</b><span>${why.regulation.warning}</span></aside>
    </div>`,
  );

  const elDrug = section(
    overlay,
    's-drug w-col-scene',
    /* html */ `
    <div class="w-col">
      <div class="w-pt">${badge('۴')}<h3 class="split">${why.drug.head}</h3></div>
      <p class="w-body split">${why.drug.body}</p>
      <p class="w-rule rv">${why.drug.design}</p>
    </div>`,
  );

  // -------------------------------------------------------------------------
  // Scenes
  // -------------------------------------------------------------------------
  const galleryShot = shot(F, { px: -6, py: 22, pz: 245, tx: -3, ty: -6, oy: -0.17 });
  const activeShot = shot(lysoGroup.position, { px: 4, py: 6, pz: 96, ox: -0.23, oy: 0.02 });
  const regulationShot = shot(lysoGroup.position, { px: -14, py: 16, pz: 104, ox: -0.22, oy: 0 });
  const drugShot = shot(D, { px: 4, py: 8, pz: 128, ox: -0.22, oy: 0.02 });

  const sFunction: Scene = {
    id: 'function',
    label: why.function.head,
    head: { num: chapter1.num, title: chapter1.title },
    steps: 2,
    enter(step) {
      ctx.area('why');
      open(elFunction);
      world.fly(galleryShot, 2.8);
      world.fogTo(200, 600);
      gallerySpin = true;
      gsap.to(lysoSurface, { reveal: 0, duration: 0.6, overwrite: true });
      gsap.to([substrate.build, wrong.build], { p: 0, duration: 0.4, overwrite: true });
      [lysoCartoon, hbCartoon, camCartoon].forEach((c, i) => {
        c.dim = 0;
        gsap.to(c, { draw: 1, duration: 2.2, delay: 0.8 + i * 0.5, ease: 'power2.inOut', overwrite: true });
      });
      gsap.to([haem.build, calcium.build], { p: 1, duration: 1.2, delay: 2.4, overwrite: true });
      words($('.w-title', elFunction), 0.4, 0.06);
      gsap.fromTo($('.w-num', elFunction), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.3 });
      chrome.caption({ name: 'سه پروتئین واقعی', detail: 'PDB 1HEW، 4HHB، 1CLL', at: () => hbGroup.position }, 2.4);
      if (step >= 1) this.step!(1, 1);
    },
    step(step) {
      reveal($('.w-point', elFunction), step >= 1, 0.1);
      ['g-lyso', 'g-hb', 'g-cam'].forEach((id, i) => notes.show(id, step >= 1, 0.4 + i * 0.25));
    },
    leave() {
      close(elFunction);
      reveal($$('.rv', elFunction), false);
      notes.hide('g-lyso', 'g-hb', 'g-cam');
    },
  };

  // Active site: the cleft of lysozyme, a molecule that does not fit, and one that does.
  const faceLyso = facing(pocketDir);
  const away = (d: number) => pocketDir.clone().multiplyScalar(d);
  let tryTl: gsap.core.Timeline | undefined;

  function surfaceIn() {
    gallerySpin = false;
    turnTo(lysoGroup, faceLyso);
    gsap.to(lysoCartoon, { draw: 1, duration: 1, overwrite: true });
    [hbCartoon, camCartoon].forEach((c) => gsap.to(c, { draw: 0, duration: 1.2, overwrite: true }));
    gsap.to([haem.build, calcium.build], { p: 0, duration: 0.6, overwrite: true });
    gsap.fromTo(lysoSurface, { reveal: lysoSurface.reveal }, { reveal: 1.2, duration: 2.4, delay: 0.8, ease: 'power2.inOut', overwrite: true });
  }

  function tryWrong() {
    tryTl?.kill();
    const start = pocketC.clone().add(away(40));
    const stop = pocketC.clone().add(away(15));
    wrong.group.position.copy(start);
    wrong.group.rotation.set(0.4, 0.8, 0.2);
    tryTl = gsap
      .timeline()
      .to(wrong.build, { p: 1, duration: 0.6 })
      .to(wrong.group.position, { x: stop.x, y: stop.y, z: stop.z, duration: 1.3, ease: 'power2.in' }, 0.2)
      .add(() => notes.show('wrong', true))
      .to(wrong.group.rotation, { z: '+=0.25', duration: 0.07, yoyo: true, repeat: 5 })
      .to(wrong.group.position, { x: start.x, y: start.y, z: start.z, duration: 1.1, ease: 'power2.out' }, '+=0.3')
      .to(wrong.build, { p: 0, duration: 0.5 }, '-=0.5');
  }

  function dock(on: boolean, delay = 0) {
    gsap.killTweensOf([subPivot.position, subPivot.rotation, substrate.build]);
    if (on) {
      subPivot.position.copy(pocketC).add(away(34));
      subPivot.rotation.set(0.9, -0.6, 0.4);
      gsap.to(substrate.build, { p: 1, duration: 0.8, delay });
      gsap.to(subPivot.position, { x: pocketC.x, y: pocketC.y, z: pocketC.z, duration: 2, delay: delay + 0.4, ease: 'power3.inOut' });
      gsap.to(subPivot.rotation, { x: 0, y: 0, z: 0, duration: 2, delay: delay + 0.4, ease: 'power3.inOut' });
    } else gsap.to(substrate.build, { p: 0, duration: 0.5 });
  }

  const activeSteps = [
    () => {
      gsap.to(lysoSurface.uniforms.uPocket, { value: 0, duration: 0.5 });
      notes.hide('pocket');
    },
    () => {
      gsap.to(lysoSurface.uniforms.uPocket, { value: 1, duration: 1.2 });
      notes.show('pocket', true, 0.6);
      tryTl?.kill();
      gsap.to(wrong.build, { p: 0, duration: 0.3 });
      notes.hide('wrong');
    },
    () => {
      dock(false);
      notes.hide('substrate');
      reveal($('.w-rule', elActive), false);
      tryWrong();
    },
    () => {
      tryTl?.kill();
      gsap.to(wrong.build, { p: 0, duration: 0.4 });
      notes.hide('wrong');
      dock(true);
      notes.show('substrate', true, 2.4);
      reveal($('.w-rule', elActive), true, 1.6);
    },
  ];

  const sActive: Scene = {
    id: 'active-site',
    label: why.activeSite.head,
    head,
    steps: 4,
    enter(step) {
      ctx.area('why');
      open(elActive);
      world.fly(activeShot, 2.6);
      world.fogTo(150, 420);
      lysoSurface.uniforms.uDeform.value = 0;
      lysoSurface.uniforms.uBreath.value = 0;
      lysoSurface.uniforms.uPocketColor.value.set('#ffc20e');
      surfaceIn();
      words($('.w-pt h3', elActive), 0.4, 0.06);
      gsap.fromTo($('.w-term', elActive), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.8 });
      words($('.w-body', elActive), 0.9, 0.025);
      chrome.caption({ name: 'لیزوزیم با زنجیره‌ی قندی', detail: 'PDB 1HEW، سطح مولکولی', at: () => lysoGroup.position }, 1.6);
      for (let s = 0; s <= step; s++) gsap.delayedCall(s === 0 ? 0 : 2.4, () => activeSteps[s]());
    },
    step(step) {
      activeSteps[step]();
    },
    leave() {
      close(elActive);
      reveal($$('.rv', elActive), false);
      tryTl?.kill();
      gsap.to(wrong.build, { p: 0, duration: 0.3 });
      notes.hide('pocket', 'wrong', 'substrate');
    },
  };

  // Regulation: the surface breathes; if its shape changes, the substrate no longer fits.
  const regulationSteps = [
    () => {
      gsap.to(lysoSurface.uniforms.uDeform, { value: 0, duration: 1.6, ease: 'power2.inOut' });
      gsap.to(lysoSurface.uniforms.uBreath, { value: 1, duration: 1.2 });
      gsap.to(lysoSurface.uniforms.uPocketColor.value, { r: 1, g: 0.76, b: 0.055, duration: 1 });
      gsap.to(lysoSurface.uniforms.uPocket, { value: 1, duration: 0.8 });
      if (substrate.build.p < 0.99 || subPivot.position.distanceTo(pocketC) > 1) dock(true, 0.4);
      notes.hide('lost');
      reveal($('.callout', elRegulation), false);
    },
    () => {
      gsap.to(lysoSurface.uniforms.uDeform, { value: 1, duration: 2.6, ease: 'power2.inOut' });
      gsap.to(lysoSurface.uniforms.uPocketColor.value, { r: C.alarm.r, g: C.alarm.g, b: C.alarm.b, duration: 1.6, delay: 0.6 });
      gsap.killTweensOf([subPivot.position, subPivot.rotation]);
      // Thrown out toward the viewer (and a little left), so it stays inside the frame.
      const worldDir = new THREE.Vector3(-0.55, 0.35, 0.75).normalize();
      const out = pocketC.clone().add(worldDir.applyQuaternion(lysoGroup.quaternion.clone().invert()).multiplyScalar(28));
      gsap.to(subPivot.position, { x: out.x, y: out.y, z: out.z, duration: 2.2, delay: 1, ease: 'power2.out' });
      gsap.to(subPivot.rotation, { x: 2.2, y: -1.4, z: 0.8, duration: 2.6, delay: 1, ease: 'power1.out' });
      notes.show('lost', true, 2.2);
      reveal($('.callout', elRegulation), true, 1.4);
    },
  ];

  const sRegulation: Scene = {
    id: 'regulation',
    label: why.regulation.head,
    head,
    steps: 2,
    enter(step) {
      ctx.area('why');
      open(elRegulation);
      world.fly(regulationShot, 2.4);
      world.fogTo(150, 420);
      if (lysoSurface.reveal < 1) surfaceIn();
      else turnTo(lysoGroup, faceLyso, 1.2);
      words($('.w-pt h3', elRegulation), 0.4, 0.06);
      words($('.w-body', elRegulation), 0.8, 0.025);
      chrome.caption({ name: 'لیزوزیم', detail: 'تغییر شکل، نمایشی', at: () => lysoGroup.position }, 1.2);
      regulationSteps[0]();
      if (step >= 1) gsap.delayedCall(2.6, () => regulationSteps[1]());
    },
    step(step) {
      regulationSteps[step]();
    },
    leave() {
      close(elRegulation);
      reveal($$('.rv', elRegulation), false);
      notes.hide('lost', 'substrate');
      gsap.to(lysoSurface.uniforms.uBreath, { value: 0, duration: 0.6 });
      gsap.to(lysoSurface.uniforms.uDeform, { value: 0, duration: 1.2 });
      gsap.to(lysoSurface.uniforms.uPocketColor.value, { r: 1, g: 0.76, b: 0.055, duration: 0.6 });
    },
  };

  // Drug design: scan the target, find the pocket, build a molecule that fits it.
  const scanAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(ablGroup.quaternion.clone().invert());
  ablSurface.uniforms.uScanAxis.value.copy(scanAxis);
  const drugAway = (d: number) => drugDir.clone().multiplyScalar(d);

  // The drug site is buried: a cutaway opens a window onto it from the camera side.
  const cutCentre = drugC.clone().add(drugDir.clone().multiplyScalar(9));
  ablSurface.uniforms.uCut.value.set(cutCentre.x, cutCentre.y, cutCentre.z, 0);
  const cut = (r: number, delay = 0) => gsap.to(ablSurface.uniforms.uCut.value, { w: r, duration: 1.4, delay, ease: 'power2.inOut' });

  const drugSteps = [
    () => {
      gsap.to(ablSurface.uniforms.uPocket, { value: 0, duration: 0.5 });
      ablSurface.uniforms.uScan.value = -999;
      cut(0);
      notes.hide('abl-pocket');
    },
    () => {
      ablSurface.uniforms.uPocket.value = 0;
      gsap.fromTo(ablSurface.uniforms.uScan, { value: ablSurface.radius }, { value: -ablSurface.radius, duration: 3, ease: 'power1.inOut' });
      // The pocket lights up as the band passes over it.
      const pass = (ablSurface.radius - drugC.dot(scanAxis)) / (2 * ablSurface.radius);
      gsap.to(ablSurface.uniforms.uPocket, { value: 1, duration: 0.8, delay: 3 * pass });
      cut(15, 3 * pass);
      notes.show('abl-pocket', true, 3 * pass + 0.4);
      gsap.to(drug.build, { p: 0, duration: 0.4 });
      notes.hide('drug');
      reveal($('.w-rule', elDrug), false);
    },
    () => {
      cut(15);
      gsap.to(ablSurface.uniforms.uPocket, { value: 1, duration: 0.6 });
      gsap.killTweensOf([drugPivot.position, drug.build]);
      drugPivot.position.copy(drugC).add(drugAway(30));
      gsap.fromTo(drug.build, { p: 0 }, { p: 1, duration: 2.2, ease: 'none' });
      gsap.to(drugPivot.position, { x: drugC.x, y: drugC.y, z: drugC.z, duration: 2, delay: 2.2, ease: 'power3.inOut' });
      notes.hide('abl-pocket');
      notes.show('drug', true, 3.4);
      reveal($('.w-rule', elDrug), true, 0.6);
    },
  ];

  const sDrug: Scene = {
    id: 'drug',
    label: why.drug.head,
    head,
    steps: 3,
    enter(step) {
      ctx.area('why');
      open(elDrug);
      world.fly(drugShot, 3);
      world.fogTo(150, 460);
      gsap.fromTo(ablCartoon, { draw: 0 }, { draw: 1, duration: 2, delay: 1.2, ease: 'power2.inOut', overwrite: true });
      gsap.fromTo(ablSurface, { reveal: 0 }, { reveal: 1.2, duration: 2.4, delay: 2.6, ease: 'power2.inOut', overwrite: true });
      words($('.w-pt h3', elDrug), 0.6, 0.06);
      words($('.w-body', elDrug), 1, 0.025);
      chrome.caption({ name: 'کیناز ABL، پروتئین هدف', detail: 'PDB 1IEP، با داروی ایماتینیب', at: () => ablGroup.position }, 2);
      drugSteps[0]();
      for (let s = 1; s <= step; s++) gsap.delayedCall(3.6 + (s - 1) * 3.4, () => drugSteps[s]());
    },
    step(step) {
      drugSteps[step]();
    },
    leave() {
      close(elDrug);
      reveal($$('.rv', elDrug), false);
      notes.hide('abl-pocket', 'drug');
    },
  };

  return [sFunction, sActive, sRegulation, sDrug];
}
