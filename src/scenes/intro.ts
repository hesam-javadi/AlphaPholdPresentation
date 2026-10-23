import gsap from 'gsap';
import * as THREE from 'three';
import type { Scene, Dir } from '../deck';
import { cover, title, definition, puzzle, chapter1, basics, why, routes, hard, homology, bioinf, msaInfo, fa } from '../content';
import { MOL, aminoAcidFa } from '../data/molecules';
import { Chain, Atoms, Dust, FOLDED, N, SEQ, linePose, textPoints } from '../three/chain';
import { Cartoon } from '../three/cartoon';
import { Lattice, Cloud } from '../three/puzzle';
import { spectrum, ANCHOR, shot, type Shot } from '../three/world';
import { $, $$, words, reveal, open, close, section } from '../ui/text';
import type { Ctx } from './ctx';

/** World width of the cover word. */
const COVER_W = 126;
const hex = (i: number) => `#${spectrum(i / (N - 1)).getHexString()}`;
const seqSpans = (cls = '') => [...SEQ].map((c, i) => `<span class="${cls}" style="--c:${hex(i)}">${c}</span>`).join('');

export function introScenes(ctx: Ctx): Scene[] & { prepare: () => Promise<void> } {
  const { world, chrome, notes, overlay } = ctx;

  // -------------------------------------------------------------------------
  // World objects shared by the intro
  // -------------------------------------------------------------------------
  const chain = new Chain();
  const atoms = new Atoms(chain);
  const dust = new Dust(3600);
  const lattice = new Lattice();
  const cloud = new Cloud(lattice.spacing);
  // Same depth as the crystal so the size difference on screen is honest.
  cloud.points.position.set(-81, 0, 0);
  const ribbon = new Cartoon(MOL.ubiquitin);
  ribbon.draw = 0;
  chain.group.add(ribbon.mesh);
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: N }, (_, i) => new THREE.Vector3().fromArray(FOLDED, i * 3)));
  const ghost = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 400, 2.6, 16, false),
    new THREE.MeshPhysicalMaterial({ color: '#65cbf3', transparent: true, opacity: 0, roughness: 0.2, depthWrite: false }),
  );
  ghost.visible = false;
  chain.group.add(ghost);
  world.scene.add(chain.group, dust.mesh, lattice.group, cloud.points);
  world.onFrame((dt, t) => {
    chain.update(dt);
    atoms.update();
    dust.update(t);
    lattice.update();
  });
  (cloud.uniforms.uScale as THREE.IUniform).value = world.pointScale;
  addEventListener('resize', () => ((cloud.uniforms.uScale as THREE.IUniform).value = world.pointScale));

  const A = ANCHOR.intro;
  const SHOT: Record<string, Shot> = {
    cover: shot(A, { pz: 165, oy: 0 }),
    title: shot(A, { px: -8, py: 10, pz: 92, ox: -0.2, oy: 0.02 }),
    define: shot(A, { py: 4, pz: 124, ox: -0.28, oy: 0.08 }),
    crystal: shot(A, { px: 13, py: 10, pz: 27, ty: -0.5, ox: -0.13, oy: -0.02 }),
    database: shot(A, { px: -6, py: 14, pz: 268, tx: -6, ox: 0, oy: -0.05 }),
    numeral: shot(A, { pz: 165, ox: 0.2, oy: 0.04 }),
    line: shot(A, { pz: 100 }),
    fold: shot(A, { py: 6, pz: 100, ox: -0.25, oy: 0.04 }),
  };
  const LINE = linePose(new THREE.Vector3(2, -18, 20), new THREE.Vector3(-103, 46, -140));
  const PILLAR = linePose(new THREE.Vector3(0, 31, 0), new THREE.Vector3(0, -1, 0), 0.82);
  let textPose = new Float32Array(dust.count * 3);
  let first = true;
  const ubqCaption = { name: 'یوبیکوئیتین', detail: 'PDB 1UBQ، ۷۶ اسید آمینه', at: () => chain.centre() };

  /** Hide everything the intro owns (used when another area takes over). */
  function clearWorld(keep: { chain?: boolean; dust?: boolean } = {}) {
    if (!keep.dust && dust.visible) dust.scatter();
    if (!keep.chain && chain.visible) chain.show(false, { duration: 0.5, stagger: 0.5 });
    if (atoms.state.t > 0) atoms.reveal(false);
    hideGhost();
    if (ribbon.draw > 0) gsap.to(ribbon, { draw: 0, duration: 0.6, overwrite: true });
    if (lattice.state.n > 0) gsap.to(lattice.state, { n: 0, duration: 0.8, ease: 'power2.in', overwrite: true });
    if (cloud.t > 0) gsap.to(cloud, { t: 0, duration: 0.9, ease: 'power2.in', overwrite: true });
    chain.focus.k = 0;
    showLabels(false);
  }
  ctx.register('intro', () => clearWorld());

  function hideGhost() {
    const m = ghost.material as THREE.MeshPhysicalMaterial;
    gsap.to(m, { opacity: 0, duration: 0.5, overwrite: true, onComplete: () => void (ghost.visible = false) });
  }

  // -------------------------------------------------------------------------
  // Overlay
  // -------------------------------------------------------------------------
  // Cover: the word AlphaFold in particles, with the authors underneath.
  const elCover = section(
    overlay,
    's-cover',
    /* html */ `
    <div class="cv-credits">
      <p class="cv-by rv">${cover.by}</p>
      <p class="cv-row rv"><span>${cover.teacher}</span><i></i><span>${cover.course}</span></p>
    </div>`,
  );

  const elTitle = section(
    overlay,
    's-title',
    /* html */ `
    <div class="t-block">
      <h1 class="t-name split">${title.name}</h1>
      <p class="t-q split">${title.question}</p>
      <div class="t-meta rv">
        <span class="pill ltr">${title.org}</span>
        <span>پیش‌بینی ساختار سه‌بعدی پروتئین با یادگیری عمیق</span>
      </div>
      <p class="t-seq ltr rv" aria-label="توالی یوبیکوئیتین">${seqSpans()}</p>
    </div>`,
  );

  const elDefine = section(
    overlay,
    's-define',
    /* html */ `
    <div class="d-text">
      <p class="d-lead split">${definition.lead}</p>
      <p class="d-claim split">${definition.claim}</p>
    </div>
    <div class="d-acc rv">
      <p class="d-acc-text">${definition.accuracy}</p>
      <p class="legend"><i class="sw sw-ghost"></i>ساختار تعیین‌شده در آزمایشگاه<i class="sw sw-ribbon"></i>ساختار پیش‌بینی‌شده</p>
    </div>
    <div class="d-input">
      <div class="dim"><span>${definition.input}</span><small>۷۶ اسید آمینه</small></div>
      <p class="d-seq ltr" aria-label="توالی یوبیکوئیتین">${seqSpans()}</p>
    </div>`,
  );

  const elPuzzle = section(
    overlay,
    's-puzzle',
    /* html */ `
    <h2 class="p-title split">${puzzle.title}</h2>
    <div class="p-exp p-col">
      <h3>${puzzle.experimental.name}</h3>
      <p class="p-methods ltr">${puzzle.experimental.methods}</p>
      <p class="p-traits">${puzzle.experimental.traits.join('، ')}</p>
      <div class="p-stats">
        <p class="p-stat"><b class="exp-years">۰</b> سال</p>
        <p class="p-stat"><b class="exp-count">۰</b> ${puzzle.experimental.countLabel}</p>
      </div>
      <div class="timeline" aria-hidden="true">
        <i class="tl-fill"></i>
        <span style="--x:0">۰</span><span style="--x:0.333">۲۰</span><span style="--x:0.667">۴۰</span><span style="--x:1">۶۰ سال</span>
      </div>
      <p class="p-key"><i class="key-cube"></i>هر مکعب = ۱٬۰۰۰ ساختار</p>
    </div>
    <div class="p-ai p-col rv">
      <h3>${puzzle.ai.name}</h3>
      <p class="p-methods ltr">${puzzle.ai.model}</p>
      <p class="p-traits">${puzzle.ai.traits.join('، ')}</p>
      <p class="p-stat p-big">بیش از <b class="ai-count">۰</b> میلیون ساختار</p>
      <p class="p-gdt">${puzzle.ai.gdt.replace('GDT > 90', '<span class="ltr">GDT&nbsp;&gt;&nbsp;90</span>')}</p>
      <p class="p-key"><i class="key-dot"></i>هر نقطه = ۱٬۰۰۰ ساختار</p>
    </div>
    <p class="p-conclusion rv">${puzzle.conclusion}</p>`,
  );

  const elChapter = section(
    overlay,
    's-chapter',
    /* html */ `
    <div class="ch-block">
      <h2 class="ch-title split">${chapter1.title}</h2>
      <ol class="toc">
        <li class="rv"><b>${chapter1.num}</b>${basics.title}</li>
        <li class="rv"><b>${why.num}</b>${why.title}</li>
        <li class="rv"><b>${routes.num}</b>${routes.title}</li>
        <li class="rv"><b>${hard.num}</b>${hard.title}</li>
        <li class="rv"><b>${homology.num}</b>${homology.title}</li>
        <li class="rv"><b>${bioinf.num}</b>${bioinf.title}</li>
        <li class="rv"><b>${msaInfo.num}</b>${msaInfo.title}</li>
      </ol>
    </div>`,
  );

  const elBasics = section(
    overlay,
    's-basics',
    /* html */ `
    <h2 class="b-title split">${basics.title}</h2>
    <p class="b-lead split">${basics.protein} ${basics.sequence}</p>
    <ul class="b-list">
      ${basics.bullets.map((b, i) => `<li class="rv"><i style="--c:${hex(i * 30)}"></i><span>${b}</span></li>`).join('')}
    </ul>
    <aside class="b-note callout rv"><b>توجه</b><span>${basics.note}</span></aside>`,
  );

  document.body.insertAdjacentHTML(
    'beforeend',
    /* html */ `
    <div class="labels" aria-hidden="true">${[...SEQ].map((c) => `<span class="lbl">${c}</span>`).join('')}</div>
    <div class="tag" aria-hidden="true"><b>${aminoAcidFa[SEQ[0]]}</b><span class="ltr">${SEQ[0]}</span><small>یک اسید آمینه</small></div>
    <div class="tip" aria-hidden="true"></div>
    <div class="p-callout" aria-hidden="true"><b>۱۷۰٬۰۰۰</b><span>ساختار تجربی در ۶۰ سال</span></div>`,
  );
  const tag = $('.tag');
  const tip = $('.tip');
  const callout = $('.p-callout');
  const labelEls = $$('.labels .lbl');
  // Residue labels wait hidden until the basics scene places them.
  gsap.set([tag, tip, callout, ...labelEls], { autoAlpha: 0 });

  notes.add('define-out', {
    anchor: () => chain.centre(),
    html: `<b>${definition.output}</b>`,
    at: [10, 14],
    tone: 'blue',
  });

  // -------------------------------------------------------------------------
  // Scenes
  // -------------------------------------------------------------------------
  const sCover: Scene = {
    id: 'cover',
    label: cover.name,
    enter(_s, dir) {
      ctx.area('intro');
      clearWorld({ dust: true });
      open(elCover);
      chrome.caption(null);
      world.fogTo(150, 420);
      world.fly(SHOT.cover, first ? 0 : 2.2);
      // Letters form left to right, as the word is read.
      const order = new Float32Array(dust.count);
      for (let i = 0; i < dust.count; i++) order[i] = textPose[i * 3] / COVER_W + 0.5 + Math.random() * 0.2;
      dust.flyTo(textPose, 1, { duration: 2.6, spread: first ? 1.8 : 1.1, ease: 'expo.out', delay: first ? 0.4 : dir < 0 ? 0.3 : 0, order });
      $$('.rv', elCover).forEach((el, i) => reveal(el, true, (first ? 2.4 : 1.4) + i * 0.25));
      first = false;
    },
    leave() {
      close(elCover);
      reveal($$('.rv', elCover), false);
    },
  };

  const sTitle: Scene = {
    id: 'title',
    label: title.name,
    enter() {
      ctx.area('intro');
      open(elTitle);
      clearWorld({ chain: true, dust: true });
      world.fly(SHOT.title, 2.6);
      world.fogTo(150, 420);
      const fromDust = dust.visible;
      if (fromDust) {
        chain.spin = false;
        chain.group.rotation.set(0.25, -0.5, 0.05);
        chain.place(FOLDED);
        chain.group.updateMatrixWorld(true);
        const targets = new Float32Array(dust.count * 3);
        const v = new THREE.Vector3();
        for (let i = 0; i < dust.count; i++) chain.worldPos(i % N, v).toArray(targets, i * 3);
        dust.flyTo(targets, 0, { duration: 1.7, spread: 0.7, ease: 'power3.inOut' });
        chain.show(true, { delay: 1.1, stagger: 0.9, duration: 0.8 });
        gsap.delayedCall(2.2, () => void (chain.spin = true));
      } else {
        chain.spin = true;
        chain.morph(FOLDED, { duration: 1.8, stagger: 0.4 });
        chain.show(true, { stagger: 0.5 });
      }
      const d = fromDust ? 1.5 : 0.4;
      words($('.t-name', elTitle), d, 0.12);
      words($('.t-q', elTitle), d + 0.4);
      reveal($('.t-meta', elTitle), true, d + 0.9);
      reveal($('.t-seq', elTitle), true, d + 1.2);
      gsap.fromTo($$('.t-seq span', elTitle), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.015, delay: d + 1.2 });
      chrome.caption(ubqCaption, d + 1.6);
    },
    leave() {
      close(elTitle);
    },
  };

  // Definition: the protein unravels into its own sequence; the letters become beads and fold.
  const letterPose = new Float32Array(N * 3);
  function measureLetters() {
    const v = new THREE.Vector3();
    chain.group.updateMatrixWorld(true);
    world.withShot(SHOT.define, () =>
      $$('.d-seq span', elDefine).forEach((s, i) => {
        const r = s.getBoundingClientRect();
        world.fromScreen(r.left + r.width / 2, r.top + r.height / 2, v);
        chain.group.worldToLocal(v).toArray(letterPose, i * 3);
      }),
    );
  }

  const define = {
    emerged: false,
    emerge() {
      if (this.emerged) return;
      this.emerged = true;
      chain.spin = false;
      measureLetters();
      chain.place(letterPose);
      for (const b of chain.scale) b.s = 0;
      chain.show(true, { duration: 0.5, stagger: 0.9 });
      chain.morph(FOLDED, { duration: 3, stagger: 0.7, delay: 0.5, swirl: 7 }).eventCallback('onComplete', () => {
        chain.spin = true;
      });
      $$('.d-seq span', elDefine).forEach((s, i) =>
        gsap.to(s, { color: 'var(--c)', opacity: 0.45, duration: 0.6, delay: 0.1 + (i / N) * 0.9, overwrite: true }),
      );
      notes.show('define-out', true, 2.6);
      chrome.caption(ubqCaption, 2.4);
    },
    submerge() {
      if (!this.emerged) return;
      this.emerged = false;
      chain.spin = false;
      measureLetters();
      chain.morph(letterPose, { duration: 1.6, stagger: 0.5 });
      chain.show(false, { delay: 1.2, stagger: 0.5, duration: 0.4 });
      gsap.to($$('.d-seq span', elDefine), { color: 'var(--ink)', opacity: 1, duration: 0.5, delay: 1.4, overwrite: true });
      notes.show('define-out', false);
      chrome.caption(null);
    },
    accuracy(on: boolean) {
      const m = ghost.material as THREE.MeshPhysicalMaterial;
      if (on) {
        ghost.visible = true;
        gsap.fromTo(ghost.position, { x: 10, y: -6, z: 8 }, { x: 0, y: 0, z: 0, duration: 2.2, ease: 'power3.inOut', overwrite: true });
        gsap.fromTo(ghost.rotation, { x: 0.6, y: 0.9, z: -0.3 }, { x: 0, y: 0, z: 0, duration: 2.2, ease: 'power3.inOut', overwrite: true });
        gsap.to(m, { opacity: 0.32, duration: 1, overwrite: true });
        // The prediction resolves into a ribbon drawn along the chain.
        gsap.fromTo(ribbon, { draw: 0 }, { draw: 1, duration: 2.4, delay: 0.4, ease: 'power2.inOut', overwrite: true });
        gsap.to(chain, { radius: 0.62, bondR: 0.22, duration: 1.4, delay: 0.6 });
      } else {
        hideGhost();
        gsap.to(ribbon, { draw: 0, duration: 0.8, overwrite: true });
        gsap.to(chain, { radius: 1.38, bondR: 0.5, duration: 0.8 });
      }
      reveal($('.d-acc', elDefine), on, on ? 1.6 : 0);
    },
  };

  const sDefine: Scene = {
    id: 'define',
    label: 'تعریف آلفا فولد',
    head: { title: 'آلفا فولد چیست؟' },
    steps: 3,
    enter(step) {
      ctx.area('intro');
      open(elDefine);
      const unravel = step === 0 && chain.visible;
      clearWorld({ chain: step > 0 || unravel });
      gsap.to(chain, { radius: 1.38, bondR: 0.5, duration: 0.6 });
      if (unravel) {
        chain.spin = false;
        measureLetters();
        chain.morph(letterPose, { duration: 2.2, stagger: 0.6 });
        chain.show(false, { delay: 1.9, stagger: 0.6, duration: 0.4 });
      }
      chrome.caption(null);
      world.fogTo(150, 420);
      world.fly(SHOT.define, 2.4);
      words($('.d-lead', elDefine), 0.3, 0.03);
      words($('.d-claim', elDefine), 0.9, 0.03);
      gsap.fromTo($('.dim', elDefine), { autoAlpha: 0, scaleX: 0.2 }, { autoAlpha: 1, scaleX: 1, duration: 1, delay: 0.6, ease: 'power3.out' });
      gsap.fromTo(
        $$('.d-seq span', elDefine),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, color: 'var(--ink)', opacity: 1, duration: 0.35, stagger: 0.012, delay: unravel ? 1.4 : 0.8, ease: 'power2.out' },
      );
      define.emerged = false;
      if (step >= 1) gsap.delayedCall(1.2, () => define.emerge());
      if (step >= 2) gsap.delayedCall(2.2, () => define.accuracy(true));
    },
    step(step, dir: Dir) {
      if (step === 1 && dir > 0) define.emerge();
      if (step === 0) define.submerge();
      if (step === 2) define.accuracy(true);
      if (step === 1 && dir < 0) define.accuracy(false);
    },
    leave() {
      close(elDefine);
      reveal($$('.rv', elDefine), false);
      notes.show('define-out', false);
      define.emerged = false;
      hideGhost();
      gsap.to(ribbon, { draw: 0, duration: 0.6, overwrite: true });
      gsap.to(chain, { radius: 1.38, bondR: 0.5, duration: 0.6 });
    },
  };

  // The 50-year puzzle: a crystal of experimental structures against AlphaFold DB.
  const counters = { years: 0, exp: 0, ai: 0 };
  const paint = () => {
    $('.exp-years', elPuzzle).textContent = fa(counters.years);
    $('.exp-count', elPuzzle).textContent = fa(Math.round(counters.exp / 1000) * 1000);
    $('.ai-count', elPuzzle).textContent = fa(counters.ai);
    $('.tl-fill', elPuzzle).style.width = `${(counters.years / 60) * 100}%`;
  };
  const puzzleScene = {
    crystal(animate: boolean) {
      world.fly(SHOT.crystal, animate ? 2.6 : 2);
      world.fogTo(60, 260);
      gsap.killTweensOf([lattice.state, counters]);
      const d = animate ? 6.5 : 0.8;
      gsap.fromTo(lattice.state, { n: 0 }, { n: lattice.count, duration: d, delay: animate ? 1.2 : 0.3, ease: 'power2.in' });
      gsap.fromTo(counters, { years: 0, exp: 0 }, { years: 60, exp: 170_000, duration: d, delay: animate ? 1.2 : 0.3, ease: 'power2.in', onUpdate: paint });
    },
    database(on: boolean) {
      if (on) {
        gsap.to(lattice.state, { n: lattice.count, duration: 0.4, overwrite: true });
        gsap.to(counters, { years: 60, exp: 170_000, duration: 0.4, onUpdate: paint });
        world.fly(SHOT.database, 3.4, 'power2.inOut');
        world.fogTo(220, 700, 3);
        gsap.fromTo(cloud, { t: 0 }, { t: 1.6, duration: 3.6, delay: 0.5, ease: 'power1.inOut', overwrite: true });
        gsap.fromTo(counters, { ai: 0 }, { ai: 200, duration: 3, delay: 0.7, ease: 'power2.in', onUpdate: paint });
      } else {
        gsap.to(cloud, { t: 0, duration: 1.2, ease: 'power2.in', overwrite: true });
        world.fly(SHOT.crystal, 2.4);
        world.fogTo(60, 260);
      }
      // The experimental column hands its place to AlphaFold and shrinks to a label on the crystal.
      reveal($('.p-exp', elPuzzle), !on, on ? 0 : 0.6);
      reveal($('.p-ai', elPuzzle), on, on ? 1.2 : 0);
      reveal(callout, on, on ? 2.6 : 0);
    },
  };

  const sPuzzle: Scene = {
    id: 'puzzle',
    label: puzzle.title,
    head: { title: 'آلفا فولد چیست؟' },
    steps: 3,
    enter(step) {
      ctx.area('intro');
      open(elPuzzle);
      clearWorld();
      chrome.caption(null);
      words($('.p-title', elPuzzle), 0.3, 0.06);
      if (step === 0) reveal($('.p-exp', elPuzzle), true, 0.8);
      puzzleScene.crystal(step === 0);
      if (step >= 1) puzzleScene.database(true);
      if (step >= 2) reveal($('.p-conclusion', elPuzzle), true, 2.5);
    },
    step(step, dir) {
      if (step === 1) {
        if (dir > 0) puzzleScene.database(true);
        else reveal($('.p-conclusion', elPuzzle), false);
      }
      if (step === 0) puzzleScene.database(false);
      if (step === 2) reveal($('.p-conclusion', elPuzzle), true);
    },
    leave() {
      close(elPuzzle);
      reveal([...$$('.rv', elPuzzle), $('.p-exp', elPuzzle), callout], false);
      gsap.killTweensOf(counters);
    },
  };

  // Chapter opener: the chain stands up as the numeral «۱».
  const sChapter: Scene = {
    id: 'chapter-1',
    label: `${chapter1.num} ${chapter1.title}`,
    chapter: true,
    enter() {
      ctx.area('intro');
      open(elChapter);
      clearWorld({ chain: true });
      chrome.caption(null);
      world.fogTo(150, 520);
      world.fly(SHOT.numeral, 2.6);
      chain.settle(1.6);
      chain.morph(PILLAR, { duration: 2.4, stagger: 0.5, swirl: 4 });
      chain.show(true, { stagger: 0.6 });
      gsap.to(chain, { radius: 2.6, bondR: 0.9, duration: 1.6, delay: 0.8 });
      words($('.ch-title', elChapter), 0.8, 0.1);
      $$('.toc li', elChapter).forEach((li, i) => reveal(li, true, 1.3 + i * 0.15));
    },
    leave() {
      close(elChapter);
      reveal($$('.rv', elChapter), false);
      gsap.to(chain, { radius: 1.38, bondR: 0.5, duration: 1.2 });
    },
  };

  // Basics: the bead metaphor, then the real thing.
  let labelsOn = false;
  function showLabels(on: boolean) {
    if (on === labelsOn) return;
    labelsOn = on;
    gsap.to(labelEls, { autoAlpha: on ? 1 : 0, duration: on ? 0.4 : 0.25, stagger: on ? { amount: 1.4 } : 0, overwrite: true });
  }

  const basicsSteps = [
    (dir: Dir) => {
      if (dir < 0) {
        gsap.to(chain.focus, { k: 0, duration: 0.4 });
        reveal(tag, false);
      }
    },
    (dir: Dir) => {
      chain.focus.i = 0;
      gsap.to(chain.focus, { k: 1, duration: 0.8, ease: 'back.out(2)' });
      reveal(tag, true, 0.3);
      if (dir < 0) showLabels(false);
    },
    (dir: Dir) => {
      gsap.to(chain.focus, { k: 0, duration: 0.5 });
      reveal(tag, false);
      showLabels(true);
      if (dir < 0) {
        chain.spin = false;
        chain.settle(1.4);
        chain.morph(LINE, { duration: 2, stagger: 0.5, reverse: true });
        world.fly(SHOT.line, 2.2);
      }
    },
    (dir: Dir) => {
      showLabels(false);
      if (dir > 0) {
        chain.morph(FOLDED, { duration: 3.2, stagger: 0.7, swirl: 8 }).eventCallback('onComplete', () => void (chain.spin = true));
        world.fly(SHOT.fold, 3);
      } else {
        atoms.reveal(false);
        chain.show(true, { stagger: 0.4 });
        reveal($('.b-note', elBasics), false);
        chrome.caption(ubqCaption, 0);
      }
    },
    () => {
      atoms.reveal(true);
      chain.show(false, { delay: 0.6, stagger: 0.8, duration: 0.6 });
      reveal($('.b-note', elBasics), true, 0.8);
      chrome.caption({ ...ubqCaption, detail: 'PDB 1UBQ، ۶۰۲ اتم سنگین' }, 0.8);
    },
  ];

  const sBasics: Scene = {
    id: 'basics',
    label: basics.title,
    head: { num: chapter1.num, title: chapter1.title },
    steps: 5,
    enter(step) {
      ctx.area('intro');
      open(elBasics);
      clearWorld({ chain: true });
      world.fogTo(150, 420);
      if (step >= 3) {
        chain.spin = true;
        chain.morph(FOLDED, { duration: 2 });
        world.fly(SHOT.fold, 2.4);
      } else {
        chain.settle(1.4);
        chain.morph(LINE, { duration: 2.4, stagger: 0.6, reverse: true });
        world.fly(SHOT.line, 2.4);
      }
      chain.show(true, { stagger: 0.6 });
      chrome.caption(ubqCaption, 1.2);
      words($('.b-title', elBasics), 0.3, 0.08);
      words($('.b-lead', elBasics), 0.6, 0.02);
      $$('.b-list li', elBasics).forEach((li, i) => reveal(li, i < step, 0.4 + i * 0.15));
      for (let s = 1; s <= step; s++) basicsSteps[s](1);
    },
    step(step, dir) {
      $$('.b-list li', elBasics).forEach((li, i) => reveal(li, i < step, 0.1));
      basicsSteps[step](dir);
    },
    leave() {
      close(elBasics);
      reveal([...$$('.rv', elBasics), tag], false);
      showLabels(false);
      gsap.to(chain.focus, { k: 0, duration: 0.3 });
    },
  };

  // -------------------------------------------------------------------------
  // Per-frame DOM that follows the 3D scene
  // -------------------------------------------------------------------------
  const p = new THREE.Vector3();
  const scr = { x: 0, y: 0, z: 0 };
  world.onFrame(() => {
    if (labelsOn || gsap.isTweening(labelEls)) {
      for (let i = 0; i < N; i++) {
        chain.worldPos(i, p);
        world.toScreen(p, scr);
        const d = world.pixelSize(p, chain.radius * 2);
        const k = Math.max(0.25, Math.min(1.6, d / 56));
        labelEls[i].style.transform = `translate(${scr.x}px, ${scr.y - d * 0.95}px) translate(-50%, -50%) scale(${k})`;
        labelEls[i].style.zIndex = String(Math.round((1 - scr.z) * 1e5));
      }
    }
    if (+getComputedStyle(callout).opacity > 0) {
      world.toScreen(p.set(0, 5, 0).applyMatrix4(lattice.group.matrixWorld), scr);
      callout.style.transform = `translate(${scr.x}px, ${scr.y}px) translate(-50%, -100%)`;
    }
    if (+getComputedStyle(tag).opacity > 0) {
      chain.worldPos(0, p);
      world.toScreen(p, scr);
      const d = world.pixelSize(p, chain.radius * 2 * (1 + chain.focus.k * 0.9));
      tag.style.transform = `translate(${scr.x}px, ${scr.y - d * 0.6}px) translate(-50%, -100%)`;
    }
  });

  // Drag to turn the protein; hover a bead to name it.
  const canvas = world.renderer.domElement;
  const ray = new THREE.Raycaster();
  let drag: { x: number; y: number; spin: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!chain.visible) return;
    drag = { x: e.clientX, y: e.clientY, spin: chain.spin };
    chain.spin = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) chain.spin = drag.spin;
    drag = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      chain.group.rotation.y += (e.clientX - drag.x) * 0.006;
      chain.group.rotation.x += (e.clientY - drag.y) * 0.006;
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    if (!chain.visible || atoms.state.t > 0.5) return void gsap.to(tip, { autoAlpha: 0, duration: 0.2 });
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), world.camera);
    chain.beads.boundingSphere = null;
    const hit = ray.intersectObject(chain.beads)[0];
    if (hit?.instanceId !== undefined && chain.scale[hit.instanceId].s > 0.5) {
      const i = hit.instanceId;
      const aa = SEQ[i];
      tip.innerHTML = `<b>${aminoAcidFa[aa]}</b> <span class="ltr">${aa}</span><small>جایگاه ${fa(i + 1)}</small>`;
      tip.style.transform = `translate(${e.clientX}px, ${e.clientY - 24}px) translate(-50%, -100%)`;
      tip.style.setProperty('--c', hex(i));
      gsap.to(tip, { autoAlpha: 1, duration: 0.15 });
    } else gsap.to(tip, { autoAlpha: 0, duration: 0.2 });
  });

  /** Sample the cover word once fonts are ready, and colour the particles along it. */
  const prepare = async () => {
    await document.fonts.load('900 120px "Vazirmatn Variable"', cover.name);
    textPose = textPoints(cover.name, '900 380px "Vazirmatn Variable"', dust.count, COVER_W, new THREE.Vector3(0, 9, 0));
    const c = new THREE.Color();
    for (let i = 0; i < dust.count; i++) dust.mesh.setColorAt(i, spectrum(textPose[i * 3] / COVER_W + 0.5, c));
    dust.mesh.instanceColor!.needsUpdate = true;
  };

  return Object.assign([sCover, sTitle, sDefine, sPuzzle, sChapter, sBasics], { prepare });
}
