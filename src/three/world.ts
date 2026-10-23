import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, SMAAPreset } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Palette: lab white, navy ink, and the four AlphaFold confidence hues.
// ---------------------------------------------------------------------------
export const C = {
  bg: new THREE.Color('#eaf0f5'),
  ink: new THREE.Color('#0b1f3a'),
  steel: new THREE.Color('#34465e'),
  blue: new THREE.Color('#0053d6'),
  sky: new THREE.Color('#65cbf3'),
  sun: new THREE.Color('#ffdb13'),
  ember: new THREE.Color('#ff7d45'),
  alarm: new THREE.Color('#c4122f'),
  clay: new THREE.Color('#8fb0d9'),
};
const STOPS = [C.blue, C.sky, C.sun, C.ember];

export function spectrum(t: number, out = new THREE.Color()) {
  const x = Math.min(0.9999, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.floor(x);
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], x - i);
}

/** Where each part of the talk lives. The camera dollies right-to-left between them. */
export const ANCHOR = {
  intro: new THREE.Vector3(0, 0, 0),
  function: new THREE.Vector3(-700, 0, 0),
  drug: new THREE.Vector3(-1400, 0, 0),
  routes: new THREE.Vector3(-2100, 0, 0),
  xray: new THREE.Vector3(-2800, 0, 0),
  cryo: new THREE.Vector3(-3500, 0, 0),
  homology: new THREE.Vector3(-4200, 0, 0),
  search: new THREE.Vector3(-4900, 0, 0),
  concepts: new THREE.Vector3(-5600, 0, 0),
  pipeline: new THREE.Vector3(-6300, 0, 0),
  chapter2: new THREE.Vector3(-7000, 0, 0),
  network: new THREE.Vector3(-7700, 0, 0),
  structure: new THREE.Vector3(-8400, 0, 0),
  frames: new THREE.Vector3(-9100, 0, 0),
  ipa: new THREE.Vector3(-9800, 0, 0),
  sidechain: new THREE.Vector3(-10500, 0, 0),
  recycle: new THREE.Vector3(-11200, 0, 0),
  chapter3: new THREE.Vector3(-11900, 0, 0),
  train: new THREE.Vector3(-12600, 0, 0),
  fape: new THREE.Vector3(-13300, 0, 0),
  optim: new THREE.Vector3(-14000, 0, 0),
  distill: new THREE.Vector3(-14700, 0, 0),
  chapter4: new THREE.Vector3(-15400, 0, 0),
  casp: new THREE.Vector3(-16100, 0, 0),
  results: new THREE.Vector3(-16800, 0, 0),
  metrics: new THREE.Vector3(-17500, 0, 0),
  confidence: new THREE.Vector3(-18200, 0, 0),
  closing: new THREE.Vector3(-18900, 0, 0),
};

export interface Shot {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  /** Where the target lands on screen, as a fraction of width/height from centre (+x right, +y up). */
  ox: number;
  oy: number;
}

