import * as THREE from 'three';
import { clamp, damp, smoothstep } from '../engine/math';
import { disposeTree } from '../engine/dispose';
import { studioEnvironment } from '../materials/environments';
import { beat } from '../app/beat';
import { CameraRig, type View } from './rig';
import { brushedMap } from './textures';
import { buildConsole, buildMonitor, buildSynth, buildCredits, buildMastering, buildContact, buildTurntable, buildHeadphones, type Piece, type Sig } from './equipment';

export type HotId = 'console' | 'monitors' | 'synth' | 'credits' | 'mastering' | 'contact';
export interface HotInfo { id: HotId; label: string; view: View }

const D = Math.PI / 180;
export const HOTSPOTS: HotInfo[] = [
  { id: 'console', label: 'Consola · mezcla y sonido', view: { yaw: 0, pitch: -0.12, fov: 40 } },
  { id: 'monitors', label: 'Monitores · activar el audio', view: { yaw: 0, pitch: 0.02, fov: 52 } },
  { id: 'synth', label: 'Sintetizador · producciones', view: { yaw: -90 * D, pitch: -0.12, fov: 46 } },
  { id: 'credits', label: 'Créditos verificados', view: { yaw: 90 * D, pitch: 0.02, fov: 50 } },
  { id: 'mastering', label: 'Mix & Mastering', view: { yaw: 62 * D, pitch: 0.02, fov: 46 } },
  { id: 'contact', label: 'Contactar con SIV-LA', view: { yaw: 180 * D, pitch: -0.05, fov: 52 } },
];

interface Hot { info: HotInfo; piece: Piece; hover: number; target: number }

