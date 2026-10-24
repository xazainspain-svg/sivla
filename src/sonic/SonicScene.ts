import * as THREE from 'three';
import { clamp, damp, lerp } from '../engine/math';
import { disposeTree } from '../engine/dispose';
import { beat } from '../app/beat';
import { TERRAIN_VERT, TERRAIN_FRAG, BEAM_VERT, BEAM_FRAG } from './shaders';

export const F_MIN = 40, F_MAX = 16000;
export const freqAt = (u: number): number => F_MIN * Math.pow(F_MAX / F_MIN, clamp(u, 0, 1));
const FOG = new THREE.Color(0xe4e8f7);

/** Paisaje del sonido: el espectro de la música (frecuencia en X, tiempo en Z) forma un relieve topográfico que se recorre. */
export class SonicScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80);
  private readonly cols: number; private readonly rows: number;
  private readonly data: Uint8Array;
  private readonly tex: THREE.DataTexture;
  private readonly terrain: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private readonly dust: THREE.Points;
  private readonly u: Record<string, THREE.IUniform>;
  private readonly beamU: Record<string, THREE.IUniform>;
  private acc = 0;
  private running = false; private raf = 0; private last = 0;
  time = 0;
  focus = 0.5; private focusSm = 0.5;
  /** 0 = sonido original; >0 = se escucha sobre todo la zona enfocada. */
  engaged = false; private engSm = 0;
  width = 0.5; // 0 estrecho … 1 ancho
  private yaw = 0; private pitch = 0; private ty = 0; private tp = 0; private vy = 0; private dragging = false;
  private level = 0;
  private readonly rowRate: number;
  private readonly calm: boolean;
  private lastFocusSent = 0;
  onFrame: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, opts: { mobile: boolean; reduced: boolean }) {
    this.cols = opts.mobile ? 128 : 192; this.rows = opts.mobile ? 96 : 128;
    this.calm = opts.reduced; this.rowRate = opts.reduced ? 5 : 26;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.data = new Uint8Array(this.cols * this.rows);
    this.tex = new THREE.DataTexture(this.data, this.cols, this.rows, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    for (let r = 0; r < this.rows; r++) this.fillRow(r, true);
    this.u = {
      uH: { value: this.tex }, uTex: { value: new THREE.Vector2(this.cols, this.rows) }, uFrac: { value: 0 }, uAmp: { value: 3.4 },
      uFocus: { value: 0.5 }, uFocusAmt: { value: 0 }, uWidth: { value: 0.05 }, uTime: { value: 0 }, uLevel: { value: 0 }, uFog: { value: FOG },
    };
    const geo = new THREE.PlaneGeometry(26, 44, this.cols - 1, this.rows - 1); geo.rotateX(-Math.PI / 2);
    this.terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG }));
    this.terrain.frustumCulled = false; this.scene.add(this.terrain);
    this.beamU = { uAmt: { value: 0 }, uLevel: { value: 0 } };
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), new THREE.ShaderMaterial({ uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(this.beam);
    // motas de polvo que atraviesan la luz
    const n = opts.mobile ? 160 : 380; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = 0.2 + Math.random() * 5; pos[i * 3 + 2] = -22 + Math.random() * 40; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x0e1230, size: 0.022, transparent: true, opacity: 0.32, depthWrite: false }));
    this.scene.add(this.dust);
    this.camera.position.set(0, 3.0, 14); this.resize();
  }

  // ---- datos: fila nueva = espectro real (si suena algo) o dunas en calma
  private fillRow(r: number, idle: boolean): void {
    const W = this.cols, o = r * W, t = this.time + r * 0.15;
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const u = i / (W - 1);
      let v: number;
      if (!idle && beat.active) {
        const f = freqAt(u), f2 = freqAt(Math.min(1, u + 1 / W));
        const b0 = Math.floor((f / (beat.rate / 2)) * 512), b1 = Math.max(b0 + 1, Math.ceil((f2 / (beat.rate / 2)) * 512));
        let m = 0; for (let b = b0; b < Math.min(512, b1); b++) m = Math.max(m, beat.spec[b]);
        v = Math.pow(m / 255, 1.35) * (0.78 + 0.5 * u);
      } else {
        v = 0.07 + 0.06 * Math.sin(u * 9 + t * 0.7) * Math.sin(u * 3.1 - t * 0.43) + 0.05 * Math.sin(u * 23 + t * 1.1);
        v = Math.max(0.02, v);
      }
      this.data[o + i] = Math.round(clamp(v, 0, 1) * 255); sum += v;
    }
    this.level = damp(this.level, sum / W, 8, 0.016);
  }
  private pushRow(): void {
    const W = this.cols;
    this.data.copyWithin(0, W);
    // suaviza en frecuencia la fila nueva con la anterior para que el relieve sea continuo
    this.fillRow(this.rows - 1, !beat.active);
    const o = (this.rows - 1) * W, p = (this.rows - 2) * W;
    for (let i = 0; i < W; i++) this.data[o + i] = Math.round(this.data[o + i] * 0.7 + this.data[p + i] * 0.3);
    this.tex.needsUpdate = true;
  }

  // ---- control
  begin(): void { this.dragging = true; this.vy = 0; }
  end(): void { this.dragging = false; }
  look(dx: number, dy: number, dt: number): void {
    this.ty = clamp(this.ty - dx * 0.004, -0.7, 0.7); this.tp = clamp(this.tp - dy * 0.003, -0.25, 0.3);
    this.vy = dt > 0 ? clamp((-dx * 0.004) / dt, -2, 2) : 0;
  }
  setFocus(u: number, engaged: boolean, width?: number): void {
    this.focus = clamp(u, 0, 1); this.engaged = engaged; if (width !== undefined) this.width = clamp(width, 0, 1);
  }
  get focusHz(): number { return freqAt(this.focus); }
  get q(): number { return lerp(9, 1.2, this.width); }

  resize(): void {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 74 : 58; this.camera.updateProjectionMatrix();
  }
  start(): void {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return; this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  private update(dt: number): void {
    this.time += dt; beat.sample(dt); this.onFrame?.();
    this.acc += dt * this.rowRate;
    while (this.acc >= 1) { this.acc -= 1; this.pushRow(); }
    this.u.uFrac.value = this.acc; this.u.uTime.value = this.time;
    this.focusSm = damp(this.focusSm, this.focus, 12, dt);
    this.engSm = damp(this.engSm, this.engaged ? 1 : 0, 6, dt);
    const lvl = beat.active ? clamp(this.level * 2.2, 0, 1) : 0.15;
    this.u.uFocus.value = this.focusSm; this.u.uFocusAmt.value = this.engSm; this.u.uWidth.value = lerp(0.016, 0.07, this.width);
    this.u.uLevel.value = lvl; this.u.uAmp.value = 3.3 + (beat.active ? beat.amt * 0.5 : 0);
    // sonido real: enfoca la banda elegida (solo cuando el cursor está dentro)
    if (beat.active && (this.engaged || this.lastFocusSent > 0.001)) {
      beat.setFocus(freqAt(this.focusSm), this.engSm, this.q); this.lastFocusSent = this.engSm;
    }
    // haz de luz sobre la zona enfocada
    const bx = (this.focusSm - 0.5) * 26;
    this.beam.position.set(bx, 1.7, 3); this.beam.rotation.y = 0; this.beam.scale.set(lerp(0.4, 1.8, this.width), 1, 1);
    this.beamU.uAmt.value = this.engSm; this.beamU.uLevel.value = lvl;
    // cámara: vuela sobre el relieve; se puede mirar alrededor
    if (!this.dragging) { this.ty += this.vy * dt; this.vy = damp(this.vy, 0, 3, dt); this.ty = damp(this.ty, 0, 0.5, dt); this.tp = damp(this.tp, 0, 0.6, dt); }
    this.yaw = damp(this.yaw, this.ty, 7, dt); this.pitch = damp(this.pitch, this.tp, 7, dt);
    const bob = this.calm ? 0 : Math.sin(this.time * 0.5) * 0.12;
    this.camera.position.set(Math.sin(this.time * 0.17) * (this.calm ? 0 : 0.8) + (this.focusSm - 0.5) * 3, 3.0 + bob, 14);
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(-0.34 + this.pitch, this.yaw - (this.focusSm - 0.5) * 0.12, 0);
    const fov0 = this.camera.aspect < 0.8 ? 74 : 58, fov = fov0 + (beat.active && !this.calm ? beat.amt * 2.2 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.02) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // polvo: avanza hacia la cámara con el flujo
    const p = (this.dust.geometry.getAttribute('position') as THREE.BufferAttribute);
    if (!this.calm) {
      for (let i = 0; i < p.count; i++) {
        let z = p.getZ(i) + dt * 3.2; if (z > 15) { z -= 40; p.setX(i, (Math.random() - 0.5) * 26); }
        p.setZ(i, z); p.setY(i, p.getY(i) + Math.sin(this.time + i) * 0.0008);
      }
      p.needsUpdate = true;
    }
    (this.dust.material as THREE.PointsMaterial).opacity = 0.2 + lvl * 0.35;
  }

  dispose(): void { this.stop(); this.tex.dispose(); disposeTree(this.scene); this.renderer.dispose(); }
}
