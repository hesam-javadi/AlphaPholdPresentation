import gsap from 'gsap';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { evoFigure as F } from '../content';

// The Evoformer block from the AlphaFold paper (Jumper et al. 2021, Fig. 3a), rebuilt as a
// physical board: the same boxes, labels, arrows, residual (+) joins and the 48-block frame.
// Every slide of the network chapter keeps it on screen and lights the part being explained.

export type ModId =
  | 'msaIn'
  | 'pairIn'
  | 'msaOut'
  | 'pairOut'
  | 'row'
  | 'col'
  | 'transM'
  | 'opm'
  | 'triOut'
  | 'triIn'
  | 'triStart'
  | 'triEnd'
  | 'transP';

export const ATTENTION: ModId[] = ['row', 'col', 'triStart', 'triEnd'];
export const MSA_TRACK = ['msaIn', 'm0', 'row', 'm1', 'p-row', 'm2', 'col', 'm3', 'p-col', 'm4', 'transM', 'm5', 'p-transM', 'm6', 'msaOut'];
export const PAIR_TRACK = ['pairIn', 'p0', 'p-opm', 'p1', 'triOut', 'p2', 'p-triOut', 'p3', 'triIn', 'p4', 'p-triIn', 'p5', 'triStart', 'p6', 'p-triStart', 'p7', 'triEnd', 'p8', 'p-triEnd', 'p9', 'transP', 'p10', 'p-transP', 'p11', 'pairOut'];
export const RESIDUALS = ['r-row', 'r-col', 'r-transM', 'r-triOut', 'r-triIn', 'r-triStart', 'r-triEnd', 'r-transP'];
export const PLUS = ['p-row', 'p-col', 'p-transM', 'p-opm', 'p-triOut', 'p-triIn', 'p-triStart', 'p-triEnd', 'p-transP'];

const COL = {
  attention: '#f28f9c',
  transition: '#8fd27a',
  opm: '#b49ef2',
  triangle: '#fcb26c',
  line: '#1f43a6',
  frame: '#34465e',
  dim: new THREE.Color('#dde4ec'),
  sky: new THREE.Color('#65cbf3'),
  sun: new THREE.Color('#ffd21f'),
};
const MSA_CELLS = ['#fbd5c5', '#f7ab90', '#f48a6c', '#fde6dc', '#f26a4e', '#f9c2ad'];
const PAIR_CELLS = ['#cfe4f4', '#9ccbec', '#7db6e0', '#e4f0fa', '#5fa2d6', '#b5d8f1'];

const MSA_Y = 20;
const PAIR_Y = -20;
const BW = 18;
const BH = 24;
const TOP = 35;
const LOW = -5;

/** Rounded polyline through 2D points (z = 0). */
function polyPath(pts: [number, number][], r = 2.4) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v = pts.map(([x, y]) => new THREE.Vector3(x, y, 0));
  let from = v[0].clone();
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1];
    const b = v[i];
    const c = v[i + 1];
    const ra = Math.min(r, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p0 = b.clone().add(a.clone().sub(b).setLength(ra));
    const p1 = b.clone().add(c.clone().sub(b).setLength(ra));
    if (from.distanceTo(p0) > 1e-4) path.add(new THREE.LineCurve3(from, p0));
    path.add(new THREE.QuadraticBezierCurve3(p0, b.clone(), p1));
    from = p1;
  }
  path.add(new THREE.LineCurve3(from, v[v.length - 1].clone()));
  return path;
}

