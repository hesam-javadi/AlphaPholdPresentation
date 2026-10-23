import gsap from 'gsap';
import * as THREE from 'three';
import { C } from './world';

/** Curved links between points; each fades on its own. */
export class Links {
  group = new THREE.Group();
  private items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; cone?: THREE.Mesh }[] = [];

  set(list: { a: THREE.Vector3; b: THREE.Vector3; w?: number; bend?: THREE.Vector3; color?: THREE.ColorRepresentation; arrow?: boolean; r?: number }[]) {
    this.clear();
    for (const l of list) {
      const mid = l.a.clone().add(l.b).multiplyScalar(0.5).add(l.bend ?? new THREE.Vector3(0, l.a.distanceTo(l.b) * 0.35, 0));
      const curve = new THREE.QuadraticBezierCurve3(l.a, mid, l.b);
      const mat = new THREE.MeshBasicMaterial({ color: l.color ?? C.blue, transparent: true, opacity: 0, depthWrite: false });
      const r = (l.r ?? 0.35) * (0.4 + (l.w ?? 1) * 1.6);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 8), mat);
      mesh.userData.w = l.w ?? 1;
      this.group.add(mesh);
      const item: (typeof this.items)[number] = { mesh, mat };
      if (l.arrow) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 6, 14), mat);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1));
        cone.position.copy(l.b).addScaledVector(curve.getTangent(1), -r * 3);
        this.group.add(cone);
        item.cone = cone;
      }
      this.items.push(item);
    }
    return this;
  }

  show(on: boolean, o: { delay?: number; stagger?: number; opacity?: number; instant?: boolean } = {}) {
    this.items.forEach((it, i) => {
      const target = on ? (o.opacity ?? 0.9) * Math.min(1, 0.25 + it.mesh.userData.w) : 0;
      if (o.instant) return void (it.mat.opacity = target);
      gsap.to(it.mat, {
        opacity: target,
        duration: on ? 0.6 : 0.3,
        delay: on ? (o.delay ?? 0) + i * (o.stagger ?? 0.05) : 0,
        overwrite: true,
      });
    });
  }

  clear() {
    for (const it of this.items) {
      gsap.killTweensOf(it.mat);
      it.mesh.geometry.dispose();
      it.cone?.geometry.dispose();
      it.mat.dispose();
    }
    this.group.clear();
    this.items = [];
  }
}
