import * as THREE from 'three';
import type { InputState } from '../engine/input';
import { PROFILES, type QualityLevel } from '../engine/quality';
import { disposeTree } from '../engine/dispose';
import { damp, easeOutExpo, lerp } from '../engine/math';
import { DISC_FRAG, DISC_VERT } from '../shaders/disc';

const INNER = 0.62;
const OUTER = 3.3;

/** Escena del hero: "El disco líquido". */
export class DiscScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private group = new THREE.Group();
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane();
  private hit = new THREE.Vector3();
  private local = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private force = 0;
  private aspect = 1;
  private introStart = -1;
  private introSeconds = 0;
  private stillMode = false;

  constructor(quality: QualityLevel, still: boolean) {
    this.stillMode = still;
    this.scene.background = new THREE.Color(0xf6f7fb);
    this.camera.position.set(0, 0, 17);
    this.material = new THREE.ShaderMaterial({
      vertexShader: DISC_VERT,
      fragmentShader: DISC_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uIntro: { value: still ? 9 : 0 },
        uPointer: { value: new THREE.Vector2(99, 99) },
        uForce: { value: 0 },
        uPulse: { value: 0 },
        uInner: { value: INNER },
        uOuter: { value: OUTER },
      },
    });
    this.mesh = new THREE.Mesh(this.makeGeometry(quality), this.material);
    this.group.add(this.mesh);
    this.group.rotation.set(-1.0, 0, -0.35);
    this.scene.add(this.group);
  }

  private makeGeometry(level: QualityLevel): THREE.BufferGeometry {
    const p = PROFILES[level];
    return new THREE.RingGeometry(INNER, OUTER, p.thetaSegments, p.phiSegments);
  }

  /** Comienza la secuencia de entrada. */
  startIntro(): void {
    this.introStart = performance.now();
  }

  setQuality(level: QualityLevel): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.makeGeometry(level);
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.fov = this.aspect < 0.9 ? 46 : 32;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, t: number, input: InputState): void {
    const u = this.material.uniforms;
    // tiempo de entrada
    if (!this.stillMode && this.introStart >= 0) this.introSeconds = (performance.now() - this.introStart) / 1000;
    u.uIntro.value = this.stillMode ? 9 : this.introSeconds;
    u.uTime.value = this.stillMode ? 0 : t;
    // pulso de reposo procedural (no es audio)
    u.uPulse.value = this.stillMode ? 0 : 0.35 + 0.35 * Math.sin(t * 0.9);

    const narrow = this.aspect < 0.9;
    const intro = this.stillMode ? 1 : easeOutExpo(Math.min(1, this.introSeconds / 2.4));
    const s = input.scroll;
    // cámara: travelling de entrada + parallax + recorrido de scroll
    const camZ = lerp(17, 14, intro) - s * 3.2;
    this.camera.position.x = damp(this.camera.position.x, input.sx * 0.5, 3, dt);
    this.camera.position.y = damp(this.camera.position.y, input.sy * 0.35, 3, dt);
    this.camera.position.z = camZ;
    this.camera.lookAt(0, 0, 0);

    // disco: posición según viewport, inclinación con el cursor, ascenso con el scroll
    const px = narrow ? 0 : 2.7;
    const py = (narrow ? 1.7 : 0.2) + s * 2.8;
    this.group.position.set(px, py, 0);
    this.group.scale.setScalar((narrow ? 0.72 : 1) * (1 + s * 0.25));
    const kd = this.stillMode ? 1 : 1 - Math.exp(-3 * dt);
    const tx = -1.0 + (this.stillMode ? 0 : input.sy * 0.2);
    const tz = -0.35 + (this.stillMode ? 0 : input.sx * 0.2) + s * 0.6;
    this.group.rotation.x += (tx - this.group.rotation.x) * kd;
    this.group.rotation.z += (tz - this.group.rotation.z) * kd;
    if (!this.stillMode) this.group.rotation.y = damp(this.group.rotation.y, input.sx * 0.12, 3, dt);

    // cursor → punto sobre el plano del disco (espacio local)
    this.group.updateMatrixWorld();
    this.normal.set(0, 0, 1).transformDirection(this.group.matrixWorld);
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.group.position);
    this.ray.setFromCamera(new THREE.Vector2(input.x, input.y), this.camera);
    const ok = this.ray.ray.intersectPlane(this.plane, this.hit);
    if (ok && input.active && !this.stillMode) {
      this.local.copy(this.hit);
      this.group.worldToLocal(this.local);
      (u.uPointer.value as THREE.Vector2).set(this.local.x, this.local.y);
    }
    const speed = Math.hypot(input.vx, input.vy);
    const target = input.active && !this.stillMode ? Math.min(1, 0.5 + speed * 0.12) : 0;
    this.force = damp(this.force, target, 5, dt);
    u.uForce.value = this.force;
  }

  dispose(): void {
    disposeTree(this.scene);
  }
}