function labelTexture(lines: string[], w: number, h: number, o: { size?: number; halo?: boolean; weight?: number } = {}) {
  const K = 26;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * K);
  cv.height = Math.round(h * K);
  const g = cv.getContext('2d')!;
  const size = (o.size ?? 3) * K;
  const lh = size * 1.08;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const y0 = cv.height / 2 - ((lines.length - 1) * lh) / 2;
  if (o.halo) {
    // A soft card behind the words so they read over the mosaic.
    const widest = Math.max(...lines.map((ln) => ln.length)) * size * 0.56;
    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.beginPath();
    g.roundRect(cv.width / 2 - widest / 2 - size * 0.4, y0 - lh * 0.62, widest + size * 0.8, lh * (lines.length + 0.24), size * 0.3);
    g.fill();
  }
  lines.forEach((ln, i) => {
    const italic = /^\(.*\)$/.test(ln);
    g.font = `${italic ? 'italic ' : ''}${o.weight ?? 600} ${size}px "Vazirmatn Variable", sans-serif`;
    if (o.halo) {
      g.lineWidth = size * 0.28;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.strokeText(ln, cv.width / 2, y0 + i * lh);
    }
    g.fillStyle = '#0b1f3a';
    g.fillText(ln, cv.width / 2, y0 + i * lh);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The species pictograms that sit beside the MSA representation in the paper. */
function iconTexture() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S * 4;
  const g = cv.getContext('2d')!;
  g.strokeStyle = '#0b1f3a';
  g.fillStyle = '#0b1f3a';
  g.lineWidth = 9;
  g.lineJoin = g.lineCap = 'round';
  // Human
  g.beginPath();
  g.arc(64, 22, 13, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.roundRect(42, 40, 44, 52, 10);
  g.moveTo(52, 92);
  g.lineTo(52, 120);
  g.moveTo(76, 92);
  g.lineTo(76, 120);
  g.stroke();
  // Fish
  g.translate(0, S);
  g.beginPath();
  g.ellipse(58, 64, 36, 22, 0, 0, Math.PI * 2);
  g.moveTo(94, 64);
  g.lineTo(120, 44);
  g.lineTo(120, 84);
  g.closePath();
  g.stroke();
  g.beginPath();
  g.arc(40, 58, 5, 0, Math.PI * 2);
  g.fill();
  // Frog
  g.translate(0, S);
  g.beginPath();
  g.ellipse(64, 70, 30, 24, 0, 0, Math.PI * 2);
  g.moveTo(40, 52);
  g.arc(46, 44, 9, Math.PI * 0.8, Math.PI * 2.2);
  g.moveTo(74, 44);
  g.arc(82, 44, 9, Math.PI, Math.PI * 2.4);
  g.moveTo(36, 82);
  g.lineTo(16, 104);
  g.lineTo(30, 112);
  g.moveTo(92, 82);
  g.lineTo(112, 104);
  g.lineTo(98, 112);
  g.stroke();
  // Rooster
  g.translate(0, S);
  g.beginPath();
  g.ellipse(58, 78, 30, 22, -0.3, 0, Math.PI * 2);
  g.moveTo(78, 62);
  g.quadraticCurveTo(88, 34, 82, 24);
  g.moveTo(76, 22);
  g.lineTo(80, 12);
  g.lineTo(86, 20);
  g.lineTo(92, 12);
  g.lineTo(94, 24);
  g.moveTo(86, 34);
  g.lineTo(102, 38);
  g.lineTo(88, 44);
  g.moveTo(30, 70);
  g.quadraticCurveTo(10, 40, 22, 30);
  g.quadraticCurveTo(26, 54, 36, 62);
  g.moveTo(52, 100);
  g.lineTo(50, 120);
  g.moveTo(66, 100);
  g.lineTo(68, 120);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 160;
  const g = cv.getContext('2d')!;
  g.filter = 'blur(18px)';
  g.fillStyle = 'rgba(11,31,58,0.55)';
  g.beginPath();
  g.roundRect(40, 40, 432, 80, 20);
  g.fill();
  return new THREE.CanvasTexture(cv);
}

const lineVert = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const lineFrag = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uFlowColor; uniform vec3 uPulseColor; uniform vec3 uDimColor;
  uniform float uTime; uniform float uFlow; uniform float uDim; uniform float uDraw; uniform float uPulse; uniform float uLen;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    if (vUv.x > uDraw) discard;
    vec3 c = mix(uColor, uDimColor, uDim * 0.85);
    float dash = smoothstep(0.35, 0.5, fract(vUv.x * uLen / 5.0 - uTime * 0.9)) * smoothstep(1.0, 0.85, fract(vUv.x * uLen / 5.0 - uTime * 0.9));
    c = mix(c, uFlowColor, dash * uFlow * 0.85);
    float g = exp(-pow((vUv.x - uPulse) * uLen / 3.5, 2.0));
    c = mix(c, uPulseColor, g);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

interface Mod {
  id: ModId;
  group: THREE.Group;
  inner: THREE.Group;
  w: number;
  h: number;
  base: THREE.Color;
  mat?: THREE.MeshPhysicalMaterial;
  cells?: THREE.MeshPhysicalMaterial;
  labelMat: THREE.MeshBasicMaterial;
  icon?: THREE.MeshBasicMaterial;
  ring: THREE.MeshBasicMaterial;
  st: { dim: number; lift: number; ring: number; on: number };
  k: number;
}

interface Line {
  id: string;
  mesh: THREE.Mesh;
  u: Record<string, THREE.IUniform>;
  cone?: THREE.Mesh;
  coneMat?: THREE.MeshBasicMaterial;
  k0: number;
  k1: number;
  st: { dim: number };
}

interface Plus {
  id: string;
  group: THREE.Group;
  mats: THREE.MeshBasicMaterial[];
  st: { dim: number; on: number };
  k: number;
}

const _c = new THREE.Color();

export class Board {
  group = new THREE.Group();
  /** The figure itself, offset so it is centred in `group`. */
  root = new THREE.Group();
  mods = {} as Record<ModId, Mod>;
  lines: Record<string, Line> = {};
  plus: Record<string, Plus> = {};
  st = { build: 0, stack: 0 };
  private frameLine!: Line;
  private frameLabel!: THREE.MeshBasicMaterial;
  private ghosts!: THREE.InstancedMesh;
  private ghostMat!: THREE.MeshBasicMaterial;
  private card: THREE.Mesh;
  private shadow: THREE.Mesh;
  private x0 = -150;
  private x1 = 165;
  private ease = gsap.parseEase('back.out(1.5)');

  constructor() {
    this.group.add(this.root);
    const msa = F.msa;
    const pair = F.pair;
    this.tile('msaIn', -134, MSA_Y, 24, 15, msa, MSA_CELLS, [6, 4], -151);
    this.tile('pairIn', -134, PAIR_Y, 24, 24, pair, PAIR_CELLS, [6, 6]);
    this.tile('msaOut', 151, MSA_Y, 24, 15, msa, MSA_CELLS, [6, 4], 136);
    this.tile('pairOut', 151, PAIR_Y, 24, 24, pair, PAIR_CELLS, [6, 6]);
    this.box('row', -99, MSA_Y, BW, BH, F.row, COL.attention);
    this.box('col', -71, MSA_Y, BW, BH, F.col, COL.attention);
    this.box('transM', -43, MSA_Y, BW, BH, F.transition, COL.transition);
    this.box('opm', -23, 0, 18, 12, F.opm, COL.opm, 2.9);
    this.box('triOut', -2, PAIR_Y, BW, BH, F.triOut, COL.triangle);
    this.box('triIn', 26, PAIR_Y, BW, BH, F.triIn, COL.triangle);
    this.box('triStart', 54, PAIR_Y, BW, BH, F.triStart, COL.attention);
    this.box('triEnd', 82, PAIR_Y, BW, BH, F.triEnd, COL.attention);
    this.box('transP', 110, PAIR_Y, BW, BH, F.transition, COL.transition);

    const plusAt: [string, number, number][] = [
      ['p-row', -85, MSA_Y],
      ['p-col', -57, MSA_Y],
      ['p-transM', -29, MSA_Y],
      ['p-opm', -23, PAIR_Y],
      ['p-triOut', 12, PAIR_Y],
      ['p-triIn', 40, PAIR_Y],
      ['p-triStart', 68, PAIR_Y],
      ['p-triEnd', 96, PAIR_Y],
      ['p-transP', 124, PAIR_Y],
    ];
    plusAt.forEach(([id, x, y]) => this.node(id, x, y));

    // Main tracks: every hop ends in an arrowhead, as in the paper.
    const seg = (id: string, a: number, b: number, y: number, arrow = true) => this.line(id, [[a, y], [b, y]], arrow);
    seg('m0', -122, -108, MSA_Y);
    seg('m1', -90, -87, MSA_Y);
    seg('m2', -83, -80, MSA_Y);
    seg('m3', -62, -59, MSA_Y);
    seg('m4', -55, -52, MSA_Y);
    seg('m5', -34, -31, MSA_Y);
    seg('m6', -27, 134, MSA_Y);
    seg('p0', -122, -25, PAIR_Y);
    seg('p1', -21, -11, PAIR_Y);
    const pairStops = [7, 10, 14, 17, 35, 38, 42, 45, 63, 66, 70, 73, 91, 94, 98, 101, 119, 122, 126, 139];
    for (let i = 0; i < pairStops.length; i += 2) seg(`p${i / 2 + 2}`, pairStops[i], pairStops[i + 1], PAIR_Y);
    // Pair bias into the row-wise attention, and the outer product mean down into the pair track.
    this.line('bias', [[-99, PAIR_Y], [-99, MSA_Y - BH / 2]], true);
    this.line('opmIn', [[-23, MSA_Y], [-23, 6]], true);
    this.line('opmOut', [[-23, -6], [-23, PAIR_Y + 2]], true);
    // Residual connections over every module.
    const arc = (id: string, x0: number, x1: number, y: number, top: number) =>
      this.line(id, [[x0, y], [x0, top], [x1, top], [x1, y + (top > y ? 2 : -2)]], true);
    arc('r-row', -113, -85, MSA_Y, TOP);
    arc('r-col', -81.5, -57, MSA_Y, TOP);
    arc('r-transM', -53.5, -29, MSA_Y, TOP);
    arc('r-triOut', -12.5, 12, PAIR_Y, LOW);
    arc('r-triIn', 15.5, 40, PAIR_Y, LOW);
    arc('r-triStart', 43.5, 68, PAIR_Y, LOW);
    arc('r-triEnd', 71.5, 96, PAIR_Y, LOW);
    arc('r-transP', 99.5, 124, PAIR_Y, LOW);

    this.buildFrame();
    this.buildGhosts();

    // The figure sits on a white card, like the printed page.
    const cw = this.x1 - this.x0 + 14;
    this.card = new THREE.Mesh(
      new RoundedBoxGeometry(cw, 90, 1.4, 4, 0.7),
      new THREE.MeshPhysicalMaterial({ color: '#fdfeff', roughness: 0.85, clearcoat: 0.2 }),
    );
    this.card.position.set((this.x0 + this.x1) / 2, 1.5, -2.2);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(cw * 1.12, 90 * 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.4 }),
    );
    this.shadow.position.set((this.x0 + this.x1) / 2, -3.5, -3.4);
    this.root.add(this.card, this.shadow);
    this.root.position.x = -(this.x0 + this.x1) / 2;
    this.group.visible = false;
  }

  // ---------------------------------------------------------------- construction

  private kOf(x: number) {
    return ((x - this.x0) / (this.x1 - this.x0)) * 0.75;
  }

  private ringMat() {
    return new THREE.MeshBasicMaterial({ color: '#0b1f3a', transparent: true, opacity: 0, depthWrite: false });
  }

  private ring(w: number, h: number, r: number) {
    const shape = (W: number, H: number, R: number) => {
      const s = new THREE.Shape();
      s.moveTo(-W / 2 + R, -H / 2);
      s.lineTo(W / 2 - R, -H / 2);
      s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
      s.lineTo(W / 2, H / 2 - R);
      s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
      s.lineTo(-W / 2 + R, H / 2);
      s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
      s.lineTo(-W / 2, -H / 2 + R);
      s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
      return s;
    };
    const outer = shape(w + 3.2, h + 3.2, r + 1.6);
    outer.holes.push(shape(w + 1.8, h + 1.8, r + 0.9) as unknown as THREE.Path);
    return new THREE.ShapeGeometry(outer, 6);
  }

  private box(id: ModId, x: number, y: number, w: number, h: number, lines: string[], color: string, size = 3) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.position.set(x, y, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, 2.6, 3, 1.1), mat);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture(lines, w, h, { size }), transparent: true, depthWrite: false, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelMat);
    label.position.z = 1.32;
    const ringMat = this.ringMat();
    const ring = new THREE.Mesh(this.ring(w, h, 1.1), ringMat);
    ring.position.z = -0.4;
    inner.add(body, label, ring);
    group.add(inner);
    this.root.add(group);
    this.mods[id] = { id, group, inner, w, h, base: new THREE.Color(color), mat, labelMat, ring: ringMat, st: { dim: 0, lift: 0, ring: 0, on: 0 }, k: this.kOf(x - w / 2) };
  }

  private tile(id: ModId, x: number, y: number, w: number, h: number, lines: string[], palette: string[], [cx, cy]: number[], iconX?: number) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.position.set(x, y, 0);
    const cw = w / cx;
    const ch = h / cy;
    const cells = new THREE.MeshPhysicalMaterial({ roughness: 0.55, clearcoat: 0.25, emissive: '#ffffff', emissiveIntensity: 0 });
    const inst = new THREE.InstancedMesh(new RoundedBoxGeometry(cw * 0.96, ch * 0.96, 1, 2, 0.25), cells, cx * cy);
    const m = new THREE.Matrix4();
    let n = 0;
    // A fixed pseudo-random mosaic, so the board looks the same on every run.
    let seed = id.length * 7 + 3;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        const d = 0.8 + rnd() * 1.4;
        m.makeScale(1, 1, d).setPosition(-w / 2 + cw * (i + 0.5), h / 2 - ch * (j + 0.5), d / 2 - 0.5);
        inst.setMatrixAt(n, m);
        inst.setColorAt(n++, _c.set(palette[Math.floor(rnd() * palette.length)]));
      }
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture(lines, w, h, { size: 2.7, halo: true, weight: 650 }), transparent: true, depthWrite: false, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelMat);
    label.position.z = 2.05;
    const ringMat = this.ringMat();
    const ring = new THREE.Mesh(this.ring(w, h, 0.6), ringMat);
    ring.position.z = -0.4;
    inner.add(inst, label, ring);
    let icon: THREE.MeshBasicMaterial | undefined;
    if (iconX !== undefined) {
      icon = new THREE.MeshBasicMaterial({ map: iconTexture(), transparent: true, depthWrite: false });
      const ic = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 18.4), icon);
      ic.position.set(iconX - x, 0, 0.5);
      inner.add(ic);
    }
    group.add(inner);
    this.root.add(group);
    this.mods[id] = { id, group, inner, w, h, base: new THREE.Color('#ffffff'), cells, labelMat, icon, ring: ringMat, st: { dim: 0, lift: 0, ring: 0, on: 0 }, k: this.kOf(x - w / 2) };
  }

  private node(id: string, x: number, y: number) {
    const group = new THREE.Group();
    group.position.set(x, y, 0.6);
    const ink = new THREE.MeshBasicMaterial({ color: COL.line });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2, 32), white);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 10, 40), ink);
    const h = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.3), ink);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.3), ink);
    h.position.z = v.position.z = 0.1;
    group.add(disc, ring, h, v);
    this.root.add(group);
    this.plus[id] = { id, group, mats: [ink], st: { dim: 0, on: 0 }, k: this.kOf(x) };
  }

  private line(id: string, pts: [number, number][], arrow: boolean, color = COL.line, radius = 0.42, corner = 2.4) {
    const path = polyPath(pts, corner);
    const len = path.getLength();
    const u = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uColor: { value: new THREE.Color(color) },
      uFlowColor: { value: COL.sky.clone() },
      uPulseColor: { value: COL.sun.clone() },
      uDimColor: { value: COL.dim.clone() },
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uDim: { value: 0 },
      uDraw: { value: 0 },
      uPulse: { value: -1 },
      uLen: { value: len },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: lineVert, fragmentShader: lineFrag, fog: true });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, Math.round(len * 1.5)), radius, 8), mat);
    this.root.add(mesh);
    const ln: Line = { id, mesh, u, k0: this.kOf(Math.min(...pts.map((p) => p[0]))), k1: this.kOf(Math.max(...pts.map((p) => p[0]))), st: { dim: 0 } };
    if (arrow) {
      const end = path.getPoint(1);
      const dir = path.getTangent(1);
      ln.coneMat = new THREE.MeshBasicMaterial({ color });
      ln.cone = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.3, 18), ln.coneMat);
      ln.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      ln.cone.position.copy(end).addScaledVector(dir, -1.15);
      this.root.add(ln.cone);
    }
    this.lines[id] = ln;
    return ln;
  }

  private buildFrame() {
    const L = -117;
    const R = 132;
    const T = 38.5;
    const B = -36;
    const mid = (L + R) / 2;
    const gap = 30;
    this.frameLine = this.line(
      'frame',
      [
        [mid + gap, T],
        [R, T],
        [R, B],
        [L, B],
        [L, T],
        [mid - gap, T],
      ],
      false,
      COL.frame,
      0.28,
      8,
    );
    this.frameLine.k0 = 0;
    this.frameLine.k1 = 0.75;
    this.frameLabel = new THREE.MeshBasicMaterial({ map: labelTexture([F.frame], 60, 5.5, { size: 3.3, weight: 650 }), transparent: true, depthWrite: false, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(60, 5.5), this.frameLabel);
    label.position.set(mid, T, 0.2);
    this.root.add(label);
  }

  /** 47 more blocks behind the first: same layout, each with its own (tinted) weights. */
  private buildGhosts() {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, color: THREE.Color) => {
      g.translate(x, y, 0);
      const n = g.getAttribute('position').count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) color.toArray(c, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      parts.push(g.toNonIndexed());
    };
    for (const m of Object.values(this.mods)) {
      if (m.id.endsWith('In') || m.id.endsWith('Out')) continue;
      add(new THREE.PlaneGeometry(m.w, m.h), m.group.position.x, m.group.position.y, m.base);
    }
    const frame = this.ring(249, 74.5, 8);
    add(frame, 7.5, 1.25, new THREE.Color(COL.frame));
    const merged = mergeGeometries(parts)!;
    this.ghostMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.ghosts = new THREE.InstancedMesh(merged, this.ghostMat, 47);
    const c = new THREE.Color();
    for (let i = 0; i < 47; i++) this.ghosts.setColorAt(i, c.setHSL(0, 0, 0.82 + Math.random() * 0.18).lerp(new THREE.Color().setHSL(Math.random(), 0.5, 0.85), 0.35));
    this.ghosts.frustumCulled = false;
    this.ghosts.visible = false;
    this.root.add(this.ghosts);
  }

  // ---------------------------------------------------------------- control

  /** Build the board in (left to right) or take it away. */
  show(on: boolean, o: { duration?: number; delay?: number } = {}) {
    this.group.visible = true;
    return gsap.to(this.st, {
      build: on ? 1 : 0,
      duration: o.duration ?? (on ? 2.6 : 0.8),
      delay: on ? (o.delay ?? 0) : 0,
      ease: on ? 'power1.inOut' : 'power2.in',
      overwrite: 'auto',
      onComplete: () => {
        if (!on) this.group.visible = false;
      },
    });
  }

  get visible() {
    return this.st.build > 0.001;
  }

  /**
   * Light some parts and dim the rest. Ids are module ids, line ids (m0…, p0…, bias, opmIn,
   * opmOut, r-…) or join ids (p-…). `null` returns the whole figure to normal.
   */
  focus(ids: string[] | null, o: { dim?: number; lift?: boolean; duration?: number; delay?: number } = {}) {
    const on = (id: string) => !ids || ids.includes(id);
    const dim = o.dim ?? 0.62;
    const d = { duration: o.duration ?? 0.7, delay: o.delay ?? 0, ease: 'power2.out', overwrite: 'auto' as const };
    for (const m of Object.values(this.mods)) {
      const sel = !!ids && ids.includes(m.id);
      gsap.to(m.st, { dim: on(m.id) ? 0 : dim, lift: sel && o.lift !== false ? 1 : 0, ring: sel ? 1 : 0, ...d });
    }
    for (const l of Object.values(this.lines)) if (l !== this.frameLine) gsap.to(l.st, { dim: on(l.id) ? 0 : dim, ...d });
    for (const p of Object.values(this.plus)) gsap.to(p.st, { dim: on(p.id) ? 0 : dim, ...d });
    gsap.to(this.frameLine.st, { dim: !ids || ids.includes('frame') ? 0 : dim * 0.6, ...d });
  }

  /** Moving dashes along lines (all lines, or only `ids`). */
  flow(on: boolean, ids?: string[]) {
    for (const l of Object.values(this.lines)) {
      if (l === this.frameLine) continue;
      const v = on && (!ids || ids.includes(l.id)) ? 1 : 0;
      gsap.to(l.u.uFlow, { value: v, duration: 0.8, overwrite: 'auto' });
    }
  }

  /** A bright pulse travels the given lines and modules in order. */
  trace(seq: string[], o: { step?: number; delay?: number } = {}) {
    const tl = gsap.timeline({ delay: o.delay ?? 0 });
    const step = o.step ?? 0.32;
    seq.forEach((id) => {
      const l = this.lines[id];
      if (l) {
        const len = l.u.uLen.value as number;
        const dur = Math.max(0.12, Math.min(1.4, len / 60)) * (step / 0.32);
        tl.fromTo(l.u.uPulse, { value: -0.2 }, { value: 1.2, duration: dur, ease: 'none' });
        return;
      }
      const m = this.mods[id as ModId];
      if (m) {
        tl.to(m.st, { lift: 1, ring: 1, duration: step * 0.6, ease: 'power2.out' });
        tl.to(m.st, { lift: 0, ring: 0, duration: step * 1.2, ease: 'power2.inOut' }, `>-${step * 0.1}`);
        return;
      }
      const p = this.plus[id];
      if (p) tl.fromTo(p.group.scale, { x: 1, y: 1, z: 1 }, { x: 1.5, y: 1.5, z: 1.5, duration: step * 0.5, yoyo: true, repeat: 1, ease: 'power2.out' });
    });
    return tl;
  }

  /** Spread the 47 hidden blocks out behind the first one. */
  stack(on: boolean, duration = 2.2) {
    if (on) this.ghosts.visible = true;
    return gsap.to(this.st, {
      stack: on ? 1 : 0,
      duration,
      ease: on ? 'power3.out' : 'power2.inOut',
      overwrite: 'auto',
      onComplete: () => {
        if (!on) this.ghosts.visible = false;
      },
    });
  }

  /** World position on a module: its centre, or the middle of one of its edges. */
  point(id: ModId, where: 'center' | 'top' | 'bottom' | 'left' | 'right' = 'center', out = new THREE.Vector3()) {
    const m = this.mods[id];
    out.set(0, 0, 1.4);
    if (where === 'top') out.y = m.h / 2;
    if (where === 'bottom') out.y = -m.h / 2;
    if (where === 'left') out.x = -m.w / 2;
    if (where === 'right') out.x = m.w / 2;
    return m.inner.localToWorld(out);
  }

  /** The front corners of one or more modules, in world space (for the lens). */
  corners(...ids: ModId[]) {
    const out: THREE.Vector3[] = [];
    for (const id of ids) {
      const m = this.mods[id];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(m.inner.localToWorld(new THREE.Vector3((sx * m.w) / 2, (sy * m.h) / 2, 1.4)));
    }
    return out;
  }

  // ---------------------------------------------------------------- per frame

  update(t: number) {
    if (!this.group.visible) return;
    const b = this.st.build;
    const appear = (k: number) => Math.min(1, Math.max(0, (b * 1.25 - k) / 0.25));
    for (const m of Object.values(this.mods)) {
      const a = appear(m.k);
      const s = a > 0 ? Math.max(1e-4, this.ease(a)) : 1e-4;
      m.group.scale.setScalar(s);
      m.group.visible = a > 0;
      const dim = m.st.dim;
      m.inner.position.z = m.st.lift * 3.2;
      if (m.mat) m.mat.color.copy(m.base).lerp(COL.dim, dim * 0.8);
      if (m.cells) m.cells.emissiveIntensity = dim * 0.55;
      m.labelMat.opacity = 1 - dim * 0.6;
      if (m.icon) m.icon.opacity = 1 - dim * 0.6;
      m.ring.opacity = m.st.ring * 0.9;
    }
    for (const l of Object.values(this.lines)) {
      const span = Math.max(0.05, l.k1 - l.k0);
      l.u.uDraw.value = Math.min(1.001, Math.max(0, (b * 1.25 - l.k0) / (span + 0.25)));
      l.u.uDim.value = l.st.dim;
      l.u.uTime.value = t;
      l.mesh.visible = l.u.uDraw.value > 0;
      if (l.cone && l.coneMat) {
        l.cone.visible = l.u.uDraw.value >= 1;
        l.coneMat.color.copy(l.u.uColor.value as THREE.Color).lerp(COL.dim, l.st.dim * 0.85);
      }
    }
    for (const p of Object.values(this.plus)) {
      const a = appear(p.k);
      p.group.visible = a > 0;
      if (!gsap.isTweening(p.group.scale)) p.group.scale.setScalar(Math.max(1e-4, this.ease(a)));
      p.mats[0].color.set(COL.line).lerp(COL.dim, p.st.dim * 0.85);
    }
    this.frameLabel.opacity = Math.min(1, Math.max(0, b * 1.25 - 0.4) / 0.3) * (1 - this.frameLine.st.dim * 0.6);
    const cardA = Math.min(1, b * 3);
    this.card.scale.set(1, Math.max(1e-4, cardA), 1);
    this.shadow.visible = this.card.visible = cardA > 0.01;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.4 * cardA;
    // Ghost blocks recede into the screen.
    const k = this.st.stack;
    this.ghosts.visible = k > 0.001;
    if (this.ghosts.visible) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < 47; i++) {
        m.makeTranslation(0, 0, -(i + 1) * 7 * k - 3.5);
        this.ghosts.setMatrixAt(i, m);
      }
      this.ghosts.instanceMatrix.needsUpdate = true;
      this.ghostMat.opacity = 0.55 * Math.min(1, k * 2);
    }
  }
}
