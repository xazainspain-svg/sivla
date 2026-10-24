import * as THREE from 'three';
import type { InputState } from '../engine/input';
import { PROFILES, type QualityLevel } from '../engine/quality';
import { disposeTree } from '../engine/dispose';
import { clamp, damp, easeOutExpo, lerp, smoothstep } from '../engine/math';
import { studioEnvironment } from '../materials/environments';
import { DISC_FRAG, DISC_VERT } from '../shaders/disc';

const INNER = 0.62;
const OUTER = 3.3;
const BAR_COUNT = 48;

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
  private progress = 0;
  private env: THREE.Texture;
  private bars!: THREE.InstancedMesh;
  private barH = new Float32Array(BAR_COUNT);
  private dummy = new THREE.Object3D();
  private audioBands = new Float32Array(8);
  private audioOn = false;
  private lookAt = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, quality: QualityLevel, still: boolean) {
    this.stillMode = still;
    this.env = studioEnvironment(renderer);
    this.scene.environment = this.env;
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
        uBands: { value: new Float32Array(8) },
        uAudio: { value: 0 },
        uKickAge: { value: 99 },
        uKickAmt: { value: 0 },
        uInner: { value: INNER },
        uOuter: { value: OUTER },
      },
    });
    this.mesh = new THREE.Mesh(this.makeGeometry(quality), this.material);
    this.group.add(this.mesh);
    this.group.rotation.set(-1.0, 0, -0.35);
    this.scene.add(this.group);

    // Barras de ecualizador cromadas: el disco se descompone en ellas al cruzar su agujero
    const barGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
    barGeo.translate(0, 0.5, 0);
    this.bars = new THREE.InstancedMesh(barGeo, new THREE.MeshStandardMaterial({ color: 0x8fa2e6, metalness: 1, roughness: 0.22, envMapIntensity: 1.5 }), BAR_COUNT);
    this.bars.frustumCulled = false;
    this.bars.visible = false;
    this.scene.add(this.bars);
  }

  /** Progreso del recorrido hero → sound (0–1). */
  setProgress(p: number): void {
    this.progress = p;
  }

  private makeGeometry(level: QualityLevel): THREE.BufferGeometry {
    const p = PROFILES[level];
    return new THREE.RingGeometry(INNER, OUTER, p.thetaSegments, p.phiSegments);
  }

  /** Recibe el análisis de audio de este fotograma. */
  setAudio(bands: Float32Array, kickAge: number, kickAmt: number, active: boolean): void {
    this.audioBands.set(bands);
    this.audioOn = active;
    const u = this.material.uniforms;
    (u.uBands.value as Float32Array).set(bands);
    u.uKickAge.value = kickAge;
    u.uKickAmt.value = kickAmt;
    u.uAudio.value = damp(u.uAudio.value as number, active ? 1 : 0, 6, 0.016);
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
    const p = this.stillMode ? 0 : this.progress;
    const toCenter = smoothstep(0.0, 0.3, p);        // el disco viaja al centro y se pone de frente
    const through = smoothstep(0.26, 0.5, p);       // la cámara cruza el agujero
    const bars = smoothstep(0.46, 0.64, p);         // el disco se descompone en barras

    // cámara: travelling de entrada → parallax → cruce del agujero hacia las barras
    const camZ = lerp(lerp(17, 14, intro), -1.2, through);
    this.camera.position.x = damp(this.camera.position.x, input.sx * 0.5 * (1 - through * 0.6), 3, dt);
    this.camera.position.y = damp(this.camera.position.y, input.sy * 0.35 * (1 - through * 0.6), 3, dt);
    this.camera.position.z = camZ;
    this.lookAt.set(0, lerp(0, -0.6, through), lerp(0, -12, through));
    this.camera.lookAt(this.lookAt);

    // disco: posición según viewport, inclinación con el cursor, viaje al centro
    const px = lerp(narrow ? 0 : 2.7, 0, toCenter);
    const py = lerp(narrow ? 1.7 : 0.2, 0, toCenter);
    this.group.position.set(px, py, 0);
    this.group.scale.setScalar(lerp(narrow ? 0.72 : 1, narrow ? 1.2 : 1.7, toCenter));
    const kd = this.stillMode ? 1 : 1 - Math.exp(-3 * dt);
    const tx = lerp(-1.0 + (this.stillMode ? 0 : input.sy * 0.2), 0, toCenter);
    const tz = lerp(-0.35 + (this.stillMode ? 0 : input.sx * 0.2), 0, toCenter);
    this.group.rotation.x += (tx - this.group.rotation.x) * kd;
    this.group.rotation.z += (tz - this.group.rotation.z) * kd;
    if (!this.stillMode) this.group.rotation.y = damp(this.group.rotation.y, input.sx * 0.12 * (1 - toCenter), 3, dt);
    this.group.visible = p < 0.56;
    this.updateBars(dt, t, bars, narrow);

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

  /** Barras de ecualizador: siguen el audio si suena; si no, un pulso de reposo (procedural). */
  private updateBars(dt: number, t: number, reveal: number, narrow: boolean): void {
    this.bars.visible = reveal > 0.001;
    if (!this.bars.visible) return;
    const n = narrow ? 28 : BAR_COUNT;
    const width = narrow ? 5.4 : 7.4;
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i / (BAR_COUNT - 1);
      const f = x * 7;
      const i0 = Math.floor(f), i1 = Math.min(i0 + 1, 7);
      const band = lerp(this.audioBands[i0], this.audioBands[i1], f - i0);
      const idle = 0.16 + 0.1 * Math.sin(t * 0.9 + i * 0.45) + 0.06 * Math.sin(t * 1.7 + i * 1.3);
      const target = (this.audioOn ? 0.08 + band * 0.85 : idle) * clamp((reveal - (i / BAR_COUNT) * 0.5) / 0.5, 0, 1);
      this.barH[i] = damp(this.barH[i], target, 10, dt);
      this.dummy.position.set((x - 0.5) * width, -2.15, -9);
      this.dummy.scale.set(width / BAR_COUNT / 0.1 * 0.55, Math.max(0.02, this.barH[i] * 2.4), 1);
      this.dummy.visible = i < n || !narrow;
      this.dummy.updateMatrix();
      this.bars.setMatrixAt(i, this.dummy.matrix);
    }
    this.bars.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeTree(this.scene);
    this.env.dispose();
  }
}
