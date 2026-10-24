import * as THREE from 'three';
import { clamp, damp, easeOutCubic } from '../engine/math.ts';
import { disposeTree } from '../engine/dispose.ts';

const COLS = 54;
const ROWS = 72;
const GAP = 0.9;

interface Tile { x: number; y: number; lum: number; sx: number; sy: number; sz: number; rx: number; ry: number; delay: number; push: number }

/** Mosaico 3D: la foto se divide en baldosas cuya altura sigue la luminosidad. Se ensambla al entrar y el cursor las empuja. */
export class MosaicScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private readonly mesh: THREE.InstancedMesh;
  private readonly tiles: Tile[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly group = new THREE.Group();
  private assemble = 0;
  private tx = 0; private ty = 0; private rx = 0; private ry = 0;
  private px = 9; private py = 9;
  private running = false;
  private raf = 0;
  private last = 0;
  private t0 = 0;

  constructor(private readonly canvas: HTMLCanvasElement, img: HTMLImageElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.camera.position.set(0, 0, 11);
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1f4a, 1.1));
    const key = new THREE.DirectionalLight(0xfff0dc, 3.2);
    key.position.set(-3, 5, 7);
    const rim = new THREE.DirectionalLight(0x6f8cff, 2);
    rim.position.set(5, -2, 3);
    this.scene.add(key, rim);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.38 });
    this.mesh = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.mesh);
    this.sample(img);
    this.resize();
  }

  private sample(img: HTMLImageElement): void {
    const c = document.createElement('canvas');
    c.width = COLS; c.height = ROWS;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    // recorte "cover" 3:4 sobre la foto
    const ar = COLS / ROWS;
    let sw = img.naturalWidth, sh = img.naturalHeight;
    if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, COLS, ROWS);
    const d = g.getImageData(0, 0, COLS, ROWS).data;
    const col = new THREE.Color();
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = (j * COLS + i) * 4;
        const r = d[k] / 255, gg = d[k + 1] / 255, b = d[k + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
        const x = (i - (COLS - 1) / 2) / COLS * 6.6;
        const y = ((ROWS - 1) / 2 - j) / ROWS * 8.8;
        const idx = j * COLS + i;
        col.setRGB(r, gg, b, THREE.SRGBColorSpace);
        this.mesh.setColorAt(idx, col);
        const dist = Math.hypot(x / 3.3, y / 4.4);
        this.tiles.push({
          x, y, lum,
          sx: (Math.random() - 0.5) * 22, sy: (Math.random() - 0.5) * 16, sz: 4 + Math.random() * 10,
          rx: (Math.random() - 0.5) * 6, ry: (Math.random() - 0.5) * 6,
          delay: clamp(dist * 0.45 + Math.random() * 0.25, 0, 0.95), push: 0,
        });
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // encuadre: el mosaico (≈6.6×8.8) siempre cabe
    const fitH = 9.6 / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const fitW = 7.4 / (this.camera.aspect * 2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.camera.position.z = Math.max(fitH, fitW);
    this.camera.updateProjectionMatrix();
  }

  /** Puntero en coordenadas normalizadas del canvas (-1..1) o null al salir. */
  setPointer(nx: number | null, ny: number | null): void {
    if (nx === null || ny === null) { this.px = 9; this.py = 9; this.tx = 0; this.ty = 0; return; }
    this.px = nx * 3.3 * 1.05; this.py = ny * 4.4 * 1.05;
    this.tx = ny * -0.18; this.ty = nx * 0.24;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (!this.t0) this.t0 = this.last;
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt, (now - this.t0) / 1000);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  private update(dt: number, time: number): void {
    this.assemble = clamp((time - 0.15) / 3.2, 0, 1);
    this.rx = damp(this.rx, this.tx, 4, dt);
    this.ry = damp(this.ry, this.ty + Math.sin(time * 0.35) * 0.08, 4, dt);
    this.group.rotation.set(this.rx, this.ry, 0);
    const s = (6.6 / COLS) * GAP;
    const t = this.tiles;
    for (let n = 0; n < t.length; n++) {
      const a = t[n];
      const p = easeOutCubic(clamp((this.assemble - a.delay * 0.55) / 0.45, 0, 1));
      const d = Math.hypot(a.x - this.px, a.y - this.py);
      const target = d < 1.1 ? (1.1 - d) * 1.5 : 0;
      a.push = damp(a.push, target, target > a.push ? 14 : 3.5, dt);
      const h = 0.18 + a.lum * 0.75;
      const o = this.dummy;
      o.position.set(a.x + a.sx * (1 - p), a.y + a.sy * (1 - p), (h * 0.5 + a.push) * p + a.sz * (1 - p));
      o.rotation.set(a.rx * (1 - p), a.ry * (1 - p), 0);
      o.scale.set(s, s, Math.max(0.001, h * p + 0.001));
      o.updateMatrix();
      this.mesh.setMatrixAt(n, o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.stop();
    disposeTree(this.scene);
    this.renderer.dispose();
  }
}
