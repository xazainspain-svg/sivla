import * as THREE from 'three';
import { Input } from './input';
import { PROFILES, QualityController, type QualityLevel } from './quality';
import { DiscScene } from '../scenes/DiscScene';

export interface EngineOptions {
  still: boolean;
}

/** Motor del hero: un renderer, un bucle, calidad adaptativa, pausa fuera de pantalla y recuperación de contexto. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly input = new Input();
  readonly quality = new QualityController(2, true);
  scene!: DiscScene;
  private raf = 0;
  private last = performance.now();
  private elapsed = 0;
  private running = false;
  private visible = true;
  private pageVisible = !document.hidden;
  private io: IntersectionObserver;

  constructor(private canvas: HTMLCanvasElement, private opts: EngineOptions, observe: Element) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.applyPixelRatio();
    this.scene = new DiscScene(this.quality.level, opts.still);
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVis);
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    // el render solo corre mientras el hero es visible
    this.io = new IntersectionObserver((e) => { this.visible = e[0]?.isIntersecting ?? true; }, { rootMargin: '200px' });
    this.io.observe(observe);
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PROFILES[this.quality.level].maxPixelRatio));
  }

  private resize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.scene.resize(window.innerWidth, window.innerHeight);
    if (this.opts.still) this.renderOnce();
  };

  private onVis = (): void => { this.pageVisible = !document.hidden; this.last = performance.now(); };

  renderOnce(): void {
    this.scene.update(0.016, 0, this.input.state);
    this.renderer.render(this.scene.scene, this.scene.camera);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (!this.visible || !this.pageVisible) { this.last = now; return; }
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.elapsed += dt;
      this.input.update(dt);
      this.scene.update(dt, this.elapsed, this.input.state);
      this.renderer.render(this.scene.scene, this.scene.camera);
      const changed = this.quality.push(dt * 1000);
      if (changed !== null) this.applyQuality(changed);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private applyQuality(level: QualityLevel): void {
    this.applyPixelRatio();
    this.scene.setQuality(level);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  private onLost = (e: Event): void => { e.preventDefault(); this.running = false; cancelAnimationFrame(this.raf); };
  private onRestored = (): void => {
    this.scene.dispose();
    this.scene = new DiscScene(this.quality.level, this.opts.still);
    this.scene.resize(window.innerWidth, window.innerHeight);
    this.scene.startIntro();
    this.start();
  };

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.io.disconnect();
    this.scene.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
