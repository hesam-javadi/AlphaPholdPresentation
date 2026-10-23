import * as THREE from 'three';
import { C } from './world';

const IDQ = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();

/** Experimental structures: a small crystal of cubes, one cube per 1,000 structures. */
export class Lattice {
  group = new THREE.Group();
  mesh: THREE.InstancedMesh;
  state = { n: 0 };
  readonly count = 170;
  readonly spacing = 1.25;
  private cells: THREE.Vector3[];

  constructor() {
    const cells: THREE.Vector3[] = [];
    for (let y = 0; y < 5; y++)
      for (let z = 0; z < 6; z++) for (let x = 0; x < 6; x++) cells.push(new THREE.Vector3(x - 2.5, y - 2, z - 2.5));
    cells.sort((a, b) => a.y - b.y || a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z));
    this.cells = cells.slice(0, this.count).map((v) => v.multiplyScalar(this.spacing));
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
      this.count,
    );
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  update() {
    const n = this.state.n;
    this.group.visible = n > 0.001;
    if (!this.group.visible) return;
    this.group.rotation.y += 0.0025;
    for (let i = 0; i < this.count; i++) {
      const s = Math.min(1, Math.max(0, n - i));
      const e = s === 0 ? 0 : 1 + 2.7 * Math.pow(s - 1, 3) + 1.7 * Math.pow(s - 1, 2);
      _s.setScalar(Math.max(1e-5, e * 0.92));
      _m.compose(this.cells[i], IDQ, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** AlphaFold DB: 200,000 points at the crystal's density (one point = 1,000 structures). */
export class Cloud {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
  readonly count = 200_000;
  readonly radius: number;

  constructor(spacing: number) {
    this.radius = Math.cbrt((3 * this.count * spacing ** 3) / (4 * Math.PI));
    const pos = new Float32Array(this.count * 3);
    const col = new Float32Array(this.count * 3);
    const delay = new Float32Array(this.count);
    const stops = [C.blue, C.sky, C.sun, C.ember];
    for (let i = 0; i < this.count; i++) {
      const r = this.radius * Math.cbrt(Math.random());
      _v.randomDirection().multiplyScalar(r).toArray(pos, i * 3);
      delay[i] = (r / this.radius) * 0.5 + Math.random() * 0.08;
      const k = Math.random();
      stops[k < 0.6 ? 0 : k < 0.85 ? 1 : k < 0.94 ? 2 : 3].toArray(col, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uT: { value: 0 }, uScale: { value: 500 }, uSize: { value: spacing * 0.8 } },
    ]);
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      fog: true,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aDelay;
        uniform float uT;
        uniform float uScale;
        uniform float uSize;
        varying vec3 vColor;
        #include <fog_pars_vertex>
        void main() {
          float t = clamp((uT - aDelay) / 0.45, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - t, 3.0);
          float ang = (1.0 - e) * 2.4;
          float c = cos(ang);
          float s = sin(ang);
          vec3 p = position * e;
          p.xz = mat2(c, -s, s, c) * p.xz;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = step(0.001, t) * uSize * uScale / -mvPosition.z * (0.5 + 0.5 * e);
          vColor = aColor;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        #include <fog_pars_fragment>
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          if (dot(d, d) > 0.25) discard;
          gl_FragColor = vec4(vColor, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  set t(v: number) {
    this.uniforms.uT.value = v;
    this.points.visible = v > 0.001;
  }
  get t() {
    return this.uniforms.uT.value;
  }
}
