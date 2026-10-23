import gsap from 'gsap';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Letter tiles: sequences and alignments as rows of small glossy blocks, each with a crisp
// letter on its face. One instanced body mesh plus one instanced face mesh reading a glyph atlas.

const GLYPHS = 'ACDEFGHIKLMNPQRSTVWYXBZUO-*+−…0123456789·?ij';
const CELLS = 8;
let atlas: THREE.CanvasTexture | undefined;

function glyphAtlas() {
  if (atlas) return atlas;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S * CELLS;
  const g = cv.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  [...GLYPHS].forEach((ch, i) => {
    g.font = `${/[a-z]/.test(ch) ? 'italic 700' : '800'} ${S * 0.7}px "JetBrains Mono Variable", monospace`;
    g.fillText(ch, (i % CELLS) * S + S / 2, Math.floor(i / CELLS) * S + S / 2 + S * 0.04);
  });
  atlas = new THREE.CanvasTexture(cv);
  atlas.anisotropy = 8;
  atlas.colorSpace = THREE.NoColorSpace;
  return atlas;
}

export const glyphOf = (ch: string) => Math.max(0, GLYPHS.indexOf(ch));

/** Soft amino-acid colours by chemistry, tuned for a light background. */
export function residueColor(aa: string, out = new THREE.Color()) {
  if ('AVLIMFWP'.includes(aa)) return out.set('#cfe6f6');
  if ('KRH'.includes(aa)) return out.set('#a9c4f5');
  if ('DE'.includes(aa)) return out.set('#ffc6ab');
  if ('STNQCY'.includes(aa)) return out.set('#fff0a6');
  if (aa === 'G') return out.set('#e4e9f0');
  return out.set('#f4f6f9');
}

export interface Tile {
  x: number;
  y: number;
  z: number;
  /** Uniform scale (0 hides the tile). */
  s: number;
  /** Depth multiplier: tiles can be extruded into feature stacks. */
  d: number;
  /** Extra z offset, for lifting a tile out of its row. */
  lift: number;
  rx: number;
  ry: number;
  /** Letter opacity. */
  g: number;
}

const _m = new THREE.Matrix4();
const _f = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Tiles {
  group = new THREE.Group();
  body: THREE.InstancedMesh;
  face: THREE.InstancedMesh;
  t: Tile[];
  readonly n: number;
  /** Scale a tile has when shown (tiles are 0.9 units across at scale 1). */
  unit = 1;
  private glyph: THREE.InstancedBufferAttribute;
  private ink: THREE.InstancedBufferAttribute;
  private alpha: THREE.InstancedBufferAttribute;
  private faceZ: number;
  private c = new THREE.Color();

  constructor(n: number, o: { size?: number; depth?: number; radius?: number } = {}) {
    this.n = n;
    const size = o.size ?? 0.9;
    const depth = o.depth ?? 0.34;
    this.faceZ = depth / 2 + 0.004;
    this.body = new THREE.InstancedMesh(
      new RoundedBoxGeometry(size, size, depth, 2, o.radius ?? 0.1),
      new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
      n,
    );
    const faceGeo = new THREE.PlaneGeometry(size * 0.86, size * 0.86);
    this.glyph = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.ink = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    faceGeo.setAttribute('aGlyph', this.glyph);
    faceGeo.setAttribute('aInk', this.ink);
    faceGeo.setAttribute('aAlpha', this.alpha);
    this.face = new THREE.InstancedMesh(
      faceGeo,
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null } }]),
        fog: true,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          attribute float aGlyph; attribute vec3 aInk; attribute float aAlpha;
          varying vec2 vUv; varying vec3 vInk; varying float vAlpha;
          #include <fog_pars_vertex>
          void main() {
            float col = mod(aGlyph, ${CELLS}.0);
            float row = floor(aGlyph / ${CELLS}.0);
            vUv = vec2((col + uv.x) / ${CELLS}.0, 1.0 - (row + 1.0 - uv.y) / ${CELLS}.0);
            vInk = aInk; vAlpha = aAlpha;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uAtlas;
          varying vec2 vUv; varying vec3 vInk; varying float vAlpha;
          #include <fog_pars_fragment>
          void main() {
            float a = texture2D(uAtlas, vUv).r * vAlpha;
            if (a < 0.02) discard;
            gl_FragColor = vec4(vInk, a);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      }),
      n,
    );
    (this.face.material as THREE.ShaderMaterial).uniforms.uAtlas.value = glyphAtlas();
    this.body.frustumCulled = this.face.frustumCulled = false;
    this.group.add(this.body, this.face);
    this.t = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, s: 0, d: 1, lift: 0, rx: 0, ry: 0, g: 1 }));
    for (let i = 0; i < n; i++) {
      this.color(i, '#f4f6f9');
      this.inkColor(i, '#0b1f3a');
    }
  }

  char(i: number, ch: string) {
    this.glyph.setX(i, glyphOf(ch));
    this.glyph.needsUpdate = true;
    return this;
  }

  color(i: number, c: THREE.ColorRepresentation) {
    this.body.setColorAt(i, this.c.set(c));
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    return this;
  }

  inkColor(i: number, c: THREE.ColorRepresentation) {
    this.c.set(c);
    this.ink.setXYZ(i, this.c.r, this.c.g, this.c.b);
    this.ink.needsUpdate = true;
    return this;
  }

  /** Set a run of tiles to the letters of `s`, coloured by residue chemistry. */
  text(start: number, s: string, colour = true) {
    [...s].forEach((ch, k) => {
      this.char(start + k, ch);
      if (colour) this.color(start + k, residueColor(ch));
    });
    return this;
  }

  private tween?: gsap.core.Tween;

  /**
   * Grow the tiles in (to `unit`) or shrink them away. The running tween is tracked and killed
   * explicitly: gsap.killTweensOf misses delayed tweens that use an object stagger.
   */
  show(on: boolean, o: { delay?: number; amount?: number; from?: 'start' | 'end' | 'center' } = {}) {
    this.tween?.kill();
    gsap.killTweensOf(this.t, 's');
    this.tween = gsap.to(this.t, {
      s: on ? this.unit : 0,
      duration: on ? 0.5 : 0.3,
      delay: on ? (o.delay ?? 0) : 0,
      stagger: { amount: on ? (o.amount ?? 0.6) : 0.15, from: o.from ?? 'start' },
      ease: on ? 'back.out(1.8)' : 'power2.in',
    });
    return this.tween;
  }

  get visible() {
    return this.t.some((t) => t.s > 0.001);
  }

  update() {
    const vis = this.visible;
    this.group.visible = vis;
    if (!vis) return;
    for (let i = 0; i < this.n; i++) {
      const t = this.t[i];
      const s = Math.max(1e-5, t.s);
      _p.set(t.x, t.y, t.z + t.lift);
      _q.setFromEuler(_e.set(t.rx, t.ry, 0));
      _s.set(s, s, s * t.d);
      _m.compose(_p, _q, _s);
      this.body.setMatrixAt(i, _m);
      _f.makeTranslation(0, 0, this.faceZ);
      _m.multiply(_f);
      this.face.setMatrixAt(i, _m);
      this.alpha.setX(i, t.s > 0.001 ? t.g : 0);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.face.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}