/** A shot relative to an anchor. */
export function shot(a: THREE.Vector3, s: Partial<Shot>): Shot {
  return {
    px: a.x + (s.px ?? 0),
    py: a.y + (s.py ?? 0),
    pz: a.z + (s.pz ?? 100),
    tx: a.x + (s.tx ?? 0),
    ty: a.y + (s.ty ?? 0),
    tz: a.z + (s.tz ?? 0),
    ox: s.ox ?? 0,
    oy: s.oy ?? 0,
  };
}

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.5, 3000);
  rig: Shot = { px: 0, py: 0, pz: 150, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0 };
  fog: THREE.Fog;
  composer: EffectComposer;
  ao: N8AOPostPass;
  quality: 'high' | 'low' = 'high';
  motes: THREE.Points;
  private timer = new THREE.Timer();
  private listeners: ((dt: number, t: number) => void)[] = [];
  private slow = 0;
  /** Automatic fallback to the light renderer (off for headless capture runs). */
  private auto = !new URLSearchParams(location.search).has('capture');
  onQuality?: (q: 'high' | 'low') => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
      // Dev only: lets page captures read the last frame.
      preserveDrawingBuffer: import.meta.env.DEV,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    this.scene.background = this.backdrop();
    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(-40, 70, 60);
    const rim = new THREE.DirectionalLight('#dbe9ff', 0.6);
    rim.position.set(60, -20, -80);
    this.scene.add(key, rim, new THREE.HemisphereLight('#ffffff', '#b5c3d3', 0.6));
    this.fog = new THREE.Fog(C.bg, 150, 420);
    this.scene.fog = this.fog;

    this.motes = this.makeMotes();
    this.scene.add(this.motes);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new N8AOPostPass(this.scene, this.camera, Math.max(1, innerWidth), Math.max(1, innerHeight));
    Object.assign(this.ao.configuration, {
      aoRadius: 4.5,
      distanceFalloff: 1,
      intensity: 2.4,
      halfRes: true,
      color: new THREE.Color('#0b1f3a'),
    });
    this.ao.setQualityMode('Medium');
    this.composer.addPass(this.ao);
    this.composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    // N8AO guesses its place in the pipeline and may re-enable gamma; the SMAA pass after it
    // already converts to sRGB, so pin it off once everything is wired.
    this.ao.configuration.gammaCorrection = false;

    addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  /** The studio backdrop: a soft radial light, painted once. */
  private backdrop() {
    const cv = document.createElement('canvas');
    cv.width = 1600;
    cv.height = 900;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(560, 380, 40, 640, 420, 1150);
    grad.addColorStop(0, '#fbfcfe');
    grad.addColorStop(0.45, '#edf2f7');
    grad.addColorStop(1, '#d6e0ea');
    g.fillStyle = grad;
    g.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Slow-drifting specks in the water around the molecules; they give camera moves depth. */
  private makeMotes() {
    const n = 38000;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 300 - Math.random() * 19400;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 320;
      pos[i * 3 + 2] = 200 - Math.random() * 700;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uScale: { value: 500 }, uColor: { value: new THREE.Color('#8fa3b8') } },
      ]),
      fog: true,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        varying float vAlpha;
        #include <fog_pars_vertex>
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.11 + aSeed * 40.0) * 3.0;
          p.y += sin(uTime * 0.07 + aSeed * 90.0) * 4.0;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (0.35 + aSeed * 0.55) * uScale / -mvPosition.z;
          vAlpha = 0.25 + aSeed * 0.35;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        #include <fog_pars_fragment>
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, vAlpha * smoothstep(0.5, 0.2, d));
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }

  fly(s: Shot, duration = 2.4, ease = 'power3.inOut') {
    return gsap.to(this.rig, { ...s, duration, ease, overwrite: 'auto' });
  }

  fogTo(near: number, far: number, duration = 2) {
    return gsap.to(this.fog, { near, far, duration, ease: 'power2.inOut', overwrite: 'auto' });
  }

  onFrame(fn: (dt: number, t: number) => void) {
    this.listeners.push(fn);
  }

  setQuality(q: 'high' | 'low') {
    if (q === this.quality) return;
    this.quality = q;
    this.ao.enabled = q === 'high';
    this.renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);
    this.resize();
    this.onQuality?.(q);
  }

  /** Run `fn` with the camera parked at `s` (e.g. to measure where things will land). */
  withShot<T>(s: Shot, fn: () => T): T {
    const saved = { ...this.rig };
    Object.assign(this.rig, s);
    this.applyCamera();
    const out = fn();
    Object.assign(this.rig, saved);
    this.applyCamera();
    return out;
  }

  private applyCamera() {
    const r = this.rig;
    const w = innerWidth;
    const h = innerHeight;
    this.camera.position.set(r.px, r.py, r.pz);
    this.camera.lookAt(r.tx, r.ty, r.tz);
    this.camera.setViewOffset(w, h, -r.ox * w, r.oy * h, w, h);
    this.camera.updateMatrixWorld(true);
  }

  /** Project a world point to CSS pixels. */
  toScreen(p: THREE.Vector3, out = { x: 0, y: 0, z: 0 }) {
    _v.copy(p).project(this.camera);
    out.x = (_v.x * 0.5 + 0.5) * innerWidth;
    out.y = (-_v.y * 0.5 + 0.5) * innerHeight;
    out.z = _v.z;
    return out;
  }

  /** Cast a screen pixel onto the plane through the camera target, facing the camera. */
  fromScreen(x: number, y: number, out = new THREE.Vector3()) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const target = new THREE.Vector3(this.rig.tx, this.rig.ty, this.rig.tz);
    const normal = this.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);
    return ray.ray.intersectPlane(plane, out) ?? out.copy(target);
  }

  /** CSS-pixel length of a world-space length at a given point. */
  pixelSize(p: THREE.Vector3, len: number) {
    const d = _a.copy(p).applyMatrix4(this.camera.matrixWorldInverse).z;
    const f = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    return (len * f) / Math.max(0.01, -d);
  }

  /** Point-size scale for shaders: drawing-buffer pixels per world unit at distance 1. */
  get pointScale() {
    return this.renderer.getDrawingBufferSize(_size).y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    // A hidden or minimised window can report 0×0; zero-sized targets break the pipeline.
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // The design is a 16:9 stage (1rem = 1/108 of its height). On windows taller than 16:9 the
    // stage is letterboxed, so widen the vertical field of view until the stage itself spans the
    // designed 35°: 3D objects then stay locked to the HTML laid out in rem.
    const stageH = Math.min(w / 192, h / 108) * 108;
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5)) * (h / stageH)));
    this.camera.updateProjectionMatrix();
    (this.motes.material as THREE.ShaderMaterial).uniforms.uScale.value = this.pointScale;
  }

  /** Compile every material up front so the first appearance of a scene does not stutter. */
  warm() {
    this.applyCamera();
    this.renderer.compile(this.scene, this.camera);
  }

  private frame(now: number) {
    if (innerWidth < 2 || innerHeight < 2) return;
    this.timer.update(now);
    const raw = this.timer.getDelta();
    const dt = Math.min(0.05, raw);
    const t = this.timer.getElapsed();
    this.applyCamera();
    (this.motes.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.listeners.forEach((fn) => fn(dt, t));
    this.composer.render(dt);
    // Fall back to the simple renderer if this machine cannot keep up. Long gaps mean the tab
    // was hidden or throttled, not a slow GPU, so they are ignored.
    if (this.auto && this.quality === 'high' && raw > 0 && raw < 0.2 && document.visibilityState === 'visible') {
      this.slow = this.slow * 0.97 + (raw > 1 / 32 ? 1 : 0) * 0.03;
      if (this.slow > 0.6 && t > 6) this.setQuality('low');
    }
  }
}

const _size = new THREE.Vector2();