/** Estudio 3D explorable: sala con consola, monitores, sintetizador, panel de créditos, rack de mastering y zona de contacto. */
export class StudioScene {
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 40);
  readonly rig: CameraRig;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly hots: Hot[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly lights: { l: THREE.Light; base: number }[] = [];
  private readonly strips: { m: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  private accent!: THREE.PointLight;
  onFrame: (() => void) | null = null;
  private readonly env: THREE.Texture;
  private running = false;
  private raf = 0;
  private last = 0;
  time = 0;
  /** 0 = oscuro, 1 = todas las luces. La intro lo sube; "saltar" lo lleva a 1. */
  light = 0;
  private lightTarget = 1;
  introT = 0;
  introDone = false;
  readonly mobile: boolean;
  private readonly still: boolean;

  constructor(private readonly canvas: HTMLCanvasElement, opts: { mobile: boolean; reduced: boolean }) {
    this.mobile = opts.mobile; this.still = opts.reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !opts.mobile;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.env = studioEnvironment(this.renderer);
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.9;
    this.scene.background = new THREE.Color(0xeef0fa);
    this.scene.fog = new THREE.Fog(0xeef0fa, 7, 17);
    const portrait = window.innerHeight > window.innerWidth;
    this.rig = new CameraRig(this.camera, { yaw: 0, pitch: -0.04, fov: portrait ? 74 : 60 }, portrait ? 86 : 78);
    this.camera.position.set(0, 1.55, 0.9);
    this.buildRoom();
    this.buildPieces();
    this.buildLights();
    this.resize();
    if (opts.reduced) { this.light = 1; this.introDone = true; }
    else { this.light = 0.3; this.camera.position.z = 2.4; this.rig.fov = 78; }
  }

  // ---- construcción
  private buildRoom(): void {
    const brushed = brushedMap();
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xdde1f2, roughness: 0.35, metalness: 0.25, roughnessMap: brushed });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f5fb, roughness: 0.85, metalness: 0.0 });
    const mk = (x: number, y: number, z: number, ry: number): void => { const w = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), wallMat); w.position.set(x, y, z); w.rotation.y = ry; w.receiveShadow = true; this.scene.add(w); };
    mk(0, 2.1, -5, 0); mk(0, 2.1, 5, Math.PI); mk(-5, 2.1, 0, Math.PI / 2); mk(5, 2.1, 0, -Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xfafbff, roughness: 0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.2; this.scene.add(ceil);
    // paneles acústicos (listones) en las paredes frontal y derecha
    const n = this.mobile ? 26 : 48;
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xd6daec, roughness: 0.75, metalness: 0.1 });
    const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 3.2, 0.12), slatMat, n * 2);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)); const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const u = -4.6 + (9.2 / (n - 1)) * i;
      m.makeTranslation(u, 2.0, -4.92); slats.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(4.92, 2.0, u), q, one); slats.setMatrixAt(n + i, m);
    }
    slats.receiveShadow = true; this.scene.add(slats);
    // tiras de luz en el techo y bajo los paneles
    const stripMat = (c: number): THREE.MeshBasicMaterial => { const mt = new THREE.MeshBasicMaterial({ color: c }); this.strips.push({ m: mt, base: new THREE.Color(c) }); return mt; };
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.08), stripMat(0xdfe6ff)); s1.position.set(0, 4.15, -2.2);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.08), stripMat(0xdfe6ff)); s2.position.set(0, 4.15, 2.2);
    const s3 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.03, 0.05), stripMat(0x2f5bee)); s3.position.set(0, 0.35, -4.9);
    const s4 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 8.6), stripMat(0xe08a45)); s4.position.set(4.9, 0.35, 0);
    this.scene.add(s1, s2, s3, s4);
  }

  private buildPieces(): void {
    const ctx = { brushed: brushedMap(), mobile: this.mobile };
    const add = (id: HotId, piece: Piece, x: number, y: number, z: number, ry = 0): void => {
      piece.group.position.set(x, y, z); piece.group.rotation.y += ry;
      this.scene.add(piece.group);
      const info = HOTSPOTS.find((h) => h.id === id)!;
      piece.group.traverse((o) => { o.userData.hot = id; });
      piece.glow.forEach((g) => { g.userData.base ??= g.emissiveIntensity; });
      this.hots.push({ info, piece, hover: 0, target: 0 });
    };
    add('console', buildConsole(ctx), 0, 0, -3.1);
    // los dos monitores comparten la acción "monitores"
    const ml = buildMonitor(ctx, -1), mr = buildMonitor(ctx, 1);
    const tt = buildTurntable(ctx); tt.group.position.set(-3.2, 0, -2.5); tt.group.rotation.y = 0.55;
    const both = new THREE.Group(); ml.group.position.set(-2.1, 0, -3.3); mr.group.position.set(2.1, 0, -3.3); both.add(ml.group, mr.group, tt.group);
    add('monitors', { group: both, glow: [...ml.glow, ...mr.glow, ...tt.glow], tick: (s, l, h) => { ml.tick?.(s, l, h); mr.tick?.(s, l, h); tt.tick?.(s, l, h); } }, 0, 0, 0);
    const hp = buildHeadphones(); hp.group.position.set(1.38, 0.93, -2.55); hp.group.rotation.y = -0.4; this.scene.add(hp.group);
    add('synth', buildSynth(ctx), 3.9, 0, -0.4, -Math.PI / 2);
    add('credits', buildCredits(), -4.92, 1.9, 0, Math.PI / 2);
    add('mastering', buildMastering(ctx), -4.2, 0, 2.2, Math.PI / 2 + 0.3);
    add('contact', buildContact(), 0, 0, 4.3, Math.PI);
    // alfombra bajo la consola
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0xc9cee6, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, -2.4); rug.receiveShadow = true; this.scene.add(rug);
  }

  private buildLights(): void {
    const add = <T extends THREE.Light>(l: T, base: number): T => { this.scene.add(l); this.lights.push({ l, base }); return l; };
    add(new THREE.HemisphereLight(0xffffff, 0xc9cee6, 1.6), 1.6);
    const spot = add(new THREE.SpotLight(0xfff1de, 200, 12, 0.7, 0.6, 1.6), 200);
    spot.position.set(0, 3.9, -1.2); spot.target.position.set(0, 0.8, -3.1); this.scene.add(spot.target);
    if (!this.mobile) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; }
    const side = add(new THREE.SpotLight(0x9fb4ff, 90, 12, 0.8, 0.7, 1.6), 90); side.position.set(-3.8, 3.5, 1); side.target.position.set(-4.9, 1.8, 0); this.scene.add(side.target);
    const synthL = add(new THREE.SpotLight(0xffd2a8, 110, 10, 0.7, 0.7, 1.6), 110); synthL.position.set(2.6, 3.5, -0.4); synthL.target.position.set(3.9, 0.9, -0.4); this.scene.add(synthL.target);
    const back = add(new THREE.SpotLight(0xffc9a0, 90, 10, 0.8, 0.7, 1.6), 90); back.position.set(0, 3.6, 2.2); back.target.position.set(0, 0.8, 4.3); this.scene.add(back.target);
    this.accent = add(new THREE.PointLight(0x2f5bee, 14, 7, 2), 14);
    this.accent.position.set(0, 1.2, -4.3);
  }

  // ---- interacción
  pick(clientX: number, clientY: number): HotId | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.userData.hot);
    return (hit?.object.userData.hot as HotId | undefined) ?? null;
  }
  setHover(id: HotId | null): void { this.hots.forEach((h) => { h.target = h.info.id === id ? 1 : 0; }); }
  focus(id: HotId): void { const h = HOTSPOTS.find((x) => x.id === id); if (h) this.rig.focus(h.view); }
  skipIntro(): void { this.introDone = true; this.lightTarget = 1; this.introT = 99; }

  // ---- ciclo
  resize(): void {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 1.75));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  start(): void {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  private update(dt: number): void {
    this.time += dt;
    beat.sample(dt);
    // intro: la luz sube, la cámara avanza y el campo de visión se abre
    if (!this.introDone) {
      this.introT += dt;
      const u = clamp(this.introT / 4.2, 0, 1);
      this.light = 0.3 + 0.7 * smoothstep(0.05, 0.95, u);
      this.camera.position.z = 2.4 - 1.5 * (1 - Math.pow(1 - u, 3));
      this.rig.focus({ yaw: this.rig.home.yaw + (1 - u) * 0.0, pitch: this.rig.home.pitch, fov: this.rig.home.fov });
      if (u >= 1) this.introDone = true;
    } else {
      this.light = damp(this.light, this.lightTarget, 3, dt);
      this.camera.position.z = damp(this.camera.position.z, 0.9, 3, dt);
    }
    this.rig.update(dt, Math.sin(this.time * 0.6), this.still);
    this.onFrame?.();
    const sig: Sig = { t: this.time, bands: beat.bands, amt: beat.amt, active: beat.active };
    const k = this.light;
    const kick = beat.active ? beat.amt : 0;
    this.lights.forEach(({ l, base }) => { l.intensity = base * k * (1 + kick * 0.18); });
    this.strips.forEach(({ m, base }) => m.color.copy(base).multiplyScalar(k * (0.9 + kick * 0.3)));
    this.accent.intensity = (14 + kick * 10) * k;
    for (const h of this.hots) {
      h.hover = damp(h.hover, h.target, 12, dt);
      h.piece.tick?.(sig, k, h.hover);
      for (const g of h.piece.glow) g.emissiveIntensity = ((g.userData.base as number) * k) + h.hover * 0.9 + ((g.userData.pulse as number) || 0);
    }
  }

  dispose(): void { this.stop(); disposeTree(this.scene); this.env.dispose(); this.renderer.dispose(); }
}
