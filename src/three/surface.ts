import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { C } from './world';

// Molecular surface: a blobby (Blinn) density of all heavy atoms, polygonised by marching cubes.
// The material can highlight a pocket, breathe, deform and reveal itself from the centre out.

const RADIUS: Record<string, number> = { C: 1.7, N: 1.55, O: 1.52, S: 1.8 };

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export interface SurfaceOptions {
  /** Grid step in Å. */
  step?: number;
  /** Blobbiness: lower is smoother. */
  blob?: number;
  /** Points (xyz) around which the surface counts as "pocket". */
  pocket?: Float32Array;
  pocketReach?: number;
  color?: THREE.Color;
}

export class Surface {
  mesh: THREE.Mesh;
  centre = new THREE.Vector3();
  radius = 1;
  uniforms = {
    uReveal: { value: 1.2 },
    uPocket: { value: 0 },
    uPocketColor: { value: new THREE.Color('#ffc20e') },
    uDeform: { value: 0 },
    uBreath: { value: 0 },
    uTime: { value: 0 },
    uDim: { value: 0 },
    /** A glowing band that sweeps across the surface along `uScanAxis` (local space). */
    uScan: { value: -999 },
    uScanAxis: { value: new THREE.Vector3(1, 0, 0) },
    /** Cutaway sphere (local xyz, radius): opens a window onto buried pockets. */
    uCut: { value: new THREE.Vector4(0, 0, 0, 0) },
  };

  constructor(xyz: Float32Array, elements: string[], o: SurfaceOptions = {}) {
    const step = o.step ?? 0.75;
    const blob = o.blob ?? 0.62;
    const n = xyz.length / 3;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromArray(xyz, i * 3);
      min.min(p);
      max.max(p);
    }
    this.centre.addVectors(min, max).multiplyScalar(0.5);
    const pad = 6;
    const L = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) + pad * 2;
    const size = Math.ceil(L / step);
    const mc = new MarchingCubes(size, new THREE.MeshBasicMaterial(), false, false, 600000);
    const field = mc.field as Float32Array;
    const origin = this.centre.clone().subScalar(L / 2);
    const cell = L / size;

    for (let i = 0; i < n; i++) {
      const r = RADIUS[elements[i]] ?? 1.7;
      // Far enough that the cut-off contribution is below 1%, so the field has no seams.
      const reach = r * Math.sqrt(1 + 4.6 / blob);
      const ax = xyz[i * 3];
      const ay = xyz[i * 3 + 1];
      const az = xyz[i * 3 + 2];
      const gx = (ax - origin.x) / cell;
      const gy = (ay - origin.y) / cell;
      const gz = (az - origin.z) / cell;
      const gr = Math.ceil(reach / cell);
      const r2 = r * r;
      for (let z = Math.max(1, Math.floor(gz - gr)); z <= Math.min(size - 2, Math.ceil(gz + gr)); z++) {
        const dz = (z - gz) * cell;
        for (let y = Math.max(1, Math.floor(gy - gr)); y <= Math.min(size - 2, Math.ceil(gy + gr)); y++) {
          const dy = (y - gy) * cell;
          const row = z * size * size + y * size;
          for (let x = Math.max(1, Math.floor(gx - gr)); x <= Math.min(size - 2, Math.ceil(gx + gr)); x++) {
            const dx = (x - gx) * cell;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > reach * reach) continue;
            field[row + x] += Math.exp(-blob * (d2 / r2 - 1));
          }
        }
      }
    }
    mc.isolation = 1;
    mc.update();

    const count = mc.count;
    const P = new Float32Array(count * 3);
    const Nn = new Float32Array(count * 3);
    const src = mc.positionArray as Float32Array;
    const nrm = mc.normalArray as Float32Array;
    const half = L / 2;
    for (let i = 0; i < count; i++) {
      P[i * 3] = this.centre.x + src[i * 3] * half;
      P[i * 3 + 1] = this.centre.y + src[i * 3 + 1] * half;
      P[i * 3 + 2] = this.centre.z + src[i * 3 + 2] * half;
      p.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]).normalize();
      Nn[i * 3] = p.x;
      Nn[i * 3 + 1] = p.y;
      Nn[i * 3 + 2] = p.z;
    }
    mc.geometry.dispose();

    // Per-vertex: distance from the centre (for the reveal) and pocket membership.
    const aR = new Float32Array(count);
    const aPocket = new Float32Array(count);
    let rmax = 0;
    for (let i = 0; i < count; i++) {
      const d = p.fromArray(P, i * 3).distanceTo(this.centre);
      aR[i] = d;
      rmax = Math.max(rmax, d);
    }
    this.radius = rmax;
    for (let i = 0; i < count; i++) aR[i] /= rmax;
    if (o.pocket) {
      const reach = o.pocketReach ?? 4.5;
      const k = o.pocket.length / 3;
      for (let i = 0; i < count; i++) {
        let best = Infinity;
        for (let j = 0; j < k; j++) {
          const dx = P[i * 3] - o.pocket[j * 3];
          const dy = P[i * 3 + 1] - o.pocket[j * 3 + 1];
          const dz = P[i * 3 + 2] - o.pocket[j * 3 + 2];
          best = Math.min(best, dx * dx + dy * dy + dz * dz);
        }
        const d = Math.sqrt(best);
        aPocket[i] = d < reach ? 1 : d < reach + 2.5 ? 1 - (d - reach) / 2.5 : 0;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
    geo.setAttribute('aPocket', new THREE.BufferAttribute(aPocket, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.MeshPhysicalMaterial({
      color: o.color ?? C.clay,
      roughness: 0.48,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      // Inner faces show through cutaways.
      side: THREE.DoubleSide,
    });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aR; attribute float aPocket;
          uniform float uDeform; uniform float uBreath; uniform float uTime; uniform vec3 uScanAxis;
          varying float vR; varying float vPocket; varying float vS; varying vec3 vLocal;
          ${NOISE}`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          float n1 = snoise(position * 0.08 + vec3(uTime * 0.22));
          float n2 = snoise(position * 0.19 - vec3(uTime * 0.31));
          transformed += normal * (uBreath * (0.55 * n1 + 0.25 * n2) + uDeform * (6.0 * n1 + 2.5 * n2));
          vR = aR; vPocket = aPocket; vS = dot(position, uScanAxis); vLocal = position;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uReveal; uniform float uPocket; uniform vec3 uPocketColor; uniform float uDim; uniform float uScan; uniform vec4 uCut;
          varying float vR; varying float vPocket; varying float vS; varying vec3 vLocal;`,
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          if (vR > uReveal) discard;
          if (uCut.w > 0.0 && distance(vLocal, uCut.xyz) < uCut.w) discard;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float pk = vPocket * uPocket;
          diffuseColor.rgb = mix(diffuseColor.rgb, uPocketColor, pk);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.95), uDim * 0.75);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += uPocketColor * pk * 0.22;
          float band = 1.0 - smoothstep(0.0, 2.6, abs(vS - uScan));
          totalEmissiveRadiance += vec3(0.25, 0.6, 1.0) * band * 0.9;
          totalEmissiveRadiance += vec3(0.4, 0.75, 1.0) * smoothstep(0.035, 0.0, uReveal - vR) * step(uReveal, 1.0) * 0.8;`,
        );
    };
    mat.customProgramCacheKey = () => 'surface';
    this.mesh = new THREE.Mesh(geo, mat);
  }

  get reveal() {
    return this.uniforms.uReveal.value;
  }
  set reveal(v: number) {
    this.uniforms.uReveal.value = v;
    this.mesh.visible = v > 0.001;
  }
}
