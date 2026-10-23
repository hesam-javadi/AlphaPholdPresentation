import * as THREE from 'three';

// Small reusable pieces for the diagrams: flowing tubes, beams, and copper/ice materials.

/** A tube material with dashes that flow along its length (uv.x), from start to end. */
export function flowMaterial(color: THREE.Color | string, o: { dashes?: number; speed?: number } = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0 },
    uOn: { value: 0 },
    uDashes: { value: o.dashes ?? 40 },
    uSpeed: { value: o.speed ?? 0.6 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uOn; uniform float uDashes; uniform float uSpeed;
      varying vec2 vUv;
      void main() {
        float dash = step(0.5, fract(vUv.x * uDashes - uTime * uSpeed * uOn));
        float a = mix(0.22, 1.0, uOn) * mix(0.55, 1.0, dash * uOn);
        gl_FragColor = vec4(mix(vec3(0.62, 0.68, 0.76), uColor, uOn), a);
        #include <colorspace_fragment>
      }`,
  });
  return { material: m, uniforms };
}

/** A soft beam from a segment's start to its end (uv.y 0→1); it grows in with uOn and pulses along. */
export function beamMaterial(color: THREE.Color | string, o: { pulses?: number } = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0 },
    uOn: { value: 0 },
    uPulses: { value: o.pulses ?? 6 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uOn; uniform float uPulses;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float core = pow(abs(dot(vN, vV)), 1.6);
        float pulse = 0.65 + 0.35 * sin((vUv.y * uPulses - uTime * 2.2) * 6.2831);
        float reach = step(vUv.y, uOn * 1.001);
        gl_FragColor = vec4(uColor, core * pulse * 0.85 * reach * min(uOn * 3.0, 1.0));
        #include <colorspace_fragment>
      }`,
  });
  return { material: m, uniforms };
}

/** Copper for EM grids and bench hardware. */
export const copper = () => new THREE.MeshPhysicalMaterial({ color: '#c9783f', metalness: 0.8, roughness: 0.35, clearcoat: 0.3 });

/** Dark instrument housing. */
export const housing = () => new THREE.MeshPhysicalMaterial({ color: '#16294a', metalness: 0.35, roughness: 0.35, clearcoat: 0.6 });

/** Brushed steel trim. */
export const steel = () => new THREE.MeshPhysicalMaterial({ color: '#aab6c5', metalness: 0.85, roughness: 0.3 });

/** Cylinder geometry from point a to point b. */
export function segment(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, radial = 24) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  const m = new THREE.Mesh(g);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
